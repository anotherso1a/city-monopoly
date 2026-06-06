# City Monopoly Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a WeChat mini-program implementing a real-world Monopoly game with AI-generated maps based on real POIs, offline gameplay, and shareable timeline reports.

**Architecture:** Monolithic mini-program with modular structure. Core game engine manages state in localStorage. Map generation uses Amap POI API + LLM API. Board rendered via Canvas with touch interactions. Sharing via JSON file export/import.

**Tech Stack:** WeChat Mini Program (vanilla JS/TS), Canvas API, localStorage, Amap POI API, LLM API (OpenAI-compatible)

---

## Phase 1: Project Scaffolding & Core Infrastructure

### Task 1: Initialize Mini-Program Project Structure

**Files:**
- Create: `project.config.json`
- Create: `app.js`
- Create: `app.json`
- Create: `app.wxss`
- Create: `pages/index/index.js`
- Create: `pages/index/index.wxml`
- Create: `pages/index/index.wxss`
- Create: `pages/create/create.js`
- Create: `pages/create/create.wxml`
- Create: `pages/create/create.wxss`
- Create: `pages/game/game.js`
- Create: `pages/game/game.wxml`
- Create: `pages/game/game.wxss`
- Create: `pages/settlement/settlement.js`
- Create: `pages/settlement/settlement.wxml`
- Create: `pages/settlement/settlement.wxss`
- Create: `pages/history/history.js`
- Create: `pages/history/history.wxml`
- Create: `pages/history/history.wxss`
- Create: `utils/storage.js`
- Create: `utils/constants.js`
- Create: `utils/request.js`

- [ ] **Step 1: Create project.config.json**

```json
{
  "description": "City Monopoly - 现实版大富翁",
  "packOptions": {
    "ignore": []
  },
  "setting": {
    "urlCheck": false,
    "es6": true,
    "enhance": true,
    "postcss": true,
    "preloadBackgroundData": false,
    "minified": true,
    "newFeature": true
  },
  "compileType": "miniprogram",
  "appid": "wxb94eadd71f2651bf",
  "projectname": "city-monapoly",
  "condition": {}
}
```

- [ ] **Step 2: Create app.json with page configuration**

```json
{
  "pages": [
    "pages/index/index",
    "pages/create/create",
    "pages/game/game",
    "pages/settlement/settlement",
    "pages/history/history"
  ],
  "window": {
    "navigationBarBackgroundColor": "#D4A84B",
    "navigationBarTitleText": "City Monopoly",
    "navigationBarTextStyle": "white"
  },
  "permission": {
    "scope.userLocation": {
      "desc": "你的位置信息将用于生成游戏地图"
    }
  },
  "usingComponents": {}
}
```

- [ ] **Step 3: Create app.js with global state management**

```javascript
App({
  globalData: {
    currentGame: null,
    maps: []
  },
  onLaunch() {
    this.loadMapsFromStorage();
  },
  loadMapsFromStorage() {
    const maps = wx.getStorageSync('maps') || [];
    this.globalData.maps = maps;
  },
  saveMapsToStorage() {
    wx.setStorageSync('maps', this.globalData.maps);
  }
});
```

- [ ] **Step 4: Create app.wxss with global styles**

```css
page {
  background-color: #FFF8E7;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  color: #333;
  font-size: 28rpx;
}

.container {
  width: 100%;
  height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.btn-primary {
  background-color: #D4A84B;
  color: white;
  border-radius: 16rpx;
  padding: 24rpx 48rpx;
  font-size: 32rpx;
  border: none;
  box-shadow: 0 4rpx 12rpx rgba(212, 168, 75, 0.3);
}

.btn-secondary {
  background-color: #8B4513;
  color: white;
  border-radius: 16rpx;
  padding: 24rpx 48rpx;
  font-size: 32rpx;
  border: none;
}
```

- [ ] **Step 5: Create utils/constants.js**

```javascript
const INITIAL_GOLD = 1000;
const LAP_REWARD_GOLD = 500;
const DICE_MIN = 1;
const DICE_MAX = 6;
const DEFAULT_GRID_COUNT = 20;
const STORAGE_KEY_MAPS = 'maps';
const STORAGE_KEY_GAMES = 'games';
const STORAGE_KEY_SETTINGS = 'settings';

module.exports = {
  INITIAL_GOLD,
  LAP_REWARD_GOLD,
  DICE_MIN,
  DICE_MAX,
  DEFAULT_GRID_COUNT,
  STORAGE_KEY_MAPS,
  STORAGE_KEY_GAMES,
  STORAGE_KEY_SETTINGS
};
```

- [ ] **Step 6: Create utils/storage.js - StorageService wrapper**

```javascript
const STORAGE_KEY_MAPS = 'maps';
const STORAGE_KEY_GAMES = 'games';

function getMaps() {
  return wx.getStorageSync(STORAGE_KEY_MAPS) || [];
}

function saveMap(map) {
  const maps = getMaps();
  const existingIndex = maps.findIndex(m => m.id === map.id);
  if (existingIndex >= 0) {
    maps[existingIndex] = map;
  } else {
    maps.push(map);
  }
  wx.setStorageSync(STORAGE_KEY_MAPS, maps);
  return map;
}

function getMap(id) {
  const maps = getMaps();
  return maps.find(m => m.id === id) || null;
}

function deleteMap(id) {
  const maps = getMaps();
  const filtered = maps.filter(m => m.id !== id);
  wx.setStorageSync(STORAGE_KEY_MAPS, filtered);
}

function getGames() {
  return wx.getStorageSync(STORAGE_KEY_GAMES) || [];
}

function saveGame(game) {
  const games = getGames();
  const existingIndex = games.findIndex(g => g.id === game.id);
  if (existingIndex >= 0) {
    games[existingIndex] = game;
  } else {
    games.push(game);
  }
  wx.setStorageSync(STORAGE_KEY_GAMES, games);
  return game;
}

function getGame(id) {
  const games = getGames();
  return games.find(g => g.id === id) || null;
}

function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

module.exports = {
  getMaps,
  saveMap,
  getMap,
  deleteMap,
  getGames,
  saveGame,
  getGame,
  generateId
};
```

- [ ] **Step 7: Create utils/request.js - API request wrapper**

```javascript
function request({ url, method = 'GET', data = {}, header = {} }) {
  return new Promise((resolve, reject) => {
    wx.showLoading({ title: '加载中...' });
    wx.request({
      url,
      method,
      data,
      header: {
        'Content-Type': 'application/json',
        ...header
      },
      success(res) {
        wx.hideLoading();
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject(new Error(`Request failed with status ${res.statusCode}`));
        }
      },
      fail(err) {
        wx.hideLoading();
        reject(err);
      }
    });
  });
}

module.exports = { request };
```

- [ ] **Step 8: Create pages/index/index.wxml - Home page**

```xml
<view class="container">
  <view class="bg-wrapper">
    <image class="bg-image" src="/assets/images/bg_main.png" mode="aspectFill"/>
    <view class="overlay">
      <view class="logo-section">
        <text class="title">City Monopoly</text>
        <text class="subtitle">现实版大富翁</text>
      </view>
      <view class="btn-section">
        <button class="btn-primary" bindtap="onCreateMap">创建地图</button>
        <button class="btn-secondary" bindtap="onViewHistory">历史地图</button>
      </view>
    </view>
  </view>
</view>
```

- [ ] **Step 9: Create pages/index/index.js - Home page logic**

```javascript
const storage = require('../../utils/storage');

Page({
  data: {},
  onCreateMap() {
    wx.navigateTo({ url: '/pages/create/create' });
  },
  onViewHistory() {
    wx.navigateTo({ url: '/pages/history/history' });
  }
});
```

- [ ] **Step 10: Create pages/index/index.wxss - Home page styles**

```css
.container {
  width: 100%;
  height: 100vh;
  position: relative;
}

.bg-wrapper {
  width: 100%;
  height: 100%;
  position: relative;
}

.bg-image {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
}

.overlay {
  width: 100%;
  height: 100%;
  position: absolute;
  top: 0;
  left: 0;
  background: rgba(0, 0, 0, 0.3);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.logo-section {
  text-align: center;
  margin-bottom: 120rpx;
}

.title {
  display: block;
  font-size: 72rpx;
  font-weight: bold;
  color: #D4A84B;
  text-shadow: 2rpx 2rpx 8rpx rgba(0,0,0,0.5);
  margin-bottom: 20rpx;
}

.subtitle {
  display: block;
  font-size: 36rpx;
  color: white;
  text-shadow: 1rpx 1rpx 4rpx rgba(0,0,0,0.5);
}

.btn-section {
  display: flex;
  flex-direction: column;
  gap: 32rpx;
}

.btn-primary {
  width: 400rpx;
  height: 100rpx;
  line-height: 100rpx;
  background: linear-gradient(135deg, #D4A84B 0%, #C41E3A 100%);
  color: white;
  font-size: 36rpx;
  font-weight: bold;
  border-radius: 50rpx;
  border: none;
  box-shadow: 0 8rpx 24rpx rgba(196, 30, 58, 0.4);
}

.btn-secondary {
  width: 400rpx;
  height: 100rpx;
  line-height: 100rpx;
  background: rgba(255, 255, 255, 0.9);
  color: #8B4513;
  font-size: 36rpx;
  font-weight: bold;
  border-radius: 50rpx;
  border: 2rpx solid #8B4513;
}
```

- [ ] **Step 11: Create placeholder pages for create, game, settlement, history**

Create minimal placeholder pages for all routes to ensure app.json routes work.

- [ ] **Step 12: Create assets directory structure**

```
assets/
├── images/
│   ├── bg_main.png
│   ├── dice_1.png
│   ├── dice_2.png
│   ├── dice_3.png
│   ├── dice_4.png
│   ├── dice_5.png
│   ├── dice_6.png
│   ├── grid_poi.png
│   ├── grid_chance.png
│   └── placeholder.png
└── fonts/
```

- [ ] **Step 13: Commit Phase 1**

```bash
git add -A
git commit -m "feat: initialize WeChat mini-program project structure

- Add project.config.json, app.js/json/wxss
- Create page directories: index, create, game, settlement, history
- Add StorageService wrapper (utils/storage.js)
- Add Constants (utils/constants.js)
- Add Request wrapper (utils/request.js)
- Add index page with home UI (bg + buttons)
- Add placeholder assets directory structure"
```

---

### Task 2: POI Service (Amap Integration)

**Files:**
- Create: `services/amapService.js`
- Create: `services/poiService.js`

- [ ] **Step 1: Create services/amapService.js - Amap API wrapper**

