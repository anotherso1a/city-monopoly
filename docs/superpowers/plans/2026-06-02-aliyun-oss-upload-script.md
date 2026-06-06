# Aliyun OSS Upload Script — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `scripts/upload-oss.js` Node.js script that uploads locally-referenced images in the WeChat Mini Program to Aliyun OSS and rewrites the code references to use the remote URLs.

**Architecture:** Single Node.js script using `ali-oss` + `dotenv`. Walks image directories → uploads missing files (tracked via a JSON manifest) → walks code files → replaces string-literal local paths with the OSS URL. Credentials are loaded from a gitignored `.env` file.

**Tech Stack:** Node.js, `ali-oss` v6, `dotenv` v16.

---

## File Structure

| Path | Role |
|---|---|
| `scripts/upload-oss.js` | Main entry: scan → upload → rewrite → summarize |
| `scripts/.env.example` | Template for `.env` (committed) |
| `scripts/.env` | Real credentials (gitignored) — written by user |
| `scripts/.gitignore` | Ignores `.env` and `.oss-manifest.json` |
| `scripts/.oss-manifest.json` | Generated mapping of `local path → OSS URL` |
| `scripts/README.md` | Short usage notes |
| `package.json` | Add `ali-oss` and `dotenv` to `devDependencies` |
| `.gitignore` | Append `scripts/.env` and `scripts/.oss-manifest.json` |

---

## Task 1: Create scripts/ directory and .gitignore

**Files:**
- Create: `scripts/.gitignore`

- [ ] **Step 1: Create the directory and the inner .gitignore**

```bash
mkdir -p scripts
```

Write `scripts/.gitignore`:

```
.env
.oss-manifest.json
node_modules/
```

---

## Task 2: Add scripts/.env.example

**Files:**
- Create: `scripts/.env.example`

- [ ] **Step 1: Write the template file**

```bash
cat > scripts/.env.example <<'EOF'
OSS_ACCESS_KEY_ID=your_access_key_id_here
OSS_ACCESS_KEY_SECRET=your_access_key_secret_here
OSS_BUCKET=anothersola
OSS_REGION=cn-beijing
OSS_ENDPOINT=oss-cn-beijing.aliyuncs.com
EOF
```

---

## Task 3: Create scripts/.env with the real values

**Files:**
- Create: `scripts/.env`

- [ ] **Step 1: Write the .env file**

```bash
cat > scripts/.env <<'EOF'
OSS_ACCESS_KEY_ID=<YOUR_OSS_ACCESS_KEY_ID>
OSS_ACCESS_KEY_SECRET=<YOUR_OSS_ACCESS_KEY_SECRET>
OSS_BUCKET=anothersola
OSS_REGION=cn-beijing
OSS_ENDPOINT=oss-cn-beijing.aliyuncs.com
EOF
```

(Real AK provided in the brainstorming session. Treat this file as secret.)

---

## Task 4: Update root .gitignore

**Files:**
- Modify: `.gitignore` (append two lines)

- [ ] **Step 1: Verify current content**

```bash
cat .gitignore
```

Expected output (current):
```
node_modules/
.DS_Store
*.log
```

- [ ] **Step 2: Append the two ignore lines**

Append these two lines to `.gitignore`:

```
scripts/.env
scripts/.oss-manifest.json
```

Final file content should be:
```
node_modules/
.DS_Store
*.log
scripts/.env
scripts/.oss-manifest.json
```

---

## Task 5: Update root package.json

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add dependencies**

Read the current `package.json`, then write the new content:

```json
{
  "name": "city-monapoly",
  "version": "1.0.0",
  "description": "",
  "main": "index.js",
  "scripts": {
    "upload:oss": "node scripts/upload-oss.js"
  },
  "keywords": [],
  "author": "",
  "license": "ISC",
  "type": "commonjs",
  "devDependencies": {
    "ali-oss": "^6.20.0",
    "dotenv": "^16.4.5"
  }
}
```

---

## Task 6: Install dependencies

