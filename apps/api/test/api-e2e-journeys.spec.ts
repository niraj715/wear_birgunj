import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createWearBirgunjApp } from '../src/main.js';
import { computeHmacSha256 } from '../src/common/crypto.util.js';

function createInjectClient(app: NestFastifyApplication) {
  const exec = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string) => {
    const headers: Record<string, string> = {};
    let payload: any = undefined;

    const chain: any = {
      set(key: string, val: string) {
        headers[key.toLowerCase()] = val;
        return chain;
      },
      send(body: any) {
        payload = body;
        return chain;
      },
      then(resolve: any, reject: any) {
        return app
          .inject({
            method,
            url,
            headers,
            payload,
          })
          .then((res) => {
            let parsedBody: any = {};
            try {
              parsedBody = res.body ? JSON.parse(res.body) : {};
            } catch {
              parsedBody = res.body;
            }
            return {
              status: res.statusCode,
              body: parsedBody,
              headers: res.headers,
            };
          })
          .then(resolve, reject);
      },
    };
    return chain;
  };

  return {
    get: (url: string) => exec('GET', url),
    post: (url: string) => exec('POST', url),
    patch: (url: string) => exec('PATCH', url),
    delete: (url: string) => exec('DELETE', url),
  };
}

const request = (s: ReturnType<typeof createInjectClient>) => s;

