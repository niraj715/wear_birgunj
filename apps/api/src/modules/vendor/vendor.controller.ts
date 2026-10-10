import crypto from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { z } from 'zod';
import { DatabaseService } from '../../db/database.service.js';
import { AuditService } from '../../common/audit.service.js';
import { AppDomainError } from '../../common/api-error.filter.js';
import {
  AuthContext,
  RequireStepUp,
  RequireVendor,
} from '../../common/auth.guard.js';
import { sanitizeText } from '../../common/crypto.util.js';

const VendorApplySchema = z
  .object({
    businessName: z.string().min(3).max(120),
    slug: z
      .string()
      .min(3)
      .max(80)
      .regex(/^[a-z0-9-]+$/),
    description: z.string().min(10).max(1000),
    panVatNumber: z.string().min(5).max(40),
    contactEmail: z.string().email(),
    contactPhone: z.string().min(7).max(25),
    wardNumber: z.number().int().min(1).max(32).default(10),
    addressText: z.string().min(5).max(240),
    kycDocumentKey: z.string().min(5).max(240).default('private://kyc/pan-registration.pdf'),
    payoutMethod: z.enum(['ESEWA', 'KHALTI', 'BANK_TRANSFER']).default('ESEWA'),
    payoutAccountRef: z.string().min(4).max(80),
  })
  .strict();

