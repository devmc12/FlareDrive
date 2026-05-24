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

Copy `.dev.vars.example` to `.dev.vars` for the local Wrangler Pages Functions
backend:

```env
# Copy this file to .dev.vars for the local Wrangler Pages Functions backend

# WebDAV Basic Auth username checked by the backend
WEBDAV_USERNAME="admin"

# WebDAV Basic Auth password checked by the backend
WEBDAV_PASSWORD="admin"

# Optional limited WebDAV credentials for clients you do not fully trust
# Uncomment and replace each password with the SHA-256 of the raw token secret
# WEBDAV_ACCESS_TOKENS='[{"username":"phone","password":"<sha256-hex>","access":"rw","includes":["photos/phone/"],"excludes":["photos/phone/private/"]},{"username":"reader","password":"<sha256-hex>","access":"ro","includes":["shared/"],"excludes":[]},{"username":"dropbox","password":"<sha256-hex>","access":"up","includes":["uploads/"],"excludes":[]}]'
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

Access token fields:

- `username`: the username entered in the WebDAV client
- `password`: the SHA-256 hash of the raw token secret
- `access`: `ro` for `GET`, `HEAD`, and `PROPFIND`; `rw` for all supported
  WebDAV methods; `up` for upload-only `PUT`, multipart upload `POST`, and
  multipart abort `DELETE`
- `includes`: an array of R2 key prefixes the client can access
- `excludes`: an array of R2 key prefixes the client cannot access, even when
  they are inside `includes`

Path scopes use prefix matching after trimming leading and trailing slashes.
For example, `test/abc` allows `test/abc` and `test/abc/file.txt`, but not
`test/abcd/file.txt`. Excludes take priority over includes. Directory listings
and recursive operations filter excluded descendants, and the server rejects
requests outside the allowed scopes, including `COPY` and `MOVE` destinations.
Upload-only `up` tokens cannot read files, list directories, create folders,
copy, move, or delete existing files. Parent directories must already exist
unless the upload target is at the bucket root.

Clients using a limited token should connect directly to one of the included
prefixes, such as `https://<your-domain.com>/webdav/photos/phone/`.

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
`https://<your-domain.com>/webdav/photos/phone/`, then use the token username
and raw token secret.

However, the standard WebDAV protocol does not support large file (≥128MB) uploads due to the limitation of Cloudflare Workers.
You must upload large files through the web interface which supports chunked uploads.

## Acknowledgments

WebDAV related code is based on [r2-webdav](https://github.com/abersheeran/r2-webdav) project by [abersheeran](https://github.com/abersheeran).
