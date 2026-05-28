/**
 * Date: 2026-05-27
 * Time: 21:20
 * Desc: Provides password login, D1 session storage, and auth cookie helpers
 */

export type FlareDriveAuthMode = "basic" | "password";

export type FlareDriveAuthEnv = {
  AUTH_DB?: D1Database;
  FLAREDRIVE_AUTH_MODE?: string;
  FLAREDRIVE_LOGIN_ACCOUNT?: string;
  FLAREDRIVE_LOGIN_PRIVATE_KEY?: string;
  FLAREDRIVE_SESSION_TTL_SECONDS?: string;
  FLAREDRIVE_REMEMBER_TTL_SECONDS?: string;
  FLAREDRIVE_TURNSTILE_SITE_KEY?: string;
  FLAREDRIVE_TURNSTILE_SECRET_KEY?: string;
  WEBDAV_PUBLIC_READ?: string;
};

export type LoginAccount = {
  username: string;
  password: string;
};

export type AuthSession = {
  username: string;
  expiresAt: number;
};

type AuthSessionRow = {
  username: string;
  expires_at: number;
};

export type EncryptedLoginPayload = {
  keyId: string;
  clientPublicKey: JsonWebKey;
  iv: string;
  ciphertext: string;
  turnstileToken?: unknown;
};

export type DecryptedLoginPayload = {
  username?: unknown;
  password?: unknown;
  remember?: unknown;
};

// Browser session cookie name used by password auth mode
export const SESSION_COOKIE_NAME = "flaredrive_session";

// Default session lifetime for normal password logins
const DEFAULT_SESSION_TTL_SECONDS = 24 * 60 * 60;

// Default session lifetime when the user chooses to stay signed in
const DEFAULT_REMEMBER_TTL_SECONDS = 7 * 24 * 60 * 60;

// Hex encoded SHA-256 digest length
const SHA256_HEX_LENGTH = 64;

// Cloudflare Turnstile server-side token verification endpoint
const TURNSTILE_SITEVERIFY_ENDPOINT =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Gets the active FlareDrive frontend authentication mode
 * @param env Cloudflare environment variables
 * @returns Active auth mode with basic as the compatibility default
 */
export function getAuthMode(env: FlareDriveAuthEnv): FlareDriveAuthMode {
  return env.FLAREDRIVE_AUTH_MODE === "password" ? "password" : "basic";
}

/**
 * Checks whether public read access is enabled for WebDAV browsing
 * @param env Cloudflare environment variables
 * @returns Whether read-only WebDAV requests can skip auth
 */
export function isPublicReadEnabled(env: FlareDriveAuthEnv) {
  return env.WEBDAV_PUBLIC_READ === "1";
}

/**
 * Checks whether Turnstile verification is required before password login
 * @param env Cloudflare environment variables
 * @returns Whether a Turnstile secret key is configured
 */
export function isTurnstileEnabled(env: FlareDriveAuthEnv) {
  return Boolean(env.FLAREDRIVE_TURNSTILE_SECRET_KEY?.trim());
}

/**
 * Gets the public Turnstile site key for frontend rendering
 * @param env Cloudflare environment variables
 * @returns Configured Turnstile site key or undefined
 */
export function getTurnstileSiteKey(env: FlareDriveAuthEnv) {
  const siteKey = env.FLAREDRIVE_TURNSTILE_SITE_KEY?.trim();
  return siteKey || undefined;
}

/**
 * Builds a JSON response with consistent content type
 * @param body JSON-serializable response payload
 * @param init Optional response init
 * @returns JSON response
 */
export function jsonResponse(body: unknown, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set("Content-Type", "application/json");
  return new Response(JSON.stringify(body), { ...init, headers });
}

/**
 * Checks whether a request carries a Basic Authorization header
 * @param request Incoming request
 * @returns Whether Basic credentials were supplied
 */
export function hasBasicAuthorizationHeader(request: Request) {
  return /^Basic\s+/i.test(request.headers.get("Authorization") ?? "");
}

/**
 * Compares two strings without short-circuiting on the first mismatch
 * @param a First string
 * @param b Second string
 * @returns True when both strings have identical content
 */
export function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return mismatch === 0;
}

/**
 * Calculates a SHA-256 digest for a string
 * @param value Raw value to hash
 * @returns Lowercase hex encoded SHA-256 digest
 */
export async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Parses the configured single-user login account
 * @param env Cloudflare environment variables
 * @returns Valid login account
 */
export function parseLoginAccount(env: FlareDriveAuthEnv): LoginAccount {
  const rawAccount = env.FLAREDRIVE_LOGIN_ACCOUNT;
  if (!rawAccount?.trim()) {
    throw new Error("FLAREDRIVE_LOGIN_ACCOUNT is required");
  }

  const parsed = JSON.parse(rawAccount) as Partial<LoginAccount>;
  if (
    typeof parsed.username !== "string" ||
    !parsed.username ||
    typeof parsed.password !== "string" ||
    parsed.password.length !== SHA256_HEX_LENGTH ||
    !/^[a-fA-F0-9]+$/.test(parsed.password)
  ) {
    throw new Error("FLAREDRIVE_LOGIN_ACCOUNT is invalid");
  }

  return {
    username: parsed.username,
    password: parsed.password.toLowerCase(),
  };
}

