# image-share 海报弹窗组件化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Commit policy:** Per user memory `feedback_no_auto_commit.md`, the executor (main session or subagent) MUST NOT run `git add` / `git commit` / `git push` / `git merge` without explicit user instruction in the current turn. Each task's "Commit" step should be performed only when the user asks for it.
>
> **Spec:** [docs/superpowers/specs/2026-06-05-poster-share-modal-design.md](../specs/2026-06-05-poster-share-modal-design.md)

**Goal:** 把 `pages/image-share/image-share` 独立海报页改造成 `components/poster-share/` 弹窗组件。settlement / logs 点击「生成分享海报」不再跳页,中央 `wx.showLoading` toast 期间 Painter 在屏外渲染,完成后弹窗内直接展示完整图片(无骨架)。

**Architecture:** 新建 `components/poster-share/` 组件,把原页面 `buildPalette` / `drawStatCell` / `drawPlaceTags` / `drawPolaroid` 等画图逻辑整体平移。组件用 `visible` props + 内部 `_showModal` state 双层控制:`visible: false→true` 触发 `wx.showLoading` + 渲染流程,Painter `imgOK` 才把 `_showModal` 置 true 让弹窗本体出现。Painter `<canvas>` 始终挂在组件 wxml 顶层(屏外定位),不依赖弹窗显隐。

**Tech Stack:** WeChat Mini Program (WXML, WXSS, JS, JSON), `<painter>` 组件 (`/components/painter/painter`), `wx.showLoading` / `wx.hideLoading`, `wx.saveImageToPhotosAlbum`, Component `properties.observer`.

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `components/poster-share/poster-share.js` | **Create** | 组件主逻辑:visible observer、_loadFromGame、_renderPoster、imgOK/imgErr、onSave、onClose;以及从 image-share 平移的 buildPalette 等画图函数 |
| `components/poster-share/poster-share.wxml` | **Create** | 顶层两个兄弟:`wx:if="{{_showModal}}"` 控制的 modal + 始终挂载的屏外 painter |
| `components/poster-share/poster-share.wxss` | **Create** | 遮罩、卡片、保存/关闭按钮、屏外 canvas 收纳 |
| `components/poster-share/poster-share.json` | **Create** | `"component": true` + 引用 `painter` 子组件 |
| `pages/settlement/settlement.json` | Modify | `usingComponents` 加 `poster-share` |
| `pages/settlement/settlement.wxml` | Modify | 加 `<poster-share ... bind:close="onPosterClose" />` |
| `pages/settlement/settlement.js` | Modify | `data` 加 `posterVisible`;`onSharePoster` 改 setData;新增 `onPosterClose` |
| `pages/logs/logs.json` | Modify | 同 settlement.json |
| `pages/logs/logs.wxml` | Modify | 同 settlement.wxml |
| `pages/logs/logs.js` | Modify | `data` 加 `posterVisible`;`onShare` 改 setData;新增 `onPosterClose` |
| `pages/image-share/` | **Delete** | 整个目录(4 文件 + images 目录,如有) |
| `app.json` | Modify | 移除 `"pages/image-share/image-share"` 注册 |
| `project.private.config.json` | Modify | 移除 image-share 编译入口 |

---

## Task 1: 新建 `components/poster-share/` 组件(4 文件)

**Files:**
- Create: `components/poster-share/poster-share.json`
- Create: `components/poster-share/poster-share.wxml`
- Create: `components/poster-share/poster-share.wxss`
- Create: `components/poster-share/poster-share.js`

- [ ] **Step 1: 创建 `poster-share.json`**

```json
{
  "component": true,
  "usingComponents": {
    "painter": "/components/painter/painter"
  }
}
```

- [ ] **Step 2: 创建 `poster-share.wxml`**

```xml
<!--components/poster-share/poster-share.wxml-->
<!--
  顶层两个兄弟节点:
    1. modal(wx:if=_showModal 控制显隐)— 弹窗本体,显示生成好的图 + 按钮
    2. offscreen-canvas — Painter 永远挂载在这里(屏外),不在 wx:if 内,
       否则 canvas 不存在 → setData(palette) 不会触发渲染
-->

<!-- 1. 弹窗本体(仅当 _showModal=true 时显示) -->
<view wx:if="{{_showModal}}" class="poster-modal-mask" catchtap="onMaskTap">
  <view class="poster-modal-content" catchtap="onContentTap">
    <image
      class="poster-image"
      src="{{posterImageUrl}}"
      mode="widthFix"
      show-menu-by-longpress="{{true}}"
    />
    <view class="poster-actions">
      <button
        class="poster-btn poster-btn-save {{saving ? 'poster-btn-save-loading' : ''}} {{saved ? 'poster-btn-save-done' : ''}}"
        bindtap="onSave"
        disabled="{{saving}}"
      >
        <text class="poster-btn-icon">{{saveIcon}}</text>
        <text class="poster-btn-label">{{saveLabel}}</text>
      </button>
      <button class="poster-btn poster-btn-close" bindtap="onClose">
        <text class="poster-btn-label">关闭预览</text>
      </button>
    </view>
  </view>
</view>

<!-- 2. 屏外 Painter,永远挂载,wxss 把它定位到屏外 -->
<view class="poster-offscreen-canvas">
  <painter
    palette="{{posterPalette}}"
    use2D="{{true}}"
    bind:imgOK="onPosterImgOK"
    bind:imgErr="onPosterImgErr"
  />
</view>
```

- [ ] **Step 3: 创建 `poster-share.wxss`**

