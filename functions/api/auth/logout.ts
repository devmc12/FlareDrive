import {
  buildClearSessionCookie,
  deleteCurrentSession,
  getAuthMode,
  hasBasicAuthorizationHeader,
  jsonResponse,
  type FlareDriveAuthEnv,
} from "../../auth";

/**
 * Date: 2026-05-27
 * Time: 21:20
 * Desc: Deletes the current password-auth session and clears its cookie
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

  if (getAuthMode(env) === "password") {
    await deleteCurrentSession(env, request);
  }

  const headers = new Headers();
  headers.set("Set-Cookie", buildClearSessionCookie(request));

  return jsonResponse(
    { mode: getAuthMode(env), authenticated: getAuthMode(env) === "basic" },
    { headers }
  );
};