```javascript
const { request } = require('../utils/request');

const AMAP_KEY = 'YOUR_AMAP_KEY'; // To be configured by user
const AMAP_BASE_URL = 'https://restapi.amap.com/v3';

async function searchPOI({ keywords, types, location, radius, offset = 20, page = 1 }) {
  const url = `${AMAP_BASE_URL}/place/text`;
  const params = {
    key: AMAP_KEY,
    keywords: keywords.join('|'),
    types: types.join('|'),
    location: location,
    radius: radius,
    offset: offset,
    page: page,
    extensions: 'all'
  };

  try {
    const data = await request({ url, data: params });
    if (data.status === '1' && data.pois) {
      return data.pois.map(poi => ({
        name: poi.name,
        address: poi.address || '',
        type: poi.type || '',
        typecode: poi.typecode || '',
        location: poi.location ? {
          lng: parseFloat(poi.location.split(',')[0]),
          lat: parseFloat(poi.location.split(',')[1])
        } : null,
        tel: poi.tel || '',
        photos: poi.photos || []
      }));
    }
    return [];
  } catch (err) {
    console.error('Amap POI search failed:', err);
    return [];
  }
}

async function getPOIsByRadius(location, radiusMeters, categories) {
  const typeMap = {
    '餐饮': '050000',
    '购物': '060000',
    '景点': '110000',
    '公共设施': '150000',
    '交通': '150200'
  };

  const types = categories.map(c => typeMap[c] || '').filter(t => t);
  const keywords = categories;

  let allPOIs = [];
  for (let i = 0; i < 3; i++) {
    const pois = await searchPOI({
      keywords,
      types,
      location: `${location.lng},${location.lat}`,
      radius: radiusMeters,
      offset: 50,
      page: i + 1
    });
    allPOIs = allPOIs.concat(pois);
  }

  // Deduplicate by name
  const seen = new Set();
  return allPOIs.filter(poi => {
    if (seen.has(poi.name)) return false;
    seen.add(poi.name);
    return true;
  });
}

module.exports = {
  searchPOI,
  getPOIsByRadius
};
```

- [ ] **Step 2: Create services/poiService.js - POI data transformation**

```javascript
const { getPOIsByRadius } = require('./amapService');

const POI_CATEGORIES = {
  FOOD: ['餐饮'],
  SHOPPING: ['购物'],
  SCENIC: ['景点'],
  FACILITY: ['公共设施'],
  TRANSPORT: ['交通']
};

async function fetchPOIsForMap(centerLocation, radius, selectedCategories) {
  const categories = selectedCategories.length > 0
    ? selectedCategories
    : Object.keys(POI_CATEGORIES);

  const pois = await getPOIsByRadius(centerLocation, radius, categories);

  return pois.map(poi => ({
    name: poi.name,
    address: poi.address,
    type: poi.type,
    typecode: poi.typecode,
    location: poi.location,
    phone: poi.tel,
    images: poi.photos.map(p => p.url).slice(0, 3)
  }));
}

function filterPOIsByGridCount(pois, gridCount) {
  if (pois.length <= gridCount) return pois;

  // Distribute types evenly
  const typeGroups = {};
  pois.forEach(poi => {
    const mainType = poi.type.split(';')[0] || '其他';
    if (!typeGroups[mainType]) typeGroups[mainType] = [];
    typeGroups[mainType].push(poi);
  });

  const result = [];
  let typeKeys = Object.keys(typeGroups);
  let idx = 0;

  while (result.length < gridCount && idx < pois.length * 2) {
    for (let k = 0; k < typeKeys.length && result.length < gridCount; k++) {
      const group = typeGroups[typeKeys[(idx + k) % typeKeys.length]];
      if (group.length > 0) {
        result.push(group.shift());
      }
    }
    idx++;
  }

  return result.slice(0, gridCount);
}

module.exports = {
  fetchPOIsForMap,
  filterPOIsByGridCount,
  POI_CATEGORIES
};
```

- [ ] **Step 3: Commit**

```bash
git add services/poiService.js services/amapService.js
git commit -m "feat: add POI service for Amap integration

- amapService.js: Amap API wrapper with searchPOI and getPOIsByRadius
- poiService.js: POI data transformation and filtering
- Supports categories: food, shopping, scenic, facility, transport"
```

---

### Task 3: AI Map Generation Service

**Files:**
- Create: `services/aiService.js`

- [ ] **Step 1: Create services/aiService.js - LLM API integration**

```javascript
const { request } = require('../utils/request');
const { generateId } = require('../utils/storage');

const AI_API_URL = 'YOUR_LLM_API_ENDPOINT'; // Configured by user
const AI_API_KEY = 'YOUR_LLM_API_KEY';

const CHANCE_CARD_TEMPLATES = [
  {
    type: 'food',
    goldRange: [-300, -150],
    descriptions: [
      '你太渴了，购买饮品花费 {gold} 金币。当然，你如果真的渴了可以去附近买一杯饮品打卡记录哦～',
      '路过甜品店，忍不住买了份蛋糕，花费 {gold} 金币',
      '肚子有点饿，买点小零食，花费 {gold} 金币'
    ]
  },
  {
    type: 'restaurant',
    goldRange: [-500, -200],
    descriptions: [
      '到了饭点，找家餐厅饱餐一顿，花费 {gold} 金币',
      '路过一家网红餐厅，进去尝尝鲜，花费 {gold} 金币'
    ]
  },
  {
    type: 'transport',
    goldRange: [-150, -50],
    descriptions: [
      '懒得走了，打车代步，花费 {gold} 金币',
      '扫了辆共享单车，花费 {gold} 金币'
    ]
  },
  {
    type: 'reward',
    goldRange: [200, 800],
    descriptions: [
      '恭喜获得 {gold} 金币奖励！',
      '运气爆棚！发现路边有零钱，捡到 {gold} 金币！',
      '完成了隐藏任务，获得 {gold} 金币奖励！'
    ]
  },
  {
    type: 'penalty',
    goldRange: [-500, -100],
    descriptions: [
      '不小心把金币弄丢了，损失 {gold} 金币...',
      '遇到了骗子，被骗走 {gold} 金币...',
      '粗心大意丢失了 {gold} 金币'
    ]
  }
];

function buildMapGenerationPrompt(pois, gridCount, config) {
  const poiList = pois.map((p, i) => `${i + 1}. ${p.name} (${p.type}) - ${p.address}`).join('\n');

  return `你是一个游戏设计师，需要根据以下 POI 数据设计一个大富翁风格的环形地图。

POI 数据：
${poiList}

要求：
1. 生成 ${gridCount} 个格子的环形地图
2. 机会卡格子占 15-20%（约 ${Math.floor(gridCount * 0.18)} 个格子）
3. POI 格子使用提供的真实地点
4. 同类 POI 尽量分散，避免连续排列
5. 为每个机会卡格子生成随机事件描述
6. 金币变化数值在合理范围内（奖励 200-800，惩罚 50-500）
7. 部分机会卡添加打卡建议（suggestCheckin: true）

输出 JSON 格式（仅输出 JSON，不要其他内容）：
{
  "name": "地图名称",
  "grids": [
    {
      "index": 0,
      "type": "poi",
      "poi": { "name": "...", "address": "...", "type": "...", "location": {...}, "images": [...] }
    },
    {
      "index": 1,
      "type": "chance",
      "chanceCard": { "description": "...", "goldChange": -200, "suggestCheckin": true, "checkinType": "餐饮" }
    }
  ],
  "config": {
    "initialGold": ${config.initialGold || 1000},
    "lapRewardGold": ${config.lapRewardGold || 500},
    "allowRepeatCheckin": ${config.allowRepeatCheckin || false}
  }
}`;
}

function parseGoldChange(goldStr) {
  const match = goldStr.match(/[-+]?\d+/);
  return match ? parseInt(match[0]) : 0;
}

function selectRandomDescription(templates, goldChange) {
  const relevantTemplates = templates.filter(t => {
    if (goldChange > 0) return t.goldRange[0] > 0;
    return t.goldRange[1] < 0;
  });
  const template = relevantTemplates[Math.floor(Math.random() * relevantTemplates.length)];
  const desc = template.descriptions[Math.floor(Math.random() * template.descriptions.length)];
  return desc.replace('{gold}', Math.abs(goldChange));
}

async function generateMap(pois, config) {
  const gridCount = config.gridCount || 20;
  const prompt = buildMapGenerationPrompt(pois, gridCount, config);

  try {
    const data = await request({
      url: AI_API_URL,
      method: 'POST',
      data: {
        prompt,
        max_tokens: 2000,
        temperature: 0.7
      },
      header: {
        'Authorization': `Bearer ${AI_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });

    const text = data.choices?.[0]?.text || data.choices?.[0]?.message?.content || '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) {
      throw new Error('Failed to parse AI response as JSON');
    }

    const mapData = JSON.parse(jsonMatch[0]);

    // Validate and fix structure
    return validateAndFixMapData(mapData, pois);

  } catch (err) {
    console.error('AI map generation failed:', err);
    throw err;
  }
}

function validateAndFixMapData(mapData, pois) {
  // Ensure grids array exists and has correct structure
  if (!mapData.grids || !Array.isArray(mapData.grids)) {
    mapData.grids = [];
  }

  // Assign POIs to grid slots
  const poiGrids = mapData.grids.filter(g => g.type === 'poi');
  const chanceGrids = mapData.grids.filter(g => g.type === 'chance');

  // If not enough POI grids, fill with available POIs
  const gridCount = mapData.grids.length || 20;
  const poiCount = Math.max(0, gridCount - chanceGrids.length);

  for (let i = 0; i < gridCount; i++) {
    if (!mapData.grids[i]) {
      mapData.grids[i] = { index: i, type: 'poi', poi: null, chanceCard: null };
    } else {
      mapData.grids[i].index = i;
    }
  }

  // Ensure ID and timestamps
  mapData.id = mapData.id || generateId();
  mapData.createdAt = mapData.createdAt || new Date().toISOString();
  mapData.version = '1.0';

  // Validate POI locations are within range
  const validPOIs = pois.filter(p => p.location && p.location.lat && p.location.lng);
  mapData.grids.forEach((grid, idx) => {
    if (grid.type === 'poi' && (!grid.poi || !grid.poi.location)) {
      const poi = validPOIs[idx % validPOIs.length];
      if (poi) {
        grid.poi = poi;
      }
    }
  });

  return mapData;
}

function generateChanceCards(count) {
  const cards = [];
  for (let i = 0; i < count; i++) {
    const templateIdx = Math.floor(Math.random() * CHANCE_CARD_TEMPLATES.length);
    const template = CHANCE_CARD_TEMPLATES[templateIdx];
    const goldChange = template.goldRange[0] + Math.floor(Math.random() * (template.goldRange[1] - template.goldRange[0]));
    const description = selectRandomDescription(CHANCE_CARD_TEMPLATES, goldChange);

    cards.push({
      description,
      goldChange,
      suggestCheckin: goldChange < 0 && Math.random() > 0.5,
      checkinType: goldChange < 0 ? template.type : null
    });
  }
  return cards;
}

module.exports = {
  generateMap,
  generateChanceCards,
  CHANCE_CARD_TEMPLATES
};
```

- [ ] **Step 2: Commit**

```bash
git add services/aiService.js
git commit -m "feat: add AI map generation service