```css
/* components/poster-share/poster-share.wxss
 * 海报分享弹窗组件 - 默认风格(白底圆角阴影卡片 + 半透明遮罩)
 * 屏外 canvas 隐藏在 -9999rpx 位置,Painter 仍能正常渲染
 */

/* ============ 弹窗遮罩 + 卡片 ============ */
.poster-modal-mask {
  position: fixed;
  inset: 0;
  background-color: rgba(54, 47, 36, 0.6);
  z-index: 1000;
  display: flex;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 40rpx 32rpx;
}

.poster-modal-content {
  width: 100%;
  max-width: 686rpx;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
  box-sizing: border-box;
  overflow-y: auto;
  /* 卡片本身不要白底 - 海报图自带圆角阴影,直接呈现 */
}

/* ============ 海报图 ============ */
.poster-image {
  width: 100%;
  display: block;
  border-radius: 16rpx;
  box-shadow: 8rpx 8rpx 0 0 rgba(81, 69, 50, 0.2);
  animation: poster-fade-in 0.3s ease-out;
}

@keyframes poster-fade-in {
  from { opacity: 0; transform: scale(0.96); }
  to   { opacity: 1; transform: scale(1); }
}

/* ============ 操作按钮 ============ */
.poster-actions {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.poster-btn {
  width: 100%;
  padding: 0;
  margin: 0;
  border: none;
  background-color: transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  box-sizing: border-box;
  font-size: 32rpx;
  line-height: 1;
  transition: transform 0.1s ease, box-shadow 0.1s ease;
}

.poster-btn::after { border: none; }

.poster-btn[disabled] {
  opacity: 0.6;
}

.poster-btn-save {
  background-color: #ffb800;
  color: #6b4c00;
  padding: 28rpx 24rpx;
  font-size: 36rpx;
  font-weight: 700;
  border: 4rpx solid #514532;
  border-radius: 4rpx 8rpx 6rpx 12rpx / 8rpx 6rpx 12rpx 4rpx;
  box-shadow: 8rpx 8rpx 0 0 rgba(81, 69, 50, 0.2);
}

.poster-btn-save:active {
  transform: translate(4rpx, 4rpx);
  box-shadow: 0 0 0 0 rgba(81, 69, 50, 0);
}

.poster-btn-save-loading {
  opacity: 0.75;
}

.poster-btn-save-done {
  background-color: #ede1d0;
  color: #2e7d32;
}

.poster-btn-close {
  background-color: #fff2e1;
  color: #514532;
  padding: 24rpx;
  border: 4rpx dashed #514532;
  border-radius: 4rpx 8rpx 6rpx 12rpx / 8rpx 6rpx 12rpx 4rpx;
  opacity: 0.85;
}

.poster-btn-close:active {
  opacity: 1;
}

.poster-btn-icon {
  font-size: 36rpx;
}

.poster-btn-label {
  font-weight: inherit;
}

/* ============ 屏外 canvas(Painter 渲染区域,用户不可见)============ */
.poster-offscreen-canvas {
  position: fixed;
  left: -9999rpx;
  top: -9999rpx;
  pointer-events: none;
  opacity: 0;
  z-index: -1;
}
```

- [ ] **Step 4: 创建 `poster-share.js`**

```javascript
// components/poster-share/poster-share.js
// 海报分享弹窗组件 - 从 pages/image-share/image-share.js 平移而来,改造为 Component
//
// 关键差异:
//   - Page → Component (properties + methods)
//   - onLoad → properties.visible observer (_onVisibleChange)
//   - navigateBack → triggerEvent('close')
//   - 新增内部状态 _showModal,只在 Painter imgOK 后才置 true (此时弹窗才出现,显示完整图)
//   - loading 改为 wx.showLoading toast(渲染期间,弹窗本身不显示)
//   - 删除 onShareAppMessage / onNavHeightChange / 骨架相关 state
//
// Painter 能力(对比 wxml-to-canvas 的主要升级):
//   - 支持 rotate / shadow / linear-gradient / fontFamily / fontWeight / fontStyle
//   - 异形 borderRadius
//   - 调色板是 JSON 树(views: [{type, css, content/text/url}])
//   - palette.width / palette.height 决定画布尺寸
//   - setData 更新 palette 自动触发重绘(内部 observer)
//   - 渲染完成通过 bind:imgOK 回调返回 tempFilePath
//
// 照片来源:engine.state.checkins[].photoUrl(打卡时 wx.chooseImage 选的)。

const { getMap } = require('../../utils/storage');
const { GameEngine } = require('../../services/gameEngine');

const POSTER_W = 750;
const POSTER_PAD_X = 40;
const POSTER_BG = '#fff8f3';
const POSTER_INK = '#211b11';
const POSTER_INK_DIM = '#514532';
const POSTER_LINE = '#514532';
const POSTER_PAPER_DARK = '#7c5800';
const POSTER_RED = '#da3148';
const POSTER_STAT_BG = '#f9ecdb';
const POSTER_TAG_BG = '#ede1d0';
const POSTER_OUTLINE = '#d5c4ab';

const SAVE_LABEL_DEFAULT = '保存到相册';
const SAVE_LABEL_LOADING = '正在保存…';
const SAVE_LABEL_DONE = '已保存';

// ============ 工具函数 ============

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function formatDistanceKm(meters) {
  if (!meters || meters < 0) return '0 km';
  return `${(meters / 1000).toFixed(1)} km`;
}

function formatDate(iso) {
  const d = iso ? new Date(iso) : new Date();
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function truncate(text, max = 8) {
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max - 1)}…` : text;
}

function rpx(n) {
  return `${n}rpx`;
}

