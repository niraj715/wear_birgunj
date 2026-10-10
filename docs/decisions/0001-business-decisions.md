# ADR-0001: Approved Business & Policy Decisions — Wear Birgunj

**Status:** Approved  
**Date:** 2026-10-10  
**Scope:** Platform-wide business, financial, fulfillment, moderation, and compliance rules for Wear Birgunj.

---

## 1. Launch Region, Legal Entity, Currency & Money Representation (`BD-01`)
- **Primary Market:** Birgunj Metropolitan City (Wards 1–32), Parsa District, Madhesh Province, Nepal.
- **Currency:** Nepalese Rupee (`NPR`, symbol `Rs.`).
- **Monetary Representation:** All prices, fees, taxes, discounts, commissions, ledger entries, and payouts are stored in the database as **integer minor units (`paisa`, where `1 NPR = 100 paisa`)** alongside an explicit 3-letter ISO currency code (`'NPR'`). Binary floating-point is strictly prohibited for monetary calculations.
- **Locale & Formatting:** Display format uses `Rs. X,XXX` (Nepali/South Asian numbering system, e.g., `Rs. 1,25,000` or `Rs. 4,999`). Timestamps are stored in UTC (`TIMESTAMPTZ`) and formatted in Nepal Time (`Asia/Kathmandu`, `UTC+05:45`) at the UI boundary.

## 2. Tax & Invoice Rules (`BD-02`)
- **VAT Treatment:** Catalog prices displayed to customers are VAT-inclusive where applicable. Orders snapshot the calculated tax breakdown (default **13% Nepal VAT** or `0%` for exempt items) on `order_items` and `vendor_orders`.
- **Vendor Tax Identification:** Vendors must submit a valid PAN or VAT registration number during onboarding before approval.

## 3. Payment Providers, Capture Model & COD (`BD-03`)
- **Supported Methods:**
  1. **eSewa** (Redirect/tokenized initiation + signed server-to-server webhook/verification).
  2. **Khalti** (Tokenized initiation + HMAC/signature-verified webhook confirmation).
  3. **Cash on Delivery (COD)** (Available for eligible Birgunj ward deliveries up to `Rs. 25,000` per order).
- **Verification Invariant:** Browser redirects never mark an order as paid. Only verified provider webhooks or authenticated server-side verification calls transition a payment to `CAPTURED` (`PAID`). COD payments remain `PENDING_COD` until delivery partner settlement is recorded.

## 4. Shipping, Service Zones, SLAs & Delivery Partners (`BD-04`)
- **Service Zones:** Birgunj Metropolitan City Wards 1–32 (e.g., Ward 10 Adarshnagar, Ghantaghar, Maisthan, Bypass Road, Chhapakaiya, Raniighat).
- **Delivery SLA:** **2–4 Hours Fast Delivery** within Birgunj for in-stock items ordered during operating hours (08:00–20:00 NPT).
- **Delivery Fee Policy:** Free delivery (`0 paisa`) on orders with subtotal $\ge$ `Rs. 1,999` (`199900 paisa`); standard `Rs. 100` (`10000 paisa`) delivery fee for orders below `Rs. 1,999`.
- **Tracking & Delivery Partner Assignment:** Each `VendorOrder` shipment supports assigning a verified local **Delivery Partner** (name, phone number, vehicle/route metadata) and recording discrete scan events (`ORDER_CONFIRMED`, `PREPARING_ORDER`, `OUT_FOR_DELIVERY`, `DELIVERED`, `DELIVERY_EXCEPTION`).

## 5. Multi-Vendor Checkout & Order Splitting (`BD-05`)
- **Unified Customer Checkout:** Customers check out once per cart, generating a single parent `Order` with a human-readable public reference (`#WBxxxxxx`).
- **Vendor Fulfillment Isolation:** The server partitions cart items by `vendor_id` into distinct `VendorOrder` records. Each vendor sees **only** its own `VendorOrder`, line items, and the minimum customer delivery details required for fulfillment.

## 6. Vendor Commissions, Immutable Ledger & Payouts (`BD-06`)
- **Commission Rate:** Default **10% (`1000 basis points`)** platform commission on gross item value (configurable per vendor or category in `vendor_commission_rules`).
- **Purchase-Time Snapshot:** Every `OrderItem` and `VendorOrder` records an immutable `commission_snapshots` row capturing the exact rule ID, rate bps, commission paisa, and net vendor earnings paisa at checkout time.
- **Ledger & Payouts:** `vendor_ledger_entries` is an append-only ledger (`CREDIT` for delivered orders, `DEBIT` for commissions, refunds, and payouts). Corrections require compensating entries. Payouts require Finance/Admin approval with step-up authentication.

## 7. Vendor KYC & Verification (`BD-07`)
- Vendors apply in `PENDING_VERIFICATION` state and submit PAN/VAT details, business registration, and payout destination details.
- Private KYC object keys are stored in `vendor_verifications` and are never exposed via public URLs.
- Only `APPROVED` vendors can have their products listed on the public storefront.

## 8. Product Moderation Policy (`BD-08`)
- New products default to `PENDING_APPROVAL` (or `DRAFT` if saved as draft).
- Only products with `moderation_status = 'ACTIVE'` belonging to vendors with `approval_status = 'APPROVED'` appear in public catalog, search, category, brand, and recommendation endpoints.
- Vendor edits to title, description, category, or media on an `ACTIVE` product automatically transition `moderation_status` back to `PENDING_APPROVAL` and log a `product_moderation_events` entry.

## 9. Cancellation, Exchange & Return Policy (`BD-09`)
- **Cancellation:** Customers may cancel a `VendorOrder` while its status is `NEW` or `PROCESSING` (prior to `OUT_FOR_DELIVERY`). Stock reservations are atomically released upon cancellation.
- **Exchange & Return Window:** Customers may submit a return or exchange request within **36 hours** of the `DELIVERED` timestamp (`delivered_at + 36 hours`). Refund amounts are calculated strictly on the server from the original `order_items` snapshot.

## 10. Verified-Purchase Review Policy (`BD-10`)
- Only authenticated customers with a `DELIVERED` `OrderItem` for the target product may submit a review.
- Enforced by database constraint `UNIQUE(customer_id, order_item_id)` and `CHECK (rating BETWEEN 1 AND 5)`.
- Aggregate product ratings (`avg_rating`, `review_count`) are computed server-side from `PUBLISHED` reviews only.

## 11. Data Retention, Privacy & RPO/RTO (`BD-11`)
- **Financial & Order Records:** Retained for 7 years per Nepal statutory tax/accounting requirements; protected against `ON DELETE CASCADE`.
- **Session & Verification Tokens:** Expired/revoked tokens purged after 30 days.
- **Account Deletion:** Anonymizes personal profile PII while preserving immutable financial/order invoice snapshots.
- **RPO / RTO Targets:** RPO $\le 15\text{ minutes}$ (continuous WAL + automated snapshots), RTO $\le 60\text{ minutes}$.