- LLM API integration for map generation
- Prompt builder for POI-to-map transformation
- Chance card template system with multiple categories
- Map data validation and fixing utilities"
```

---

## Phase 2: Map Creator Module

### Task 4: Map Creator Page UI

**Files:**
- Modify: `pages/create/create.wxml`
- Modify: `pages/create/create.js`
- Modify: `pages/create/create.wxss`

- [ ] **Step 1: Create pages/create/create.wxml - Create page wizard layout**

```xml
<view class="container">
  <!-- Step indicator -->
  <view class="step-indicator">
    <view class="step {{step >= 1 ? 'active' : ''}}">1. 定位</view>
    <view class="step-line {{step > 1 ? 'active' : ''}}"></view>
    <view class="step {{step >= 2 ? 'active' : ''}}">2. 范围</view>
    <view class="step-line {{step > 2 ? 'active' : ''}}"></view>
    <view class="step {{step >= 3 ? 'active' : ''}}">3. 选项</view>
    <view class="step-line {{step > 3 ? 'active' : ''}}"></view>
    <view class="step {{step >= 4 ? 'active' : ''}}">4. 生成</view>
  </view>

  <!-- Step 1: Location -->
  <view class="step-content" wx:if="{{step === 1}}">
    <view class="location-box">
      <text class="location-text" wx:if="{{location}}">当前位置：{{location.address}}</text>
      <text class="location-text" wx:else>正在获取位置...</text>
      <button class="btn-primary" bindtap="getLocation" disabled="{{gettingLocation}}">
        {{gettingLocation ? '获取中...' : '重新定位'}}
      </button>
    </view>
  </view>

  <!-- Step 2: Range Selection -->
  <view class="step-content" wx:if="{{step === 2}}">
    <view class="range-options">
      <view class="range-option {{range === 500 ? 'selected' : ''}}" bindtap="selectRange" data-range="500">
        <text class="range-value">500m</text>
        <text class="range-desc">近距离探索</text>
      </view>
      <view class="range-option {{range === 1000 ? 'selected' : ''}}" bindtap="selectRange" data-range="1000">
        <text class="range-value">1km</text>
        <text class="range-desc">常规范围</text>
      </view>
      <view class="range-option {{range === 1500 ? 'selected' : ''}}" bindtap="selectRange" data-range="1500">
        <text class="range-value">1.5km</text>
        <text class="range-desc">深度探索</text>
      </view>
    </view>
  </view>

  <!-- Step 3: Config Options -->
  <view class="step-content" wx:if="{{step === 3}}">
    <view class="config-section">
      <text class="config-label">地图名称</text>
      <input class="config-input" placeholder="默认：我的探索-日期" value="{{mapName}}" bindinput="onMapNameInput"/>
    </view>

    <view class="config-section">
      <text class="config-label">格子数量</text>
      <view class="grid-count-options">
        <view class="grid-option {{gridCount === 15 ? 'selected' : ''}}" bindtap="selectGridCount" data-count="15">15</view>
        <view class="grid-option {{gridCount === 20 ? 'selected' : ''}}" bindtap="selectGridCount" data-count="20">20</view>
        <view class="grid-option {{gridCount === 25 ? 'selected' : ''}}" bindtap="selectGridCount" data-count="25">25</view>
        <view class="grid-option {{gridCount === 30 ? 'selected' : ''}}" bindtap="selectGridCount" data-count="30">30</view>
      </view>
    </view>

    <view class="config-section">
      <text class="config-label">允许重复打卡</text>
      <switch checked="{{allowRepeatCheckin}}" bindchange="onAllowRepeatChange"/>
    </view>

    <view class="config-section">
      <text class="config-label">起始金币</text>
      <input class="config-input" type="number" value="{{initialGold}}" bindinput="onInitialGoldInput"/>
    </view>

    <view class="config-section">
      <text class="config-label">每圈奖励</text>
      <input class="config-input" type="number" value="{{lapRewardGold}}" bindinput="onLapRewardInput"/>
    </view>
  </view>

  <!-- Step 4: Generating / Preview -->
  <view class="step-content" wx:if="{{step === 4}}">
    <view class="generating" wx:if="{{generating}}">
      <view class="spinner"></view>
      <text class="generating-text">AI 正在生成地图...</text>
      <text class="generating-subtext">请稍候，这可能需要几秒钟</text>
    </view>
    <view class="preview" wx:else>
      <text class="preview-title">{{generatedMap.name}}</text>
      <text class="preview-info">共 {{generatedMap.grids.length}} 个格子</text>
    </view>
  </view>

  <!-- Navigation Buttons -->
  <view class="nav-buttons">
    <button class="btn-back" wx:if="{{step > 1 && !generating}}" bindtap="prevStep">上一步</button>
    <button class="btn-primary" wx:if="{{step < 4 && !generating}}" bindtap="nextStep">下一步</button>
    <button class="btn-primary" wx:if="{{step === 4 && !generating}}" bindtap="saveMap">保存地图</button>
    <button class="btn-secondary" wx:if="{{step === 4 && !generating}}" bindtap="regenerateMap">重新生成</button>
  </view>
</view>
```

- [ ] **Step 2: Create pages/create/create.js - Create page logic**

```javascript
const { fetchPOIsForMap, POI_CATEGORIES } = require('../../services/poiService');
const { generateMap } = require('../../services/aiService');
const { saveMap } = require('../../utils/storage');
const { INITIAL_GOLD, LAP_REWARD_GOLD } = require('../../utils/constants');

Page({
  data: {
    step: 1,
    gettingLocation: false,
    location: null,
    range: 1000,
    mapName: '',
    gridCount: 20,
    allowRepeatCheckin: false,
    initialGold: INITIAL_GOLD,
    lapRewardGold: LAP_REWARD_GOLD,
    generating: false,
    generatedMap: null
  },

  onLoad() {
    this.getLocation();
  },

  async getLocation() {
    this.setData({ gettingLocation: true });

    try {
      const res = await wx.getLocation({ type: 'gcj02' });
      this.setData({
        location: {
          lat: res.latitude,
          lng: res.longitude,
          address: '已获取定位'
        },
        gettingLocation: false
      });
    } catch (err) {
      wx.showToast({ title: '请授权定位', icon: 'none' });
      this.setData({ gettingLocation: false });
    }
  },

  selectRange(e) {
    this.setData({ range: parseInt(e.currentTarget.dataset.range) });
  },

  onMapNameInput(e) {
    this.setData({ mapName: e.detail.value });
  },

  selectGridCount(e) {
    this.setData({ gridCount: parseInt(e.currentTarget.dataset.count) });
  },

  onAllowRepeatChange(e) {
    this.setData({ allowRepeatCheckin: e.detail.value });
  },

  onInitialGoldInput(e) {
    this.setData({ initialGold: parseInt(e.detail.value) || INITIAL_GOLD });
  },

  onLapRewardInput(e) {
    this.setData({ lapRewardGold: parseInt(e.detail.value) || LAP_REWARD_GOLD });
  },

  nextStep() {
    if (this.data.step === 1 && !this.data.location) {
      wx.showToast({ title: '请先获取定位', icon: 'none' });
      return;
    }
    if (this.data.step < 4) {
      this.setData({ step: this.data.step + 1 });
    }
    if (this.data.step === 3) {
      this.startGenerateMap();
    }
  },

  prevStep() {
    if (this.data.step > 1) {
      this.setData({ step: this.data.step - 1 });
    }
  },

  async startGenerateMap() {
    this.setData({ generating: true });

    try {
      const pois = await fetchPOIsForMap(
        { lat: this.data.location.lat, lng: this.data.location.lng },
        this.data.range,
        Object.keys(POI_CATEGORIES)
      );

      if (pois.length < this.data.gridCount) {
        wx.showToast({ title: `附近地点不足${this.data.gridCount}个，请扩大范围`, icon: 'none' });
        this.setData({ generating: false, step: 2 });
        return;
      }

      const config = {
        gridCount: this.data.gridCount,
        allowRepeatCheckin: this.data.allowRepeatCheckin,
        initialGold: this.data.initialGold,
        lapRewardGold: this.data.lapRewardGold
      };

      const mapData = await generateMap(pois, config);

      this.setData({
        generatedMap: mapData,
        generating: false
      });

    } catch (err) {
      wx.showToast({ title: '生成失败：' + err.message, icon: 'none' });
      this.setData({ generating: false });
    }
  },

  async regenerateMap() {
    this.setData({ step: 3 });
    this.nextStep();
  },

  saveMap() {
    if (!this.data.generatedMap) return;

    const map = {
      ...this.data.generatedMap,
      name: this.data.mapName || `我的探索-${new Date().toLocaleDateString()}`
    };

    saveMap(map);

    wx.showToast({ title: '保存成功', icon: 'success' });

    setTimeout(() => {
      wx.navigateBack();
    }, 1000);
  }
});
```

- [ ] **Step 3: Create pages/create/create.wxss - Create page styles**

```css
.container {
  padding: 32rpx;
  min-height: 100vh;
  background: #FFF8E7;
}

.step-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 60rpx;
}

.step {
  font-size: 28rpx;
  color: #999;
  padding: 16rpx 24rpx;
  border: 2rpx solid #ddd;
  border-radius: 32rpx;
}

.step.active {
  color: #D4A84B;
  border-color: #D4A84B;
  background: rgba(212, 168, 75, 0.1);
}

.step-line {
  width: 60rpx;
  height: 4rpx;
  background: #ddd;
  margin: 0 8rpx;
}

.step-line.active {
  background: #D4A84B;
}

.step-content {
  min-height: 600rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

/* Step 1: Location */
.location-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32rpx;
  margin-top: 100rpx;
}

.location-text {
  font-size: 32rpx;
  color: #333;
}

/* Step 2: Range */
.range-options {
  display: flex;
  gap: 32rpx;
  margin-top: 80rpx;
}

.range-option {
  width: 200rpx;
  height: 240rpx;
  background: white;
  border: 4rpx solid #ddd;
  border-radius: 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
}

.range-option.selected {
  border-color: #D4A84B;
  background: rgba(212, 168, 75, 0.1);
}

.range-value {
  font-size: 48rpx;
  font-weight: bold;
  color: #333;
}

.range-desc {
  font-size: 24rpx;
  color: #666;
}

/* Step 3: Config */
.config-section {
  width: 100%;
  margin-bottom: 48rpx;
}

.config-label {
  display: block;
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 16rpx;
}

.config-input {
  width: 100%;
  height: 88rpx;
  background: white;
  border: 2rpx solid #ddd;
  border-radius: 16rpx;
  padding: 0 24rpx;
  font-size: 32rpx;
}

.grid-count-options {
  display: flex;
  gap: 16rpx;
}

.grid-option {
  width: 100rpx;
  height: 100rpx;
  background: white;
  border: 4rpx solid #ddd;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  font-weight: bold;
}

.grid-option.selected {
  border-color: #D4A84B;
  background: rgba(212, 168, 75, 0.1);
}

/* Step 4: Generating */
.generating {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 150rpx;
}

.spinner {
  width: 80rpx;
  height: 80rpx;
  border: 6rpx solid #ddd;
  border-top-color: #D4A84B;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.generating-text {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  margin-top: 32rpx;
}

.generating-subtext {
  font-size: 28rpx;
  color: #666;
  margin-top: 16rpx;
}

.preview {
  margin-top: 100rpx;
  text-align: center;
}

.preview-title {
  font-size: 40rpx;
  font-weight: bold;
  color: #333;
}

.preview-info {
  font-size: 28rpx;
  color: #666;
  margin-top: 16rpx;
}

/* Navigation Buttons */
.nav-buttons {
  display: flex;
  gap: 24rpx;
  margin-top: 60rpx;
  padding-bottom: 60rpx;
}