// ============ 海报调色板(整体从 image-share 平移)============

function buildPalette(data) {
  const photos = data.photos || [];
  const cardW = POSTER_W;
  const innerW = cardW - POSTER_PAD_X * 2;

  const G = {
    gap: 24,
    innerPad: 12,
    cardPadB: 32,
  };
  const R = {
    tagStripH: 56,
    avatarSize: 96,
    playerRowH: 110,
    statCellH: 180,
    statCellGap: 16,
    polH: { small: 280, mid: 230, tiny: 215 },
    polW: { small: 230, mid: 195, tiny: 180 },
    polGap: 16,
    placeTagH: 44,
    placeTagGapY: 8,
    placeTagGapX: 12,
    placeLabelH: 32,
    placeTagPadX: 14,
    placeCharW: 24,
    galTitleH: 40,
    qrSize: 140,
    brandDividerH: 3,
  };

  const visiblePlaces = (data.places || []).slice(0, 6);
  const placeMaxW = innerW - G.innerPad * 2;
  const tagLayout = layoutPlaceTags(visiblePlaces, placeMaxW, {
    gapX: R.placeTagGapX,
    charW: R.placeCharW,
    padX: R.placeTagPadX,
    tagH: R.placeTagH,
    tagGapY: R.placeTagGapY,
  });
  const placeTagAreaH = tagLayout.totalH;
  const placeCellH = G.innerPad + placeTagAreaH + G.innerPad;

  let polRowCount = 1;
  if (photos.length === 4 || photos.length === 5) polRowCount = 2;
  const polSizeKey = photos.length >= 5 ? 'tiny' : (photos.length >= 4 ? 'mid' : 'small');
  const polH = R.polH[polSizeKey];
  const polGalleryH = photos.length > 0
    ? R.galTitleH + G.innerPad + polRowCount * polH + (polRowCount - 1) * R.polGap
    : 0;

  const brandBlockH = 50 + 8 + 36;
  const brandRowH = 2 * R.qrSize - brandBlockH;

  const moduleHeights = [
    R.tagStripH,
    R.playerRowH,
    R.statCellH + R.statCellGap + R.placeLabelH + G.innerPad + placeCellH,
    polGalleryH,
    brandRowH,
  ];
  const cardH = moduleHeights.reduce((acc, h) => acc + h, 0)
    + (moduleHeights.length - 1) * G.gap
    + G.cardPadB;

  const views = [];
  let y = 0;
  const push = (v) => views.push(v);

  // 卡片背景
  push({
    type: 'rect',
    css: {
      width: rpx(cardW), height: rpx(cardH),
      top: rpx(0), left: rpx(0),
      color: POSTER_BG, background: POSTER_BG,
      borderRadius: rpx(16), borderWidth: rpx(4), borderColor: POSTER_LINE,
    },
  });

  // 模块 1: 红色横条
  push({
    type: 'rect',
    css: {
      width: rpx(cardW), height: rpx(R.tagStripH),
      top: rpx(y), left: rpx(0),
      color: POSTER_RED, background: POSTER_RED,
    },
  });
  push({
    type: 'text',
    text: 'MY CITY JOURNEY',
    css: {
      width: rpx(cardW), height: rpx(R.tagStripH),
      top: rpx(12), left: rpx(0),
      fontSize: rpx(22), color: '#fff', fontWeight: '700',
      textAlign: 'center', verticalAlign: 'middle', lineHeight: rpx(R.tagStripH),
    },
  });
  y += R.tagStripH + G.gap;

  // 模块 2: 玩家行(头像 + 昵称 + 完成日期)
  const playerY = y;
  push({
    type: 'image',
    url: data.avatarUrl,
    css: {
      width: rpx(R.avatarSize), height: rpx(R.avatarSize),
      top: rpx(playerY), left: rpx(POSTER_PAD_X),
      borderRadius: rpx(R.avatarSize / 2),
      borderWidth: rpx(4), borderColor: POSTER_LINE,
    },
  });
  const playerTextLeft = POSTER_PAD_X + R.avatarSize + 20;
  const playerTextW = innerW - R.avatarSize - 20;
  const playerTextBlockH = 56 + 8 + 36;
  const playerTextY = playerY + (R.playerRowH - playerTextBlockH) / 2;
  push({
    type: 'text',
    text: truncate(data.nickname, 10),
    css: {
      width: rpx(playerTextW), height: rpx(56),
      top: rpx(playerTextY), left: rpx(playerTextLeft),
      fontSize: rpx(42), color: POSTER_INK, fontWeight: '700',
      fontFamily: 'Source Serif 4, Noto Serif SC, serif',
      textAlign: 'left', verticalAlign: 'middle', lineHeight: rpx(56),
    },
  });
  push({
    type: 'text',
    text: `于 ${data.completedDate} 完成探索`,
    css: {
      width: rpx(playerTextW), height: rpx(36),
      top: rpx(playerTextY + 64), left: rpx(playerTextLeft),
      fontSize: rpx(24), color: POSTER_INK_DIM, fontStyle: 'italic',
      fontFamily: 'Source Serif 4, Noto Serif SC, serif',
      textAlign: 'left', verticalAlign: 'middle', lineHeight: rpx(36),
    },
  });
  y += R.playerRowH + G.gap;

  // 模块 3: 数据宫格
  const cellW = (innerW - R.statCellGap) / 2;
  const statsRowY = y;
  drawStatCell(views, {
    x: POSTER_PAD_X, y: statsRowY,
    w: cellW, h: R.statCellH,
    icon: '👣', iconColor: POSTER_PAPER_DARK,
    label: '漫游距离', value: data.distanceLabel, valueColor: POSTER_PAPER_DARK,
  });
  drawStatCell(views, {
    x: POSTER_PAD_X + cellW + R.statCellGap, y: statsRowY,
    w: cellW, h: R.statCellH,
    icon: '💰', iconColor: POSTER_RED,
    label: '获取金币', value: `${data.coins}`, valueColor: POSTER_RED,
  });
  const placeBlockY = statsRowY + R.statCellH + R.statCellGap;
  push({
    type: 'text',
    text: '探索地点',
    css: {
      width: rpx(innerW), height: rpx(R.placeLabelH),
      top: rpx(placeBlockY), left: rpx(POSTER_PAD_X),
      fontSize: rpx(22), color: POSTER_INK_DIM, fontStyle: 'italic',
      fontFamily: 'Source Serif 4, Noto Serif SC, serif',
      textAlign: 'center', verticalAlign: 'middle', lineHeight: rpx(R.placeLabelH),
    },
  });
  const boxY = placeBlockY + R.placeLabelH + G.innerPad;
  push({
    type: 'rect',
    css: {
      width: rpx(innerW), height: rpx(placeCellH),
      top: rpx(boxY), left: rpx(POSTER_PAD_X),
      color: POSTER_STAT_BG, background: POSTER_STAT_BG,
      borderRadius: rpx(12), borderWidth: rpx(3), borderColor: POSTER_LINE,
    },
  });
  const placeTagsTopY = boxY + G.innerPad;
  drawPlaceTags(views, {
    x: POSTER_PAD_X + G.innerPad,
    y: placeTagsTopY,
    layout: tagLayout,
    fontSize: 24,
  });
  y = boxY + placeCellH + G.gap;

  // 模块 4: 城市掠影
  if (photos.length > 0) {
    const galY = y;
    push({
      type: 'text',
      text: '城市掠影',
      css: {
        width: rpx(innerW), height: rpx(R.galTitleH),
        top: rpx(galY), left: rpx(POSTER_PAD_X),
        fontSize: rpx(22), color: POSTER_INK_DIM, fontStyle: 'italic',
        fontFamily: 'Source Serif 4, Noto Serif SC, serif',
        textAlign: 'center', verticalAlign: 'middle', lineHeight: rpx(R.galTitleH),
      },
    });
    const polStartY = galY + R.galTitleH + G.innerPad;
    const polW = R.polW[polSizeKey];
    let row1, row2;
    if (photos.length <= 3) { row1 = photos; row2 = []; }
    else if (photos.length === 4) { row1 = photos.slice(0, 2); row2 = photos.slice(2, 4); }
    else { row1 = photos.slice(0, 3); row2 = photos.slice(3, 5); }
    const polAngles = [-3, 2, -2, 3, -2];
    const totalW1 = row1.length * polW + (row1.length - 1) * R.polGap;
    const startX1 = POSTER_PAD_X + (innerW - totalW1) / 2;
    row1.forEach((p, i) => {
      drawPolaroid(views, {
        x: startX1 + i * (polW + R.polGap),
        y: polStartY,
        w: polW, h: polH,
        url: p.url, caption: p.caption,
        rotate: polAngles[i % polAngles.length],
      });
    });
    if (row2.length > 0) {
      const totalW2 = row2.length * polW + (row2.length - 1) * R.polGap;
      const startX2 = POSTER_PAD_X + (innerW - totalW2) / 2;
      const row2Y = polStartY + polH + R.polGap;
      row2.forEach((p, i) => {
        drawPolaroid(views, {
          x: startX2 + i * (polW + R.polGap),
          y: row2Y,
          w: polW, h: polH,
          url: p.url, caption: p.caption,
          rotate: polAngles[(i + row1.length) % polAngles.length],
        });
      });
    }
    y += polGalleryH + G.gap;
  }

  // 模块 5: 品牌 / QR
  const brandY = y;
  push({
    type: 'rect',
    css: {
      width: rpx(innerW), height: rpx(R.brandDividerH),
      top: rpx(brandY), left: rpx(POSTER_PAD_X),
      color: POSTER_OUTLINE, background: POSTER_OUTLINE,
    },
  });
  const brandTextX = POSTER_PAD_X;
  const brandTextW = innerW - R.qrSize - G.innerPad;
  const brandTextY = brandY + (brandRowH - brandBlockH) / 2;
  push({
    type: 'text',
    text: 'City Monopoly',
    css: {
      width: rpx(brandTextW), height: rpx(50),
      top: rpx(brandTextY), left: rpx(brandTextX),
      fontSize: rpx(38), color: POSTER_INK_DIM, fontWeight: '700',
      fontFamily: 'Libre Caslon Text, Source Serif 4, Noto Serif SC, serif',
      textAlign: 'left', verticalAlign: 'middle', lineHeight: rpx(50),
    },
  });
  push({
    type: 'text',
    text: '扫码开启城市大富翁之旅',
    css: {
      width: rpx(brandTextW), height: rpx(36),
      top: rpx(brandTextY + 58), left: rpx(brandTextX),
      fontSize: rpx(22), color: '#837560', fontStyle: 'italic',
      textAlign: 'left', verticalAlign: 'middle', lineHeight: rpx(36),
    },
  });
  push({
    type: 'rect',
    css: {
      width: rpx(R.qrSize), height: rpx(R.qrSize),
      top: rpx(brandTextY), left: rpx(cardW - POSTER_PAD_X - R.qrSize),
      color: '#fff', background: '#fff',
      borderRadius: rpx(8), borderWidth: rpx(3), borderColor: POSTER_LINE,
      shadow: '4rpx 4rpx 0 rgba(81, 69, 50, 0.2)',
    },
  });
  push({
    type: 'image',
    url: data.qrPath,
    css: {
      width: rpx(R.qrSize - 16), height: rpx(R.qrSize - 16),
      top: rpx(brandTextY + 8), left: rpx(cardW - POSTER_PAD_X - R.qrSize + 8),
    },
  });

  return {
    width: rpx(cardW),
    height: rpx(cardH),
    background: POSTER_BG,
    views,
  };
}

