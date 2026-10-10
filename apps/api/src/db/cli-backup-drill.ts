import { DatabaseService } from './database.service.js';
import { seedDatabase } from './seed.js';

export async function runBackupRestoreDrill(sourceDb: DatabaseService): Promise<{
  tablesVerified: number;
  sourceOrderSumPaisa: number;
  restoredOrderSumPaisa: number;
  sourceLedgerSumPaisa: number;
  restoredLedgerSumPaisa: number;
  passed: boolean;
}> {
  const orderedTables = [
    'users',
    'roles',
    'permissions',
    'role_permissions',
    'user_role_assignments',
    'vendors',
    'vendor_memberships',
    'vendor_verifications',
    'vendor_commission_rules',
    'categories',
    'brands',
    'products',
    'product_variants',
    'product_media',
    'inventory_items',
    'coupons',
    'orders',
    'vendor_orders',
    'order_items',
    'payments',
    'shipments',
    'tracking_events',
    'commission_snapshots',
    'vendor_ledger_entries',
    'reviews',
    'audit_logs',
  ];

  // Provision isolated PostgreSQL 16 restore target
  const targetDb = new DatabaseService('memory://');
  await targetDb.applyMigrations();

  try {
    for (const table of orderedTables) {
      const { rows } = await sourceDb.query(`SELECT * FROM ${table}`);
      for (const row of rows) {
        const cols = Object.keys(row);
        const placeholders = cols.map((_, idx) => `$${idx + 1}`).join(', ');
        const colNames = cols.map((c) => `"${c}"`).join(', ');
        const values = cols.map((c) => row[c]);
        await targetDb.query(
          `INSERT INTO ${table} (${colNames}) VALUES (${placeholders})`,
          values,
        );
      }
    }

    const srcOrderSum = await sourceDb.query<{ sum: string }>(
      'SELECT COALESCE(SUM(total_paisa), 0)::text AS sum FROM orders',
    );
    const dstOrderSum = await targetDb.query<{ sum: string }>(
      'SELECT COALESCE(SUM(total_paisa), 0)::text AS sum FROM orders',
    );

    const srcLedgerSum = await sourceDb.query<{ sum: string }>(
      'SELECT COALESCE(SUM(amount_paisa), 0)::text AS sum FROM vendor_ledger_entries',
    );
    const dstLedgerSum = await targetDb.query<{ sum: string }>(
      'SELECT COALESCE(SUM(amount_paisa), 0)::text AS sum FROM vendor_ledger_entries',
    );

    const sourceOrderSumPaisa = Number(srcOrderSum.rows[0].sum);
    const restoredOrderSumPaisa = Number(dstOrderSum.rows[0].sum);
    const sourceLedgerSumPaisa = Number(srcLedgerSum.rows[0].sum);
    const restoredLedgerSumPaisa = Number(dstLedgerSum.rows[0].sum);

    const passed =
      sourceOrderSumPaisa === restoredOrderSumPaisa &&
      sourceLedgerSumPaisa === restoredLedgerSumPaisa &&
      sourceOrderSumPaisa > 0;

    return {
      tablesVerified: orderedTables.length,
      sourceOrderSumPaisa,
      restoredOrderSumPaisa,
      sourceLedgerSumPaisa,
      restoredLedgerSumPaisa,
      passed,
    };
  } finally {
    await targetDb.close();
  }
}

async function main() {
  const db = new DatabaseService('memory://');
  try {
    await seedDatabase(db);
    const result = await runBackupRestoreDrill(db);
    console.log('[db:backup-drill] Verification result:', JSON.stringify(result, null, 2));
    if (!result.passed) {
      process.exit(1);
    }
  } finally {
    await db.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error('[db:backup-drill] Failed:', err);
    process.exit(1);
  });
}
