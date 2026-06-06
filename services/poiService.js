// POI 数据转换服务 - 处理高德地图 SDK 返回的 POI 数据
// 提供 POI 类型分类和数据转换功能

const { AMapWX } = require('../utils/lib/amap-wx.130');  // 引入高德地图微信 SDK
const { AMAP_KEY } = require('../config.local');          // 高德 key(本地配置,.gitignore)
const request = require('../utils/request');              // 通用 wx.request 包装
const { splitTagsByTier, EXCLUDED_FROM_EXPLORATION } = require('./poiCategories');  // tag ids → { bigTypeCodes, smallGroups }
const analytics = require('./analytics');                  // 埋点服务
// 注:AMapWX 仅用于 searchPoiByKeyword(inputtips),fetchPOIsForMap 改走 REST(SDK 不支持 offset/page)

// AMap REST /v3/place/around 端点 — SDK 的 getPoiAround 不传 offset/page,单次最多 20
// 累计方案:tier-based —— 大类(餐饮)按 type 单独请求,小类整组合并(详见 fetchPOIsForMap)
const AMap_AROUND_URL = 'https://restapi.amap.com/v3/place/around';

// POI 累计方案的常量
// 目标:用户的 radius 唯一,每个 tag 都被请求到,产出合理分布
const TARGET_POI_COUNT = 50;          // 软目标 —— 用于计算每个查询的上限
const PAGE_SIZE = 25;                 // 单页大小
const DEFAULT_RADIUS = 1000;          // 用户未指定 radius 时的默认值(米)
const MIN_PER_QUERY_CAP = 5;          // 每个查询的下限 —— 防止 N 太大时切得太碎

// AMap 限流控制 —— 个人 key 默认 QPS 3-5
// 新算法一次最多 ~15 个请求(8 big + 7 small),200ms 间隔下稳定 ~5 QPS 之内
// 保留退避重试作为防御
const REQUEST_DELAY_MS = 200;         // 每次请求前 sleep,匀速
const QPS_RETRY_MAX = 3;              // 撞 CUQPS 最多重试次数
const QPS_RETRY_BASE_MS = 800;        // 退避基数(第 1 次等 800ms,第 2 次 1600ms,第 3 次 2400ms)
const AMap_QPS_LIMIT_CODE = 'CUQPS_HAS_EXCEEDED_THE_LIMIT';

// 不适合"城市大富翁"玩法的 POI 名称模式 —— 兜底过滤(POI 名称里包含这些词就剔除)
// 兜底原因:类别过滤可能漏掉子类的某些奇葩条目(如"工服公司" typecode 061210 在 061200 旗下)
// 用户可以在这里追加更多黑名单
// 注:彩票(071800)已加回 POI_CATEGORIES,所以从黑名单里移除
const UNINTERESTING_NAME_PATTERNS = [
  /专卖/,         // 烟酒专卖/自行车专卖/电动车专卖/宠物专卖...
  /工服/,         // 工厂服饰
  /服饰$/,        // 以"服饰"结尾的工厂店
  /电动车/,       // 爱玛/雅迪 等
  /自行车/,
  /烟酒/,
  /美容|美发|皮肤|美甲/,  // 美容美发店
  /宠物/,
  /服装/,         // 服装店
  /营业厅$/,      // 中国移动/电信/联通 营业厅
  /诊所|医院|药房/,  // 医疗(理论上已经被大类过滤,兜底)
  /棋牌/,         // 棋牌室(用户反馈:citywalk 不想进)
  /茶室/,         // 茶室(注意:茶艺馆 050600 已按 typecode 剔除,这里是 080500 休闲场所下的茶室)
  /网咖|网吧/,    // 网吧/网咖
  /委会/,         // 居委会/村委会/管委会/党委会 等(用户用 x委会 表述)
];

// 用一个 typecode 前 4 位 + name pattern 双重过滤掉"不适合探索的 POI"
// 防御性:即便 AMap 返回的 typecode 在 EXCLUDED_FROM_EXPLORATION 内,或者名称命中黑名单
// 都被过滤掉
const filterUninterestingPOIs = (pois) => {
  if (!Array.isArray(pois) || pois.length === 0) return pois || [];
  return pois.filter((poi) => {
    const tc = (poi.typecode || '').slice(0, 6);  // AMap 中类前 4 位
    if (EXCLUDED_FROM_EXPLORATION.has(tc)) return false;
    const name = poi.name || '';
    if (UNINTERESTING_NAME_PATTERNS.some((re) => re.test(name))) return false;
    return true;
  });
};

