import { ROOT_OBJECT, WEBDAV_ENDPOINT } from "./constants";
import { type RequestHandlerParams } from "./types";
import { isPathAllowedByAuthContext, listAll } from "./utils";

/**
 * Date: 2024-07-08
 * Time: 11:29
 * Desc: Builds WebDAV PROPFIND XML responses from R2 object metadata
 */

type DavPropertyValue =
  | {
      value: string;
      escaped: boolean;
    }
  | undefined;

type DavProperties = {
  creationdate: DavPropertyValue;
  displayname: DavPropertyValue;
  getcontentlanguage: DavPropertyValue;
  getcontentlength: DavPropertyValue;
  getcontenttype: DavPropertyValue;
  getetag: DavPropertyValue;
  getlastmodified: DavPropertyValue;
  resourcetype: DavPropertyValue;
  "fd:thumbnail": DavPropertyValue;
};

/**
 * Wraps a plain text DAV property so it will be XML-escaped when rendered
 * @param value Raw property value
 * @returns Renderable text property
 */
function textProperty(value: string | undefined): DavPropertyValue {
  return value === undefined ? undefined : { value, escaped: true };
}

/**
 * Wraps a trusted DAV XML fragment for properties that contain child elements
 * @param value Raw DAV XML fragment
 * @returns Renderable raw XML property
 */
function rawXmlProperty(value: string): DavPropertyValue {
  return { value, escaped: false };
}

function fromR2Object(object: R2Object | typeof ROOT_OBJECT): DavProperties {
  return {
    creationdate: textProperty(object.uploaded.toISOString()),
    displayname: textProperty(object.httpMetadata?.contentDisposition),
    getcontentlanguage: textProperty(object.httpMetadata?.contentLanguage),
    getcontentlength: textProperty(object.size.toString()),
    getcontenttype: textProperty(object.httpMetadata?.contentType),
    getetag: textProperty(object.etag),
    getlastmodified: textProperty(object.uploaded.toUTCString()),
    resourcetype: rawXmlProperty(
      object.httpMetadata?.contentType === "application/x-directory"
        ? "<collection />"
        : ""
    ),
    "fd:thumbnail": textProperty(object.customMetadata?.thumbnail),
  };
}

/**
 * Escapes text for XML element content
 * @param value Raw text value
 * @returns XML-safe text
 */
function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Encodes a WebDAV href path while preserving directory separators
 * @param key R2 object key
 * @returns XML-safe encoded WebDAV href
 */
function encodeDavHref(key: string) {
  const encodedKey = key.split("/").map(encodeURIComponent).join("/");
  return escapeXml(`${WEBDAV_ENDPOINT}${encodedKey}`);
}

/**
 * Renders one DAV property element
 * @param key XML property tag name
 * @param property Renderable property value
 * @returns XML property element
 */
function renderProperty(
  key: string,
  property: Exclude<DavPropertyValue, undefined>
) {
  const value = property.escaped ? escapeXml(property.value) : property.value;
  return `<${key}>${value}</${key}>`;
}

/**
 * Narrows DAV property entries to values that should be rendered
 * @param entry Property key and optional value
 * @returns Whether the property has a renderable value
 */
function hasPropertyValue(
  entry: [string, DavPropertyValue]
): entry is [string, Exclude<DavPropertyValue, undefined>] {
  return entry[1] !== undefined;
}

async function findChildren({
  bucket,
  path,
  depth,
  auth,
}: {
  bucket: R2Bucket;
  path: string;
  depth: string;
  auth: RequestHandlerParams["auth"];
}) {
  if (!["1", "infinity"].includes(depth)) return [];

  const objects: Array<R2Object> = [];

  const prefix = path === "" ? path : `${path}/`;
  for await (const object of listAll(bucket, prefix, depth === "infinity")) {
    if (isPathAllowedByAuthContext(auth, object.key)) objects.push(object);
  }

  return objects;
}

export async function handleRequestPropfind({
  bucket,
  path,
  request,
  auth,
}: RequestHandlerParams) {
  const responseTemplate = `<?xml version="1.0" encoding="utf-8" ?>
<multistatus xmlns="DAV:" xmlns:fd="flaredrive">
{{items}}
</multistatus>`;

  const rootObject = path === "" ? ROOT_OBJECT : await bucket.head(path);
  if (!rootObject) return new Response("Not found", { status: 404 });
  const isDirectory =
    rootObject === ROOT_OBJECT ||
    rootObject.httpMetadata?.contentType === "application/x-directory";
  const depth = request.headers.get("Depth") ?? "infinity";

  const children = !isDirectory
    ? []
    : await findChildren({
        bucket,
        path,
        depth,
        auth,
      });

  const items = [rootObject, ...children].map((child) => {
    const properties = fromR2Object(child);
    return `
  <response>
    <href>${encodeDavHref(child.key)}</href>
    <propstat>
      <prop>
        ${Object.entries(properties)
          .filter(hasPropertyValue)
          .map(([key, value]) => renderProperty(key, value))
          .join("\n")}
      </prop>
      <status>HTTP/1.1 200 OK</status>
    </propstat>
  </response>`;
  });

  return new Response(responseTemplate.replace("{{items}}", items.join("")), {
    status: 207,
    headers: { "Content-Type": "application/xml" },
  });
}
