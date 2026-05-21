# Write Thumbnail Plan Document

**File Content**

```md
# Per-File Thumbnail Naming Plan

## Summary

Change thumbnail naming from content SHA-1 deduplication to a per-file thumbnail id. Upload, COPY, and MOVE should each produce an independent thumbnail object, so DELETE can remove the thumbnail referenced by the deleted file metadata without scanning the whole bucket.

## Implementation Changes

- Generate a random thumbnail id on upload, preferably with `crypto.randomUUID()`
- Store thumbnails under `_$flaredrive$/thumbnails/<id>.png`
- Keep using `fd-thumbnail` and `customMetadata.thumbnail`
- Copy thumbnails during COPY by creating a new thumbnail id for the destination object
- Let MOVE continue through COPY + DELETE, so moved files receive a new thumbnail and old thumbnails are cleaned by DELETE
- Delete the thumbnail referenced by `customMetadata.thumbnail` when deleting a file or directory contents
- Do not scan the whole bucket for thumbnail references

## Interfaces

- WebDAV paths stay unchanged
- Metadata field stays `customMetadata.thumbnail`
- Frontend display logic stays based on `file.customMetadata.thumbnail`
- Thumbnail id changes from SHA-1 hex to UUID-style ids for new uploads and copies

## Test Plan

- Upload image, video, and PDF files and verify thumbnails display
- Upload duplicate image content and verify each file has a different thumbnail id
- COPY a file with a thumbnail and verify the target has a new thumbnail id
- MOVE a file with a thumbnail and verify the target has a new thumbnail id
- DELETE a file and verify its thumbnail object is deleted
- DELETE a directory and verify thumbnails for contained files are deleted
- Run `npm run build`

## Assumptions

- Existing SHA-1 thumbnail objects remain readable for old files
- This plan primarily fixes new uploads, copies, moves, and deletes
- Historical shared SHA-1 thumbnails may need a separate migration or cleanup task
```

**Implementation Notes**

- Do not modify `.env.development` or `utils/webdav.ts`
- Use UTF-8 Markdown
- No Prettier run is required unless the project formats Markdown files explicitly
