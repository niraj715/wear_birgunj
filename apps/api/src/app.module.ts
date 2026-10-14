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
import { SupportController } from './modules/support/support.controller.js';
import { CloudinaryMediaService } from './modules/media/cloudinary-media.service.js';
import { GeminiSupportService } from './modules/support/gemini-support.service.js';

@Module({
  controllers: [
    HealthController,
    AuthController,
    CatalogController,
    CommerceController,
    VendorController,
    AdminController,
    SupportController,
  ],
  providers: [
    DatabaseService,
    AuditService,
    CloudinaryMediaService,
    GeminiSupportService,
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_FILTER,
      useClass: GlobalApiErrorFilter,
    },
  ],
  exports: [DatabaseService, AuditService, CloudinaryMediaService, GeminiSupportService],
})
export class AppModule {}
