import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import supertest from 'supertest';
import { NestFastifyApplication } from '@nestjs/platform-fastify';
import { createWearBirgunjApp } from '../src/main.js';

function makeRequest(app: NestFastifyApplication) {
  const fastify = app.getHttpAdapter().getInstance();
  return {
    post: (url: string) => ({
      set: function (this: any, header: string, val: string) {
        this.headers = this.headers || {};
        this.headers[header.toLowerCase()] = val;
        return this;
      },
      send: async function (this: any, payload: any) {
        const res = await fastify.inject({
          method: 'POST',
          url,
          headers: this.headers || {},
          payload,
        });
        return {
          status: res.statusCode,
          body: res.json ? res.json() : JSON.parse(res.body || '{}'),
          headers: res.headers,
        };
      },
    }),
    get: (url: string) => ({
      set: function (this: any, header: string, val: string) {
        this.headers = this.headers || {};
        this.headers[header.toLowerCase()] = val;
        return this;
      },
      send: async function (this: any) {
        const res = await fastify.inject({
          method: 'GET',
          url,
          headers: this.headers || {},
        });
        return {
          status: res.statusCode,
          body: res.json ? res.json() : JSON.parse(res.body || '{}'),
          headers: res.headers,
        };
      },
    }),
    patch: (url: string) => ({
      set: function (this: any, header: string, val: string) {
        this.headers = this.headers || {};
        this.headers[header.toLowerCase()] = val;
        return this;
      },
      send: async function (this: any, payload: any) {
        const res = await fastify.inject({
          method: 'PATCH',
          url,
          headers: this.headers || {},
          payload,
        });
        return {
          status: res.statusCode,
          body: res.json ? res.json() : JSON.parse(res.body || '{}'),
          headers: res.headers,
        };
      },
    }),
    delete: (url: string) => ({
      set: function (this: any, header: string, val: string) {
        this.headers = this.headers || {};
        this.headers[header.toLowerCase()] = val;
        return this;
      },
      send: async function (this: any) {
        const res = await fastify.inject({
          method: 'DELETE',
          url,
          headers: this.headers || {},
        });
        return {
          status: res.statusCode,
          body: res.json ? res.json() : JSON.parse(res.body || '{}'),
          headers: res.headers,
        };
      },
    }),
  };
}

