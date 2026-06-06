#!/usr/bin/env node
/**
 * upload-ci.js
 *
 * 用 miniprogram-ci 把当前项目代码上传到微信小程序后台(开发版/体验版预选)。
 *
 * 鉴权:scripts/private.<appid>.key(从 mp.weixin.qq.com → 开发管理 → 开发设置 → 小程序代码上传 生成,gitignored)
 * IP 白名单:同一页面配置,默认开启(可关)
 *
 * 用法:
 *   node scripts/upload-ci.js                          # 默认 dev upload
 *   node scripts/upload-ci.js --env trial              # 上传并在控制台提示"去 mp 后台选为体验版"
 *   VERSION=1.2.0 DESC='fix bug' node scripts/upload-ci.js
 *
 * npm scripts:
 *   npm run upload:dev
 *   npm run upload:trial
 */

'use strict';

const fs = require('fs');
const path = require('path');

// Node 22+ 自带一个空的 globalThis.localStorage(没 getItem/setItem 方法),
// miniprogram-ci 2.x 的 debug.js 假定有,直接调就挂。
// 两边都改:
//   1) 父进程 —— 直接覆盖 globalThis(NODE_OPTIONS 对已启动的进程无效)
//   2) fork 的子进程 —— 走 NODE_OPTIONS=--require= 自动加载
// 见 scripts/.localstorage-polyfill.js
{
  const _store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (_store.has(k) ? _store.get(k) : null),
    setItem: (k, v) => _store.set(k, String(v)),
    removeItem: (k) => _store.delete(k),
    clear: () => _store.clear(),
    key: (i) => Array.from(_store.keys())[i] || null,
    get length() { return _store.size; },
  };
}
const polyfillPath = path.join(__dirname, '.localstorage-polyfill.js');
process.env.NODE_OPTIONS = `--require=${polyfillPath}${process.env.NODE_OPTIONS ? ' ' + process.env.NODE_OPTIONS : ''}`;

const ci = require('miniprogram-ci');

// 项目根 = 本脚本上一级
const PROJECT_ROOT = path.resolve(__dirname, '..');
const PROJECT_CONFIG = path.join(PROJECT_ROOT, 'project.config.json');

// 解析命令行参数 —— 用最简的 argv 解析,避免引 yargs/commander
const args = process.argv.slice(2);
const envMode = (args.includes('--env') ? args[args.indexOf('--env') + 1] : 'dev') || 'dev';

// 从 project.config.json 读 appid(单一来源)
const projectConfig = JSON.parse(fs.readFileSync(PROJECT_CONFIG, 'utf8'));
const APPID = projectConfig.appid;
if (!APPID) {
  console.error('❌ project.config.json 缺少 appid 字段');
  process.exit(1);
}

const PRIVATE_KEY_PATH = path.join(__dirname, `private.${APPID}.key`);
if (!fs.existsSync(PRIVATE_KEY_PATH)) {
  console.error(`❌ 找不到私钥文件: ${PRIVATE_KEY_PATH}`);
  console.error('请去 mp.weixin.qq.com → 开发管理 → 开发设置 → 小程序代码上传 → 生成密钥,放到上述路径。');
  console.error('同时确认 IP 白名单包含你当前出口 IP(或临时关闭白名单)。');
  process.exit(1);
}

// 版本号 + 备注:env var 优先,否则自动生成
const VERSION = process.env.VERSION || `dev-${new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '')}`;
const DESC = process.env.DESC || `auto upload @ ${new Date().toLocaleString('zh-CN')}`;

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('  mini-program ci upload');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`  appid     : ${APPID}`);
console.log(`  project   : ${PROJECT_ROOT}`);
console.log(`  version   : ${VERSION}`);
console.log(`  desc      : ${DESC}`);
console.log(`  env mode  : ${envMode}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const project = new ci.Project({
  appid: APPID,
  type: 'miniProgram',
  projectPath: PROJECT_ROOT,
  privateKeyPath: PRIVATE_KEY_PATH,
  // 不上传 node_modules / docs / 测试产物
  ignores: ['node_modules/**/*', 'docs/**/*', 'scripts/.oss-manifest.json', 'scripts/.env'],
});

(async () => {
  try {
    const result = await ci.upload({
      project,
      version: VERSION,
      desc: DESC,
      setting: {
        es6: true,
        es7: true,
        minify: true,
        minifyJS: true,
        minifyWXML: true,
        minifyWXSS: true,
      },
      onProgressUpdate: (info) => {
        // 进度信息 —— 编译/上传不同阶段
        if (info && info.message) {
          console.log(`  [progress] ${info.message}`);
        }
      },
    });

    console.log('✅ 上传成功');
    if (result && result.subPackageInfo) {
      console.log('  包信息:');
      result.subPackageInfo.forEach((pkg) => {
        const sizeKB = (pkg.size / 1024).toFixed(1);
        console.log(`    - ${pkg.name}: ${sizeKB} KB`);
      });
    }

    // 体验版提示:上传后默认是开发版,需到 mp 后台手动选版本"设为体验版"
    if (envMode === 'trial') {
      console.log('');
      console.log('👉 下一步:打开 mp.weixin.qq.com → 版本管理 → 找到本次上传的版本,点击右侧「设为体验版」生成体验码。');
    } else {
      console.log('');
      console.log('ℹ️  上传的是开发版。要发体验版:');
      console.log('   1) mp.weixin.qq.com → 版本管理 → 选本次版本 → 「设为体验版」');
      console.log('   2) 或下次跑 `npm run upload:trial` 我会在结束后提示你');
    }
  } catch (err) {
    console.error('❌ 上传失败:', err && err.message ? err.message : err);
    if (err && err.stack) console.error(err.stack);
    process.exit(1);
  }
})();