// sleep helper —— 用 setTimeout 即可(小程序环境没有 setTimeout 异步版)
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// 单页拉取 —— 失败返回 null(静默,不抛错;由外层循环处理重试/终止)
// 撞 AMap CUQPS 限流时自动退避重试(等 800/1600/2400ms 指数递增)
async function fetchOneAroundPage({ location, radius, page, types, sortrule }) {
  // 每次请求前匀速,避免短时间突发
  await sleep(REQUEST_DELAY_MS);

  for (let attempt = 0; attempt <= QPS_RETRY_MAX; attempt++) {
    try {
      const data = await request({
        url: AMap_AROUND_URL,
        method: 'GET',
        data: {
          key: AMAP_KEY,
          location,
          radius,
          offset: PAGE_SIZE,
          page,
          types,
          sortrule,
          s: 'rsx',
          platform: 'WXJS',
          appname: AMAP_KEY,
          sdkversion: '1.2.0',
          logversion: '2.0',
        },
        timeout: 15000,
      });

      // AMap 业务成功 → 直接返回
      if (data && data.status === '1') return data;

      // 撞 CUQPS 限流 → 退避后重试
      if (data && data.infocode === AMap_QPS_LIMIT_CODE && attempt < QPS_RETRY_MAX) {
        const wait = QPS_RETRY_BASE_MS * (attempt + 1);
        console.warn(`[poiService] QPS limit hit (attempt ${attempt + 1}), retry in ${wait}ms`);
        analytics.fireAlert(analytics.EVENT.ALERT_QPS_LIMIT, {
          attempt: attempt + 1,
          radius,
          types,
        });
        await sleep(wait);
        continue;
      }

      // 其它业务错误(quota 用尽 / 参数错 / key 无效)→ 不重试,直接返回
      return data;
    } catch (err) {
      console.warn(`[poiService] around page failed (r=${radius}, page=${page}, sort=${sortrule}):`, err);
      analytics.reportError(analytics.EVENT.ERROR_API_POI, {
        stage: 'around_page',
        radius,
        types,
        sortrule,
      }, err);
      return null;
    }
  }
  return null;  // 兜底:重试耗尽
}

