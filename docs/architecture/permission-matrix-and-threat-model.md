# Wear Birgunj — Permission Matrix, Tenant Isolation & Threat Model

## 1. Roles & Least-Privilege Permission Matrix

| Permission Code | Guest | Customer | Vendor Owner | Vendor Staff | Catalog Moderator | Finance Operator | Support Agent | Platform Admin | Super-Admin |
|---|---|---|---|---|---|---|---|---|---|
| `catalog:read_public` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `customer:profile_manage` | ❌ | ✅ Own | ✅ Own | ✅ Own | ✅ Own | ✅ Own | ✅ Own | ✅ Own | ✅ Own |
| `customer:cart_checkout` | ❌ | ✅ Own | ✅ Own | ✅ Own | ❌ | ❌ | ❌ | ❌ | ❌ |
| `customer:order_read` | ❌ | ✅ Own | ✅ Own | ✅ Own | ❌ | ❌ | ✅ Scoped | ✅ All | ✅ All |
| `customer:review_write` | ❌ | ✅ Verified | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `customer:return_request` | ❌ | ✅ Own | ❌ | ❌ | ❌ | ❌ | ✅ Scoped | ✅ All | ✅ All |
| `vendor:apply` | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `vendor:store_manage` | ❌ | ❌ | ✅ Own Vendor | ❌ | ❌ | ❌ | ❌ | ✅ Audited | ✅ Audited |
| `vendor:product_manage` | ❌ | ❌ | ✅ Own Vendor | ✅ Scoped | ❌ | ❌ | ❌ | ✅ Audited | ✅ Audited |
| `vendor:inventory_manage` | ❌ | ❌ | ✅ Own Vendor | ✅ Scoped | ❌ | ❌ | ❌ | ✅ Audited | ✅ Audited |
| `vendor:order_fulfill` | ❌ | ❌ | ✅ Own Vendor | ✅ Scoped | ❌ | ❌ | ❌ | ✅ Audited | ✅ Audited |
| `vendor:finance_read` | ❌ | ❌ | ✅ Own Vendor | ❌ | ❌ | ✅ All | ❌ | ✅ All | ✅ All |
| `vendor:payout_request` | ❌ | ❌ | ✅ Own + MFA | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `admin:vendor_moderate` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Audited | ✅ Audited |
| `admin:product_moderate` | ❌ | ❌ | ❌ | ❌ | ✅ Audited | ❌ | ❌ | ✅ Audited | ✅ Audited |
| `admin:finance_manage` | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ + Step-Up | ❌ | ✅ + Step-Up | ✅ + Step-Up |
| `admin:audit_read` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| `admin:roles_manage` | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ + Step-Up |

---

## 2. Server-Side Tenant Isolation Enforcement
1. **Vendor Resolution**: No `/api/v1/vendor/*` endpoint accepts `vendorId` from the client to establish ownership. The `VendorContextGuard` queries `vendor_memberships WHERE user_id = :authenticatedUserId AND status = 'ACTIVE'` and attaches `request.vendorContext = { vendorId, membershipRole, permissions }`.
2. **Scoped Data Access**: Every repository method for vendor resources requires `vendorId` as a mandatory parameter (`WHERE id = $1 AND vendor_id = $2`). If a vendor passes another vendor's product ID, order ID, or payout ID, the query returns 0 rows (`404 Not Found`) and records an `IDOR_ATTEMPT` security event when appropriate.
3. **Customer Data Minimization**: Vendor order responses include only the customer's shipping recipient name, phone number, Birgunj ward/landmark, and delivery instructions needed to fulfill that specific `VendorOrder`. Customer email, account metadata, other vendor sub-orders, and payment instrument details are never exposed to vendors.

---

## 3. OWASP ASVS / Top 10 Threat Model

| OWASP Category | Threat Vector | Control Implemented |
|---|---|---|
| **A01: Broken Access Control (IDOR / Cross-Tenant)** | Vendor A attempts to view/update Vendor B's products, orders, inventory, or ledger; Customer A attempts to view Customer B's order `#WB123456`. | Server-derived `userId` and `vendorId` predicates on all SQL queries; integration tests explicitly verify cross-vendor and cross-customer access denial. |
| **A02: Cryptographic Failures** | Plaintext/weak password storage; forged webhook calls; predictable reset tokens. | Argon2id password hashing; SHA-256 hashed session & reset tokens; HMAC-SHA256 webhook signature verification against raw payload. |
| **A03: Injection (SQLi / XSS)** | Malicious SQL in search/filters; stored XSS in product descriptions or customer reviews. | Parameterized SQL queries throughout; strict server-side input sanitization (`sanitizeText`) stripping `<script>`, event handlers, and dangerous HTML. |
| **A04: Insecure Design (Price Tampering & Overselling)** | Attacker modifies unit price, coupon discount, or shipping fee in checkout payload; concurrent buyers oversell stock. | Checkout payload only specifies `address` + `paymentMethod` + `couponCode` (or cart items by `variantId` + `quantity`); server recalculates all prices/discounts/shipping in integer `paisa` and executes atomic `available_qty >= $qty` stock reservation in a transaction. |
| **A05: Security Misconfiguration** | Verbose stack traces leaked to client; permissive CORS; missing security headers. | Global exception filter returns standardized `{ error: { code, message, requestId, details } }`; Helmet headers, strict CORS allow-list, and correlation ID logging. |
| **A07: Identification & Authentication Failures** | Brute-force login; session fixation; unverified privilege elevation. | Rate limiting on `/api/v1/auth/*`; token revocation on logout/password reset; step-up verification for payout destination and high-value finance actions. |
| **A08: Software & Data Integrity Failures** | Replay of payment webhooks or double-submission of checkout requests. | `idempotency_keys` table enforcing `(actor_id, operation, idempotency_key)` uniqueness; `webhook_inbox` enforcing `UNIQUE(provider, provider_event_id)`. |
| **A09: Security Logging & Monitoring Failures** | Unaudited product approvals, vendor suspensions, refunds, or payout approvals. | Append-only `audit_logs` and `product_moderation_events` recording `actor_id`, `action`, `target_id`, `reason`, and `correlation_id`. |
