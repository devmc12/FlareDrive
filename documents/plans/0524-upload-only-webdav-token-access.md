# Add `up` Upload-Only WebDAV Token Access

## Summary
Add a third token permission value, `access: "up"`, for upload-only credentials. It will reuse the existing `includes` / `excludes` path-scope behavior exactly as-is, with no separate exact-file mode and no special child-path handling.

## Key Changes
- Extend the token access type from `"ro" | "rw"` to `"ro" | "rw" | "up"`.
- Update token validation so `WEBDAV_ACCESS_TOKENS` accepts `"up"`.
- Add upload-only method authorization:
  - Allow `PUT` for normal uploads and multipart part uploads.
  - Allow `POST ?uploads` and `POST ?uploadId=...` for multipart create/complete.
  - Allow `DELETE ?uploadId=...` only for aborting unfinished multipart uploads.
  - Deny `GET`, `HEAD`, `PROPFIND`, `MKCOL`, `COPY`, `MOVE`, and normal `DELETE`.
- Keep current path-scope behavior:
  - `includes` continues matching the configured path itself or descendants.
  - `excludes` continues taking priority.
  - No `targets` field, no exact-match mode.

## Documentation
- Update the token schema docs to include `up`.
- Document that `up` cannot list/read directories and cannot create folders.
- Document that parent directories must already exist unless uploading to root.

## Test Plan
- Run `npx prettier --write` on modified files.
- Run `npm run build`.
- Verify authorization behavior with scoped token logic:
  - `up` allows `PUT` within `includes`.
  - `up` rejects `PROPFIND`, `GET`, `HEAD`, `MKCOL`, `COPY`, `MOVE`, and normal `DELETE`.
  - `up` allows multipart create, part upload, complete, and abort only when the target path is within scope.
  - `excludes` still blocks upload targets inside excluded prefixes.

## Assumptions
- `access: "up"` means upload files only, not folder creation.
- Existing prefix-style `includes` semantics are intentional and should not be changed.
- Upload-only tokens are mainly for controlled clients/scripts or the existing frontend upload path, not generic WebDAV clients that require directory listing before upload.
