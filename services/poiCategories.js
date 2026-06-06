// services/poiCategories.js
// 适合"城市大富翁"玩法的 AMap POI 中类(mid category)列表
// AMap 中类编码:前 4 位 + "00"(如 050100 = 中餐厅)
// 用中类粒度而非大类,避免大类(如"生活服务")把律师事务所/搬家公司也带进来
// 排除:汽车/医疗/政府/交通/金融/公司/住宅 等"不是游览目的地"的类目
// 来源:高德POI分类与编码(中英文)V1.06 20230208

const POI_CATEGORIES = {
  // 餐饮 (050000) — 进店吃喝,机会卡自然(被坑/打折/老板送)
  '050100': '中餐厅',
  '050200': '外国餐厅',
  '050300': '快餐厅',
  '050500': '咖啡厅',
  // '050600': '茶艺馆' —— 实际多为棋牌茶室,跟 citywalk 无关
  '050700': '冷饮店',
  '050800': '糕饼店',
  '050900': '甜品店',

  // 购物 (060000) — 只保留"目的地型"商场/超市/特色街
  // 服装/专卖/宠物/烟酒/电动车 等都进 EXCLUDED_FROM_EXPLORATION
  '060100': '商场',
  '060200': '便利店',
  '060400': '超级市场',
  '060900': '体育用品店',
  '061000': '特色商业街',

  // 彩票 (071800) — 反倒有点意思,作为 citywalk 的"小确幸"
  '071800': '彩票销售点',

  // 体育休闲 (080000) — 运动/娱乐/影院
  '080100': '运动场馆',
  '080200': '高尔夫相关',
  '080300': '娱乐场所',
  '080500': '休闲场所',
  '080600': '影剧院',

  // 住宿 (100000) — 全部剔除,跟 citywalk 无关
  // '100100': '宾馆酒店',

  // 风景名胜 (110000) — 公园/景区
  '110100': '公园广场',
  '110200': '风景名胜',

  // 科教文化 (140000) — 博物馆/展览/图书馆 等
  '140100': '博物馆',
  '140200': '展览馆',
  '140300': '会展中心',
  '140400': '美术馆',
  '140500': '图书馆',
  '140600': '科技馆',
  '140700': '天文馆',
  '140800': '文化宫',
};

// 显式排除的中类 —— 这些"目的地"不够有趣,不该出现在城市大富翁里
// 典型用户反馈:电动车专卖店、工厂服饰、烟酒专卖店、宠物用品店 等
// 注:彩票销售点(071800)原先在这里,后挪到 POI_CATEGORIES 里(用户反馈"反倒有点意思")
// 用 Set 便于 O(1) 查询
const EXCLUDED_FROM_EXPLORATION = new Set([
  '061100',  // 服装鞋帽皮具店
  '061200',  // 专卖店(包含烟酒/自行车/电动车/宠物/工服 等子类)
  '070400',  // 邮局
  '070600',  // 电讯营业厅
  '071300',  // 摄影冲印店
]);