function drawStatCell(views, opts) {
  const { x, y, w, h, icon, iconColor, label, value, valueColor } = opts;
  views.push({
    type: 'rect',
    css: {
      width: rpx(w), height: rpx(h),
      top: rpx(y), left: rpx(x),
      color: POSTER_STAT_BG, background: POSTER_STAT_BG,
      borderRadius: rpx(12),
      borderWidth: rpx(3), borderColor: POSTER_LINE,
      shadow: '4rpx 4rpx 0 rgba(81, 69, 50, 0.15)',
    },
  });
  views.push({
    type: 'text', text: icon,
    css: {
      width: rpx(w), height: rpx(60),
      top: rpx(y + 20), left: rpx(x),
      fontSize: rpx(52), color: iconColor,
      textAlign: 'center', verticalAlign: 'middle', lineHeight: rpx(60),
    },
  });
  views.push({
    type: 'text', text: label,
    css: {
      width: rpx(w), height: rpx(32),
      top: rpx(y + h - 80), left: rpx(x),
      fontSize: rpx(22), color: POSTER_INK_DIM,
      textAlign: 'center', verticalAlign: 'middle', lineHeight: rpx(32),
    },
  });
  views.push({
    type: 'text', text: value,
    css: {
      width: rpx(w), height: rpx(48),
      top: rpx(y + h - 48), left: rpx(x),
      fontSize: rpx(40), color: valueColor, fontWeight: '700',
      fontFamily: 'Source Serif 4, Noto Serif SC, serif',
      textAlign: 'center', verticalAlign: 'middle', lineHeight: rpx(48),
    },
  });
}

