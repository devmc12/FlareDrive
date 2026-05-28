import {
  getAuthMode,
  getLoginPublicKey,
  getSessionFromRequest,
  getTurnstileSiteKey,
  hasBasicAuthorizationHeader,
  isPublicReadEnabled,
  isTurnstileEnabled,
  jsonResponse,
  type FlareDriveAuthEnv,
} from "../../auth";

/**
 * Date: 2026-05-27
 * Time: 21:20
 * Desc: Reports the active frontend authentication mode and session state
 */

export const onRequest: PagesFunction<FlareDriveAuthEnv> = async function ({
  env,
  request,
}) {
  if (request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  if (hasBasicAuthorizationHeader(request)) {
    return new Response("Forbidden", { status: 403 });
  }

  const mode = getAuthMode(env);
  if (isPublicReadEnabled(env)) {
    return jsonResponse({ mode, authenticated: true, publicRead: true });
  }

  if (mode === "basic") {
    return jsonResponse({ mode, authenticated: true });
  }

  const session = await getSessionFromRequest(env, request);
  if (!session) {
    return jsonResponse({
      mode,
      authenticated: false,
      loginKey: await getLoginPublicKey(env),
      turnstileRequired: isTurnstileEnabled(env),
      turnstileSiteKey: getTurnstileSiteKey(env),
    });
  }

  return jsonResponse({
    mode,
    authenticated: true,
  });
};