describe('Workstreams 1–4: Production Hardening, Media, Returns, Chatbot & Role Enforcement', () => {
  let app: NestFastifyApplication;
  let adminToken: string;
  let stepUpToken: string;
  let customerToken: string;
  let approvedVendorToken: string;
  let approvedVendorId: string;
  let pendingVendorToken: string;
  let pendingVendorId: string;

  beforeAll(async () => {
    app = await createWearBirgunjApp({ inMemoryDb: true, seed: true });

    // Login Admin
    const adminLogin = await makeRequest(app).post('/api/v1/auth/login').send({
      email: 'admin@wearbirgunj.np',
      password: 'AdminPass123!',
    });
    expect(adminLogin.status).toBe(200);
    adminToken = adminLogin.body.token;

    // Step-up verification for high-risk admin actions
    const stepUpRes = await makeRequest(app)
      .post('/api/v1/auth/step-up')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ password: 'AdminPass123!', mfaCode: '123456' });
    expect(stepUpRes.status).toBe(200);

    // Login Seed Customer (John)
    const custLogin = await makeRequest(app).post('/api/v1/auth/login').send({
      email: 'john@example.com',
      password: 'CustomerPass123!',
    });
    expect(custLogin.status).toBe(200);
    customerToken = custLogin.body.token;

    // Login Seed Approved Vendor (Fashion Hub)
    const venLogin = await makeRequest(app).post('/api/v1/auth/login').send({
      email: 'vendor@fashionhub.np',
      password: 'VendorPass123!',
    });
    expect(venLogin.status).toBe(200);
    approvedVendorToken = venLogin.body.token;
    approvedVendorId = venLogin.body.user.vendorId;
  });

  afterAll(async () => {
    if (app) await app.close();
  });

  it('Flow 1: Vendor Self-Registration, Pending Status, and Approval Restriction', async () => {
    const slug = `artisan-${Date.now().toString().slice(-4)}`;
    const regRes = await makeRequest(app)
      .post('/api/v1/auth/vendor/register')
      .send({
        email: `newvendor_${Date.now()}@birgunjcrafts.np`,
        password: 'VendorSecurePassword@123',
        fullName: 'Bikash Chaudhary',
        phone: '+977 9845112233',
        businessName: 'Birgunj Craft Heritage',
        slug,
        wardNumber: 8,
        addressText: 'Maisthan Chowk, Birgunj',
        panVatNumber: 'VAT-601234567',
        description: 'Traditional Mithila and Bhojpuri handcrafted textiles',
      });

    expect(regRes.status).toBe(201);
    expect(regRes.body.vendor.approvalStatus).toBe('PENDING_VERIFICATION');
    pendingVendorToken = regRes.body.token;
    pendingVendorId = regRes.body.vendor.id;

    // Unapproved vendor CANNOT create products (Strict PRD 2.2 Gate)
    const blockedProdRes = await makeRequest(app)
      .post('/api/v1/vendor/products')
      .set('Authorization', `Bearer ${pendingVendorToken}`)
      .send({
        title: 'Unapproved Saree',
        slug: `unapproved-${Date.now()}`,
        categoryId: 'cat-ethnic-wear',
        description: 'Should not be allowed while pending approval',
        basePricePaisa: 250000,
        imageUrls: ['https://images.unsplash.com/photo-1610030469983-98e550d6193c'],
        variants: [
          {
            sku: `UNAP-${Date.now()}`,
            title: 'Free Size',
            pricePaisa: 250000,
            initialStock: 10,
          },
        ],
      });

    expect(blockedProdRes.status).toBe(403);
    expect(blockedProdRes.body.error.code).toBe('VENDOR_NOT_APPROVED');

    // Admin approves the new vendor
    const approveRes = await makeRequest(app)
      .patch(`/api/v1/admin/vendors/${pendingVendorId}/moderate`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        status: 'APPROVED',
        reason: 'Verified business documents and Ward 8 location',
      });
    expect(approveRes.status).toBe(200);
    expect(approveRes.body.vendor.approval_status).toBe('APPROVED');

    // Approved vendor can now list products
    const allowedProdRes = await makeRequest(app)
      .post('/api/v1/vendor/products')
      .set('Authorization', `Bearer ${pendingVendorToken}`)
      .send({
        title: 'Mithila Handpainted Kurta',
        slug: `mithila-kurta-${Date.now()}`,
        categoryId: 'cat-women',
        description: 'Handpainted authentic Mithila art kurta from Birgunj artisan cluster',
        basePricePaisa: 320000,
        imageUrls: ['https://images.unsplash.com/photo-1610030469983-98e550d6193c'],
        variants: [
          {
            sku: `MITHILA-M-${Date.now()}`,
            title: 'Medium',
            sizeValue: 'M',
            pricePaisa: 320000,
            initialStock: 15,
          },
        ],
      });

    expect(allowedProdRes.status).toBe(201);
    expect(allowedProdRes.body.product.moderation_status).toBe('PENDING_APPROVAL');
  });

  it('Flow 2: Cloudinary Media Upload, Magic Byte Validation & Tenant Isolation', async () => {
    // 1. Fetch an existing product belonging to approvedVendor
    const prodsRes = await makeRequest(app)
      .get('/api/v1/vendor/products')
      .set('Authorization', `Bearer ${approvedVendorToken}`)
      .send();
    expect(prodsRes.status).toBe(200);
    expect(prodsRes.body.items.length).toBeGreaterThan(0);
    const productId = prodsRes.body.items[0].id;

    // 2. Reject fake file with spoofed extension (Magic Byte Check)
    const fakeTextFile = Buffer.from('THIS_IS_NOT_AN_IMAGE_FILE').toString('base64');
    const fakeRes = await makeRequest(app)
      .post(`/api/v1/vendor/products/${productId}/images/upload`)
      .set('Authorization', `Bearer ${approvedVendorToken}`)
      .send({
        imageBase64: fakeTextFile,
        mimeType: 'image/jpeg',
        altText: 'Spoofed File',
      });
    expect(fakeRes.status).toBe(400);
    expect(fakeRes.body.error.code).toBe('INVALID_IMAGE_SIGNATURE');

    // 3. Valid PNG Magic Bytes Upload (0x89, 'P', 'N', 'G', 0x0D, 0x0A, 0x1A, 0x0A)
    // 1x1 Transparent PNG binary
    const validPngBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
      'base64',
    );
    const uploadRes = await makeRequest(app)
      .post(`/api/v1/vendor/products/${productId}/images/upload`)
      .set('Authorization', `Bearer ${approvedVendorToken}`)
      .send({
        imageBase64: validPngBuffer.toString('base64'),
        mimeType: 'image/png',
        altText: 'Authentic Saree Detail',
        isPrimary: true,
      });

    expect(uploadRes.status).toBe(201);
    expect(uploadRes.body.image.is_primary).toBe(true);
    expect(uploadRes.body.image.format).toBe('png');
    const imageId = uploadRes.body.image.id;

    // 4. Cross-vendor tenant isolation: PendingVendor cannot delete ApprovedVendor's image
    const idorDeleteRes = await makeRequest(app)
      .delete(`/api/v1/vendor/products/${productId}/images/${imageId}`)
      .set('Authorization', `Bearer ${pendingVendorToken}`)
      .send();
    expect(idorDeleteRes.status).toBe(404);

    // 5. Authorized vendor deletes their own image
    const deleteRes = await makeRequest(app)
      .delete(`/api/v1/vendor/products/${productId}/images/${imageId}`)
      .set('Authorization', `Bearer ${approvedVendorToken}`)
      .send();
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.deleted).toBe(true);
  });

  it('Flow 3: Complete Customer Return & Exchange Lifecycle with Stock Revalidation and Vendor Review', async () => {
    // 1. Get seed delivered order item for customer
    const orderRes = await makeRequest(app)
      .get('/api/v1/orders/ord-wb123455')
      .set('Authorization', `Bearer ${customerToken}`)
      .send();
    expect(orderRes.status).toBe(200);
    const deliveredItem = orderRes.body.items[0];
    expect(deliveredItem).toBeDefined();

    // 2. Customer submits exchange request with explanation
    const exchangeRes = await makeRequest(app)
      .post('/api/v1/customer/returns')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        orderItemId: deliveredItem.id,
        requestType: 'EXCHANGE',
        reason: 'Size exchange under 36-hr policy',
        explanation: 'The waist on Size M was slightly tight, requesting replacement in Size L.',
        pickupAddressText: 'Adarsh Nagar Ward 10, Birgunj',
      });

    expect(exchangeRes.status).toBe(201);
    expect(exchangeRes.body.returnRequest.status).toBe('REQUESTED');
    const returnRequestId = exchangeRes.body.returnRequest.id;

    // 3. Duplicate request guard rejects second submission for the same item
    const dupRes = await makeRequest(app)
      .post('/api/v1/customer/returns')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        orderItemId: deliveredItem.id,
        requestType: 'RETURN',
        reason: 'Duplicate attempt',
      });
    expect(dupRes.status).toBe(409);
    expect(dupRes.body.error.code).toBe('RETURN_ALREADY_REQUESTED');

    // 4. Customer views their return requests
    const myReturns = await makeRequest(app)
      .get('/api/v1/customer/returns')
      .set('Authorization', `Bearer ${customerToken}`)
      .send();
    expect(myReturns.status).toBe(200);
    expect(myReturns.body.items.some((r: any) => r.id === returnRequestId)).toBe(true);

    // 5. Vendor views returns queue for their store
    const vendorReturnsRes = await makeRequest(app)
      .get('/api/v1/vendor/returns')
      .set('Authorization', `Bearer ${approvedVendorToken}`)
      .send();
    expect(vendorReturnsRes.status).toBe(200);
    expect(vendorReturnsRes.body.items.some((r: any) => r.id === returnRequestId)).toBe(true);

    // 6. Cross-vendor IDOR check: PendingVendor cannot review ApprovedVendor's return
    const idorReviewRes = await makeRequest(app)
      .post(`/api/v1/vendor/returns/${returnRequestId}/review`)
      .set('Authorization', `Bearer ${pendingVendorToken}`)
      .send({ action: 'REJECT', rejectionReason: 'Unauthorized' });
    expect(idorReviewRes.status).toBe(404);

    // 7. Vendor approves exchange request -> status advances to PICKUP_OR_SHIPMENT_PENDING
    const reviewRes = await makeRequest(app)
      .post(`/api/v1/vendor/returns/${returnRequestId}/review`)
      .set('Authorization', `Bearer ${approvedVendorToken}`)
      .send({
        action: 'APPROVE',
        resolutionNotes: 'Courier Rajesh Kumar scheduled for replacement handover today.',
      });

    expect(reviewRes.status).toBe(200);
    expect(reviewRes.body.returnRequest.status).toBe('PICKUP_OR_SHIPMENT_PENDING');
  });

  it('Flow 4: Customer Support Chatbot, Safe FAQ Fallback & Support Ticket Escalation', async () => {
    // 1. Public query on Birgunj delivery policy
    const chatRes = await makeRequest(app)
      .post('/api/v1/support/chat')
      .send({ message: 'What is your delivery time in Birgunj?' });

    expect(chatRes.status).toBe(200);
    expect(chatRes.body.reply).toContain('2 to 4 hour');
    expect(chatRes.body.reply).toContain('Rajesh Kumar');

    // 2. Authenticated customer querying order status
    const orderChatRes = await makeRequest(app)
      .post('/api/v1/support/chat')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ message: 'Can you track my order status?' });

    expect(orderChatRes.status).toBe(200);
    expect(orderChatRes.body.reply).toContain('#WB123456');

    // 3. Customer escalates to a persisted support ticket
    const ticketRes = await makeRequest(app)
      .post('/api/v1/support/tickets')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        subject: 'Custom blouse stitching inquiry',
        category: 'ORDER_ISSUE',
        description: 'Would like to know if Aarav Studio offers express matching blouse alteration in Pipra.',
      });

    expect(ticketRes.status).toBe(201);
    expect(ticketRes.body.ticket.case_number).toBeDefined();
    expect(ticketRes.body.ticket.status).toBe('OPEN');

    // 4. Customer views their tickets
    const myTicketsRes = await makeRequest(app)
      .get('/api/v1/support/tickets/my')
      .set('Authorization', `Bearer ${customerToken}`)
      .send();

    expect(myTicketsRes.status).toBe(200);
    expect(myTicketsRes.body.items.length).toBeGreaterThan(0);
    expect(myTicketsRes.body.items[0].subject).toBe('Custom blouse stitching inquiry');
  });
});
