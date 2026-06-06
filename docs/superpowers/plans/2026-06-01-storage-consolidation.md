# Storage Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the storage layer so each map is self-contained (`currentGame` lives inside the map), eliminating the parallel `games` key, fixing the push-not-replace bug, and adding storage quota warnings.

**Architecture:** Drop the `games` storage key. Each map entry now embeds `currentGame: GameState | null`. The engine's `save()` writes to the map's `currentGame` field via a single `updateMapGameState` call. Quota guard pre-checks `wx.getStorageInfoSync()` and returns a result object instead of throwing. Quota warnings appear at app launch and on save-failure.

**Tech Stack:** 微信小程序 + JavaScript (CommonJS) + `wx.getStorageSync` / `wx.setStorageSync` / `wx.getStorageInfoSync`. No test framework — verification is hand-driven in the WeChat dev tool.

**Spec:** [docs/superpowers/specs/2026-06-01-storage-consolidation-design.md](../specs/2026-06-01-storage-consolidation-design.md)

**Note on commits:** The user has stated they will control commits themselves; do not run `git commit` unless the user explicitly asks. Each task ends with a "report to user" step instead.

---

## File Map

| File | Role in this refactor |
|---|---|
| `utils/storage.js` | Rewritten: new API + quota guard |
| `services/gameEngine.js` | Rewritten: `initFresh` / `resume` / new `save` semantics, `static load` removed |
| `pages/game/game.js` | New `onLoad` flow (initFresh / resume / reset-modal) + save-failure modal |
| `pages/settlement/settlement.js` | Read game state from `map.currentGame` instead of `getGame(gameId)` |
| `app.js` | Launch-time quota warning modal |
| `services/shareService.js` | `exportMap` strips `currentGame` |
| `pages/edit/edit.js` | Direct `wx.getStorageSync` calls replaced with `saveMap` upsert |
| (no other files touched) | |

---

## Task 1: Rewrite `utils/storage.js` with the new API

**Files:**
- Modify: `utils/storage.js` (full rewrite)

- [ ] **Step 1.1: Replace the file contents**

Replace the entire contents of `utils/storage.js` with the new implementation:

```js
// 存储服务 - 封装微信 localStorage
// 数据形态：maps: Array<Map>，每项包含完整定义 + currentGame: GameState | null
// games key 不再使用，旧数据用户手动清

const StorageService = {
  // 获取所有保存的地图
  // 返回：地图数组
  getMaps() {
    return wx.getStorageSync('maps') || [];
  },

  // 根据 ID 获取单个地图
  getMap(id) {
    return this.getMaps().find(m => m.id === id);
  },

  // 保存地图（upsert by id）。
  // 自动归一化：保证写入的 map 一定有 currentGame 字段（null 也算）。
  // 返回 { saved, reason? }：成功 { saved: true }；配额不足 { saved: false, reason: 'quota_exceeded' }
  saveMap(map) {
    const normalized = { ...map, currentGame: map.currentGame ?? null };

    const usage = this.getStorageUsage();
    if (usage.percent >= 1.0) {
      return { saved: false, reason: 'quota_exceeded' };
    }

    try {
      const maps = this.getMaps();
      const idx = maps.findIndex(m => m.id === normalized.id);
      if (idx >= 0) {
        maps[idx] = normalized;
      } else {
        maps.push(normalized);
      }
      wx.setStorageSync('maps', maps);
      return { saved: true };
    } catch (e) {
      return { saved: false, reason: 'quota_exceeded' };
    }
  },

  // 删除地图（自然级联 currentGame）
  deleteMap(id) {
    const maps = this.getMaps().filter(m => m.id !== id);
    wx.setStorageSync('maps', maps);
  },

  // 获取某地图的游戏进度
  getMapGameState(mapId) {
    const map = this.getMap(mapId);
    return map ? map.currentGame : null;
  },

  // 更新某地图的游戏进度。找不到对应 map 时返回 map_not_found，不写盘。
  // 返回 { saved, reason? }
  updateMapGameState(mapId, gameState) {
    const map = this.getMap(mapId);
    if (!map) {
      return { saved: false, reason: 'map_not_found' };
    }
    return this.saveMap({ ...map, currentGame: gameState });
  },

  // 清空某地图的游戏进度
  clearMapGameState(mapId) {
    return this.updateMapGameState(mapId, null);
  },

  // 获取存储用量信息
  // 返回 { usedKB, limitKB, percent }；wx.getStorageInfoSync 不可用时返回 0/10240/0
  getStorageUsage() {
    try {
      const info = wx.getStorageInfoSync();
      const usedKB = info.currentSize || 0;
      const limitKB = info.limitSize || 10240;
      return {
        usedKB,
        limitKB,
        percent: limitKB > 0 ? usedKB / limitKB : 0,
      };
    } catch (e) {
      return { usedKB: 0, limitKB: 10240, percent: 0 };
    }
  },

  // 生成唯一 ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },
};

// 便捷导出
const getMap = (id) => StorageService.getMap(id);
const getMaps = () => StorageService.getMaps();
const saveMap = (map) => StorageService.saveMap(map);
const deleteMap = (id) => StorageService.deleteMap(id);
const getMapGameState = (mapId) => StorageService.getMapGameState(mapId);
const updateMapGameState = (mapId, state) => StorageService.updateMapGameState(mapId, state);
const clearMapGameState = (mapId) => StorageService.clearMapGameState(mapId);
const getStorageUsage = () => StorageService.getStorageUsage();
const generateId = () => StorageService.generateId();

module.exports = {
  StorageService,
  getMap,
  getMaps,
  saveMap,
  deleteMap,
  getMapGameState,
  updateMapGameState,
  clearMapGameState,
  getStorageUsage,
  generateId,
};
```