function layoutPlaceTags(places, maxW, style) {
  const { gapX, charW, padX, tagH, tagGapY } = style;
  if (!places || places.length === 0) {
    const phW = 160;
    return {
      items: [{ x: Math.max(0, maxW / 2 - phW / 2), y: 0, w: phW, h: tagH, text: '暂无打卡' }],
      totalH: tagH, rowCount: 1,
    };
  }
  const items = [];
  let curX = 0, curY = 0, rowCount = 1;
  places.forEach((p) => {
    const text = truncate(p, 6);
    const tagW = text.length * charW + padX * 2;
    if (curX + tagW > maxW) {
      curX = 0; curY += tagH + tagGapY; rowCount++;
    }
    items.push({ x: curX, y: curY, w: tagW, h: tagH, text });
    curX += tagW + gapX;
  });
  const totalH = rowCount * tagH + (rowCount - 1) * tagGapY;
  return { items, totalH, rowCount };
}

function drawPlaceTags(views, opts) {
  const { x, y, layout, fontSize } = opts;
  const tagH = layout.items[0].h;
  const textTopOffset = (tagH - fontSize) / 2;
  layout.items.forEach((item) => {
    views.push({
      type: 'rect',
      css: {
        width: rpx(item.w), height: rpx(item.h),
        top: rpx(y + item.y), left: rpx(x + item.x),
        color: POSTER_TAG_BG, background: POSTER_TAG_BG,
        borderRadius: rpx(6), borderWidth: rpx(2), borderColor: '#837560',
      },
    });
    views.push({
      type: 'text', text: item.text,
      css: {
        width: rpx(item.w), height: rpx(fontSize),
        top: rpx(y + item.y + textTopOffset), left: rpx(x + item.x),
        fontSize: rpx(fontSize), color: POSTER_INK,
        textAlign: 'center', lineHeight: rpx(fontSize),
      },
    });
  });
}

function drawPolaroid(views, opts) {
  const { x, y, w, h, url, caption, rotate } = opts;
  views.push({
    type: 'rect',
    css: {
      width: rpx(w), height: rpx(h),
      top: rpx(y), left: rpx(x),
      color: '#ffffff', background: '#ffffff',
      borderRadius: rpx(6),
      borderWidth: rpx(3), borderColor: POSTER_LINE,
      rotate,
      shadow: '6rpx 6rpx 0 rgba(81, 69, 50, 0.25)',
    },
  });
  const imgPad = 12;
  const capH = 40;
  const imgH = h - imgPad * 2 - capH - 8;
  const imgW = w - imgPad * 2;
  views.push({
    type: 'image', url,
    css: {
      width: rpx(imgW), height: rpx(imgH),
      top: rpx(y + imgPad), left: rpx(x + imgPad),
      rotate,
    },
  });
  views.push({
    type: 'text', text: truncate(caption, 8),
    css: {
      width: rpx(imgW), height: rpx(capH),
      top: rpx(y + h - capH - 8), left: rpx(x + imgPad),
      fontSize: rpx(18), color: POSTER_INK_DIM,
      fontFamily: 'Source Serif 4, Noto Serif SC, serif',
      textAlign: 'center', verticalAlign: 'middle', lineHeight: rpx(capH),
    },
  });
}

