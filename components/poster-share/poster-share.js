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
