// 历史收藏页面
// 基于 docs/design/history.html 设计的微信小程序版本

const { getMaps, getMap, saveMap, deleteMap } = require('../../utils/storage');
const { GAME_STATUS } = require('../../utils/constants');
const analytics = require('../../services/analytics');

Page({
  data: {
    // 搜索关键词
    searchKeyword: '',

    // 筛选标签 —— id 直接用 GAME_STATUS 值,过滤时 map.status === currentFilter 直接对上
    filterTabs: [
      { id: 'all', name: '全部' },
      { id: GAME_STATUS.PLAYING,   name: '进行中' },
      { id: GAME_STATUS.COMPLETED, name: '已完成' }
    ],
    currentFilter: 'all',

    // 地图列表数据（从本地存储加载）
    maps: [],

    // 筛选后的地图列表
    filteredMaps: [],

    // 导航栏实际高度,由 navigation-bar 在 attached 时回传
    navBarHeight: 88,

    // 空状态配置
    emptyStateConfig: {
      illustrationImage: 'https://anothersola.oss-cn-beijing.aliyuncs.com/pages/historyempty/images/empty-city-map.png',
      headline: '还没有地图',
      description: '开始你的冒险旅程，创建第一张属于你的城市地图',
      actionIcon: 'plus-circle',
      actionText: '创建第一张地图',
      actionUrl: '/pages/create/create',
      tip: '地图基于大模型自主生成'
    }
  },

  onShow() {
    analytics.trackEvent(analytics.EVENT.PAGE_VIEW, { page: 'history' });
    const rawMaps = getMaps();
    const thumbnails = [
      'https://anothersola.oss-cn-beijing.aliyuncs.com/pages/history/images/map-london.png',
      'https://anothersola.oss-cn-beijing.aliyuncs.com/pages/history/images/map-tokyo.png',
      'https://anothersola.oss-cn-beijing.aliyuncs.com/pages/history/images/map-paris.png'
    ];

    const maps = rawMaps.map((map, index) => {
      // 游戏状态统一用 GAME_STATUS 常量;currentGame 可能为 null(地图创建后未开过游戏)
      const status = (map.currentGame && map.currentGame.status) || GAME_STATUS.PLAYING;
      return {
        ...map,
        date: map.createdAt ? new Date(map.createdAt).toLocaleDateString('zh-CN') : '未知日期',
        gridCount: map.grids ? map.grids.length : 20,
        thumbnail: thumbnails[index % thumbnails.length],
        status,
        statusText: status === GAME_STATUS.COMPLETED ? '已完成' : '进行中',
        statusClass: status === GAME_STATUS.COMPLETED ? 'status-completed' : 'status-ongoing'
      };
    });

    this.setData({ maps });
    this.updateFilteredMaps();
  },

  // 更新筛选后的地图列表
  updateFilteredMaps() {
    const { maps, searchKeyword, currentFilter } = this.data;
    let filtered = maps;

    // 按搜索关键词筛选
    if (searchKeyword) {
      filtered = filtered.filter(map =>
        map.name.toLowerCase().includes(searchKeyword.toLowerCase())
      );
    }

    // 按状态筛选 —— currentFilter 与 map.status 都用 GAME_STATUS 值
    if (currentFilter !== 'all') {
      filtered = filtered.filter(map => map.status === currentFilter);
    }

    this.setData({ filteredMaps: filtered });
  },

  // 搜索输入
  onSearchInput(e) {
    this.setData({ searchKeyword: e.detail.value });
    this.updateFilteredMaps();
  },

  // 筛选标签点击
  onFilterTap(e) {
    const filter = e.currentTarget.dataset.filter;
    this.setData({ currentFilter: filter });
    this.updateFilteredMaps();
  },

  onNavHeightChange(e) {
    this.setData({ navBarHeight: e.detail.height });
  },

  // 开始游戏
  onPlayMap(e) {
    const { mapId } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/game/game?mapId=${mapId}`
    });
  },

  // 清空已完成地图的游戏数据 — 提示后重置 currentGame 为 null
  // 地图定义本身保留(POI / 格子 / chanceCards 等不动)
  onRestartMap(e) {
    const { mapId } = e.currentTarget.dataset;
    wx.showModal({
      title: '清空数据重新游玩',
      content: '将清空当前地图的探险进度(金币/打卡/机会卡历史),地图定义(POI、机会卡)保留。确认开始新的探险?',
      confirmText: '确认清空',
      cancelText: '取消',
      confirmColor: '#ba1a1a',
      success: (res) => {
        if (!res.confirm) return;
        const map = getMap(mapId);
        if (!map) {
          wx.showToast({ title: '地图不存在', icon: 'error' });
          return;
        }
        // 清掉 currentGame,其他字段保持不动
        saveMap({ ...map, currentGame: null });
        wx.showToast({ title: '已清空,可以开始新一局', icon: 'success' });
        this.onShow();
      },
    });
  },

  // 编辑地图
  onEditMap(e) {
    const { mapId } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/edit/edit?mapId=${mapId}`
    });
  },

  // 删除地图
  onDeleteMap(e) {
    const { mapId } = e.currentTarget.dataset;
    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个地图吗？',
      success: (res) => {
        if (res.confirm) {
          deleteMap(mapId);
          analytics.trackEvent(analytics.EVENT.MAP_DELETE, {
            map_id: mapId,
            filter: this.data.currentFilter,
          });
          this.onShow();
        }
      }
    });
  },

  // 创建地图
  onCreateMap() {
    wx.navigateTo({
      url: '/pages/create/create'
    });
  }
});