const CreateProductSchema = z
  .object({
    title: z.string().min(3).max(160),
    subtitle: z.string().max(100).default(''),
    slug: z
      .string()
      .min(3)
      .max(120)
      .regex(/^[a-z0-9-]+$/),
    categoryId: z.string().min(1),
    brandId: z.string().optional(),
    description: z.string().min(10).max(3000),
    basePricePaisa: z.number().int().min(100),
    compareAtPricePaisa: z.number().int().min(100).optional(),
    saveAsDraft: z.boolean().default(false),
    imageUrls: z.array(z.string().url()).min(1).max(6),
    specifications: z.record(z.string(), z.string()).default({}),
    variants: z
      .array(
        z
          .object({
            sku: z.string().min(3).max(60),
            title: z.string().min(1).max(100),
            sizeValue: z.string().min(1).max(40).default('Standard'),
            colorName: z.string().min(1).max(40).default('Default'),
            colorHex: z.string().min(4).max(20).default('#111827'),
            pricePaisa: z.number().int().min(100),
            initialStock: z.number().int().min(0).max(10000),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

const UpdateProductSchema = z
  .object({
    title: z.string().min(3).max(160).optional(),
    description: z.string().min(10).max(3000).optional(),
    basePricePaisa: z.number().int().min(100).optional(),
    compareAtPricePaisa: z.number().int().min(100).nullable().optional(),
    submitForApproval: z.boolean().optional(),
  })
  .strict();

const AdjustInventorySchema = z
  .object({
    deltaQty: z.number().int().min(-1000).max(1000),
    reason: z.string().min(3).max(240),
  })
  .strict();

const UpdateVendorOrderStatusSchema = z
  .object({
    status: z.enum(['PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED']),
    deliveryPartnerName: z.string().min(2).max(100).optional(),
    deliveryPartnerPhone: z.string().min(7).max(25).optional(),
    locationText: z.string().max(160).optional(),
    note: z.string().max(300).optional(),
  })
  .strict();

@Controller('api/v1/vendor')
export class VendorController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Post('apply')
  async applyAsVendor(@Body() body: unknown, @Req() req: any) {
    const auth: AuthContext = req.auth;
    const dto = VendorApplySchema.parse(body);

    const slugExists = await this.db.query('SELECT id FROM vendors WHERE slug = $1', [dto.slug]);
    if (slugExists.rows.length > 0) {
      throw new AppDomainError(
        'DUPLICATE_VENDOR_SLUG',
        'A vendor storefront with this handle already exists.',
        HttpStatus.CONFLICT,
      );
    }

    const vendorId = `vendor-${crypto.randomUUID()}`;

    await this.db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO vendors (
          id, slug, business_name, description, pan_vat_number,
          contact_email, contact_phone, ward_number, address_text,
          approval_status, payout_method, payout_account_ref
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'PENDING_VERIFICATION',$10,$11)`,
        [
          vendorId,
          dto.slug,
          sanitizeText(dto.businessName),
          sanitizeText(dto.description),
          sanitizeText(dto.panVatNumber),
          dto.contactEmail.toLowerCase(),
          sanitizeText(dto.contactPhone),
          dto.wardNumber,
          sanitizeText(dto.addressText),
          dto.payoutMethod,
          sanitizeText(dto.payoutAccountRef),
        ],
      );

      await tx.query(
        `INSERT INTO vendor_memberships (id, user_id, vendor_id, role, status)
         VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')`,
        [`vm-${crypto.randomUUID()}`, auth.userId, vendorId],
      );

      await tx.query(
        `INSERT INTO user_role_assignments (id, user_id, role_id)
         VALUES ($1, $2, 'role-vendor-owner')
         ON CONFLICT (user_id, role_id) DO NOTHING`,
        [`ura-${crypto.randomUUID()}`, auth.userId],
      );

      await tx.query(
        `INSERT INTO vendor_verifications (id, vendor_id, document_type, private_object_key, status)
         VALUES ($1, $2, 'PAN_VAT_CERT', $3, 'PENDING')`,
        [`vv-${crypto.randomUUID()}`, vendorId, dto.kycDocumentKey],
      );

      await this.audit.log(
        {
          actorId: auth.userId,
          actorRole: 'VENDOR_OWNER',
          vendorId,
          action: 'VENDOR_APPLIED',
          targetType: 'VENDOR',
          targetId: vendorId,
          reason: 'Vendor onboarding application submitted',
        },
        tx,
      );
    });

    const created = await this.db.query('SELECT * FROM vendors WHERE id = $1', [vendorId]);
    return { vendor: created.rows[0] };
  }

  @RequireVendor()
  @Get('dashboard')
  async getVendorDashboard(@Req() req: any) {
    const auth: AuthContext = req.auth;
    const vendorId = auth.vendorId!;

    const vendorRes = await this.db.query('SELECT * FROM vendors WHERE id = $1', [vendorId]);
    const statsRes = await this.db.query<{
      total_orders: string;
      total_sales_paisa: string;
      net_earnings_paisa: string;
    }>(
      `SELECT
         COUNT(*)::text AS total_orders,
         COALESCE(SUM(CASE WHEN status <> 'CANCELLED' THEN total_paisa ELSE 0 END), 0)::text AS total_sales_paisa,
         COALESCE(SUM(CASE WHEN status = 'DELIVERED' THEN net_vendor_paisa ELSE 0 END), 0)::text AS net_earnings_paisa
       FROM vendor_orders
       WHERE vendor_id = $1`,
      [vendorId],
    );

    const prodCountRes = await this.db.query<{
      total: string;
      active: string;
      pending: string;
      draft: string;
    }>(
      `SELECT
         COUNT(*)::text AS total,
         COUNT(*) FILTER (WHERE moderation_status = 'ACTIVE')::text AS active,
         COUNT(*) FILTER (WHERE moderation_status = 'PENDING_APPROVAL')::text AS pending,
         COUNT(*) FILTER (WHERE moderation_status = 'DRAFT')::text AS draft
       FROM products
       WHERE vendor_id = $1`,
      [vendorId],
    );

    const recentOrdersRes = await this.db.query(
      `SELECT
         vo.id,
         vo.vendor_order_number,
         vo.order_id,
         vo.status,
         vo.total_paisa,
         vo.net_vendor_paisa,
         vo.created_at,
         o.order_number,
         o.shipping_name,
         o.shipping_ward,
         (SELECT COUNT(*)::int FROM order_items oi WHERE oi.vendor_order_id = vo.id) AS item_count,
         (SELECT oi.image_url_snapshot FROM order_items oi WHERE oi.vendor_order_id = vo.id LIMIT 1) AS preview_image
       FROM vendor_orders vo
       JOIN orders o ON o.id = vo.order_id
       WHERE vo.vendor_id = $1
       ORDER BY vo.created_at DESC
       LIMIT 10`,
      [vendorId],
    );

    const lowStockRes = await this.db.query(
      `SELECT
         ii.id,
         ii.available_qty,
         ii.low_stock_threshold,
         pv.id AS variant_id,
         pv.sku,
         pv.title AS variant_title,
         p.title AS product_title
       FROM inventory_items ii
       JOIN product_variants pv ON pv.id = ii.variant_id
       JOIN products p ON p.id = pv.product_id
       WHERE ii.vendor_id = $1 AND ii.available_qty <= ii.low_stock_threshold
       ORDER BY ii.available_qty ASC`,
      [vendorId],
    );

    const vendor = vendorRes.rows[0];
    return {
      vendor,
      kpis: {
        totalOrders: Number(statsRes.rows[0]?.total_orders ?? 0),
        totalSalesPaisa: Number(statsRes.rows[0]?.total_sales_paisa ?? 0),
        netEarningsPaisa: Number(statsRes.rows[0]?.net_earnings_paisa ?? 0),
        totalProducts: Number(prodCountRes.rows[0]?.total ?? 0),
        activeProducts: Number(prodCountRes.rows[0]?.active ?? 0),
        pendingProducts: Number(prodCountRes.rows[0]?.pending ?? 0),
        ratingAvg: Number(vendor?.rating_avg ?? 4.8),
      },
      recentOrders: recentOrdersRes.rows,
      lowStockItems: lowStockRes.rows,
    };
  }

  @RequireVendor()
  @Get('products')
  async listVendorProducts(@Query('status') status: string | undefined, @Req() req: any) {
    const auth: AuthContext = req.auth;
    const vendorId = auth.vendorId!;

    const params: any[] = [vendorId];
    let statusClause = '';
    if (status && status !== 'ALL') {
      params.push(status);
      statusClause = `AND p.moderation_status = $2`;
    }

    const res = await this.db.query(
      `SELECT
         p.*,
         c.name AS category_name,
         (SELECT pm.url FROM product_media pm WHERE pm.product_id = p.id ORDER BY pm.sort_order ASC LIMIT 1) AS image_url,
         COALESCE((
           SELECT SUM(ii.available_qty)::int
           FROM product_variants pv
           JOIN inventory_items ii ON ii.variant_id = pv.id
           WHERE pv.product_id = p.id
         ), 0) AS total_stock
       FROM products p
       JOIN categories c ON c.id = p.category_id
       WHERE p.vendor_id = $1 ${statusClause}
       ORDER BY p.updated_at DESC`,
      params,
    );

    return { items: res.rows };
  }

  @RequireVendor()
  @Get('products/:id')
  async getVendorProduct(@Param('id') id: string, @Req() req: any) {
    const auth: AuthContext = req.auth;
    // STRICT TENANT ISOLATION: Vendor A cannot read Vendor B's product (Journey #11)
    const prodRes = await this.db.query(
      'SELECT * FROM products WHERE id = $1 AND vendor_id = $2',
      [id, auth.vendorId!],
    );

    if (prodRes.rows.length === 0) {
      throw new AppDomainError(
        'PRODUCT_NOT_FOUND',
        'Product not found within your vendor account.',
        HttpStatus.NOT_FOUND,
      );
    }

    const variantsRes = await this.db.query(
      `SELECT pv.*, ii.available_qty, ii.reserved_qty
       FROM product_variants pv
       LEFT JOIN inventory_items ii ON ii.variant_id = pv.id
       WHERE pv.product_id = $1`,
      [id],
    );

    return {
      product: prodRes.rows[0],
      variants: variantsRes.rows,
    };
  }

  @RequireVendor()
  @Post('products')
  async createVendorProduct(@Body() body: unknown, @Req() req: any) {
    const auth: AuthContext = req.auth;
    const vendorId = auth.vendorId!;
    const dto = CreateProductSchema.parse(body);

    const dupSlug = await this.db.query('SELECT id FROM products WHERE slug = $1', [dto.slug]);
    if (dupSlug.rows.length > 0) {
      throw new AppDomainError(
        'DUPLICATE_PRODUCT_SLUG',
        'A product with this handle already exists.',
        HttpStatus.CONFLICT,
      );
    }

    for (const v of dto.variants) {
      const dupSku = await this.db.query('SELECT id FROM product_variants WHERE sku = $1', [v.sku]);
      if (dupSku.rows.length > 0) {
        throw new AppDomainError(
          'DUPLICATE_SKU',
          `SKU '${v.sku}' is already in use.`,
          HttpStatus.CONFLICT,
        );
      }
    }

    const productId = `prod-${crypto.randomUUID()}`;
    const initialModerationStatus = dto.saveAsDraft ? 'DRAFT' : 'PENDING_APPROVAL';

    await this.db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO products (
          id, vendor_id, category_id, brand_id, slug, title, subtitle, description,
          specifications_json, moderation_status, base_price_paisa, compare_at_price_paisa, is_new
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,TRUE)`,
        [
          productId,
          vendorId,
          dto.categoryId,
          dto.brandId ?? null,
          dto.slug,
          sanitizeText(dto.title),
          sanitizeText(dto.subtitle),
          sanitizeText(dto.description),
          JSON.stringify(dto.specifications),
          initialModerationStatus,
          dto.basePricePaisa,
          dto.compareAtPricePaisa ?? null,
        ],
      );

      for (let i = 0; i < dto.imageUrls.length; i++) {
        await tx.query(
          `INSERT INTO product_media (id, product_id, url, object_key, alt_text, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            `media-${crypto.randomUUID()}`,
            productId,
            dto.imageUrls[i],
            `public/products/${dto.slug}-${i}.jpg`,
            sanitizeText(dto.title),
            i,
          ],
        );
      }

      for (const v of dto.variants) {
        const variantId = `var-${crypto.randomUUID()}`;
        await tx.query(
          `INSERT INTO product_variants (
            id, product_id, sku, title, size_value, color_name, color_hex, price_paisa, compare_at_price_paisa
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            variantId,
            productId,
            v.sku,
            sanitizeText(v.title),
            sanitizeText(v.sizeValue),
            sanitizeText(v.colorName),
            v.colorHex,
            v.pricePaisa,
            dto.compareAtPricePaisa ?? null,
          ],
        );

        await tx.query(
          `INSERT INTO inventory_items (id, variant_id, vendor_id, available_qty, reserved_qty)
           VALUES ($1, $2, $3, $4, 0)`,
          [`inv-${crypto.randomUUID()}`, variantId, vendorId, v.initialStock],
        );
      }

      await tx.query(
        `INSERT INTO product_moderation_events (id, product_id, actor_id, from_status, to_status, reason)
         VALUES ($1, $2, $3, 'NONE', $4, 'Initial vendor creation')`,
        [`pme-${crypto.randomUUID()}`, productId, auth.userId, initialModerationStatus],
      );
    });

    const created = await this.db.query(
      'SELECT * FROM products WHERE id = $1 AND vendor_id = $2',
      [productId, vendorId],
    );
    return { product: created.rows[0] };
  }

  @RequireVendor()
  @Patch('products/:id')
  async updateVendorProduct(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const auth: AuthContext = req.auth;
    const vendorId = auth.vendorId!;
    const dto = UpdateProductSchema.parse(body);

    const existingRes = await this.db.query(
      'SELECT * FROM products WHERE id = $1 AND vendor_id = $2',
      [id, vendorId],
    );

    if (existingRes.rows.length === 0) {
      throw new AppDomainError(
        'PRODUCT_NOT_FOUND',
        'Product not found within your vendor account.',
        HttpStatus.NOT_FOUND,
      );
    }

    const existing = existingRes.rows[0];
    let nextModerationStatus = existing.moderation_status;
    // Content edits on an ACTIVE product require re-review (BD-08)
    if (
      (dto.title && dto.title !== existing.title) ||
      (dto.description && dto.description !== existing.description) ||
      dto.submitForApproval
    ) {
      nextModerationStatus = 'PENDING_APPROVAL';
    }

    await this.db.transaction(async (tx) => {
      await tx.query(
        `UPDATE products
         SET title = COALESCE($1, title),
             description = COALESCE($2, description),
             base_price_paisa = COALESCE($3, base_price_paisa),
             moderation_status = $4,
             updated_at = NOW()
         WHERE id = $5 AND vendor_id = $6`,
        [
          dto.title ? sanitizeText(dto.title) : null,
          dto.description ? sanitizeText(dto.description) : null,
          dto.basePricePaisa ?? null,
          nextModerationStatus,
          id,
          vendorId,
        ],
      );

      if (nextModerationStatus !== existing.moderation_status) {
        await tx.query(
          `INSERT INTO product_moderation_events (id, product_id, actor_id, from_status, to_status, reason)
           VALUES ($1, $2, $3, $4, $5, 'Vendor content update triggered re-moderation')`,
          [
            `pme-${crypto.randomUUID()}`,
            id,
            auth.userId,
            existing.moderation_status,
            nextModerationStatus,
          ],
        );
      }
    });

    const updated = await this.db.query(
      'SELECT * FROM products WHERE id = $1 AND vendor_id = $2',
      [id, vendorId],
    );
    return { product: updated.rows[0] };
  }

  @RequireVendor()
  @Post('inventory/:variantId/adjust')
  @HttpCode(HttpStatus.OK)
  async adjustInventory(
    @Param('variantId') variantId: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const auth: AuthContext = req.auth;
    const vendorId = auth.vendorId!;
    const dto = AdjustInventorySchema.parse(body);

    return this.db.transaction(async (tx) => {
      const invRes = await tx.query<{ id: string; available_qty: number }>(
        'SELECT id, available_qty FROM inventory_items WHERE variant_id = $1 AND vendor_id = $2',
        [variantId, vendorId],
      );

      if (invRes.rows.length === 0) {
        throw new AppDomainError(
          'INVENTORY_NOT_FOUND',
          'Inventory item not found for this vendor.',
          HttpStatus.NOT_FOUND,
        );
      }

      const currentQty = Number(invRes.rows[0].available_qty);
      const newQty = currentQty + dto.deltaQty;
      if (newQty < 0) {
        throw new AppDomainError(
          'NEGATIVE_STOCK_NOT_ALLOWED',
          'Adjustment would result in negative inventory.',
          HttpStatus.BAD_REQUEST,
        );
      }

      await tx.query(
        'UPDATE inventory_items SET available_qty = $1, updated_at = NOW() WHERE id = $2',
        [newQty, invRes.rows[0].id],
      );

      await tx.query(
        `INSERT INTO inventory_adjustments (id, inventory_item_id, actor_id, delta_qty, previous_qty, new_qty, reason)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          `iadj-${crypto.randomUUID()}`,
          invRes.rows[0].id,
          auth.userId,
          dto.deltaQty,
          currentQty,
          newQty,
          sanitizeText(dto.reason),
        ],
      );

      return {
        variantId,
        previousQty: currentQty,
        newQty,
      };
    });
  }

  @RequireVendor()
  @Get('orders')
  async listVendorOrders(@Query('status') status: string | undefined, @Req() req: any) {
    const auth: AuthContext = req.auth;
    const vendorId = auth.vendorId!;

    const params: any[] = [vendorId];
    let statusFilter = '';
    if (status && status !== 'ALL') {
      params.push(status);
      statusFilter = 'AND vo.status = $2';
    }

    const ordersRes = await this.db.query(
      `SELECT
         vo.*,
         o.order_number,
         o.payment_method,
         o.payment_status,
         o.shipping_name,
         o.shipping_phone,
         o.shipping_ward,
         o.shipping_address,
         o.shipping_landmark,
         o.delivery_instructions,
         s.tracking_number,
         s.delivery_partner_name,
         s.delivery_partner_phone,
         s.status AS shipment_status
       FROM vendor_orders vo
       JOIN orders o ON o.id = vo.order_id
       LEFT JOIN shipments s ON s.vendor_order_id = vo.id
       WHERE vo.vendor_id = $1 ${statusFilter}
       ORDER BY vo.created_at DESC`,
      params,
    );

    const itemsRes = await this.db.query(
      `SELECT * FROM order_items WHERE vendor_id = $1 ORDER BY created_at ASC`,
      [vendorId],
    );

    const itemsByVo = new Map<string, any[]>();
    for (const item of itemsRes.rows) {
      const list = itemsByVo.get(item.vendor_order_id) ?? [];
      list.push(item);
      itemsByVo.set(item.vendor_order_id, list);
    }

    return {
      items: ordersRes.rows.map((vo) => ({
        ...vo,
        items: itemsByVo.get(vo.id) ?? [],
      })),
    };
  }

  @RequireVendor()
  @Get('orders/:id')
  async getVendorOrderDetail(@Param('id') id: string, @Req() req: any) {
    const auth: AuthContext = req.auth;
    // STRICT TENANT ISOLATION: Vendor A cannot read Vendor B's order (Journey #11)
    const voRes = await this.db.query(
      `SELECT
         vo.*,
         o.order_number,
         o.payment_method,
         o.payment_status,
         o.shipping_name,
         o.shipping_phone,
         o.shipping_ward,
         o.shipping_address,
         o.shipping_landmark,
         o.delivery_instructions
       FROM vendor_orders vo
       JOIN orders o ON o.id = vo.order_id
       WHERE (vo.id = $1 OR vo.vendor_order_number = $1)
         AND vo.vendor_id = $2`,
      [id, auth.vendorId!],
    );

    if (voRes.rows.length === 0) {
      throw new AppDomainError(
        'VENDOR_ORDER_NOT_FOUND',
        'Vendor order not found within your store.',
        HttpStatus.NOT_FOUND,
      );
    }

    const vo = voRes.rows[0];
    const itemsRes = await this.db.query(
      'SELECT * FROM order_items WHERE vendor_order_id = $1 AND vendor_id = $2',
      [vo.id, auth.vendorId!],
    );
    const shipmentRes = await this.db.query(
      'SELECT * FROM shipments WHERE vendor_order_id = $1',
      [vo.id],
    );

    return {
      vendorOrder: vo,
      items: itemsRes.rows,
      shipment: shipmentRes.rows[0] ?? null,
    };
  }

  @RequireVendor()
  @Patch('orders/:id/status')
  async updateVendorOrderStatus(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const auth: AuthContext = req.auth;
    const vendorId = auth.vendorId!;
    const dto = UpdateVendorOrderStatusSchema.parse(body);

    return this.db.transaction(async (tx) => {
      const voRes = await tx.query(
        'SELECT * FROM vendor_orders WHERE id = $1 AND vendor_id = $2',
        [id, vendorId],
      );

      if (voRes.rows.length === 0) {
        throw new AppDomainError(
          'VENDOR_ORDER_NOT_FOUND',
          'Vendor order not found within your store.',
          HttpStatus.NOT_FOUND,
        );
      }

      const vo = voRes.rows[0];
      await tx.query(
        `UPDATE vendor_orders
         SET status = $1,
             delivered_at = CASE WHEN $1 = 'DELIVERED' THEN NOW() ELSE delivered_at END,
             updated_at = NOW()
         WHERE id = $2 AND vendor_id = $3`,
        [dto.status, vo.id, vendorId],
      );

      // Update parent order status if single-vendor or all vendor_orders match
      await tx.query(
        `UPDATE orders
         SET status = $1,
             payment_status = CASE WHEN $1 = 'DELIVERED' AND payment_method = 'COD' THEN 'PAID' ELSE payment_status END,
             updated_at = NOW()
         WHERE id = $2`,
        [dto.status, vo.order_id],
      );

      // Update Shipment & Tracking Timeline (Journey #13)
      const shipRes = await tx.query<{ id: string }>(
        'SELECT id FROM shipments WHERE vendor_order_id = $1',
        [vo.id],
      );

      if (shipRes.rows.length > 0) {
        const shipmentId = shipRes.rows[0].id;
        const shipStatus =
          dto.status === 'DELIVERED'
            ? 'DELIVERED'
            : dto.status === 'OUT_FOR_DELIVERY'
              ? 'OUT_FOR_DELIVERY'
              : 'PREPARING';

        await tx.query(
          `UPDATE shipments
           SET status = $1,
               delivery_partner_name = COALESCE($2, delivery_partner_name),
               delivery_partner_phone = COALESCE($3, delivery_partner_phone),
               dispatched_at = CASE WHEN $1 = 'OUT_FOR_DELIVERY' THEN NOW() ELSE dispatched_at END,
               delivered_at = CASE WHEN $1 = 'DELIVERED' THEN NOW() ELSE delivered_at END,
               updated_at = NOW()
           WHERE id = $4`,
          [
            shipStatus,
            dto.deliveryPartnerName ? sanitizeText(dto.deliveryPartnerName) : null,
            dto.deliveryPartnerPhone ? sanitizeText(dto.deliveryPartnerPhone) : null,
            shipmentId,
          ],
        );

        const titleMap: Record<string, string> = {
          PROCESSING: 'Preparing Your Order',
          OUT_FOR_DELIVERY: 'Out for Delivery',
          DELIVERED: 'Delivered',
          CANCELLED: 'Order Cancelled',
        };
        const descMap: Record<string, string> = {
          PROCESSING: 'Vendor is packing and quality-checking your items.',
          OUT_FOR_DELIVERY: 'Your order is on the way in Birgunj!',
          DELIVERED: 'Package delivered to recipient.',
          CANCELLED: 'Order was cancelled.',
        };

        await tx.query(
          `INSERT INTO tracking_events (id, shipment_id, status, title, description, location_text)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            `te-${crypto.randomUUID()}`,
            shipmentId,
            dto.status,
            titleMap[dto.status] || dto.status,
            dto.note ? sanitizeText(dto.note) : descMap[dto.status] || '',
            dto.locationText ? sanitizeText(dto.locationText) : 'Birgunj Metropolitan Area',
          ],
        );
      }

      // If DELIVERED, append immutable vendor ledger entries if not already recorded
      if (dto.status === 'DELIVERED') {
        const existingLedger = await tx.query(
          'SELECT id FROM vendor_ledger_entries WHERE vendor_order_id = $1',
          [vo.id],
        );
        if (existingLedger.rows.length === 0) {
          const balRes = await tx.query<{ balance_after_paisa: number }>(
            'SELECT balance_after_paisa FROM vendor_ledger_entries WHERE vendor_id = $1 ORDER BY created_at DESC LIMIT 1',
            [vendorId],
          );
          const prevBal = Number(balRes.rows[0]?.balance_after_paisa ?? 0);
          const gross = Number(vo.subtotal_paisa);
          const comm = Number(vo.commission_paisa);

          await tx.query(
            `INSERT INTO vendor_ledger_entries (id, vendor_id, vendor_order_id, entry_type, amount_paisa, balance_after_paisa, description)
             VALUES
             ($1, $2, $3, 'CREDIT_SALE', $4, $5, $6),
             ($7, $2, $3, 'DEBIT_COMMISSION', $8, $9, $10)`,
            [
              `vle-${crypto.randomUUID()}`,
              vendorId,
              vo.id,
              gross,
              prevBal + gross,
              `Gross sale for ${vo.vendor_order_number}`,
              `vle-${crypto.randomUUID()}`,
              -comm,
              prevBal + gross - comm,
              `Platform commission for ${vo.vendor_order_number}`,
            ],
          );
        }
      }

      const updated = await tx.query('SELECT * FROM vendor_orders WHERE id = $1', [vo.id]);
      return { vendorOrder: updated.rows[0] };
    });
  }

  @RequireVendor()
  @Get('finance')
  async getVendorFinance(@Req() req: any) {
    const auth: AuthContext = req.auth;
    const vendorId = auth.vendorId!;

    const ledgerRes = await this.db.query(
      'SELECT * FROM vendor_ledger_entries WHERE vendor_id = $1 ORDER BY created_at DESC',
      [vendorId],
    );
    const payoutsRes = await this.db.query(
      'SELECT * FROM vendor_payouts WHERE vendor_id = $1 ORDER BY created_at DESC',
      [vendorId],
    );
    const balancePaisa = Number(ledgerRes.rows[0]?.balance_after_paisa ?? 0);

    return {
      balancePaisa,
      currency: 'NPR',
      ledgerEntries: ledgerRes.rows,
      payouts: payoutsRes.rows,
    };
  }

  @RequireVendor()
  @RequireStepUp()
  @Patch('payout-destination')
  async updatePayoutDestination(@Body() body: unknown, @Req() req: any) {
    const auth: AuthContext = req.auth;
    const vendorId = auth.vendorId!;
    const dto = z
      .object({
        payoutMethod: z.enum(['ESEWA', 'KHALTI', 'BANK_TRANSFER']),
        payoutAccountRef: z.string().min(4).max(80),
      })
      .strict()
      .parse(body);

    await this.db.transaction(async (tx) => {
      await tx.query(
        `UPDATE vendors
         SET payout_method = $1, payout_account_ref = $2, updated_at = NOW()
         WHERE id = $3`,
        [dto.payoutMethod, sanitizeText(dto.payoutAccountRef), vendorId],
      );

      await this.audit.log(
        {
          actorId: auth.userId,
          actorRole: auth.vendorRole || 'VENDOR_OWNER',
          vendorId,
          action: 'PAYOUT_DESTINATION_UPDATED',
          targetType: 'VENDOR',
          targetId: vendorId,
          reason: 'Step-up verified payout destination update',
          metadata: { payoutMethod: dto.payoutMethod },
        },
        tx,
      );
    });

    return { updated: true, payoutMethod: dto.payoutMethod };
  }
}
