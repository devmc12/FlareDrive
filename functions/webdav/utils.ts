import {
  getAuthMode,
  getSessionFromRequest,
  sha256Hex,
  timingSafeEqual,
} from "../auth";
import { READ_METHODS, SHA256_HEX_LENGTH, WEBDAV_ENDPOINT } from "./constants";
import {
  type BasicCredentials,
  type WebDavAccessToken,
  type WebDavAuthContext,
  type WebDavAuthEnv,
  type WebDavAuthResult,
} from "./types";

/**
 * Date: 2024-07-08
 * Time: 11:29
 * Desc: Provides WebDAV route helpers, listing helpers, and request authorization
 */

export function notFound() {
  return new Response("Not found", { status: 404 });
}

/**
 * Extracts the R2 bucket binding and decoded object key from a Pages context
 * @param context Cloudflare Pages Function context
 * @returns Bucket binding and decoded WebDAV object key
 */
export function parseBucketPath(context: any): [R2Bucket, string] {
  const { request, env, params } = context;
  const url = new URL(request.url);

  const pathSegments = (params.path || []) as string[];
  const path = decodeURIComponent(pathSegments.join("/"));
  const driveid = url.hostname.replace(/\..*/, "");

  return [env[driveid] || env["BUCKET"], path];
}

/**
 * Builds a Basic Auth challenge response for WebDAV clients
 * @returns Unauthorized response with a WebDAV Basic realm
 */
function unauthorized() {
  return new Response("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="WebDAV"' },
  });
}

/**
 * Builds a forbidden response for authenticated requests outside their scope
 * @param message Optional response body
 * @returns Forbidden response
 */
function forbidden(message = "Forbidden") {
  return new Response(message, { status: 403 });
}

/**
 * Normalizes WebDAV auth paths before scope comparison
 * @param path Raw or decoded WebDAV object key
 * @returns Path without leading or trailing slashes
 */
function normalizeAuthPath(path: string) {
  return path.replace(/^\/+/, "").replace(/\/+$/, "");
}

/**
 * Checks whether a requested object key is within a configured auth scope
 * @param path Decoded WebDAV object key requested by the client
 * @param scope Token include or exclude scope from WEBDAV_ACCESS_TOKENS
 * @returns True when the path is the scope itself or one of its children
 */
function isPathWithinAuthScope(path: string, scope: string) {
  const normalizedPath = normalizeAuthPath(path);
  const normalizedScope = normalizeAuthPath(scope);

  if (!normalizedScope) return true;

  return (
    normalizedPath === normalizedScope ||
    normalizedPath.startsWith(`${normalizedScope}/`)
  );
}

/**
 * Checks whether a path is inside any configured auth scope
 * @param path Decoded WebDAV object key requested by the client
 * @param scopes Normalized include or exclude scopes
 * @returns Whether the path belongs to at least one scope
 */
function isPathWithinAnyAuthScope(path: string, scopes: string[]) {
  return scopes.some((scope) => isPathWithinAuthScope(path, scope));
}

/**
 * Checks whether a path is allowed by an authorization context
 * @param context Successful WebDAV authorization context
 * @param path Decoded WebDAV object key requested by the client
 * @returns Whether the path is included and not excluded
 */
export function isPathAllowedByAuthContext(
  context: WebDavAuthContext,
  path: string
) {
  return (
    isPathWithinAnyAuthScope(path, context.includes) &&
    !isPathWithinAnyAuthScope(path, context.excludes)
  );
}

/**
 * Parses username and password from a WebDAV Basic Auth header
 * @param request Incoming WebDAV request
 * @returns Parsed credentials or null when the header is missing or invalid
 */
function parseBasicCredentials(request: Request): BasicCredentials | null {
  const auth = request.headers.get("Authorization");
  const match = auth?.match(/^Basic\s+(.+)$/i);
  if (!match) return null;

  try {
    const decoded = atob(match[1]);
    const separatorIndex = decoded.indexOf(":");
    if (separatorIndex === -1) return null;

    return {
      username: decoded.slice(0, separatorIndex),
      password: decoded.slice(separatorIndex + 1),
    };
  } catch {
    return null;
  }
}

/**
 * Parses and validates access token definitions from the environment
 * @param value Raw WEBDAV_ACCESS_TOKENS JSON string
 * @returns Normalized token definitions
 */