// 直连 AMap REST 获取周边 POI(tier-based,固定 radius)
// 算法:
//   ① 把 tag 按 tier 拆成两组:
//     big(餐饮)   —— 按 sub-type 单独请求,sortrule=weight 拿热门
//     small(其他) —— 整组合并请求(types=code1|code2|...),sortrule=distance 走周边
//   ② 用户的 radius 就是唯一查询半径 —— 不再阶梯式扩展
//     (AMap 2000m 查询已包含 1000m 的,阶梯扩展会重复)
//   ③ 用 perQueryCap 给每个查询硬上限,保证所有 tag 都能贡献 POI
//     (用 TARGET 早停会导致前面的 tag 把目标填满,后排 tag 永远轮不到)
//   ④ 用 AMap 的 count 字段判断"此查询是否有数据",count===0 就直接跳过
//
// 为什么不一律 per-tag 请求:小类合并后 AMap 自然返回混合结果,翻一遍
// distance 排序就能拿到"从中心向周边走"的多样化清单,不必为每 sub-type 各打一次
// 为什么不一律合并:餐饮 9 个 sub-type 都热门,合并会被主导类型(通常 050100 中餐厅)吞满
//
// 参数: params.location - 中心点经纬度 (lng,lat 字符串)
//       params.radius   - 用户选定的搜索半径(米),默认 DEFAULT_RADIUS
//       params.tags     - 用户选中的 tag id 数组,决定查哪些中类
// 返回: Promise,POI 对象数组(每个 POI 附 _distanceBucket: 'near' | 'medium' | 'far')
//       长度可能 < TARGET(AMap 真没那么多数据时就拿到的全部)
const fetchPOIsForMap = async (params) => {
  const { location, radius, tags } = params;
  // 尊重用户选定的 radius —— 不强制阶梯
  const queryRadius = radius || DEFAULT_RADIUS;
  const t0 = Date.now();

  // 拆 tier
  const { bigTypeCodes, smallGroups } = splitTagsByTier(tags);

  // 每个查询的硬上限 ——
  // 不再用 TARGET 早停,改用 numQueries 平均切,确保每个 tag 都贡献
  const numQueries = bigTypeCodes.length + smallGroups.length;
  const perQueryCap = Math.max(
    MIN_PER_QUERY_CAP,
    Math.ceil(TARGET_POI_COUNT / Math.max(numQueries, 1))
  );

  // 解析中心点
  const [centerLng, centerLat] = (location || '0,0').split(',').map(parseFloat);

  // 已见 POI id 去重
  const seenIds = new Set();
  // 累计过滤后的 POI
  const allFiltered = [];

  // 单次查询:固定 radius 拉第 1 页,过滤后塞入累计数组
  // cap 可选,默认 perQueryCap;小类里有特殊需求(如 lottery cap:1)的 tag 可覆盖
  const fetchOne = async ({ types, sortrule, cap }) => {
    const effectiveCap = cap || perQueryCap;

    const data = await fetchOneAroundPage({
      location,
      radius: queryRadius,
      page: 1,
      types,
      sortrule,
    });
    if (!data || data.status !== '1') return;

    // AMap count 字段:此 query 下能返回的 POI 总数(独立于分页)
    // count === 0 → AMap 说没数据,直接跳过
    const totalAtRadius = parseInt(data.count, 10) || 0;
    if (totalAtRadius === 0) return;

    const fetched = (data.pois || []).map(transformPOI);
    // 去重(全 seenIds 比对)
    const newRaw = fetched.filter((p) => p.id && !seenIds.has(p.id));
    newRaw.forEach((p) => seenIds.add(p.id));

    // 黑名单过滤(类别 + 名称)
    const filtered = filterUninterestingPOIs(newRaw);
    // 埋点: 过滤比例(黑名单 + 名称模式)
    if (newRaw.length > 0) {
      analytics.trackEvent(analytics.EVENT.POI_COUNT_FILTERED, {
        before: newRaw.length,
        after: filtered.length,
        filter_ratio: +(filtered.length / newRaw.length).toFixed(3),
        sortrule,
      });
    }

    // 按 effectiveCap 截断
    const toAdd = filtered.slice(0, effectiveCap);
    allFiltered.push(...toAdd);
  };

  // Loop 1: 大类(餐饮)—— 按 sub-type 单独请求,sortrule=weight
  for (const typeCode of bigTypeCodes) {
    await fetchOne({ types: typeCode, sortrule: 'weight' });
  }

  // Loop 2: 小类(其他)—— 整组合并请求,sortrule=distance
  // 透传 group.cap(若设置)以覆盖默认 perQueryCap —— 用于 lottery 这类"想保留但不想多"的 tag
  for (const group of smallGroups) {
    await fetchOne({
      types: group.codes.join('|'),
      sortrule: 'distance',
      cap: group.cap,
    });
  }

  // 计算每个 POI 到中心点的平方差,排序后均分 3 段打 bucket
  allFiltered.forEach((p) => {
    const dLat = p.location.lat - centerLat;
    const dLng = p.location.lng - centerLng;
    p._distSq = dLat * dLat + dLng * dLng;
  });
  allFiltered.sort((a, b) => a._distSq - b._distSq);

  const total = allFiltered.length;
  const nearEnd = Math.ceil(total / 3);
  const mediumEnd = Math.ceil((total * 2) / 3);
  allFiltered.forEach((p, i) => {
    p._distanceBucket = i < nearEnd ? 'near' : i < mediumEnd ? 'medium' : 'far';
  });

  // —— 埋点:整体耗时 + 过滤比例 + 稀疏预警
  analytics.trackPerf(analytics.EVENT.API_LATENCY_POI, {
    radius: queryRadius,
    num_queries: numQueries,
    result_count: total,
  }, Date.now() - t0);
  // 过滤比例 (filtered / fetched),fetched 包含被黑名单剔除的
  // 这里用 final/total 反推意义不大(我们已 uniq 累计),改报"过滤前后 = 1.0" 已在 create.js 报告
  // 稀疏预警: 过滤后 POI 少于阈值(可能用户选的范围/标签组合太冷门)
  if (total < analytics.ALERT_THRESHOLDS.POI_MIN_RESULT) {
    analytics.fireAlert(analytics.EVENT.ALERT_POI_SPARSE, {
      result_count: total,
      threshold: analytics.ALERT_THRESHOLDS.POI_MIN_RESULT,
      radius: queryRadius,
      tag_count: (tags || []).length,
    });
  }

  return allFiltered;
};

