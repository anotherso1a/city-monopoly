#!/usr/bin/env node
/**
 * upload-oss.js
 *
 * 1. Scans local image files (assets/images/, pages/<page>/images/, components/<comp>/images/).
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
  return SKIP_PATH_TOKENS.some((token) => rel.includes(token));
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

const REF_REGEX = /(['"`])(\/(?:pages|components|assets\/images)\/[^'"`\s]*?\.(?:png|jpg|jpeg|gif|webp|svg))\1/g;

function rewriteFile(absPath, manifest) {
  const orig = fs.readFileSync(absPath, 'utf8');
  let changed = 0;
  const next = orig.replace(REF_REGEX, (match, quote, p) => {
    const key = p.replace(/^\//, '');
    const entry = manifest.files[key];
    if (!entry) return match;
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