- [ ] **Step 1.2: Verify by hand in the WeChat dev tool**

In the WeChat dev tool simulator:

1. Open the project and click Compile.
2. Open the Console panel.
3. Run in the console:
   ```js
   const s = require('./utils/storage');
   // 写入一个空 map
   s.saveMap({ id: 'test1', name: 'Test', config: {}, grids: [{type:'poi',poi:{name:'a'}}] });
   // 应该返回 { saved: true }
   // 读回
   s.getMap('test1');
   // 应该看到 { id: 'test1', ..., currentGame: null }（归一化生效）
   // 设置一个 currentGame
   s.updateMapGameState('test1', { id: 'g1', startedAt: 'x', currentGridIndex: 0, currentLap: 0, currentGold: 0, diceRolls: 0, distance: 0, checkins: [], chanceCardHistory: [], status: 'playing' });
   s.getMap('test1').currentGame;  // 应该看到刚才 set 的对象
   // 清掉
   s.deleteMap('test1');
   s.getMap('test1');  // undefined
   ```
4. Expected: all operations succeed, `currentGame` is normalized to `null` for the fresh map, and reads return what was written.

- [ ] **Step 1.3: Report to user**

Show the user the file diff and the console verification log. Ask: "Task 1 done — should I commit this, or continue to Task 2?"

---

## Task 2: Rewrite `services/gameEngine.js`

**Files:**
- Modify: `services/gameEngine.js` (full rewrite)

- [ ] **Step 2.1: Replace the file contents**

Replace the entire contents of `services/gameEngine.js` with the new implementation:

