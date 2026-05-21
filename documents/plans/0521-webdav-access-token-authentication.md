# WebDAV Access Token Authentication

## Summary

Add API-level access tokens for `/webdav/*`. WebDAV clients still use standard Basic Auth, but instead of the main admin password they can use dedicated tokens with read/write mode and an allowed path prefix. The web UI auth flow is not changed; if the frontend calls `/webdav/*` with a limited token, the same API restrictions apply naturally.

## Key Changes

- Keep `WEBDAV_USERNAME` / `WEBDAV_PASSWORD` as the full-access admin credential
- Add `WEBDAV_ACCESS_TOKENS` as a JSON array of limited WebDAV credentials:
  ```env
  WEBDAV_ACCESS_TOKENS='[
    {"username":"phone","passwordSha256":"<sha256-hex>","access":"rw","prefix":"photos/phone/"},
    {"username":"reader","passwordSha256":"<sha256-hex>","access":"ro","prefix":"shared/"}
  ]'
  ```
- Support `access` values:
  - `ro`: allow `GET`, `HEAD`, `PROPFIND`
  - `rw`: allow all currently supported WebDAV methods
- Enforce `prefix` so requests must target the configured directory or its children
- Require `COPY` and `MOVE` `Destination` headers to stay inside the same allowed prefix
- Preserve current behavior when `WEBDAV_ACCESS_TOKENS` is not configured
- Do not add a web login page, sessions, cookies, JWTs, or separate frontend auth

## Implementation Notes

- Add a WebDAV auth helper under `functions/webdav` to parse Basic Auth, validate admin credentials, validate token SHA-256 hashes, and return an auth context
- In `functions/webdav/[[path]].ts`, run auth before dispatching to method handlers and reject unauthorized or out-of-scope requests with `401` or `403`
- Keep `WEBDAV_PUBLIC_READ=1` behavior unchanged for `GET`, `HEAD`, and `PROPFIND`
- Update `.dev.vars.example` and README with token configuration, SHA-256 generation instructions, and client setup guidance
- Frontend code does not need a new login system; local frontend credentials can optionally be set to a token user/secret for testing

## Test Plan

- Run `npm run build`
- Verify admin credentials still have full read/write access to all paths
- Verify an `rw` token can list, upload, move, copy, and delete only within its prefix
- Verify an `ro` token can list and download within its prefix but cannot write, delete, copy, or move
- Verify token requests outside the prefix return `403`
- Verify `COPY` and `MOVE` to destinations outside the prefix return `403`
- Verify missing or invalid Basic Auth still returns `401`
- Verify no `WEBDAV_ACCESS_TOKENS` configuration keeps current behavior unchanged

## Assumptions

- This is a new WebDAV API authorization feature, not a web frontend login feature
- v1 stores token definitions in environment variables, not in R2 or a management UI
- v1 does not implement virtual root mapping; clients should connect directly to `/webdav/<prefix>/`
- Token secrets are stored server-side only as SHA-256 hashes; HTTPS is still required for transport security