function parseAccessTokens(value?: string): WebDavAccessToken[] {
  if (!value?.trim()) return [];

  const rawTokens = JSON.parse(value) as unknown;
  if (!Array.isArray(rawTokens)) {
    throw new Error("WEBDAV_ACCESS_TOKENS must be a JSON array");
  }

  return rawTokens.map((rawToken, index) => {
    if (!rawToken || typeof rawToken !== "object") {
      throw new Error(`Invalid WebDAV access token at index ${index}`);
    }

    const token = rawToken as Partial<WebDavAccessToken>;
    const excludes = token.excludes ?? [];
    if (
      typeof token.username !== "string" ||
      !token.username ||
      typeof token.password !== "string" ||
      token.password.length !== SHA256_HEX_LENGTH ||
      !/^[a-fA-F0-9]+$/.test(token.password) ||
      (token.access !== "ro" &&
        token.access !== "rw" &&
        token.access !== "up") ||
      !Array.isArray(token.includes) ||
      token.includes.length === 0 ||
      !token.includes.every((include) => typeof include === "string") ||
      !Array.isArray(excludes) ||
      !excludes.every((exclude) => typeof exclude === "string")
    ) {
      throw new Error(`Invalid WebDAV access token at index ${index}`);
    }

    return {
      username: token.username,
      password: token.password.toLowerCase(),
      access: token.access,
      includes: token.includes.map(normalizeAuthPath),
      excludes: excludes.map(normalizeAuthPath),
    };
  });
}

let cachedAccessTokensRaw: string | undefined;
let cachedAccessTokens: WebDavAccessToken[] | null = null;

/**
 * Returns parsed access tokens while reusing the last environment value
 * @param value Raw WEBDAV_ACCESS_TOKENS JSON string
 * @returns Cached or freshly parsed token definitions
 */
function getAccessTokens(value?: string): WebDavAccessToken[] {
  if (value === cachedAccessTokensRaw && cachedAccessTokens) {
    return cachedAccessTokens;
  }

  const tokens = parseAccessTokens(value);
  cachedAccessTokensRaw = value;
  cachedAccessTokens = tokens;
  return tokens;
}

/**
 * Extracts a WebDAV destination key from COPY and MOVE requests
 * @param request Incoming WebDAV COPY or MOVE request
 * @returns Decoded destination object key or null when the header is invalid
 */
function parseDestinationPath(request: Request) {
  const destinationHeader = request.headers.get("Destination");
  if (!destinationHeader) return null;

  try {
    const destinationUrl = new URL(destinationHeader, request.url);
    const decodedPathname = decodeURIComponent(destinationUrl.pathname).replace(
      /\/+$/,
      ""
    );

    if (!decodedPathname.startsWith(WEBDAV_ENDPOINT)) return null;

    return decodedPathname.slice(WEBDAV_ENDPOINT.length);
  } catch {
    return null;
  }
}

/**
 * Checks whether an upload-only token may use this request method
 * @param request Incoming WebDAV request
 * @returns Whether the request is part of a file upload flow
 */
function isUploadOnlyRequestAllowed(request: Request) {
  if (request.method === "PUT") return true;

  const searchParams = new URL(request.url).searchParams;
  if (request.method === "POST") {
    return searchParams.has("uploads") || searchParams.has("uploadId");
  }

  if (request.method === "DELETE") return searchParams.has("uploadId");

  return false;
}

/**
 * Checks whether a token access level allows the current request
 * @param access Token access level
 * @param request Incoming WebDAV request
 * @returns Whether the request method is allowed
 */
function isRequestAllowedByAccess(
  access: WebDavAccessToken["access"],
  request: Request
) {
  if (access === "rw") return true;
  if (access === "ro") return READ_METHODS.has(request.method);
  return isUploadOnlyRequestAllowed(request);
}

/**
 * Finds the token matching a Basic Auth username and raw token secret
 * @param tokens Parsed access token definitions
 * @param credentials Basic Auth credentials supplied by the client
 * @returns Matching token definition or undefined
 */
