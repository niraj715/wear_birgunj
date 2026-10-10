import { DatabaseService } from './database.service.js';
import { hashPassword } from '../common/crypto.util.js';

export async function seedDatabase(db: DatabaseService): Promise<void> {
  await db.applyMigrations();

  // Check if already seeded
  const existingUsers = await db.query<{ count: string }>('SELECT COUNT(*)::text AS count FROM users');
  if (Number(existingUsers.rows[0]?.count ?? 0) > 0) {
    return;
  }

  const customerHash = hashPassword('CustomerPass123!');
  const vendorHash = hashPassword('VendorPass123!');
  const adminHash = hashPassword('AdminPass123!');

  await db.transaction(async (tx) => {
    // 1. Roles & Permissions
    const roles = [
      ['role-customer', 'CUSTOMER', 'Standard marketplace customer'],
      ['role-vendor-owner', 'VENDOR_OWNER', 'Vendor store owner'],
      ['role-vendor-staff', 'VENDOR_STAFF', 'Scoped vendor staff member'],
      ['role-moderator', 'CATALOG_MODERATOR', 'Product & review moderator'],
      ['role-finance', 'FINANCE_OPERATOR', 'Finance, ledger & payout operator'],
      ['role-support', 'SUPPORT_AGENT', 'Customer support agent'],
      ['role-admin', 'PLATFORM_ADMIN', 'Platform administrator'],
      ['role-super-admin', 'SUPER_ADMIN', 'Super administrator'],
    ];
    for (const [id, name, desc] of roles) {
      await tx.query(
        'INSERT INTO roles (id, name, description) VALUES ($1, $2, $3) ON CONFLICT (name) DO NOTHING',
        [id, name, desc],
      );
    }

    const perms = [
      ['perm-catalog-read', 'catalog:read_public', 'Read public catalog'],
      ['perm-customer-cart', 'customer:cart_checkout', 'Manage cart and place orders'],
      ['perm-vendor-manage', 'vendor:store_manage', 'Manage own vendor store'],
      ['perm-vendor-products', 'vendor:product_manage', 'Manage own vendor products'],
      ['perm-vendor-orders', 'vendor:order_fulfill', 'Fulfill own vendor orders'],
      ['perm-admin-vendors', 'admin:vendor_moderate', 'Approve or suspend vendors'],
      ['perm-admin-products', 'admin:product_moderate', 'Approve, reject or suspend products'],
      ['perm-admin-finance', 'admin:finance_manage', 'Manage commissions, refunds and payouts'],
      ['perm-admin-audit', 'admin:audit_read', 'View security and administrative audit logs'],
    ];
    for (const [id, code, desc] of perms) {
      await tx.query(
        'INSERT INTO permissions (id, code, description) VALUES ($1, $2, $3) ON CONFLICT (code) DO NOTHING',
        [id, code, desc],
      );
    }

    // 2. Users
    const users = [
      [
        'user-customer-john',
        'john@example.com',
        '+977 9801234567',
        'John Doe',
        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&auto=format&fit=crop&q=80',
        customerHash,
        false,
        'ACTIVE',
      ],
      [
        'user-customer-priya',
        'priya@example.com',
        '+977 9841234567',
        'Priya Singh',
        'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160&auto=format&fit=crop&q=80',
        customerHash,
        false,
        'ACTIVE',
      ],
      [
        'user-customer-aarav',
        'aarav@example.com',
        '+977 9811122233',
        'Aarav Sharma',
        'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&auto=format&fit=crop&q=80',
        customerHash,
        false,
        'ACTIVE',
      ],
      [
        'user-vendor-fashionhub',
        'vendor@fashionhub.np',
        '+977 9802011223',
        'Anil Agrawal (Fashion Hub)',
        'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=160&auto=format&fit=crop&q=80',
        vendorHash,
        true,
        'ACTIVE',
      ],
      [
        'user-vendor-narayani',
        'vendor@narayani.np',
        '+977 9802099887',
        'Sunita Shah (Narayani Studio)',
        'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=160&auto=format&fit=crop&q=80',
        vendorHash,
        true,
        'ACTIVE',
      ],
      [
        'user-vendor-pending',
        'pending@parsaheritage.np',
        '+977 9802055443',
        'Ramesh Yadav',
        null,
        vendorHash,
        false,
        'ACTIVE',
      ],
      [
        'user-admin-main',
        'admin@wearbirgunj.np',
        '+977 9855011111',
        'Niraj Admin (Wear Birgunj)',
        'https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=160&auto=format&fit=crop&q=80',
        adminHash,
        true,
        'ACTIVE',
      ],
    ];

    for (const [id, email, phone, fullName, avatarUrl, pw, mfa, status] of users) {
      await tx.query(
        `INSERT INTO users (id, email, phone, full_name, avatar_url, password_hash, mfa_enabled, status, email_verified_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [id, email, phone, fullName, avatarUrl, pw, mfa, status],
      );
    }

    // Role assignments
    const roleAssignments = [
      ['ura-1', 'user-customer-john', 'role-customer'],
      ['ura-2', 'user-customer-priya', 'role-customer'],
      ['ura-3', 'user-customer-aarav', 'role-customer'],
      ['ura-4', 'user-vendor-fashionhub', 'role-vendor-owner'],
      ['ura-5', 'user-vendor-fashionhub', 'role-customer'],
      ['ura-6', 'user-vendor-narayani', 'role-vendor-owner'],
      ['ura-7', 'user-vendor-pending', 'role-vendor-owner'],
      ['ura-8', 'user-admin-main', 'role-Platform-Admin'.toLowerCase().replace('role-platform-admin', 'role-admin')],
      ['ura-9', 'user-admin-main', 'role-super-admin'],
      ['ura-10', 'user-admin-main', 'role-moderator'],
      ['ura-11', 'user-admin-main', 'role-finance'],
    ];
    for (const [id, uid, rid] of roleAssignments) {
      await tx.query(
        'INSERT INTO user_role_assignments (id, user_id, role_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [id, uid, rid],
      );
    }

    // Default addresses for customers
    await tx.query(
      `INSERT INTO addresses (id, user_id, label, full_name, phone, ward_number, street_address, landmark, city, delivery_instructions, is_default)
       VALUES
       ('addr-john-1', 'user-customer-john', 'Home', 'John Doe', '+977 9801234567', 10, 'Ward 10, Adarshnagar Main Road, Birgunj', 'Near Main Road', 'Birgunj', 'Call before delivery', TRUE),
       ('addr-priya-1', 'user-customer-priya', 'Home', 'Priya Singh', '+977 9841234567', 4, 'Ward 4, Ghantaghar Chowk, Birgunj', 'Opposite Clock Tower', 'Birgunj', 'Leave at reception', TRUE)`,
    );

    // 3. Vendors & Memberships
    await tx.query(
      `INSERT INTO vendors (id, slug, business_name, description, logo_url, banner_url, pan_vat_number, contact_email, contact_phone, ward_number, address_text, approval_status, rating_avg, rating_count, payout_method, payout_account_ref)
       VALUES
       ('vendor-fashion-hub', 'fashion-hub-birgunj', 'Fashion Hub Birgunj', 'Birgunj''s premier destination for authentic footwear, watches, eyewear, and contemporary streetwear.', 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=200&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?w=1200&auto=format&fit=crop&q=80', 'PAN-609812345', 'vendor@fashionhub.np', '+977 9802011223', 10, 'Adarshnagar Commercial Complex, Ward 10, Birgunj', 'APPROVED', 4.80, 120, 'ESEWA', '9802011223'),
       ('vendor-narayani-style', 'narayani-lifestyle-studio', 'Narayani Lifestyle Studio', 'Curated women''s ethnic wear, festive kurtis, summer dresses, and contemporary fashion crafted for Birgunj.', 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?w=200&auto=format&fit=crop&q=80', 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=1200&auto=format&fit=crop&q=80', 'PAN-609899887', 'vendor@narayani.np', '+977 9802099887', 4, 'Ghantaghar Link Road, Ward 4, Birgunj', 'APPROVED', 4.75, 96, 'KHALTI', '9802099887'),
       ('vendor-pending-store', 'parsa-heritage-emporium', 'Parsa Heritage Emporium', 'Traditional handloom textiles and artisanal Mithila crafts.', null, null, 'PAN-609800112', 'pending@parsaheritage.np', '+977 9802055443', 14, 'Bypass Road, Ward 14, Birgunj', 'PENDING_VERIFICATION', 0.00, 0, 'BANK_TRANSFER', 'NIC-ASIA-0098123')`,
    );

    await tx.query(
      `INSERT INTO vendor_memberships (id, user_id, vendor_id, role, status)
       VALUES
       ('vm-1', 'user-vendor-fashionhub', 'vendor-fashion-hub', 'OWNER', 'ACTIVE'),
       ('vm-2', 'user-vendor-narayani', 'vendor-narayani-style', 'OWNER', 'ACTIVE'),
       ('vm-3', 'user-vendor-pending', 'vendor-pending-store', 'OWNER', 'ACTIVE')`,
    );

    await tx.query(
      `INSERT INTO vendor_verifications (id, vendor_id, document_type, private_object_key, status, reviewed_by, review_notes, reviewed_at)
       VALUES
       ('vv-1', 'vendor-fashion-hub', 'PAN_VAT_CERT', 'private://kyc/vendor-fashion-hub/pan-609812345.pdf', 'VERIFIED', 'user-admin-main', 'Verified against IRD Nepal portal', NOW()),
       ('vv-2', 'vendor-narayani-style', 'PAN_VAT_CERT', 'private://kyc/vendor-narayani-style/pan-609899887.pdf', 'VERIFIED', 'user-admin-main', 'Verified PAN & Ward 4 trade license', NOW()),
       ('vv-3', 'vendor-pending-store', 'PAN_VAT_CERT', 'private://kyc/vendor-pending-store/pan-609800112.pdf', 'PENDING', NULL, 'Awaiting admin review', NULL)`,
    );

    await tx.query(
      `INSERT INTO vendor_commission_rules (id, vendor_id, category_id, rate_bps, fixed_fee_paisa, is_active)
       VALUES
       ('vcr-default', NULL, NULL, 1000, 0, TRUE),
       ('vcr-fashion-hub', 'vendor-fashion-hub', NULL, 1000, 0, TRUE),
       ('vcr-narayani', 'vendor-narayani-style', NULL, 1000, 0, TRUE)`,
    );

    // 4. Categories (Matching Screen #1 & Screen #2)
    const categories = [
      ['cat-shoes', 'shoes', 'Shoes', 'Sneakers, running shoes, formal footwear & heels', 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400&auto=format&fit=crop&q=80', 1],
      ['cat-men', 'men-fashion', 'Men Fashion', 'Shirts, jackets, trousers, tees & ethnic wear for men', 'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?w=400&auto=format&fit=crop&q=80', 2],
      ['cat-women', 'women-fashion', 'Women Fashion', 'Kurtis, summer dresses, denim jackets, palazzos & sarees', 'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=400&auto=format&fit=crop&q=80', 3],
      ['cat-kids', 'kids', 'Kids', 'Comfortable everyday clothing and footwear for kids', 'https://images.unsplash.com/photo-1519238263530-99bdd11df2ea?w=400&auto=format&fit=crop&q=80', 4],
      ['cat-accessories', 'accessories', 'Accessories', 'Watches, sunglasses, belts, and lifestyle essentials', 'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=400&auto=format&fit=crop&q=80', 5],
      ['cat-bags', 'bags', 'Bags', 'Leather handbags, totes, backpacks, and travel bags', 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=400&auto=format&fit=crop&q=80', 6],
      ['cat-home', 'home-living', 'Home & Living', 'Decor, cushions, lamps, and modern home accents', 'https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=400&auto=format&fit=crop&q=80', 7],
      ['cat-electronics', 'electronics', 'Electronics', 'Headphones, smartwatches, and audio gear', 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400&auto=format&fit=crop&q=80', 8],
    ];
    for (const [id, slug, name, desc, img, order] of categories) {
      await tx.query(
        'INSERT INTO categories (id, slug, name, description, image_url, sort_order) VALUES ($1, $2, $3, $4, $5, $6)',
        [id, slug, name, desc, img, order],
      );
    }

    // 5. Brands (Matching Screen #1 & Screen #2)
    const brands = [
      ['brand-nike', 'nike', 'Nike', false],
      ['brand-adidas', 'adidas', 'Adidas', false],
      ['brand-puma', 'puma', 'Puma', false],
      ['brand-zara', 'zara', 'Zara', false],
      ['brand-levis', 'levis', "Levi's", false],
      ['brand-hm', 'hm', 'H&M', false],
      ['brand-casio', 'casio', 'Casio', false],
      ['brand-rayban', 'ray-ban', 'Ray-Ban', false],
      ['brand-birgunj-looms', 'birgunj-looms', 'Birgunj Artisans', true],
    ];
    for (const [id, slug, name, isLocal] of brands) {
      await tx.query(
        'INSERT INTO brands (id, slug, name, is_local_brand) VALUES ($1, $2, $3, $4)',
        [id, slug, name, isLocal],
      );
    }

    // 6. Products, Variants, Media & Inventory (Matching all 16 UI Screens)
    const productsData = [
      {
        id: 'prod-af1',
        vendorId: 'vendor-fashion-hub',
        categoryId: 'cat-shoes',
        brandId: 'brand-nike',
        slug: 'nike-air-force-1',
        title: "Nike Air Force 1 Men's Sneakers",
        subtitle: 'Nike',
        description:
          'Iconic court-inspired comfort crafted with crisp leather overlays, perforated toe box breathability, and Nike Air cushioning. Delivered within 2–4 hours across Birgunj.',
        specs: JSON.stringify({
          Upper: 'Premium Full-Grain Leather',
          Sole: 'Non-marking Rubber Cupsole with Air Unit',
          Closure: 'Lace-Up',
          Origin: 'Authentic Brand Import — Verified by Fashion Hub Birgunj',
          Warranty: '36-Hour Easy Size Exchange in Birgunj',
        }),
        moderationStatus: 'ACTIVE',
        basePricePaisa: 499900,
        compareAtPricePaisa: 599900,
        isFeatured: true,
        isNew: true,
        ratingAvg: 4.8,
        reviewCount: 120,
        images: [
          'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1600269452121-4f2416e55c28?w=800&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1595950653106-6c9ebd614d3a?w=800&auto=format&fit=crop&q=80',
        ],
        variants: [
          { id: 'var-af1-w-7', sku: 'WB-AF1-WHT-7', title: 'White / Size 7', size: '7', color: 'White', hex: '#F9FAFB', price: 499900, stock: 8 },
          { id: 'var-af1-w-8', sku: 'WB-AF1-WHT-8', title: 'White / Size 8', size: '8', color: 'White', hex: '#F9FAFB', price: 499900, stock: 12 },
          { id: 'var-af1-w-9', sku: 'WB-AF1-WHT-9', title: 'White / Size 9', size: '9', color: 'White', hex: '#F9FAFB', price: 499900, stock: 10 },
          { id: 'var-af1-b-8', sku: 'WB-AF1-BLK-8', title: 'Black / Size 8', size: '8', color: 'Black', hex: '#111827', price: 499900, stock: 6 },
          { id: 'var-af1-n-9', sku: 'WB-AF1-NVY-9', title: 'Navy / Size 9', size: '9', color: 'Navy', hex: '#1E3A8A', price: 499900, stock: 5 },
        ],
      },
      {
        id: 'prod-watch',
        vendorId: 'vendor-fashion-hub',
        categoryId: 'cat-accessories',
        brandId: 'brand-casio',
        slug: 'classic-analog-watch',
        title: 'Classic Analog Watch',
        subtitle: 'Casio',
        description:
          'Minimalist brushed stainless-steel case paired with a genuine stitched leather strap and Japanese quartz movement.',
        specs: JSON.stringify({
          Movement: 'Japanese Quartz',
          Strap: 'Genuine Brown Leather',
          WaterResistance: '50m (5 ATM)',
          CaseDiameter: '40mm',
        }),
        moderationStatus: 'ACTIVE',
        basePricePaisa: 249900,
        compareAtPricePaisa: 299900,
        isFeatured: true,
        isNew: false,
        ratingAvg: 4.7,
        reviewCount: 85,
        images: [
          'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=800&auto=format&fit=crop&q=80',
          'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?w=800&auto=format&fit=crop&q=80',
        ],
        variants: [
          { id: 'var-watch-blk', sku: 'WB-WTC-BLK-STD', title: 'Black Dial / Brown Strap', size: '40mm', color: 'Black', hex: '#111827', price: 249900, stock: 15 },
          { id: 'var-watch-slv', sku: 'WB-WTC-SLV-STD', title: 'Silver Dial / Tan Strap', size: '40mm', color: 'Silver', hex: '#9CA3AF', price: 249900, stock: 7 },
        ],
      },
      {
        id: 'prod-sunglasses',
        vendorId: 'vendor-fashion-hub',
        categoryId: 'cat-accessories',
        brandId: 'brand-rayban',
        slug: 'premium-sunglasses',
        title: 'Premium Sunglasses',
        subtitle: 'Ray-Ban',
        description:
          'UV400 polarized acetate frame sunglasses engineered for bright Terai sunshine and timeless street style.',
        specs: JSON.stringify({
          Lens: 'UV400 Polarized Polycarbonate',
          Frame: 'Lightweight Acetate',
          Style: 'Classic Wayfarer',
        }),
        moderationStatus: 'ACTIVE',
        basePricePaisa: 199900,
        compareAtPricePaisa: 249900,
        isFeatured: true,
        isNew: false,
        ratingAvg: 4.9,
        reviewCount: 210,
        images: [
          'https://images.unsplash.com/photo-1511499767150-a48a237f0083?w=800&auto=format&fit=crop&q=80',
        ],
        variants: [
          { id: 'var-sun-blk', sku: 'WB-SUN-BLK-01', title: 'Black / Polarized', size: 'Standard', color: 'Black', hex: '#111827', price: 199900, stock: 18 },
        ],
      },
      {
        id: 'prod-handbag',
        vendorId: 'vendor-fashion-hub',
        categoryId: 'cat-bags',
        brandId: 'brand-zara',
        slug: 'leather-handbag',
        title: 'Leather Handbag',
        subtitle: 'Zara',
        description:
          'Structured cognac leather tote with gold-tone hardware, dual top handles, and a spacious zippered compartment.',
        specs: JSON.stringify({
          Material: 'Pebbled Vegan Leather',
          Compartments: '3 Interior Pockets + Zippered Divider',
          Dimensions: '32cm x 26cm x 14cm',
        }),
        moderationStatus: 'ACTIVE',
        basePricePaisa: 349900,
        compareAtPricePaisa: 419900,
        isFeatured: true,
        isNew: true,
        ratingAvg: 4.6,
        reviewCount: 95,
        images: [
          'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80',
        ],
        variants: [
          { id: 'var-bag-tan', sku: 'WB-BAG-TAN-01', title: 'Cognac Tan / Medium', size: 'Medium', color: 'Tan', hex: '#9A3412', price: 349900, stock: 11 },
        ],
      },
      {
        id: 'prod-kurti',
        vendorId: 'vendor-narayani-style',
        categoryId: 'cat-women',
        brandId: 'brand-birgunj-looms',
        slug: 'embroidered-kurti',
        title: 'Embroidered Kurti',
        subtitle: 'Women Fashion',
        description:
          'Breathable pure cotton festive kurti featuring intricate thread embroidery and a flattering straight silhouette.',
        specs: JSON.stringify({
          Fabric: '100% Combed Cotton',
          Work: 'Artisanal Thread Embroidery',
          Care: 'Gentle Hand Wash',
        }),
        moderationStatus: 'ACTIVE',
        basePricePaisa: 249900,
        compareAtPricePaisa: 299900,
        isFeatured: false,
        isNew: true,
        ratingAvg: 4.8,
        reviewCount: 120,
        images: [
          'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&auto=format&fit=crop&q=80',
        ],
        variants: [
          { id: 'var-kurti-m', sku: 'WB-KRT-IVR-M', title: 'Ivory Gold / M', size: 'M', color: 'Ivory', hex: '#FEF3C7', price: 249900, stock: 14 },
          { id: 'var-kurti-l', sku: 'WB-KRT-IVR-L', title: 'Ivory Gold / L', size: 'L', color: 'Ivory', hex: '#FEF3C7', price: 249900, stock: 9 },
        ],
      },
      {
        id: 'prod-summer-dress',
        vendorId: 'vendor-narayani-style',
        categoryId: 'cat-women',
        brandId: 'brand-zara',
        slug: 'summer-dress',
        title: 'Summer Dress',
        subtitle: 'Women Fashion',
        description:
          'Lightweight pastel rose midi dress designed for effortless comfort and warm Birgunj afternoons.',
        specs: JSON.stringify({ Fabric: 'Linen Viscose Blend', Fit: 'Relaxed A-Line' }),
        moderationStatus: 'ACTIVE',
        basePricePaisa: 189900,
        compareAtPricePaisa: 229900,
        isFeatured: false,
        isNew: true,
        ratingAvg: 4.7,
        reviewCount: 85,
        images: [
          'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?w=800&auto=format&fit=crop&q=80',
        ],
        variants: [
          { id: 'var-sdress-s', sku: 'WB-SDR-PNK-S', title: 'Blush Pink / S', size: 'S', color: 'Pink', hex: '#F472B6', price: 189900, stock: 10 },
          { id: 'var-sdress-m', sku: 'WB-SDR-PNK-M', title: 'Blush Pink / M', size: 'M', color: 'Pink', hex: '#F472B6', price: 189900, stock: 12 },
        ],
      },
      {
        id: 'prod-denim-jacket',
        vendorId: 'vendor-fashion-hub',
        categoryId: 'cat-women',
        brandId: 'brand-levis',
        slug: 'denim-jacket',
        title: 'Denim Jacket',
        subtitle: "Levi's",
        description: 'Classic vintage-wash trucker denim jacket with copper button hardware and chest flap pockets.',
        specs: JSON.stringify({ Fabric: '100% Heavyweight Denim', Wash: 'Mid Indigo Vintage' }),
        moderationStatus: 'ACTIVE',
        basePricePaisa: 299900,
        compareAtPricePaisa: 349900,
        isFeatured: false,
        isNew: false,
        ratingAvg: 4.9,
        reviewCount: 210,
        images: [
          'https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop&q=80',
        ],
        variants: [
          { id: 'var-denim-m', sku: 'WB-DNM-BLU-M', title: 'Indigo Blue / M', size: 'M', color: 'Blue', hex: '#2563EB', price: 299900, stock: 9 },
        ],
      },
      {
        id: 'prod-crop-top',
        vendorId: 'vendor-narayani-style',
        categoryId: 'cat-women',
        brandId: 'brand-hm',
        slug: 'crop-top',
        title: 'Crop Top',
        subtitle: 'H&M',
        description: 'Soft ribbed-knit cotton crop top that pairs seamlessly with high-waisted denim or palazzo pants.',
        specs: JSON.stringify({ Fabric: '95% Cotton, 5% Elastane' }),
        moderationStatus: 'ACTIVE',
        basePricePaisa: 149900,
        compareAtPricePaisa: 179900,
        isFeatured: false,
        isNew: false,
        ratingAvg: 4.6,
        reviewCount: 95,
        images: [
          'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?w=800&auto=format&fit=crop&q=80',
        ],
        variants: [
          { id: 'var-crop-s', sku: 'WB-CRP-BEG-S', title: 'Warm Beige / S', size: 'S', color: 'Beige', hex: '#D6D3D1', price: 149900, stock: 16 },
        ],
      },
      {
        id: 'prod-palazzo',
        vendorId: 'vendor-narayani-style',
        categoryId: 'cat-women',
        brandId: 'brand-zara',
        slug: 'palazzo-pants',
        title: 'Palazzo Pants',
        subtitle: 'Zara',
        description: 'Flowy high-rise wide-leg palazzo trousers tailored for all-day elegance.',
        specs: JSON.stringify({ Fabric: 'Crepe Georgette', Fit: 'High-Waist Wide Leg' }),
        moderationStatus: 'ACTIVE',
        basePricePaisa: 179900,
        compareAtPricePaisa: 219900,
        isFeatured: false,
        isNew: false,
        ratingAvg: 4.5,
        reviewCount: 70,
        images: [
          'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?w=800&auto=format&fit=crop&q=80',
        ],
        variants: [
          { id: 'var-palazzo-m', sku: 'WB-PLZ-BLK-M', title: 'Jet Black / M', size: 'M', color: 'Black', hex: '#111827', price: 179900, stock: 14 },
        ],
      },
      {
        id: 'prod-heels',
        vendorId: 'vendor-fashion-hub',
        categoryId: 'cat-women',
        brandId: 'brand-zara',
        slug: 'stiletto-heels',
        title: 'Stiletto Heels',
        subtitle: 'Zara',
        description: 'Pointed-toe suede stiletto heels with cushioned insoles for party and formal occasions.',
        specs: JSON.stringify({ HeelHeight: '8.5 cm', Material: 'Faux Suede' }),
        moderationStatus: 'ACTIVE',
        basePricePaisa: 269900,
        compareAtPricePaisa: 319900,
        isFeatured: false,
        isNew: true,
        ratingAvg: 4.8,
        reviewCount: 90,
        images: [
          'https://images.unsplash.com/photo-1543163521-1bf539c55dd2?w=800&auto=format&fit=crop&q=80',
        ],
        variants: [
          { id: 'var-heels-38', sku: 'WB-STL-NUD-38', title: 'Rose Nude / EU 38', size: '38', color: 'Nude', hex: '#E5C1B8', price: 269900, stock: 8 },
        ],
      },
      {
        id: 'prod-nike-running',
        vendorId: 'vendor-fashion-hub',
        categoryId: 'cat-shoes',
        brandId: 'brand-nike',
        slug: 'nike-running-shoes',
        title: 'Nike Running Shoes',
        subtitle: 'Shoes',
        description: 'Responsive foam cushioning and engineered mesh upper built for daily road running.',
        specs: JSON.stringify({ Drop: '10mm', Weight: '265g' }),
        moderationStatus: 'ACTIVE',
        basePricePaisa: 429900,
        compareAtPricePaisa: 499900,
        isFeatured: false,
        isNew: true,
        ratingAvg: 4.7,
        reviewCount: 64,
        images: [
          'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop&q=80',
        ],
        variants: [
          { id: 'var-nrun-8', sku: 'WB-NRN-BLK-8', title: 'Black Crimson / Size 8', size: '8', color: 'Black', hex: '#111827', price: 429900, stock: 10 },
        ],
      },
      {
        id: 'prod-nike-tee',
        vendorId: 'vendor-fashion-hub',
        categoryId: 'cat-men',
        brandId: 'brand-nike',
        slug: 'nike-t-shirt',
        title: 'Nike T-Shirt',
        subtitle: 'Men Fashion',
        description: 'Moisture-wicking athletic crew neck t-shirt in breathable combed cotton blend.',
        specs: JSON.stringify({ Fabric: 'Dri-FIT Cotton Poly' }),
        moderationStatus: 'ACTIVE',
        basePricePaisa: 189900,
        compareAtPricePaisa: 219900,
        isFeatured: false,
        isNew: false,
        ratingAvg: 4.6,
        reviewCount: 52,
        images: [
          'https://images.unsplash.com/photo-1521572267360-ee0c2909d518?w=800&auto=format&fit=crop&q=80',
        ],
        variants: [
          { id: 'var-ntee-l', sku: 'WB-NTE-WHT-L', title: 'White / L', size: 'L', color: 'White', hex: '#F9FAFB', price: 189900, stock: 20 },
        ],
      },
      // Non-public moderation states (Screen #14 Vendor Products & Admin Moderation Queue)
      {
        id: 'prod-pending-saree',
        vendorId: 'vendor-fashion-hub',
        categoryId: 'cat-women',
        brandId: 'brand-birgunj-looms',
        slug: 'handwoven-mithila-silk-saree',
        title: 'Handwoven Mithila Silk Saree',
        subtitle: 'Birgunj Artisans',
        description: 'Pure handwoven silk saree featuring traditional Mithila border motifs. Submitted for catalog review.',
        specs: JSON.stringify({ Fabric: 'Pure Tussar Silk', Length: '6.2 Meters with Blouse Piece' }),
        moderationStatus: 'PENDING_APPROVAL',
        basePricePaisa: 649900,
        compareAtPricePaisa: 749900,
        isFeatured: false,
        isNew: true,
        ratingAvg: 0,
        reviewCount: 0,
        images: [
          'https://images.unsplash.com/photo-1610030469983-98e550d6193c?w=800&auto=format&fit=crop&q=80',
        ],
        variants: [
          { id: 'var-saree-std', sku: 'WB-SAR-MTH-01', title: 'Crimson Gold / Free Size', size: 'Free Size', color: 'Crimson', hex: '#DC2626', price: 649900, stock: 5 },
        ],
      },
      {
        id: 'prod-draft-bag',
        vendorId: 'vendor-fashion-hub',
        categoryId: 'cat-bags',
        brandId: 'brand-zara',
        slug: 'travel-duffel-draft',
        title: 'Weekend Canvas Duffel Bag',
        subtitle: 'Bags',
        description: 'Work-in-progress draft listing for canvas weekender bag.',
        specs: JSON.stringify({ Material: 'Waxed Canvas' }),
        moderationStatus: 'DRAFT',
        basePricePaisa: 349900,
        compareAtPricePaisa: null,
        isFeatured: false,
        isNew: false,
        ratingAvg: 0,
        reviewCount: 0,
        images: [
          'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80',
        ],
        variants: [
          { id: 'var-duffel-std', sku: 'WB-DFL-OLV-01', title: 'Olive / Standard', size: 'Standard', color: 'Olive', hex: '#3F6212', price: 349900, stock: 4 },
        ],
      },
      {
        id: 'prod-rejected-belt',
        vendorId: 'vendor-fashion-hub',
        categoryId: 'cat-accessories',
        brandId: 'brand-zara',
        slug: 'unverified-luxury-belt',
        title: 'Imported Buckle Belt',
        subtitle: 'Accessories',
        description: 'Rejected listing awaiting brand authorization upload.',
        specs: JSON.stringify({ Material: 'Leather' }),
        moderationStatus: 'REJECTED',
        rejectionReason: 'Please attach brand invoice or authorization certificate before listing.',
        basePricePaisa: 159900,
        compareAtPricePaisa: null,
        isFeatured: false,
        isNew: false,
        ratingAvg: 0,
        reviewCount: 0,
        images: [
          'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop&q=80',
        ],
        variants: [
          { id: 'var-belt-std', sku: 'WB-BLT-BLK-01', title: 'Black / 34', size: '34', color: 'Black', hex: '#111827', price: 159900, stock: 3 },
        ],
      },
    ];

    for (const p of productsData) {
      await tx.query(
        `INSERT INTO products (
          id, vendor_id, category_id, brand_id, slug, title, subtitle, description,
          specifications_json, moderation_status, rejection_reason, base_price_paisa,
          compare_at_price_paisa, currency, is_featured, is_new, rating_avg, review_count
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'NPR',$14,$15,$16,$17)`,
        [
          p.id,
          p.vendorId,
          p.categoryId,
          p.brandId,
          p.slug,
          p.title,
          p.subtitle,
          p.description,
          p.specs,
          p.moderationStatus,
          (p as any).rejectionReason ?? null,
          p.basePricePaisa,
          p.compareAtPricePaisa,
          p.isFeatured,
          p.isNew,
          p.ratingAvg,
          p.reviewCount,
        ],
      );

      for (let i = 0; i < p.images.length; i++) {
        await tx.query(
          `INSERT INTO product_media (id, product_id, url, object_key, alt_text, sort_order)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [`media-${p.id}-${i}`, p.id, p.images[i], `public/products/${p.slug}-${i}.jpg`, p.title, i],
        );
      }

      for (const v of p.variants) {
        await tx.query(
          `INSERT INTO product_variants (id, product_id, sku, title, size_value, color_name, color_hex, price_paisa, compare_at_price_paisa, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'ACTIVE')`,
          [v.id, p.id, v.sku, v.title, v.size, v.color, v.hex, v.price, p.compareAtPricePaisa],
        );

        await tx.query(
          `INSERT INTO inventory_items (id, variant_id, vendor_id, available_qty, reserved_qty, low_stock_threshold)
           VALUES ($1, $2, $3, $4, 0, 5)`,
          [`inv-${v.id}`, v.id, p.vendorId, v.stock],
        );
      }
    }

    // 7. Coupons
    await tx.query(
      `INSERT INTO coupons (id, code, description, discount_type, discount_value, min_order_paisa, max_discount_paisa, is_active)
       VALUES
       ('cpn-birgunj10', 'BIRGUNJ10', '10% OFF on orders above Rs. 1,500 (up to Rs. 1,000)', 'PERCENTAGE', 10, 150000, 100000, TRUE),
       ('cpn-welcome500', 'WELCOME500', 'Flat Rs. 500 OFF on orders above Rs. 3,000', 'FIXED_PAISA', 50000, 300000, 50000, TRUE)`,
    );

    // 8. Sample Orders matching Screens #6, #8, #9, #13, #15, #16
    // Order 1: #WB123456 (Out for Delivery - Rs. 4,999)
    await tx.query(
      `INSERT INTO orders (
        id, order_number, customer_id, status, payment_method, payment_status,
        subtotal_paisa, discount_paisa, tax_paisa, shipping_paisa, total_paisa,
        shipping_name, shipping_phone, shipping_ward, shipping_address, shipping_landmark,
        delivery_instructions, estimated_delivery_text, created_at
      ) VALUES (
        'ord-wb123456', '#WB123456', 'user-customer-john', 'OUT_FOR_DELIVERY', 'ESEWA', 'PAID',
        499900, 0, 57510, 0, 499900,
        'John Doe', '+977 9801234567', 10, 'Ward 10, Birgunj', 'Near Main Road',
        'Call before delivery', 'Today, 2-4 Hours', NOW() - INTERVAL '2 hours'
      )`,
    );

    await tx.query(
      `INSERT INTO vendor_orders (
        id, order_id, vendor_id, vendor_order_number, status,
        subtotal_paisa, discount_paisa, tax_paisa, shipping_paisa, total_paisa,
        commission_rate_bps, commission_paisa, net_vendor_paisa, created_at
      ) VALUES (
        'vord-wb123456-fh', 'ord-wb123456', 'vendor-fashion-hub', '#WB123456-FH', 'OUT_FOR_DELIVERY',
        499900, 0, 57510, 0, 499900, 1000, 49990, 449910, NOW() - INTERVAL '2 hours'
      )`,
    );

    await tx.query(
      `INSERT INTO order_items (
        id, order_id, vendor_order_id, product_id, variant_id, vendor_id,
        product_title_snapshot, variant_title_snapshot, sku_snapshot, image_url_snapshot,
        unit_price_paisa, quantity, line_total_paisa
      ) VALUES (
        'oitem-wb123456-1', 'ord-wb123456', 'vord-wb123456-fh', 'prod-af1', 'var-af1-w-8', 'vendor-fashion-hub',
        'Nike Air Force 1 Men''s Sneakers', 'White / Size 8', 'WB-AF1-WHT-8',
        'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&auto=format&fit=crop&q=80',
        499900, 1, 499900
      )`,
    );

    await tx.query(
      `INSERT INTO payments (id, order_id, provider, status, amount_paisa, provider_reference, verified_at)
       VALUES ('pay-wb123456', 'ord-wb123456', 'ESEWA', 'CAPTURED', 499900, 'ESEWA-TXN-998123', NOW() - INTERVAL '2 hours')`,
    );

    await tx.query(
      `INSERT INTO commission_snapshots (id, vendor_order_id, vendor_id, rule_id, rate_bps, gross_amount_paisa, commission_paisa, net_vendor_paisa)
       VALUES ('cs-wb123456', 'vord-wb123456-fh', 'vendor-fashion-hub', 'vcr-fashion-hub', 1000, 499900, 49990, 449910)`,
    );

    await tx.query(
      `INSERT INTO shipments (
        id, vendor_order_id, carrier_name, tracking_number,
        delivery_partner_name, delivery_partner_phone, delivery_partner_avatar,
        status, estimated_delivery, dispatched_at
      ) VALUES (
        'ship-wb123456', 'vord-wb123456-fh', 'Birgunj Express Local', 'TRK-WB123456',
        'Rajesh Kumar', '+977 9812345678',
        'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=160&auto=format&fit=crop&q=80',
        'OUT_FOR_DELIVERY', 'Today, 2-4 Hours', NOW() - INTERVAL '45 minutes'
      )`,
    );

    await tx.query(
      `INSERT INTO tracking_events (id, shipment_id, status, title, description, location_text, event_time)
       VALUES
       ('te-1', 'ship-wb123456', 'ORDER_CONFIRMED', 'Order Confirmed', 'Payment verified via eSewa and sent to Fashion Hub Birgunj', 'Adarshnagar, Birgunj', NOW() - INTERVAL '110 minutes'),
       ('te-2', 'ship-wb123456', 'PREPARING_ORDER', 'Preparing Your Order', 'Quality check completed and packed at Fashion Hub Birgunj', 'Ward 10 Hub, Birgunj', NOW() - INTERVAL '95 minutes'),
       ('te-3', 'ship-wb123456', 'OUT_FOR_DELIVERY', 'Out for Delivery', 'Your order is on the way with Delivery Partner Rajesh Kumar!', 'Link Road -> Ward 10, Birgunj', NOW() - INTERVAL '40 minutes')`,
    );

    // Order 2: #WB123455 (Delivered - Rs. 2,499 - Eligible for Review & 36-Hour Exchange!)
    await tx.query(
      `INSERT INTO orders (
        id, order_number, customer_id, status, payment_method, payment_status,
        subtotal_paisa, discount_paisa, tax_paisa, shipping_paisa, total_paisa,
        shipping_name, shipping_phone, shipping_ward, shipping_address, shipping_landmark,
        delivery_instructions, estimated_delivery_text, created_at
      ) VALUES (
        'ord-wb123455', '#WB123455', 'user-customer-john', 'DELIVERED', 'KHALTI', 'PAID',
        249900, 0, 28750, 0, 249900,
        'John Doe', '+977 9801234567', 10, 'Ward 10, Birgunj', 'Near Main Road',
        'Call before delivery', 'Delivered in 2 Hours', NOW() - INTERVAL '18 hours'
      )`,
    );

    await tx.query(
      `INSERT INTO vendor_orders (
        id, order_id, vendor_id, vendor_order_number, status,
        subtotal_paisa, discount_paisa, tax_paisa, shipping_paisa, total_paisa,
        commission_rate_bps, commission_paisa, net_vendor_paisa, delivered_at, created_at
      ) VALUES (
        'vord-wb123455-fh', 'ord-wb123455', 'vendor-fashion-hub', '#WB123455-FH', 'DELIVERED',
        249900, 0, 28750, 0, 249900, 1000, 24990, 224910, NOW() - INTERVAL '15 hours', NOW() - INTERVAL '18 hours'
      )`,
    );

    await tx.query(
      `INSERT INTO order_items (
        id, order_id, vendor_order_id, product_id, variant_id, vendor_id,
        product_title_snapshot, variant_title_snapshot, sku_snapshot, image_url_snapshot,
        unit_price_paisa, quantity, line_total_paisa
      ) VALUES (
        'oitem-wb123455-1', 'ord-wb123455', 'vord-wb123455-fh', 'prod-watch', 'var-watch-blk', 'vendor-fashion-hub',
        'Classic Analog Watch', 'Black Dial / Brown Strap', 'WB-WTC-BLK-STD',
        'https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=800&auto=format&fit=crop&q=80',
        249900, 1, 249900
      )`,
    );

    await tx.query(
      `INSERT INTO payments (id, order_id, provider, status, amount_paisa, provider_reference, verified_at)
       VALUES ('pay-wb123455', 'ord-wb123455', 'KHALTI', 'CAPTURED', 249900, 'KHALTI-TXN-774120', NOW() - INTERVAL '18 hours')`,
    );

    await tx.query(
      `INSERT INTO commission_snapshots (id, vendor_order_id, vendor_id, rule_id, rate_bps, gross_amount_paisa, commission_paisa, net_vendor_paisa)
       VALUES ('cs-wb123455', 'vord-wb123455-fh', 'vendor-fashion-hub', 'vcr-fashion-hub', 1000, 249900, 24990, 224910)`,
    );

    // Order 3: #WB123454 (Cancelled - Rs. 3,999)
    await tx.query(
      `INSERT INTO orders (
        id, order_number, customer_id, status, payment_method, payment_status,
        subtotal_paisa, discount_paisa, tax_paisa, shipping_paisa, total_paisa,
        shipping_name, shipping_phone, shipping_ward, shipping_address, shipping_landmark,
        delivery_instructions, estimated_delivery_text, created_at
      ) VALUES (
        'ord-wb123454', '#WB123454', 'user-customer-john', 'CANCELLED', 'COD', 'FAILED',
        349900, 0, 40250, 0, 349900,
        'John Doe', '+977 9801234567', 10, 'Ward 10, Birgunj', 'Near Main Road',
        '', 'Cancelled by customer', NOW() - INTERVAL '3 days'
      )`,
    );

    await tx.query(
      `INSERT INTO vendor_orders (
        id, order_id, vendor_id, vendor_order_number, status,
        subtotal_paisa, discount_paisa, tax_paisa, shipping_paisa, total_paisa,
        commission_rate_bps, commission_paisa, net_vendor_paisa, cancelled_at, cancel_reason, created_at
      ) VALUES (
        'vord-wb123454-fh', 'ord-wb123454', 'vendor-fashion-hub', '#WB123454-FH', 'CANCELLED',
        349900, 0, 40250, 0, 349900, 1000, 34990, 314910, NOW() - INTERVAL '3 days', 'Changed size preference', NOW() - INTERVAL '3 days'
      )`,
    );

    // Order 4: #WB123453 (Delivered to Priya Singh & Aarav Sharma for verified-purchase reviews)
    await tx.query(
      `INSERT INTO orders (
        id, order_number, customer_id, status, payment_method, payment_status,
        subtotal_paisa, discount_paisa, tax_paisa, shipping_paisa, total_paisa,
        shipping_name, shipping_phone, shipping_ward, shipping_address, shipping_landmark,
        delivery_instructions, estimated_delivery_text, created_at
      ) VALUES (
        'ord-wb123453', '#WB123453', 'user-customer-priya', 'DELIVERED', 'ESEWA', 'PAID',
        749800, 0, 86260, 0, 749800,
        'Priya Singh', '+977 9841234567', 4, 'Ward 4, Ghantaghar, Birgunj', 'Opposite Clock Tower',
        '', 'Delivered', NOW() - INTERVAL '5 days'
      )`,
    );

    await tx.query(
      `INSERT INTO vendor_orders (
        id, order_id, vendor_id, vendor_order_number, status,
        subtotal_paisa, discount_paisa, tax_paisa, shipping_paisa, total_paisa,
        commission_rate_bps, commission_paisa, net_vendor_paisa, delivered_at, created_at
      ) VALUES
      ('vord-wb123453-fh', 'ord-wb123453', 'vendor-fashion-hub', '#WB123453-FH', 'DELIVERED',
       499900, 0, 57510, 0, 499900, 1000, 49990, 449910, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'),
      ('vord-wb123453-ns', 'ord-wb123453', 'vendor-narayani-style', '#WB123453-NS', 'DELIVERED',
       249900, 0, 28750, 0, 249900, 1000, 24990, 224910, NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days')`,
    );

    await tx.query(
      `INSERT INTO order_items (
        id, order_id, vendor_order_id, product_id, variant_id, vendor_id,
        product_title_snapshot, variant_title_snapshot, sku_snapshot, image_url_snapshot,
        unit_price_paisa, quantity, line_total_paisa
      ) VALUES
      ('oitem-wb123453-1', 'ord-wb123453', 'vord-wb123453-fh', 'prod-af1', 'var-af1-w-8', 'vendor-fashion-hub',
       'Nike Air Force 1 Men''s Sneakers', 'White / Size 8', 'WB-AF1-WHT-8',
       'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=800&auto=format&fit=crop&q=80',
       499900, 1, 499900),
      ('oitem-wb123453-2', 'ord-wb123453', 'vord-wb123453-ns', 'prod-kurti', 'var-kurti-m', 'vendor-narayani-style',
       'Embroidered Kurti', 'Ivory Gold / M', 'WB-KRT-IVR-M',
       'https://images.unsplash.com/photo-1583391733956-3750e0ff4e8b?w=800&auto=format&fit=crop&q=80',
       249900, 1, 249900)`,
    );

    // 9. Verified Purchase Reviews (Matching Screen #10)
    await tx.query(
      `INSERT INTO reviews (
        id, product_id, order_item_id, customer_id, vendor_id, rating, comment, media_urls_json, moderation_status, is_verified_purchase, created_at
      ) VALUES
      ('rev-1', 'prod-af1', 'oitem-wb123453-1', 'user-customer-priya', 'vendor-fashion-hub', 5,
       'Very comfortable and original product. Delivered within 3 hours in Birgunj Ward 4. Highly recommended!',
       '["https://images.unsplash.com/photo-1549298916-b41d501d3772?w=300&auto=format&fit=crop&q=80"]',
       'PUBLISHED', TRUE, NOW() - INTERVAL '4 days'),
      ('rev-2', 'prod-watch', 'oitem-wb123455-1', 'user-customer-john', 'vendor-fashion-hub', 5,
       'Excellent quality and fast delivery! Packaging from Fashion Hub Birgunj was top-notch.',
       '["https://images.unsplash.com/photo-1524592094714-0f0654e20314?w=300&auto=format&fit=crop&q=80"]',
       'PUBLISHED', TRUE, NOW() - INTERVAL '12 hours')`,
    );

    // 10. Immutable Vendor Ledger Entries & Payouts
    await tx.query(
      `INSERT INTO vendor_ledger_entries (id, vendor_id, vendor_order_id, entry_type, amount_paisa, balance_after_paisa, description)
       VALUES
       ('vle-1', 'vendor-fashion-hub', 'vord-wb123453-fh', 'CREDIT_SALE', 499900, 499900, 'Gross sale for Order #WB123453-FH'),
       ('vle-2', 'vendor-fashion-hub', 'vord-wb123453-fh', 'DEBIT_COMMISSION', -49990, 449910, '10% Platform Commission for #WB123453-FH'),
       ('vle-3', 'vendor-fashion-hub', 'vord-wb123455-fh', 'CREDIT_SALE', 249900, 699810, 'Gross sale for Order #WB123455-FH'),
       ('vle-4', 'vendor-fashion-hub', 'vord-wb123455-fh', 'DEBIT_COMMISSION', -24990, 674820, '10% Platform Commission for #WB123455-FH'),
       ('vle-5', 'vendor-narayani-style', 'vord-wb123453-ns', 'CREDIT_SALE', 249900, 249900, 'Gross sale for Order #WB123453-NS'),
       ('vle-6', 'vendor-narayani-style', 'vord-wb123453-ns', 'DEBIT_COMMISSION', -24990, 224910, '10% Platform Commission for #WB123453-NS')`,
    );

    // 11. Wishlist Items (Matching Screen #11)
    await tx.query(
      `INSERT INTO wishlist_items (id, customer_id, product_id)
       VALUES
       ('wish-1', 'user-customer-john', 'prod-af1'),
       ('wish-2', 'user-customer-john', 'prod-watch'),
       ('wish-3', 'user-customer-john', 'prod-handbag'),
       ('wish-4', 'user-customer-john', 'prod-sunglasses')`,
    );

    // 12. Initial Cart for John Doe (Matching Screen #4: 3 items totaling Rs. 9,497)
    await tx.query(
      `INSERT INTO carts (id, customer_id) VALUES ('cart-john', 'user-customer-john')`,
    );
    await tx.query(
      `INSERT INTO cart_items (id, cart_id, product_id, variant_id, quantity)
       VALUES
       ('citem-1', 'cart-john', 'prod-af1', 'var-af1-w-8', 1),
       ('citem-2', 'cart-john', 'prod-watch', 'var-watch-blk', 1),
       ('citem-3', 'cart-john', 'prod-sunglasses', 'var-sun-blk', 1)`,
    );

    // 13. Notifications & Audit Log
    await tx.query(
      `INSERT INTO notifications (id, user_id, title, body, type, link_url)
       VALUES
       ('notif-1', 'user-customer-john', 'Order #WB123456 is Out for Delivery!', 'Delivery Partner Rajesh Kumar (+977 9812345678) is on the way to Ward 10, Birgunj.', 'ORDER_UPDATE', '/orders/ord-wb123456/track'),
       ('notif-2', 'user-vendor-fashionhub', 'New Order #WB123456-FH Received', '1x Nike Air Force 1 (White / Size 8) paid via eSewa.', 'VENDOR_ORDER', '/vendor/orders')`,
    );

    await tx.query(
      `INSERT INTO audit_logs (id, actor_id, actor_role, vendor_id, action, target_type, target_id, reason, correlation_id)
       VALUES
       ('audit-seed-1', 'user-admin-main', 'PLATFORM_ADMIN', 'vendor-fashion-hub', 'VENDOR_APPROVED', 'VENDOR', 'vendor-fashion-hub', 'PAN and Birgunj Ward 10 business registration verified', 'seed-init-001'),
       ('audit-seed-2', 'user-admin-main', 'CATALOG_MODERATOR', 'vendor-fashion-hub', 'PRODUCT_APPROVED', 'PRODUCT', 'prod-af1', 'Authentic brand documentation verified', 'seed-init-002')`,
    );
  });
}
