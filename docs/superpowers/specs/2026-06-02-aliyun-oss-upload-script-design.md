# Aliyun OSS Upload Script — Design

Date: 2026-06-02
Status: Approved (user granted blanket approval to proceed without per-section confirmation)

## Overview

A Node.js utility script that scans the WeChat Mini Program project for locally-referenced image files, uploads them to an Aliyun OSS bucket, and rewrites the code references to point at the remote URLs. The script preserves local files (does not delete), only uploads images that have not been uploaded before (tracked by a manifest), and outputs a manifest of all `local path → OSS URL` mappings for inspection.

## Goals

- One-command upload + rewrite flow: `node scripts/upload-oss.js`
- Idempotent: re-running only uploads images not already in the manifest
- Safe: credentials never committed; only authorized paths scanned; bak/ and third-party dirs skipped
- Reversible: local files are not deleted; code rewrites are plain text edits (git revertable)

## Non-Goals

- Deleting local image files after upload (user explicitly opted out)
- CDN cache invalidation
- Image optimization / re-encoding
- Resumable uploads for very large files (none expected in this project)
- Replacing references in archived code (`pages/bak/`)
- A GUI or web UI

## User Configuration (`.env`)

The script reads from `scripts/.env` via `dotenv`. The `.env` file is gitignored. A template (`scripts/.env.example`) is committed.

```
OSS_ACCESS_KEY_ID=<YOUR_OSS_ACCESS_KEY_ID>
OSS_ACCESS_KEY_SECRET=<YOUR_OSS_ACCESS_KEY_SECRET>
OSS_BUCKET=anothersola
OSS_REGION=cn-beijing
OSS_ENDPOINT=oss-cn-beijing.aliyuncs.com
```

`OSS_ENDPOINT` and `urlPrefix` are computed from bucket + endpoint. No custom CDN is configured.

## Files Created

```
city-monapoly/
├── scripts/                            # new directory
│   ├── upload-oss.js                   # main script (single file)
│   ├── .env                            # real credentials, gitignored
│   ├── .env.example                    # template, committed
│   ├── .oss-manifest.json              # generated, gitignored
│   ├── .gitignore                      # ignores .env and .oss-manifest.json
│   └── README.md                       # short usage notes
├── package.json                        # add devDependencies: ali-oss, dotenv
└── .gitignore                          # append scripts/.env, scripts/.oss-manifest.json
```

## Runtime Flow

The script runs in five stages:

1. **Load config**: read `scripts/.env`, build an `ali-oss` client.
2. **Load manifest**: read `scripts/.oss-manifest.json` if it exists, else start empty.
3. **Scan local images**: walk the project for image files (see skip rules). For each, compute its `ossKey` = relative path from project root (e.g., `pages/index/images/bg-city.png`).
4. **Upload missing images**: for each local image, if its `ossKey` is in the manifest → skip. Otherwise upload to OSS, record the response, write back the manifest.
5. **Rewrite code references**: walk code files in non-skip directories. For each match of a local image path, replace with the corresponding OSS URL from the manifest. Edits happen in-place (no `.bak` files; git is the safety net).
6. **Print summary**: counts of uploaded, skipped, references replaced, errors.

The script exits with code 0 on success, non-zero on any failure.

## Image Scanning Rules

**Include** (file extensions): `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`

**Include** (directories):
- `assets/images/` (top-level image folder)
- `pages/*/images/`
- `components/*/images/`

**Skip** (path contains any of these):
- `pages/bak/`
- `assets/imgbak/`
- `utils/lib/`

**OSS key format**: relative path from project root, no leading `/`. Example:
- Local: `city-monapoly/pages/index/images/bg-city.png`
- OSS key: `pages/index/images/bg-city.png`
- OSS URL: `https://anothersola.oss-cn-beijing.aliyuncs.com/pages/index/images/bg-city.png`

## Code Scanning & Replacement Rules

**Include** (file extensions): `.js`, `.wxml`, `.wxss`

**Include** (directories): `pages/`, `components/`

**Skip** (path contains any of these):
- `pages/bak/`
- `utils/lib/`

