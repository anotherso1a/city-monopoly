// 探险日志详情页
// 两种渲染来源:
//   1) 无 mapId - 使用页面内置的演示数据 (设计稿对应状态)
//   2) 带 mapId - 加载 storage 里的 currentGame, 把 engine.getTimeline() 的事件
//      映射成 log-entry 组件所需的字段

const { getMap } = require('../../utils/storage');
const { GameEngine } = require('../../services/gameEngine');
const { loadProfile } = require('../../utils/userProfile');

function formatTime(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${hh}:${mm}`;
}

function formatDate(iso) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

const DEMO_ENTRIES = [
  {
    id: 1,
    time: '14:30',
    location: '武康大楼',
    image: 'https://anothersola.oss-cn-beijing.aliyuncs.com/pages/logs/images/wukang-building.png',
    caption: '东方扁铁大厦，绝美建筑！',
    badge: '签到成功',
    xp: '+120 经验',
    isChanceCard: false,
  },
  {
    id: 2,
    time: '15:45',
    location: '安福路',
    image: 'https://anothersola.oss-cn-beijing.aliyuncs.com/pages/logs/images/anfu-road.png',
    caption: '在隐藏的咖啡馆小憩，充满活力！',
    badge: '发现宝藏',
    xp: '+250 经验',
    isChanceCard: false,
  },
];

Page({
  data: {
    dateLabel: '2023年10月24日',
    shareButtonText: '分享这段旅程',
    entries: DEMO_ENTRIES,
    mapId: '',
    navBarHeight: 88,
    loadedFromGame: false,
    posterVisible: false,
    showProfileSetup: false,
    profileMode: 'edit',
  },

  onLoad(options) {
    if (!options) return;

    if (options.mapId) {
      this.setData({ mapId: options.mapId });
      this._loadFromGame(options.mapId);
    } else if (options.date) {
      this.setData({ dateLabel: options.date });
    }
  },

  _loadFromGame(mapId) {
    const mapData = getMap(mapId);
    if (!mapData || !mapData.currentGame) {
      wx.showToast({ title: '未找到游戏进度', icon: 'none' });
      return;
    }
    const engine = new GameEngine(mapId, mapData).resume();
    const events = engine.getTimeline();
    const entries = events.map((e, i) => this._eventToEntry(e, i, mapData));

    const dateIso = mapData.currentGame.startedAt
      || mapData.currentGame.endedAt
      || new Date().toISOString();

    this.setData({
      entries,
      dateLabel: formatDate(dateIso),
      loadedFromGame: true,
    });
  },

  _eventToEntry(event, index, mapData) {
    const isChanceCard = !!event.isChanceCard;
    const grid = mapData.grids && mapData.grids[event.gridIndex];
    const poiName = grid && grid.poi && grid.poi.name;
    const poiType = grid && grid.poi && grid.poi.type;  // 给 log-entry 用来选 icon

    if (isChanceCard) {
      // 从 grid.chanceCards 按 cardIndex 反查真 card — 单源真相
      // (history 只存 cardIndex + 固化 badge,卡内容由地图说了算)
      // 旧数据缺 cardIndex / 卡被从地图里删掉 → 走兜底文案
      const card = (grid && grid.chanceCards) ? grid.chanceCards[event.cardIndex] : null;
      const goldChange = card ? card.goldChange : 0;
      const caption = card ? card.description
        : (event.note || '').replace(/^机会卡[:：]\s*/, '') || '未知机会卡';
      return {
        id: index,
        time: formatTime(event.timestamp),
        location: poiName || '机会卡',
        poiType: poiType || '',
        image: '',
        caption,
        // badge 在抽卡瞬间已固化到 history,直接用 — 保证同一次抽卡回看标签一致
        badge: event.badge || (goldChange >= 0 ? '幸运事件' : '意外开销'),
        xp: `金币 ${goldChange > 0 ? '+' : ''}${goldChange}`,
        isChanceCard: true,
      };
    }

    return {
      id: index,
      time: formatTime(event.timestamp),
      location: poiName || event.note || '未知道点',
      poiType: poiType || '',
      image: event.photoUrl || '',
      caption: event.note && event.note !== poiName ? event.note : (poiName || ''),
      badge: '签到成功',
      // 经验值:与累计探索经验机制对齐 — 每次打卡 +1
      xp: '+1 经验',
      isChanceCard: false,
    };
  },

  onShare() {
    // 合规前置:海报上会画用户的头像和昵称,未授权过(没头像昵称)时先弹 profile-setup
    // 引导用户设置,确认/跳过后再弹海报。点跳过会写入 setupSeen 标记,不再二次打扰。
    const profile = loadProfile();
    const isProfileReady = profile && profile.avatarUrl && profile.nickName;
    if (!isProfileReady) {
      this._pendingPoster = true;
      this.setData({ showProfileSetup: true, profileMode: 'edit' });
      return;
    }
    this.setData({ posterVisible: true });
  },

  onPosterClose() {
    this.setData({ posterVisible: false });
  },

  onProfileCommit(e) {
    getApp().globalData.userProfile = e.detail;
    this.setData({ showProfileSetup: false });
    // 分享海报触发的授权:用户处理完后继续弹海报
    if (this._pendingPoster) {
      this._pendingPoster = false;
      this.setData({ posterVisible: true });
    }
  },

  onProfileClose() {
    this.setData({ showProfileSetup: false });
  },

  onNavHeightChange(e) {
    this.setData({ navBarHeight: e.detail.height });
  },

  onShareAppMessage() {
    const path = this.data.loadedFromGame && this.data.mapId
      ? `/pages/logs/logs?mapId=${this.data.mapId}`
      : '/pages/logs/logs';
    return { title: '我的探险日志', path };
  },
});
