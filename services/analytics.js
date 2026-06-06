// services/analytics.js
// 微信埋点服务 —— 包装 wx.reportEvent(eventId, data)
// 4 类关注点:事件(行为) / 性能 / 错误 / 预警
// 调用方:trackEvent / trackPerf / reportError / fireAlert
// 4 个函数都用 safeReport 包一层,埋点自身失败不影响主流程

// 事件 ID 集中常量 —— 防止散落各文件拼错
// 命名:分类.动作,点号分层
const EVENT = {
  // 1. 埋点(用户行为)
  PAGE_VIEW: 'page.view',
  MAP_CREATE_START: 'map.create.start',
  MAP_CREATE_SUCCESS: 'map.create.success',
  MAP_CREATE_FAIL: 'map.create.fail',
  MAP_SHARE: 'map.share',
  MAP_IMPORT: 'map.import',
  MAP_DELETE: 'map.delete',
  GAME_START: 'game.start',
  GAME_CHECKIN: 'game.checkin',
  GAME_END: 'game.end',
  PROFILE_UPDATE: 'profile.update',
  PERMISSION_LOCATION_GRANT: 'permission.location.grant',
  PERMISSION_LOCATION_DENY: 'permission.location.deny',

  // 2. 性能
  API_LATENCY_POI: 'api.latency.poi',
  API_LATENCY_LLM: 'api.latency.llm',
  API_LATENCY_AMAP_INPUTTIPS: 'api.latency.amap.inputtips',
  API_LATENCY_SHARE_GENERATE: 'api.latency.share.generate',
  API_LATENCY_DISTANCE: 'api.latency.distance',
  PAGE_LOAD: 'page.load',
  POI_COUNT_FILTERED: 'poi.count.filtered',
  LLM_TOKENS: 'llm.tokens',
  APP_COLD_START: 'app.cold.start',
  APP_WARM_START: 'app.warm.start',

  // 3. 错误
  ERROR_GLOBAL: 'error.global',
  ERROR_PROMISE: 'error.promise',
  ERROR_API_POI: 'error.api.poi',
  ERROR_API_LLM: 'error.api.llm',
  ERROR_API_AMAP: 'error.api.amap',
  ERROR_API_SHARE: 'error.api.share',
  ERROR_STORAGE_QUOTA: 'error.storage.quota',
  ERROR_PARSE: 'error.parse',

  // 4. 预警阈值类
  ALERT_STORAGE_USAGE: 'alert.storage.usage',
  ALERT_API_POI_TIMEOUT: 'alert.api.poi.timeout',
  ALERT_API_LLM_TIMEOUT: 'alert.api.llm.timeout',
  ALERT_QPS_LIMIT: 'alert.qps.limit',
  ALERT_POI_SPARSE: 'alert.poi.sparse',
};

// 预警阈值(集中,避免散落)
const ALERT_THRESHOLDS = {
  STORAGE_USAGE_PERCENT: 0.8,   // 本地存储用量
  POI_TIMEOUT_MS: 5000,          // POI 单次超过 5s
  LLM_TIMEOUT_MS: 60000,         // LLM 单次超过 60s
  POI_MIN_RESULT: 10,            // 过滤后 POI 少于 10 视为稀疏
};

// 安全上报 —— 埋点自身失败必须静默,不能让 try/catch 之外的代码挂掉
const safeReport = (eventId, data) => {
  try {
    if (typeof wx !== 'undefined' && typeof wx.reportEvent === 'function') {
      wx.reportEvent(eventId, data);
    } else {
      // IDE 模拟器没有 reportEvent,降级到 console
      console.log(`[analytics] ${eventId}`, data);
    }
  } catch (e) {
    console.warn(`[analytics] report failed: ${eventId}`, e && e.message);
  }
};

// 当前页面 route —— 拼到 baseData 里,做漏斗/路径分析用
const getCurrentPage = () => {
  try {
    const pages = getCurrentPages();
    if (!pages || pages.length === 0) return 'unknown';
    return pages[pages.length - 1].route || 'unknown';
  } catch {
    return 'unknown';
  }
};

const getAppVersion = () => {
  try {
    return (__wxConfig && __wxConfig.version) || 'unknown';
  } catch {
    return 'unknown';
  }
};

// 公共 base data —— 每个事件自动追加
const baseData = (extra) => ({
  ts: Date.now(),
  app_version: getAppVersion(),
  page: getCurrentPage(),
  ...(extra || {}),
});

// 1. 事件(用户行为)
const trackEvent = (eventId, data) => {
  safeReport(eventId, baseData(data));
};

// 2. 性能 —— 调用方传 durationMs,内部加到 data 里
const trackPerf = (eventId, data, durationMs) => {
  safeReport(eventId, baseData({ ...(data || {}), duration_ms: durationMs }));
};

// 3. 错误 —— 接受 Error 对象,自动拆 message/stack
//    同时 console.error 方便开发期排查
const reportError = (eventId, data, err) => {
  const errData = {
    ...(data || {}),
    message: (err && err.message) || String(err),
    stack: err && err.stack,
  };
  safeReport(eventId, baseData(errData));
  console.error(`[analytics] ${eventId}`, errData);
};

// 4. 预警 —— 命中阈值时上报
//    同时 console.warn 方便 dev 看到
const fireAlert = (eventId, data) => {
  safeReport(eventId, baseData(data));
  console.warn(`[analytics] ${eventId}`, data);
};

// 性能计时 helper —— 用法 startTimer() → ... → endTimer(t0)
const startTimer = () => Date.now();
const endTimer = (t0) => Date.now() - t0;

module.exports = {
  EVENT,
  ALERT_THRESHOLDS,
  trackEvent,
  trackPerf,
  reportError,
  fireAlert,
  startTimer,
  endTimer,
};
