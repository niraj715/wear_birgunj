-- ============================================================================
-- Wear Birgunj — Migration 0002: Return/Exchange Lifecycle, Product Media & Support Messages
-- ============================================================================

-- 1. ENHANCE RETURN REQUESTS WITH EXCHANGE AND EVIDENCE FIELDS
ALTER TABLE return_requests ADD COLUMN IF NOT EXISTS replacement_variant_id TEXT REFERENCES product_variants(id) ON DELETE SET NULL;
ALTER TABLE return_requests ADD COLUMN IF NOT EXISTS customer_explanation TEXT NOT NULL DEFAULT '';
ALTER TABLE return_requests ADD COLUMN IF NOT EXISTS evidence_urls_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE return_requests ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
ALTER TABLE return_requests ADD COLUMN IF NOT EXISTS pickup_address_text TEXT NOT NULL DEFAULT '';

-- Update return_requests status constraint to full state machine
ALTER TABLE return_requests DROP CONSTRAINT IF EXISTS return_requests_status_check;
ALTER TABLE return_requests ADD CONSTRAINT return_requests_status_check CHECK (status IN (
  'REQUESTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'AWAITING_CUSTOMER_ACTION',
  'PICKUP_OR_SHIPMENT_PENDING',
  'ITEM_RECEIVED',
  'EXCHANGE_PROCESSING',
  'REFUND_PROCESSING',
  'COMPLETED',
  'CANCELLED'
));

-- 2. ENHANCE PRODUCT MEDIA WITH PRIMARY FLAG, DIMENSIONS AND FORMAT
ALTER TABLE product_media ADD COLUMN IF NOT EXISTS is_primary BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE product_media ADD COLUMN IF NOT EXISTS width INT;
ALTER TABLE product_media ADD COLUMN IF NOT EXISTS height INT;
ALTER TABLE product_media ADD COLUMN IF NOT EXISTS format TEXT;

-- 3. SUPPORT MESSAGES TABLE FOR MULTI-TURN SUPPORT AND CHATBOT ESCALATIONS
CREATE TABLE IF NOT EXISTS support_messages (
  id TEXT PRIMARY KEY,
  case_id TEXT NOT NULL REFERENCES support_cases(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL CHECK (sender_role IN ('CUSTOMER', 'AGENT', 'AI_BOT', 'SYSTEM')),
  sender_id TEXT,
  message_text TEXT NOT NULL,
  is_internal BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_support_messages_case
  ON support_messages (case_id, created_at ASC);