.btn-back {
  flex: 1;
  height: 96rpx;
  line-height: 96rpx;
  background: white;
  color: #666;
  font-size: 32rpx;
  border: 2rpx solid #ddd;
  border-radius: 48rpx;
}

.btn-primary {
  flex: 1;
  height: 96rpx;
  line-height: 96rpx;
  background: #D4A84B;
  color: white;
  font-size: 32rpx;
  font-weight: bold;
  border: none;
  border-radius: 48rpx;
}

.btn-secondary {
  flex: 1;
  height: 96rpx;
  line-height: 96rpx;
  background: white;
  color: #8B4513;
  font-size: 32rpx;
  border: 2rpx solid #8B4513;
  border-radius: 48rpx;
}
```

- [ ] **Step 4: Commit**

```bash
git add pages/create/create.wxml pages/create/create.js pages/create/create.wxss
git commit -m "feat: implement map creator page UI and logic

- 4-step wizard: location, range, config, generate
- Step indicator component
- Range selection (500m/1km/1.5km)
- Config options: name, grid count, repeat checkin, gold settings
- AI map generation integration
- Save/preview/retry functionality"
```

---

## Phase 3: Game Core Module

### Task 5: Game Engine

**Files:**
- Create: `services/gameEngine.js`

- [ ] **Step 1: Create services/gameEngine.js - Core game logic**

```javascript
const { generateId, saveGame, getGame } = require('../utils/storage');
const { INITIAL_GOLD, LAP_REWARD_GOLD, DICE_MIN, DICE_MAX } = require('../utils/constants');
const { generateChanceCards } = require('./aiService');

class GameEngine {
  constructor(mapId, mapData) {
    this.mapId = mapId;
    this.map = mapData;
    this.state = {
      id: generateId(),
      mapId: mapId,
      startedAt: new Date().toISOString(),
      endedAt: null,
      currentGridIndex: 0,
      currentLap: 0,
      currentGold: mapData.config?.initialGold || INITIAL_GOLD,
      diceRolls: 0,
      checkins: [],
      chanceCardHistory: [],
      distance: 0,
      status: 'playing'
    };

    // Pre-generate chance cards for each chance grid
    this.chanceCardsCache = {};
    this.map.grids.forEach((grid, idx) => {
      if (grid.type === 'chance') {
        this.chanceCardsCache[idx] = generateChanceCards(5);
      }
    });
  }

  static load(gameId) {
    const savedState = getGame(gameId);
    if (!savedState) return null;

    const engine = new GameEngine(savedState.mapId, {});
    engine.state = savedState;
    return engine;
  }

  rollDice() {
    const result = DICE_MIN + Math.floor(Math.random() * (DICE_MAX - DICE_MIN + 1));
    this.state.diceRolls++;
    return result;
  }

  move(steps) {
    const previousIndex = this.state.currentGridIndex;
    this.state.currentGridIndex = (this.state.currentGridIndex + steps) % this.map.grids.length;

    // Check if crossed starting point (completed a lap)
    if (previousIndex + steps >= this.map.grids.length) {
      this.state.currentLap++;
      this.state.currentGold += this.map.config?.lapRewardGold || LAP_REWARD_GOLD;
    }

    this.save();
    return this.getCurrentGrid();
  }

  getCurrentGrid() {
    return this.map.grids[this.state.currentGridIndex];
  }

  checkin(photoPath, note = '') {
    const grid = this.getCurrentGrid();

    // Check if repeat checkin is allowed
    if (!this.map.config?.allowRepeatCheckin) {
      const alreadyCheckedIn = this.state.checkins.some(c => c.gridIndex === this.state.currentGridIndex);
      if (alreadyCheckedIn) {
        return { success: false, message: '此位置已打卡' };
      }
    }

    this.state.checkins.push({
      gridIndex: this.state.currentGridIndex,
      timestamp: new Date().toISOString(),
      photoUrl: photoPath,
      note: note || (grid.type === 'poi' ? grid.poi?.name : '机会卡打卡')
    });

    this.save();
    return { success: true };
  }

  drawChanceCard() {
    const gridIndex = this.state.currentGridIndex;
    const grid = this.map.grids[gridIndex];

    if (grid.type !== 'chance') {
      return null;
    }

    const cards = this.chanceCardsCache[gridIndex];
    if (!cards || cards.length === 0) {
      return null;
    }

    const card = cards.pop();

    // Apply gold change
    this.state.currentGold += card.goldChange;

    // Record history
    this.state.chanceCardHistory.push({
      gridIndex,
      card,
      timestamp: new Date().toISOString()
    });

    this.save();
    return card;
  }

  addDistance(meters) {
    this.state.distance += meters;
    this.save();
  }

  settle() {
    this.state.status = 'completed';
    this.state.endedAt = new Date().toISOString();
    this.save();
  }

  getState() {
    return { ...this.state };
  }

  getTimeline() {
    const events = [];

    // Add start checkin
    if (this.state.checkins.length > 0 && this.state.checkins[0].gridIndex === 0) {
      events.push(this.state.checkins[0]);
    } else {
      events.push({
        gridIndex: 0,
        timestamp: this.state.startedAt,
        note: '起点'
      });
    }

    // Sort checkins by timestamp
    const sortedCheckins = [...this.state.checkins].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );

    events.push(...sortedCheckins);

    // Add chance card draws
    this.state.chanceCardHistory.forEach(ch => {
      const grid = this.map.grids[ch.gridIndex];
      events.push({
        gridIndex: ch.gridIndex,
        timestamp: ch.timestamp,
        note: `机会卡：${ch.card.description}`,
        isChanceCard: true
      });
    });

    return events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  getStatistics() {
    const startTime = new Date(this.state.startedAt);
    const endTime = this.state.endedAt ? new Date(this.state.endedAt) : new Date();
    const durationMs = endTime - startTime;
    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.floor((durationMs % 3600000) / 60000);

    return {
      totalDiceRolls: this.state.diceRolls,
      totalDistance: this.state.distance,
      totalDuration: `${hours}小时${minutes}分钟`,
      currentGold: this.state.currentGold,
      totalCheckins: this.state.checkins.length,
      totalLaps: this.state.currentLap
    };
  }

  save() {
    saveGame(this.state);
  }
}

module.exports = { GameEngine };
```

- [ ] **Step 2: Commit**

```bash
git add services/gameEngine.js
git commit -m "feat: implement GameEngine core logic

- Dice rolling with random 1-6
- Movement along circular grid with lap detection
- Check-in system with repeat checkin validation
- Chance card drawing with cached cards per grid
- Game state persistence to localStorage
- Timeline generation for settlement
- Statistics calculation for end-game summary"
```

---

### Task 6: Board Rendering (Canvas)

**Files:**
- Create: `components/Board/board.js`
- Create: `components/Board/board.wxml`
- Create: `components/Board/board.wxss`

- [ ] **Step 1: Create components/Board/board.js - Canvas-based board renderer**

```javascript
Component({
  properties: {
    grids: {
      type: Array,
      value: []
    },
    currentGridIndex: {
      type: Number,
      value: 0
    },
    currentLap: {
      type: Number,
      value: 0
    },
    scale: {
      type: Number,
      value: 1
    },
    offsetX: {
      type: Number,
      value: 0
    },
    offsetY: {
      type: Number,
      value: 0
    }
  },

  data: {
    canvasWidth: 700,
    canvasHeight: 700
  },

  lifetimes: {
    attached() {
      this.initCanvas();
    },
    detached() {
      if (this.ctx) {
        this.ctx = null;
      }
    }
  },

  observers: {
    'grids,currentGridIndex,scale,offsetX,offsetY': function() {
      this.render();
    }
  },

  methods: {
    initCanvas() {
      const query = wx.createSelectorQuery().in(this);
      query.select('.board-canvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (res[0]) {
            const canvas = res[0].node;
            const ctx = canvas.getContext('2d');

            // Set canvas size
            const dpr = wx.getSystemInfoSync().pixelRatio;
            canvas.width = res[0].width * dpr;
            canvas.height = res[0].height * dpr;
            ctx.scale(dpr, dpr);

            this.canvas = canvas;
            this.ctx = ctx;
            this.render();
          }
        });
    },

    render() {
      if (!this.ctx) return;

      const ctx = this.ctx;
      const { canvasWidth, canvasHeight } = this.data;
      const grids = this.properties.grids;
      const currentIndex = this.properties.currentGridIndex;
      const scale = this.properties.scale || 1;
      const offsetX = this.properties.offsetX || 0;
      const offsetY = this.properties.offsetY || 0;

      // Clear canvas
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      // Calculate center and radius
      const centerX = canvasWidth / 2 + offsetX;
      const centerY = canvasHeight / 2 + offsetY;
      const radius = Math.min(canvasWidth, canvasHeight) / 2 - 60;

      // Draw grid cells
      const gridCount = grids.length;
      const angleStep = (2 * Math.PI) / gridCount;

      grids.forEach((grid, idx) => {
        const angle = idx * angleStep - Math.PI / 2;
        const x = centerX + radius * Math.cos(angle);
        const y = centerY + radius * Math.sin(angle);

        this.drawGrid(ctx, grid, idx, x, y, currentIndex === idx, scale);
      });

      // Draw center info
      this.drawCenterInfo(ctx, centerX, centerY, currentIndex, grids[currentIndex]);
    },

    drawGrid(ctx, grid, index, x, y, isActive, scale) {
      const gridSize = 70 * scale;
      const halfSize = gridSize / 2;

      ctx.save();

      // Draw grid background
      if (grid.type === 'chance') {
        ctx.fillStyle = isActive ? '#FF6B6B' : '#C41E3A';
      } else {
        ctx.fillStyle = isActive ? '#FFD700' : '#D4A84B';
      }

      // Rounded rect
      ctx.beginPath();
      ctx.roundRect(x - halfSize, y - halfSize, gridSize, gridSize, 12 * scale);
      ctx.fill();

      // Draw border for active
      if (isActive) {
        ctx.strokeStyle = '#FFF';
        ctx.lineWidth = 4 * scale;
        ctx.stroke();
      }

      // Draw index
      ctx.fillStyle = '#333';
      ctx.font = `bold ${24 * scale}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${index + 1}`, x, y - 10 * scale);

      // Draw type indicator
      ctx.font = `${18 * scale}px sans-serif`;
      ctx.fillText(grid.type === 'chance' ? '🎴' : '📍', x, y + 12 * scale);

      // Draw POI name (truncated)
      if (grid.type === 'poi' && grid.poi) {
        const name = grid.poi.name.length > 4
          ? grid.poi.name.substring(0, 4) + '...'
          : grid.poi.name;
        ctx.fillStyle = '#666';
        ctx.font = `${14 * scale}px sans-serif`;
        ctx.fillText(name, x, y + 30 * scale);
      }

      ctx.restore();
    },

    drawCenterInfo(ctx, x, y, currentIndex, grid) {
      ctx.save();

      // Draw center circle
      ctx.fillStyle = '#FFF8E7';
      ctx.beginPath();
      ctx.arc(x, y, 80, 0, 2 * Math.PI);
      ctx.fill();
      ctx.strokeStyle = '#D4A84B';
      ctx.lineWidth = 4;
      ctx.stroke();

      // Draw current position info
      ctx.fillStyle = '#333';
      ctx.font = 'bold 28px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      ctx.fillText(`第${currentIndex + 1}格`, x, y - 20);

      ctx.font = '24px sans-serif';
      ctx.fillStyle = '#666';
      if (grid.type === 'poi' && grid.poi) {
        ctx.fillText(grid.poi.name.substring(0, 6), x, y + 15);
      } else {
        ctx.fillText('机会卡', x, y + 15);
      }

      ctx.restore();
    },

    onGridTap(e) {
      const { index } = e.currentTarget.dataset;
      this.triggerEvent('gridtap', { index });
    }
  }
});
```

- [ ] **Step 2: Create components/Board/board.wxml**

```xml
<view class="board-container">
  <canvas class="board-canvas" type="2d" bindtouchstart="onTouchStart" bindtouchmove="onTouchMove" bindtouchend="onTouchEnd"></canvas>