// ============ Component ============

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false,
      observer: '_onVisibleChange',
    },
    mapId: {
      type: String,
      value: '',
    },
  },

  data: {
    nickname: '',
    avatarUrl: '',
    completedDate: formatDate(),
    distanceLabel: '12.8 km',
    coins: 2450,
    places: ['武康大楼', '静安公园', '外滩码头'],
    photos: [],

    posterPalette: null,
    posterImageUrl: '',

    // 弹窗本体显隐控制 — visible=true 后仍要等 Painter imgOK,才把 _showModal 置 true
    _showModal: false,

    saving: false,
    saved: false,
    saveLabel: SAVE_LABEL_DEFAULT,
    saveIcon: '📷',
  },

  methods: {
    // ===== 主控:visible 变化 → 启动渲染 / 重置 =====
    _onVisibleChange(newVal, oldVal) {
      if (newVal && !oldVal) {
        this._startRender();
      } else if (!newVal && oldVal) {
        this._reset();
      }
    },

    _startRender() {
      wx.showLoading({ title: '正在生成…', mask: true });

      // 展示层用 DEFAULT 兜底:用户拒绝授权时,海报头像/昵称也要能渲染
      const { getDisplayProfile } = require('../../utils/userProfile');
      const display = getDisplayProfile();
      this.setData({
        nickname: display.nickName,
        avatarUrl: display.avatarUrl,
      });

      if (this.data.mapId) {
        this._loadFromGame(this.data.mapId);
      } else {
        this._scheduleRender();
      }
    },

    _reset() {
      if (this._renderTimer) {
        clearTimeout(this._renderTimer);
        this._renderTimer = null;
      }
      this.setData({
        _showModal: false,
        posterImageUrl: '',
        posterPalette: null,
        saving: false,
        saved: false,
        saveLabel: SAVE_LABEL_DEFAULT,
        saveIcon: '📷',
      });
    },

    // ===== 数据加载(从 image-share 平移) =====
    _loadFromGame(mapId) {
      const mapData = getMap(mapId);
      if (!mapData || !mapData.currentGame) {
        this._scheduleRender();
        return;
      }

      const engine = new GameEngine(mapId, mapData).resume();
      const stats = engine.getStatistics();
      const state = engine.getState();
      const grids = mapData.grids || [];

      const checkins = (state.checkins || []).map((c) => {
        const grid = grids[c.gridIndex];
        const poiName = (grid && grid.poi && grid.poi.name) || c.note || '';
        return { ...c, poiName };
      });

      const places = checkins.map((c) => c.poiName).filter(Boolean);

      let photoItems = checkins
        .filter((c) => c.photoUrl)
        .map((c) => ({ url: c.photoUrl, caption: c.poiName || '打卡' }));

      if (photoItems.length > 5) {
        photoItems = shuffle(photoItems).slice(0, 5);
      }

      this.setData({
        distanceLabel: formatDistanceKm(stats.totalDistance),
        coins: stats.currentGold,
        places: places.length > 0 ? places : [],
        photos: photoItems,
        completedDate: formatDate(state.endedAt || state.startedAt),
      }, () => {
        this._scheduleRender();
      });
    },

    _scheduleRender() {
      if (this._renderTimer) clearTimeout(this._renderTimer);
      this._renderTimer = setTimeout(() => this._renderPoster(), 60);
    },

    _renderPoster() {
      const palette = buildPalette({
        nickname: this.data.nickname,
        avatarUrl: this.data.avatarUrl,
        completedDate: this.data.completedDate,
        distanceLabel: this.data.distanceLabel,
        coins: this.data.coins,
        places: this.data.places,
        photos: this.data.photos,
        qrPath: 'https://anothersola.oss-cn-beijing.aliyuncs.com/pages/image-share/images/qr.png',
      });
      this.setData({ posterPalette: palette });
    },

    // ===== Painter 回调 =====
    onPosterImgOK(e) {
      wx.hideLoading();
      this.setData({
        posterImageUrl: e.detail.path,
        _showModal: true,
      });
    },

    onPosterImgErr(e) {
      wx.hideLoading();
      console.error('[poster-share] painter imgErr', e.detail);
      wx.showToast({ title: '生成失败', icon: 'none' });
      this.triggerEvent('close');
    },

    // ===== 保存到相册(从 image-share 平移) =====
    onSave() {
      const filePath = this.data.posterImageUrl;
      if (!filePath || this.data.saving) return;

      this.setData({ saving: true, saved: false, saveLabel: SAVE_LABEL_LOADING, saveIcon: '⏳' });

      const doSave = () => {
        wx.saveImageToPhotosAlbum({
          filePath,
          success: () => {
            this.setData({ saving: false, saved: true, saveLabel: SAVE_LABEL_DONE, saveIcon: '✅' });
            wx.showToast({ title: '已保存到相册', icon: 'success', duration: 1500 });
            setTimeout(() => {
              this.setData({ saved: false, saveLabel: SAVE_LABEL_DEFAULT, saveIcon: '📷' });
            }, 2000);
          },
          fail: (err) => {
            this.setData({ saving: false, saveLabel: SAVE_LABEL_DEFAULT, saveIcon: '📷' });
            if (err && err.errMsg && /auth deny|authorize|writePhotosAlbum/i.test(err.errMsg)) {
              this._handleAuthDeny();
            } else {
              wx.showToast({ title: '保存失败', icon: 'none' });
            }
          },
        });
      };

      wx.getSetting({
        success: (res) => {
          if (res.authSetting['scope.writePhotosAlbum'] === false) {
            this._handleAuthDeny();
          } else {
            doSave();
          }
        },
        fail: doSave,
      });
    },

    _handleAuthDeny() {
      this.setData({ saving: false, saveLabel: SAVE_LABEL_DEFAULT, saveIcon: '📷' });
      wx.showModal({
        title: '需要相册权限',
        content: '请在设置中允许保存图片到相册',
        confirmText: '去设置',
        success: (res) => {
          if (res.confirm) wx.openSetting();
        },
      });
    },

    // ===== 关闭 =====
    onClose() {
      this.triggerEvent('close');
    },

    // mask 点击:空实现,只为吃掉事件防穿透到下方页面(用户要求遮罩不关弹窗)
    onMaskTap() {},

    // content 点击:catchtap 防冒泡到 mask
    onContentTap() {},
  },
});
```

- [ ] **Step 5: IDE 语法自检**

在微信开发者工具里打开任何一个页面,确认编译无报错。重点看 4 个新文件 IDE 编辑器里没有红色波浪线;真机预览不需要,因为本任务还没有页面引用这个组件。

- [ ] **Step 6: Commit**

```bash
git add components/poster-share/
git commit -m "feat(poster-share): add modal component for poster sharing"
```

---

## Task 2: settlement 接入新组件

**Files:**
- Modify: `pages/settlement/settlement.json`
- Modify: `pages/settlement/settlement.wxml`
- Modify: `pages/settlement/settlement.js`

- [ ] **Step 1: `settlement.json` 加 usingComponents**

把 `usingComponents` 一节改成:

```json
{
  "navigationStyle": "custom",
  "usingComponents": {
    "navigation-bar": "/components/NavigationBar/navigation-bar",
    "poster-share": "/components/poster-share/poster-share"
  }
}
```

- [ ] **Step 2: `settlement.wxml` 加组件实例**

在根 `<view class="settlement-page">` 的**最后**(关闭标签前)、`</view>` 之前,加入 `<poster-share>` 标签:

找到现有的:
```xml
  <!-- Floating Stickers -->
  <view class="float-sticker float-sticker-tr">
    <text class="iconfont icon-book float-sticker-icon"></text>
  </view>
  <view class="float-sticker float-sticker-bl">
    <text class="iconfont icon-bulb float-sticker-icon-secondary"></text>
  </view>
