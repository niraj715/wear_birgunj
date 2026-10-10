import 'reflect-metadata';
import crypto from 'node:crypto';
import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import fastifyCookie from '@fastify/cookie';
import fastifyCors from '@fastify/cors';
import fastifyHelmet from '@fastify/helmet';
import { AppModule } from './app.module.js';
import { DatabaseService } from './db/database.service.js';
import { seedDatabase } from './db/seed.js';

export async function createWearBirgunjApp(opts?: {
  inMemoryDb?: boolean;
  seed?: boolean;
}): Promise<NestFastifyApplication> {
  if (opts?.inMemoryDb) {
    process.env.PGLITE_DATA_DIR = 'memory://';
  }

  const adapter = new FastifyAdapter({
    logger: false,
    genReqId: (req: any) =>
      (req.headers['x-request-id'] as string) || crypto.randomUUID(),
  });

  const app = await NestFactory.create<NestFastifyApplication>(AppModule, adapter, {
    logger: ['error', 'warn'],
  });

  await app.register(fastifyCookie as any, {
    secret: process.env.SESSION_SECRET || 'dev-only-replace-in-prod-session-secret-32b',
  });

  await app.register(fastifyHelmet as any, {
    contentSecurityPolicy: false,
  });

  await app.register(fastifyCors as any, {
    origin: process.env.WEB_ORIGIN ? process.env.WEB_ORIGIN.split(',') : true,
    credentials: true,
  });

  const db = app.get(DatabaseService);
  await db.applyMigrations();
  if (opts?.seed !== false) {
    await seedDatabase(db);
  }

  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}

async function bootstrap() {
  const port = Number(process.env.PORT || 4000);
  const app = await createWearBirgunjApp({ seed: true });
  await app.listen(port, '0.0.0.0');
  console.log(`[Wear Birgunj API] NestJS + Fastify listening on http://localhost:${port}/api/v1`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  bootstrap().catch((err) => {
    console.error('[Wear Birgunj API] Fatal bootstrap error:', err);
    process.exit(1);
  });
}