**Replace pattern**: the script finds any quoted string (single, double, or backtick) that equals `/pages/.../images/...png` (or similar extension) or `/components/.../images/...` or `/assets/images/...`, and rewrites it to the full OSS URL. The string is replaced in place — surrounding quotes, syntax, and template literals are preserved.

Example matches:
- `'/pages/index/images/bg-city.png'` → `'https://anothersola.oss-cn-beijing.aliyuncs.com/pages/index/images/bg-city.png'`
- `"/components/chance-card/images/card.png"` → `"https://.../components/chance-card/images/card.png"`
- `` `/assets/images/logo.png` `` → `` `https://.../assets/images/logo.png` ``
- WXML: `<image src="/components/chance-card/images/card.png" />` → same src rewritten to URL
- WXSS: `background-image: url('/pages/x/images/y.png');` → rewritten to URL

The script does **not** rewrite:
- `data:` URIs (inline SVG, etc.)
- `https://` URLs already pointing to remote hosts
- Image paths in `pages/bak/` or `utils/lib/`

If a matched local path is not present in the manifest, the script logs a warning and leaves the line untouched (this should not happen if scanning rules are correct, but is a safety net).

## Manifest Format

`scripts/.oss-manifest.json`:

```json
{
  "version": 1,
  "bucket": "anothersola",
  "region": "cn-beijing",
  "endpoint": "oss-cn-beijing.aliyuncs.com",
  "urlPrefix": "https://anothersola.oss-cn-beijing.aliyuncs.com",
  "updatedAt": "2026-06-02T05:30:00.000Z",
  "files": {
    "pages/index/images/bg-city.png": {
      "ossKey": "pages/index/images/bg-city.png",
      "url": "https://anothersola.oss-cn-beijing.aliyuncs.com/pages/index/images/bg-city.png",
      "size": 12345,
      "etag": "D41D8CD98F00B204E9800998ECF8427E",
      "uploadedAt": "2026-06-02T05:30:00.000Z"
    }
  }
}
```

The manifest is read at the start of each run. Only files missing from `files` are uploaded. After each upload, the new entry is merged in and the file is written back.

## Error Handling

- **Missing .env**: print clear error pointing to `scripts/.env.example`, exit 1.
- **Network / OSS errors on upload**: log the failing path, skip the rewrite for that image, continue. Summary at the end reports failures.
- **Code file read/write errors**: log the file, continue with others.
- **Partial state on failure**: the manifest is written after each successful upload. If the script crashes mid-run, re-running it skips already-uploaded files and only retries the rest. Code rewrites happen after uploads complete, so a crash during upload never produces a half-rewritten codebase.

## Security

- `scripts/.env` is gitignored. The user's AK is not hardcoded in source.
- `scripts/.env.example` contains only the keys (no values), so it's safe to commit.
- A note in `scripts/README.md` warns the user to rotate the AK if it was ever shared in plaintext (which it was, in the brainstorming session).
- The script does not log credentials.

## Usage

```bash
# One-time setup
cp scripts/.env.example scripts/.env
# edit scripts/.env with real values
npm install

# Run
node scripts/upload-oss.js
```

Output looks like:

```
[config] bucket=anothersola region=cn-beijing endpoint=oss-cn-beijing.aliyuncs.com
[scan]  found 17 local images
[upload] 3 new, 14 skipped (already in manifest)
[upload] ✓ pages/index/images/bg-city.png
[upload] ✓ pages/game/images/board-map.png
[upload] ✓ pages/historyempty/images/empty-city-map.png
[rewrite] 22 references replaced across 9 files
[done] manifest: scripts/.oss-manifest.json
```

## Verification

After running:
1. Check `scripts/.oss-manifest.json` lists all expected images.
2. Open one or two rewritten `.js` / `.wxml` / `.wxss` files and confirm the local paths are now OSS URLs.
3. (Optional) Open one of the OSS URLs in a browser to confirm the image is reachable.
4. Run `git status` to see exactly which code files were modified.

## Out of Scope / Future Work

- Dry-run mode (was offered, user declined)
- `--force` flag to re-upload even when manifest says done
- Image CDN cache-busting via hash-suffixed filenames
- Auto-rollback if code rewrite produces parse errors
- GitHub Action / CI integration