/**
 * Gets the public ECDH login key exposed to the frontend
 * @param env Cloudflare environment variables
 * @returns Public JWK and stable key id
 */
export async function getLoginPublicKey(env: FlareDriveAuthEnv) {
  const privateJwk = parseLoginPrivateKey(env);
  const publicKey = {
    kty: "EC",
    crv: "P-256",
    x: privateJwk.x,
    y: privateJwk.y,
    ext: true,
    key_ops: [],
  };

  return {
    keyId: await sha256Hex(`${publicKey.crv}.${publicKey.x}.${publicKey.y}`),
    publicKey,
  };
}

/**
 * Decrypts the encrypted login payload submitted by the frontend
 * @param env Cloudflare environment variables
 * @param payload Encrypted login envelope
 * @returns Decrypted login request body
 */
export async function decryptLoginPayload(
  env: FlareDriveAuthEnv,
  payload: EncryptedLoginPayload
): Promise<DecryptedLoginPayload> {
  const loginKey = await getLoginPublicKey(env);
  if (payload.keyId !== loginKey.keyId) {
    throw new Error("Login key mismatch");
  }

  const privateKey = await importLoginPrivateKey(env);
  const clientPublicKey = await crypto.subtle.importKey(
    "jwk",
    payload.clientPublicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const aesKey = await crypto.subtle.deriveKey(
    { name: "ECDH", public: clientPublicKey },
    privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: decodeBase64Url(payload.iv) },
    aesKey,
    decodeBase64Url(payload.ciphertext)
  );
  const text = new TextDecoder().decode(plaintext);
  return JSON.parse(text) as DecryptedLoginPayload;
}

/**
 * Verifies a Cloudflare Turnstile token when Turnstile is enabled
 * @param env Cloudflare environment variables
 * @param request Incoming login request
 * @param token Token generated by the frontend Turnstile widget
 * @returns Whether the token is valid or Turnstile is disabled
 */
