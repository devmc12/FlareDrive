import { type RequestHandlerParams } from "./types";
import { applyWebDavResponseSecurityHeaders, notFound } from "./utils";

/**
 * Date: 2024-07-08
 * Time: 11:29
 * Desc: Streams WebDAV object bodies with safe browser response headers
 */

export async function handleRequestGet({
  bucket,
  path,
  request,
}: RequestHandlerParams) {
  const obj = await bucket.get(path, {
    onlyIf: request.headers,
    range: request.headers,
  });
  if (obj === null) return notFound();
  if (!("body" in obj))
    return new Response("Preconditions failed", { status: 412 });

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  applyWebDavResponseSecurityHeaders(headers, path);
  if (path.startsWith("_$flaredrive$/thumbnails/"))
    headers.set("Cache-Control", "max-age=31536000");
  return new Response(obj.body, { headers });
}
