# Storage Layer Consolidation — Design Spec

**Date:** 2026-06-01
**Status:** Approved (pending written review)
**Author:** Claude (via brainstorming session)

## Context

The current local persistence layer uses two storage keys:

- `maps` — Array of map definitions (id, name, config, grids).
- `games` — Array of game-state records (currentGridIndex, currentGold, checkins, chanceCardHistory, …) referenced to a map by `mapId`.

Three problems with this shape:

1. **Storage bloat from a bug.** `saveGame()` in `utils/storage.js:43-47` calls `games.push(state)` instead of replacing. Every dice roll, checkin, or chance-card draw appends a new state record. The `games` array grows unboundedly even within a single play session, and the cumulative `JSON.stringify` of all those records can exceed WeChat's 1 MB per-key limit (and the 10 MB total cap) for users with several maps.
2. **Orphan data risk.** `mapId` and `gameId` are independent. A `games[i].mapId` can point to a deleted map, or a map can exist with no in-progress game. Nothing enforces the relationship.
3. **Design mismatch.** Game progress is conceptually owned by the map it plays on. A user creating a "London Fog" board should not have to think about a parallel "London Fog game session" — opening the map should resume where they left off, deleting the map should erase progress, sharing the map should carry its identity but not its current playthrough.

This refactor consolidates game state into the map record, eliminates the two-key split, fixes the push-not-replace bug, and adds a user-facing storage quota warning so the 4–5 maps target is enforced without silent data loss.

## Goals

- Single source of truth: one `maps` key, each entry self-contained.
- The push-not-replace bug in `saveGame()` is structurally impossible after refactor.
- `currentGame` on a map is `null` (not started) or a `GameState` object (in-progress or completed).
- Deleting a map cascades to its `currentGame` for free.
- Sharing a map file (export → import) carries the board definition only, never a live playthrough.
- User is warned before storage fills up; warned again at save-time when quota is hit. No silent failures, no auto-deletion.
- API surface stays small and map-centric.

## Non-Goals

- No migration of existing `games`-key data. The project is in R&D; the user will manually clear local storage before deploying this version. No backward-compat shims.
- No cloud/server sync. Local storage is MVP; future migration to a server is out of scope. Don't add server-shaped interfaces.
- No archival, no per-map multiple-game history. One current game per map.
- No automatic cleanup, no LRU eviction. User-driven deletion only.
- No new abstractions (e.g., IndexedDB, SQLite, encrypted storage) — pure `wx.getStorageSync` / `wx.setStorageSync`.

## New Data Shape

```js
// Storage key: 'maps' — Array<Map>
type Map = {
  id: string,
  name: string,
  createdAt: string,                // ISO timestamp
  config: {                         // unchanged
    name: string,
    initialGold?: number,
    lapRewardGold?: number,
    allowRepeatCheckin?: boolean,
    ...
  },
  grids: Array<Grid>,               // unchanged

  // NEW: current game state (null = never started)
  currentGame: GameState | null,
}

type GameState = {
  id: string,
  startedAt: string,                // ISO
  endedAt: string | null,           // null while playing
  currentGridIndex: number,
  currentLap: number,
  currentGold: number,
  diceRolls: number,
  distance: number,                 // meters
  checkins: Array<{
    gridIndex: number,
    timestamp: string,
    photoUrl?: string,
    note: string,
  }>,
  chanceCardHistory: Array<{        // full card preserved, including AI description
    gridIndex: number,
    card: {
      description: string,
      goldChange: number,
      suggestCheckin?: boolean,
      checkinType?: string,
    },
    timestamp: string,
  }>,
  status: 'playing' | 'completed',
}
```

The `chanceCardsCache` field on `GameEngine` is **not** persisted — it lives in memory only and is re-derived on each engine construction (existing behavior, no change).

## Storage Service API (`utils/storage.js`)

### Kept (behavior changes where noted)

| Method | Behavior |
|---|---|
| `getMaps(): Map[]` | Unchanged. Returns the full array. |
| `getMap(id): Map \| undefined` | Unchanged. |
| `saveMap(map): { saved: boolean, reason?: string }` | **New behavior:** upsert by `map.id`. If a map with the same id exists, replace it in place (preserving array order). Otherwise push. **Normalizes the saved shape**: `map.currentGame = map.currentGame ?? null` before write, so all saved maps are guaranteed to have the field. Returns `{ saved: false, reason: 'quota_exceeded' }` if `setStorageSync` cannot complete; otherwise `{ saved: true }`. |
| `deleteMap(id): void` | Unchanged. Cascade is automatic — `currentGame` is part of the map entry, so removing the map removes the game state. |

