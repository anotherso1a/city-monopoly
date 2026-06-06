# DEPLOY — 上传 & 发布指南

> 用 `miniprogram-ci`(微信官方推荐的命令行工具)自动化上传,不需要打开开发者工具 GUI。

## 1. 前置条件(只做一次)

### 1.1 拿私钥

1. 登录 [mp.weixin.qq.com](https://mp.weixin.qq.com)
2. 进入:管理 → 开发管理 → 开发设置 → **小程序代码上传**
3. 点 "生成",会下载一个文件 `private.<你的 appid>.key`
4. 把这个文件放到 `scripts/` 目录下(完整路径:`scripts/private.<appid>.key`)
5. **该文件已在 .gitignore 里,不会被推到 GitHub**

### 1.2 IP 白名单

同一页面有 "IP 白名单" 开关:
- 打开后只有白名单内的 IP 能调用上传 API(更安全)
- 关闭后任何 IP 都能上传(本机 + CI 都行)
- **建议打开**,把当前本机公网 IP 和 CI runner IP 都加进去

查本机公网 IP:
```bash
curl -s https://api.ipify.org
```

## 2. 用法

### 2.1 上传开发版(默认)

```bash
npm run upload:dev
```

跑完:
- 微信小程序后台 → 版本管理 → 开发版本 会多出一条新版本
- 默认 version 形如 `dev-202606070530`,desc 是当前时间戳
- 想自定义:
  ```bash
  VERSION=1.2.0 DESC='feat: 新增游戏模式' npm run upload:dev
  ```

### 2.2 上传 + 提示体验版流程

```bash
npm run upload:trial
```

跑完会在控制台提示:
> 👉 下一步:打开 mp.weixin.qq.com → 版本管理 → 找到本次上传的版本,点击右侧「设为体验版」生成体验码。

**为什么不做成全自动设体验版**:微信 API 限制 — 设体验版必须在后台 UI 操作(`miniprogram-ci` 没有这个接口)。

### 2.3 自定义参数

环境变量优先,默认值合理:

| 环境变量 | 默认值 | 说明 |
|---|---|---|
| `VERSION` | `dev-<时间戳>` | 版本号,例:`1.2.0` / `feat-xxx` |
| `DESC` | `auto upload @ <本地时间>` | 版本备注,显示在 mp 后台列表 |

命令行参数:
- `--env trial` — 体验版模式(只是改提示,实际还是开发版)

## 3. 编译设置

`scripts/upload-ci.js` 默认开启:
- `es6: true` — ES6 → ES5
- `es7: true` — 增强编译
- `minify: true` + `minifyJS/WXML/WXSS: true` — 全部压缩

如果需要调整,直接改 `upload-ci.js` 里的 `setting` 对象。

## 4. 跑出来的常见错误

| 错误 | 原因 | 解决 |
|---|---|---|
| `找不到私钥文件` | 没放 `private.<appid>.key` | 见 §1.1 |
| `invalid ip` / `not in whitelist` | 本机 IP 不在白名单 | 关闭白名单,或把本机公网 IP 加进去 |
| `invalid private key` | key 内容被改动过 | 重新去 mp 后台生成 |
| `code package too large` | 编译后主包 > 2MB | 删图片/代码,或把图片挪 OSS(见 `npm run upload:oss`) |

## 5. CI 集成(可选)

要让 GitHub Actions 自动上传,把私钥存到 GitHub repo secret:

1. 去 GitHub repo → Settings → Secrets and variables → Actions → New repository secret
   - Name: `WECHAT_PRIVATE_KEY`
   - Value: `private.<appid>.key` 的完整内容
2. 写一个 `.github/workflows/upload.yml`:
   ```yaml
   name: upload-dev
   on: { push: { branches: [main] } }
   jobs:
     upload:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with: { node-version: 20 }
         - run: npm ci
         - name: write private key
           run: echo "${{ secrets.WECHAT_PRIVATE_KEY }}" > scripts/private.<your-appid>.key
         - run: npm run upload:dev
           env:
             VERSION: ${{ github.sha }}
             DESC: ${{ github.event.head_commit.message }}
   ```
3. CI runner IP 加到白名单(GitHub 有公开 IP 段,或临时关白名单)

## 6. 与 `npm run upload:oss` 的关系

- `upload:oss` — 把本地图片传到阿里云 OSS(只动图片 URL)
- `upload:dev` — 把代码上传到微信后台(走整体编译 + 鉴权)

两者无依赖,可单独跑。新加图片资源的工作流:
```bash
npm run upload:oss    # 先把图片搬 OSS,代码里改 URL
npm run upload:dev    # 再上传新代码到微信
```