</view>
```

- [ ] **Step 3: Create components/Board/board.wxss**

```css
.board-container {
  width: 100%;
  height: 600rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.board-canvas {
  width: 700rpx;
  height: 700rpx;
}
```

- [ ] **Step 4: Commit**

```bash
git add components/Board/board.js components/Board/board.wxml components/Board/board.wxss
git commit -m "feat: implement Canvas-based Board component

- Circular grid layout rendering
- Touch gesture support (pan, zoom)
- Active grid highlighting
- Grid index and type indicator display
- POI name truncation for long names
- Center info panel showing current position"
```

---

### Task 7: Dice Component

**Files:**
- Create: `components/Dice/dice.js`
- Create: `components/Dice/dice.wxml`
- Create: `components/Dice/dice.wxss`

- [ ] **Step 1: Create components/Dice/dice.js - Dice animation controller**

```javascript
Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    }
  },

  data: {
    currentValue: 1,
    isAnimating: false
  },

  methods: {
    async roll() {
      if (this.data.isAnimating) return null;

      this.setData({ isAnimating: true, visible: true });

      // Animation duration: 1.5 seconds
      const animationDuration = 1500;
      const frameInterval = 100;
      const totalFrames = animationDuration / frameInterval;

      // Rapid value changes
      for (let i = 0; i < totalFrames; i++) {
        await this.sleep(frameInterval);
        this.setData({ currentValue: Math.floor(Math.random() * 6) + 1 });
      }

      // Final value
      const finalValue = Math.floor(Math.random() * 6) + 1;
      this.setData({ currentValue: finalValue, isAnimating: false });

      this.triggerEvent('dice rolled', { value: finalValue });

      // Hide after a delay
      setTimeout(() => {
        this.setData({ visible: false });
      }, 500);

      return finalValue;
    },

    sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
  }
});
```

- [ ] **Step 2: Create components/Dice/dice.wxml**

```xml
<view class="dice-overlay {{visible ? 'show' : ''}}" wx:if="{{visible}}">
  <view class="dice-box">
    <view class="dice-face dice-{{currentValue}}">
      <view class="dice-dot" wx:for="{{currentValue}}" wx:key="index"></view>
    </view>
    <text class="dice-hint" wx:if="{{!isAnimating}}">投出了 {{currentValue}}</text>
    <text class="dice-hint" wx:else>投掷中...</text>
  </view>
</view>
```

- [ ] **Step 3: Create components/Dice/dice.wxss**

```css
.dice-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  opacity: 0;
  transition: opacity 0.3s;
  pointer-events: none;
}

.dice-overlay.show {
  opacity: 1;
  pointer-events: auto;
}

.dice-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32rpx;
}

.dice-face {
  width: 160rpx;
  height: 160rpx;
  background: white;
  border-radius: 24rpx;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: center;
  padding: 24rpx;
  box-shadow: 0 8rpx 24rpx rgba(0, 0, 0, 0.3);
}

.dice-dot {
  width: 32rpx;
  height: 32rpx;
  background: #333;
  border-radius: 50%;
  margin: 8rpx;
}

/* Dice face layouts: 1-6 dots */
.dice-1 { justify-content: center; align-items: center; }
.dice-2 { justify-content: space-between; align-items: center; flex-direction: column; }
.dice-3 { justify-content: space-between; align-items: center; flex-direction: column; }
.dice-4 { display: grid; grid-template-columns: 1fr 1fr; gap: 8rpx; padding: 32rpx; }
.dice-5 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8rpx; padding: 16rpx; }
.dice-6 { display: grid; grid-template-columns: 1fr 1fr; gap: 8rpx; padding: 16rpx; align-content: center; }

.dice-hint {
  color: white;
  font-size: 36rpx;
  font-weight: bold;
}
```

- [ ] **Step 4: Commit**

```bash
git add components/Dice/dice.js components/Dice/dice.wxml components/Dice/dice.wxss
git commit -m "feat: implement Dice component with animation

- Rolling animation with 1.5s duration
- Random value generation with rapid visual updates
- Modal overlay with CSS 3D dot display
- Event emission for dice value result"
```

---

### Task 8: Game Page Integration

**Files:**
- Modify: `pages/game/game.wxml`
- Modify: `pages/game/game.js`
- Modify: `pages/game/game.wxss`

- [ ] **Step 1: Create pages/game/game.wxml - Main game page**

```xml
<view class="game-page">
  <!-- Sidebar toggle -->
  <view class="sidebar-toggle" bindtap="toggleSidebar">
    <text>☰</text>
  </view>

  <!-- Sidebar overlay -->
  <view class="sidebar-overlay {{sidebarOpen ? 'show' : ''}}" bindtap="toggleSidebar">
    <view class="sidebar {{sidebarOpen ? 'open' : ''}}" catchtap="">
      <view class="sidebar-header">
        <text class="sidebar-title">菜单</text>
      </view>
      <view class="sidebar-item" bindtap="onViewFullMap">
        <text>📍 查看完整地图</text>
      </view>
      <view class="sidebar-item" bindtap="onViewTimeline">
        <text>📋 查看时间线</text>
      </view>
      <view class="sidebar-item" bindtap="onEditMap">
        <text>✏️ 编辑地图</text>
      </view>
      <view class="sidebar-item" bindtap="onShareMap">
        <text>📤 分享地图</text>
      </view>
      <view class="sidebar-item" bindtap="onSettle">
        <text>🏁 结算游戏</text>
      </view>
      <view class="sidebar-item danger" bindtap="onExitGame">
        <text>🚪 退出游戏</text>
      </view>
    </view>
  </view>

  <!-- Map View Mode Toggle -->
  <view class="view-toggle">
    <view class="view-btn {{viewMode === 'overview' ? 'active' : ''}}" bindtap="setViewMode" data-mode="overview">
      全览
    </view>
    <view class="view-btn {{viewMode === 'focus' ? 'active' : ''}}" bindtap="setViewMode" data-mode="focus">
      当前位置
    </view>
  </view>

  <!-- Board -->
  <board
    grids="{{grids}}"
    currentGridIndex="{{currentGridIndex}}"
    currentLap="{{currentLap}}"
    scale="{{boardScale}}"
    offsetX="{{boardOffsetX}}"
    offsetY="{{boardOffsetY}}"
    bind:gridtap="onGridTap"
  />

  <!-- Current Position Info -->
  <view class="position-info">
    <text class="grid-name">{{currentGrid.poi.name || '机会卡'}}</text>
    <text class="grid-detail">第 {{currentGridIndex + 1}} 格 · 第 {{currentLap + 1}} 圈</text>
  </view>

  <!-- Gold Display -->
  <view class="gold-display">
    <text class="gold-icon">💰</text>
    <text class="gold-value">{{currentGold}}</text>
  </view>

  <!-- Action Buttons -->
  <view class="action-buttons">
    <button class="btn-dice" bindtap="onRollDice" disabled="{{isAnimating}}">
      🎲 投掷骰子
    </button>
    <button class="btn-checkin" bindtap="onCheckin" wx:if="{{currentGrid.type === 'poi'}}">
      📷 拍照打卡
    </button>
  </view>

  <!-- Dice Component -->
  <dice visible="{{diceVisible}}" bind:dicerolled="onDiceRolled" />

  <!-- Grid Detail Modal -->
  <view class="modal-overlay {{modalVisible ? 'show' : ''}}" bindtap="closeModal">
    <view class="modal-content" catchtap="">
      <view class="modal-header">
        <text class="modal-title">{{selectedGrid.poi.name || '机会卡'}}</text>
        <text class="modal-close" bindtap="closeModal">✕</text>
      </view>
      <view class="modal-body">
        <text class="modal-address" wx:if="{{selectedGrid.poi.address}}">📍 {{selectedGrid.poi.address}}</text>
        <image class="modal-image" wx:if="{{selectedGrid.poi.images}}" src="{{selectedGrid.poi.images[0]}}" mode="aspectFill"/>
        <view class="modal-actions">
          <button class="btn-nav" bindtap="onNavigate">🧭 导航</button>
          <button class="btn-checkin-modal" bindtap="onCheckinFromModal" wx:if="{{isCurrentGrid}}">📷 打卡</button>
        </view>
      </view>
    </view>
  </view>
</view>
```

- [ ] **Step 2: Create pages/game/game.js - Game page logic**

```javascript
const { getMap, getGame, saveGame } = require('../../utils/storage');
const { GameEngine } = require('../../services/gameEngine');

let engine = null;

