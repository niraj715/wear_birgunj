import crypto from 'node:crypto';
import {
  Body,
  Controller,
  Get,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Query,
  Req,
} from '@nestjs/common';
import { z } from 'zod';
import { DatabaseService } from '../../db/database.service.js';
import { AuditService } from '../../common/audit.service.js';
import { AppDomainError } from '../../common/api-error.filter.js';
import { AuthContext, Roles } from '../../common/auth.guard.js';
import { sanitizeText } from '../../common/crypto.util.js';

const ModerateVendorSchema = z
  .object({
    status: z.enum(['APPROVED', 'REJECTED', 'SUSPENDED']),
    reason: z.string().min(3).max(500),
  })
  .strict();

const ModerateProductSchema = z
  .object({
    status: z.enum(['ACTIVE', 'REJECTED', 'SUSPENDED', 'PENDING_APPROVAL']),
    reason: z.string().min(3).max(500),
  })
  .strict();

const ResolveReturnSchema = z
  .object({
    status: z.enum(['APPROVED', 'REJECTED', 'COMPLETED']),
    resolutionNotes: z.string().min(3).max(500),
  })
  .strict();

@Controller('api/v1/admin')
export class AdminController {
  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  @Roles('PLATFORM_ADMIN', 'SUPER_ADMIN', 'CATALOG_MODERATOR', 'FINANCE_OPERATOR')
  @Get('dashboard')
  async getAdminDashboard() {
    const orderStats = await this.db.query<{
      total_orders: string;
      total_sales_paisa: string;
    }>(
      `SELECT
         COUNT(*)::text AS total_orders,
         COALESCE(SUM(CASE WHEN status <> 'CANCELLED' THEN total_paisa ELSE 0 END), 0)::text AS total_sales_paisa
       FROM orders`,
    );

    const vendorStats = await this.db.query<{
      total_vendors: string;
      approved_vendors: string;
      pending_vendors: string;
    }>(
      `SELECT
         COUNT(*)::text AS total_vendors,
         COUNT(*) FILTER (WHERE approval_status = 'APPROVED')::text AS approved_vendors,
         COUNT(*) FILTER (WHERE approval_status = 'PENDING_VERIFICATION')::text AS pending_vendors
       FROM vendors`,
    );

    const customerStats = await this.db.query<{ total_customers: string }>(
      `SELECT COUNT(*)::text AS total_customers FROM users WHERE status = 'ACTIVE'`,
    );

    const productStats = await this.db.query<{
      pending_products: string;
      active_products: string;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE moderation_status = 'PENDING_APPROVAL')::text AS pending_products,
         COUNT(*) FILTER (WHERE moderation_status = 'ACTIVE')::text AS active_products
       FROM products`,
    );

    const recentOrders = await this.db.query(
      `SELECT
         o.id,
         o.order_number,
         o.status,
         o.payment_method,
         o.payment_status,
         o.total_paisa,
         o.shipping_name,
         o.shipping_ward,
         o.created_at,
         (SELECT COUNT(*)::int FROM order_items oi WHERE oi.order_id = o.id) AS item_count
       FROM orders o
       ORDER BY o.created_at DESC
       LIMIT 10`,
    );

    return {
      kpis: {
        totalOrders: Number(orderStats.rows[0]?.total_orders ?? 0),
        totalSalesPaisa: Number(orderStats.rows[0]?.total_sales_paisa ?? 0),
        totalVendors: Number(vendorStats.rows[0]?.total_vendors ?? 0),
        approvedVendors: Number(vendorStats.rows[0]?.approved_vendors ?? 0),
        pendingVendors: Number(vendorStats.rows[0]?.pending_vendors ?? 0),
        totalCustomers: Number(customerStats.rows[0]?.total_customers ?? 0),
        pendingProducts: Number(productStats.rows[0]?.pending_products ?? 0),
        activeProducts: Number(productStats.rows[0]?.active_products ?? 0),
      },
      recentOrders: recentOrders.rows,
    };
  }

  @Roles('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @Get('vendors')
  async listVendors(@Query('status') status?: string) {
    const params: any[] = [];
    let where = '';
    if (status && status !== 'ALL') {
      params.push(status);
      where = 'WHERE v.approval_status = $1';
    }
    const res = await this.db.query(
      `SELECT
         v.*,
         (SELECT COUNT(*)::int FROM products p WHERE p.vendor_id = v.id) AS product_count
       FROM vendors v
       ${where}
       ORDER BY v.created_at DESC`,
      params,
    );
    return { items: res.rows };
  }

  @Roles('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @Patch('vendors/:id/moderate')
  async moderateVendor(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const auth: AuthContext = req.auth;
    const dto = ModerateVendorSchema.parse(body);

    const existing = await this.db.query('SELECT * FROM vendors WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      throw new AppDomainError('VENDOR_NOT_FOUND', 'Vendor not found.', HttpStatus.NOT_FOUND);
    }

    await this.db.transaction(async (tx) => {
      await tx.query(
        `UPDATE vendors
         SET approval_status = $1,
             rejection_reason = CASE WHEN $1 = 'REJECTED' THEN $2 ELSE NULL END,
             updated_at = NOW()
         WHERE id = $3`,
        [dto.status, sanitizeText(dto.reason), id],
      );

      await tx.query(
        `UPDATE vendor_verifications
         SET status = $1, reviewed_by = $2, review_notes = $3, reviewed_at = NOW()
         WHERE vendor_id = $4`,
        [
          dto.status === 'APPROVED' ? 'VERIFIED' : 'REJECTED',
          auth.userId,
          sanitizeText(dto.reason),
          id,
        ],
      );

      await this.audit.log(
        {
          actorId: auth.userId,
          actorRole: auth.roles[0] || 'PLATFORM_ADMIN',
          vendorId: id,
          action: `VENDOR_${dto.status}`,
          targetType: 'VENDOR',
          targetId: id,
          reason: sanitizeText(dto.reason),
        },
        tx,
      );
    });

    const updated = await this.db.query('SELECT * FROM vendors WHERE id = $1', [id]);
    return { vendor: updated.rows[0] };
  }

  @Roles('CATALOG_MODERATOR', 'PLATFORM_ADMIN', 'SUPER_ADMIN')
  @Get('products')
  async listModerationProducts(@Query('status') status?: string) {
    const params: any[] = [];
    let where = '';
    if (status && status !== 'ALL') {
      params.push(status);
      where = 'WHERE p.moderation_status = $1';
    }

    const res = await this.db.query(
      `SELECT
         p.*,
         v.business_name AS vendor_name,
         v.approval_status AS vendor_approval_status,
         c.name AS category_name,
         (SELECT pm.url FROM product_media pm WHERE pm.product_id = p.id ORDER BY pm.sort_order ASC LIMIT 1) AS image_url
       FROM products p
       JOIN vendors v ON v.id = p.vendor_id
       JOIN categories c ON c.id = p.category_id
       ${where}
       ORDER BY p.updated_at DESC`,
      params,
    );
    return { items: res.rows };
  }

  @Roles('CATALOG_MODERATOR', 'PLATFORM_ADMIN', 'SUPER_ADMIN')
  @Patch('products/:id/moderate')
  async moderateProduct(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const auth: AuthContext = req.auth;
    const dto = ModerateProductSchema.parse(body);

    const existingRes = await this.db.query('SELECT * FROM products WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      throw new AppDomainError('PRODUCT_NOT_FOUND', 'Product not found.', HttpStatus.NOT_FOUND);
    }
    const existing = existingRes.rows[0];

    await this.db.transaction(async (tx) => {
      await tx.query(
        `UPDATE products
         SET moderation_status = $1,
             rejection_reason = CASE WHEN $1 IN ('REJECTED', 'SUSPENDED') THEN $2 ELSE NULL END,
             updated_at = NOW()
         WHERE id = $3`,
        [dto.status, sanitizeText(dto.reason), id],
      );

      await tx.query(
        `INSERT INTO product_moderation_events (id, product_id, actor_id, from_status, to_status, reason)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [
          `pme-${crypto.randomUUID()}`,
          id,
          auth.userId,
          existing.moderation_status,
          dto.status,
          sanitizeText(dto.reason),
        ],
      );

