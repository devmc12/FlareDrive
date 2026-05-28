import {
  buildSessionCookie,
  createAuthSession,
  decryptLoginPayload,
  getAuthMode,
  getSessionTtlSeconds,
  hasBasicAuthorizationHeader,
  jsonResponse,
  parseLoginAccount,
  sha256Hex,
  timingSafeEqual,
  verifyTurnstileToken,
  type EncryptedLoginPayload,
  type FlareDriveAuthEnv,
} from "../../auth";

/**
 * Date: 2026-05-27
 * Time: 21:20
 * Desc: Authenticates the configured single user and creates a D1-backed session
 */

export const onRequest: PagesFunction<FlareDriveAuthEnv> = async function ({
  env,
  request,
}) {
  if (request.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (hasBasicAuthorizationHeader(request)) {
    return new Response("Forbidden", { status: 403 });
  }

  if (getAuthMode(env) !== "password") {
    return new Response("Password auth is disabled", { status: 404 });
  }

  const encryptedBody = await readLoginRequestBody(request);
  const turnstileVerified = await verifyTurnstileToken(
    env,
    request,
    encryptedBody.turnstileToken
  );
  if (!turnstileVerified) {
    return new Response("Turnstile verification failed", { status: 403 });
  }

  let body;
  try {
    body = await decryptLoginPayload(env, encryptedBody);
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  if (typeof body.username !== "string" || typeof body.password !== "string") {
    return new Response("Bad Request", { status: 400 });
  }

  const account = parseLoginAccount(env);
  const passwordHash = await sha256Hex(body.password);
  const validCredentials =
    body.username === account.username &&
    timingSafeEqual(passwordHash, account.password);

  if (!validCredentials) {
    return new Response("Unauthorized", { status: 401 });
  }

  const remember = body.remember === true;
  const ttlSeconds = getSessionTtlSeconds(env, remember);
  const session = await createAuthSession(env, account.username, ttlSeconds);
  const headers = new Headers();
  headers.set(
    "Set-Cookie",
    buildSessionCookie(request, session.token, ttlSeconds)
  );

  return jsonResponse(
    {
      mode: "password",
      authenticated: true,
    },
    { headers }
  );
};

/**
 * Parses the login request body as JSON
 * @param request Incoming login request
 * @returns Parsed login body or an empty object
 */
async function readLoginRequestBody(
  request: Request
): Promise<EncryptedLoginPayload> {
  try {
    return (await request.json()) as EncryptedLoginPayload;
  } catch {
    return {} as EncryptedLoginPayload;
  }
}