```js
// 游戏引擎 - 管理游戏状态、掷骰、移动、打卡、机会卡等核心逻辑
// 负责游戏数据的持久化（写入 map.currentGame）和游戏过程的记录

const { generateId, updateMapGameState } = require('../utils/storage');
const { INITIAL_GOLD, LAP_REWARD_GOLD, DICE_MIN, DICE_MAX } = require('../utils/constants');
const { generateChanceCards } = require('./aiService');

class GameEngine {
  // 构造函数
  // mapId: 地图ID
  // mapData: 完整地图数据（含 grids / config / 可选 currentGame）
  // 注意：构造函数不会自动加载 currentGame，由调用方显式调用 initFresh() 或 resume()
  constructor(mapId, mapData) {
    this.mapId = mapId;
    this.map = mapData;
    this.state = null;
    this.chanceCardsCache = {};
    this._initChanceCardCache();
  }

  _initChanceCardCache() {
    if (!this.map || !this.map.grids) return;
    this.map.grids.forEach((grid, idx) => {
      if (grid.type === 'chance') {
        this.chanceCardsCache[idx] = generateChanceCards(5);
      }
    });
  }

  // 全新开一局
  initFresh() {
    this.state = {
      id: generateId(),
      mapId: this.mapId,
      startedAt: new Date().toISOString(),
      endedAt: null,
      currentGridIndex: 0,
      currentLap: 0,
      currentGold: this.map.config && this.map.config.initialGold
        ? this.map.config.initialGold
        : INITIAL_GOLD,
      diceRolls: 0,
      checkins: [],
      chanceCardHistory: [],
      distance: 0,
      status: 'playing',
    };
    this.save();
    return this;
  }

  // 从已存在的 currentGame 恢复
  // map.currentGame 必须存在；否则抛错
  resume() {
    if (!this.map.currentGame) {
      throw new Error('该地图没有进行中的游戏');
    }
    this.state = { ...this.map.currentGame };
    return this;
  }

  // 掷骰子，返回 1-6 随机整数（不触发 save，save 发生在 move 里）
  rollDice() {
    const result = DICE_MIN + Math.floor(Math.random() * (DICE_MAX - DICE_MIN + 1));
    this.state.diceRolls++;
    return result;
  }

  // 移动棋子，返回 save 结果 { saved, reason? }
  move(steps) {
    const previousIndex = this.state.currentGridIndex;
    this.state.currentGridIndex = (this.state.currentGridIndex + steps) % this.map.grids.length;
    if (previousIndex + steps >= this.map.grids.length) {
      this.state.currentLap++;
      this.state.currentGold += this.map.config && this.map.config.lapRewardGold
        ? this.map.config.lapRewardGold
        : LAP_REWARD_GOLD;
    }
    return this.save();
  }

  // 获取当前所在格子
  getCurrentGrid() {
    return this.map.grids[this.state.currentGridIndex];
  }

  // 打卡，返回 { success, message?, saved, reason? }
  // photoPath: 打卡照片路径（可选）
  // note: 打卡备注（可选）
  checkin(photoPath, note = '') {
    const grid = this.getCurrentGrid();
    if (!this.map.config || !this.map.config.allowRepeatCheckin) {
      const alreadyCheckedIn = this.state.checkins.some(c => c.gridIndex === this.state.currentGridIndex);
      if (alreadyCheckedIn) {
        return { success: false, message: '此位置已打卡', saved: true, reason: 'already_checked_in' };
      }
    }
    this.state.checkins.push({
      gridIndex: this.state.currentGridIndex,
      timestamp: new Date().toISOString(),
      photoUrl: photoPath,
      note: note || (grid.type === 'poi' ? (grid.poi && grid.poi.name) : '机会卡打卡'),
    });
    const saveResult = this.save();
    return { success: true, saved: saveResult.saved, reason: saveResult.reason };
  }

  // 抽取机会卡，返回 { card, saved, reason? } 或 null（当前格不是机会格）
  drawChanceCard() {
    const gridIndex = this.state.currentGridIndex;
    const grid = this.map.grids[gridIndex];
    if (grid.type !== 'chance') return null;
    const cards = this.chanceCardsCache[gridIndex];
    if (!cards || cards.length === 0) return null;
    const card = cards.pop();
    this.state.currentGold += card.goldChange;
    this.state.chanceCardHistory.push({
      gridIndex,
      card,
      timestamp: new Date().toISOString(),
    });
    const saveResult = this.save();
    return { card, saved: saveResult.saved, reason: saveResult.reason };
  }

  // 增加行进距离，返回 save 结果
  addDistance(meters) {
    this.state.distance += meters;
    return this.save();
  }

  // 结束游戏，返回 save 结果
  settle() {
    this.state.status = 'completed';
    this.state.endedAt = new Date().toISOString();
    return this.save();
  }

  // 获取当前游戏状态（浅拷贝）
  getState() {
    return { ...this.state };
  }

  // 获取游戏时间线（用于结算页面）
  getTimeline() {
    const events = [];
    if (this.state.checkins.length > 0 && this.state.checkins[0].gridIndex === 0) {
      events.push(this.state.checkins[0]);
    } else {
      events.push({
        gridIndex: 0,
        timestamp: this.state.startedAt,
        note: '起点',
      });
    }
    const sortedCheckins = [...this.state.checkins].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
    events.push(...sortedCheckins);
    this.state.chanceCardHistory.forEach(ch => {
      const grid = this.map.grids[ch.gridIndex];
      events.push({
        gridIndex: ch.gridIndex,
        timestamp: ch.timestamp,
        note: `机会卡：${ch.card.description}`,
        isChanceCard: true,
      });
    });
    return events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  // 获取游戏统计数据
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
      totalLaps: this.state.currentLap,
    };
  }

  // 持久化到 map.currentGame，返回 save 结果
  save() {
    return updateMapGameState(this.mapId, this.state);
  }
}

module.exports = { GameEngine };
```

