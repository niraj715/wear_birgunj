import {
  Controller,
  Get,
  HttpStatus,
  Inject,
  Param,
  Query,
} from '@nestjs/common';
import { DatabaseService } from '../../db/database.service.js';
import { AppDomainError } from '../../common/api-error.filter.js';
import { Public } from '../../common/auth.guard.js';

@Controller('api/v1/catalog')
export class CatalogController {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  @Public()
  @Get('home')
  async getHomeData() {
    const categories = await this.db.query(
      'SELECT id, slug, name, description, image_url FROM categories WHERE is_active = TRUE ORDER BY sort_order ASC',
    );

    const brands = await this.db.query(
      'SELECT id, slug, name, logo_url, is_local_brand FROM brands ORDER BY name ASC',
    );

    const featuredProducts = await this.queryPublicProducts({
      featuredOnly: true,
      limit: 8,
      offset: 0,
    });

    const newArrivals = await this.queryPublicProducts({
      sort: 'newest',
      limit: 8,
      offset: 0,
    });

    const approvedVendors = await this.db.query(
      `SELECT id, slug, business_name, description, logo_url, ward_number, address_text, rating_avg, rating_count
       FROM vendors
       WHERE approval_status = 'APPROVED'
       ORDER BY rating_avg DESC`,
    );

    return {
      categories: categories.rows,
      brands: brands.rows,
      featuredProducts: featuredProducts.items,
      newArrivals: newArrivals.items,
      vendors: approvedVendors.rows,
    };
  }

  @Public()
  @Get('categories')
  async listCategories() {
    const res = await this.db.query(
      'SELECT id, slug, name, description, image_url, sort_order FROM categories WHERE is_active = TRUE ORDER BY sort_order ASC',
    );
    return { items: res.rows };
  }

  @Public()
  @Get('products')
  async listProducts(
    @Query('category') category?: string,
    @Query('brand') brand?: string,
    @Query('vendor') vendor?: string,
    @Query('q') q?: string,
    @Query('minPricePaisa') minPricePaisa?: string,
    @Query('maxPricePaisa') maxPricePaisa?: string,
    @Query('minRating') minRating?: string,
    @Query('inStockOnly') inStockOnly?: string,
    @Query('sort') sort?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const p = Math.max(1, Number(page || 1));
    const size = Math.min(48, Math.max(1, Number(pageSize || 12)));
    const offset = (p - 1) * size;

    const result = await this.queryPublicProducts({
      category,
      brand,
      vendor,
      q,
      minPricePaisa: minPricePaisa ? Number(minPricePaisa) : undefined,
      maxPricePaisa: maxPricePaisa ? Number(maxPricePaisa) : undefined,
      minRating: minRating ? Number(minRating) : undefined,
      inStockOnly: inStockOnly === 'true',
      sort,
      limit: size,
      offset,
    });

    return {
      items: result.items,
      pagination: {
        page: p,
        pageSize: size,
        total: result.total,
        totalPages: Math.ceil(result.total / size),
      },
    };
  }

