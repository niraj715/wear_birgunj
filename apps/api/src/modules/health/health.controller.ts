import { Controller, Get, Inject } from '@nestjs/common';
import { DatabaseService } from '../../db/database.service.js';
import { Public } from '../../common/auth.guard.js';

@Controller('api/v1/health')
export class HealthController {
  constructor(@Inject(DatabaseService) private readonly db: DatabaseService) {}

  @Public()
  @Get()
  async checkHealth() {
    await this.db.query('SELECT 1 AS ok');
    return {
      status: 'ok',
      service: 'wear-birgunj-api',
      version: '1.0.0',
      timestamp: new Date().toISOString(),
    };
  }
}
