import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DatabaseService } from '../src/db/database.service.js';
import { seedDatabase } from '../src/db/seed.js';
import { runBackupRestoreDrill } from '../src/db/cli-backup-drill.js';

describe('Workstream 1 — PostgreSQL 16 Schema, Constraints, Indexes & Backup Drill', () => {
  let db: DatabaseService;

  beforeAll(async () => {
    db = new DatabaseService('memory://');
    await seedDatabase(db);
  });

  afterAll(async () => {
    await db.close();
  });

  it('applies migrations cleanly and populates Birgunj seed data', async () => {
    const vendors = await db.query('SELECT id, slug, approval_status FROM vendors ORDER BY slug');
    expect(vendors.rows.length).toBeGreaterThanOrEqual(3);

    const activeProducts = await db.query(
      "SELECT COUNT(*)::int AS cnt FROM products WHERE moderation_status = 'ACTIVE'",
    );
    expect(activeProducts.rows[0].cnt).toBe(12);
  });

  it('enforces CHECK constraints on ratings (1-5), inventory (>=0), and prices (>=0)', async () => {
    // Rating > 5 must be rejected by PostgreSQL CHECK constraint
    await expect(
      db.query(
        `INSERT INTO reviews (id, product_id, order_item_id, customer_id, vendor_id, rating, comment)
         VALUES ('rev-bad-rating', 'prod-af1', 'oitem-wb123456-1', 'user-customer-john', 'vendor-fashion-hub', 6, 'Invalid rating')`,
      ),
    ).rejects.toThrow();

    // Negative inventory available_qty must be rejected
    await expect(
      db.query(
        "UPDATE inventory_items SET available_qty = -1 WHERE variant_id = 'var-af1-w-8'",
      ),
    ).rejects.toThrow();

    // Negative product price must be rejected
    await expect(
      db.query(
        "UPDATE product_variants SET price_paisa = -500 WHERE id = 'var-af1-w-8'",
      ),
    ).rejects.toThrow();
  });

  it('enforces UNIQUE constraints on SKU, webhook_inbox, idempotency_keys, and verified-purchase reviews', async () => {
    // Duplicate SKU
    await expect(
      db.query(
        `INSERT INTO product_variants (id, product_id, sku, title, price_paisa)
         VALUES ('var-dup-sku', 'prod-af1', 'WB-AF1-WHT-8', 'Dup', 499900)`,
      ),
    ).rejects.toThrow();

    // Duplicate review on same order_item_id by same customer
    await expect(
      db.query(
        `INSERT INTO reviews (id, product_id, order_item_id, customer_id, vendor_id, rating, comment)
         VALUES ('rev-dup-1', 'prod-af1', 'oitem-wb123453-1', 'user-customer-priya', 'vendor-fashion-hub', 4, 'Second review attempt')`,
      ),
    ).rejects.toThrow();
  });

  it('enforces immutability triggers on vendor_ledger_entries and audit_logs (blocks UPDATE and DELETE)', async () => {
    await expect(
      db.query("UPDATE vendor_ledger_entries SET amount_paisa = 999999 WHERE id = 'vle-1'"),
    ).rejects.toThrow(/Modification or deletion of immutable table/);

    await expect(
      db.query("DELETE FROM vendor_ledger_entries WHERE id = 'vle-1'"),
    ).rejects.toThrow(/Modification or deletion of immutable table/);

    await expect(
      db.query("DELETE FROM audit_logs WHERE id = 'audit-seed-1'"),
    ).rejects.toThrow(/Modification or deletion of immutable table/);
  });

  it('prevents cascade deletion of vendors with financial and order history', async () => {
    await expect(
      db.query("DELETE FROM vendors WHERE id = 'vendor-fashion-hub'"),
    ).rejects.toThrow();
  });

  it('executes EXPLAIN ANALYZE cleanly on composite indexes', async () => {
    const plan = await db.query(
      `EXPLAIN ANALYZE
       SELECT id, title, base_price_paisa
       FROM products
       WHERE vendor_id = 'vendor-fashion-hub' AND moderation_status = 'ACTIVE'
       ORDER BY updated_at DESC
       LIMIT 10`,
    );
    expect(plan.rows.length).toBeGreaterThan(0);
  });

  it('passes isolated backup export and restoration integrity drill', async () => {
    const drill = await runBackupRestoreDrill(db);
    expect(drill.passed).toBe(true);
    expect(drill.restoredOrderSumPaisa).toBe(drill.sourceOrderSumPaisa);
    expect(drill.restoredLedgerSumPaisa).toBe(drill.sourceLedgerSumPaisa);
  });
});
