import { DatabaseService } from './database.service.js';

async function main() {
  const db = new DatabaseService();
  try {
    const res = await db.applyMigrations();
    console.log('[db:migrate] Applied migrations:', res.applied);
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error('[db:migrate] Failed:', err);
  process.exit(1);
});
