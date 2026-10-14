import crypto from 'node:crypto';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Inject,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import { z } from 'zod';
import { DatabaseService } from '../../db/database.service.js';
import { AuditService } from '../../common/audit.service.js';
import { AppDomainError } from '../../common/api-error.filter.js';
import { AuthContext, Public } from '../../common/auth.guard.js';
import {
  generateOpaqueToken,
  hashPassword,
  sanitizeText,
  sha256Hex,
  verifyPassword,
} from '../../common/crypto.util.js';

const RegisterSchema = z
  .object({
    email: z.string().email().max(180),
    password: z.string().min(8).max(128),
    fullName: z.string().min(2).max(120),
    phone: z.string().min(7).max(25).optional(),
  })
  .strict();

const LoginSchema = z
  .object({
    email: z.string().email(),
    password: z.string().min(1),
  })
  .strict();

const VendorRegisterSchema = z
  .object({
    email: z.string().email().max(180),
    password: z.string().min(8).max(128),
    fullName: z.string().min(2).max(120),
    phone: z.string().min(7).max(25),
    businessName: z.string().min(3).max(120),
    slug: z.string().min(3).max(80).regex(/^[a-z0-9-]+$/),
    wardNumber: z.number().int().min(1).max(32).default(10),
    addressText: z.string().min(5).max(240),
    panVatNumber: z.string().min(5).max(40),
    description: z.string().min(10).max(1000).default('Artisan fashion boutique in Birgunj'),
    payoutMethod: z.enum(['ESEWA', 'KHALTI', 'BANK_TRANSFER']).default('ESEWA'),
    payoutAccountRef: z.string().min(4).max(80).default('9800000000'),
  })
  .strict();

const ProfileUpdateSchema = z
  .object({
    fullName: z.string().min(2).max(120).optional(),
    phone: z.string().min(7).max(25).optional(),
    marketingConsent: z.boolean().optional(),
  })
  .strict();

const AddressSchema = z
  .object({
    label: z.string().min(1).max(40).default('Home'),
    fullName: z.string().min(2).max(120),
    phone: z.string().min(7).max(25),
    wardNumber: z.number().int().min(1).max(32).default(10),
    streetAddress: z.string().min(3).max(240),
    landmark: z.string().max(180).default(''),
    deliveryInstructions: z.string().max(240).default(''),
    isDefault: z.boolean().default(false),
  })
  .strict();

const PasswordResetRequestSchema = z.object({ email: z.string().email() }).strict();
const PasswordResetConfirmSchema = z
  .object({
    token: z.string().min(16),
    newPassword: z.string().min(8).max(128),
  })
  .strict();

const StepUpSchema = z
  .object({
    password: z.string().min(1),
    mfaCode: z.string().optional(),
  })
  .strict();

@Controller('api/v1/auth')
export class AuthController {
  private loginAttempts = new Map<string, { count: number; resetAt: number }>();

  constructor(
    @Inject(DatabaseService) private readonly db: DatabaseService,
    @Inject(AuditService) private readonly audit: AuditService,
  ) {}