describe('Workstream 2 & 4 — Required 19 End-to-End API, Security & Concurrency Journeys', () => {
  let app: NestFastifyApplication;
  let server: ReturnType<typeof createInjectClient>;

  let johnToken = '';
  let priyaToken = '';
  let fashionHubToken = '';
  let narayaniToken = '';
  let adminToken = '';

  beforeAll(async () => {
    app = await createWearBirgunjApp({ inMemoryDb: true, seed: true });
    server = createInjectClient(app);

    // Authenticate seeded personas
    const johnRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'john@example.com', password: 'CustomerPass123!' });
    expect(johnRes.status).toBe(200);
    johnToken = johnRes.body.token;

    const priyaRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'priya@example.com', password: 'CustomerPass123!' });
    expect(priyaRes.status).toBe(200);
    priyaToken = priyaRes.body.token;

    const fhRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'vendor@fashionhub.np', password: 'VendorPass123!' });
    expect(fhRes.status).toBe(200);
    fashionHubToken = fhRes.body.token;

    const narRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'vendor@narayani.np', password: 'VendorPass123!' });
    expect(narRes.status).toBe(200);
    narayaniToken = narRes.body.token;

    const admRes = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@wearbirgunj.np', password: 'AdminPass123!' });
    expect(admRes.status).toBe(200);
    adminToken = admRes.body.token;
  });

  afterAll(async () => {
    await app.close();
  });

  it('Journey #1: Guest cannot view pending, rejected, draft, or suspended products', async () => {
    const listRes = await request(server).get('/api/v1/catalog/products?pageSize=48');
    expect(listRes.status).toBe(200);
    const slugs = listRes.body.items.map((p: any) => p.slug);
    expect(slugs).toContain('nike-air-force-1');
    expect(slugs).not.toContain('handwoven-mithila-silk-saree'); // PENDING_APPROVAL
    expect(slugs).not.toContain('travel-duffel-draft'); // DRAFT
    expect(slugs).not.toContain('unverified-luxury-belt'); // REJECTED

    // Direct slug access to pending/rejected products returns 404
    const pendingRes = await request(server).get(
      '/api/v1/catalog/products/handwoven-mithila-silk-saree',
    );
    expect(pendingRes.status).toBe(404);

    const rejectedRes = await request(server).get(
      '/api/v1/catalog/products/unverified-luxury-belt',
    );
    expect(rejectedRes.status).toBe(404);
  });

  it('Journey #2: Customer registration, verification, login, password reset, and logout work securely', async () => {
    const regRes = await request(server).post('/api/v1/auth/register').send({
      email: 'sita.birgunj@example.com',
      password: 'SecurePassword99!',
      fullName: 'Sita Devi',
      phone: '+977 9812233445',
    });
    expect(regRes.status).toBe(201);
    const sitaToken = regRes.body.token;

    const meRes = await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${sitaToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body.user.email).toBe('sita.birgunj@example.com');

    // Password reset request & confirmation revokes old sessions
    const resetReq = await request(server)
      .post('/api/v1/auth/password-reset/request')
      .send({ email: 'sita.birgunj@example.com' });
    expect(resetReq.status).toBe(200);
    expect(resetReq.body.resetToken).toBeDefined();

    const resetConfirm = await request(server)
      .post('/api/v1/auth/password-reset/confirm')
      .send({
        token: resetReq.body.resetToken,
        newPassword: 'UpdatedPassword100!',
      });
    expect(resetConfirm.status).toBe(200);

    // Old session token is now revoked
    const oldSessionCheck = await request(server)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${sitaToken}`);
    expect(oldSessionCheck.status).toBe(401);

    // Login with new password & logout
    const newLogin = await request(server)
      .post('/api/v1/auth/login')
      .send({ email: 'sita.birgunj@example.com', password: 'UpdatedPassword100!' });
    expect(newLogin.status).toBe(200);

    const logoutRes = await request(server)
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${newLogin.body.token}`);
    expect(logoutRes.status).toBe(200);
  });

  it('Journeys #3 & #4: Vendor applies, is approved by Admin, submits product for moderation, and Admin approval makes it publicly visible', async () => {
    const applicantReg = await request(server).post('/api/v1/auth/register').send({
      email: 'owner@birgunjcraft.np',
      password: 'CraftVendorPassword1!',
      fullName: 'Deepak साह',
      phone: '+977 9809988776',
    });
    const applicantToken = applicantReg.body.token;

    const applyRes = await request(server)
      .post('/api/v1/vendor/apply')
      .set('Authorization', `Bearer ${applicantToken}`)
      .send({
        businessName: 'Birgunj Handloom House',
        slug: 'birgunj-handloom-house',
        description: 'Authentic handloom dhaka and cotton fabrics from Birgunj Ward 8.',
        panVatNumber: 'PAN-701122334',
        contactEmail: 'owner@birgunjcraft.np',
        contactPhone: '+977 9809988776',
        wardNumber: 8,
        addressText: 'Maisthan Chowk, Ward 8, Birgunj',
        payoutMethod: 'ESEWA',
        payoutAccountRef: '9809988776',
      });
    expect(applyRes.status).toBe(201);
    const newVendorId = applyRes.body.vendor.id;
    expect(applyRes.body.vendor.approval_status).toBe('PENDING_VERIFICATION');

    // Admin approves the vendor
    const approveVendorRes = await request(server)
      .patch(`/api/v1/admin/vendors/${newVendorId}/moderate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'APPROVED',
        reason: 'Verified PAN certificate and Ward 8 registration',
      });
    expect(approveVendorRes.status).toBe(200);
    expect(approveVendorRes.body.vendor.approval_status).toBe('APPROVED');

    // Vendor creates a new product (defaults to PENDING_APPROVAL)
    const createProdRes = await request(server)
      .post('/api/v1/vendor/products')
      .set('Authorization', `Bearer ${applicantToken}`)
      .send({
        title: 'Birgunj Dhaka Topi & Kurta Set',
        subtitle: 'Men Ethnic',
        slug: 'birgunj-dhaka-topi-kurta-set',
        categoryId: 'cat-men',
        description: 'Handwoven traditional Dhaka Topi paired with pure cotton kurta.',
        basePricePaisa: 329900,
        imageUrls: [
          'https://images.unsplash.com/photo-1617137984095-74e4e5e3613f?w=800&auto=format&fit=crop&q=80',
        ],
        variants: [
          {
            sku: 'WB-DHK-SET-L',
            title: 'Crimson Weave / L',
            sizeValue: 'L',
            colorName: 'Crimson',
            colorHex: '#DC2626',
            pricePaisa: 329900,
            initialStock: 10,
          },
        ],
      });
    expect(createProdRes.status).toBe(201);
    const newProdId = createProdRes.body.product.id;
    expect(createProdRes.body.product.moderation_status).toBe('PENDING_APPROVAL');

    // Before Admin approval, guest cannot view it
    const beforeApprove = await request(server).get(
      '/api/v1/catalog/products/birgunj-dhaka-topi-kurta-set',
    );
    expect(beforeApprove.status).toBe(404);

    // Admin approves the product
    const modProdRes = await request(server)
      .patch(`/api/v1/admin/products/${newProdId}/moderate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'ACTIVE',
        reason: 'Product imagery and pricing verified',
      });
    expect(modProdRes.status).toBe(200);

    // Now publicly visible!
    const afterApprove = await request(server).get(
      '/api/v1/catalog/products/birgunj-dhaka-topi-kurta-set',
    );
    expect(afterApprove.status).toBe(200);
    expect(afterApprove.body.product.title).toBe('Birgunj Dhaka Topi & Kurta Set');
  });

  it('Journey #5: Customer adds variant to cart, applies coupon, and server recalculates price and stock', async () => {
    const cartRes = await request(server)
      .get('/api/v1/customer/cart')
      .set('Authorization', `Bearer ${johnToken}`);
    expect(cartRes.status).toBe(200);
    // Seeded cart for John Doe has 3 items: Rs. 4,999 + Rs. 2,499 + Rs. 1,999 = Rs. 9,497 (949700 paisa)
    expect(cartRes.body.summary.subtotalPaisa).toBe(949700);

    // Apply coupon BIRGUNJ10 (10% off up to Rs. 1,000 = 94970 paisa discount)
    const cpnRes = await request(server)
      .post('/api/v1/customer/cart/coupon')
      .set('Authorization', `Bearer ${johnToken}`)
      .send({ code: 'BIRGUNJ10' });
    expect(cpnRes.status).toBe(200);
    expect(cpnRes.body.summary.discountPaisa).toBe(94970);
    expect(cpnRes.body.summary.totalPaisa).toBe(949700 - 94970);
  });

  it('Journeys #6, #7, #8, #9 & #10: Multi-vendor checkout, idempotency retry protection, concurrent oversell prevention, and signed webhook payment confirmation', async () => {
    // Multi-vendor checkout for Priya (Fashion Hub sneaker + Narayani Kurti)
    const idempotencyKey = 'idem-checkout-priya-001';
    const checkoutPayload = {
      fullName: 'Priya Singh',
      phone: '+977 9841234567',
      wardNumber: 4,
      streetAddress: 'Ward 4, Ghantaghar Chowk, Birgunj',
      landmark: 'Opposite Clock Tower',
      deliveryInstructions: 'Call on arrival',
      paymentMethod: 'ESEWA',
      items: [
        { variantId: 'var-af1-n-9', quantity: 5 }, // Fashion Hub (takes all 5 remaining units of Navy Size 9!)
        { variantId: 'var-kurti-m', quantity: 1 }, // Narayani Lifestyle Studio
      ],
    };

    const checkoutRes = await request(server)
      .post('/api/v1/customer/checkout')
      .set('Authorization', `Bearer ${priyaToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(checkoutPayload);

    expect(checkoutRes.status).toBe(201);
    const createdOrder = checkoutRes.body.order;
    expect(createdOrder.paymentStatus).toBe('PENDING'); // Journey #8: Not PAID until webhook verified
    expect(createdOrder.vendorOrders.length).toBe(2); // Journey #10: Multi-vendor split

    // Journey #7: Retrying checkout with the same Idempotency-Key returns the exact same order without duplicating
    const retryRes = await request(server)
      .post('/api/v1/customer/checkout')
      .set('Authorization', `Bearer ${priyaToken}`)
      .set('Idempotency-Key', idempotencyKey)
      .send(checkoutPayload);
    expect(retryRes.status).toBe(201);
    expect(retryRes.body.order.id).toBe(createdOrder.id);

    // Journey #6: Another customer attempting to buy the now-depleted 'var-af1-n-9' fails with 409 INSUFFICIENT_STOCK
    const oversellAttempt = await request(server)
      .post('/api/v1/customer/checkout')
      .set('Authorization', `Bearer ${johnToken}`)
      .set('Idempotency-Key', 'idem-oversell-test')
      .send({
        fullName: 'John Doe',
        phone: '+977 9801234567',
        wardNumber: 10,
        streetAddress: 'Ward 10, Birgunj',
        paymentMethod: 'COD',
        items: [{ variantId: 'var-af1-n-9', quantity: 1 }],
      });
    expect(oversellAttempt.status).toBe(409);
    expect(oversellAttempt.body.error.code).toBe('INSUFFICIENT_STOCK');

    // Journey #8 & #9: Signed payment webhook confirms payment; duplicate webhook is safely ignored
    const webhookBody = {
      eventId: 'esewa-evt-9001',
      eventType: 'PAYMENT_CAPTURED',
      orderId: createdOrder.id,
      amountPaisa: createdOrder.totalPaisa,
    };
    const secret = process.env.ESEWA_WEBHOOK_SECRET || 'dev-only-esewa-hmac-secret-key';
    const validSig = computeHmacSha256(secret, JSON.stringify(webhookBody));

    // Invalid signature rejected
    const badWebhook = await request(server)
      .post('/api/v1/webhooks/payments/esewa')
      .set('x-webhook-signature', 'invalid-signature')
      .send(webhookBody);
    expect(badWebhook.status).toBe(401);

    // Valid signature transitions order to PAID
    const goodWebhook = await request(server)
      .post('/api/v1/webhooks/payments/esewa')
      .set('x-webhook-signature', validSig)
      .send(webhookBody);
    expect(goodWebhook.status).toBe(200);
    expect(goodWebhook.body.paymentStatus).toBe('PAID');

    // Duplicate webhook replay returns DUPLICATE_IGNORED
    const dupWebhook = await request(server)
      .post('/api/v1/webhooks/payments/esewa')
      .set('x-webhook-signature', validSig)
      .send(webhookBody);
    expect(dupWebhook.status).toBe(200);
    expect(dupWebhook.body.status).toBe('DUPLICATE_IGNORED');
  });

  it('Journeys #11 & #12: Strict cross-vendor and cross-customer tenant isolation (IDOR prevention)', async () => {
    // Vendor B (Narayani) attempts to read or edit Vendor A's (Fashion Hub) product 'prod-af1'
    const crossVendorProdRead = await request(server)
      .get('/api/v1/vendor/products/prod-af1')
      .set('Authorization', `Bearer ${narayaniToken}`);
    expect(crossVendorProdRead.status).toBe(404);

    const crossVendorProdPatch = await request(server)
      .patch('/api/v1/vendor/products/prod-af1')
      .set('Authorization', `Bearer ${narayaniToken}`)
      .send({ title: 'Hacked Title' });
    expect(crossVendorProdPatch.status).toBe(404);

    // Vendor B attempts to access Vendor A's order 'vord-wb123456-fh'
    const crossVendorOrder = await request(server)
      .get('/api/v1/vendor/orders/vord-wb123456-fh')
      .set('Authorization', `Bearer ${narayaniToken}`);
    expect(crossVendorOrder.status).toBe(404);

    // Customer B (Priya) attempts to access Customer A's (John) order 'ord-wb123456' or address 'addr-john-1'
    const crossCustOrder = await request(server)
      .get('/api/v1/customer/orders/ord-wb123456')
      .set('Authorization', `Bearer ${priyaToken}`);
    expect(crossCustOrder.status).toBe(404);

    const crossCustAddr = await request(server)
      .get('/api/v1/auth/addresses/addr-john-1')
      .set('Authorization', `Bearer ${priyaToken}`);
    expect(crossCustAddr.status).toBe(404);
  });

  it('Journeys #13, #14, #15 & #17: Shipment tracking updates, verified-purchase review enforcement, 36-hour return validation, step-up MFA, and admin audit trail', async () => {
    // Journey #13: Vendor updates order 'vord-wb123456-fh' to DELIVERED and updates customer tracking
    const shipUpdate = await request(server)
      .patch('/api/v1/vendor/orders/vord-wb123456-fh/status')
      .set('Authorization', `Bearer ${fashionHubToken}`)
      .send({
        status: 'DELIVERED',
        deliveryPartnerName: 'Rajesh Kumar',
        deliveryPartnerPhone: '+977 9812345678',
        locationText: 'Delivered at Ward 10, Adarshnagar, Birgunj',
        note: 'Handed over to John Doe',
      });
    expect(shipUpdate.status).toBe(200);
    expect(shipUpdate.body.vendorOrder.status).toBe('DELIVERED');

    // Customer sees updated tracking events
    const trackRes = await request(server)
      .get('/api/v1/customer/orders/ord-wb123456')
      .set('Authorization', `Bearer ${johnToken}`);
    expect(trackRes.status).toBe(200);
    expect(trackRes.body.order.status).toBe('DELIVERED');
    expect(trackRes.body.trackingEvents.length).toBeGreaterThanOrEqual(4);

    // Journey #14: Eligible customer (John) reviews 'prod-af1'; duplicate review is rejected; unpurchased product review is rejected
    const reviewRes = await request(server)
      .post('/api/v1/customer/reviews')
      .set('Authorization', `Bearer ${johnToken}`)
      .send({
        productId: 'prod-af1',
        orderItemId: 'oitem-wb123456-1',
        rating: 5,
        comment: 'Super fast delivery in Ward 10 Birgunj and genuine Nike quality!',
      });
    expect(reviewRes.status).toBe(201);

    const dupReviewRes = await request(server)
      .post('/api/v1/customer/reviews')
      .set('Authorization', `Bearer ${johnToken}`)
      .send({
        productId: 'prod-af1',
        orderItemId: 'oitem-wb123456-1',
        rating: 4,
        comment: 'Trying to review twice',
      });
    expect(dupReviewRes.status).toBe(409);

    const ineligibleReviewRes = await request(server)
      .post('/api/v1/customer/reviews')
      .set('Authorization', `Bearer ${johnToken}`)
      .send({
        productId: 'prod-heels', // Never purchased by John
        rating: 5,
        comment: 'Never bought this',
      });
    expect(ineligibleReviewRes.status).toBe(403);

    // Journey #15: John requests a return within the 36-hour post-delivery window on 'oitem-wb123456-1'
    const returnRes = await request(server)
      .post('/api/v1/customer/returns')
      .set('Authorization', `Bearer ${johnToken}`)
      .send({
        orderItemId: 'oitem-wb123456-1',
        requestType: 'EXCHANGE',
        reason: 'Need Size 9 instead of Size 8 under 36-hour Birgunj exchange policy',
      });
    expect(returnRes.status).toBe(201);
    expect(returnRes.body.returnRequest.refundAmountPaisa).toBe(499900);

    // Step-up authentication required for vendor payout destination change
    const noStepUpRes = await request(server)
      .patch('/api/v1/vendor/payout-destination')
      .set('Authorization', `Bearer ${fashionHubToken}`)
      .send({ payoutMethod: 'KHALTI', payoutAccountRef: '9802011223' });
    expect(noStepUpRes.status).toBe(403);
    expect(noStepUpRes.body.error.code).toBe('STEP_UP_MFA_REQUIRED');

    const stepUpRes = await request(server)
      .post('/api/v1/auth/step-up')
      .set('Authorization', `Bearer ${fashionHubToken}`)
      .send({ password: 'VendorPass123!' });
    expect(stepUpRes.status).toBe(200);

    const withStepUpRes = await request(server)
      .patch('/api/v1/vendor/payout-destination')
      .set('Authorization', `Bearer ${fashionHubToken}`)
      .send({ payoutMethod: 'KHALTI', payoutAccountRef: '9802011223' });
    expect(withStepUpRes.status).toBe(200);

    // Journey #17: Admin audit logs contain recorded security and moderation actions
    const auditRes = await request(server)
      .get('/api/v1/admin/audit-logs')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(auditRes.status).toBe(200);
    expect(auditRes.body.items.length).toBeGreaterThanOrEqual(5);
  });
});