- [ ] **Step 2.2: Verify by hand in the WeChat dev tool**

In the WeChat dev tool Console:

1. Compile the project.
2. Run:
   ```js
   const { GameEngine } = require('./services/gameEngine');
   const s = require('./utils/storage');
   // 准备一个地图
   s.saveMap({ id: 'eng1', name: 'EngTest', config: { initialGold: 500 }, grids: [{type:'poi',poi:{name:'a'}},{type:'chance'}] });
   // 新开一局
   const e = new GameEngine('eng1', s.getMap('eng1')).initFresh();
   // 骰子 + 移动
   e.rollDice();
   e.move(1);
   // 读回
   s.getMap('eng1').currentGame.currentGridIndex;  // 应该是 1
   e.state.currentGold;  // 500
   // resume
   const e2 = new GameEngine('eng1', s.getMap('eng1')).resume();
   e2.state.currentGridIndex;  // 应该是 1
   e2.state.currentGold;  // 500
   // 清理
   s.deleteMap('eng1');
   ```
3. Expected: state persists across engine instances, initFresh + resume round-trip works, no errors.

- [ ] **Step 2.3: Report to user**

Show the user the file diff and verification log. Ask: "Task 2 done — continue to Task 3?"

---

## Task 3: Update `pages/game/game.js` — new onLoad flow + save-failure handling

**Files:**
- Modify: `pages/game/game.js`

- [ ] **Step 3.1: Update imports (top of file)**

Replace lines 4-5:

```js
// 引入存储服务 - 用于读取地图数据
const { StorageService } = require('../../utils/storage');
```

with:

```js
// 引入存储服务 - 用于读取地图数据
const { getMap } = require('../../utils/storage');
```

- [ ] **Step 3.2: Replace `onLoad`**

Replace lines 33-69 (the entire `onLoad` function and the JSDoc above it) with:

```js
  // 页面加载时执行
  onLoad(options) {
    const { mapId } = options;  // 只接 mapId 参数（gameId 已废弃）

    if (!mapId) {
      wx.showToast({ title: '参数错误', icon: 'error' });
      wx.navigateBack();
      return;
    }

    const mapData = getMap(mapId);
    if (!mapData) {
      wx.showToast({ title: '地图不存在', icon: 'error' });
      wx.navigateBack();
      return;
    }

    this._startOrResumeGame(mapData);
  },

  // 根据 mapData.currentGame 的状态决定 initFresh / resume / 弹重置确认
  _startOrResumeGame(mapData) {
    if (!mapData.currentGame) {
      // 全新开始
      const engine = new GameEngine(mapData.id, mapData).initFresh();
      this.setData({ engine, mapId: mapData.id, gameId: engine.state.id });
      this.syncFromEngine();
      this.prepareShareFile(mapData);
      wx.showToast({ title: '游戏开始', icon: 'success' });
      return;
    }

    if (mapData.currentGame.status === 'playing') {
      // 继续
      const engine = new GameEngine(mapData.id, mapData).resume();
      this.setData({ engine, mapId: mapData.id, gameId: engine.state.id });
      this.syncFromEngine();
      return;
    }

    // 已完成 — 弹重置确认
    wx.showModal({
      title: '该地图已有完结记录',
      content: '开始新游戏将清除上一局进度，确定要继续吗？',
      confirmText: '开始新游戏',
      cancelText: '返回',
      success: (res) => {
        if (res.confirm) {
          const engine = new GameEngine(mapData.id, mapData).initFresh();
          this.setData({ engine, mapId: mapData.id, gameId: engine.state.id });
          this.syncFromEngine();
          this.prepareShareFile(mapData);
          wx.showToast({ title: '游戏开始', icon: 'success' });
        } else {
          wx.navigateBack();
        }
      }
    });
  },

  // 处理 save 返回结果。失败时弹"无法保存"modal，去清理 / 继续游戏
  _handleSaveResult(result) {
    if (!result || result.saved !== false) return;
    wx.showModal({
      title: '无法保存进度',
      content: '存储已满，请删除部分地图后继续',
      confirmText: '去清理',
      cancelText: '继续游戏（仅本会话）',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({ url: '/pages/history/history' });
        }
      }
    });
  },
```