export async function verifyTurnstileToken(
  env: FlareDriveAuthEnv,
  request: Request,
  token: unknown
) {
  if (!isTurnstileEnabled(env)) return true;
  if (typeof token !== "string" || !token || token.length > 2048) {
    return false;
  }

  const secret = env.FLAREDRIVE_TURNSTILE_SECRET_KEY?.trim();
  if (!secret) return false;

  const body = new FormData();
  body.append("secret", secret);
  body.append("response", token);

  const remoteIp = request.headers.get("CF-Connecting-IP");
  if (remoteIp) body.append("remoteip", remoteIp);

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(TURNSTILE_SITEVERIFY_ENDPOINT, {
      method: "POST",
      body,
      signal: controller.signal,
    });
    if (!response.ok) return false;

    const result = (await response.json()) as {
      success?: boolean;
      action?: string;
    };
    return result.success === true && result.action === "login";
  } catch {
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Gets the configured session lifetime for one login
 * @param env Cloudflare environment variables
 * @param remember Whether the user chose to stay signed in
 * @returns Session lifetime in seconds
 */
export function getSessionTtlSeconds(
  env: FlareDriveAuthEnv,
  remember: boolean
) {
  const rawValue = remember
    ? env.FLAREDRIVE_REMEMBER_TTL_SECONDS
    : env.FLAREDRIVE_SESSION_TTL_SECONDS;
  const fallback = remember
    ? DEFAULT_REMEMBER_TTL_SECONDS
    : DEFAULT_SESSION_TTL_SECONDS;
  const parsedValue = Number(rawValue);

  return Number.isFinite(parsedValue) && parsedValue > 0
    ? Math.floor(parsedValue)
    : fallback;
}

/**
 * Creates a new password-auth session and returns its raw cookie token
 * @param env Cloudflare environment variables
 * @param username Authenticated username
 * @param ttlSeconds Session lifetime in seconds
 * @returns Raw session token and expiry timestamp
 */
export async function createAuthSession(
  env: FlareDriveAuthEnv,
  username: string,
  ttlSeconds: number
) {
  const db = getAuthDb(env);
  const token = createSessionToken();
  const tokenHash = await sha256Hex(token);
  const now = getUnixSeconds();
  const expiresAt = now + ttlSeconds;

  await db
    .prepare(
      `INSERT INTO auth_sessions
        (session_token_hash, username, created_at, expires_at)
      VALUES (?1, ?2, ?3, ?4)`
    )
    .bind(tokenHash, username, now, expiresAt)
    .run();

  return { token, expiresAt };
}

/**
 * Reads and validates the session from an incoming request cookie
 * @param env Cloudflare environment variables
 * @param request Incoming request
 * @returns Valid session or null
 */
export async function getSessionFromRequest(
  env: FlareDriveAuthEnv,
  request: Request
): Promise<AuthSession | null> {
  const token = getCookieValue(request, SESSION_COOKIE_NAME);
  if (!token) return null;

  const tokenHash = await sha256Hex(token);
  const row = await getAuthDb(env)
    .prepare(
      `SELECT username, expires_at
       FROM auth_sessions
       WHERE session_token_hash = ?1
       LIMIT 1`
    )
    .bind(tokenHash)
    .first<AuthSessionRow>();

  if (!row || row.expires_at <= getUnixSeconds()) return null;

  return {
    username: row.username,
    expiresAt: row.expires_at,
  };
}

/**
 * Deletes the current request session when it exists
 * @param env Cloudflare environment variables
 * @param request Incoming request
 */
export async function deleteCurrentSession(
  env: FlareDriveAuthEnv,
  request: Request
) {
  const token = getCookieValue(request, SESSION_COOKIE_NAME);
  if (!token) return;

  await getAuthDb(env)
    .prepare("DELETE FROM auth_sessions WHERE session_token_hash = ?1")
    .bind(await sha256Hex(token))
    .run();
}

/**
 * Deletes all sessions for one username
 * @param env Cloudflare environment variables
 * @param username Username to sign out everywhere
 */
export async function deleteAllUserSessions(
  env: FlareDriveAuthEnv,
  username: string
) {
  await getAuthDb(env)
    .prepare("DELETE FROM auth_sessions WHERE username = ?1")
    .bind(username)
    .run();
}

/**
 * Builds the Set-Cookie value for an authenticated session
 * @param request Incoming request used to choose Secure
 * @param token Raw opaque session token
 * @param ttlSeconds Session lifetime in seconds
 * @returns Set-Cookie header value
 */
export function buildSessionCookie(
  request: Request,
  token: string,
  ttlSeconds: number
) {
  return [
    `${SESSION_COOKIE_NAME}=${token}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${ttlSeconds}`,
    ...(isSecureRequest(request) ? ["Secure"] : []),
  ].join("; ");
}

/**
 * Builds the Set-Cookie value that clears the current session cookie
 * @param request Incoming request used to choose Secure
 * @returns Expired Set-Cookie header value
 */
export function buildClearSessionCookie(request: Request) {
  return [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    "Max-Age=0",
    "Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    ...(isSecureRequest(request) ? ["Secure"] : []),
  ].join("; ");
}

/**
 * Gets the configured D1 auth database binding
 * @param env Cloudflare environment variables
 * @returns D1 auth database binding
 */
function getAuthDb(env: FlareDriveAuthEnv) {
  if (!env.AUTH_DB) throw new Error("AUTH_DB binding is required");
  return env.AUTH_DB;
}

/**
 * Parses the configured ECDH private key for encrypted login payloads
 * @param env Cloudflare environment variables
 * @returns Valid private JWK
 */
function parseLoginPrivateKey(env: FlareDriveAuthEnv) {
  const rawKey = env.FLAREDRIVE_LOGIN_PRIVATE_KEY;
  if (!rawKey?.trim()) {
    throw new Error("FLAREDRIVE_LOGIN_PRIVATE_KEY is required");
  }

  const jwk = JSON.parse(rawKey) as JsonWebKey;
  if (
    jwk.kty !== "EC" ||
    jwk.crv !== "P-256" ||
    typeof jwk.x !== "string" ||
    typeof jwk.y !== "string" ||
    typeof jwk.d !== "string"
  ) {
    throw new Error("FLAREDRIVE_LOGIN_PRIVATE_KEY is invalid");
  }

  return jwk;
}

/**
 * Imports the configured ECDH private key
 * @param env Cloudflare environment variables
 * @returns Imported private CryptoKey
 */
async function importLoginPrivateKey(env: FlareDriveAuthEnv) {
  return await crypto.subtle.importKey(
    "jwk",
    {
      ...parseLoginPrivateKey(env),
      key_ops: ["deriveKey"],
      ext: true,
    },
    { name: "ECDH", namedCurve: "P-256" },
    false,
    ["deriveKey"]
  );
}

/**
 * Decodes base64url text into bytes
 * @param value Base64url encoded value
 * @returns Decoded bytes
 */
function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const paddedBase64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(paddedBase64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

/**
 * Creates a random opaque session token
 * @returns Hex encoded random session token
 */
function createSessionToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Gets the current Unix timestamp in seconds
 * @returns Current Unix timestamp
 */
function getUnixSeconds() {
  return Math.floor(Date.now() / 1000);
}

/**
 * Reads one cookie value from a request
 * @param request Incoming request
 * @param name Cookie name to read
 * @returns Cookie value or null
 */
function getCookieValue(request: Request, name: string) {
  const cookieHeader = request.headers.get("Cookie");
  if (!cookieHeader) return null;

  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  return cookie ? cookie.slice(name.length + 1) : null;
}

/**
 * Checks whether the request should receive a Secure cookie
 * @param request Incoming request
 * @returns Whether the request is HTTPS
 */
function isSecureRequest(request: Request) {
  return new URL(request.url).protocol === "https:";
}
