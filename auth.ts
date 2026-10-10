/**
 * Autentikasi sederhana untuk ORTUKILL POS.
 *
 * Tujuan: aplikasi ini tidak punya login sama sekali, sehingga tidak aman
 * diekspos ke internet. Modul ini menambahkan:
 *  - password (di-hash scrypt + salt acak, tidak pernah disimpan sebagai teks)
 *  - sesi cookie HttpOnly bertanda tangan HMAC dengan masa berlaku 12 jam
 *  - pembatasan percobaan login (anti brute force)
 *  - status "needsSetup" selama password belum dibuat, dan setup hanya boleh
 *    dari komputer ini sendiri (localhost, tanpa lewat tunnel/proxy).
 *
 * Password disimpan di auth_config.json (masuk .gitignore, tidak pernah di-commit).
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type { NextFunction, Request, Response } from 'express';

const AUTH_FILE = path.join(process.cwd(), 'auth_config.json');
const SESSION_COOKIE = 'otk_session';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12 jam
const MAX_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 10 * 60 * 1000; // 10 menit

// Password bisa datang dari environment variable — wajib untuk hosting cloud
// (AI Studio / Cloud Run / VPS) yang filesystem-nya tidak permanen.
const ENV_PASSWORD = (process.env.POS_PASSWORD || process.env.POS_PIN || '').trim();
const ENV_SESSION_SECRET = (process.env.SESSION_SECRET || '').trim();

export function usingEnvPassword(): boolean {
  return ENV_PASSWORD.length > 0;
}

export interface AuthConfig {
  passwordHash: string;
  salt: string;
  sessionSecret: string;
  createdAt: string;
  updatedAt?: string;
}

function loadAuthConfig(): AuthConfig | null {
  try {
    if (!fs.existsSync(AUTH_FILE)) return null;
    const parsed = JSON.parse(fs.readFileSync(AUTH_FILE, 'utf-8'));
    if (!parsed?.passwordHash || !parsed?.salt || !parsed?.sessionSecret) return null;
    return parsed as AuthConfig;
  } catch (err) {
    console.error('Error reading auth_config.json:', err);
    return null;
  }
}

function saveAuthConfig(config: AuthConfig): void {
  fs.writeFileSync(AUTH_FILE, JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 });
}

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 64).toString('hex');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length === 0 || bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('base64url');
}

function parseCookies(req: Request): Record<string, string> {
  const header = req.headers.cookie;
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (key) out[key] = decodeURIComponent(value);
  }
  return out;
}

export function isPasswordSet(): boolean {
  return usingEnvPassword() || loadAuthConfig() !== null;
}

// Saat password dari environment variable, session secret harus deterministik
// supaya cookie tetap valid setelah container/instance restart.
function envSessionSecret(): string {
  return crypto
    .createHash('sha256')
    .update(`ortukill-session|${ENV_PASSWORD}|${ENV_SESSION_SECRET}`)
    .digest('hex');
}

function activeSessionSecret(): string | null {
  if (usingEnvPassword()) return envSessionSecret();
  const config = loadAuthConfig();
  return config ? config.sessionSecret : null;
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const hashA = crypto.createHash('sha256').update(a).digest();
  const hashB = crypto.createHash('sha256').update(b).digest();
  return crypto.timingSafeEqual(hashA, hashB);
}

export function setPassword(password: string): void {
  if (usingEnvPassword()) return; // password diatur lewat environment variable
  const existing = loadAuthConfig();
  const salt = crypto.randomBytes(16).toString('hex');
  const config: AuthConfig = {
    passwordHash: hashPassword(password, salt),
    salt,
    sessionSecret: existing?.sessionSecret || crypto.randomBytes(32).toString('hex'),
    createdAt: existing?.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  saveAuthConfig(config);
}

export function verifyPassword(password: string): boolean {
  if (usingEnvPassword()) return timingSafeEqualStrings(password, ENV_PASSWORD);
  const config = loadAuthConfig();
  if (!config) return false;
  return timingSafeEqualHex(hashPassword(password, config.salt), config.passwordHash);
}

export function isAuthenticated(req: Request): boolean {
  const secret = activeSessionSecret();
  if (!secret) return false;
  const raw = parseCookies(req)[SESSION_COOKIE];
  if (!raw) return false;
  const dot = raw.lastIndexOf('.');
  if (dot <= 0) return false;
  const expPart = raw.slice(0, dot);
  const signature = raw.slice(dot + 1);
  const exp = Number(expPart);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;
  const expected = signPayload(expPart, secret);
  const given = Buffer.from(signature);
  const want = Buffer.from(expected);
  if (given.length !== want.length) return false;
  return crypto.timingSafeEqual(given, want);
}

export function issueSession(req: Request, res: Response): void {
  const secret = activeSessionSecret();
  if (!secret) return;
  const exp = Date.now() + SESSION_TTL_MS;
  const token = `${exp}.${signPayload(String(exp), secret)}`;
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '');
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: forwardedProto.includes('https'),
    path: '/',
    maxAge: SESSION_TTL_MS,
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (isAuthenticated(req)) {
    next();
    return;
  }
  res.status(401).json({
    success: false,
    error: 'UNAUTHORIZED',
    message: 'Sesi tidak valid atau sudah berakhir. Silakan login ulang.',
  });
}

/**
 * Setup password hanya boleh dari komputer ini sendiri.
 * Tunnel (cloudflared) juga menghubungi server lewat 127.0.0.1, jadi kita
 * wajib menolak permintaan yang punya jejak header proxy/tunnel.
 */
export function isLocalRequest(req: Request): boolean {
  const addr = (req.socket.remoteAddress || '').replace('::ffff:', '');
  const isLoopback = addr === '127.0.0.1' || addr === '::1';
  const viaProxy = Boolean(
    req.headers['cf-connecting-ip'] || req.headers['cf-ray'] || req.headers['x-forwarded-for'],
  );
  return isLoopback && !viaProxy;
}

/* ---------------- anti brute force ---------------- */

interface AttemptRecord {
  count: number;
  firstAt: number;
}

const attempts = new Map<string, AttemptRecord>();

function clientKey(req: Request): string {
  // Kunci dari alamat socket (bukan header yang bisa dipalsukan klien).
  return req.socket.remoteAddress || 'unknown';
}

export function loginThrottleRemainingMs(req: Request): number {
  const rec = attempts.get(clientKey(req));
  if (!rec) return 0;
  if (Date.now() - rec.firstAt > ATTEMPT_WINDOW_MS) {
    attempts.delete(clientKey(req));
    return 0;
  }
  if (rec.count < MAX_ATTEMPTS) return 0;
  return rec.firstAt + ATTEMPT_WINDOW_MS - Date.now();
}

export function noteLoginFailure(req: Request): void {
  const key = clientKey(req);
  const rec = attempts.get(key);
  if (!rec || Date.now() - rec.firstAt > ATTEMPT_WINDOW_MS) {
    attempts.set(key, { count: 1, firstAt: Date.now() });
  } else {
    rec.count += 1;
  }
}

export function clearLoginFailures(req: Request): void {
  attempts.delete(clientKey(req));
}
