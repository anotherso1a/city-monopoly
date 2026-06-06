// 游戏结束页
// 两种渲染来源:
//   1) 带 mapId - 加载 storage 里的 currentGame (status === 'completed'),
//      拉取 engine.getStatistics() / getTimeline() 渲染真实数据
//   2) 不带 mapId - 保留 query 参数 (rank/coins/...) 的演示数据路径, 便于设计稿预览

const { getMap } = require('../../utils/storage');
const { GameEngine } = require('../../services/gameEngine');
const analytics = require('../../services/analytics');

// POI 类型到节点视觉的映射
const POI_TONE_BY_TYPE = {
  '商务写字楼': 'secondary',
  '住宅小区': 'tertiary',
  '餐饮相关': 'primary',
  '中餐厅': 'primary',
  '日本料理': 'primary',
  '五星级宾馆': 'secondary',
  '糕饼店': 'primary',
  '邮政速递': 'tertiary',
  '火锅店': 'primary',
  '中式素菜馆': 'primary',
  '生活服务场所': 'tertiary',
};

const POI_ICON_BY_TYPE = {
  '住宅小区': 'icon-heart',
  '商务写字楼': 'icon-location',
  '五星级宾馆': 'icon-location',
  '生活服务场所': 'icon-bulb',
};

function defaultIconForGrid(grid) {
  // 永远是 POI,不再需要 type 守卫
  if (!grid) return 'icon-location';
  return POI_ICON_BY_TYPE[grid.poi && grid.poi.type] || 'icon-location';
}

function toneForGrid(grid, fallbackIndex) {
  // 永远是 POI,不再需要 type 守卫
  if (!grid) return 'primary';
  return POI_TONE_BY_TYPE[grid.poi && grid.poi.type] || ['tertiary', 'secondary', 'primary'][fallbackIndex % 3];
}

const DEMO_ROUTE_NODES = [
  { id: 1, label: 'WANGJING',    score: '+25', icon: 'icon-location', tone: 'tertiary' },
  { id: 2, label: 'GREEN PLAZA', score: '+40', icon: 'icon-heart',    tone: 'secondary' },
  { id: 3, label: 'RESTAURANT',  score: '+15', icon: 'icon-shop',     tone: 'primary' },
];

Page({
  data: {
    rank: 0,
    lapsLabel: '0 圈',
    coins: 0,
    diceCount: 0,
    navBarHeight: 88,
    steps: 0,
    elapsed: '0分钟',
    goalScore: '+0',
    routeNodes: DEMO_ROUTE_NODES,
    mapId: '',
    loadedFromGame: false,
    posterVisible: false,
  },

  onLoad(options) {
    analytics.trackEvent(analytics.EVENT.PAGE_VIEW, { page: 'settlement' });
    if (!options) return;

    if (options.mapId) {
      this.setData({ mapId: options.mapId });
      this._loadFromGame(options.mapId);
      return;
    }

    // 演示数据路径 - 允许通过 query 直接传
    if (options.rank)        this.setData({ rank: Number(options.rank) });
    if (options.coins)       this.setData({ coins: Number(options.coins) });
    if (options.diceCount)   this.setData({ diceCount: Number(options.diceCount) });
    if (options.steps)       this.setData({ steps: Number(options.steps) });
    if (options.elapsed)     this.setData({ elapsed: options.elapsed });
  },

  _loadFromGame(mapId) {
    const mapData = getMap(mapId);
    if (!mapData || !mapData.currentGame) {
      wx.showToast({ title: '未找到结算数据', icon: 'none' });
      return;
    }
    const engine = new GameEngine(mapId, mapData).resume();
    const stats = engine.getStatistics();
    const state = engine.getState();
    const timeline = engine.getTimeline();

    // 仅打卡事件作为路线节点,机会卡单独处理
    const checkinEvents = timeline.filter((e) => !e.isChanceCard);
    const routeNodes = checkinEvents.map((e, i) => {
      const grid = mapData.grids && mapData.grids[e.gridIndex];
      const label = (grid && grid.poi && grid.poi.name) || e.note || `地点 ${i + 1}`;
      return {
        id: i,
        label,
        score: '+25',
        icon: defaultIconForGrid(grid),
        tone: toneForGrid(grid, i),
      };
    });

    this.setData({
      rank: state.currentLap || 0,
      lapsLabel: `${state.currentLap || 0} 圈`,
      coins: stats.currentGold,
      diceCount: stats.totalDiceRolls,
      steps: stats.totalDistance,
      elapsed: stats.totalDuration,
      goalScore: `+${stats.currentGold}`,
      routeNodes,
      loadedFromGame: true,
    });
  },

  onSharePoster() {
    this.setData({ posterVisible: true });
  },

  onPosterClose() {
    this.setData({ posterVisible: false });
  },

  onReplay() {
    const mapId = this.data.mapId;
    if (mapId) {
      wx.redirectTo({ url: `/pages/game/game?mapId=${mapId}` });
    } else {
      wx.switchTab({ url: '/pages/index/index' });
    }
  },

  onNavHeightChange(e) {
    this.setData({ navBarHeight: e.detail.height });
  },

  // 结算页是终态 — 无论从哪来,返回按钮都回首页
  onNavBack() {
    wx.switchTab({ url: '/pages/index/index' });
  },

  onShareAppMessage() {
    const path = this.data.loadedFromGame && this.data.mapId
      ? `/pages/settlement/settlement?mapId=${this.data.mapId}`
      : '/pages/settlement/settlement';
    return { title: '我在城市大富翁中通关啦！', path };
  },
});