</view>
```

改为:
```xml
  <!-- Floating Stickers -->
  <view class="float-sticker float-sticker-tr">
    <text class="iconfont icon-book float-sticker-icon"></text>
  </view>
  <view class="float-sticker float-sticker-bl">
    <text class="iconfont icon-bulb float-sticker-icon-secondary"></text>
  </view>

  <!-- 海报分享弹窗 -->
  <poster-share
    visible="{{posterVisible}}"
    mapId="{{mapId}}"
    bind:close="onPosterClose"
  />
</view>
```

- [ ] **Step 3: `settlement.js` 改 onSharePoster + 加 onPosterClose + data 字段**

3a. 在 `data` 对象的最后(`loadedFromGame: false,` 后面)加一行:

```javascript
    loadedFromGame: false,
    posterVisible: false,
```

3b. 把 `onSharePoster` 方法替换为:

```javascript
  onSharePoster() {
    this.setData({ posterVisible: true });
  },

  onPosterClose() {
    this.setData({ posterVisible: false });
  },
```

(删掉原方法里 `wx.navigateTo` 和构造 URL 的逻辑)

- [ ] **Step 4: IDE 手测**

打开微信开发者工具:
1. 进 settlement 页(可从编译菜单选「游戏结束」,或从其他入口走到通关页面)
2. 点「生成分享海报」按钮
3. **期望:** 屏幕中央出 loading toast「正在生成…」
4. 1-2 秒后,**期望:** loading 消失,弹窗淡入,直接显示完整海报图(无骨架闪烁)
5. 点击弹窗内「保存到相册」→ 弹权限提示(首次)或 toast「已保存到相册」
6. 点击「关闭预览」→ 弹窗消失,回到 settlement 页(不跳页)
7. 点击遮罩(海报图外的灰色区域)→ **弹窗不应该关**
8. 长按海报图 → 微信原生菜单(保存图片 / 收藏 / 转发等)
9. 再次点「生成分享海报」→ 能再次正常打开

若 #4 没有进入 loading 或 toast 卡死,检查 `properties.visible.observer` 是否正确触发(在 `_onVisibleChange` 里加 `console.log` 调试,确认后删除)。

- [ ] **Step 5: Commit**

```bash
git add pages/settlement/
git commit -m "feat(settlement): replace navigateTo to image-share with poster-share modal"
```

---

## Task 3: logs 接入新组件

**Files:**
- Modify: `pages/logs/logs.json`
- Modify: `pages/logs/logs.wxml`
- Modify: `pages/logs/logs.js`

- [ ] **Step 1: `logs.json` 加 usingComponents**

把 `usingComponents` 一节改成:

```json
{
  "navigationStyle": "custom",
  "usingComponents": {
    "navigation-bar": "/components/NavigationBar/navigation-bar",
    "log-entry": "/components/log-entry/log-entry",
    "poster-share": "/components/poster-share/poster-share"
  }
}
```

- [ ] **Step 2: `logs.wxml` 加组件实例**

在根 `<view class="logs-page">` 的**最后**(关闭标签前)加入 `<poster-share>`:

找到现有的:
```xml
  <!-- Floating Atmosphere Elements (Static Decoration) -->
  <view class="float-sticker float-sticker-top">
    <text class="iconfont icon-edit-square float-icon-lg"></text>
  </view>
  <view class="float-sticker float-sticker-bottom">
    <text class="iconfont icon-compass float-icon-xl"></text>
  </view>
