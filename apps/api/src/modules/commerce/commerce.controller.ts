import crypto from 'node:crypto';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Req,
} from '@nestjs/common';
import { z } from 'zod';
import { DatabaseService, DbExecutor } from '../../db/database.service.js';
import { AuditService } from '../../common/audit.service.js';
import { AppDomainError } from '../../common/api-error.filter.js';
import { AuthContext, Public } from '../../common/auth.guard.js';
import { sanitizeText, sha256Hex, verifyHmacSha256 } from '../../common/crypto.util.js';

const AddCartItemSchema = z
  .object({
    variantId: z.string().min(1),
    quantity: z.number().int().min(1).max(20),
  })
  .strict();

const UpdateCartItemSchema = z
  .object({
    quantity: z.number().int().min(0).max(20),
  })
  .strict();

const ApplyCouponSchema = z
  .object({
    code: z.string().max(40),
  })
  .strict();

const CheckoutSchema = z
  .object({
    fullName: z.string().min(2).max(120),
    phone: z.string().min(7).max(25),
    wardNumber: z.number().int().min(1).max(32).default(10),
    streetAddress: z.string().min(3).max(240),
    landmark: z.string().max(180).default(''),
    deliveryInstructions: z.string().max(240).default(''),
    paymentMethod: z.enum(['ESEWA', 'KHALTI', 'COD']),
    couponCode: z.string().max(40).optional(),
    items: z
      .array(
        z
          .object({
            variantId: z.string().min(1),
            quantity: z.number().int().min(1).max(20),
          })
          .strict(),
      )
      .optional(),
  })
  .strict();

const CreateReviewSchema = z
  .object({
    productId: z.string().min(1),
    orderItemId: z.string().min(1).optional(),
    rating: z.number().int().min(1).max(5),
    comment: z.string().min(5).max(1500),
    mediaUrls: z.array(z.string().url()).max(4).optional(),
  })
  .strict();

const CreateReturnSchema = z
  .object({
    orderItemId: z.string().min(1),
    requestType: z.enum(['RETURN', 'EXCHANGE']),
    reason: z.string().min(3).max(800),
    explanation: z.string().min(10).max(1000).optional(),
    replacementVariantId: z.string().optional(),
    evidenceUrls: z.array(z.string().url()).max(5).optional(),
    pickupAddressText: z.string().max(300).optional(),
  })
  .strict();

