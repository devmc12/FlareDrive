# FlareDrive

基于 Cloudflare R2 的存储管理器，使用 Pages 和 Workers 构建。免费提供 10 GB 存储空间，免费无服务器后端每日调用上限为 100,000 次。
[了解更多定价信息](https://developers.cloudflare.com/r2/platform/pricing/)

## 功能

- 上传大文件
- 支持直接上传文件和整个文件夹，或通过拖拽上传
- WebDAV 端点（支持限定范围的访问令牌）
- 创建文件夹
- 搜索文件
- 图片 / 视频 / PDF 缩略图
- 图片、视频、Word、Excel 和 PowerPoint 文件预览
- Markdown 预览、编辑与保存回传
- 文本文件在线编辑与保存回传
- ZIP 压缩包解压预览，并支持下载单个文件
- 文件移动与复制
- 可选的账号密码登录（使用加密 Session Cookie）
- 可选的 Cloudflare Turnstile 登录验证
- 基于 Vite 的前端

## 使用方式

### 本地开发

本地开发会启动两个独立的本地服务器：

- 前端：Vite 运行在 `http://127.0.0.1:3601`
- 后端：Cloudflare Pages Functions 运行在 `http://127.0.0.1:3602`

将 `.dev.vars.example` 复制为 `.dev.vars`，用于本地 Wrangler Pages Functions 后端配置。

密码认证模式需要一个名为 `AUTH_DB` 的 D1 数据库绑定。在本地运行时如果没有 Wrangler 配置文件，可以通过 `npm run dev:functions` 绑定临时的本地 D1 数据库，并在本地 Wrangler D1 控制台或私有的本地 Wrangler 配置（不提交到仓库）中执行数据库 schema。

生产环境下，在 Cloudflare 控制台创建 D1 数据库，将其绑定到 Pages 项目的 `AUTH_DB`，然后在 D1 控制台的 SQL 界面执行此 schema：

```bash
npx wrangler d1 execute AUTH_DB --remote --file migrations/0001_auth_sessions.sql
```

启动本地应用：

```bash
npm run dev
```

打开：

```text
http://127.0.0.1:3601
```

前端在 `http://127.0.0.1:3601` 上调用 `/webdav/`，Vite 将该路径代理到后端 `http://127.0.0.1:3602`。Wrangler 加载 `.dev.vars` 并将本地 R2 存储桶绑定为 `BUCKET`。由于浏览器请求在 3601 端口保持同源，本地开发不需要 CORS 配置。

前端不会自动发送开发用的 Basic Auth 请求头。请访问 `http://127.0.0.1:3601/webdav/` 完成浏览器登录提示，或在需要认证时使用显式的 Authorization 请求头测试 API 请求。

使用 Node.js 生成令牌哈希：

```bash
node -e "const crypto=require('crypto'); console.log(crypto.createHash('sha256').update(process.argv[1]).digest('hex'))" "raw-token-secret"
```

使用 Node.js 生成登录加密私钥：

```bash
node -e "const { webcrypto } = require('crypto'); (async () => { const pair = await webcrypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveKey']); console.log(JSON.stringify(await webcrypto.subtle.exportKey('jwk', pair.privateKey))); })()"
```

访问令牌字段：

- `username`：WebDAV 客户端中输入的用户名
- `password`：原始令牌密钥的 SHA-256 哈希值
- `access`：`ro` 表示 `GET`、`HEAD` 和 `PROPFIND`；`rw` 表示所有支持的 WebDAV 方法；`up` 表示仅上传的 `PUT`、分片上传 `POST` 和分片中止 `DELETE`
- `includes`：客户端可访问的 R2 键前缀数组
- `excludes`：客户端不可访问的 R2 键前缀数组，即使该前缀在 `includes` 中也会被排除

路径范围是指去掉第一个 `/webdav/` 端点前缀后的 R2 对象键前缀。去除首尾斜杠后使用前缀匹配。例如，`webdav/phone` 允许 `webdav/phone` 和 `webdav/phone/file.txt`，但不允许 `webdav/phonebook/file.txt`。URL 中的第一个 `/webdav` 是 HTTP API 路由；`/webdav/webdav/phone/` 中的第二个 `webdav` 是这些示例使用的默认 R2 文件夹名。`excludes` 优先于 `includes`。目录列表和递归操作会过滤被排除的子项，服务器会拒绝超出允许范围的请求，包括 `COPY` 和 `MOVE` 的目标路径。仅上传（`up`）令牌不能读取文件、列出目录、创建文件夹、复制、移动或删除已有文件。上传目标位于存储桶根目录时，父目录无需提前存在。

使用限定令牌的客户端应直接连接到包含的前缀之一，例如 `https://<your-domain.com>/webdav/webdav/phone/`。Web 应用从 `/webdav/` 开始，因此不包含根范围的限定令牌无法驱动完整的 Web 应用根目录。

Basic Auth 凭据以 Base64 格式在每个经过认证的 WebDAV 请求中发送。HTTPS 可防止普通网络监听者获取请求头，但企业 TLS 检查代理可以看到并解码它。当 `FLAREDRIVE_AUTH_MODE="password"` 时，Web 应用使用 ECDH P-256 和 AES-GCM 加密完整的登录载荷后再发送，登录后使用不透明的 `HttpOnly` 会话 Cookie。原始会话令牌不会存储在 D1 中，仅存储其 SHA-256 哈希值。WebDAV 客户端仍可在 `/webdav` 下使用 Basic Auth 和限定范围的访问令牌。

如需在密码登录前添加 Cloudflare Turnstile 验证，请创建 Turnstile widget 并同时设置 `FLAREDRIVE_TURNSTILE_SITE_KEY` 和 `FLAREDRIVE_TURNSTILE_SECRET_KEY`。登录 API 会在解密和校验密码之前先验证 Turnstile 令牌。WebDAV 客户端继续使用 Basic Auth 或限定范围的访问令牌访问 `/webdav`。

如需模拟生产环境运行（无 Vite HMR），使用：

```bash
npm run dev:preview
```

### 安装部署

开始之前，请确保：

- 已创建 [Cloudflare](https://dash.cloudflare.com/) 账户
- 已添加支付方式
- 已激活 R2 服务并创建了至少一个存储桶

步骤：

1. Fork 本项目并将 fork 与 Cloudflare Pages 连接
   - 选择 `Docusaurus` 框架预设
   - 设置 `WEBDAV_USERNAME` 和 `WEBDAV_PASSWORD`
   - （可选）设置 `WEBDAV_ACCESS_TOKENS` 以签发限定范围的客户端凭据
   - （可选）设置 `WEBDAV_PUBLIC_READ` 为 `1` 以启用公共读取
   - （可选）设置 `FLAREDRIVE_AUTH_MODE` 为 `password`，设置 `FLAREDRIVE_LOGIN_ACCOUNT` 和 `FLAREDRIVE_LOGIN_PRIVATE_KEY`，可选设置 `FLAREDRIVE_TURNSTILE_SITE_KEY` 和 `FLAREDRIVE_TURNSTILE_SECRET_KEY`，然后将 D1 数据库绑定为 `AUTH_DB`
2. 初次部署后，将 R2 存储桶绑定到 `BUCKET` 变量
3. 在「Deployments」页面重新部署以应用更改
4. （可选）添加自定义域名

也可以使用 Wrangler CLI 部署：

```bash
npm run build
npx wrangler pages deploy build
```

### WebDAV 端点

你可以使用任何支持 WebDAV 协议的客户端（如 [Cx File Explorer](https://play.google.com/store/apps/details?id=com.cxinventor.file.explorer)、[BD File Manager](https://play.google.com/store/apps/details?id=com.liuzho.file.explorer)）访问文件。将端点 URL 填写为 `https://<your-domain.com>/webdav`，使用管理员用户名和密码。对于限定范围的访问令牌，将端点 URL 填写为包含的前缀之一，例如 `https://<your-domain.com>/webdav/webdav/phone/`，然后使用令牌用户名和原始令牌密钥。

由于 Cloudflare Workers 的限制，标准 WebDAV 协议不支持大文件（≥128MB）上传。大文件必须通过支持分片上传的 Web 界面上传。

## 致谢

WebDAV 相关代码基于 [abersheeran](https://github.com/abersheeran) 的 [r2-webdav](https://github.com/abersheeran/r2-webdav) 项目。