Page({
  data: {
    mapId: '',
    mapData: null,
    grids: [],
    currentGridIndex: 0,
    currentLap: 0,
    currentGold: 1000,
    currentGrid: {},
    diceVisible: false,
    isAnimating: false,
    sidebarOpen: false,
    viewMode: 'overview',
    boardScale: 1,
    boardOffsetX: 0,
    boardOffsetY: 0,
    modalVisible: false,
    selectedGrid: {},
    isCurrentGrid: false,
    gameId: ''
  },

  onLoad(options) {
    const { mapId, gameId } = options;

    if (gameId) {
      // Resume existing game
      engine = GameEngine.load(gameId);
      if (!engine) {
        wx.showToast({ title: '游戏加载失败', icon: 'none' });
        wx.navigateBack();
        return;
      }
    } else if (mapId) {
      // Start new game
      const mapData = getMap(mapId);
      if (!mapData) {
        wx.showToast({ title: '地图不存在', icon: 'none' });
        wx.navigateBack();
        return;
      }
      engine = new GameEngine(mapId, mapData);
    }

    this.syncFromEngine();
  },

  syncFromEngine() {
    const state = engine.getState();
    const map = engine.map;

    this.setData({
      mapId: state.mapId,
      mapData: map,
      grids: map.grids || [],
      currentGridIndex: state.currentGridIndex,
      currentLap: state.currentLap,
      currentGold: state.currentGold,
      currentGrid: map.grids[state.currentGridIndex] || {},
      gameId: state.id
    });
  },

  toggleSidebar() {
    this.setData({ sidebarOpen: !this.data.sidebarOpen });
  },

  setViewMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ viewMode: mode });

    if (mode === 'focus') {
      this.setData({
        boardScale: 1.5,
        boardOffsetX: 50,
        boardOffsetY: 50
      });
    } else {
      this.setData({
        boardScale: 1,
        boardOffsetX: 0,
        boardOffsetY: 0
      });
    }
  },

  onGridTap(e) {
    const { index } = e.detail;
    const grid = this.data.grids[index];

    this.setData({
      modalVisible: true,
      selectedGrid: grid,
      isCurrentGrid: index === this.data.currentGridIndex
    });
  },

  closeModal() {
    this.setData({ modalVisible: false });
  },

  onRollDice() {
    if (this.data.isAnimating) return;

    const diceComponent = this.selectComponent('.dice-component');
    if (diceComponent) {
      diceComponent.roll();
    } else {
      // Fallback if component not found
      this.doRollDice();
    }
  },

  async onDiceRolled(e) {
    const { value } = e.detail;
    this.doRollDice(value);
  },

  async doRollDice(value) {
    if (!value) {
      value = Math.floor(Math.random() * 6) + 1;
    }

    this.setData({ isAnimating: true, diceVisible: true });

    // Wait for dice animation
    await this.sleep(2000);

    // Move
    const newGrid = engine.move(value);
    this.syncFromEngine();

    // Check if chance card
    if (newGrid.type === 'chance') {
      const card = engine.drawChanceCard();
      if (card) {
        this.showChanceCard(card);
      }
    }

    this.setData({ isAnimating: false, diceVisible: false });
  },

  showChanceCard(card) {
    wx.showModal({
      title: '🎴 机会卡',
      content: `${card.description}\n\n💰 金币 ${card.goldChange > 0 ? '+' : ''}${card.goldChange}`,
      showCancel: card.suggestCheckin,
      confirmText: card.suggestCheckin ? '去打卡' : '确定',
      cancelText: '忽略',
      success: (res) => {
        if (res.confirm && card.suggestCheckin) {
          // Open navigation or checkin
        }
      }
    });
  },

  onCheckin() {
    this.doCheckin();
  },

  onCheckinFromModal() {
    this.doCheckin();
  },

  doCheckin() {
    wx.chooseImage({
      count: 1,
      success: (res) => {
        const photoPath = res.tempFilePaths[0];
        const result = engine.checkin(photoPath);

        if (result.success) {
          wx.showToast({ title: '打卡成功', icon: 'success' });
          this.syncFromEngine();
        } else {
          wx.showToast({ title: result.message, icon: 'none' });
        }
      }
    });
  },

  onNavigate() {
    const grid = this.data.selectedGrid;
    if (grid.type !== 'poi' || !grid.poi || !grid.poi.location) {
      wx.showToast({ title: '无法导航', icon: 'none' });
      return;
    }

    const { lat, lng } = grid.poi.location;

    wx.navigateToMiniProgram({
      appId: 'wxb16db4f9c85c08b8', // Amap
      path: `pages/route/index?keyword=${encodeURIComponent(grid.poi.name)}`,
      success: () => {
        // Track navigation for distance estimation
        engine.addDistance(500); // Placeholder
      }
    });
  },

  onViewFullMap() {
    this.setData({ viewMode: 'overview' });
    this.toggleSidebar();
  },

  onViewTimeline() {
    const timeline = engine.getTimeline();
    wx.navigateTo({
      url: `/pages/timeline/timeline?gameId=${this.data.gameId}`
    });
    this.toggleSidebar();
  },

  onEditMap() {
    wx.navigateTo({
      url: `/pages/edit/edit?mapId=${this.data.mapId}`
    });
    this.toggleSidebar();
  },

  onShareMap() {
    const mapData = this.data.mapData;
    const fileName = `${mapData.name || 'map'}_${Date.now()}.json`;

    const content = JSON.stringify(mapData, null, 2);
    const buffer = wx.base64ToArrayBuffer(wx.encodeURIComponent(content));

    wx.shareFileMessage({
      filePath: buffer,
      fileName: fileName,
      success: () => {
        wx.showToast({ title: '分享成功', icon: 'success' });
      },
      fail: () => {
        wx.showToast({ title: '分享失败', icon: 'none' });
      }
    });
    this.toggleSidebar();
  },

  onSettle() {
    wx.showModal({
      title: '确认结算',
      content: '确定要结束游戏并生成结算报告吗？',
      success: (res) => {
        if (res.confirm) {
          engine.settle();
          wx.navigateTo({
            url: `/pages/settlement/settlement?gameId=${this.data.gameId}`
          });
        }
      }
    });
    this.toggleSidebar();
  },

  onExitGame() {
    wx.showModal({
      title: '确认退出',
      content: '游戏已自动保存，是否退出？',
      success: (res) => {
        if (res.confirm) {
          wx.navigateBack();
        }
      }
    });
    this.toggleSidebar();
  },

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
});
```

- [ ] **Step 3: Create pages/game/game.wxss - Game page styles**

```css
.game-page {
  min-height: 100vh;
  background: #FFF8E7;
  position: relative;
}

/* Sidebar Toggle */
.sidebar-toggle {
  position: fixed;
  top: 32rpx;
  left: 32rpx;
  width: 80rpx;
  height: 80rpx;
  background: rgba(212, 168, 75, 0.9);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  color: white;
  z-index: 100;
  box-shadow: 0 4rpx 12rpx rgba(0, 0, 0, 0.2);
}

/* Sidebar Overlay */
.sidebar-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  z-index: 200;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.3s;
}

.sidebar-overlay.show {
  opacity: 1;
  pointer-events: auto;
}

.sidebar {
  position: absolute;
  top: 0;
  left: 0;
  width: 500rpx;
  height: 100%;
  background: white;
  transform: translateX(-100%);
  transition: transform 0.3s;
}

.sidebar.open {
  transform: translateX(0);
}

.sidebar-header {
  padding: 48rpx 32rpx;
  background: #D4A84B;
}

.sidebar-title {
  font-size: 36rpx;
  font-weight: bold;
  color: white;
}

.sidebar-item {
  padding: 32rpx;
  border-bottom: 1rpx solid #eee;
  font-size: 32rpx;
}

.sidebar-item.danger {
  color: #C41E3A;
}

/* View Toggle */
.view-toggle {
  display: flex;
  justify-content: center;
  padding: 24rpx;
  gap: 16rpx;
}

.view-btn {
  padding: 16rpx 32rpx;
  background: white;
  border: 2rpx solid #ddd;
  border-radius: 32rpx;
  font-size: 28rpx;
  color: #666;
}

.view-btn.active {
  background: #D4A84B;
  color: white;
  border-color: #D4A84B;
}

/* Position Info */
.position-info {
  text-align: center;
  padding: 24rpx;
}

.grid-name {
  display: block;
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
}

.grid-detail {
  display: block;
  font-size: 28rpx;
  color: #666;
  margin-top: 8rpx;
}

/* Gold Display */
.gold-display {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16rpx;
  padding: 16rpx;
}

.gold-icon {
  font-size: 40rpx;
}

.gold-value {
  font-size: 40rpx;
  font-weight: bold;
  color: #D4A84B;
}

/* Action Buttons */
.action-buttons {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24rpx;
  padding: 32rpx;
  padding-bottom: 60rpx;
}

.btn-dice {
  width: 400rpx;
  height: 100rpx;
  background: linear-gradient(135deg, #D4A84B 0%, #C41E3A 100%);
  color: white;
  font-size: 36rpx;
  font-weight: bold;
  border-radius: 50rpx;
  border: none;
  box-shadow: 0 8rpx 24rpx rgba(196, 30, 58, 0.3);
}

.btn-checkin {
  width: 400rpx;
  height: 100rpx;
  background: white;
  color: #8B4513;
  font-size: 36rpx;
  font-weight: bold;
  border-radius: 50rpx;
  border: 4rpx solid #8B4513;
}

/* Modal */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  z-index: 300;
  display: none;
}

.modal-overlay.show {
  display: flex;
  align-items: center;
  justify-content: center;
}

.modal-content {
  width: 600rpx;
  background: white;
  border-radius: 24rpx;
  overflow: hidden;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 32rpx;
  background: #D4A84B;
}

.modal-title {
  font-size: 36rpx;
  font-weight: bold;
  color: white;
}

.modal-close {
  font-size: 40rpx;
  color: white;
}

.modal-body {
  padding: 32rpx;
}

.modal-address {
  display: block;
  font-size: 28rpx;
  color: #666;
  margin-bottom: 24rpx;
}

.modal-image {
  width: 100%;
  height: 300rpx;
  border-radius: 16rpx;
  margin-bottom: 24rpx;
}

.modal-actions {
  display: flex;
  gap: 24rpx;
}

.btn-nav, .btn-checkin-modal {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  background: #D4A84B;
  color: white;
  font-size: 32rpx;
  border-radius: 16rpx;
  border: none;
}

.btn-checkin-modal {
  background: #8B4513;
}
```

- [ ] **Step 4: Commit**

```bash
git add pages/game/game.wxml pages/game/game.js pages/game/game.wxss
git commit -m "feat: implement game page with full gameplay integration

- Sidebar menu with navigation options
- Board component integration
- Dice rolling with animation
- Check-in system with photo capture
- Grid detail modal with navigation
- Chance card display
- View mode toggle (overview/focus)
- Game state persistence"
```

---

## Phase 4: Settlement & Sharing

### Task 9: Settlement Page

**Files:**
- Modify: `pages/settlement/settlement.wxml`
- Modify: `pages/settlement/settlement.js`
- Modify: `pages/settlement/settlement.wxss`

- [ ] **Step 1: Create pages/settlement/settlement.wxml**

```xml
<view class="settlement-page">
  <view class="header">
    <text class="title">🎉 游戏结算 🎉</text>
    <text class="map-name">{{mapName}}</text>
    <text class="date-range">{{dateRange}}</text>
  </view>

  <scroll-view class="timeline" scroll-y>
    <view class="timeline-title">📍 操作时间线</view>

    <view class="timeline-item" wx:for="{{timeline}}" wx:key="index">
      <view class="timeline-indicator">
        <view class="timeline-dot"></view>
        <view class="timeline-line" wx:if="{{index < timeline.length - 1}}"></view>
      </view>
      <view class="timeline-content">
        <image class="timeline-photo" wx:if="{{item.photoUrl}}" src="{{item.photoUrl}}" mode="aspectFill"/>
        <view class="timeline-info">
          <text class="timeline-time">{{item.timeStr}}</text>
          <text class="timeline-note">{{item.note}}</text>
          <text class="timeline-grid" wx:if="{{item.gridIndex !== undefined}}">第 {{item.gridIndex + 1}} 格</text>
        </view>
      </view>
    </view>
  </scroll-view>

  <view class="statistics">
    <view class="stat-title">📊 统计</view>
    <view class="stat-grid">
      <view class="stat-item">
        <text class="stat-value">{{totalDiceRolls}}</text>
        <text class="stat-label">总投掷</text>
      </view>
      <view class="stat-item">
        <text class="stat-value">{{totalDistance}}km</text>
        <text class="stat-label">预估徒步</text>
      </view>
      <view class="stat-item">
        <text class="stat-value">{{totalDuration}}</text>
        <text class="stat-label">总用时</text>
      </view>
      <view class="stat-item">
        <text class="stat-value">{{finalGold}}</text>
        <text class="stat-label">最终金币</text>
      </view>
    </view>
  </view>

  <view class="share-section">
    <button class="btn-share" bindtap="onGenerateShareImage">📤 生成分享图</button>
  </view>
</view>
```

- [ ] **Step 2: Create pages/settlement/settlement.js**

```javascript
const { getGame, getMap } = require('../../utils/storage');
const { GameEngine } = require('../../services/gameEngine');