@Controller('api/v1')
export class CommerceController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  // ==========================================================================
  // WISHLIST
  // ==========================================================================
  @Get('customer/wishlist')
  async getWishlist(@Req() req: any) {
    const auth: AuthContext = req.auth;
    const res = await this.db.query(
      `SELECT
         w.id AS wishlist_item_id,
         w.created_at AS saved_at,
         p.id,
         p.slug,
         p.title,
         p.subtitle,
         p.base_price_paisa,
         p.compare_at_price_paisa,
         p.currency,
         p.rating_avg,
         p.review_count,
         v.business_name AS vendor_name,
         (SELECT pm.url FROM product_media pm WHERE pm.product_id = p.id ORDER BY pm.sort_order ASC LIMIT 1) AS image_url,
         (SELECT pv.id FROM product_variants pv WHERE pv.product_id = p.id AND pv.status = 'ACTIVE' ORDER BY pv.created_at ASC LIMIT 1) AS default_variant_id
       FROM wishlist_items w
       JOIN products p ON p.id = w.product_id
       JOIN vendors v ON v.id = p.vendor_id
       WHERE w.customer_id = $1
         AND p.moderation_status = 'ACTIVE'
         AND v.approval_status = 'APPROVED'
       ORDER BY w.created_at DESC`,
      [auth.userId],
    );
    return { items: res.rows };
  }

  @Post('customer/wishlist')
  async addToWishlist(@Body() body: unknown, @Req() req: any) {
    const auth: AuthContext = req.auth;
    const dto = z.object({ productId: z.string().min(1) }).strict().parse(body);

    const prod = await this.db.query(
      `SELECT p.id FROM products p JOIN vendors v ON v.id = p.vendor_id
       WHERE p.id = $1 AND p.moderation_status = 'ACTIVE' AND v.approval_status = 'APPROVED'`,
      [dto.productId],
    );
    if (prod.rows.length === 0) {
      throw new AppDomainError('PRODUCT_NOT_FOUND', 'Product not found.', HttpStatus.NOT_FOUND);
    }

    await this.db.query(
      `INSERT INTO wishlist_items (id, customer_id, product_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (customer_id, product_id) DO NOTHING`,
      [`wish-${crypto.randomUUID()}`, auth.userId, dto.productId],
    );
    return this.getWishlist(req);
  }

  @Delete('customer/wishlist/:productId')
  async removeFromWishlist(@Param('productId') productId: string, @Req() req: any) {
    const auth: AuthContext = req.auth;
    await this.db.query('DELETE FROM wishlist_items WHERE customer_id = $1 AND product_id = $2', [
      auth.userId,
      productId,
    ]);
    return this.getWishlist(req);
  }

  // ==========================================================================
  // SERVER-CALCULATED CART & COUPONS
  // ==========================================================================
  @Get('customer/cart')
  async getCart(@Req() req: any) {
    const auth: AuthContext = req.auth;
    return this.computeServerCart(auth.userId);
  }

  @Post('customer/cart/items')
  async addCartItem(@Body() body: unknown, @Req() req: any) {
    const auth: AuthContext = req.auth;
    const dto = AddCartItemSchema.parse(body);

    const variantRes = await this.db.query<{
      variant_id: string;
      product_id: string;
      available_qty: number;
    }>(
      `SELECT pv.id AS variant_id, pv.product_id, COALESCE(ii.available_qty, 0) AS available_qty
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       JOIN vendors v ON v.id = p.vendor_id
       LEFT JOIN inventory_items ii ON ii.variant_id = pv.id
       WHERE pv.id = $1
         AND pv.status = 'ACTIVE'
         AND p.moderation_status = 'ACTIVE'
         AND v.approval_status = 'APPROVED'`,
      [dto.variantId],
    );

    if (variantRes.rows.length === 0) {
      throw new AppDomainError(
        'VARIANT_UNAVAILABLE',
        'Selected product variant is not available.',
        HttpStatus.NOT_FOUND,
      );
    }

    const variant = variantRes.rows[0];
    if (dto.quantity > Number(variant.available_qty)) {
      throw new AppDomainError(
        'INSUFFICIENT_STOCK',
        `Only ${variant.available_qty} unit(s) available in stock.`,
        HttpStatus.CONFLICT,
      );
    }

    const cartId = await this.ensureCart(auth.userId);
    await this.db.query(
      `INSERT INTO cart_items (id, cart_id, product_id, variant_id, quantity)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (cart_id, variant_id)
       DO UPDATE SET quantity = LEAST(cart_items.quantity + EXCLUDED.quantity, $6), updated_at = NOW()`,
      [
        `citem-${crypto.randomUUID()}`,
        cartId,
        variant.product_id,
        variant.variant_id,
        dto.quantity,
        Number(variant.available_qty),
      ],
    );

    return this.computeServerCart(auth.userId);
  }

  @Patch('customer/cart/items/:variantId')
  async updateCartItem(
    @Param('variantId') variantId: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const auth: AuthContext = req.auth;
    const dto = UpdateCartItemSchema.parse(body);
    const cartId = await this.ensureCart(auth.userId);

    if (dto.quantity === 0) {
      await this.db.query('DELETE FROM cart_items WHERE cart_id = $1 AND variant_id = $2', [
        cartId,
        variantId,
      ]);
      return this.computeServerCart(auth.userId);
    }

    const stockRes = await this.db.query<{ available_qty: number }>(
      'SELECT available_qty FROM inventory_items WHERE variant_id = $1',
      [variantId],
    );
    const available = Number(stockRes.rows[0]?.available_qty ?? 0);
    if (dto.quantity > available) {
      throw new AppDomainError(
        'INSUFFICIENT_STOCK',
        `Only ${available} unit(s) available in stock.`,
        HttpStatus.CONFLICT,
      );
    }

    await this.db.query(
      'UPDATE cart_items SET quantity = $1, updated_at = NOW() WHERE cart_id = $2 AND variant_id = $3',
      [dto.quantity, cartId, variantId],
    );

    return this.computeServerCart(auth.userId);
  }

  @Post('customer/cart/coupon')
  @HttpCode(HttpStatus.OK)
  async applyCoupon(@Body() body: unknown, @Req() req: any) {
    const auth: AuthContext = req.auth;
    const dto = ApplyCouponSchema.parse(body);
    const cartId = await this.ensureCart(auth.userId);
    const cleanCode = dto.code.trim().toUpperCase();

    if (!cleanCode) {
      await this.db.query('UPDATE carts SET coupon_code = NULL, updated_at = NOW() WHERE id = $1', [
        cartId,
      ]);
      return this.computeServerCart(auth.userId);
    }

    const cpn = await this.db.query(
      `SELECT * FROM coupons
       WHERE code = $1 AND is_active = TRUE
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [cleanCode],
    );
    if (cpn.rows.length === 0) {
      throw new AppDomainError(
        'INVALID_COUPON',
        'Coupon code is invalid or expired.',
        HttpStatus.BAD_REQUEST,
      );
    }

    await this.db.query('UPDATE carts SET coupon_code = $1, updated_at = NOW() WHERE id = $2', [
      cleanCode,
      cartId,
    ]);
    return this.computeServerCart(auth.userId);
  }

  private async ensureCart(customerId: string): Promise<string> {
    const existing = await this.db.query<{ id: string }>(
      'SELECT id FROM carts WHERE customer_id = $1',
      [customerId],
    );
    if (existing.rows.length > 0) return existing.rows[0].id;
    const id = `cart-${crypto.randomUUID()}`;
    await this.db.query('INSERT INTO carts (id, customer_id) VALUES ($1, $2)', [id, customerId]);
    return id;
  }

  private async computeServerCart(customerId: string, executor?: DbExecutor) {
    const db = executor ?? this.db;
    const cartRes = await db.query<{ id: string; coupon_code: string | null }>(
      'SELECT id, coupon_code FROM carts WHERE customer_id = $1',
      [customerId],
    );

    if (cartRes.rows.length === 0) {
      return {
        items: [],
        vendorGroups: [],
        couponCode: null,
        summary: {
          subtotalPaisa: 0,
          discountPaisa: 0,
          shippingPaisa: 0,
          taxPaisa: 0,
          totalPaisa: 0,
          currency: 'NPR',
        },
      };
    }

    const cart = cartRes.rows[0];
    const itemsRes = await db.query(
      `SELECT
         ci.id AS cart_item_id,
         ci.quantity,
         pv.id AS variant_id,
         pv.sku,
         pv.title AS variant_title,
         pv.size_value,
         pv.color_name,
         pv.price_paisa AS unit_price_paisa,
         p.id AS product_id,
         p.slug AS product_slug,
         p.title AS product_title,
         p.moderation_status,
         v.id AS vendor_id,
         v.slug AS vendor_slug,
         v.business_name AS vendor_name,
         v.approval_status AS vendor_approval_status,
         COALESCE(ii.available_qty, 0) AS available_qty,
         (SELECT pm.url FROM product_media pm WHERE pm.product_id = p.id ORDER BY pm.sort_order ASC LIMIT 1) AS image_url
       FROM cart_items ci
       JOIN product_variants pv ON pv.id = ci.variant_id
       JOIN products p ON p.id = pv.product_id
       JOIN vendors v ON v.id = p.vendor_id
       LEFT JOIN inventory_items ii ON ii.variant_id = pv.id
       WHERE ci.cart_id = $1
       ORDER BY ci.created_at ASC`,
      [cart.id],
    );

    const items = itemsRes.rows
      .filter((r) => r.moderation_status === 'ACTIVE' && r.vendor_approval_status === 'APPROVED')
      .map((r) => {
        const unitPricePaisa = Number(r.unit_price_paisa);
        const quantity = Number(r.quantity);
        return {
          ...r,
          unit_price_paisa: unitPricePaisa,
          quantity,
          available_qty: Number(r.available_qty),
          line_total_paisa: unitPricePaisa * quantity,
        };
      });

    const subtotalPaisa = items.reduce((acc, item) => acc + item.line_total_paisa, 0);

    let discountPaisa = 0;
    let appliedCouponCode: string | null = null;
    if (cart.coupon_code && subtotalPaisa > 0) {
      const cpnRes = await db.query(
        `SELECT * FROM coupons WHERE code = $1 AND is_active = TRUE`,
        [cart.coupon_code],
      );
      const cpn = cpnRes.rows[0];
      if (cpn && subtotalPaisa >= Number(cpn.min_order_paisa)) {
        appliedCouponCode = cpn.code;
        if (cpn.discount_type === 'PERCENTAGE') {
          discountPaisa = Math.floor((subtotalPaisa * Number(cpn.discount_value)) / 100);
          if (cpn.max_discount_paisa) {
            discountPaisa = Math.min(discountPaisa, Number(cpn.max_discount_paisa));
          }
        } else {
          discountPaisa = Math.min(subtotalPaisa, Number(cpn.discount_value));
        }
      }
    }

    const shippingPaisa = subtotalPaisa === 0 || subtotalPaisa >= 199900 ? 0 : 10000;
    const taxableAmount = Math.max(0, subtotalPaisa - discountPaisa);
    // 13% VAT included in catalog price snapshot breakdown
    const taxPaisa = Math.round((taxableAmount * 13) / 113);
    const totalPaisa = Math.max(0, subtotalPaisa - discountPaisa + shippingPaisa);

    const vendorMap = new Map<string, { vendorId: string; vendorName: string; items: any[]; subtotalPaisa: number }>();
    for (const item of items) {
      const existing = vendorMap.get(item.vendor_id) ?? {
        vendorId: item.vendor_id,
        vendorName: item.vendor_name,
        items: [] as any[],
        subtotalPaisa: 0,
      };
      existing.items.push(item);
      existing.subtotalPaisa += item.line_total_paisa;
      vendorMap.set(item.vendor_id, existing);
    }

    return {
      items,
      vendorGroups: Array.from(vendorMap.values()),
      couponCode: appliedCouponCode,
      summary: {
        subtotalPaisa,
        discountPaisa,
        shippingPaisa,
        taxPaisa,
        totalPaisa,
        currency: 'NPR',
      },
    };
  }

  // ==========================================================================
  // CONCURRENCY-SAFE IDEMPOTENT MULTI-VENDOR CHECKOUT
  // ==========================================================================
  @Post('customer/checkout')
  async checkout(
    @Body() body: unknown,
    @Headers('idempotency-key') idempotencyKeyHeader: string | undefined,
    @Req() req: any,
  ) {
    const auth: AuthContext = req.auth;
    const dto = CheckoutSchema.parse(body);
    const idempotencyKey = (idempotencyKeyHeader || '').trim() || `auto-${crypto.randomUUID()}`;
    const requestHash = sha256Hex(JSON.stringify(dto));

    return this.db.transaction(async (tx) => {
      // 1. Check Idempotency Key (Journey #7)
      const existingIdem = await tx.query<{
        request_hash: string;
        response_body_json: string;
      }>(
        `SELECT request_hash, response_body_json
         FROM idempotency_keys
         WHERE actor_id = $1 AND operation = 'CHECKOUT' AND idempotency_key = $2`,
        [auth.userId, idempotencyKey],
      );

      if (existingIdem.rows.length > 0) {
        return JSON.parse(existingIdem.rows[0].response_body_json);
      }

      // 2. If explicit items passed in checkout request, sync cart inside tx; otherwise use server cart
      if (dto.items && dto.items.length > 0) {
        const cartId = await this.ensureCartTx(tx, auth.userId);
        await tx.query('DELETE FROM cart_items WHERE cart_id = $1', [cartId]);
        for (const item of dto.items) {
          const vRes = await tx.query<{ product_id: string }>(
            'SELECT product_id FROM product_variants WHERE id = $1',
            [item.variantId],
          );
          if (vRes.rows.length === 0) {
            throw new AppDomainError('VARIANT_NOT_FOUND', 'Variant not found.', HttpStatus.NOT_FOUND);
          }
          await tx.query(
            `INSERT INTO cart_items (id, cart_id, product_id, variant_id, quantity)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              `citem-${crypto.randomUUID()}`,
              cartId,
              vRes.rows[0].product_id,
              item.variantId,
              item.quantity,
            ],
          );
        }
        if (dto.couponCode) {
          await tx.query('UPDATE carts SET coupon_code = $1 WHERE id = $2', [
            dto.couponCode.trim().toUpperCase(),
            cartId,
          ]);
        }
      }

      const cartData = await this.computeServerCart(auth.userId, tx);
      if (cartData.items.length === 0) {
        throw new AppDomainError(
          'EMPTY_CART',
          'Cannot place an order with an empty cart.',
          HttpStatus.BAD_REQUEST,
        );
      }

      // 3. Atomic Stock Reservation with Concurrency Check (Journey #6)
      for (const item of cartData.items) {
        const reserveRes = await tx.query<{ id: string; available_qty: number }>(
          `UPDATE inventory_items
           SET available_qty = available_qty - $1,
               reserved_qty = reserved_qty + $1,
               updated_at = NOW()
           WHERE variant_id = $2
             AND available_qty >= $1
           RETURNING id, available_qty`,
          [item.quantity, item.variant_id],
        );

        if (reserveRes.rows.length === 0) {
          throw new AppDomainError(
            'INSUFFICIENT_STOCK',
            `Insufficient stock for ${item.product_title} (${item.variant_title}).`,
            HttpStatus.CONFLICT,
          );
        }
      }

      // 4. Create Parent Order (#WBxxxxxx)
      const orderId = `ord-${crypto.randomUUID()}`;
      const orderNumber = `#WB${Math.floor(100000 + Math.random() * 900000)}`;
      const initialPaymentStatus = dto.paymentMethod === 'COD' ? 'PENDING_COD' : 'PENDING';

      await tx.query(
        `INSERT INTO orders (
          id, order_number, customer_id, status, payment_method, payment_status,
          subtotal_paisa, discount_paisa, tax_paisa, shipping_paisa, total_paisa,
          coupon_code, shipping_name, shipping_phone, shipping_ward, shipping_address,
          shipping_landmark, delivery_instructions, estimated_delivery_text, idempotency_key
        ) VALUES ($1,$2,$3,'NEW',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,'Today, 2-4 Hours',$18)`,
        [
          orderId,
          orderNumber,
          auth.userId,
          dto.paymentMethod,
          initialPaymentStatus,
          cartData.summary.subtotalPaisa,
          cartData.summary.discountPaisa,
          cartData.summary.taxPaisa,
          cartData.summary.shippingPaisa,
          cartData.summary.totalPaisa,
          cartData.couponCode,
          sanitizeText(dto.fullName),
          sanitizeText(dto.phone),
          dto.wardNumber,
          sanitizeText(dto.streetAddress),
          sanitizeText(dto.landmark),
          sanitizeText(dto.deliveryInstructions),
          idempotencyKey,
        ],
      );

      // 5. Partition into Vendor Orders & Snapshot Commissions (Journey #10)
      const createdVendorOrders: any[] = [];
      for (const group of cartData.vendorGroups) {
        const vendorOrderId = `vord-${crypto.randomUUID()}`;
        const vendorOrderNum = `${orderNumber}-${group.vendorId.slice(-3).toUpperCase()}`;

        const ruleRes = await tx.query<{ id: string; rate_bps: number }>(
          `SELECT id, rate_bps FROM vendor_commission_rules
           WHERE (vendor_id = $1 OR vendor_id IS NULL) AND is_active = TRUE
           ORDER BY vendor_id NULLS LAST
           LIMIT 1`,
          [group.vendorId],
        );
        const rateBps = Number(ruleRes.rows[0]?.rate_bps ?? 1000);
        const commissionPaisa = Math.round((group.subtotalPaisa * rateBps) / 10000);
        const netVendorPaisa = group.subtotalPaisa - commissionPaisa;
        const groupTaxPaisa = Math.round((group.subtotalPaisa * 13) / 113);

        await tx.query(
          `INSERT INTO vendor_orders (
            id, order_id, vendor_id, vendor_order_number, status,
            subtotal_paisa, discount_paisa, tax_paisa, shipping_paisa, total_paisa,
            commission_rate_bps, commission_paisa, net_vendor_paisa
          ) VALUES ($1,$2,$3,$4,'NEW',$5,0,$6,0,$5,$7,$8,$9)`,
          [
            vendorOrderId,
            orderId,
            group.vendorId,
            vendorOrderNum,
            group.subtotalPaisa,
            groupTaxPaisa,
            rateBps,
            commissionPaisa,
            netVendorPaisa,
          ],
        );

        await tx.query(
          `INSERT INTO commission_snapshots (
            id, vendor_order_id, vendor_id, rule_id, rate_bps,
            gross_amount_paisa, commission_paisa, net_vendor_paisa
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            `cs-${crypto.randomUUID()}`,
            vendorOrderId,
            group.vendorId,
            ruleRes.rows[0]?.id ?? null,
            rateBps,
            group.subtotalPaisa,
            commissionPaisa,
            netVendorPaisa,
          ],
        );

        for (const item of group.items) {
          await tx.query(
            `INSERT INTO order_items (
              id, order_id, vendor_order_id, product_id, variant_id, vendor_id,
              product_title_snapshot, variant_title_snapshot, sku_snapshot, image_url_snapshot,
              unit_price_paisa, quantity, line_total_paisa
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
            [
              `oitem-${crypto.randomUUID()}`,
              orderId,
              vendorOrderId,
              item.product_id,
              item.variant_id,
              item.vendor_id,
              item.product_title,
              item.variant_title,
              item.sku,
              item.image_url || '',
              item.unit_price_paisa,
              item.quantity,
              item.line_total_paisa,
            ],
          );

          const invRes = await tx.query<{ id: string }>(
            'SELECT id FROM inventory_items WHERE variant_id = $1',
            [item.variant_id],
          );
          await tx.query(
            `INSERT INTO stock_reservations (id, inventory_item_id, order_id, customer_id, quantity, status, expires_at)
             VALUES ($1, $2, $3, $4, $5, 'CONFIRMED', NOW() + INTERVAL '24 hours')`,
            [
              `sres-${crypto.randomUUID()}`,
              invRes.rows[0].id,
              orderId,
              auth.userId,
              item.quantity,
            ],
          );
        }

        // Initial Shipment & Tracking Timeline for Vendor Order
        const shipmentId = `ship-${crypto.randomUUID()}`;
        const trackingNumber = `TRK-${vendorOrderNum.replace('#', '')}`;
        await tx.query(
          `INSERT INTO shipments (
            id, vendor_order_id, carrier_name, tracking_number,
            delivery_partner_name, delivery_partner_phone,
            delivery_partner_avatar, status, estimated_delivery
          ) VALUES ($1,$2,'Birgunj Express Local',$3,'Rajesh Kumar','+977 9812345678',$4,'PREPARING','Today, 2-4 Hours')`,
          [
            shipmentId,
            vendorOrderId,
            trackingNumber,
            'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=160&auto=format&fit=crop&q=80',
          ],
        );

        await tx.query(
          `INSERT INTO tracking_events (id, shipment_id, status, title, description, location_text)
           VALUES ($1, $2, 'ORDER_CONFIRMED', 'Order Confirmed', 'Your order has been received by the Birgunj vendor.', 'Birgunj Hub')`,
          [`te-${crypto.randomUUID()}`, shipmentId],
        );

        createdVendorOrders.push({
          id: vendorOrderId,
          vendorId: group.vendorId,
          vendorName: group.vendorName,
          vendorOrderNumber: vendorOrderNum,
          subtotalPaisa: group.subtotalPaisa,
          status: 'NEW',
        });
      }

      // 6. Create Payment Attempt Record (Browser redirect alone never marks PAID)
      const paymentId = `pay-${crypto.randomUUID()}`;
      await tx.query(
        `INSERT INTO payments (id, order_id, provider, status, amount_paisa)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          paymentId,
          orderId,
          dto.paymentMethod,
          dto.paymentMethod === 'COD' ? 'PENDING_COD' : 'INITIATED',
          cartData.summary.totalPaisa,
        ],
      );

      // 7. Clear Cart
      await tx.query(
        'DELETE FROM cart_items WHERE cart_id IN (SELECT id FROM carts WHERE customer_id = $1)',
        [auth.userId],
      );
      await tx.query('UPDATE carts SET coupon_code = NULL WHERE customer_id = $1', [auth.userId]);

      const responsePayload = {
        order: {
          id: orderId,
          orderNumber,
          status: 'NEW',
          paymentMethod: dto.paymentMethod,
          paymentStatus: initialPaymentStatus,
          subtotalPaisa: cartData.summary.subtotalPaisa,
          discountPaisa: cartData.summary.discountPaisa,
          taxPaisa: cartData.summary.taxPaisa,
          shippingPaisa: cartData.summary.shippingPaisa,
          totalPaisa: cartData.summary.totalPaisa,
          currency: 'NPR',
          estimatedDeliveryText: 'Today, 2-4 Hours',
          vendorOrders: createdVendorOrders,
          paymentId,
        },
      };

      await tx.query(
        `INSERT INTO idempotency_keys (
          id, actor_id, operation, idempotency_key, request_hash, response_status, response_body_json, expires_at
        ) VALUES ($1,$2,'CHECKOUT',$3,$4,201,$5,NOW() + INTERVAL '24 hours')`,
        [
          `idem-${crypto.randomUUID()}`,
          auth.userId,
          idempotencyKey,
          requestHash,
          JSON.stringify(responsePayload),
        ],
      );

      return responsePayload;
    });
  }

  private async ensureCartTx(tx: DbExecutor, customerId: string): Promise<string> {
    const existing = await tx.query<{ id: string }>(
      'SELECT id FROM carts WHERE customer_id = $1',
      [customerId],
    );
    if (existing.rows.length > 0) return existing.rows[0].id;
    const id = `cart-${crypto.randomUUID()}`;
    await tx.query('INSERT INTO carts (id, customer_id) VALUES ($1, $2)', [id, customerId]);
    return id;
  }

  // ==========================================================================
  // SIGNED PAYMENT WEBHOOK INBOX (Journey #8 & #9)
  // ==========================================================================
  @Public()
  @Post('webhooks/payments/:provider')
  @HttpCode(HttpStatus.OK)
  async handlePaymentWebhook(
    @Param('provider') providerParam: string,
    @Headers('x-webhook-signature') signatureHeader: string | undefined,
    @Body() body: any,
  ) {
    const provider = providerParam.toUpperCase();
    const rawPayload = JSON.stringify(body);
    const secret =
      provider === 'KHALTI'
        ? process.env.KHALTI_WEBHOOK_SECRET || 'dev-only-khalti-hmac-secret-key'
        : process.env.ESEWA_WEBHOOK_SECRET || 'dev-only-esewa-hmac-secret-key';

    const signatureValid = verifyHmacSha256(secret, rawPayload, signatureHeader || '');
    const eventId = String(body?.eventId || body?.transactionId || '');

    if (!eventId) {
      throw new AppDomainError(
        'MISSING_EVENT_ID',
        'Webhook payload missing eventId.',
        HttpStatus.BAD_REQUEST,
      );
    }

    if (!signatureValid) {
      throw new AppDomainError(
        'INVALID_WEBHOOK_SIGNATURE',
        'Webhook signature verification failed.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    return this.db.transaction(async (tx) => {
      // Deduplicate in webhook_inbox
      const existing = await tx.query<{ id: string; processing_status: string }>(
        'SELECT id, processing_status FROM webhook_inbox WHERE provider = $1 AND provider_event_id = $2',
        [provider, eventId],
      );

      if (existing.rows.length > 0) {
        return {
          status: 'DUPLICATE_IGNORED',
          eventId,
        };
      }

      const inboxId = `whi-${crypto.randomUUID()}`;
      await tx.query(
        `INSERT INTO webhook_inbox (
          id, provider, provider_event_id, event_type, signature_valid, payload_json, processing_status, processed_at
        ) VALUES ($1,$2,$3,$4,TRUE,$5,'PROCESSED',NOW())`,
        [inboxId, provider, eventId, body.eventType || 'PAYMENT_CAPTURED', rawPayload],
      );

      const orderId = String(body.orderId || '');
      const amountPaisa = Number(body.amountPaisa || 0);

      const orderRes = await tx.query<{ id: string; total_paisa: number; payment_status: string }>(
        'SELECT id, total_paisa, payment_status FROM orders WHERE id = $1 OR order_number = $1',
        [orderId],
      );

      if (orderRes.rows.length === 0) {
        await tx.query(
          "UPDATE webhook_inbox SET processing_status = 'FAILED', error_message = 'Order not found' WHERE id = $1",
          [inboxId],
        );
        throw new AppDomainError('ORDER_NOT_FOUND', 'Referenced order not found.', HttpStatus.NOT_FOUND);
      }

      const order = orderRes.rows[0];
      if (Number(order.total_paisa) !== amountPaisa) {
        await tx.query(
          "UPDATE webhook_inbox SET processing_status = 'FAILED', error_message = 'Amount mismatch' WHERE id = $1",
          [inboxId],
        );
        throw new AppDomainError(
          'PAYMENT_AMOUNT_MISMATCH',
          'Webhook amount does not match order total.',
          HttpStatus.BAD_REQUEST,
        );
      }

      await tx.query(
        `UPDATE payments
         SET status = 'CAPTURED', provider_reference = $1, verified_at = NOW(), updated_at = NOW()
         WHERE order_id = $2`,
        [eventId, order.id],
      );

      await tx.query(
        `UPDATE orders SET payment_status = 'PAID', updated_at = NOW() WHERE id = $1`,
        [order.id],
      );

      return {
        status: 'PROCESSED',
        orderId: order.id,
        paymentStatus: 'PAID',
      };
    });
  }

  // ==========================================================================
  // CUSTOMER ORDERS, TRACKING, CANCELLATION, RETURNS & REVIEWS
  // ==========================================================================
  @Get('customer/orders')
  async listCustomerOrders(@Req() req: any) {
    const auth: AuthContext = req.auth;
    const ordersRes = await this.db.query(
      `SELECT * FROM orders WHERE customer_id = $1 ORDER BY created_at DESC`,
      [auth.userId],
    );

    const itemsRes = await this.db.query(
      `SELECT oi.*
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       WHERE o.customer_id = $1
       ORDER BY oi.created_at ASC`,
      [auth.userId],
    );

    const itemsByOrder = new Map<string, any[]>();
    for (const item of itemsRes.rows) {
      const list = itemsByOrder.get(item.order_id) ?? [];
      list.push(item);
      itemsByOrder.set(item.order_id, list);
    }

    return {
      items: ordersRes.rows.map((o) => ({
        ...o,
        items: itemsByOrder.get(o.id) ?? [],
      })),
    };
  }

  @Get('customer/orders/:id')
  async getCustomerOrderDetail(@Param('id') id: string, @Req() req: any) {
    return this.fetchCustomerOrder(id, req.auth.userId);
  }

  @Get('orders/:id')
  async getOrder(@Param('id') id: string, @Req() req: any) {
    return this.fetchCustomerOrder(id, req.auth.userId);
  }

  private async fetchCustomerOrder(id: string, customerId: string) {
    // STRICT CUSTOMER ISOLATION (Journey #12)
    const orderRes = await this.db.query(
      `SELECT * FROM orders WHERE (id = $1 OR order_number = $1) AND customer_id = $2`,
      [id, customerId],
    );

    if (orderRes.rows.length === 0) {
      throw new AppDomainError('ORDER_NOT_FOUND', 'Order not found.', HttpStatus.NOT_FOUND);
    }

    const order = orderRes.rows[0];
    const vendorOrdersRes = await this.db.query(
      `SELECT vo.*, v.business_name AS vendor_name, v.slug AS vendor_slug
       FROM vendor_orders vo
       JOIN vendors v ON v.id = vo.vendor_id
       WHERE vo.order_id = $1
       ORDER BY vo.created_at ASC`,
      [order.id],
    );

    const itemsRes = await this.db.query(
      `SELECT * FROM order_items WHERE order_id = $1 ORDER BY created_at ASC`,
      [order.id],
    );

    const shipmentsRes = await this.db.query(
      `SELECT s.*
       FROM shipments s
       JOIN vendor_orders vo ON vo.id = s.vendor_order_id
       WHERE vo.order_id = $1`,
      [order.id],
    );

    const trackingEventsRes = await this.db.query(
      `SELECT te.*
       FROM tracking_events te
       JOIN shipments s ON s.id = te.shipment_id
       JOIN vendor_orders vo ON vo.id = s.vendor_order_id
       WHERE vo.order_id = $1
       ORDER BY te.event_time ASC`,
      [order.id],
    );

    return {
      order,
      vendorOrders: vendorOrdersRes.rows,
      items: itemsRes.rows,
      shipments: shipmentsRes.rows,
      trackingEvents: trackingEventsRes.rows,
    };
  }

  @Post('customer/orders/:id/cancel')
  @HttpCode(HttpStatus.OK)
  async cancelCustomerOrder(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const auth: AuthContext = req.auth;
    const dto = z.object({ reason: z.string().min(3).max(400) }).strict().parse(body);

    return this.db.transaction(async (tx) => {
      const orderRes = await tx.query(
        'SELECT * FROM orders WHERE id = $1 AND customer_id = $2',
        [id, auth.userId],
      );
      if (orderRes.rows.length === 0) {
        throw new AppDomainError('ORDER_NOT_FOUND', 'Order not found.', HttpStatus.NOT_FOUND);
      }

      const order = orderRes.rows[0];
      if (!['NEW', 'PROCESSING'].includes(order.status)) {
        throw new AppDomainError(
          'ORDER_NOT_CANCELLABLE',
          'Orders that are already out for delivery or delivered cannot be self-cancelled.',
          HttpStatus.CONFLICT,
        );
      }

      const items = await tx.query<{ variant_id: string; quantity: number }>(
        'SELECT variant_id, quantity FROM order_items WHERE order_id = $1',
        [order.id],
      );

      for (const item of items.rows) {
        await tx.query(
          `UPDATE inventory_items
           SET available_qty = available_qty + $1,
               reserved_qty = GREATEST(0, reserved_qty - $1),
               updated_at = NOW()
           WHERE variant_id = $2`,
          [item.quantity, item.variant_id],
        );
      }

      await tx.query(
        `UPDATE orders SET status = 'CANCELLED', updated_at = NOW() WHERE id = $1`,
        [order.id],
      );
      await tx.query(
        `UPDATE vendor_orders
         SET status = 'CANCELLED', cancelled_at = NOW(), cancel_reason = $1, updated_at = NOW()
         WHERE order_id = $2`,
        [sanitizeText(dto.reason), order.id],
      );

      return { cancelled: true, orderId: order.id, status: 'CANCELLED' };
    });
  }

  @Post('customer/returns')
  async requestReturnOrExchange(@Body() body: unknown, @Req() req: any) {
    const auth: AuthContext = req.auth;
    const dto = CreateReturnSchema.parse(body);

    const itemRes = await this.db.query<{
      order_item_id: string;
      order_id: string;
      vendor_order_id: string;
      vendor_id: string;
      line_total_paisa: number;
      vo_status: string;
      delivered_at: string | null;
    }>(
      `SELECT
         oi.id AS order_item_id,
         oi.order_id,
         oi.vendor_order_id,
         oi.vendor_id,
         oi.line_total_paisa,
         vo.status AS vo_status,
         vo.delivered_at
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN vendor_orders vo ON vo.id = oi.vendor_order_id
       WHERE oi.id = $1 AND o.customer_id = $2`,
      [dto.orderItemId, auth.userId],
    );

    if (itemRes.rows.length === 0) {
      throw new AppDomainError(
        'ORDER_ITEM_NOT_FOUND',
        'Eligible order item not found for this account.',
        HttpStatus.NOT_FOUND,
      );
    }

    const row = itemRes.rows[0];
    if (row.vo_status !== 'DELIVERED' || !row.delivered_at) {
      throw new AppDomainError(
        'RETURN_INELIGIBLE_STATE',
        'Returns or exchanges can only be requested for delivered items.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const deliveredMs = new Date(row.delivered_at).getTime();
    const hoursSinceDelivery = (Date.now() - deliveredMs) / (1000 * 3600);
    if (hoursSinceDelivery > 36) {
      throw new AppDomainError(
        'RETURN_WINDOW_EXPIRED',
        'The 36-hour Birgunj Easy Exchange/Return window has expired for this item.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const dupCheck = await this.db.query(
      `SELECT id, status FROM return_requests WHERE order_item_id = $1 AND status NOT IN ('REJECTED', 'CANCELLED')`,
      [dto.orderItemId],
    );
    if (dupCheck.rows.length > 0) {
      throw new AppDomainError(
        'RETURN_ALREADY_REQUESTED',
        'A return or exchange request is already active for this order item.',
        HttpStatus.CONFLICT,
      );
    }

    if (dto.requestType === 'EXCHANGE' && dto.replacementVariantId) {
      const replRes = await this.db.query<{ id: string; available_qty: number; reserved_qty: number }>(
        `SELECT pv.id, ii.available_qty, ii.reserved_qty
         FROM product_variants pv
         JOIN inventory_items ii ON ii.variant_id = pv.id
         WHERE pv.id = $1`,
        [dto.replacementVariantId],
      );
      if (replRes.rows.length === 0 || (replRes.rows[0].available_qty - replRes.rows[0].reserved_qty) < 1) {
        throw new AppDomainError(
          'REPLACEMENT_OUT_OF_STOCK',
          'The selected replacement size/variant is currently out of stock.',
          HttpStatus.CONFLICT,
        );
      }
    }

    const returnId = `ret-${crypto.randomUUID()}`;
    const refundAmountPaisa = Number(row.line_total_paisa);

    await this.db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO return_requests (
          id, order_id, vendor_order_id, order_item_id, customer_id, vendor_id,
          request_type, reason, status, refund_amount_paisa,
          replacement_variant_id, customer_explanation, evidence_urls_json, pickup_address_text
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'REQUESTED',$9,$10,$11,$12,$13)`,
        [
          returnId,
          row.order_id,
          row.vendor_order_id,
          row.order_item_id,
          auth.userId,
          row.vendor_id,
          dto.requestType,
          sanitizeText(dto.reason),
          refundAmountPaisa,
          dto.replacementVariantId ?? null,
          dto.explanation ? sanitizeText(dto.explanation) : '',
          JSON.stringify(dto.evidenceUrls ?? []),
          dto.pickupAddressText ? sanitizeText(dto.pickupAddressText) : '',
        ],
      );

      await this.audit.log(
        {
          actorId: auth.userId,
          actorRole: 'CUSTOMER',
          vendorId: row.vendor_id,
          action: 'RETURN_REQUESTED',
          targetType: 'RETURN_REQUEST',
          targetId: returnId,
          reason: sanitizeText(dto.reason),
          metadata: { refundAmountPaisa, requestType: dto.requestType, replacementVariantId: dto.replacementVariantId },
        },
        tx,
      );
    });

    return {
      returnRequest: {
        id: returnId,
        orderItemId: row.order_item_id,
        requestType: dto.requestType,
        refundAmountPaisa,
        status: 'REQUESTED',
        replacementVariantId: dto.replacementVariantId,
      },
    };
  }

  @Get('customer/returns')
  async listCustomerReturns(@Req() req: any) {
    const auth: AuthContext = req.auth;
    const res = await this.db.query(
      `SELECT
         rr.*,
         o.order_number,
         oi.product_title_snapshot,
         oi.variant_title_snapshot,
         oi.sku_snapshot,
         oi.image_url_snapshot,
         oi.unit_price_paisa,
         oi.quantity,
         oi.line_total_paisa,
         v.business_name AS vendor_name,
         pv.title AS replacement_variant_title
       FROM return_requests rr
       JOIN orders o ON o.id = rr.order_id
       JOIN order_items oi ON oi.id = rr.order_item_id
       JOIN vendors v ON v.id = rr.vendor_id
       LEFT JOIN product_variants pv ON pv.id = rr.replacement_variant_id
       WHERE rr.customer_id = $1
       ORDER BY rr.requested_at DESC`,
      [auth.userId],
    );
    return { items: res.rows };
  }

  @Get('customer/returns/:id')
  async getCustomerReturn(@Param('id') id: string, @Req() req: any) {
    const auth: AuthContext = req.auth;
    const res = await this.db.query(
      `SELECT
         rr.*,
         o.order_number,
         oi.product_title_snapshot,
         oi.variant_title_snapshot,
         oi.sku_snapshot,
         oi.image_url_snapshot,
         oi.unit_price_paisa,
         oi.quantity,
         oi.line_total_paisa,
         v.business_name AS vendor_name,
         pv.title AS replacement_variant_title
       FROM return_requests rr
       JOIN orders o ON o.id = rr.order_id
       JOIN order_items oi ON oi.id = rr.order_item_id
       JOIN vendors v ON v.id = rr.vendor_id
       LEFT JOIN product_variants pv ON pv.id = rr.replacement_variant_id
       WHERE rr.id = $1 AND rr.customer_id = $2`,
      [id, auth.userId],
    );
    if (res.rows.length === 0) {
      throw new AppDomainError('RETURN_NOT_FOUND', 'Return request not found.', HttpStatus.NOT_FOUND);
    }
    return { returnRequest: res.rows[0] };
  }

  @Post('customer/reviews')
  async createVerifiedReview(@Body() body: unknown, @Req() req: any) {
    const auth: AuthContext = req.auth;
    const dto = CreateReviewSchema.parse(body);

    // Server-enforced verified purchase check (Journey #14)
    const eligibleRes = await this.db.query<{
      order_item_id: string;
      vendor_id: string;
    }>(
      `SELECT oi.id AS order_item_id, oi.vendor_id
       FROM order_items oi
       JOIN orders o ON o.id = oi.order_id
       JOIN vendor_orders vo ON vo.id = oi.vendor_order_id
       WHERE o.customer_id = $1
         AND oi.product_id = $2
         AND vo.status = 'DELIVERED'
         ${dto.orderItemId ? 'AND oi.id = $3' : ''}
       ORDER BY oi.created_at DESC`,
      dto.orderItemId
        ? [auth.userId, dto.productId, dto.orderItemId]
        : [auth.userId, dto.productId],
    );

    if (eligibleRes.rows.length === 0) {
      throw new AppDomainError(
        'REVIEW_NOT_ELIGIBLE',
        'Only customers with a delivered purchase of this product may submit a review.',
        HttpStatus.FORBIDDEN,
      );
    }

    const { order_item_id: orderItemId, vendor_id: vendorId } = eligibleRes.rows[0];
    const dupRes = await this.db.query(
      'SELECT id FROM reviews WHERE customer_id = $1 AND order_item_id = $2',
      [auth.userId, orderItemId],
    );

    if (dupRes.rows.length > 0) {
      throw new AppDomainError(
        'DUPLICATE_REVIEW',
        'You have already submitted a review for this purchased item.',
        HttpStatus.CONFLICT,
      );
    }

    const reviewId = `rev-${crypto.randomUUID()}`;
    await this.db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO reviews (
          id, product_id, order_item_id, customer_id, vendor_id,
          rating, comment, media_urls_json, moderation_status, is_verified_purchase
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'PUBLISHED',TRUE)`,
        [
          reviewId,
          dto.productId,
          orderItemId,
          auth.userId,
          vendorId,
          dto.rating,
          sanitizeText(dto.comment),
          JSON.stringify(dto.mediaUrls ?? []),
        ],
      );

      // Recompute authoritative rating average & review count on product
      await tx.query(
        `UPDATE products
         SET rating_avg = COALESCE((
               SELECT ROUND(AVG(rating)::numeric, 2)
               FROM reviews
               WHERE product_id = $1 AND moderation_status = 'PUBLISHED'
             ), 0),
             review_count = (
               SELECT COUNT(*)::int
               FROM reviews
               WHERE product_id = $1 AND moderation_status = 'PUBLISHED'
             ),
             updated_at = NOW()
         WHERE id = $1`,
        [dto.productId],
      );
    });

    return {
      review: {
        id: reviewId,
        productId: dto.productId,
        orderItemId,
        rating: dto.rating,
        comment: sanitizeText(dto.comment),
        isVerifiedPurchase: true,
      },
    };
  }
}
