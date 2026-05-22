import { handleRequestCopy } from "./copy";
import { handleRequestDelete } from "./delete";
import { handleRequestGet } from "./get";
import { handleRequestHead } from "./head";
import { handleRequestMkcol } from "./mkcol";
import { handleRequestMove } from "./move";
import { handleRequestPost } from "./post";
import { handleRequestPropfind } from "./propfind";
import { handleRequestPut } from "./put";
import { type RequestHandlerParams, type WebDavAuthEnv } from "./types";
import { authorizeWebDavRequest, notFound, parseBucketPath } from "./utils";

/**
 * Date: 2024-07-08
 * Time: 11:29
 * Desc: Routes authenticated WebDAV requests to Cloudflare Pages handlers
 */

async function handleRequestOptions() {
  return new Response(null, {
    headers: {
      Allow: Object.keys(HANDLERS).join(", "),
      DAV: "1",
    },
  });
}

async function handleMethodNotAllowed() {
  return new Response(null, { status: 405 });
}

// Supported WebDAV method handlers
const HANDLERS: Record<
  string,
  (context: RequestHandlerParams) => Promise<Response>
> = {
  PROPFIND: handleRequestPropfind,
  MKCOL: handleRequestMkcol,
  HEAD: handleRequestHead,
  GET: handleRequestGet,
  POST: handleRequestPost,
  PUT: handleRequestPut,
  COPY: handleRequestCopy,
  MOVE: handleRequestMove,
  DELETE: handleRequestDelete,
};

export const onRequest: PagesFunction<WebDavAuthEnv> = async function (
  context
) {
  const env = context.env;
  const request: Request = context.request;
  if (request.method === "OPTIONS") return handleRequestOptions();

  const [bucket, path] = parseBucketPath(context);
  const auth = await authorizeWebDavRequest({ env, path, request });
  if (!auth.ok) return auth.response;

  if (!bucket) return notFound();

  const method: string = (context.request as Request).method;
  const handler = HANDLERS[method] ?? handleMethodNotAllowed;
  return handler({
    bucket,
    path,
    request: context.request,
    auth: auth.context,
  });
};
