# Agent Instructions

## Project Context

This repository is a Vite.js-migrated fork based on `longern/FlareDrive`. It is not
a Create React App, Next.js, or Docusaurus codebase.

Read the local code before changing behavior. The active frontend entry is:

```text
index.html -> /src/index.tsx -> /src/App.tsx
```

The backend is implemented with Cloudflare Pages Functions under:

```text
functions/webdav/
```

## Code Formatting

After modifying any file, run Prettier on it:

```bash
npx prettier --write <modified file path>
```

## Verification

For type checking and production build verification, use:

```bash
npm run build
```

After AI finishes code changes, if browser or server verification is needed,
first visit:

```text
http://127.0.0.1:3601
```

Do not run `npm run dev` immediately. Only start the dev server manually with
`npm run dev` if `http://127.0.0.1:3601` is unavailable or does not serve the
app.

If the AI starts a dev server during the session, stop that server before
ending the session unless the user explicitly asks to keep it running.

## Architecture Rules

- Keep active frontend source under `/src`
- Keep Cloudflare Pages Functions under `/functions`
- Put frontend shared tools and reusable cross-runtime helpers under `/src/app/utils.ts`
- Keep WebDAV-only helper logic in `/functions/webdav/utils.ts`

## Commenting Rules

All project code comments must be written in English.

### File Header Comments

Every source file should include a header comment block after all import
statements, separated by one blank line above and one blank line below.

```ts
import { fetchPath } from './app/transfer';

/**
 * Date: 2026-05-20
 * Time: 14:30
 * Desc: Coordinates file browsing, upload entry points, and selection actions
 */

function Main() {}
```

Rules:

- `Date` and `Time` reflect when the file was first created
- Do not update `Date` or `Time` on later edits
- `Desc` must describe the file responsibility in English and Do not end `Desc` with a period
- Place the block after the last import, not before imports

### Function and Method Comments

Important functions should keep JSDoc comments when they have a reusable
contract, non-obvious parameters, parsing behavior, external API behavior, or a
meaningful return shape.

```ts
/**
 * Extracts WebDAV response items from a PROPFIND XML document
 * @param text Raw XML response text
 * @returns Parsed file item list
 */
function parsePropfindResponse(text: string): FileItem[] {
  return [];
}
```

### Local Comments

Use concise `//` comments on the line above ordinary handlers, local flow, and
constants when the name alone does not explain the intent. Uppercase constants
must always include one.

```ts
// Skip the current directory item returned by PROPFIND
const children = responses.filter(response => response.href !== currentPath);

// Cloudflare Workers regular request uploads are capped below this size
const SIZE_LIMIT = 100 * 1000 * 1000;
```

### Inline Comments

- Never add trailing comments at the end of a line
- Put comments on the line above the code they describe
- Prefer short `//` comments over block comments for local explanations
- Do not end `//`, JSDoc descriptions, `@param`, or `@returns` comments with a
  period

## Commit Messages

- Before committing, run `git add -A` and check `git diff --stat`
- Use one English commit message in the existing `type: subject` style
- Summarize the actual work, not just a filename or directory