- [ ] **Step 3.3: Wire `_handleSaveResult` into engine action calls**

Update each call site that invokes an engine action method to pass the save result through `_handleSaveResult`. There are four sites:

**(a) `doRollDice` (line 204-239):** the `engine.move(steps)` call at line 215 returns a save result. Update line 215 to:

```js
    const saveResult = engine.move(steps);  // 执行移动（带 save）
    this._handleSaveResult(saveResult);
```

**(b) `showChanceCard` (line 242-263):** the `engine.drawChanceCard()` call at line 244 returns `{ card, saved, reason? }` or null. Update lines 244-246:

```js
    const result = engine.drawChanceCard();  // 返回 { card, saved, reason? } 或 null
    this._handleSaveResult(result);

    if (!result || !result.card) return;
    const card = result.card;
```

**(c) `doCheckin` (line 277-304):** the `engine.checkin(photoPath)` call at line 294 returns `{ success, message?, saved, reason? }`. Update line 294 and the surrounding success/fail branches (lines 296-302):

```js
        const result = engine.checkin(photoPath);  // 执行打卡

        if (result.success) {  // 打卡成功
          wx.showToast({ title: '打卡成功', icon: 'success' });
          this.syncFromEngine();  // 同步状态（更新打卡列表）
        } else if (result.message) {  // 业务失败（已打卡过）
          wx.showToast({ title: result.message, icon: 'none' });
        }
        this._handleSaveResult(result);
```

**(d) `onSettle` (line 445-465):** the `engine.settle()` call at line 459 returns a save result. Update line 459:

```js
          const saveResult = engine.settle();  // 执行结算（标记游戏结束）
          this._handleSaveResult(saveResult);
          wx.showToast({ title: '游戏已结算', icon: 'success' });
          wx.navigateBack();
```

- [ ] **Step 3.4: Verify by hand**

In the WeChat dev tool:

1. Compile. Open the `create` page, generate a map → it auto-navigates to `game?mapId=xxx`.
2. Confirm: `游戏开始` toast appears; engine initializes; you can roll dice.
3. Roll several dice; verify state updates.
4. Close the mini program (background, not delete). Reopen.
5. Open the `history` page, tap the same map → engine resumes with previous state intact.
6. Trigger a `settle` → status becomes `completed`. Reopen the same map → reset modal appears. Cancel → navigate back. Reopen → confirm → fresh state.

- [ ] **Step 3.5: Report to user**

Show the user the modified `game.js` (especially the new onLoad + the four wired action sites). Ask: "Task 3 done — continue?"

---

## Task 4: Update `pages/settlement/settlement.js`

**Files:**
- Modify: `pages/settlement/settlement.js`

- [ ] **Step 4.1: Update imports**

Replace line 4:

```js
const { getGame, getMap } = require('../../utils/storage');  // 引入存储工具函数
```

with:

```js
const { getMap } = require('../../utils/storage');  // 引入存储工具函数
```

- [ ] **Step 4.2: Replace `onLoad`**

Replace lines 20-56 (the `onLoad` function) with:

