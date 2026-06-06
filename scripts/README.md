# scripts/

## upload-oss.js

Uploads local image files referenced by the WeChat Mini Program code to Aliyun
OSS, then rewrites the references to the remote URL.

### One-time setup

```bash
cp scripts/.env.example scripts/.env
# edit scripts/.env and fill in real OSS credentials
npm install
```

### Run

```bash
npm run upload:oss
# or
node scripts/upload-oss.js
```

### Behaviour

- Scans `assets/images/`, `pages/*/images/`, `components/*/images/`
- Skips `pages/bak/`, `assets/imgbak/`, `utils/lib/`
- Only uploads images that are not already in `scripts/.oss-manifest.json`
  (re-running is a no-op for already-uploaded files)
- Rewrites `'/pages/...png'`, `"/components/...png"`, and WXML `<image src="/...png"/>`
  style references in `.js` / `.wxml` / `.wxss`
- Does not delete local image files
- Local files are the source of truth; to re-upload, delete the entry from the
  manifest

### Security

- `scripts/.env` contains credentials and is gitignored. Never commit it.
- `scripts/.oss-manifest.json` is gitignored.
- If the AccessKey is ever leaked (e.g. shared in chat), rotate it in the
  Aliyun console before continuing.