// 将高德 SDK 返回的 POI 数据转换为项目内部标准格式
// 参数：poi - 高德 SDK 返回的原始 POI 对象
// 返回：标准化的 POI 对象
const transformPOI = (poi) => {
  return {
    id: poi.id || '',  // AMap POI id,给 LLM 关联回填用
    name: poi.name || '',  // POI 名称
    address: poi.address || '',  // 地址
    type: poi.type || '',  // 类型名称
    typecode: poi.typecode || '',  // 类型代码
    location: parseLocation(poi.location),  // 经纬度 —— AMap REST 返回 "lng,lat" 字符串,parseLocation 兼容
    tel: poi.tel || '',  // 电话
    photos: (poi.photos || []).map(p => p.url).filter(Boolean),  // AMap 返回的照片 URL 数组
  };
};

// 解析高德返回的 location 字段, 兼容两种格式:
//   - 字符串 "lng,lat"  (inputtips API 默认)
//   - 对象 {lng, lat}    (部分 SDK 预处理过 / inputtips 实际响应)
// 任一维度缺失或无法解析都返回 0, 不抛错
const parseLocation = (loc) => {
  if (loc == null) return { lat: 0, lng: 0 };
  if (typeof loc === 'string') {
    const parts = loc.split(',');
    return {
      lng: parseFloat(parts[0]) || 0,
      lat: parseFloat(parts[1]) || 0
    };
  }
  if (typeof loc === 'object') {
    return {
      lng: parseFloat(loc.lng ?? loc.longitude) || 0,
      lat: parseFloat(loc.lat ?? loc.latitude) || 0
    };
  }
  return { lat: 0, lng: 0 };
};

// 将高德 inputtips 返回的 tip 数据转换为标准候选格式
// tip 结构与 POI 类似, 但有 district / cityname 字段, 用作搜索结果列表
const transformTip = (tip) => ({
  id: tip.id || `${tip.name}-${tip.address}`,
  name: tip.name || '',
  address: tip.address || '',
  district: tip.district || '',
  type: tip.type || '',
  typecode: tip.typecode || '',
  location: parseLocation(tip.location)
});

// 关键词搜索 (高德 inputtips)
// 参数: keyword - 搜索关键词
//       options.location - 可选, 中心点 "lng,lat" 用于就近排序
//       options.city - 可选, 限定城市
// 返回: Promise, 候选 POI 数组
const searchPoiByKeyword = (keyword, options = {}) => {
  if (!keyword || !keyword.trim()) {
    return Promise.resolve([]);
  }
  return new Promise((resolve, reject) => {
    const amapwx = new AMapWX({ key: AMAP_KEY });
    amapwx.getInputtips({
      keywords: keyword.trim(),
      location: options.location || '',
      city: options.city || '',
      success: (res) => {
        const tips = (res && res.tips) || [];
        resolve(tips.map(transformTip));
      },
      fail: (err) => {
        console.error('Amap getInputtips failed:', err);
        reject(err);
      }
    });
  });
};

// 根据格子数量均匀分配 POI
// 确保不同类型的 POI 均匀分布在格子中
// 参数：pois - POI 对象数组
//       gridCount - 格子总数
// 返回：分配后的 POI 数组（数量 <= gridCount）
const filterPOIsByGridCount = (pois, gridCount) => {
  if (!pois || pois.length === 0) {  // 空数据检查
    return [];
  }

  if (pois.length <= gridCount) {  // POI 数量足够，直接返回
    return pois;
  }

  // 按类型分组
  const groupedByType = {};
  pois.forEach(poi => {
    const typeKey = poi.typecode || 'OTHER';  // 用类型代码作为键
    if (!groupedByType[typeKey]) {  // 该类型还未创建分组
      groupedByType[typeKey] = [];
    }
    groupedByType[typeKey].push(poi);  // 加入对应分组
  });

  // 从每个类型中均匀抽取 POI
  const result = [];
  const typeKeys = Object.keys(groupedByType);  // 所有类型键
  const poisPerType = Math.ceil(gridCount / typeKeys.length);  // 每类型应抽数量

  typeKeys.forEach(typeKey => {
    const typePois = groupedByType[typeKey];  // 该类型的 POI 列表
    const selectedPois = typePois.slice(0, poisPerType);  // 最多取 poisPerType 个
    result.push(...selectedPois);  // 合并到结果
  });

  return result.slice(0, gridCount);  // 截取到格子数量
};

module.exports = {
  fetchPOIsForMap,     // 获取周边 POI
  searchPoiByKeyword,  // 关键词搜索 POI
  filterPOIsByGridCount,  // 按数量过滤 POI
  filterUninterestingPOIs,  // 名称+类型黑名单过滤(测试 / 外部调用)
  transformPOI,        // 转换 POI 格式
  transformTip         // 转换 inputtips tip 格式
};