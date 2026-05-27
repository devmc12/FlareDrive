import type { FlareDriveAuthEnv } from "../auth";

/**
 * Date: 2026-05-21
 * Time: 10:13
 * Desc: Defines shared WebDAV request and authorization types
 */

/**
 * Shared shape passed from the WebDAV router into each method handler
 */
export interface RequestHandlerParams {
  bucket: R2Bucket;
  path: string;
  request: Request;
  auth: WebDavAuthContext;
}

/**
 * Access level assigned to a WebDAV access token
 */
export type WebDavAccess = "ro" | "rw" | "up";

/**
 * Username and raw password parsed from a Basic Auth header
 */
export type BasicCredentials = {
  username: string;
  password: string;
};

/**
 * Limited WebDAV credential loaded from WEBDAV_ACCESS_TOKENS
 */
export type WebDavAccessToken = {
  username: string;
  password: string;
  access: WebDavAccess;
  includes: string[];
  excludes: string[];
};

/**
 * Successful authorization result used for future request policy decisions
 */
export type WebDavAuthContext = {
  kind: "admin" | "public" | "session" | "token";
  access: WebDavAccess;
  includes: string[];
  excludes: string[];
  username?: string;
};

/**
 * Cloudflare environment variables used by WebDAV authorization
 */
export type WebDavAuthEnv = FlareDriveAuthEnv & {
  WEBDAV_USERNAME?: string;
  WEBDAV_PASSWORD?: string;
  WEBDAV_ACCESS_TOKENS?: string;
  WEBDAV_PUBLIC_READ?: string;
};

/**
 * Result returned by the WebDAV authorization helper
 */
export type WebDavAuthResult =
  | {
      ok: true;
      context: WebDavAuthContext;
    }
  | {
      ok: false;
      response: Response;
    };
