import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
  Req,
} from '@nestjs/common';
import { z } from 'zod';
import { DatabaseService } from '../../db/database.service.js';
import { AuthContext, Public } from '../../common/auth.guard.js';
import { GeminiSupportService } from './gemini-support.service.js';

const ChatDtoSchema = z
  .object({
    message: z.string().min(1).max(1000),
  })
  .strict();

const CreateTicketDtoSchema = z
  .object({
    subject: z.string().min(3).max(180),
    category: z.enum(['ORDER_ISSUE', 'RETURN_EXCHANGE', 'PAYMENT', 'DELIVERY', 'OTHER']).default('ORDER_ISSUE'),
    description: z.string().min(10).max(2000),
    orderId: z.string().optional(),
  })
  .strict();

@Controller('api/v1/support')
export class SupportController {
  constructor(
    @Inject(GeminiSupportService) private readonly supportService: GeminiSupportService,
    @Inject(DatabaseService) private readonly db: DatabaseService,
  ) {}

  @Public()
  @Post('chat')
  @HttpCode(HttpStatus.OK)
  async handleChat(@Body() body: unknown, @Req() req: any) {
    const dto = ChatDtoSchema.parse(body);
    const auth: AuthContext | undefined = req.auth;
    const ip = req.headers['x-forwarded-for'] || req.ip || '127.0.0.1';

    const response = await this.supportService.handleChat(
      dto.message,
      auth ? { userId: auth.userId, email: auth.email } : undefined,
      Array.isArray(ip) ? ip[0] : ip,
    );

    return response;
  }

  @Post('tickets')
  async createTicket(@Body() body: unknown, @Req() req: any) {
    const auth: AuthContext = req.auth;
    const dto = CreateTicketDtoSchema.parse(body);

    const ticket = await this.supportService.createSupportTicket({
      customerId: auth.userId,
      orderId: dto.orderId,
      subject: dto.subject,
      category: dto.category,
      description: dto.description,
    });

    return { ticket };
  }

  @Get('tickets/my')
  async getMyTickets(@Req() req: any) {
    const auth: AuthContext = req.auth;
    const res = await this.db.query(
      `SELECT * FROM support_cases WHERE customer_id = $1 ORDER BY created_at DESC`,
      [auth.userId],
    );
    return { items: res.rows };
  }
}