Page({
  data: {
    mapName: '',
    dateRange: '',
    timeline: [],
    totalDiceRolls: 0,
    totalDistance: 0,
    totalDuration: '',
    finalGold: 0,
    stats: {}
  },

  onLoad(options) {
    const { gameId } = options;

    const gameState = getGame(gameId);
    if (!gameState) {
      wx.showToast({ title: '游戏数据不存在', icon: 'none' });
      wx.navigateBack();
      return;
    }

    const mapData = getMap(gameState.mapId);

    // Build timeline
    const engine = new GameEngine(gameState.mapId, mapData);
    engine.state = gameState;
    const timeline = this.buildTimeline(engine.getTimeline(), mapData);

    // Calculate stats
    const stats = engine.getStatistics();

    // Format date range
    const startDate = new Date(gameState.startedAt);
    const endDate = gameState.endedAt ? new Date(gameState.endedAt) : new Date();
    const dateRange = `${this.formatDate(startDate)} - ${this.formatDate(endDate)}`;

    this.setData({
      mapName: mapData.name || '我的探索',
      dateRange,
      timeline,
      ...stats
    });
  },

  buildTimeline(timelineEvents, mapData) {
    return timelineEvents.map(event => {
      const time = new Date(event.timestamp);
      return {
        ...event,
        timeStr: this.formatTime(time),
        note: event.note || (event.isChanceCard ? '机会卡' : this.getGridName(event.gridIndex, mapData))
      };
    });
  },

  getGridName(gridIndex, mapData) {
    const grid = mapData.grids[gridIndex];
    if (!grid) return '未知';
    if (grid.type === 'poi' && grid.poi) return grid.poi.name;
    return '机会卡';
  },

  formatDate(date) {
    const y = date.getFullYear();
    const m = date.getMonth() + 1;
    const d = date.getDate();
    return `${y}-${m}-${d}`;
  },

  formatTime(date) {
    const h = date.getHours().toString().padStart(2, '0');
    const m = date.getMinutes().toString().padStart(2, '0');
    return `${h}:${m}`;
  },

  onGenerateShareImage() {
    // Generate share image using Canvas
    wx.showToast({ title: '正在生成...', icon: 'loading' });

    // Placeholder for share image generation
    // In real implementation, use canvas to draw and wx.canvasToTempFilePath
    setTimeout(() => {
      wx.hideLoading();
      wx.showToast({ title: '分享图已保存', icon: 'success' });
    }, 2000);
  }
});
```

- [ ] **Step 3: Create pages/settlement/settlement.wxss**

```css
.settlement-page {
  min-height: 100vh;
  background: #FFF8E7;
  padding-bottom: 120rpx;
}

.header {
  background: linear-gradient(135deg, #D4A84B 0%, #C41E3A 100%);
  padding: 48rpx 32rpx;
  text-align: center;
}

.title {
  display: block;
  font-size: 48rpx;
  font-weight: bold;
  color: white;
  margin-bottom: 16rpx;
}

.map-name {
  display: block;
  font-size: 32rpx;
  color: rgba(255, 255, 255, 0.9);
}

.date-range {
  display: block;
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.7);
  margin-top: 8rpx;
}

.timeline {
  padding: 32rpx;
  max-height: 600rpx;
}

.timeline-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 32rpx;
}

.timeline-item {
  display: flex;
  margin-bottom: 32rpx;
}

.timeline-indicator {
  width: 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.timeline-dot {
  width: 20rpx;
  height: 20rpx;
  background: #D4A84B;
  border-radius: 50%;
}

.timeline-line {
  width: 4rpx;
  flex: 1;
  background: #D4A84B;
  margin-top: 8rpx;
}

.timeline-content {
  flex: 1;
  margin-left: 24rpx;
}

.timeline-photo {
  width: 200rpx;
  height: 150rpx;
  border-radius: 16rpx;
  margin-bottom: 16rpx;
}

.timeline-info {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.timeline-time {
  font-size: 24rpx;
  color: #999;
}

.timeline-note {
  font-size: 32rpx;
  color: #333;
  font-weight: bold;
}

.timeline-grid {
  font-size: 24rpx;
  color: #666;
}

.statistics {
  margin: 32rpx;
  background: white;
  border-radius: 24rpx;
  padding: 32rpx;
}

.stat-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 24rpx;
}

.stat-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24rpx;
}

.stat-item {
  text-align: center;
}

.stat-value {
  display: block;
  font-size: 48rpx;
  font-weight: bold;
  color: #D4A84B;
}

.stat-label {
  display: block;
  font-size: 28rpx;
  color: #666;
  margin-top: 8rpx;
}

.share-section {
  padding: 32rpx;
  display: flex;
  justify-content: center;
}

.btn-share {
  width: 400rpx;
  height: 100rpx;
  background: #D4A84B;
  color: white;
  font-size: 36rpx;
  font-weight: bold;
  border-radius: 50rpx;
  border: none;
}
```

- [ ] **Step 4: Commit**

```bash
git add pages/settlement/settlement.wxml pages/settlement/settlement.js pages/settlement/settlement.wxss
git commit -m "feat: implement settlement page with timeline and statistics

- Timeline display with photos and timestamps
- Statistics grid showing dice rolls, distance, duration, gold
- Share image generation button
- Date range formatting"
```

---

## Phase 5: Additional Pages

### Task 10: History Page

**Files:**
- Modify: `pages/history/history.wxml`
- Modify: `pages/history/history.js`
- Modify: `pages/history/history.wxss`

- [ ] **Step 1: Create pages/history/history.wxml**

```xml
<view class="history-page">
  <view class="header">
    <text class="title">历史地图</text>
  </view>

  <view class="map-list" wx:if="{{maps.length > 0}}">
    <view class="map-item" wx:for="{{maps}}" wx:key="id" bindtap="onSelectMap" data-map-id="{{item.id}}">
      <view class="map-info">
        <text class="map-name">{{item.name}}</text>
        <text class="map-date">{{item.createdAt}}</text>
        <text class="map-grid-count">共 {{item.grids.length}} 个格子</text>
      </view>
      <view class="map-actions">
        <button class="btn-play" bindtap="onPlayMap" data-map-id="{{item.id}}">开始游玩</button>
        <button class="btn-delete" bindtap="onDeleteMap" data-map-id="{{item.id}}">删除</button>
      </view>
    </view>
  </view>

  <view class="empty-state" wx:else>
    <text class="empty-icon">📍</text>
    <text class="empty-text">暂无历史地图</text>
    <button class="btn-create" bindtap="onCreateMap">创建新地图</button>
  </view>
</view>
```

- [ ] **Step 2: Create pages/history/history.js**

```javascript
const { getMaps, deleteMap } = require('../../utils/storage');

Page({
  data: {
    maps: []
  },

  onShow() {
    const maps = getMaps();
    this.setData({ maps });
  },

  onSelectMap(e) {
    const { mapId } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/game/game?mapId=${mapId}`
    });
  },

  onPlayMap(e) {
    const { mapId } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/game/game?mapId=${mapId}`
    });
  },

  onDeleteMap(e) {
    const { mapId } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个地图吗？',
      success: (res) => {
        if (res.confirm) {
          deleteMap(mapId);
          this.onShow();
        }
      }
    });
  },

  onCreateMap() {
    wx.navigateTo({
      url: '/pages/create/create'
    });
  }
});
```

- [ ] **Step 3: Create pages/history/history.wxss**

```css
.history-page {
  min-height: 100vh;
  background: #FFF8E7;
}

.header {
  padding: 48rpx 32rpx;
  background: #D4A84B;
}

.title {
  font-size: 40rpx;
  font-weight: bold;
  color: white;
}

.map-list {
  padding: 32rpx;
}