  private checkRateLimit(key: string, max = 10, windowMs = 60_000): void {
    const now = Date.now();
    const entry = this.loginAttempts.get(key);
    if (!entry || entry.resetAt < now) {
      this.loginAttempts.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }
    entry.count += 1;
    if (entry.count > max) {
      throw new AppDomainError(
        'RATE_LIMITED',
        'Too many authentication attempts. Please wait a minute and try again.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  @Public()
  @Post('register')
  async register(@Body() body: unknown, @Req() req: any, @Res({ passthrough: true }) reply: any) {
    const dto = RegisterSchema.parse(body);
    const normalizedEmail = dto.email.trim().toLowerCase();
    this.checkRateLimit(`reg:${req.ip || 'local'}`, 15, 60_000);

    const existing = await this.db.query('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existing.rows.length > 0) {
      throw new AppDomainError(
        'ACCOUNT_REGISTRATION_CONFLICT',
        'Unable to register with the provided email address.',
        HttpStatus.CONFLICT,
      );
    }

    const userId = `user-${crypto.randomUUID()}`;
    const passwordHash = hashPassword(dto.password);
    const rawSessionToken = generateOpaqueToken(32);
    const sessionTokenHash = sha256Hex(rawSessionToken);
    const csrfToken = generateOpaqueToken(16);
    const rawVerifyToken = generateOpaqueToken(24);

    await this.db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO users (id, email, phone, full_name, password_hash, status, email_verified_at)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE', NOW())`,
        [
          userId,
          normalizedEmail,
          dto.phone ? sanitizeText(dto.phone) : '+977 9800000000',
          sanitizeText(dto.fullName),
          passwordHash,
        ],
      );

      await tx.query(
        `INSERT INTO user_role_assignments (id, user_id, role_id)
         VALUES ($1, $2, 'role-customer')`,
        [`ura-${crypto.randomUUID()}`, userId],
      );

      await tx.query(
        `INSERT INTO sessions (id, user_id, token_hash, csrf_token, ip_address, expires_at)
         VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '7 days')`,
        [`sess-${crypto.randomUUID()}`, userId, sessionTokenHash, csrfToken, req.ip ?? null],
      );

      await tx.query(
        `INSERT INTO verification_tokens (id, user_id, purpose, token_hash, expires_at)
         VALUES ($1, $2, 'EMAIL_VERIFY', $3, NOW() + INTERVAL '24 hours')`,
        [`vt-${crypto.randomUUID()}`, userId, sha256Hex(rawVerifyToken)],
      );
    });

    if (reply?.setCookie) {
      reply.setCookie('wb_session', rawSessionToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 3600,
      });
    }

