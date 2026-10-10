import fs from 'node:fs';
import path from 'node:path';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PGlite } from '@electric-sql/pglite';
import pg from 'pg';

export interface QueryResultRow {
  [column: string]: any;
}

export interface DbExecutor {
  query<T extends QueryResultRow = any>(sql: string, params?: any[]): Promise<{ rows: T[]; rowCount: number }>;
  exec(sql: string): Promise<void>;
}

@Injectable()
export class DatabaseService implements OnModuleInit, OnModuleDestroy, DbExecutor {
  private pglite: PGlite | null = null;
  private pgPool: pg.Pool | null = null;
  private initialized = false;
  private txQueue: Promise<any> = Promise.resolve();
  private readonly dataDir: string;

  constructor(customDataDir?: string) {
    this.dataDir =
      customDataDir ??
      process.env.PGLITE_DATA_DIR ??
      path.resolve(process.cwd(), 'data', 'pgdata');
  }

  async onModuleInit(): Promise<void> {
    await this.init();
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    const externalUrl = process.env.DATABASE_URL;
    if (externalUrl && externalUrl.startsWith('postgres')) {
      this.pgPool = new pg.Pool({
        connectionString: externalUrl,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      });
    } else {
      if (this.dataDir === 'memory://') {
        this.pglite = new PGlite();
      } else {
        fs.mkdirSync(path.dirname(this.dataDir), { recursive: true });
        this.pglite = new PGlite(this.dataDir);
      }
      await this.pglite.waitReady;
    }

    this.initialized = true;
  }

  async query<T extends QueryResultRow = any>(
    sql: string,
    params: any[] = [],
  ): Promise<{ rows: T[]; rowCount: number }> {
    await this.init();
    if (this.pgPool) {
      const res = await this.pgPool.query<T>(sql, params);
      return { rows: res.rows, rowCount: res.rowCount ?? res.rows.length };
    }
    if (!this.pglite) {
      throw new Error('PostgreSQL engine not initialized');
    }
    const res = await this.pglite.query<T>(sql, params);
    return { rows: res.rows, rowCount: res.affectedRows ?? res.rows.length };
  }

  async exec(sql: string): Promise<void> {
    await this.init();
    if (this.pgPool) {
      await this.pgPool.query(sql);
      return;
    }
    if (!this.pglite) {
      throw new Error('PostgreSQL engine not initialized');
    }
    await this.pglite.exec(sql);
  }

  /**
   * Executes a callback inside an atomic PostgreSQL transaction (BEGIN ... COMMIT / ROLLBACK).
   */
  async transaction<T>(fn: (tx: DbExecutor) => Promise<T>): Promise<T> {
    await this.init();

    if (this.pgPool) {
      const client = await this.pgPool.connect();
      try {
        await client.query('BEGIN');
        const txExecutor: DbExecutor = {
          query: async <R extends QueryResultRow = any>(sql: string, params: any[] = []) => {
            const res = await client.query<R>(sql, params);
            return { rows: res.rows, rowCount: res.rowCount ?? res.rows.length };
          },
          exec: async (sql: string) => {
            await client.query(sql);
          },
        };
        const result = await fn(txExecutor);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // Serialize transactions on PGlite single-connection embedded PostgreSQL 16 engine
    const runTx = async (): Promise<T> => {
      if (!this.pglite) throw new Error('PostgreSQL engine not initialized');
      return this.pglite.transaction(async (tx) => {
        const txExecutor: DbExecutor = {
          query: async <R extends QueryResultRow = any>(sql: string, params: any[] = []) => {
            const res = await tx.query<R>(sql, params);
            return { rows: res.rows, rowCount: res.affectedRows ?? res.rows.length };
          },
          exec: async (sql: string) => {
            await tx.exec(sql);
          },
        };
        return fn(txExecutor);
      });
    };

    const next = this.txQueue.then(runTx, runTx);
    this.txQueue = next.catch(() => undefined);
    return next;
  }

  async applyMigrations(): Promise<{ applied: string[] }> {
    await this.init();
    await this.exec(`
      CREATE TABLE IF NOT EXISTS _schema_migrations (
        version TEXT PRIMARY KEY,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    const migrationsRoot = path.resolve(process.cwd(), 'prisma', 'migrations');
    if (!fs.existsSync(migrationsRoot)) {
      return { applied: [] };
    }

    const dirs = fs
      .readdirSync(migrationsRoot, { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name)
      .sort();

    const applied: string[] = [];
    for (const dir of dirs) {
      const sqlPath = path.join(migrationsRoot, dir, 'migration.sql');
      if (!fs.existsSync(sqlPath)) continue;

      const existing = await this.query<{ version: string }>(
        'SELECT version FROM _schema_migrations WHERE version = $1',
        [dir],
      );
      const sql = fs.readFileSync(sqlPath, 'utf8');
      // Always ensure idempotent DDL is applied and recorded
      await this.exec(sql);
      if (existing.rows.length === 0) {
        await this.query('INSERT INTO _schema_migrations (version) VALUES ($1)', [dir]);
        applied.push(dir);
      }
    }
    return { applied };
  }

  async onModuleDestroy(): Promise<void> {
    await this.close();
  }

  async close(): Promise<void> {
    if (this.pgPool) {
      await this.pgPool.end();
      this.pgPool = null;
    }
    if (this.pglite) {
      await this.pglite.close();
      this.pglite = null;
    }
    this.initialized = false;
  }
}
