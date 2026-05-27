import {
  buildClearSessionCookie,
  deleteAllUserSessions,
  getAuthMode,
  getSessionFromRequest,
  hasBasicAuthorizationHeader,
  jsonResponse,
  type FlareDriveAuthEnv,
} from "../../auth";

/**
 * Date: 2026-05-27
 * Time: 21:20
 * Desc: Deletes every password-auth session for the current user
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
    return jsonResponse({ mode: "basic", authenticated: true });
  }

  const session = await getSessionFromRequest(env, request);
  if (!session) {
    const headers = new Headers();
    headers.set("Set-Cookie", buildClearSessionCookie(request));
    return new Response("Unauthorized", { status: 401, headers });
  }

  await deleteAllUserSessions(env, session.username);

  const headers = new Headers();
  headers.set("Set-Cookie", buildClearSessionCookie(request));

  return jsonResponse({ mode: "password", authenticated: false }, { headers });
};
