import crypto from 'node:crypto';
import { argon2id } from '@noble/hashes/argon2';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

const ARGON2_OPTS = {
  t: 2,
  m: 19456, // 19 MiB OWASP minimum recommendation for Argon2id
  p: 1,
  dkLen: 32,
};

/**
 * Hashes a plaintext password using OWASP-recommended Argon2id.
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const derived = argon2id(password, salt, ARGON2_OPTS);
  return `$argon2id$v=19$m=${ARGON2_OPTS.m},t=${ARGON2_OPTS.t},p=${ARGON2_OPTS.p}$${bytesToHex(salt)}$${bytesToHex(derived)}`;
}

/**
 * Constant-time verification of a password against an Argon2id hash.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const parts = storedHash.split('$');
    if (parts.length !== 6 || parts[1] !== 'argon2id') return false;
    const paramsPart = parts[3];
    const saltHex = parts[4];
    const hashHex = parts[5];

    const paramMap: Record<string, number> = {};
    for (const kv of paramsPart.split(',')) {
      const [k, v] = kv.split('=');
      paramMap[k] = Number(v);
    }

    const salt = hexToBytes(saltHex);
    const expected = hexToBytes(hashHex);
    const actual = argon2id(password, salt, {
      m: paramMap.m || ARGON2_OPTS.m,
      t: paramMap.t || ARGON2_OPTS.t,
      p: paramMap.p || ARGON2_OPTS.p,
      dkLen: expected.length,
    });

    return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  } catch {
    return false;
  }
}

/**
 * SHA-256 hash of a session or verification token (never store raw tokens in DB).
 */
export function sha256Hex(value: string): string {
  return crypto.createHash('sha256').update(value, 'utf8').digest('hex');
}

/**
 * Generates a cryptographically strong opaque token.
 */
export function generateOpaqueToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/**
 * Computes HMAC-SHA256 signature for webhook payload verification.
 */
export function computeHmacSha256(secret: string, rawPayload: string): string {
  return crypto.createHmac('sha256', secret).update(rawPayload, 'utf8').digest('hex');
}

/**
 * Verifies an HMAC-SHA256 webhook signature in constant time.
 */
export function verifyHmacSha256(secret: string, rawPayload: string, providedSignature: string): boolean {
  if (!providedSignature) return false;
  const expected = computeHmacSha256(secret, rawPayload);
  const expectedBuf = Buffer.from(expected, 'utf8');
  const providedBuf = Buffer.from(providedSignature, 'utf8');
  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Sanitizes user-supplied text to prevent stored XSS while preserving readable text.
 */
export function sanitizeText(input: string): string {
  return input
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/[<>]/g, (ch) => (ch === '<' ? '&lt;' : '&gt;'))
    .trim();
}
