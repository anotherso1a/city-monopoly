// log-entry 组件
// 时间轴上的单个节点。父组件传入 currentGame 事件对应的展示字段，组件负责渲染。
// 数据契约见 log-entry.wxss 顶部注释。

// POI 类型 → icon 映射 —— 优先用 iconfont 里语义最贴近的图标
// 命中失败回退 icon-location(由 _resolveIconClass 兜底)
// 覆盖 logs.js 当前会用到的所有 POI type 名 + game.js info card 的旧 type
// (新接入 POI 时如果新增了 type,在表里加一行即可,无需改组件)
const POI_TYPE_ICON_MAP = {
  // —— 历史/通用大类(对应 game.js _getIconForPoi 的旧 type) ——
  '历史区': 'icon-home',
  '集市': 'icon-shop',
  '桥梁': 'icon-bank',
  '广场': 'icon-location',
  '摩天楼': 'icon-bangonglou',
  '教堂': 'icon-jiaotang',
  '街区': 'icon-city',
  '车站': 'icon-road_sign',

  // —— 餐饮 ——
  '中餐厅':   'icon-rest',
  '外国餐厅': 'icon-rest',
  '快餐厅':   'icon-rest',
  '咖啡厅':   'icon-Coffee-1',
  '茶艺馆':   'icon-Coffee-1',
  '冷饮店':   'icon-Icecream',
  '糕饼店':   'icon-Icecream',
  '甜品店':   'icon-Icecream',

  // —— 购物 ——
  '商场':           'icon-shop',
  '便利店':         'icon-shop',
  '超级市场':       'icon-shop',
  '体育用品店':     'icon-foot',
  '特色商业街':     'icon-city',
  '服装鞋帽皮具店': 'icon-city',
  '专卖店':         'icon-shop',

  // —— 生活服务 ——
  '邮局':         'icon-home',
  '电讯营业厅':   'icon-bulb',
  '摄影冲印店':   'icon-camera',
  '彩票销售点':   'icon-Dollar',

  // —— 体育休闲 ——
  '运动场馆':   'icon-foot',
  '高尔夫相关': 'icon-foot',
  '娱乐场所':   'icon-Cocktail-1',
  '休闲场所':   'icon-Cocktail-1',
  '影剧院':     'icon-image',

  // —— 住宿 ——
  '宾馆酒店': 'icon-rest',

  // —— 风景名胜 ——
  '公园广场':   'icon-park',
  '风景名胜':   'icon-park',
  '公园':       'icon-park',

  // —— 科教文化 ——
  '博物馆':   'icon-bowuguan',
  '展览馆':   'icon-zhanguan',
  '会展中心': 'icon-zhanguan',
  '美术馆':   'icon-image',
  '图书馆':   'icon-book',
  '科技馆':   'icon-bulb',
  '天文馆':   'icon-bulb',
  '文化宫':   'icon-zhanguan',
};

const resolveIconClass = (poiType) => POI_TYPE_ICON_MAP[poiType] || 'icon-location';

Component({
  options: {
    // 让 app.wxss 的 .iconfont 全局工具类透进来
    styleIsolation: 'apply-shared',
  },
  properties: {
    time: { type: String, value: '' },
    location: { type: String, value: '' },
    poiType: { type: String, value: '' },  // POI 类型名(决定 location icon)
    image: { type: String, value: '' },
    caption: { type: String, value: '' },
    badge: { type: String, value: '' },
    xp: { type: String, value: '' },
    index: { type: Number, value: 0 },
    isChanceCard: { type: Boolean, value: false },
  },
  data: {
    iconClass: 'icon-location',  // 兜底,observer 收到 poiType 时会重算
  },
  observers: {
    'poiType': function (poiType) {
      this.setData({ iconClass: resolveIconClass(poiType) });
    },
  },
});

