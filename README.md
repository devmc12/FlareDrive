# FlareDrive

Cloudflare R2 storage manager with Pages and Workers. Free 10 GB storage.
Free serverless backend with a limit of 100,000 invocation requests per day.
[More about pricing](https://developers.cloudflare.com/r2/platform/pricing/)

## Features

- Upload large files
- Create folders
- Search files
- Image/video/PDF thumbnails
- WebDAV endpoint
- Drag and drop upload
- **Scoped WebDAV access tokens**
- **Vite-based frontend**

## Usage

### Local development

Local development runs two separate local servers:

- Frontend: Vite on `http://127.0.0.1:3601`
- Backend: Cloudflare Pages Functions on `http://127.0.0.1:3602`

Copy `.dev.vars.example` to `.dev.vars` for the local Wrangler Pages Functions backend.

Password auth mode requires a D1 database binding named `AUTH_DB`. When running
locally without a Wrangler configuration file, bind a temporary local D1
database through `npm run dev:functions` and apply the schema in the local
Wrangler D1 console or with a private local Wrangler config that is not committed.

For production, create a D1 database in the Cloudflare dashboard, bind it to the
Pages project as `AUTH_DB`, and run this schema in the D1 dashboard SQL console:

```sql
`` npx wrangler d1 execute AUTH_DB --remote --file migrations/0001_auth_sessions.sql
```

Start the local app:

```bash
npm run dev
```

Open:

```text
http://127.0.0.1:3601
```

The frontend calls `/webdav/` on `http://127.0.0.1:3601`, and Vite proxies
that path to the backend at `http://127.0.0.1:3602`. Wrangler loads
`.dev.vars` and binds a local R2 bucket as `BUCKET`. Because browser requests
stay same-origin on port 3601, local CORS is not required.

The frontend does not send development Basic Auth headers automatically. Visit
`http://127.0.0.1:3601/webdav/` to complete the browser login prompt, or test
API requests with an explicit Authorization header when authentication is
required.

Generate a token hash with Node.js:

```bash
node -e "const crypto=require('crypto'); console.log(crypto.createHash('sha256').update(process.argv[1]).digest('hex'))" "raw-token-secret"
```

Generate the private login encryption key with Node.js:

```bash
node -e "const { webcrypto } = require('crypto'); (async () => { const pair = await webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']); console.log(JSON.stringify(await webcrypto.subtle.exportKey('jwk', pair.privateKey))); })()"
```

Access token fields:

- `username`: the username entered in the WebDAV client
- `password`: the SHA-256 hash of the raw token secret
- `access`: `ro` for `GET`, `HEAD`, and `PROPFIND`; `rw` for all supported
  WebDAV methods; `up` for upload-only `PUT`, multipart upload `POST`, and
  multipart abort `DELETE`
- `includes`: an array of R2 key prefixes the client can access
- `excludes`: an array of R2 key prefixes the client cannot access, even when
  they are inside `includes`

Path scopes are R2 object key prefixes after the first `/webdav/` endpoint
prefix is removed. Use prefix matching after trimming leading and trailing
slashes. For example, `webdav/phone` allows `webdav/phone` and
`webdav/phone/file.txt`, but not `webdav/phonebook/file.txt`. The first
`/webdav` in the URL is the HTTP API route; the second `webdav` in
`/webdav/webdav/phone/` is the default R2 folder name used by these examples.
Excludes take priority over includes. Directory listings and recursive
operations filter excluded descendants, and the server rejects requests outside
the allowed scopes, including `COPY` and `MOVE` destinations. Upload-only `up`
tokens cannot read files, list directories, create folders, copy, move, or
delete existing files. Parent directories must already exist unless the upload
target is at the bucket root.

Clients using a limited token should connect directly to one of the included
prefixes, such as `https://<your-domain.com>/webdav/webdav/phone/`. The web app
starts from `/webdav/`, so a scoped token that does not include the root scope
cannot drive the full web app root.

Basic Auth credentials are sent as Base64 in every authenticated WebDAV
request. HTTPS protects the header from ordinary network observers, but a
corporate TLS inspection proxy can see and decode it. When
`FLAREDRIVE_AUTH_MODE="password"`, the web app encrypts the complete login
payload with ECDH P-256 and AES-GCM before sending it, then uses an opaque
`HttpOnly` session cookie after login. The raw session token is not stored in
D1; only its SHA-256 hash is stored. WebDAV clients can still use Basic Auth and
scoped access tokens under `/webdav`.

For a production-like local run without Vite HMR, use:

```bash
npm run dev:preview
```

### Installation

Before starting, you should make sure that

- you have created a [Cloudflare](https://dash.cloudflare.com/) account
- your payment method is added
- R2 service is activated and at least one bucket is created

Steps:

1. Fork this project and connect your fork with Cloudflare Pages
   - Select `Docusaurus` framework preset
   - Set `WEBDAV_USERNAME` and `WEBDAV_PASSWORD`
   - (Optional) Set `WEBDAV_ACCESS_TOKENS` to issue limited client credentials
   - (Optional) Set `WEBDAV_PUBLIC_READ` to `1` to enable public read
   - (Optional) Set `FLAREDRIVE_AUTH_MODE` to `password`, set
     `FLAREDRIVE_LOGIN_ACCOUNT` and `FLAREDRIVE_LOGIN_PRIVATE_KEY`, then bind a
     D1 database as `AUTH_DB`
2. After initial deployment, bind your R2 bucket to `BUCKET` variable
3. Retry deployment in `Deployments` page to apply the changes
4. (Optional) Add a custom domain

You can also deploy this project using Wrangler CLI:

```bash
npm run build
npx wrangler pages deploy build
```

### WebDAV endpoint

You can use any client (such as [Cx File Explorer](https://play.google.com/store/apps/details?id=com.cxinventor.file.explorer), [BD File Manager](https://play.google.com/store/apps/details?id=com.liuzho.file.explorer))
that supports the WebDAV protocol to access your files.
Fill the endpoint URL as `https://<your-domain.com>/webdav` and use the admin
username and password you set. For a limited access token, fill the endpoint URL
with an included prefix, such as
`https://<your-domain.com>/webdav/webdav/phone/`, then use the token username
and raw token secret.

However, the standard WebDAV protocol does not support large file (≥128MB) uploads due to the limitation of Cloudflare Workers.
You must upload large files through the web interface which supports chunked uploads.

## Acknowledgments

WebDAV related code is based on [r2-webdav](https://github.com/abersheeran/r2-webdav) project by [abersheeran](https://github.com/abersheeran).
