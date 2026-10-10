# Wear Birgunj — Operations, Backup/Restore & Incident Response Runbook

## 1. Recovery Objectives & Backup Strategy
- **Recovery Point Objective (RPO):** $\le 15\text{ minutes}$ via continuous WAL archiving + hourly incremental snapshots.
- **Recovery Time Objective (RTO):** $\le 60\text{ minutes}$ via automated logical/physical restore into an isolated target database.
- **Backup Verification Script:** `npm run db:backup-drill` exports a complete logical snapshot of the PostgreSQL schema and transactional tables, provisions a clean isolated PostgreSQL instance, restores the snapshot, and verifies row counts, foreign key integrity, and financial ledger checksums (`SUM(amount_paisa)`).

## 2. Database Role Separation
- **`wear_birgunj_migrator`:** Used exclusively during controlled CI/CD release steps to execute `prisma/migrations/*.sql`.
- **`wear_birgunj_runtime`:** Least-privilege application role with `SELECT, INSERT, UPDATE, DELETE` on application tables; `DELETE` and `UPDATE` are denied on append-only audit/ledger tables (`audit_logs`, `vendor_ledger_entries`).

## 3. Secret Rotation Procedure
1. Provision new secret version in environment/secret manager (`JWT_SECRET`, `ESEWA_WEBHOOK_SECRET`, `KHALTI_WEBHOOK_SECRET`, `CSRF_SECRET`).
2. Deploy API with dual-key verification window (accepting `CURRENT` and `PREVIOUS` signing keys for 24 hours).
3. Retire `PREVIOUS` key and record rotation event in `audit_logs`.

## 4. Incident Response & Rollback
- **Payment Reconciliation Mismatch:** If a webhook fails signature verification or amount reconciliation, `webhook_inbox` marks `processing_status = 'FAILED'` and triggers an admin alert without mutating `orders.payment_status`.
- **Release Rollback:** All database migrations follow the expand/contract pattern so the previous API container revision remains compatible during rollback.