### Added

| Method | Behavior |
|---|---|
| `getMapGameState(mapId): GameState \| null` | Returns `map.currentGame` or `null`. |
| `updateMapGameState(mapId, gameState): { saved: boolean, reason?: string }` | Finds the map by id, sets `map.currentGame = gameState`, calls `wx.setStorageSync('maps', maps)`. **If the map is not found**, returns `{ saved: false, reason: 'map_not_found' }` without writing. Otherwise returns the quota-failure result like `saveMap`. |
| `clearMapGameState(mapId): { saved: boolean, reason?: string }` | Finds the map by id, sets `map.currentGame = null`, persists. |
| `getStorageUsage(): { usedKB: number, limitKB: number, percent: number }` | Thin wrapper over `wx.getStorageInfoSync()`. Returns 0/limit/0 if `wx.getStorageInfoSync` is unavailable. |

### Removed

- `saveGame` (the buggy function — push-not-replace)
- `getGame`
- `getGames` (the `games` key is no longer used)
- `StorageService.saveGame / getGame / getGames` (and their standalone exports `saveGame`, `getGame`)
- The `games` storage key itself (user clears manually before deploying)

### Quota guard

`saveMap` and `updateMapGameState` both pre-check `getStorageUsage().percent` before calling `setStorageSync`. If `percent >= 1.0` (or `setStorageSync` throws), return `{ saved: false, reason: 'quota_exceeded' }` and do not modify storage. The previous stored value is untouched.

## GameEngine Changes (`services/gameEngine.js`)

### Constructor

```js
constructor(mapId, mapData) {
  this.mapId = mapId;
  this.map = mapData;
  this.state = null;                       // explicit — caller must init
  this.chanceCardsCache = {};
  this._initChanceCardCache();             // unchanged pre-generation
}
```

No implicit "load from `map.currentGame`" inside the constructor. The caller decides whether to resume or start fresh.

### New methods

```js
initFresh() {
  this.state = {
    id: generateId(),
    mapId: this.mapId,
    startedAt: new Date().toISOString(),
    endedAt: null,
    currentGridIndex: 0,
    currentLap: 0,
    currentGold: this.map.config?.initialGold ?? INITIAL_GOLD,
    diceRolls: 0,
    checkins: [],
    chanceCardHistory: [],
    distance: 0,
    status: 'playing',
  };
  this.save();
  return this;
}

resume() {
  if (!this.map.currentGame) {
    throw new Error('该地图没有进行中的游戏');
  }
  this.state = { ...this.map.currentGame };
  return this;
}
```

### Modified `save()`

```js
save() {
  return updateMapGameState(this.mapId, this.state);
}
```

The return value propagates up so callers can react to quota failures.

### Removed

- `static load(gameId)` — entirely. The new `pages/game/game.js` flow does the lookup itself via `getMap(mapId)` and then calls `initFresh()` or `resume()`.

### Unchanged in behavior, but return values

`rollDice`, `move`, `checkin`, `drawChanceCard`, `addDistance`, `settle`, `getState`, `getTimeline`, `getStatistics` keep their existing observable behavior. The action methods (`rollDice` / `move` / `checkin` / `drawChanceCard` / `addDistance` / `settle`) now also return whatever `this.save()` returns — i.e., `{ saved: boolean, reason?: string }` — so callers can react to quota failures without an extra save call. `getState`, `getTimeline`, and `getStatistics` continue to return their derived data.

## Page-Level Changes

### `pages/game/game.js` — primary change

- URL parameter: `mapId` only. `gameId` is gone.
- `onLoad` reads `getMap(mapId)`, then dispatches on `mapData.currentGame`:
  - `null` → `new GameEngine(mapId, mapData).initFresh()`, proceed.
  - `status === 'playing'` → `new GameEngine(mapId, mapData).resume()`, proceed.
  - `status === 'completed'` → show reset confirmation modal:
    - Confirm → `initFresh()`, proceed.
    - Cancel → `wx.navigateBack()`.
- After every action that calls `engine.save()` (dice, checkin, chance, distance, settle), the page inspects the return value:
  - `{ saved: true }` → silent.
  - `{ saved: false, reason: 'quota_exceeded' }` → show modal:

    > [无法保存进度]
    > 存储已满，请删除部分地图后继续
    > [去清理]  [继续游戏（仅本会话）]

    "去清理" → `wx.navigateTo` to `/pages/history/history`. "继续游戏" → dismiss; the engine keeps using in-memory state, and the next save failure re-prompts.

### `pages/settlement/settlement.js`

