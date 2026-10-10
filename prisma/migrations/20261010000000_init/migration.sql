-- ============================================================================
-- Wear Birgunj — Migration 0001: Complete PostgreSQL 16 Relational Schema
-- Workstream 1: Identity, Vendors, Catalog, Inventory, Orders, Payments,
-- Shipments, Reviews, Returns, Finance Ledger, Webhooks, Idempotency & Audit
-- ============================================================================

-- 1. IDENTITY & ACCESS
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  full_name TEXT NOT NULL,
  avatar_url TEXT,
  password_hash TEXT NOT NULL,
  mfa_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'SUSPENDED', 'DELETED')),
  email_verified_at TIMESTAMPTZ,
  marketing_consent BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS permissions (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS user_role_assignments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  assigned_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, role_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  csrf_token TEXT NOT NULL,
  ip_address TEXT,
  user_agent TEXT,
  step_up_verified_until TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL CHECK (purpose IN ('EMAIL_VERIFY', 'PASSWORD_RESET', 'STEP_UP_MFA')),
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS addresses (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL DEFAULT 'Home',
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  ward_number INT NOT NULL DEFAULT 10 CHECK (ward_number BETWEEN 1 AND 32),
  street_address TEXT NOT NULL,
  landmark TEXT NOT NULL DEFAULT '',
  city TEXT NOT NULL DEFAULT 'Birgunj',
  delivery_instructions TEXT NOT NULL DEFAULT '',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. VENDORS, MEMBERSHIPS, KYC & FINANCE RULES
CREATE TABLE IF NOT EXISTS vendors (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  business_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  logo_url TEXT,
  banner_url TEXT,
  pan_vat_number TEXT,
  contact_email TEXT NOT NULL,
  contact_phone TEXT NOT NULL,
  ward_number INT NOT NULL DEFAULT 10 CHECK (ward_number BETWEEN 1 AND 32),
  address_text TEXT NOT NULL,
  return_policy TEXT NOT NULL DEFAULT 'Easy Exchange within 36 hours of delivery in Birgunj.',
  shipping_policy TEXT NOT NULL DEFAULT 'Fast Delivery within 2-4 hours across Birgunj Wards 1-32.',
  approval_status TEXT NOT NULL DEFAULT 'PENDING_VERIFICATION' CHECK (approval_status IN ('PENDING_VERIFICATION', 'APPROVED', 'REJECTED', 'SUSPENDED')),
  rejection_reason TEXT,
  rating_avg NUMERIC(3,2) NOT NULL DEFAULT 4.80 CHECK (rating_avg >= 0 AND rating_avg <= 5),
  rating_count INT NOT NULL DEFAULT 0 CHECK (rating_count >= 0),
  payout_method TEXT NOT NULL DEFAULT 'ESEWA' CHECK (payout_method IN ('ESEWA', 'KHALTI', 'BANK_TRANSFER')),
  payout_account_ref TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendor_memberships (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  role TEXT NOT NULL DEFAULT 'OWNER' CHECK (role IN ('OWNER', 'STAFF')),
  permissions_json TEXT NOT NULL DEFAULT '["*"]',
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, vendor_id)
);

CREATE TABLE IF NOT EXISTS vendor_verifications (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  document_type TEXT NOT NULL CHECK (document_type IN ('PAN_VAT_CERT', 'COMPANY_REG', 'CITIZENSHIP_ID')),
  private_object_key TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'VERIFIED', 'REJECTED')),
  reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendor_commission_rules (
  id TEXT PRIMARY KEY,
  vendor_id TEXT REFERENCES vendors(id) ON DELETE RESTRICT,
  category_id TEXT,
  rate_bps INT NOT NULL DEFAULT 1000 CHECK (rate_bps >= 0 AND rate_bps <= 5000),
  fixed_fee_paisa INT NOT NULL DEFAULT 0 CHECK (fixed_fee_paisa >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  effective_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. CATALOG, CATEGORIES, BRANDS, VARIANTS, MEDIA, MODERATION & INVENTORY
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL,
  parent_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS brands (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  logo_url TEXT,
  is_local_brand BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  brand_id TEXT REFERENCES brands(id) ON DELETE SET NULL,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  specifications_json TEXT NOT NULL DEFAULT '{}',
  moderation_status TEXT NOT NULL DEFAULT 'PENDING_APPROVAL' CHECK (moderation_status IN ('DRAFT', 'PENDING_APPROVAL', 'ACTIVE', 'REJECTED', 'SUSPENDED')),
  rejection_reason TEXT,
  base_price_paisa INT NOT NULL CHECK (base_price_paisa >= 0),
  compare_at_price_paisa INT CHECK (compare_at_price_paisa IS NULL OR compare_at_price_paisa >= 0),
  currency TEXT NOT NULL DEFAULT 'NPR',
  is_featured BOOLEAN NOT NULL DEFAULT FALSE,
  is_new BOOLEAN NOT NULL DEFAULT TRUE,
  rating_avg NUMERIC(3,2) NOT NULL DEFAULT 0.00 CHECK (rating_avg >= 0 AND rating_avg <= 5),
  review_count INT NOT NULL DEFAULT 0 CHECK (review_count >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_variants (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  sku TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  size_value TEXT NOT NULL DEFAULT 'Standard',
  color_name TEXT NOT NULL DEFAULT 'Default',
  color_hex TEXT NOT NULL DEFAULT '#111827',
  price_paisa INT NOT NULL CHECK (price_paisa >= 0),
  compare_at_price_paisa INT CHECK (compare_at_price_paisa IS NULL OR compare_at_price_paisa >= 0),
  currency TEXT NOT NULL DEFAULT 'NPR',
  weight_grams INT NOT NULL DEFAULT 350 CHECK (weight_grams > 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'INACTIVE')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_media (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  object_key TEXT NOT NULL,
  alt_text TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  moderation_status TEXT NOT NULL DEFAULT 'APPROVED' CHECK (moderation_status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_moderation_events (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  from_status TEXT NOT NULL,
  to_status TEXT NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_items (
  id TEXT PRIMARY KEY,
  variant_id TEXT NOT NULL UNIQUE REFERENCES product_variants(id) ON DELETE CASCADE,
  vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  available_qty INT NOT NULL DEFAULT 0 CHECK (available_qty >= 0),
  reserved_qty INT NOT NULL DEFAULT 0 CHECK (reserved_qty >= 0),
  low_stock_threshold INT NOT NULL DEFAULT 5 CHECK (low_stock_threshold >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_reservations (
  id TEXT PRIMARY KEY,
  inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  order_id TEXT,
  customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  quantity INT NOT NULL CHECK (quantity > 0),
  status TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'CONFIRMED', 'RELEASED', 'EXPIRED')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_adjustments (
  id TEXT PRIMARY KEY,
  inventory_item_id TEXT NOT NULL REFERENCES inventory_items(id) ON DELETE RESTRICT,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  delta_qty INT NOT NULL,
  previous_qty INT NOT NULL,
  new_qty INT NOT NULL CHECK (new_qty >= 0),
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. CART, COUPONS, ORDERS, VENDOR SUB-ORDERS, PAYMENTS, SHIPMENTS & RETURNS
CREATE TABLE IF NOT EXISTS coupons (
  id TEXT PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL,
  discount_type TEXT NOT NULL CHECK (discount_type IN ('PERCENTAGE', 'FIXED_PAISA')),
  discount_value INT NOT NULL CHECK (discount_value > 0),
  min_order_paisa INT NOT NULL DEFAULT 0 CHECK (min_order_paisa >= 0),
  max_discount_paisa INT CHECK (max_discount_paisa IS NULL OR max_discount_paisa > 0),
  usage_limit INT CHECK (usage_limit IS NULL OR usage_limit > 0),
  used_count INT NOT NULL DEFAULT 0 CHECK (used_count >= 0),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS carts (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  coupon_code TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cart_items (
  id TEXT PRIMARY KEY,
  cart_id TEXT NOT NULL REFERENCES carts(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE CASCADE,
  quantity INT NOT NULL CHECK (quantity > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (cart_id, variant_id)
);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURNED')),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('ESEWA', 'KHALTI', 'COD')),
  payment_status TEXT NOT NULL DEFAULT 'PENDING' CHECK (payment_status IN ('PENDING', 'PAID', 'PENDING_COD', 'FAILED', 'REFUNDED')),
  subtotal_paisa INT NOT NULL CHECK (subtotal_paisa >= 0),
  discount_paisa INT NOT NULL DEFAULT 0 CHECK (discount_paisa >= 0),
  tax_paisa INT NOT NULL DEFAULT 0 CHECK (tax_paisa >= 0),
  shipping_paisa INT NOT NULL DEFAULT 0 CHECK (shipping_paisa >= 0),
  total_paisa INT NOT NULL CHECK (total_paisa >= 0),
  currency TEXT NOT NULL DEFAULT 'NPR',
  coupon_code TEXT,
  shipping_name TEXT NOT NULL,
  shipping_phone TEXT NOT NULL,
  shipping_ward INT NOT NULL DEFAULT 10 CHECK (shipping_ward BETWEEN 1 AND 32),
  shipping_address TEXT NOT NULL,
  shipping_landmark TEXT NOT NULL DEFAULT '',
  delivery_instructions TEXT NOT NULL DEFAULT '',
  estimated_delivery_text TEXT NOT NULL DEFAULT 'Today, 2-4 Hours',
  idempotency_key TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendor_orders (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  vendor_order_number TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'NEW' CHECK (status IN ('NEW', 'PROCESSING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'RETURNED')),
  subtotal_paisa INT NOT NULL CHECK (subtotal_paisa >= 0),
  discount_paisa INT NOT NULL DEFAULT 0 CHECK (discount_paisa >= 0),
  tax_paisa INT NOT NULL DEFAULT 0 CHECK (tax_paisa >= 0),
  shipping_paisa INT NOT NULL DEFAULT 0 CHECK (shipping_paisa >= 0),
  total_paisa INT NOT NULL CHECK (total_paisa >= 0),
  commission_rate_bps INT NOT NULL DEFAULT 1000 CHECK (commission_rate_bps >= 0 AND commission_rate_bps <= 5000),
  commission_paisa INT NOT NULL DEFAULT 0 CHECK (commission_paisa >= 0),
  net_vendor_paisa INT NOT NULL DEFAULT 0 CHECK (net_vendor_paisa >= 0),
  currency TEXT NOT NULL DEFAULT 'NPR',
  delivered_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  vendor_order_id TEXT NOT NULL REFERENCES vendor_orders(id) ON DELETE RESTRICT,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  variant_id TEXT NOT NULL REFERENCES product_variants(id) ON DELETE RESTRICT,
  vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  product_title_snapshot TEXT NOT NULL,
  variant_title_snapshot TEXT NOT NULL,
  sku_snapshot TEXT NOT NULL,
  image_url_snapshot TEXT NOT NULL,
  unit_price_paisa INT NOT NULL CHECK (unit_price_paisa >= 0),
  quantity INT NOT NULL CHECK (quantity > 0),
  line_total_paisa INT NOT NULL CHECK (line_total_paisa >= 0),
  currency TEXT NOT NULL DEFAULT 'NPR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_status_events (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  vendor_order_id TEXT REFERENCES vendor_orders(id) ON DELETE RESTRICT,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  actor_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  provider TEXT NOT NULL CHECK (provider IN ('ESEWA', 'KHALTI', 'COD')),
  status TEXT NOT NULL DEFAULT 'INITIATED' CHECK (status IN ('INITIATED', 'CAPTURED', 'PENDING_COD', 'FAILED', 'REFUNDED')),
  amount_paisa INT NOT NULL CHECK (amount_paisa >= 0),
  currency TEXT NOT NULL DEFAULT 'NPR',
  provider_reference TEXT,
  verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_transactions (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  attempt_number INT NOT NULL DEFAULT 1,
  status TEXT NOT NULL,
  provider_payload_summary TEXT NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS refunds (
  id TEXT PRIMARY KEY,
  payment_id TEXT NOT NULL REFERENCES payments(id) ON DELETE RESTRICT,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  vendor_order_id TEXT REFERENCES vendor_orders(id) ON DELETE RESTRICT,
  return_request_id TEXT,
  amount_paisa INT NOT NULL CHECK (amount_paisa > 0),
  currency TEXT NOT NULL DEFAULT 'NPR',
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED')),
  processed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shipments (
  id TEXT PRIMARY KEY,
  vendor_order_id TEXT NOT NULL UNIQUE REFERENCES vendor_orders(id) ON DELETE RESTRICT,
  carrier_name TEXT NOT NULL DEFAULT 'Birgunj Express Local',
  tracking_number TEXT NOT NULL UNIQUE,
  delivery_partner_name TEXT NOT NULL DEFAULT 'Rajesh Kumar',
  delivery_partner_phone TEXT NOT NULL DEFAULT '+977 9812345678',
  delivery_partner_avatar TEXT,
  status TEXT NOT NULL DEFAULT 'PREPARING' CHECK (status IN ('PREPARING', 'OUT_FOR_DELIVERY', 'DELIVERED', 'EXCEPTION')),
  estimated_delivery TEXT NOT NULL DEFAULT 'Today, 2-4 Hours',
  dispatched_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tracking_events (
  id TEXT PRIMARY KEY,
  shipment_id TEXT NOT NULL REFERENCES shipments(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location_text TEXT NOT NULL DEFAULT 'Birgunj Hub',
  event_time TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS return_requests (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  vendor_order_id TEXT NOT NULL REFERENCES vendor_orders(id) ON DELETE RESTRICT,
  order_item_id TEXT NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  request_type TEXT NOT NULL CHECK (request_type IN ('RETURN', 'EXCHANGE')),
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'APPROVED', 'REJECTED', 'COMPLETED')),
  refund_amount_paisa INT NOT NULL CHECK (refund_amount_paisa >= 0),
  currency TEXT NOT NULL DEFAULT 'NPR',
  resolution_notes TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS commission_snapshots (
  id TEXT PRIMARY KEY,
  vendor_order_id TEXT NOT NULL UNIQUE REFERENCES vendor_orders(id) ON DELETE RESTRICT,
  vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  rule_id TEXT,
  rate_bps INT NOT NULL CHECK (rate_bps >= 0 AND rate_bps <= 5000),
  gross_amount_paisa INT NOT NULL CHECK (gross_amount_paisa >= 0),
  commission_paisa INT NOT NULL CHECK (commission_paisa >= 0),
  net_vendor_paisa INT NOT NULL CHECK (net_vendor_paisa >= 0),
  currency TEXT NOT NULL DEFAULT 'NPR',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendor_ledger_entries (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  vendor_order_id TEXT REFERENCES vendor_orders(id) ON DELETE RESTRICT,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('CREDIT_SALE', 'DEBIT_COMMISSION', 'DEBIT_REFUND', 'DEBIT_PAYOUT', 'ADJUSTMENT')),
  amount_paisa INT NOT NULL,
  balance_after_paisa INT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'NPR',
  description TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS vendor_payouts (
  id TEXT PRIMARY KEY,
  vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  amount_paisa INT NOT NULL CHECK (amount_paisa > 0),
  currency TEXT NOT NULL DEFAULT 'NPR',
  status TEXT NOT NULL DEFAULT 'REQUESTED' CHECK (status IN ('REQUESTED', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'REJECTED')),
  destination_snapshot TEXT NOT NULL,
  provider_ref TEXT,
  approved_by TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. CUSTOMER TRUST, REVIEWS, WISHLIST, SUPPORT, WEBHOOK INBOX, IDEMPOTENCY & AUDIT
CREATE TABLE IF NOT EXISTS wishlist_items (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, product_id)
);

CREATE TABLE IF NOT EXISTS reviews (
  id TEXT PRIMARY KEY,
  product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  order_item_id TEXT NOT NULL REFERENCES order_items(id) ON DELETE RESTRICT,
  customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment TEXT NOT NULL,
  media_urls_json TEXT NOT NULL DEFAULT '[]',
  moderation_status TEXT NOT NULL DEFAULT 'PUBLISHED' CHECK (moderation_status IN ('PUBLISHED', 'PENDING', 'HIDDEN', 'REJECTED')),
  is_verified_purchase BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (customer_id, order_item_id)
);

CREATE TABLE IF NOT EXISTS vendor_review_responses (
  id TEXT PRIMARY KEY,
  review_id TEXT NOT NULL UNIQUE REFERENCES reviews(id) ON DELETE CASCADE,
  vendor_id TEXT NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,
  actor_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  response_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_cases (
  id TEXT PRIMARY KEY,
  case_number TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  order_id TEXT REFERENCES orders(id) ON DELETE SET NULL,
  subject TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'ORDER_ISSUE',
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED')),
  priority TEXT NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('LOW', 'MEDIUM', 'HIGH', 'URGENT')),
  assigned_to TEXT,
  internal_notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'ORDER_UPDATE',
  link_url TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_inbox (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL,
  provider_event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  signature_valid BOOLEAN NOT NULL,
  payload_json TEXT NOT NULL,
  processing_status TEXT NOT NULL DEFAULT 'RECEIVED' CHECK (processing_status IN ('RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED')),
  attempts INT NOT NULL DEFAULT 1,
  error_message TEXT,
  processed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (provider, provider_event_id)
);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id TEXT PRIMARY KEY,
  actor_id TEXT NOT NULL,
  operation TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_hash TEXT NOT NULL,
  response_status INT NOT NULL,
  response_body_json TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (actor_id, operation, idempotency_key)
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_id TEXT,
  actor_role TEXT NOT NULL,
  vendor_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT NOT NULL,
  reason TEXT,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  correlation_id TEXT NOT NULL,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. COMPOSITE INDEXES (Section 8 Requirements)
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_products_vendor_mod_updated
  ON products (vendor_id, moderation_status, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_products_public_catalog
  ON products (moderation_status, category_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vendor_orders_vendor_state
  ON vendor_orders (vendor_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_orders_customer_created
  ON orders (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stock_reservations_item_state
  ON stock_reservations (inventory_item_id, status, expires_at);

CREATE INDEX IF NOT EXISTS idx_webhook_inbox_state_received
  ON webhook_inbox (processing_status, created_at);

CREATE INDEX IF NOT EXISTS idx_vendor_ledger_vendor_created
  ON vendor_ledger_entries (vendor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_vendor_payouts_vendor_state
  ON vendor_payouts (vendor_id, status, created_at DESC);

-- ============================================================================
-- 7. IMMUTABILITY TRIGGERS FOR FINANCIAL LEDGER & AUDIT LOGS
-- ============================================================================
CREATE OR REPLACE FUNCTION prevent_immutable_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Modification or deletion of immutable table % is prohibited. Use compensating entries.', TG_TABLE_NAME;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_vendor_ledger ON vendor_ledger_entries;
CREATE TRIGGER trg_immutable_vendor_ledger
BEFORE UPDATE OR DELETE ON vendor_ledger_entries
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_modification();

DROP TRIGGER IF EXISTS trg_immutable_audit_logs ON audit_logs;
CREATE TRIGGER trg_immutable_audit_logs
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_immutable_modification();
