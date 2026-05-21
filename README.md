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
Fill the endpoint URL as `https://<your-domain.com>/webdav` and use the username and password you set.

However, the standard WebDAV protocol does not support large file (≥128MB) uploads due to the limitation of Cloudflare Workers.
You must upload large files through the web interface which supports chunked uploads.

## Acknowledgments

WebDAV related code is based on [r2-webdav](https://github.com/abersheeran/r2-webdav) project by [abersheeran](https://github.com/abersheeran).