      await this.audit.log(
        {
          actorId: auth.userId,
          actorRole: auth.roles[0] || 'CATALOG_MODERATOR',
          vendorId: existing.vendor_id,
          action: `PRODUCT_MODERATED_${dto.status}`,
          targetType: 'PRODUCT',
          targetId: id,
          reason: sanitizeText(dto.reason),
        },
        tx,
      );
    });

    const updated = await this.db.query('SELECT * FROM products WHERE id = $1', [id]);
    return { product: updated.rows[0] };
  }

  @Roles('PLATFORM_ADMIN', 'SUPER_ADMIN', 'FINANCE_OPERATOR', 'SUPPORT_AGENT')
  @Get('orders')
  async listAllOrders() {
    const res = await this.db.query(
      `SELECT
         o.*,
         u.email AS customer_email,
         (SELECT COUNT(*)::int FROM order_items oi WHERE oi.order_id = o.id) AS item_count
       FROM orders o
       JOIN users u ON u.id = o.customer_id
       ORDER BY o.created_at DESC`,
    );
    return { items: res.rows };
  }

  @Roles('PLATFORM_ADMIN', 'SUPER_ADMIN', 'FINANCE_OPERATOR')
  @Get('returns')
  async listReturnRequests() {
    const res = await this.db.query(
      `SELECT
         rr.*,
         o.order_number,
         oi.product_title_snapshot,
         oi.variant_title_snapshot,
         v.business_name AS vendor_name,
         u.full_name AS customer_name
       FROM return_requests rr
       JOIN orders o ON o.id = rr.order_id
       JOIN order_items oi ON oi.id = rr.order_item_id
       JOIN vendors v ON v.id = rr.vendor_id
       JOIN users u ON u.id = rr.customer_id
       ORDER BY rr.requested_at DESC`,
    );
    return { items: res.rows };
  }

  @Roles('PLATFORM_ADMIN', 'SUPER_ADMIN', 'FINANCE_OPERATOR')
  @Patch('returns/:id/resolve')
  async resolveReturnRequest(
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: any,
  ) {
    const auth: AuthContext = req.auth;
    const dto = ResolveReturnSchema.parse(body);

    return this.db.transaction(async (tx) => {
      const rrRes = await tx.query('SELECT * FROM return_requests WHERE id = $1', [id]);
      if (rrRes.rows.length === 0) {
        throw new AppDomainError('RETURN_NOT_FOUND', 'Return request not found.', HttpStatus.NOT_FOUND);
      }
      const rr = rrRes.rows[0];

      await tx.query(
        `UPDATE return_requests
         SET status = $1, resolution_notes = $2, resolved_at = NOW()
         WHERE id = $3`,
        [dto.status, sanitizeText(dto.resolutionNotes), id],
      );

      if (dto.status === 'APPROVED' || dto.status === 'COMPLETED') {
        const payRes = await tx.query<{ id: string }>(
          'SELECT id FROM payments WHERE order_id = $1 LIMIT 1',
          [rr.order_id],
        );
        if (payRes.rows.length > 0) {
          await tx.query(
            `INSERT INTO refunds (id, payment_id, order_id, vendor_order_id, return_request_id, amount_paisa, reason, status, processed_by)
             VALUES ($1,$2,$3,$4,$5,$6,$7,'COMPLETED',$8)`,
            [
              `ref-${crypto.randomUUID()}`,
              payRes.rows[0].id,
              rr.order_id,
              rr.vendor_order_id,
              rr.id,
              rr.refund_amount_paisa,
              sanitizeText(dto.resolutionNotes),
              auth.userId,
            ],
          );
        }
      }

      await this.audit.log(
        {
          actorId: auth.userId,
          actorRole: auth.roles[0] || 'FINANCE_OPERATOR',
          vendorId: rr.vendor_id,
          action: `RETURN_${dto.status}`,
          targetType: 'RETURN_REQUEST',
          targetId: id,
          reason: sanitizeText(dto.resolutionNotes),
          metadata: { refundAmountPaisa: rr.refund_amount_paisa },
        },
        tx,
      );

      const updated = await tx.query('SELECT * FROM return_requests WHERE id = $1', [id]);
      return { returnRequest: updated.rows[0] };
    });
  }

  @Roles('PLATFORM_ADMIN', 'SUPER_ADMIN')
  @Get('audit-logs')
  async listAuditLogs() {
    const res = await this.db.query(
      'SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 100',
    );
    return { items: res.rows };
  }
}
