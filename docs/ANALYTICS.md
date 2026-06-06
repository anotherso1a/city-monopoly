# ANALYTICS — 埋点字典

> 微信小程序 `wx.reportEvent(string eventId, object data)` 的全量事件规范。
> 单一事实源,所有埋点代码改动前先看这里,改动后回来更新。

## 1. 架构与服务

- **入口**:`services/analytics.js`
- **4 类关注点**:埋点(行为) / 性能 / 错误 / 预警
- **4 个 API**:
  - `trackEvent(eventId, data)` — 行为
  - `trackPerf(eventId, data, durationMs)` — 性能(自动追加 `duration_ms` 字段)
  - `reportError(eventId, data, err)` — 错误(自动拆 `message` / `stack`,并 `console.error`)
  - `fireAlert(eventId, data)` — 预警(命中阈值时上报 + `console.warn`)
- **公共 base data**:`baseData(extra)` 会自动追加 `ts` / `app_version` / `page` 到所有事件
- **安全上报**:`safeReport` 包裹 `wx.reportEvent`,失败静默(`try/catch`);IDE 模拟器无 `reportEvent` 时降级到 `console.log`
- **始终上报**:不区分 dev / prod,所有环境都报

## 2. 事件清单(共 36 个)

命名规则:`分类.动作`,点号分层。

### 2.1 埋点 — 用户行为(13 个)

| eventId | 触发位置 | 关键 data 字段 |
|---|---|---|
| `page.view` | 各页面 `onShow` | `page` |
| `map.create.start` | `pages/create/create.js` step 3→4 | `location_type`, `tag_count` |
| `map.create.success` | `pages/create/create.js` 生成成功 | `duration_ms`, `poi_count`, `llm_used` |
| `map.create.fail` | `pages/create/create.js` 生成失败 | `duration_ms` |
| `map.share` | `pages/game/game.js` `onShareMap` 成功 | `map_id`, `source` |
| `map.import` | `pages/index/index.js` 导入成功 | `map_id`, `source` |
| `map.delete` | `pages/history/history.js` 删除确认 | `map_id`, `filter` |
| `game.start` | `pages/game/game.js` `_beginNewGame` | `map_id`, `grid_count`, `mode` |
| `game.checkin` | `pages/game/game.js` `_doCheckin` 成功 | `map_id`, `grid_index`, `poi_name`, `lap`, `has_chance_card` |
| `game.end` | `pages/game/game.js` 结算确认 | `map_id`, `total_dice_rolls`, `total_checkins`, `total_gold`, `total_distance`, `total_laps` |
| `profile.update` | *(未接入,预留)* | — |
| `permission.location.grant` | *(未接入,预留)* | — |
| `permission.location.deny` | *(未接入,预留)* | — |

### 2.2 性能(10 个)

所有性能事件都自动带 `duration_ms`(由 `trackPerf` 注入)。

| eventId | 触发位置 | 关键 data 字段 |
|---|---|---|
| `api.latency.poi` | `services/poiService.js` `fetchPOIsForMap` 结束 | `radius`, `num_queries`, `result_count` |
| `api.latency.llm` | `services/aiService.js` `generateMap` 结束 | `grid_count`, `poi_count`, `success` |
| `api.latency.amap.inputtips` | `pages/search/search.js` 搜索结束 | `query_len`, `result_count` |
| `api.latency.share.generate` | `services/shareService.js` `exportMap` 写盘成功 | `bytes` |
| `api.latency.distance` | `services/distanceService.js` 步行距离计算 | `source` (`amap` / `haversine_fallback`), `success` |
| `page.load` | `pages/game/game.js` `onReady`(后续可扩) | `page` |
| `poi.count.filtered` | `services/poiService.js` 每次 query 过滤后 | `before`, `after`, `filter_ratio`, `sortrule` |
| `llm.tokens` | `services/aiService.js` LLM 响应含 `usage` 时 | `prompt_tokens`, `completion_tokens`, `total_tokens`, `model` |
| `app.cold.start` | `app.js` `onLaunch` 末尾 | (无附加字段) |
| `app.warm.start` | `app.js` `onShow` 末尾 | (无附加字段) |

### 2.3 错误(8 个)

所有错误事件都自动带 `message` / `stack` 字段(由 `reportError` 从 `Error` 对象拆出)。

