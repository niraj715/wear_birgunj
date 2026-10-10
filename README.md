# Wear Birgunj — Multivendor E-Commerce Marketplace

Production-oriented multivendor e-commerce platform built for **Birgunj, Nepal** following the Wear Birgunj PRD and 16-screen UI design specification.

## Quick Start

```bash
# 1. Run database migrations & seed Birgunj marketplace data
npm run db:migrate
npm run db:seed

# 2. Start the full-stack application (React 19 Frontend + NestJS/Fastify/PostgreSQL 16 API)
npm run dev:web
```

## Verification & Quality Gates

```bash
# Type check (TypeScript strict mode)
npm run typecheck

# Database constraints, immutability triggers, EXPLAIN ANALYZE & isolated backup-restore drill
npm run test:db
npm run db:backup-drill

# 19 End-to-End API, Security, RBAC, IDOR & Concurrency Journeys
npm run test:api

# Production Frontend Build
npm run build:web
```

## Demo Accounts (Seeded with Argon2id Hashes)

| Persona | Email | Password | Portal Route |
|---|---|---|---|
| **Customer (John Doe)** | `john@example.com` | `CustomerPass123!` | `/` (Storefront), `/cart`, `/checkout`, `/orders`, `/account` |
| **Customer (Priya Singh)** | `priya@example.com` | `CustomerPass123!` | `/` (Storefront) |
| **Vendor (Fashion Hub Birgunj)** | `vendor@fashionhub.np` | `VendorPass123!` | `/vendor` (Vendor Portal) |
| **Vendor (Narayani Lifestyle Studio)** | `vendor@narayani.np` | `VendorPass123!` | `/vendor` (Vendor Portal) |
| **Platform Admin & Moderator** | `admin@wearbirgunj.np` | `AdminPass123!` | `/admin` (Admin Panel) |
