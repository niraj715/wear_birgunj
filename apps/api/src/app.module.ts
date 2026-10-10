import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { DatabaseService } from './db/database.service.js';
import { AuditService } from './common/audit.service.js';
import { GlobalApiErrorFilter } from './common/api-error.filter.js';
import { AuthGuard } from './common/auth.guard.js';
import { HealthController } from './modules/health/health.controller.js';
import { AuthController } from './modules/auth/auth.controller.js';
import { CatalogController } from './modules/catalog/catalog.controller.js';
import { CommerceController } from './modules/commerce/commerce.controller.js';
import { VendorController } from './modules/vendor/vendor.controller.js';
import { AdminController } from './modules/admin/admin.controller.js';

@Module({
  controllers: [
    HealthController,
    AuthController,
    CatalogController,
    CommerceController,
    VendorController,
    AdminController,
  ],
  providers: [
    DatabaseService,
    AuditService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalApiErrorFilter,
    },
  ],
  exports: [DatabaseService, AuditService],
})
export class AppModule {}
