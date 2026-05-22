import { handleRequestCopy } from "./copy";
import { handleRequestDelete } from "./delete";
import { type RequestHandlerParams } from "./types";

export async function handleRequestMove({
  bucket,
  path,
  request,
  auth,
}: RequestHandlerParams) {
  const response = await handleRequestCopy({ bucket, path, request, auth });
  if (response.status >= 400) return response;
  return handleRequestDelete({ bucket, path, request, auth });
}