```js
  onLoad(options) {
    const { mapId } = options;  // 改用 mapId 参数

    const mapData = getMap(mapId);
    if (!mapData || !mapData.currentGame) {
      wx.showToast({ title: '游戏数据不存在', icon: 'none' });
      wx.navigateBack();
      return;
    }

    // 重建游戏引擎并恢复游戏状态
    const engine = new GameEngine(mapData.id, mapData).resume();
    const gameState = engine.state;

    // 构建时间线事件（带格式化时间字符串）
    const timeline = this.buildTimeline(engine.getTimeline(), mapData);

    // 获取游戏统计数据
    const stats = engine.getStatistics();

    // 格式化日期范围用于显示
    const startDate = new Date(gameState.startedAt);
    const endDate = gameState.endedAt ? new Date(gameState.endedAt) : new Date();
    const dateRange = `${this.formatDate(startDate)} - ${this.formatDate(endDate)}`;

    // 设置页面数据，触发渲染
    this.setData({
      mapName: mapData.config?.name || mapData.name || '我的探索',
      dateRange,
      timeline,
      ...stats
    });
  },
```

- [ ] **Step 4.3: Verify by hand**

1. Start a new game from `create`, play a few rounds, `settle` it.
2. Reopen the same map from `history` (or directly navigate to `/pages/settlement/settlement?mapId=xxx`).
3. Expected: settlement page renders with the just-completed game's stats and timeline.

- [ ] **Step 4.4: Report to user**

Show the diff. Ask: "Task 4 done — continue?"

---

## Task 5: Add quota warning to `app.js`

**Files:**
- Modify: `app.js`

- [ ] **Step 5.1: Update imports and add quota check**

Replace the top of `app.js` (lines 1-3) with:

```js
// 小程序全局入口文件
// 初始化全局数据和管理地图存储

const { getStorageUsage } = require('./utils/storage');
```

- [ ] **Step 5.2: Add the launch quota check**

Replace the `onLaunch` function (lines 11-14) with:

```js
  onLaunch(options) {
    this.loadMapsFromStorage();
    this.handleOpenMapFile(options);
    this.checkStorageQuota();
  },

  // 启动时检查存储用量，超过 80% 弹非阻塞 modal
  checkStorageQuota() {
    const usage = getStorageUsage();
    if (usage.percent > 0.8) {
      const usedMB = (usage.usedKB / 1024).toFixed(1);
      const limitMB = (usage.limitKB / 1024).toFixed(0);
      wx.showModal({
        title: '本地存储快满了',
        content: `已用 ${usedMB} MB（共 ${limitMB} MB），建议删除部分地图释放空间`,
        confirmText: '去看看',
        cancelText: '知道了',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/history/history' });
          }
        }
      });
    }
  },
```

- [ ] **Step 5.3: Verify by hand**

Two ways to verify:

**(a) Light storage:** Compile and launch. Expected: no warning modal (default storage usage is well under 80%).

**(b) Heavy storage:** Manually seed 5+ large maps. Easiest way:
1. Generate a few maps via `create` (each map can be 5+ KB with grids).
2. Reload the app.
3. Expected: warning modal appears with used/total. Tap "去看看" → navigates to history page.

- [ ] **Step 5.4: Report to user**

Show the diff. Ask: "Task 5 done — continue?"

---

## Task 6: Update `services/shareService.js` to strip `currentGame` on export

**Files:**
- Modify: `services/shareService.js`

- [ ] **Step 6.1: Update `exportMap` to strip `currentGame`**

Replace `exportMap` (lines 9-30) with:

```js
function exportMap(mapData) {
  return new Promise((resolve, reject) => {
    // 分享只带定义，不带 currentGame（避免把进行中的进度发给别人）
    const { currentGame, ...cleanMap } = mapData;
    const jsonString = JSON.stringify(cleanMap);
    const fileName = `city-monopoly-map-${cleanMap.name || 'unnamed'}-${Date.now()}.json`;

    const fs = wx.getFileSystemManager();
    const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;

    fs.writeFile({
      filePath,
      data: jsonString,
      encoding: 'utf8',
      success: () => {
        resolve(filePath);
      },
      fail: (err) => {
        console.error('Export failed:', err);
        reject(err);
      }
    });
  });
}
```

