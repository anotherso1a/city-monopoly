// 距离服务 —— 调高德 REST /v3/direction/walking 算两点之间的步行距离
//
// 为什么不直连前端 SDK:AMapWX 早期版本对 direction/walking 支持不稳,
// 走 REST 简单清晰,失败时调用方可以兜底 haversine
//
// API:https://restapi.amap.com/v3/direction/walking
// 必填:key, origin(lng,lat), destination(lng,lat)
// 返回:route.paths[0].distance — 米数
//
// 兜底:AMap 失败 / quota 满 / 超时 / 0 米(很近) → haversine 直线距离
// haversine 给出的是直线距离,真实步行路线会绕路,所以乘 1.3 系数估算步行距离

const { AMAP_KEY } = require('../config.local');
const request = require('../utils/request');
const analytics = require('./analytics');

const WALKING_URL = 'https://restapi.amap.com/v3/direction/walking';

// haversine 公式算两点间球面直线距离(米)
function haversineMeters(from, to) {
  const R = 6371000;  // 地球半径(米)
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) *
            Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * 计算两个经纬度点之间的步行导航距离(米)
 * 优先走 AMap REST,失败时降级到 haversine × 1.3 系数(步行绕路估算)
 * @param {{lng:number, lat:number}} from
 * @param {{lng:number, lat:number}} to
 * @returns {Promise<number|null>} 米数(始终返回有效值),坐标无效才返回 null
 */
async function fetchWalkingDistanceMeters(from, to) {
  if (!from || !to) return null;
  if (typeof from.lng !== 'number' || typeof from.lat !== 'number') return null;
  if (typeof to.lng !== 'number' || typeof to.lat !== 'number') return null;

  // 坐标完全一样 → 距离 0
  if (from.lng === to.lng && from.lat === to.lat) return 0;

  const t0 = Date.now();
  let usedFallback = false;

  // 第一步:AMap REST 拿精确步行距离
  try {
    const data = await request({
      url: WALKING_URL,
      method: 'GET',
      data: {
        key: AMAP_KEY,
        origin: `${from.lng},${from.lat}`,
        destination: `${to.lng},${to.lat}`,
        // 抄 SDK 抄出来的 platform 参数,部分高德账号必填
        platform: 'WXJS',
        appname: AMAP_KEY,
        sdkversion: '1.2.0',
        logversion: '2.0',
      },
      timeout: 15000,  // 步行路线规划通常 1-3s,15s 已很宽松
    });

    analytics.trackPerf(analytics.EVENT.API_LATENCY_DISTANCE, {
      source: 'amap',
      success: true,
    }, Date.now() - t0);

    if (data && data.status === '1') {
      const paths = data.route && data.route.paths;
      if (Array.isArray(paths) && paths.length > 0) {
        const meters = parseInt(paths[0].distance, 10);
        if (Number.isFinite(meters) && meters > 0) {
          return meters;  // 拿到有效值,直接返回
        }
      }
    }
    // 走到这里说明 AMap 没拿到值 → 降级
    usedFallback = true;
  } catch (err) {
    console.warn('[distance] walking API failed, fallback to haversine:', err);
    usedFallback = true;
  }

  // 第二步:haversine 兜底(直线距离 × 1.3 估算步行绕路)
  const straight = haversineMeters(from, to);
  const fallback = Math.round(straight * 1.3);
  if (usedFallback) {
    analytics.trackPerf(analytics.EVENT.API_LATENCY_DISTANCE, {
      source: 'haversine_fallback',
      success: true,
    }, Date.now() - t0);
  }
  return fallback;
}

module.exports = { fetchWalkingDistanceMeters, haversineMeters };
