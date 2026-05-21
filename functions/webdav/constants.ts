/**
 * Date: 2026-05-21
 * Time: 10:13
 * Desc: Defines shared WebDAV route and authorization constants
 */

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

// Methods allowed for read-only WebDAV access
export const READ_METHODS = new Set(["GET", "HEAD", "PROPFIND"]);

// Hex encoded SHA-256 digest length
export const SHA256_HEX_LENGTH = 64;