- [ ] **Step 6.2: Verify by hand**

1. Generate a map, play one round, then `settle` it (or leave it mid-play).
2. From the `game` page sidebar, tap "分享地图".
3. Save the shared JSON file and open it in a text editor.
4. Expected: the JSON does **not** contain a `currentGame` key. (Other fields like `id`, `name`, `config`, `grids` are present.)

- [ ] **Step 6.3: Report to user**

Show the diff and verification (paste the JSON excerpt to prove currentGame is missing). Ask: "Task 6 done — continue?"

---

## Task 7: Update `pages/edit/edit.js` to use the new `saveMap` upsert

**Files:**
- Modify: `pages/edit/edit.js`

- [ ] **Step 7.1: Update imports**

Replace line 4:

```js
const { getMap, generateId } = require('../../utils/storage');
```

with:

```js
const { getMap, generateId, saveMap } = require('../../utils/storage');
```

(`getMap` and `generateId` are still exported; `saveMap` is new — the new upsert behavior replaces the manual array push/splice.)

- [ ] **Step 7.2: Replace `saveAsNewMap` direct-storage logic**

Replace lines 146-166 (the `saveAsNewMap` function) with:

```js
  saveAsNewMap() {
    console.log('[Edit] saveAsNewMap called, mapId:', this.data.mapId);
    const oldMapData = getMap(this.data.mapId);
    if (!oldMapData) return;

    const newMapData = {
      ...oldMapData,
      id: generateId(),
      createdAt: new Date().toISOString(),
      grids: this.data.grids
    };

    const result = saveMap(newMapData);  // 新 API：upsert
    if (!result.saved) {
      wx.showToast({ title: '保存失败：' + (result.reason || '未知错误'), icon: 'none' });
      return;
    }

    wx.showToast({ title: '已保存为新地图', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 1000);
  },
```

- [ ] **Step 7.3: Replace `overwriteMap` direct-storage logic**

Replace lines 169-188 (the `overwriteMap` function) with:

```js
  overwriteMap() {
    console.log('[Edit] overwriteMap called, mapId:', this.data.mapId);
    const oldMapData = getMap(this.data.mapId);
    if (!oldMapData) return;

    oldMapData.grids = this.data.grids;

    const result = saveMap(oldMapData);  // 走 upsert，自动 replace 数组里同 id 的项
    if (!result.saved) {
      wx.showToast({ title: '保存失败：' + (result.reason || '未知错误'), icon: 'none' });
      return;
    }

    wx.showToast({ title: '已覆盖保存', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 1000);
  },
```

- [ ] **Step 7.4: Verify by hand**

1. Open a map in `edit`, change a grid's name, tap "保存并退出" → confirm "新副本".
2. Expected: a new map appears in `history` with the change. Old map is unchanged.
3. Edit the same source map again, change another grid, tap "保存并退出" → confirm "覆盖".
4. Expected: original map is replaced; `history` shows the updated content.
5. Confirm: no `currentGame` from the old map is lost — if you reload `/pages/game/game?mapId=xxx` for the original map, the in-progress game still resumes (because `saveMap` upsert preserves the `currentGame` field via normalization).

- [ ] **Step 7.5: Report to user**

Show the diff. Ask: "Task 7 done — continue?"

---

## Task 8: End-to-end verification (run the 6 scenarios from the spec)

- [ ] **Step 8.1: Clear local storage**

In the WeChat dev tool: Storage panel → clear all keys. This drops the (already empty) `games` key and any pre-existing `maps`.

- [ ] **Step 8.2: Run scenario 1 — Fresh start**

1. From `index`, navigate to `create`.
2. Generate a map (takes a few seconds via AI).
3. Auto-navigates to `game?mapId=xxx`. `游戏开始` toast appears.
4. Roll 3 dice. Checkin on a POI grid. Land on a chance grid if present.
5. Close the mini program (background, then kill from task manager).
6. Reopen → `history` → tap the same map.
7. Expected: state resumes — same gridIndex, gold, checkins, chance cards history.