- URL parameter: `mapId` only.
- `onLoad` reads `getMap(mapId)`, gets `mapData.currentGame` directly, reconstructs engine via `new GameEngine(mapId, mapData).resume()`. The `getGame(gameId)` call and the import of `getGame` from storage are removed.

### `app.js`

- On launch, call `getStorageUsage()`. If `percent > 0.8` (8 MB / 10 MB), show a modal:

  > [本地存储快满了]
  > 已用 X.X MB（共 10 MB），建议删除部分地图释放空间
  > [去看看]  [知道了]

  "去看看" → `wx.navigateTo` to `/pages/history/history`. "知道了" → dismiss. This is non-blocking — gameplay continues.

### `services/shareService.js`

- `exportMap(mapData)`: strip `currentGame` before serializing.
  ```js
  const { currentGame, ...cleanMap } = mapData;
  // serialize cleanMap
  ```
- `importMapFromFile`: after `JSON.parse`, the imported object lacks `currentGame`. The receiving `saveMap` upsert writes it back; ensure the saved shape has `currentGame: null` explicitly (one-line normalization in `saveMap`).
- `validateMapData`: no longer requires `currentGame` to be present.

### No-change pages

- `pages/history/history.js`, `pages/index/index.js`, `pages/create/create.js` — unchanged.
- `pages/edit/edit.js` — implementation-level only. Its `wx.getStorageSync('maps')` / `wx.setStorageSync('maps', maps)` direct calls get replaced with the new `saveMap` upsert, but the page's external behavior is identical.

## Storage Quota Warning (UX Detail)

| Trigger | Surface | Buttons | Blocking? |
|---|---|---|---|
| App launch, usage > 80% | `wx.showModal` | "去看看" → history, "知道了" | No |
| `save()` returns quota failure | `wx.showModal` | "去清理" → history, "继续游戏（仅本会话）" | No |

Use `wx.showModal` (not `wx.showToast`) for both, because the user needs a button to take action. Toast is reserved for non-actionable feedback (e.g., "已打卡").

## Verification

Each scenario is exercised by hand in the WeChat dev tool against a clean storage (no pre-existing `games` key):

1. **Fresh start** — `create` flow generates a map → auto-navigates to `game?mapId=xxx` → `initFresh()` runs → dice/checkin/chance all persist. Close the mini program, reopen, tap the same map from `history` → engine resumes with all state intact (gridIndex, gold, checkins, chanceCardHistory).

2. **Reset on completed map** — play a map to completion (`settle()` sets `status: 'completed'`) → reopen that map from `history` → reset modal appears → confirm → `initFresh()` clears the previous `currentGame` and starts a fresh session.

3. **Share round-trip** — export a map that has `currentGame` in progress → JSON file content does not contain `currentGame` (or its keys) → import on the same or different dev account → imported map has `currentGame: null` → starting a game on it runs `initFresh()`.

4. **Quota warning on launch** — manually seed 5+ large maps (or temporarily lower the limit by injecting mock storage), launch the app → warning modal appears with used/total → "去看看" lands on `pages/history/history` → deleting a map drops the warning on next launch.

5. **Quota failure at save-time** — force `wx.setStorageSync` to throw (e.g., by mocking or by exceeding 1 MB per-key) → roll dice → game page shows "无法保存进度" modal with "去清理" → navigate to history → delete a map → return to game → next dice roll saves successfully.

6. **No regression in `create` / `edit` / `history` / `index`** — all five pages still work. `edit` page's save path goes through the new `saveMap` upsert; externally indistinguishable from before.

## Risks

- **Existing `games` data** is incompatible. User clears manually. No on-device migration.
- **The `wx.getStorageInfoSync` API** has historically been a bit inconsistent across WeChat versions; if `currentSize` is missing, treat usage as 0 and skip the warning rather than blocking.
- **Quota failures mid-game** can lead to state divergence between in-memory and on-disk. The "继续游戏（仅本会话）" path explicitly accepts this — the user understands that their next move won't survive a kill-and-relaunch.

## Files Touched

- `utils/storage.js` — API surface rewrite, quota guard.
- `services/gameEngine.js` — constructor / save / initFresh / resume.
- `pages/game/game.js` — `onLoad` flow + save-failure modal.
- `pages/settlement/settlement.js` — read from map instead of games.
- `app.js` — launch-time quota check.
- `services/shareService.js` — strip `currentGame` on export.
- `pages/edit/edit.js` — replace direct `wx.getStorageSync` calls with `saveMap` upsert.
- (no other pages)

## Open Questions

None. The session resolved all design decisions before this spec was written.