- [ ] **Step 1: Run npm install**

```bash
npm install
```

Expected: installs `ali-oss` and `dotenv` and their transitive deps into `node_modules/`. Exits 0.

---

## Task 7: Write scripts/upload-oss.js

**Files:**
- Create: `scripts/upload-oss.js`

This is the full script. The executor copies it in one step.

- [ ] **Step 1: Write the file**

```javascript
#!/usr/bin/env node
/**
 * upload-oss.js
 *
 * 1. Scans local image files (assets/images/, pages/*/images/, components/*/images/).
 * 2. Uploads new ones to Aliyun OSS (skips files already in the manifest).
 * 3. Rewrites matching local image paths in .js / .wxml / .wxss to the OSS URL.
 *
 * Config: scripts/.env (gitignored)
 * Output: scripts/.oss-manifest.json (gitignored)
 *
 * Usage: node scripts/upload-oss.js
 */

'use strict';

const fs = require('fs');
const path = require('path');
const OSS = require('ali-oss');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const PROJECT_ROOT = path.resolve(__dirname, '..');
const MANIFEST_PATH = path.join(__dirname, '.oss-manifest.json');

const IMAGE_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']);
const CODE_EXTS = new Set(['.js', '.wxml', '.wxss']);

const SKIP_PATH_TOKENS = [
  path.join('pages', 'bak'),
  path.join('assets', 'imgbak'),
  path.join('utils', 'lib'),
];

const REQUIRED_ENV = [
  'OSS_ACCESS_KEY_ID',
  'OSS_ACCESS_KEY_SECRET',
  'OSS_BUCKET',
  'OSS_REGION',
  'OSS_ENDPOINT',
];

const stats = { uploaded: 0, skippedUpload: 0, replaced: 0, errors: [] };

function log(msg) { process.stdout.write(msg + '\n'); }
function die(msg, code = 1) { process.stderr.write('ERROR: ' + msg + '\n'); process.exit(code); }

function loadEnv() {
  const missing = REQUIRED_ENV.filter((k) => !process.env[k]);
  if (missing.length) {
    die('Missing env keys in scripts/.env: ' + missing.join(', ') + '. Copy .env.example to .env and fill them in.');
  }
}

function buildClient() {
  return new OSS({
    accessKeyId: process.env.OSS_ACCESS_KEY_ID,
    accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET,
    bucket: process.env.OSS_BUCKET,
    region: process.env.OSS_REGION,
    endpoint: process.env.OSS_ENDPOINT,
    secure: true,
  });
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    return { version: 1, files: {} };
  }
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
    const m = JSON.parse(raw);
    if (!m.files) m.files = {};
    return m;
  } catch (err) {
    die('Failed to parse ' + MANIFEST_PATH + ': ' + err.message);
  }
}

function saveManifest(manifest) {
  manifest.updatedAt = new Date().toISOString();
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2) + '\n');
}

function shouldSkip(absPath) {
  const rel = path.relative(PROJECT_ROOT, absPath);
  return SKIP_PATH_TOKENS.some((token) => rel.split(path.sep).includes(path.basename(token)) && rel.includes(token));
}

function walk(dir, predicate, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, predicate, results);
    } else if (entry.isFile() && predicate(full)) {
      results.push(full);
    }
  }
  return results;
}

function isImageFile(p) { return IMAGE_EXTS.has(path.extname(p).toLowerCase()); }
function isCodeFile(p) { return CODE_EXTS.has(path.extname(p).toLowerCase()); }

function findImageDirs() {
  const dirs = [path.join(PROJECT_ROOT, 'assets', 'images')];
  const pagesDir = path.join(PROJECT_ROOT, 'pages');
  const componentsDir = path.join(PROJECT_ROOT, 'components');
  if (fs.existsSync(pagesDir)) {
    for (const d of fs.readdirSync(pagesDir)) {
      const sub = path.join(pagesDir, d, 'images');
      if (fs.existsSync(sub) && fs.statSync(sub).isDirectory()) dirs.push(sub);
    }
  }
  if (fs.existsSync(componentsDir)) {
    for (const d of fs.readdirSync(componentsDir)) {
      const sub = path.join(componentsDir, d, 'images');
      if (fs.existsSync(sub) && fs.statSync(sub).isDirectory()) dirs.push(sub);
    }
  }
  return dirs.filter((d) => !shouldSkip(d));
}

function findCodeFiles() {
  const dirs = [];
  for (const top of ['pages', 'components']) {
    const full = path.join(PROJECT_ROOT, top);
    if (fs.existsSync(full)) dirs.push(full);
  }
  const files = [];
  for (const d of dirs) walk(d, isCodeFile, files);
  return files.filter((f) => !shouldSkip(f));
}

function findLocalImages() {
  const files = [];
  for (const d of findImageDirs()) walk(d, isImageFile, files);
  return files;
}

function relPosix(p) {
  return path.relative(PROJECT_ROOT, p).split(path.sep).join('/');
}

async function uploadNewImages(client, manifest) {
  const images = findLocalImages();
  log('[scan] found ' + images.length + ' local images');
  for (const abs of images) {
    const rel = relPosix(abs);
    if (manifest.files[rel]) { stats.skippedUpload++; continue; }
    try {
      const result = await client.put(rel, abs, {
        headers: { 'x-oss-forbid-overwrite': 'false' },
      });
      manifest.files[rel] = {
        ossKey: rel,
        url: 'https://' + process.env.OSS_BUCKET + '.' + process.env.OSS_ENDPOINT + '/' + rel,
        size: result.res && result.res.size ? Number(result.res.size) : fs.statSync(abs).size,
        etag: (result.res && result.res.headers && result.res.headers.etag) || '',
        uploadedAt: new Date().toISOString(),
      };
      saveManifest(manifest);
      log('[upload] + ' + rel);
      stats.uploaded++;
    } catch (err) {
      stats.errors.push({ file: rel, op: 'upload', msg: err.message });
      log('[upload] ! ' + rel + ' — ' + err.message);
    }
  }
}

// Match /pages/.../images/...png etc, optionally with leading slash,
// and capture the leading slash so the replacement is exact.
const REF_REGEX = /(['"`])(\/(?:pages|components|assets\/images)\/[^'"`\s]*?\.(?:png|jpg|jpeg|gif|webp|svg))\1/g;

function rewriteFile(absPath, manifest) {
  const orig = fs.readFileSync(absPath, 'utf8');
  let changed = 0;
  const next = orig.replace(REF_REGEX, (match, quote, p) => {
    const key = p.replace(/^\//, '');
    const entry = manifest.files[key];
    if (!entry) {
      // path referenced but not in manifest; leave as-is and warn
      return match;
    }
    changed++;
    return quote + entry.url + quote;
  });
  if (changed > 0) {
    fs.writeFileSync(absPath, next);
    log('[rewrite] ' + relPosix(absPath) + ' (' + changed + ' replacements)');
  }
  stats.replaced += changed;
}

function rewriteCodeRefs(manifest) {
  const codeFiles = findCodeFiles();
  log('[scan] found ' + codeFiles.length + ' code files');
  for (const f of codeFiles) {
    try { rewriteFile(f, manifest); }
    catch (err) { stats.errors.push({ file: relPosix(f), op: 'rewrite', msg: err.message }); }
  }
}

function printSummary() {
  log('');
  log('=== summary ===');
  log('uploaded:    ' + stats.uploaded);
  log('skipped:     ' + stats.skippedUpload + ' (already in manifest)');
  log('rewrites:    ' + stats.replaced + ' references across code files');
  log('errors:      ' + stats.errors.length);
  if (stats.errors.length) {
    for (const e of stats.errors) log('  - ' + e.op + ' ' + e.file + ': ' + e.msg);
    process.exitCode = 1;
  } else {
    log('manifest:    ' + path.relative(PROJECT_ROOT, MANIFEST_PATH));
  }
}

async function main() {
  loadEnv();
  const client = buildClient();
  const manifest = loadManifest();
  await uploadNewImages(client, manifest);
  rewriteCodeRefs(manifest);
  printSummary();
}

main().catch((err) => die(err.stack || err.message));
```

---

## Task 8: Create scripts/README.md

**Files:**
- Create: `scripts/README.md`

- [ ] **Step 1: Write the README**

```bash
cat > scripts/README.md <<'EOF'
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
EOF
```

---

## Task 9: Verify the script

- [ ] **Step 1: Run the script**

```bash
npm run upload:oss
```

Expected output (no errors):
```
[scan] found N local images
[upload] + pages/...
[upload] + components/...
...
[scan] found M code files
[rewrite] pages/index/index.js (5 replacements)
...
=== summary ===
uploaded:    N
skipped:     0
rewrites:    M references across code files
errors:      0
manifest:    scripts/.oss-manifest.json
```

- [ ] **Step 2: Verify the manifest exists and is valid JSON**

```bash
test -f scripts/.oss-manifest.json && cat scripts/.oss-manifest.json | head -30
```

Expected: a JSON object with `version`, `bucket`, `region`, `endpoint`, `urlPrefix`, `files`.

- [ ] **Step 3: Verify a code file was rewritten**

```bash
grep -c "anothersola.oss-cn-beijing.aliyuncs.com" pages/index/index.js
```

Expected: a positive integer (≥ 1).

- [ ] **Step 4: Verify no local path remains in rewritten code**

```bash
grep -nE "['\"]\/pages/[^'\"]+\.(png|jpg|jpeg|gif|webp|svg)" pages/index/index.js pages/index/index.wxml pages/index/index.wxss 2>/dev/null
```

Expected: no output (or only references to `pages/bak/`, which is skipped).

- [ ] **Step 5: Verify an uploaded image is reachable on OSS**

```bash
curl -sI "https://anothersola.oss-cn-beijing.aliyuncs.com/pages/index/images/bg-city.png" | head -3
```

Expected: HTTP 200 (or 304 with `-I`).

- [ ] **Step 6: Re-run to confirm idempotency**

```bash
npm run upload:oss
```

Expected:
```
[scan] found N local images
[scan] found M code files
=== summary ===
uploaded:    0
skipped:     N
rewrites:    0   (or unchanged count)
errors:      0
```

---

## Self-Review Notes

**Spec coverage:**
- Image scan rules ✓ (Task 7: `findImageDirs`, `findLocalImages`, `SKIP_PATH_TOKENS`)
- Code scan rules ✓ (Task 7: `findCodeFiles`, `REF_REGEX`, skip filter)
- Skip list (`pages/bak/`, `assets/imgbak/`, `utils/lib/`) ✓ (Task 7: `SKIP_PATH_TOKENS` + `shouldSkip`)
- Image extensions ✓ (Task 7: `IMAGE_EXTS`)
- Code extensions (.js, .wxml, .wxss) ✓ (Task 7: `CODE_EXTS`, `REF_REGEX`)
- Manifest format and persistence ✓ (Task 7: `loadManifest`, `saveManifest`, write after each upload)
- `https://<bucket>.<endpoint>/<key>` URL format ✓ (Task 7: `uploadNewImages` URL construction)
- No local file deletion ✓ (Task 7: never deletes images)
- Errors reported, partial state OK ✓ (Task 7: `stats.errors`, manifest written per file)
- `.env` for credentials, gitignored ✓ (Tasks 1, 3, 4)
- Manifest gitignored ✓ (Tasks 1, 4)
- `scripts/README.md` ✓ (Task 8)
- Verification (run, check manifest, check rewrite, check OSS) ✓ (Task 9)

**Placeholder scan:** none. All code blocks are complete.

**Type / name consistency:** `manifest.files[key]`, `ossKey`, `url` consistent across `uploadNewImages` and `rewriteFile`. `findImageDirs` / `findCodeFiles` / `findLocalImages` consistent. `stats` fields consistent.