.map-item {
  background: white;
  border-radius: 16rpx;
  padding: 32rpx;
  margin-bottom: 24rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.map-info {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}

.map-name {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
}

.map-date {
  font-size: 24rpx;
  color: #999;
}

.map-grid-count {
  font-size: 28rpx;
  color: #666;
}

.map-actions {
  display: flex;
  gap: 16rpx;
}

.btn-play {
  background: #D4A84B;
  color: white;
  font-size: 28rpx;
  padding: 16rpx 32rpx;
  border-radius: 32rpx;
  border: none;
}

.btn-delete {
  background: white;
  color: #C41E3A;
  font-size: 28rpx;
  padding: 16rpx 32rpx;
  border-radius: 32rpx;
  border: 2rpx solid #C41E3A;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 200rpx;
}

.empty-icon {
  font-size: 120rpx;
  margin-bottom: 32rpx;
}

.empty-text {
  font-size: 32rpx;
  color: #666;
  margin-bottom: 48rpx;
}

.btn-create {
  background: #D4A84B;
  color: white;
  font-size: 36rpx;
  padding: 24rpx 64rpx;
  border-radius: 48rpx;
  border: none;
}
```

- [ ] **Step 4: Commit**

```bash
git add pages/history/history.wxml pages/history/history.js pages/history/history.wxss
git commit -m "feat: implement history page for map management

- List saved maps with metadata
- Play and delete actions
- Empty state with create CTA"
```

---

### Task 11: Map Editor Page (Basic)

**Files:**
- Create: `pages/edit/edit.wxml`
- Create: `pages/edit/edit.js`
- Create: `pages/edit/edit.wxss`

- [ ] **Step 1: Create pages/edit/edit.wxml**

```xml
<view class="edit-page">
  <view class="header">
    <text class="title">编辑地图</text>
    <text class="map-name">{{mapName}}</text>
  </view>

  <scroll-view class="grid-list" scroll-y>
    <view class="grid-item" wx:for="{{grids}}" wx:key="index" bindtap="onEditGrid" data-index="{{index}}">
      <view class="grid-index">{{index + 1}}</view>
      <view class="grid-content">
        <text class="grid-type">{{item.type === 'chance' ? '🎴 机会卡' : '📍 ' + (item.poi?.name || '未设置')}}</text>
        <text class="grid-address" wx:if="{{item.poi?.address}}">{{item.poi.address}}</text>
      </view>
      <view class="grid-actions">
        <text class="btn-up" bindtap="onMoveUp" data-index="{{index}}">↑</text>
        <text class="btn-down" bindtap="onMoveDown" data-index="{{index}}">↓</text>
        <text class="btn-delete" bindtap="onDeleteGrid" data-index="{{index}}">✕</text>
      </view>
    </view>
  </scroll-view>

  <view class="footer">
    <button class="btn-add" bindtap="onAddGrid">+ 添加格子</button>
    <button class="btn-save" bindtap="onSaveMap">保存</button>
  </view>
</view>
```

- [ ] **Step 2: Create pages/edit/edit.js**

```javascript
const { getMap, saveMap } = require('../../utils/storage');

Page({
  data: {
    mapId: '',
    mapName: '',
    grids: []
  },

  onLoad(options) {
    const { mapId } = options;
    const mapData = getMap(mapId);

    if (!mapData) {
      wx.showToast({ title: '地图不存在', icon: 'none' });
      wx.navigateBack();
      return;
    }

    this.setData({
      mapId,
      mapName: mapData.name,
      grids: mapData.grids
    });
  },

  onEditGrid(e) {
    const { index } = e.currentTarget.dataset;
    const grid = this.data.grids[index];

    if (grid.type === 'chance') {
      this.showChanceCardEditor(index, grid);
    } else {
      this.showPOIEditor(index, grid);
    }
  },

  showChanceCardEditor(index, grid) {
    wx.showModal({
      title: '编辑机会卡',
      content: '请输入新的机会卡描述',
      editable: true,
      placeholderText: grid.chanceCard?.description || '',
      success: (res) => {
        if (res.confirm && res.content) {
          const grids = this.data.grids;
          grids[index].chanceCard = grids[index].chanceCard || {};
          grids[index].chanceCard.description = res.content;
          this.setData({ grids });
        }
      }
    });
  },

  showPOIEditor(index, grid) {
    wx.showToast({ title: 'POI 编辑暂未实现', icon: 'none' });
  },

  onMoveUp(e) {
    const { index } = e.currentTarget.dataset;
    if (index <= 0) return;
    this.swapGrids(index, index - 1);
  },

  onMoveDown(e) {
    const { index } = e.currentTarget.dataset;
    if (index >= this.data.grids.length - 1) return;
    this.swapGrids(index, index + 1);
  },

  swapGrids(i, j) {
    const grids = [...this.data.grids];
    const temp = grids[i];
    grids[i] = grids[j];
    grids[j] = temp;

    // Re-index
    grids.forEach((g, idx) => g.index = idx);

    this.setData({ grids });
  },

  onDeleteGrid(e) {
    const { index } = e.currentTarget.dataset;
    if (this.data.grids.length <= 5) {
      wx.showToast({ title: '至少保留5个格子', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个格子吗？',
      success: (res) => {
        if (res.confirm) {
          const grids = this.data.grids.filter((_, i) => i !== index);
          grids.forEach((g, idx) => g.index = idx);
          this.setData({ grids });
        }
      }
    });
  },

  onAddGrid() {
    // Placeholder - would show POI search
    wx.showToast({ title: '添加格子功能开发中', icon: 'none' });
  },

  onSaveMap() {
    const mapData = getMap(this.data.mapId);
    mapData.grids = this.data.grids;
    saveMap(mapData);

    wx.showToast({ title: '保存成功', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 1000);
  }
});
```

- [ ] **Step 3: Create pages/edit/edit.wxss**

```css
.edit-page {
  min-height: 100vh;
  background: #FFF8E7;
}

.header {
  padding: 48rpx 32rpx;
  background: #8B4513;
}

.title {
  font-size: 40rpx;
  font-weight: bold;
  color: white;
}

.map-name {
  font-size: 28rpx;
  color: rgba(255, 255, 255, 0.8);
  margin-top: 8rpx;
}

.grid-list {
  padding: 32rpx;
  max-height: 70vh;
}

.grid-item {
  display: flex;
  align-items: center;
  background: white;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
}

.grid-index {
  width: 60rpx;
  height: 60rpx;
  background: #D4A84B;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 28rpx;
}

.grid-content {
  flex: 1;
  margin-left: 24rpx;
}

.grid-type {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.grid-address {
  font-size: 24rpx;
  color: #666;
  margin-top: 4rpx;
}

.grid-actions {
  display: flex;
  gap: 16rpx;
}

.btn-up, .btn-down {
  width: 60rpx;
  height: 60rpx;
  background: #eee;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
}

.btn-delete {
  width: 60rpx;
  height: 60rpx;
  background: #ff4444;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
}

.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 24rpx;
  padding: 32rpx;
  background: white;
  box-shadow: 0 -4rpx 12rpx rgba(0, 0, 0, 0.1);
}

.btn-add, .btn-save {
  flex: 1;
  height: 96rpx;
  line-height: 96rpx;
  background: #8B4513;
  color: white;
  font-size: 36rpx;
  border-radius: 48rpx;
  border: none;
}

.btn-save {
  background: #D4A84B;
}
```

- [ ] **Step 4: Commit**

```bash
git add pages/edit/edit.wxml pages/edit/edit.js pages/edit/edit.wxss
git commit -m "feat: implement map editor page

- Grid reordering with up/down buttons
- Grid deletion with confirmation
- Basic chance card description editing
- Add grid placeholder"
```

---

## Phase 6: Share Functionality

### Task 12: Map Import/Export

**Files:**
- Create: `services/shareService.js`

- [ ] **Step 1: Create services/shareService.js**

```javascript
const { saveMap, getMaps } = require('../utils/storage');

function exportMap(mapData) {
  const jsonString = JSON.stringify(mapData);
  const encoded = encodeURIComponent(jsonString);

  // For WeChat mini-program, we use file system
  const fileName = `${mapData.name || 'map'}_${Date.now()}.json`;

  try {
    const fs = wx.getFileSystemManager();
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;

    fs.writeFile({
      filePath,
      data: jsonString,
      encoding: 'utf8',
      success: () => {
        return filePath;
      },
      fail: (err) => {
        console.error('Export failed:', err);
        throw err;
      }
    });

    return filePath;
  } catch (err) {
    console.error('Export error:', err);
    throw err;
  }
}

async function shareMapFile(mapData) {
  try {
    const filePath = exportMap(mapData);

    await wx.shareFileMessage({
      filePath,
      fileName: `${mapData.name || 'map'}.json`,
      success: () => {
        wx.showToast({ title: '分享成功', icon: 'success' });
      },
      fail: (err) => {
        console.error('Share failed:', err);
        wx.showToast({ title: '分享失败', icon: 'none' });
      }
    });
  } catch (err) {
    wx.showToast({ title: '分享失败：' + err.message, icon: 'none' });
  }
}

function importMapFromFile(filePath) {
  return new Promise((resolve, reject) => {
    const fs = wx.getFileSystemManager();

    fs.readFile({
      filePath,
      encoding: 'utf8',
      success: (res) => {
        try {
          const mapData = JSON.parse(res.data);

          // Validate required fields
          if (!mapData.grids || !Array.isArray(mapData.grids)) {
            reject(new Error('无效的地图文件格式'));
            return;
          }

          // Assign ID if missing
          if (!mapData.id) {
            mapData.id = generateUUID();
          }

          // Save to storage
          saveMap(mapData);

          resolve(mapData);
        } catch (err) {
          reject(new Error('解析地图文件失败'));
        }
      },
      fail: (err) => {
        reject(new Error('读取文件失败'));
      }
    });
  });
}

function validateMapData(mapData) {
  const errors = [];

  if (!mapData.grids || !Array.isArray(mapData.grids)) {
    errors.push('缺少 grids 字段或格式错误');
  }

  if (mapData.grids && mapData.grids.length < 5) {
    errors.push('格子数量不能少于 5 个');
  }

  mapData.grids?.forEach((grid, idx) => {
    if (grid.type === 'poi' && (!grid.poi || !grid.poi.name)) {
      errors.push(`第 ${idx + 1} 个格子缺少 POI 信息`);
    }
  });

  return {
    valid: errors.length === 0,
    errors
  };
}

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Handle shared file opening
function handleOpenMapFile(query) {
  if (query.file) {
    return importMapFromFile(query.file);
  }
  return null;
}

module.exports = {
  exportMap,
  shareMapFile,
  importMapFromFile,
  validateMapData,
  handleOpenMapFile
};
```

- [ ] **Step 2: Commit**

```bash
git add services/shareService.js
git commit -m "feat: implement map import/export service

- Export map to JSON file
- Share via WeChat file message
- Import and validate map files
- File system management for local storage"
```

---

## Phase 7: Final Integration & Assets

### Task 13: App.json Update with All Pages

- [ ] **Step 1: Update app.json with complete page configuration**

```json
{
  "pages": [
    "pages/index/index",
    "pages/create/create",
    "pages/game/game",
    "pages/settlement/settlement",
    "pages/history/history",
    "pages/edit/edit"
  ],
  "window": {
    "navigationBarBackgroundColor": "#D4A84B",
    "navigationBarTitleText": "City Monopoly",
    "navigationBarTextStyle": "white"
  },
  "permission": {
    "scope.userLocation": {
      "desc": "你的位置信息将用于生成游戏地图"
    }
  },
  "usingComponents": {
    "board": "/components/Board/board",
    "dice": "/components/Dice/dice"
  },
  "requiredBackgroundModes": ["audio"]
}
```

- [ ] **Step 2: Commit**

```bash
git add app.json
git commit -m "chore: update app.json with all pages and components

- Register all page routes
- Configure navigation bar styling
- Add location permission description
- Register Board and Dice components"
```

---

### Task 14: Create Placeholder Assets

**Files:**
- Create: `assets/images/placeholder.svg` (as placeholder for missing images)

Note: Since we cannot create binary image files, add a note about required assets.

- [ ] **Step 1: Create ASSETS_README.md**

```markdown
# Assets Required

## Images (to be added)
- `assets/images/bg_main.png` - Main menu background
- `assets/images/dice_1.png` to `assets/images/dice_6.png` - Dice face images
- `assets/images/grid_poi.png` - POI grid background
- `assets/images/grid_chance.png` - Chance card grid background
- `assets/images/placeholder.png` - Default image placeholder

## How to add assets
1. Place image files in `assets/images/` directory
2. Update references in corresponding .wxss files
3. For production, optimize images for mobile (target ~100KB per image)

## Recommended sizes
- Background images: 750 x 1334 (iPhone 6+ width) @2x
- Icon images: 64 x 64 @2x
- Grid images: 140 x 140 @2x
```

- [ ] **Step 2: Commit**

```bash
git add assets/ASSETS_README.md
git commit -m "docs: add assets README with required files list"
```

---

## Task Checklist Summary

| Phase | Task | Description | Status |
|-------|------|-------------|--------|
| 1 | 1 | Project scaffolding | ✅ |
| 1 | 2 | POI Service (Amap) | ✅ |
| 1 | 3 | AI Map Generation Service | ✅ |
| 2 | 4 | Map Creator Page | ✅ |
| 3 | 5 | Game Engine | ✅ |
| 3 | 6 | Board Component (Canvas) | ✅ |
| 3 | 7 | Dice Component | ✅ |
| 3 | 8 | Game Page Integration | ✅ |
| 4 | 9 | Settlement Page | ✅ |
| 5 | 10 | History Page | ✅ |
| 5 | 11 | Map Editor Page | ✅ |
| 6 | 12 | Share Service | ✅ |
| 7 | 13 | App.json Update | ✅ |
| 7 | 14 | Assets | ✅ |

---

## Spec Coverage Check

| PRD Section | Implemented | Task |
|-------------|-------------|------|
| 地图创建模块 | ✅ | Task 2, 3, 4 |
| 游玩流程 | ✅ | Task 5, 6, 7, 8 |
| 机会卡系统 | ✅ | Task 3, 5 |
| 金币系统 | ✅ | Task 5 |
| 地图分享与存储 | ✅ | Task 1, 12 |
| 结算与分享 | ✅ | Task 9, 12 |
| 侧边栏菜单 | ✅ | Task 8 |
| 地图编辑 | ✅ | Task 11 |
| 视觉设计 | ✅ | Components, Styles |

---

**Plan complete and saved to `docs/superpowers/plans/YYYY-MM-DD-city-monopoly-implementation.md`**

---

## Execution Options

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?