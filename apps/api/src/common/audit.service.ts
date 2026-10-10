import crypto from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { DatabaseService, DbExecutor } from '../db/database.service.js';

export interface AuditLogInput {
  actorId: string | null;
  actorRole: string;
  vendorId?: string | null;
  action: string;
  targetType: string;
  targetId: string;
  reason?: string | null;
  metadata?: Record<string, any>;
  correlationId?: string;
  ipAddress?: string | null;
}

@Injectable()
export class AuditService {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  async log(input: AuditLogInput, tx?: DbExecutor): Promise<void> {
    const executor = tx ?? this.db;
    await executor.query(
      `INSERT INTO audit_logs (
        id, actor_id, actor_role, vendor_id, action, target_type, target_id,
        reason, metadata_json, correlation_id, ip_address
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [
        `aud-${crypto.randomUUID()}`,
        input.actorId,
        input.actorRole,
        input.vendorId ?? null,
        input.action,
        input.targetType,
        input.targetId,
        input.reason ?? null,
        JSON.stringify(input.metadata ?? {}),
        input.correlationId ?? crypto.randomUUID(),
        input.ipAddress ?? null,
      ],
    );
  }
}
