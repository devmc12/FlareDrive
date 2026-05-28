import { type RequestHandlerParams } from "./types";
import { isPathAllowedByAuthContext, listAll, notFound } from "./utils";

/**
 * Date: 2024-07-08
 * Time: 11:29
 * Desc: Deletes WebDAV objects and aborts unfinished multipart uploads
 */

export async function handleRequestDelete({
  bucket,
  path,
  request,
  auth,
}: RequestHandlerParams) {
  const searchParams = new URL(request.url).searchParams;
  if (searchParams.has("uploadId")) {
    const uploadId = searchParams.get("uploadId");
    if (!uploadId) return new Response("Bad Request", { status: 400 });

    try {
      await bucket.resumeMultipartUpload(path, uploadId).abort();
      return new Response(null, { status: 204 });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Abort multipart failed";
      return new Response(message, { status: 400 });
    }
  }

  if (path === "") {
    return new Response("Root directory cannot be deleted", { status: 405 });
  }

  if (path !== "") {
    const obj = await bucket.head(path);
    if (obj === null) return notFound();
    await bucket.delete(path);
    if (obj.httpMetadata?.contentType !== "application/x-directory")
      return new Response(null, { status: 204 });
  }

  const children = listAll(bucket, path === "" ? undefined : `${path}/`, true);
  for await (const child of children) {
    if (!isPathAllowedByAuthContext(auth, child.key)) continue;
    await bucket.delete(child.key);
  }

  return new Response(null, { status: 204 });
}
