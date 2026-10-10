import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import crypto from 'node:crypto';
import { ZodError } from 'zod';

export class AppDomainError extends HttpException {
  constructor(
    public readonly code: string,
    message: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
    public readonly details: any[] = [],
  ) {
    super({ code, message, details }, status);
  }
}

@Catch()
export class GlobalApiErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest< any >();
    const reply = ctx.getResponse< any >();

    const requestId =
      (request?.headers?.['x-request-id'] as string) ||
      (request?.correlationId as string) ||
      crypto.randomUUID();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_ERROR';
    let message = 'An unexpected error occurred while processing the request.';
    let details: any[] = [];

    if (exception instanceof AppDomainError) {
      status = exception.getStatus();
      code = exception.code;
      message = exception.message;
      details = exception.details;
    } else if (exception instanceof ZodError) {
      status = HttpStatus.BAD_REQUEST;
      code = 'VALIDATION_ERROR';
      message = 'The request payload failed validation.';
      details = exception.errors.map((e) => ({
        path: e.path.join('.'),
        message: e.message,
      }));
    } else if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse() as any;
      code = res?.code || HttpStatus[status] || 'HTTP_ERROR';
      message = typeof res === 'string' ? res : res?.message || exception.message;
      details = Array.isArray(res?.details) ? res.details : [];
    } else if (exception instanceof Error) {
      // Log internally with correlation ID, never leak raw SQL or stack traces to client
      console.error(`[ERROR][${requestId}]`, exception.message);
    }

    reply.header('x-request-id', requestId);
    reply.status(status).send({
      error: {
        code,
        message,
        requestId,
        details,
      },
    });
  }
}