- [ ] **Step 8.3: Run scenario 2 — Reset on completed map**

1. Continue from scenario 1.
2. From the `game` page sidebar, tap "结算" → confirm.
3. State becomes `status: 'completed'`.
4. Tap the same map in `history`.
5. Expected: "该地图已有完结记录" modal appears.
6. Tap "开始新游戏" → engine `initFresh()`, state cleared, fresh `startedAt`.
7. Tap "返回" instead → navigate back without changes.

- [ ] **Step 8.4: Run scenario 3 — Share round-trip**

1. Start a fresh game, roll a few dice.
2. Sidebar → "分享地图". Save the JSON file.
3. Inspect the file. Expected: no `currentGame` field.
4. Sidebar → "载入本地地图", pick that JSON file.
5. Modal "导入成功" → tap "开始游戏".
6. Expected: the imported map has a new id; `currentGame` is null; engine `initFresh()` runs.

- [ ] **Step 8.5: Run scenario 4 — Quota warning on launch**

1. Generate 6+ maps via `create` (each map has full 5+ grid definitions).
2. Kill the app, relaunch.
3. Expected: "本地存储快满了" modal appears with used/total.
4. Tap "去看看" → lands on `pages/history/history`.
5. Delete 2 maps. Navigate back to home.
6. Kill + relaunch the app.
7. Expected: no warning modal (usage dropped below 80%).

- [ ] **Step 8.6: Run scenario 5 — Quota failure at save-time**

This one is harder to trigger naturally. Two options:

**(a) Mock the quota check** (dev tool debugger): temporarily edit `utils/storage.js`'s `getStorageUsage` to return `percent: 1.5` for one call, then trigger a save.

**(b) Pre-fill the map with very large `chanceCardHistory`**: write a script that pushes 10000 fake chance cards into a map's `currentGame.chanceCardHistory` via the console:

```js
const s = require('./utils/storage');
const m = s.getMap('<some-id>');
m.currentGame.chanceCardHistory = new Array(10000).fill({ gridIndex: 0, card: { description: 'x'.repeat(500), goldChange: 0 }, timestamp: new Date().toISOString() });
s.saveMap(m);
```

Either way, after triggering quota failure:
1. Roll dice in the game.
2. Expected: "无法保存进度" modal appears.
3. Tap "去清理" → history page.
4. Delete a map, return to game.
5. Roll again. Expected: save succeeds; no warning modal.

- [ ] **Step 8.7: Run scenario 6 — No regression**

Smoke test these pages in order:

1. `pages/index/index.js` — list loads, can navigate to create/history.
2. `pages/create/create.js` — generate a new map, save, navigate to game.
3. `pages/edit/edit.js` — modify a map, save (both "新副本" and "覆盖" paths).
4. `pages/history/history.js` — list shows all maps; delete works.
5. `pages/game/game.js` — already covered above; just confirm one more round works.
6. `pages/settlement/settlement.js` — already covered above.

- [ ] **Step 8.8: Final report**

Tell the user all 6 scenarios pass. Ask: "Refactor complete — anything you want to change before I report this done?"

---

## Self-Review Notes

- **Spec coverage:** Data shape ✓ (Task 1 normalization, Task 2 state shape). Storage API ✓ (Task 1 fully covers all adds/changes/removals). GameEngine ✓ (Task 2). Pages ✓ (Tasks 3-7). Sharing ✓ (Task 6). Quota warning ✓ (Tasks 1+3+5). Verification ✓ (Task 8 covers all 6 spec scenarios).
- **No placeholders:** Each task has full code blocks; no "TODO" or "fill in later".
- **Type consistency:** `currentGame: GameState | null` is used uniformly. `{ saved, reason? }` return shape is consistent across `saveMap` / `updateMapGameState` / `clearMapGameState` / engine `save()`. Engine action methods return shape: pure save result for `move`/`addDistance`/`settle`; flat `{...prev, saved, reason?}` for `checkin`/`drawChanceCard`. Documented as a deliberate choice in Task 2.
- **Commit handling:** Each task ends with "Report to user" instead of "Commit" per user instruction.
