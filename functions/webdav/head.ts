import { type RequestHandlerParams } from "./types";
import { applyWebDavResponseSecurityHeaders, notFound } from "./utils";

/**
 * Date: 2024-07-08
 * Time: 11:29
 * Desc: Returns WebDAV object metadata with safe browser response headers
 */

export async function handleRequestHead({
  bucket,
  path,
}: RequestHandlerParams) {
  const obj = await bucket.head(path);
  if (obj === null) return notFound();

  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  applyWebDavResponseSecurityHeaders(headers, path);
  return new Response(null, { headers });
}