| eventId | 触发位置 | 关键 data 字段 |
|---|---|---|
| `error.global` | `app.js` `wx.onError` 全局同步异常 | (无附加字段) |
| `error.promise` | `app.js` `wx.onUnhandledRejection` Promise reject | (无附加字段) |
| `error.api.poi` | `services/poiService.js` 周边 POI 请求失败 | `stage` (`around_page` / `precheck`), `radius`, `types`, `sortrule` |
| `error.api.llm` | `services/aiService.js` LLM 请求失败 | `stage`, `duration_ms` |
| `error.api.amap` | `pages/search/search.js` `searchPoiByKeyword` 失败 | `stage` (`inputtips`) |
| `error.api.share` | `pages/game/game.js` / `services/shareService.js` 分享失败 | `stage` (`export_write` / `import_read`), `map_id` |
| `error.storage.quota` | *(未接入,预留)* | — |
| `error.parse` | `services/shareService.js` 导入 JSON 失败 | `stage` (`import_format` / `import_json`) |

### 2.4 预警(5 个)

阈值集中在 `ALERT_THRESHOLDS`,改阈值改一处即可。

| eventId | 触发位置 | 触发条件 | 关键 data 字段 |
|---|---|---|---|
| `alert.storage.usage` | `app.js` `checkStorageQuota` | 存储用量 > 80% | `percent`, `used_mb`, `limit_mb` |
| `alert.api.poi.timeout` | *(未接入,预留)* | POI 单次 > 5s | — |
| `alert.api.llm.timeout` | `services/aiService.js` | LLM 耗时 > 60s | `duration_ms`, `threshold_ms` |
| `alert.qps.limit` | `services/poiService.js` 撞 AMap CUQPS | 任何重试 | `attempt`, `radius`, `types` |
| `alert.poi.sparse` | `services/poiService.js` `fetchPOIsForMap` 结束 | 过滤后 POI 数 < 10 | `result_count`, `threshold`, `radius`, `tag_count` |

## 3. 阈值常量(`ALERT_THRESHOLDS`)

```js
STORAGE_USAGE_PERCENT: 0.8    // 存储用量 80%
POI_TIMEOUT_MS: 5000           // POI 单次 5s
LLM_TIMEOUT_MS: 60000          // LLM 单次 60s
POI_MIN_RESULT: 10             // 过滤后 POI 少于 10 视为稀疏
```

## 4. 接入示例

```js
const analytics = require('./services/analytics');

// 行为
analytics.trackEvent(analytics.EVENT.MAP_SHARE, { map_id: 'xxx', source: 'sidebar' });

// 性能
const t0 = Date.now();
const data = await fetchSomething();
analytics.trackPerf(analytics.EVENT.API_LATENCY_AMAP_INPUTTIPS, { result_count: 10 }, Date.now() - t0);

// 错误
try { ... } catch (err) {
  analytics.reportError(analytics.EVENT.ERROR_API_LLM, { stage: 'request' }, err);
}

// 预警
if (elapsed > analytics.ALERT_THRESHOLDS.LLM_TIMEOUT_MS) {
  analytics.fireAlert(analytics.EVENT.ALERT_API_LLM_TIMEOUT, { duration_ms: elapsed });
}
```

## 5. 注意事项

1. **新增事件**:先在 `services/analytics.js` 的 `EVENT` 常量里加 ID,再在本文档登记
2. **埋点自身失败必须静默**:`safeReport` 已处理,不要在调用方再包 try/catch
3. **路径识别**:`getCurrentPage()` 自动读 `getCurrentPages()`,无侵入
4. **不要在埋点里塞大对象**:data 字段会被序列化进上报 payload,控制体积

## 6. 覆盖矩阵

| 关注点 | 覆盖范围 | 缺口 / 后续 |
|---|---|---|
| 埋点 | 创建/分享/导入/删除/游戏开始/打卡/结束/页面浏览 | `profile.update` / `permission.location.*` 暂未接入(走 `wx.getSetting` 时再加) |
| 性能 | POI/LLM/AMap inputtips/分享导出/步行距离/页面加载/启动/Token/POI 过滤 | `api.latency.poi.timeout` 预警未接入(单次 POI 5s 用 try/catch 测过,目前由 `alert.api.poi.timeout` 占位) |
| 错误 | 全局同步/Promise/POI/LLM/AMap/分享/JSON 解析 | `error.storage.quota` 暂未接入(目前只 fire `alert.storage.usage`) |
| 预警 | 存储/QPS/POI 稀疏/LLM 超时 | — |