</view>
```

改为:
```xml
  <!-- Floating Atmosphere Elements (Static Decoration) -->
  <view class="float-sticker float-sticker-top">
    <text class="iconfont icon-edit-square float-icon-lg"></text>
  </view>
  <view class="float-sticker float-sticker-bottom">
    <text class="iconfont icon-compass float-icon-xl"></text>
  </view>

  <!-- 海报分享弹窗 -->
  <poster-share
    visible="{{posterVisible}}"
    mapId="{{mapId}}"
    bind:close="onPosterClose"
  />
</view>
```

- [ ] **Step 3: `logs.js` 改 onShare + 加 onPosterClose + data 字段**

3a. 在 `data` 对象的最后(`loadedFromGame: false,` 后面)加一行:

```javascript
    loadedFromGame: false,
    posterVisible: false,
```

3b. 把 `onShare` 方法替换为:

```javascript
  onShare() {
    this.setData({ posterVisible: true });
  },

  onPosterClose() {
    this.setData({ posterVisible: false });
  },
```

(删掉原方法里 `wx.navigateTo` 和构造 URL 的逻辑)

- [ ] **Step 4: IDE 手测**

类似 Task 2 Step 4,但入口换成 logs 页的「分享这段旅程」按钮。完整 case:

1. 进 logs 页(如果有 mapId,会展示真实数据;无 mapId 走演示数据)
2. 滚到底部,点「分享这段旅程」按钮
3. 期望:中央 loading → 弹窗 → 完整海报图
4. 保存、关闭、遮罩不关、长按菜单 — 与 Task 2 一致
5. 多次打开关闭无异常

- [ ] **Step 5: Commit**

```bash
git add pages/logs/
git commit -m "feat(logs): replace navigateTo to image-share with poster-share modal"
```

---

## Task 4: 删除旧 image-share 页 + 清理注册

**Files:**
- Delete: `pages/image-share/` (整个目录)
- Modify: `app.json`
- Modify: `project.private.config.json`

- [ ] **Step 1: 删除 `pages/image-share/` 目录**

```bash
rm -rf /Users/sunanchen/workspace/city-monapoly/pages/image-share
```

确认结果:
```bash
ls /Users/sunanchen/workspace/city-monapoly/pages/
```
不应有 `image-share`。

- [ ] **Step 2: `app.json` 移除页面注册**

把:
```json
{
  "pages": [
    "pages/index/index",
    "pages/create/create",
    "pages/game/game",
    "pages/settlement/settlement",
    "pages/image-share/image-share",
    "pages/logs/logs",
    "pages/history/history",
    "pages/edit/edit",
    "pages/search/search"
  ],
```

改为:
```json
{
  "pages": [
    "pages/index/index",
    "pages/create/create",
    "pages/game/game",
    "pages/settlement/settlement",
    "pages/logs/logs",
    "pages/history/history",
    "pages/edit/edit",
    "pages/search/search"
  ],
```

(删 `"pages/image-share/image-share",` 这一行)

- [ ] **Step 3: `project.private.config.json` 移除编译入口**

把:
```json
        {
          "name": "pages/image-share/image-share",
          "pathName": "pages/image-share/image-share",
          "query": "",
          "scene": null,
          "launchMode": "default"
        },
```

整段(含前后逗号)从 `condition.miniprogram.list` 数组里删掉。

完整新版第一项应该改为 `searchempty`:
```json
      "list": [
        {
          "name": "pages/searchempty/searchempty",
          "pathName": "pages/searchempty/searchempty",
          "query": "",
          "launchMode": "default",
          "scene": null
        },
        ...
```

- [ ] **Step 4: 残留引用扫描**

```bash
grep -rn "image-share" /Users/sunanchen/workspace/city-monapoly --include="*.js" --include="*.wxml" --include="*.json" --include="*.wxss" 2>/dev/null | grep -v node_modules
```

**期望输出:**只剩 OSS URL 引用(`oss-cn-beijing.aliyuncs.com/pages/image-share/images/qr.png` 这种远程路径不影响,因为 QR 图在 OSS 上),以及 `utils/userProfile.js:13` 的历史注释 1 行。
不应该有任何 `pages/image-share/image-share` 路径引用(因为没有 navigateTo 调用方了)。

如果有意外残留,定位文件清掉再继续。

- [ ] **Step 5: IDE 全量编译验证**

在微信开发者工具里 **清理编译缓存** 后重新编译,确认:
1. 编译无报错
2. settlement 点分享 → 弹窗正常
3. logs 点分享 → 弹窗正常
4. 编译菜单里不再有 image-share 选项

- [ ] **Step 6: Commit**

```bash
git add app.json project.private.config.json pages/image-share
git commit -m "chore(cleanup): remove standalone image-share page, replaced by poster-share modal"
```

---

## 完成后总结

完成 4 个 Task 后,项目状态:

- 新增 `components/poster-share/`(4 文件 ~800 行,大多是平移代码)
- settlement / logs 各 3 文件修改(每个 ~10 行净改动)
- 删除 `pages/image-share/`(净减 ~1100 行)
- `app.json` / `project.private.config.json` 各减 1 项

预期净行数:**约 -300 行**(组件代码比页面略瘦,因为去掉了骨架 + scroll-view + navigation-bar 等弹窗不需要的部分)。

功能上:
- 用户从 settlement / logs 点分享 → 看到 toast loading → 弹窗弹出展示完整海报(无骨架闪烁)
- 弹窗遮罩点击不关(必须点按钮)
- 长按图片支持微信原生菜单
- 保存到相册、错误处理沿用原页面行为