    return {
      token: rawSessionToken,
      csrfToken,
      verificationTokenPreview: rawVerifyToken,
      user: {
        id: userId,
        email: normalizedEmail,
        fullName: sanitizeText(dto.fullName),
        phone: dto.phone ?? '+977 9800000000',
        roles: ['CUSTOMER'],
        vendorId: null,
      },
    };
  }

  @Public()
  @Post('vendor/register')
  @HttpCode(HttpStatus.CREATED)
  async registerVendor(
    @Body() body: unknown,
    @Req() req: any,
    @Res({ passthrough: true }) reply: any,
  ) {
    const dto = VendorRegisterSchema.parse(body);
    const normalizedEmail = dto.email.trim().toLowerCase();
    this.checkRateLimit(`vreg:${normalizedEmail}`, 5, 60_000);

    const slugCheck = await this.db.query('SELECT id FROM vendors WHERE slug = $1', [dto.slug]);
    if (slugCheck.rows.length > 0) {
      throw new AppDomainError('DUPLICATE_VENDOR_SLUG', 'A vendor with this handle already exists.', HttpStatus.CONFLICT);
    }

    const existingUser = await this.db.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [normalizedEmail]);
    if (existingUser.rows.length > 0) {
      throw new AppDomainError('EMAIL_ALREADY_REGISTERED', 'An account with this email address already exists.', HttpStatus.CONFLICT);
    }

    const userId = `usr-${crypto.randomUUID()}`;
    const vendorId = `vendor-${crypto.randomUUID()}`;
    const passwordHash = hashPassword(dto.password);
    const rawSessionToken = generateOpaqueToken(32);
    const sessionTokenHash = sha256Hex(rawSessionToken);
    const csrfToken = generateOpaqueToken(16);

    await this.db.transaction(async (tx) => {
      await tx.query(
        `INSERT INTO users (id, email, phone, full_name, password_hash, status, email_verified_at)
         VALUES ($1, $2, $3, $4, $5, 'ACTIVE', NOW())`,
        [userId, normalizedEmail, sanitizeText(dto.phone), sanitizeText(dto.fullName), passwordHash],
      );

      await tx.query(
        `INSERT INTO vendors (
          id, slug, business_name, description, pan_vat_number,
          contact_email, contact_phone, ward_number, address_text,
          approval_status, payout_method, payout_account_ref
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'PENDING_VERIFICATION', $10, $11)`,
        [
          vendorId,
          dto.slug,
          sanitizeText(dto.businessName),
          sanitizeText(dto.description),
          sanitizeText(dto.panVatNumber),
          normalizedEmail,
          sanitizeText(dto.phone),
          dto.wardNumber,
          sanitizeText(dto.addressText),
          dto.payoutMethod,
          sanitizeText(dto.payoutAccountRef),
        ],
      );

      await tx.query(
        `INSERT INTO vendor_memberships (id, user_id, vendor_id, role, status)
         VALUES ($1, $2, $3, 'OWNER', 'ACTIVE')`,
        [`vm-${crypto.randomUUID()}`, userId, vendorId],
      );

      await tx.query(
        `INSERT INTO user_role_assignments (id, user_id, role_id)
         VALUES ($1, $2, 'role-vendor-owner')`,
        [`ura-${crypto.randomUUID()}`, userId],
      );

      await tx.query(
        `INSERT INTO sessions (id, user_id, token_hash, csrf_token, ip_address, expires_at)
         VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '7 days')`,
        [`sess-${crypto.randomUUID()}`, userId, sessionTokenHash, csrfToken, req.ip ?? null],
      );

      await this.audit.log(
        {
          actorId: userId,
          actorRole: 'VENDOR_OWNER',
          vendorId,
          action: 'VENDOR_ONBOARDING_REGISTERED',
          targetType: 'VENDOR',
          targetId: vendorId,
          reason: 'Self-service vendor registration submitted',
        },
        tx,
      );
    });

    if (reply?.setCookie) {
      reply.setCookie('wb_session', rawSessionToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 3600,
      });
    }

    return {
      token: rawSessionToken,
      csrfToken,
      user: {
        id: userId,
        email: normalizedEmail,
        fullName: sanitizeText(dto.fullName),
        phone: dto.phone,
        roles: ['VENDOR_OWNER'],
        vendorId,
      },
      vendor: {
        id: vendorId,
        businessName: sanitizeText(dto.businessName),
        approvalStatus: 'PENDING_VERIFICATION',
      },
      message: 'Vendor onboarding application submitted. Your application is under review by Wear Birgunj Admins.',
    };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() body: unknown, @Req() req: any, @Res({ passthrough: true }) reply: any) {
    const dto = LoginSchema.parse(body);
    const normalizedEmail = dto.email.trim().toLowerCase();
    this.checkRateLimit(`login:${normalizedEmail}`, 10, 60_000);

    const userRes = await this.db.query<{
      id: string;
      email: string;
      full_name: string;
      phone: string | null;
      avatar_url: string | null;
      password_hash: string;
      status: string;
    }>(
      'SELECT id, email, full_name, phone, avatar_url, password_hash, status FROM users WHERE email = $1',
      [normalizedEmail],
    );

    const user = userRes.rows[0];
    if (!user || user.status !== 'ACTIVE' || !verifyPassword(dto.password, user.password_hash)) {
      throw new AppDomainError(
        'INVALID_CREDENTIALS',
        'Invalid email or password.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const rawSessionToken = generateOpaqueToken(32);
    const sessionTokenHash = sha256Hex(rawSessionToken);
    const csrfToken = generateOpaqueToken(16);

    await this.db.query(
      `INSERT INTO sessions (id, user_id, token_hash, csrf_token, ip_address, expires_at)
       VALUES ($1, $2, $3, $4, $5, NOW() + INTERVAL '7 days')`,
      [`sess-${crypto.randomUUID()}`, user.id, sessionTokenHash, csrfToken, req.ip ?? null],
    );

    const rolesRes = await this.db.query<{ name: string }>(
      `SELECT r.name FROM user_role_assignments ura JOIN roles r ON r.id = ura.role_id WHERE ura.user_id = $1`,
      [user.id],
    );

    const vendorRes = await this.db.query<{
      vendor_id: string;
      slug: string;
      business_name: string;
      approval_status: string;
    }>(
      `SELECT vm.vendor_id, v.slug, v.business_name, v.approval_status
       FROM vendor_memberships vm
       JOIN vendors v ON v.id = vm.vendor_id
       WHERE vm.user_id = $1 AND vm.status = 'ACTIVE'
       LIMIT 1`,
      [user.id],
    );

    if (reply?.setCookie) {
      reply.setCookie('wb_session', rawSessionToken, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 3600,
      });
    }

    const vendor = vendorRes.rows[0];
    return {
      token: rawSessionToken,
      csrfToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.full_name,
        phone: user.phone,
        avatarUrl: user.avatar_url,
        roles: rolesRes.rows.map((r) => r.name),
        vendorId: vendor?.vendor_id ?? null,
        vendorSlug: vendor?.slug ?? null,
        vendorName: vendor?.business_name ?? null,
        vendorApprovalStatus: vendor?.approval_status ?? null,
      },
    };
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: any, @Res({ passthrough: true }) reply: any) {
    const auth: AuthContext = req.auth;
    await this.db.query('UPDATE sessions SET revoked_at = NOW() WHERE id = $1', [auth.sessionId]);
    if (reply?.clearCookie) {
      reply.clearCookie('wb_session', { path: '/' });
    }
    return { loggedOut: true };
  }

  @Public()
  @Post('password-reset/request')
  @HttpCode(HttpStatus.OK)
  async requestPasswordReset(@Body() body: unknown) {
    const dto = PasswordResetRequestSchema.parse(body);
    const normalizedEmail = dto.email.trim().toLowerCase();

    const userRes = await this.db.query<{ id: string }>('SELECT id FROM users WHERE email = $1', [
      normalizedEmail,
    ]);

    let devResetToken: string | undefined;
    if (userRes.rows.length > 0) {
      const rawToken = generateOpaqueToken(24);
      devResetToken = rawToken;
      await this.db.query(
        `INSERT INTO verification_tokens (id, user_id, purpose, token_hash, expires_at)
         VALUES ($1, $2, 'PASSWORD_RESET', $3, NOW() + INTERVAL '30 minutes')`,
        [`vt-${crypto.randomUUID()}`, userRes.rows[0].id, sha256Hex(rawToken)],
      );
    }

    // Uniform response to prevent user enumeration
    return {
      message: 'If an account with that email exists, a password reset link has been sent.',
      ...(process.env.NODE_ENV !== 'production' && devResetToken ? { resetToken: devResetToken } : {}),
    };
  }

  @Public()
  @Post('password-reset/confirm')
  @HttpCode(HttpStatus.OK)
  async confirmPasswordReset(@Body() body: unknown) {
    const dto = PasswordResetConfirmSchema.parse(body);
    const tokenHash = sha256Hex(dto.token);

    const tokenRes = await this.db.query<{ id: string; user_id: string }>(
      `SELECT id, user_id FROM verification_tokens
       WHERE token_hash = $1
         AND purpose = 'PASSWORD_RESET'
         AND used_at IS NULL
         AND expires_at > NOW()`,
      [tokenHash],
    );

    if (tokenRes.rows.length === 0) {
      throw new AppDomainError(
        'INVALID_OR_EXPIRED_TOKEN',
        'Password reset token is invalid or has expired.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const { id: tokenId, user_id: userId } = tokenRes.rows[0];
    const newHash = hashPassword(dto.newPassword);

    await this.db.transaction(async (tx) => {
      await tx.query('UPDATE verification_tokens SET used_at = NOW() WHERE id = $1', [tokenId]);
      await tx.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2', [
        newHash,
        userId,
      ]);
      // Revoke all existing sessions on password reset
      await tx.query('UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1', [userId]);
    });

    return { reset: true };
  }

  @Post('step-up')
  @HttpCode(HttpStatus.OK)
  async stepUp(@Body() body: unknown, @Req() req: any) {
    const auth: AuthContext = req.auth;
    const dto = StepUpSchema.parse(body);

    const userRes = await this.db.query<{ password_hash: string }>(
      'SELECT password_hash FROM users WHERE id = $1',
      [auth.userId],
    );
    if (!userRes.rows[0] || !verifyPassword(dto.password, userRes.rows[0].password_hash)) {
      throw new AppDomainError(
        'STEP_UP_INVALID',
        'Step-up password verification failed.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    await this.db.query(
      `UPDATE sessions SET step_up_verified_until = NOW() + INTERVAL '15 minutes' WHERE id = $1`,
      [auth.sessionId],
    );

    await this.audit.log({
      actorId: auth.userId,
      actorRole: auth.roles[0] || 'CUSTOMER',
      vendorId: auth.vendorId,
      action: 'STEP_UP_AUTHENTICATED',
      targetType: 'SESSION',
      targetId: auth.sessionId,
      reason: 'High-risk operation step-up verification',
    });

    return { stepUpVerified: true, validMinutes: 15 };
  }

  @Get('me')
  async getMe(@Req() req: any) {
    const auth: AuthContext = req.auth;
    const addresses = await this.db.query(
      'SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC',
      [auth.userId],
    );
    const notifications = await this.db.query(
      'SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 20',
      [auth.userId],
    );
    return {
      user: auth,
      addresses: addresses.rows,
      notifications: notifications.rows,
    };
  }

  @Patch('profile')
  async updateProfile(@Body() body: unknown, @Req() req: any) {
    const auth: AuthContext = req.auth;
    const dto = ProfileUpdateSchema.parse(body);

    if (dto.fullName) {
      await this.db.query('UPDATE users SET full_name = $1, updated_at = NOW() WHERE id = $2', [
        sanitizeText(dto.fullName),
        auth.userId,
      ]);
    }
    if (dto.phone) {
      await this.db.query('UPDATE users SET phone = $1, updated_at = NOW() WHERE id = $2', [
        sanitizeText(dto.phone),
        auth.userId,
      ]);
    }
    if (typeof dto.marketingConsent === 'boolean') {
      await this.db.query(
        'UPDATE users SET marketing_consent = $1, updated_at = NOW() WHERE id = $2',
        [dto.marketingConsent, auth.userId],
      );
    }

    const updated = await this.db.query(
      'SELECT id, email, full_name, phone, avatar_url, marketing_consent FROM users WHERE id = $1',
      [auth.userId],
    );
    return { user: updated.rows[0] };
  }

  @Get('addresses')
  async listAddresses(@Req() req: any) {
    const auth: AuthContext = req.auth;
    const res = await this.db.query(
      'SELECT * FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, created_at DESC',
      [auth.userId],
    );
    return { items: res.rows };
  }

  @Post('addresses')
  async createAddress(@Body() body: unknown, @Req() req: any) {
    const auth: AuthContext = req.auth;
    const dto = AddressSchema.parse(body);
    const id = `addr-${crypto.randomUUID()}`;

    await this.db.transaction(async (tx) => {
      if (dto.isDefault) {
        await tx.query('UPDATE addresses SET is_default = FALSE WHERE user_id = $1', [auth.userId]);
      }
      await tx.query(
        `INSERT INTO addresses (
          id, user_id, label, full_name, phone, ward_number, street_address,
          landmark, city, delivery_instructions, is_default
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'Birgunj',$9,$10)`,
        [
          id,
          auth.userId,
          sanitizeText(dto.label),
          sanitizeText(dto.fullName),
          sanitizeText(dto.phone),
          dto.wardNumber,
          sanitizeText(dto.streetAddress),
          sanitizeText(dto.landmark),
          sanitizeText(dto.deliveryInstructions),
          dto.isDefault,
        ],
      );
    });

    const created = await this.db.query('SELECT * FROM addresses WHERE id = $1 AND user_id = $2', [
      id,
      auth.userId,
    ]);
    return { address: created.rows[0] };
  }

  @Get('addresses/:id')
  async getAddress(@Param('id') id: string, @Req() req: any) {
    const auth: AuthContext = req.auth;
    // Strict customer tenant isolation: WHERE id = $1 AND user_id = $2
    const res = await this.db.query('SELECT * FROM addresses WHERE id = $1 AND user_id = $2', [
      id,
      auth.userId,
    ]);
    if (res.rows.length === 0) {
      throw new AppDomainError('ADDRESS_NOT_FOUND', 'Address not found.', HttpStatus.NOT_FOUND);
    }
    return { address: res.rows[0] };
  }

  @Delete('addresses/:id')
  async deleteAddress(@Param('id') id: string, @Req() req: any) {
    const auth: AuthContext = req.auth;
    const res = await this.db.query(
      'DELETE FROM addresses WHERE id = $1 AND user_id = $2 RETURNING id',
      [id, auth.userId],
    );
    if (res.rows.length === 0) {
      throw new AppDomainError('ADDRESS_NOT_FOUND', 'Address not found.', HttpStatus.NOT_FOUND);
    }
    return { deleted: true };
  }
}
