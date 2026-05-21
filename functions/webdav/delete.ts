import { type RequestHandlerParams } from "./types";
import { listAll, notFound } from "./utils";

export async function handleRequestDelete({
  bucket,
  path,
}: RequestHandlerParams) {
  if (path !== "") {
    const obj = await bucket.head(path);
    if (obj === null) return notFound();
    await bucket.delete(path);
    if (obj.httpMetadata?.contentType !== "application/x-directory")
      return new Response(null, { status: 204 });
  }

  const children = listAll(bucket, path === "" ? undefined : `${path}/`);
  for await (const child of children) {
    await bucket.delete(child.key);
  }

  return new Response(null, { status: 204 });
}