  @Public()
  @Get('products/:slug')
  async getProductBySlug(@Param('slug') slug: string) {
    // STRICT MODERATION INVARIANT: Only ACTIVE products from APPROVED vendors are publicly accessible
    const prodRes = await this.db.query(
      `SELECT
         p.*,
         c.slug AS category_slug,
         c.name AS category_name,
         b.slug AS brand_slug,
         b.name AS brand_name,
         v.slug AS vendor_slug,
         v.business_name AS vendor_name,
         v.ward_number AS vendor_ward,
         v.return_policy AS vendor_return_policy,
         v.shipping_policy AS vendor_shipping_policy,
         v.rating_avg AS vendor_rating_avg
       FROM products p
       JOIN vendors v ON v.id = p.vendor_id
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN brands b ON b.id = p.brand_id
       WHERE (p.slug = $1 OR p.id = $1)
         AND p.moderation_status = 'ACTIVE'
         AND v.approval_status = 'APPROVED'`,
      [slug],
    );

    if (prodRes.rows.length === 0) {
      throw new AppDomainError(
        'PRODUCT_NOT_FOUND',
        'Product not found or is not publicly available.',
        HttpStatus.NOT_FOUND,
      );
    }

    const product = prodRes.rows[0];

    const mediaRes = await this.db.query(
      `SELECT id, url, alt_text, sort_order
       FROM product_media
       WHERE product_id = $1 AND moderation_status = 'APPROVED'
       ORDER BY sort_order ASC`,
      [product.id],
    );

    const variantsRes = await this.db.query(
      `SELECT
         pv.id,
         pv.sku,
         pv.title,
         pv.size_value,
         pv.color_name,
         pv.color_hex,
         pv.price_paisa,
         pv.compare_at_price_paisa,
         pv.currency,
         COALESCE(ii.available_qty, 0) AS available_qty
       FROM product_variants pv
       LEFT JOIN inventory_items ii ON ii.variant_id = pv.id
       WHERE pv.product_id = $1 AND pv.status = 'ACTIVE'
       ORDER BY pv.created_at ASC`,
      [product.id],
    );

    const reviewsRes = await this.db.query(
      `SELECT
         r.id,
         r.rating,
         r.comment,
         r.media_urls_json,
         r.is_verified_purchase,
         r.created_at,
         u.full_name AS customer_name,
         u.avatar_url AS customer_avatar,
         vrr.response_text AS vendor_response,
         vrr.created_at AS vendor_response_at
       FROM reviews r
       JOIN users u ON u.id = r.customer_id
       LEFT JOIN vendor_review_responses vrr ON vrr.review_id = r.id
       WHERE r.product_id = $1 AND r.moderation_status = 'PUBLISHED'
       ORDER BY r.created_at DESC`,
      [product.id],
    );

    const distRes = await this.db.query<{ rating: number; count: string }>(
      `SELECT rating, COUNT(*)::text AS count
       FROM reviews
       WHERE product_id = $1 AND moderation_status = 'PUBLISHED'
       GROUP BY rating`,
      [product.id],
    );
    const ratingDistribution: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const row of distRes.rows) {
      ratingDistribution[Number(row.rating)] = Number(row.count);
    }

    const related = await this.queryPublicProducts({
      limit: 4,
      offset: 0,
      excludeProductId: product.id,
    });

