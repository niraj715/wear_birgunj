import {
  CanActivate,
  ExecutionContext,
  HttpStatus,
  Inject,
  Injectable,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DatabaseService } from '../db/database.service.js';
import { sha256Hex } from './crypto.util.js';
import { AppDomainError } from './api-error.filter.js';

export const ROLES_KEY = 'roles';
export const PUBLIC_KEY = 'isPublic';
export const REQUIRE_VENDOR_KEY = 'requireVendor';
export const REQUIRE_STEP_UP_KEY = 'requireStepUp';

export const Public = () => SetMetadata(PUBLIC_KEY, true);
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
export const RequireVendor = () => SetMetadata(REQUIRE_VENDOR_KEY, true);
export const RequireStepUp = () => SetMetadata(REQUIRE_STEP_UP_KEY, true);

export interface AuthContext {
  userId: string;
  email: string;
  fullName: string;
  phone: string | null;
  avatarUrl: string | null;
  roles: string[];
  vendorId: string | null;
  vendorSlug: string | null;
  vendorName: string | null;
  vendorRole: string | null;
  vendorApprovalStatus: string | null;
  sessionId: string;
  csrfToken: string;
  stepUpVerified: boolean;
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    @Inject(Reflector) private readonly reflector: Reflector,
    @Inject(DatabaseService) private readonly db: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    const request = context.switchToHttp().getRequest<any>();
    const rawToken = this.extractToken(request);

    if (rawToken) {
      const authCtx = await this.resolveAuthContext(rawToken);
      if (authCtx) {
        request.auth = authCtx;
      }
    }

    if (isPublic) {
      return true;
    }

    const auth: AuthContext | undefined = request.auth;
    if (!auth) {
      throw new AppDomainError(
        'UNAUTHENTICATED',
        'Authentication is required to access this resource.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requiredRoles && requiredRoles.length > 0) {
      const hasRole = requiredRoles.some(
        (r) => auth.roles.includes(r) || auth.roles.includes('SUPER_ADMIN'),
      );
      if (!hasRole) {
        throw new AppDomainError(
          'FORBIDDEN',
          'You do not have permission to perform this action.',
          HttpStatus.FORBIDDEN,
        );
      }
    }

    const requireVendor = this.reflector.getAllAndOverride<boolean>(REQUIRE_VENDOR_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requireVendor && !auth.vendorId) {
      throw new AppDomainError(
        'VENDOR_MEMBERSHIP_REQUIRED',
        'An active vendor membership is required for this endpoint.',
        HttpStatus.FORBIDDEN,
      );
    }

    const requireStepUp = this.reflector.getAllAndOverride<boolean>(REQUIRE_STEP_UP_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (requireStepUp && !auth.stepUpVerified) {
      throw new AppDomainError(
        'STEP_UP_MFA_REQUIRED',
        'Step-up authentication is required before performing this high-risk action.',
        HttpStatus.FORBIDDEN,
      );
    }

    return true;
  }

  private extractToken(request: any): string | null {
    const authHeader = request.headers?.authorization as string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.slice(7).trim();
    }
    const cookieToken = request.cookies?.wb_session as string | undefined;
    if (cookieToken) {
      return cookieToken;
    }
    return null;
  }

  async resolveAuthContext(rawToken: string): Promise<AuthContext | null> {
    const tokenHash = sha256Hex(rawToken);
    const sessionRes = await this.db.query<{
      session_id: string;
      user_id: string;
      csrf_token: string;
      step_up_verified_until: string | null;
      email: string;
      full_name: string;
      phone: string | null;
      avatar_url: string | null;
      user_status: string;
    }>(
      `SELECT
         s.id AS session_id,
         s.user_id,
         s.csrf_token,
         s.step_up_verified_until,
         u.email,
         u.full_name,
         u.phone,
         u.avatar_url,
         u.status AS user_status
       FROM sessions s
       JOIN users u ON u.id = s.user_id
       WHERE s.token_hash = $1
         AND s.revoked_at IS NULL
         AND s.expires_at > NOW()`,
      [tokenHash],
    );

    if (sessionRes.rows.length === 0) return null;
    const row = sessionRes.rows[0];
    if (row.user_status !== 'ACTIVE') return null;

    const rolesRes = await this.db.query<{ name: string }>(
      `SELECT r.name
       FROM user_role_assignments ura
       JOIN roles r ON r.id = ura.role_id
       WHERE ura.user_id = $1`,
      [row.user_id],
    );
    const roles = rolesRes.rows.map((r) => r.name);

    const vendorRes = await this.db.query<{
      vendor_id: string;
      role: string;
      slug: string;
      business_name: string;
      approval_status: string;
    }>(
      `SELECT vm.vendor_id, vm.role, v.slug, v.business_name, v.approval_status
       FROM vendor_memberships vm
       JOIN vendors v ON v.id = vm.vendor_id
       WHERE vm.user_id = $1 AND vm.status = 'ACTIVE'
       ORDER BY vm.created_at ASC
       LIMIT 1`,
      [row.user_id],
    );

    const vendor = vendorRes.rows[0];
    const stepUpVerified =
      row.step_up_verified_until !== null &&
      new Date(row.step_up_verified_until).getTime() > Date.now();

    return {
      userId: row.user_id,
      email: row.email,
      fullName: row.full_name,
      phone: row.phone,
      avatarUrl: row.avatar_url,
      roles,
      vendorId: vendor?.vendor_id ?? null,
      vendorSlug: vendor?.slug ?? null,
      vendorName: vendor?.business_name ?? null,
      vendorRole: vendor?.role ?? null,
      vendorApprovalStatus: vendor?.approval_status ?? null,
      sessionId: row.session_id,
      csrfToken: row.csrf_token,
      stepUpVerified,
    };
  }
}