async function findMatchingToken(
  tokens: WebDavAccessToken[],
  credentials: BasicCredentials
) {
  const hashedPassword = await sha256Hex(credentials.password);

  return tokens.find(
    (token) =>
      token.username === credentials.username &&
      timingSafeEqual(token.password, hashedPassword)
  );
}

/**
 * Authorizes a WebDAV request against admin credentials or scoped access tokens
 * @param env Cloudflare environment variables that define WebDAV credentials
 * @param path Decoded R2 object key requested by the client
 * @param request Incoming WebDAV request
 * @returns Successful auth context or a response explaining why access failed
 */
export async function authorizeWebDavRequest({
  env,
  path,
  request,
}: {
  env: WebDavAuthEnv;
  path: string;
  request: Request;
}): Promise<WebDavAuthResult> {
  if (env.WEBDAV_PUBLIC_READ === "1" && READ_METHODS.has(request.method)) {
    return {
      ok: true,
      context: { kind: "public", access: "ro", includes: [""], excludes: [] },
    };
  }

  const hasAdminCredentials = Boolean(
    env.WEBDAV_USERNAME && env.WEBDAV_PASSWORD
  );
  const hasAccessTokenConfig = Boolean(env.WEBDAV_ACCESS_TOKENS?.trim());
  const authMode = getAuthMode(env);

  const credentials = parseBasicCredentials(request);
  if (!credentials && authMode === "password") {
    const session = await getSessionFromRequest(env, request);
    if (session) {
      return {
        ok: true,
        context: {
          kind: "session",
          access: "rw",
          includes: [""],
          excludes: [],
          username: session.username,
        },
      };
    }
  }

  if (
    !hasAdminCredentials &&
    !hasAccessTokenConfig &&
    authMode !== "password"
  ) {
    return {
      ok: false,
      response: forbidden("WebDAV protocol is not enabled"),
    };
  }

  if (!credentials) {
    return { ok: false, response: unauthorized() };
  }

  if (
    env.WEBDAV_USERNAME &&
    env.WEBDAV_PASSWORD &&
    credentials.username === env.WEBDAV_USERNAME &&
    timingSafeEqual(credentials.password, env.WEBDAV_PASSWORD)
  ) {
    return {
      ok: true,
      context: { kind: "admin", access: "rw", includes: [""], excludes: [] },
    };
  }

  let tokens: WebDavAccessToken[];
  try {
    tokens = getAccessTokens(env.WEBDAV_ACCESS_TOKENS);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid token";
    return { ok: false, response: forbidden(message) };
  }

  const token = await findMatchingToken(tokens, credentials);
  if (!token) {
    return { ok: false, response: unauthorized() };
  }

  if (!isRequestAllowedByAccess(token.access, request)) {
    return { ok: false, response: forbidden() };
  }

  const tokenContext: WebDavAuthContext = {
    kind: "token",
    access: token.access,
    includes: token.includes,
    excludes: token.excludes,
    username: token.username,
  };

  if (!isPathAllowedByAuthContext(tokenContext, path)) {
    return { ok: false, response: forbidden() };
  }

  if (["COPY", "MOVE"].includes(request.method)) {
    const destination = parseDestinationPath(request);
    if (
      !destination ||
      !isPathAllowedByAuthContext(tokenContext, destination)
    ) {
      return { ok: false, response: forbidden() };
    }
  }

  return {
    ok: true,
    context: tokenContext,
  };
}

/**
 * Lists R2 objects while hiding internal FlareDrive objects from clients
 * @param bucket R2 bucket binding
 * @param prefix Optional object key prefix
 * @param isRecursive Whether to include nested descendants
 * @returns Async iterable of visible R2 objects
 */
export async function* listAll(
  bucket: R2Bucket,
  prefix?: string,
  isRecursive: boolean = false
) {
  let cursor: string | undefined = undefined;

  for (;;) {
    const listOptions = {
      prefix,
      delimiter: isRecursive ? undefined : "/",
      cursor,
      include: ["httpMetadata", "customMetadata"],
    } as R2ListOptions & {
      include: Array<"httpMetadata" | "customMetadata">;
    };
    const r2Objects = await bucket.list(listOptions);

    for await (const obj of r2Objects.objects)
      if (!obj.key.startsWith("_$flaredrive$/")) yield obj;

    if (!r2Objects.truncated) break;
    cursor = r2Objects.cursor;
  }
}
