import { DatabaseService } from './database.service.js';
import { seedDatabase } from './seed.js';

async function main() {
  const db = new DatabaseService();
  try {
    await seedDatabase(db);
    console.log('[db:seed] Database seeded successfully with Birgunj marketplace data.');
  } finally {
    await db.close();
  }
}

main().catch((err) => {
  console.error('[db:seed] Failed:', err);
  process.exit(1);
});
