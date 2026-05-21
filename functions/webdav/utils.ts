/**
 * Date: 2024-07-08
 * Time: 11:29
 * Desc: Provides WebDAV route helpers, listing helpers, and request authorization
 */

export interface RequestHandlerParams {
  bucket: R2Bucket;
  path: string;
  request: Request;
}

// Public WebDAV route mounted by Cloudflare Pages Functions
export const WEBDAV_ENDPOINT = "/webdav/";

// Synthetic root directory object used for PROPFIND responses
export const ROOT_OBJECT = {
  key: "",
  uploaded: new Date(),
  httpMetadata: {
    contentType: "application/x-directory",
    contentDisposition: undefined,
    contentLanguage: undefined,
  },
  customMetadata: undefined,
  size: 0,
  etag: undefined,
};

type WebDavAccess = "ro" | "rw";

type BasicCredentials = {
  username: string;
  password: string;
};

type WebDavAccessToken = {
  username: string;
  passwordSha256: string;
  access: WebDavAccess;
  prefix: string;
};

type WebDavAuthContext = {
  kind: "admin" | "public" | "token";
  access: WebDavAccess;
  prefix: string;
  username?: string;
};

export type WebDavAuthEnv = {
  WEBDAV_USERNAME?: string;
  WEBDAV_PASSWORD?: string;
  WEBDAV_ACCESS_TOKENS?: string;
  WEBDAV_PUBLIC_READ?: string;
};

type WebDavAuthResult =
  | {
      ok: true;
      context: WebDavAuthContext;
    }
  | {
      ok: false;
      response: Response;
    };

// Methods allowed for read-only WebDAV access
const READ_METHODS = new Set(["GET", "HEAD", "PROPFIND"]);

// Hex encoded SHA-256 digest length
const SHA256_HEX_LENGTH = 64;

export function notFound() {
  return new Response("Not found", { status: 404 });
}

export function parseBucketPath(context: any): [R2Bucket, string] {
  const { request, env, params } = context;
  const url = new URL(request.url);

  const pathSegments = (params.path || []) as String[];
  const path = decodeURIComponent(pathSegments.join("/"));
  const driveid = url.hostname.replace(/\..*/, "");

  return [env[driveid] || env["BUCKET"], path];
}

function unauthorized() {
  return new Response("Unauthorized", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="WebDAV"' },
  });
}

function forbidden(message = "Forbidden") {
  return new Response(message, { status: 403 });
}

function normalizeAuthPath(path: string) {
  return path.replace(/^\/+/, "").replace(/\/+$/, "");
}

function isPathWithinPrefix(path: string, prefix: string) {
  const normalizedPath = normalizeAuthPath(path);
  const normalizedPrefix = normalizeAuthPath(prefix);

  if (!normalizedPrefix) return true;

  return (
    normalizedPath === normalizedPrefix ||
    normalizedPath.startsWith(`${normalizedPrefix}/`)
  );
}

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

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;

  let mismatch = 0;
  for (let index = 0; index < a.length; index += 1) {
    mismatch |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }

  return mismatch === 0;
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value)
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

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
    if (
      typeof token.username !== "string" ||
      !token.username ||
      typeof token.passwordSha256 !== "string" ||
      token.passwordSha256.length !== SHA256_HEX_LENGTH ||
      !/^[a-fA-F0-9]+$/.test(token.passwordSha256) ||
      (token.access !== "ro" && token.access !== "rw") ||
      typeof token.prefix !== "string"
    ) {
      throw new Error(`Invalid WebDAV access token at index ${index}`);
    }

    return {
      username: token.username,
      passwordSha256: token.passwordSha256.toLowerCase(),
      access: token.access,
      prefix: normalizeAuthPath(token.prefix),
    };
  });
}

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

async function findMatchingToken(
  tokens: WebDavAccessToken[],
  credentials: BasicCredentials
) {
  const passwordSha256 = await sha256Hex(credentials.password);

  return tokens.find(
    (token) =>
      token.username === credentials.username &&
      timingSafeEqual(token.passwordSha256, passwordSha256)
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
      context: { kind: "public", access: "ro", prefix: "" },
    };
  }

  const hasAdminCredentials = Boolean(
    env.WEBDAV_USERNAME && env.WEBDAV_PASSWORD
  );
  const hasAccessTokenConfig = Boolean(env.WEBDAV_ACCESS_TOKENS?.trim());

  if (!hasAdminCredentials && !hasAccessTokenConfig) {
    return {
      ok: false,
      response: forbidden("WebDAV protocol is not enabled"),
    };
  }

  const credentials = parseBasicCredentials(request);
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
      context: { kind: "admin", access: "rw", prefix: "" },
    };
  }

  let tokens: WebDavAccessToken[];
  try {
    tokens = parseAccessTokens(env.WEBDAV_ACCESS_TOKENS);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid token";
    return { ok: false, response: forbidden(message) };
  }

  const token = await findMatchingToken(tokens, credentials);
  if (!token) {
    return { ok: false, response: unauthorized() };
  }

  if (token.access === "ro" && !READ_METHODS.has(request.method)) {
    return { ok: false, response: forbidden() };
  }

  if (!isPathWithinPrefix(path, token.prefix)) {
    return { ok: false, response: forbidden() };
  }

  if (["COPY", "MOVE"].includes(request.method)) {
    const destination = parseDestinationPath(request);
    if (!destination || !isPathWithinPrefix(destination, token.prefix)) {
      return { ok: false, response: forbidden() };
    }
  }

  return {
    ok: true,
    context: {
      kind: "token",
      access: token.access,
      prefix: token.prefix,
      username: token.username,
    },
  };
}

export async function* listAll(
  bucket: R2Bucket,
  prefix?: string,
  isRecursive: boolean = false
) {
  let cursor: string | undefined = undefined;
  do {
    var r2Objects = await bucket.list({
      prefix: prefix,
      delimiter: isRecursive ? undefined : "/",
      cursor: cursor,
      // @ts-ignore
      include: ["httpMetadata", "customMetadata"],
    });

    for await (const obj of r2Objects.objects)
      if (!obj.key.startsWith("_$flaredrive$/")) yield obj;

    if (r2Objects.truncated) cursor = r2Objects.cursor;
  } while (r2Objects.truncated);
}