    return {
      product: {
        ...product,
        rating_avg: Number(product.rating_avg),
        specifications: JSON.parse(product.specifications_json || '{}'),
        media: mediaRes.rows,
        variants: variantsRes.rows,
      },
      reviews: reviewsRes.rows.map((r) => ({
        ...r,
        mediaUrls: JSON.parse(r.media_urls_json || '[]'),
      })),
      ratingDistribution,
      relatedProducts: related.items,
    };
  }

  @Public()
  @Get('vendors/:slug')
  async getPublicVendorStorefront(@Param('slug') slug: string) {
    const vRes = await this.db.query(
      `SELECT id, slug, business_name, description, logo_url, banner_url,
              ward_number, address_text, return_policy, shipping_policy, rating_avg, rating_count, created_at
       FROM vendors
       WHERE (slug = $1 OR id = $1) AND approval_status = 'APPROVED'`,
      [slug],
    );

    if (vRes.rows.length === 0) {
      throw new AppDomainError(
        'VENDOR_NOT_FOUND',
        'Vendor storefront not found or is not approved.',
        HttpStatus.NOT_FOUND,
      );
    }

    const vendor = vRes.rows[0];
    const products = await this.queryPublicProducts({
      vendor: vendor.slug,
      limit: 24,
      offset: 0,
    });

    return {
      vendor: {
        ...vendor,
        rating_avg: Number(vendor.rating_avg),
      },
      products: products.items,
    };
  }

  private async queryPublicProducts(opts: {
    category?: string;
    brand?: string;
    vendor?: string;
    q?: string;
    minPricePaisa?: number;
    maxPricePaisa?: number;
    minRating?: number;
    inStockOnly?: boolean;
    featuredOnly?: boolean;
    excludeProductId?: string;
    sort?: string;
    limit: number;
    offset: number;
  }) {
    const conditions: string[] = [
      "p.moderation_status = 'ACTIVE'",
      "v.approval_status = 'APPROVED'",
    ];
    const params: any[] = [];

    const addParam = (val: any): string => {
      params.push(val);
      return `$${params.length}`;
    };

    if (opts.category && opts.category !== 'all') {
      const pIdx = addParam(opts.category);
      conditions.push(`(c.slug = ${pIdx} OR c.id = ${pIdx})`);
    }
    if (opts.brand) {
      const pIdx = addParam(opts.brand);
      conditions.push(`(b.slug = ${pIdx} OR b.id = ${pIdx})`);
    }
    if (opts.vendor) {
      const pIdx = addParam(opts.vendor);
      conditions.push(`(v.slug = ${pIdx} OR v.id = ${pIdx})`);
    }
    if (opts.q && opts.q.trim()) {
      const pIdx = addParam(`%${opts.q.trim()}%`);
      conditions.push(`(p.title ILIKE ${pIdx} OR p.subtitle ILIKE ${pIdx} OR p.description ILIKE ${pIdx})`);
    }
    if (typeof opts.minPricePaisa === 'number' && !Number.isNaN(opts.minPricePaisa)) {
      conditions.push(`p.base_price_paisa >= ${addParam(opts.minPricePaisa)}`);
    }
    if (typeof opts.maxPricePaisa === 'number' && !Number.isNaN(opts.maxPricePaisa)) {
      conditions.push(`p.base_price_paisa <= ${addParam(opts.maxPricePaisa)}`);
    }
    if (typeof opts.minRating === 'number' && !Number.isNaN(opts.minRating)) {
      conditions.push(`p.rating_avg >= ${addParam(opts.minRating)}`);
    }
    if (opts.featuredOnly) {
      conditions.push('p.is_featured = TRUE');
    }
    if (opts.excludeProductId) {
      conditions.push(`p.id <> ${addParam(opts.excludeProductId)}`);
    }
    if (opts.inStockOnly) {
      conditions.push(`EXISTS (
        SELECT 1 FROM product_variants pv2
        JOIN inventory_items ii2 ON ii2.variant_id = pv2.id
        WHERE pv2.product_id = p.id AND ii2.available_qty > 0
      )`);
    }

    const whereClause = conditions.join(' AND ');

    let orderBy = 'p.is_featured DESC, p.review_count DESC, p.created_at DESC';
    if (opts.sort === 'price_asc') orderBy = 'p.base_price_paisa ASC';
    if (opts.sort === 'price_desc') orderBy = 'p.base_price_paisa DESC';
    if (opts.sort === 'newest') orderBy = 'p.created_at DESC';
    if (opts.sort === 'rating') orderBy = 'p.rating_avg DESC, p.review_count DESC';

    const countRes = await this.db.query<{ cnt: string }>(
      `SELECT COUNT(*)::text AS cnt
       FROM products p
       JOIN vendors v ON v.id = p.vendor_id
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN brands b ON b.id = p.brand_id
       WHERE ${whereClause}`,
      params,
    );
    const total = Number(countRes.rows[0]?.cnt ?? 0);

    const limitPlaceholder = addParam(opts.limit);
    const offsetPlaceholder = addParam(opts.offset);

    const rowsRes = await this.db.query(
      `SELECT
         p.id,
         p.slug,
         p.title,
         p.subtitle,
         p.base_price_paisa,
         p.compare_at_price_paisa,
         p.currency,
         p.is_featured,
         p.is_new,
         p.rating_avg,
         p.review_count,
         c.slug AS category_slug,
         c.name AS category_name,
         b.slug AS brand_slug,
         b.name AS brand_name,
         v.id AS vendor_id,
         v.slug AS vendor_slug,
         v.business_name AS vendor_name,
         (SELECT pm.url FROM product_media pm WHERE pm.product_id = p.id ORDER BY pm.sort_order ASC LIMIT 1) AS image_url,
         (SELECT pv.id FROM product_variants pv WHERE pv.product_id = p.id AND pv.status = 'ACTIVE' ORDER BY pv.created_at ASC LIMIT 1) AS default_variant_id,
         COALESCE((
           SELECT SUM(ii.available_qty)::int
           FROM product_variants pv
           JOIN inventory_items ii ON ii.variant_id = pv.id
           WHERE pv.product_id = p.id
         ), 0) AS total_stock
       FROM products p
       JOIN vendors v ON v.id = p.vendor_id
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN brands b ON b.id = p.brand_id
       WHERE ${whereClause}
       ORDER BY ${orderBy}
       LIMIT ${limitPlaceholder} OFFSET ${offsetPlaceholder}`,
      params,
    );

    return {
      total,
      items: rowsRes.rows.map((r) => ({
        ...r,
        rating_avg: Number(r.rating_avg),
        total_stock: Number(r.total_stock),
      })),
    };
  }
}
