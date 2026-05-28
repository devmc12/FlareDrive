/**
 * Date: 2026-05-27
 * Time: 21:20
 * Desc: Provides frontend authentication API calls and session-expiry signaling
 */

export type AuthMode = "basic" | "password";

export type AuthStatus = {
  mode: AuthMode;
  authenticated: boolean;
  loginKey?: LoginKeyResponse;
  publicRead?: boolean;
  turnstileRequired?: boolean;
  turnstileSiteKey?: string;
};

export type LoginRequest = {
  username: string;
  password: string;
  remember: boolean;
  turnstileToken?: string;
};

const AUTH_STATUS_ENDPOINT = "/api/auth/status";
const AUTH_LOGIN_ENDPOINT = "/api/auth/login";
const AUTH_LOGOUT_ENDPOINT = "/api/auth/logout";
const AUTH_LOGOUT_ALL_ENDPOINT = "/api/auth/logout-all";
const AUTH_EXPIRED_EVENT = "flaredrive-auth-expired";

type LoginKeyResponse = {
  keyId: string;
  publicKey: JsonWebKey;
};

type EncryptedLoginRequest = {
  keyId: string;
  clientPublicKey: JsonWebKey;
  iv: string;
  ciphertext: string;
  turnstileToken?: string;
};

export class AuthenticationRequiredError extends Error {
  constructor(message = "Authentication required") {
    super(message);
    this.name = "AuthenticationRequiredError";
  }
}

/**
 * Fetches the current frontend authentication state
 * @returns Active auth mode and session state
 */
export async function fetchAuthStatus() {
  const response = await fetch(AUTH_STATUS_ENDPOINT, {
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(await getResponseError(response));
  return (await response.json()) as AuthStatus;
}

/**
 * Logs in with the configured password-auth account
 * @param request Username, password, and keep-signed-in choice
 * @returns Authenticated session status
 */
export async function loginWithPassword(request: LoginRequest) {
  const authStatus = await fetchAuthStatus();
  if (authStatus.mode !== "password" || !authStatus.loginKey) {
    throw new Error("Login encryption key is unavailable");
  }

  const { turnstileToken, ...loginPayload } = request;
  const encryptedRequest = await encryptLoginRequest(
    loginPayload,
    authStatus.loginKey
  );
  if (turnstileToken) encryptedRequest.turnstileToken = turnstileToken;

  const response = await fetch(AUTH_LOGIN_ENDPOINT, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(encryptedRequest),
  });
  if (!response.ok) throw new Error(await getResponseError(response));
  return (await response.json()) as AuthStatus;
}

/**
 * Logs out the current browser session
 * @returns Updated auth status
 */
export async function logoutCurrentSession() {
  const response = await fetch(AUTH_LOGOUT_ENDPOINT, {
    method: "POST",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(await getResponseError(response));
  return (await response.json()) as AuthStatus;
}

/**
 * Logs out every active browser session for the current user
 * @returns Updated auth status
 */
export async function logoutAllSessions() {
  const response = await fetch(AUTH_LOGOUT_ALL_ENDPOINT, {
    method: "POST",
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(await getResponseError(response));
  return (await response.json()) as AuthStatus;
}

/**
 * Throws and broadcasts when a response indicates the session is invalid
 * @param response Fetch response to inspect
 */
export function throwIfAuthenticationRequired(response: Response) {
  if (response.status !== 401 && response.status !== 403) return;

  notifyAuthExpired();
  throw new AuthenticationRequiredError();
}

/**
 * Checks whether an error was raised for an invalid auth session
 * @param error Unknown thrown value
 * @returns Whether the error represents an auth failure
 */
export function isAuthenticationRequiredError(error: unknown) {
  return error instanceof AuthenticationRequiredError;
}

/**
 * Subscribes to auth expiry events raised by WebDAV helpers
 * @param listener Listener called when the session expires
 * @returns Cleanup callback
 */
export function addAuthExpiredListener(listener: () => void) {
  window.addEventListener(AUTH_EXPIRED_EVENT, listener);
  return () => window.removeEventListener(AUTH_EXPIRED_EVENT, listener);
}

/**
 * Broadcasts that the active auth session is no longer valid
 */
function notifyAuthExpired() {
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}

/**
 * Encrypts the login payload with ECDH and AES-GCM before transport
 * @param request Username, password, and keep-signed-in choice
 * @returns Encrypted login envelope
 */
async function encryptLoginRequest(
  request: Omit<LoginRequest, "turnstileToken">,
  loginKey: LoginKeyResponse
): Promise<EncryptedLoginRequest> {
  const serverPublicKey = await crypto.subtle.importKey(
    "jwk",
    loginKey.publicKey,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    []
  );
  const clientKeyPair = (await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveKey"]
  )) as CryptoKeyPair;
  const aesKey = await crypto.subtle.deriveKey(
    { name: "ECDH", public: serverPublicKey },
    clientKeyPair.privateKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt"]
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plaintext = new TextEncoder().encode(JSON.stringify(request));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    aesKey,
    plaintext
  );

  return {
    keyId: loginKey.keyId,
    clientPublicKey: await crypto.subtle.exportKey(
      "jwk",
      clientKeyPair.publicKey
    ),
    iv: encodeBase64Url(iv),
    ciphertext: encodeBase64Url(new Uint8Array(ciphertext)),
  };
}

/**
 * Encodes bytes as base64url text
 * @param bytes Bytes to encode
 * @returns Base64url encoded text
 */
function encodeBase64Url(bytes: Uint8Array) {
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join(
    ""
  );
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

/**
 * Builds a readable error message from a failed response
 * @param response Failed fetch response
 * @returns Response text or generic fallback
 */
async function getResponseError(response: Response) {
  const text = await response.text();
  return text || `Request failed with status ${response.status}`;
}