// 把中类二次归并成 N 个用户友好的 tag ——
// create 页面 step 2 用 tag 让用户勾选偏好,然后按选中的 tag 决定查哪些中类
// id: WXML data-id 用
// name: UI 展示名(简洁口语化)
// codes: 这个 tag 包含的 AMap 中类编码(对应上方 POI_CATEGORIES 的 key)
// tier: 取值 'big' | 'small'
//   big   → per-type 请求(每个 sub-type 单独打 AMap),sortrule=weight
//           原因:sub-type 多且热门,合并请求会被主导 sub-type 填满
//           典型:餐饮(9 个 sub-type 都热门)
//   small → 整组合并为 1 个请求,sortrule=distance
//           原因:sub-type 少或冷门,合并请求 AMap 自然混合返回,且 POI 数有限不需要 cap 多样性
//           距离排序符合"从中心点向周边走"的城市漫步场景
// cap: 可选,该 tag 一次查询的硬上限(覆盖默认 perQueryCap)
//      用于"想保留但不想多"的 tag —— 例如 lottery cap:1 表示 1 张地图最多 1 个彩票店
const POI_TAG_GROUPS = [
  { id: 'food_dine',   name: '餐厅',     codes: ['050100', '050200', '050300'],                                   tier: 'big' },
  { id: 'food_drink',  name: '茶饮甜品', codes: ['050500', '050700', '050800', '050900'],                          tier: 'big' },
  { id: 'shop_mall',   name: '商超',     codes: ['060100', '060200', '060400'],                                   tier: 'small' },
  { id: 'shop_other',  name: '逛街购物', codes: ['060900', '061000'],                                             tier: 'small' },
  { id: 'lottery',     name: '彩票',     codes: ['071800'],                                  cap: 1,                   tier: 'small' },
  { id: 'sport',       name: '运动健身', codes: ['080100', '080200'],                                             tier: 'small' },
  { id: 'entertainment', name: '娱乐休闲', codes: ['080300', '080500', '080600'],                                  tier: 'small' },
  { id: 'culture',     name: '文化科教', codes: ['140100', '140200', '140300', '140400', '140500', '140600', '140700', '140800'], tier: 'small' },
  { id: 'scenic',      name: '风景名胜', codes: ['110100', '110200'],                                             tier: 'small' },
];

// 按 id 索引,方便按 tag id 查 codes
const POI_TAG_GROUPS_BY_ID = POI_TAG_GROUPS.reduce((acc, t) => {
  acc[t.id] = t;
  return acc;
}, {});

// 把 tag id 数组 → AMap types 字符串(管道分隔)
// 用于 fetchPOIsForMap 拼接 types 参数
// 自动剔除 EXCLUDED_FROM_EXPLORATION 里的中类,即便 tag 列表里包含了也过滤掉(防御性)
const buildTypesFromTags = (tagIds) => {
  const allCodes = !tagIds || tagIds.length === 0
    ? Object.keys(POI_CATEGORIES)
    : tagIds
        .map(id => (POI_TAG_GROUPS_BY_ID[id] || {}).codes || [])
        .flat();
  const filtered = allCodes.filter(c => !EXCLUDED_FROM_EXPLORATION.has(c));
  return filtered.length > 0 ? filtered.join('|') : Object.keys(POI_CATEGORIES).join('|');
};

// 把 tag ids 拆成两类(供 fetchPOIsForMap 走不同策略):
//   bigTypeCodes: 大类(餐饮)的 sub-type 列表,fetch 时按 type 单独请求
//   smallGroups:  小类(其他)按 tag 分组,fetch 时整组合并请求
// 自动剔除 EXCLUDED_FROM_EXPLORATION 里的中类
// tagIds 空数组 = 用全部 tag
const splitTagsByTier = (tagIds) => {
  const effectiveTagIds = !tagIds || tagIds.length === 0
    ? POI_TAG_GROUPS.map((t) => t.id)
    : tagIds;

  const bigTypeCodes = [];
  const smallGroups = [];

  for (const tagId of effectiveTagIds) {
    const tag = POI_TAG_GROUPS_BY_ID[tagId];
    if (!tag) continue;
    const validCodes = (tag.codes || []).filter((c) => !EXCLUDED_FROM_EXPLORATION.has(c));
    if (validCodes.length === 0) continue;
    if (tag.tier === 'big') {
      bigTypeCodes.push(...validCodes);
    } else {
      smallGroups.push({ name: tag.id, codes: validCodes });
    }
  }

  return { bigTypeCodes, smallGroups };
};

module.exports = {
  POI_CATEGORIES,           // 中类编码 → 中文名
  POI_TAG_GROUPS,           // UI 列表
  POI_TAG_GROUPS_BY_ID,     // 快速查找
  EXCLUDED_FROM_EXPLORATION,// 显式排除的中类集合
  buildTypesFromTags,       // tag ids → AMap types 串
  splitTagsByTier,          // tag ids → { bigTypeCodes, smallGroups }
};
