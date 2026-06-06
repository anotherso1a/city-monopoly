// index 页面 - 基于 design/index.html 转换

const { importMapFromFile } = require('../../services/shareService');
const { loadProfile, getDisplayProfile } = require('../../utils/userProfile');
const { getCumulativeExp } = require('../../utils/storage');
const analytics = require('../../services/analytics');

Page({
  data: {
    bgImage: 'https://anothersola.oss-cn-beijing.aliyuncs.com/pages/index/images/bg-city.png',
    // 用户授权相关(从 globalData 读取后填充)
    playerAvatar: '',
    playerNickname: '',
    showProfileSetup: false,
    profileMode: 'firstLaunch',
    mapThumbnails: [
      'https://anothersola.oss-cn-beijing.aliyuncs.com/pages/index/images/map-london.png',
      'https://anothersola.oss-cn-beijing.aliyuncs.com/pages/index/images/map-tokyo.png',
      'https://anothersola.oss-cn-beijing.aliyuncs.com/pages/index/images/map-paris.png'
    ],
    drawerOpen: false,
    sidebarItems: ['createMap', 'viewAllMaps', 'loadLocalMap', 'exit'],
    mapList: [],
    navBarHeight: 88,
    cumulativeExpLabel: '0 经验',  // 累计探索经验,展示在侧边栏
  },

  onLoad() {
    this.loadUserProfile();
    this.loadMapList();
    this._loadCumulativeExpLabel();
  },

  onShow() {
    analytics.trackEvent(analytics.EVENT.PAGE_VIEW, { page: 'index' });
    this.loadUserProfile();
    this._loadCumulativeExpLabel();
    // 每次回到首页都从 storage 重读地图列表 —— 结算/历史页面可能改了 currentGame
    // 或删了地图,这里必须看到最新状态
    this.loadMapList();
  },

  _loadCumulativeExpLabel() {
    this.setData({ cumulativeExpLabel: `${getCumulativeExp()} 经验` });
  },

  loadUserProfile() {
    // 每次都从 storage 重读:App.onLaunch 的 globalData 是首次启动的快照,
    // 用户在 IDE 清空 storage(或外部清掉)后,这里必须看到最新状态才能弹窗
    const profile = loadProfile();
    getApp().globalData.userProfile = profile;
    const display = getDisplayProfile();
    this.setData({
      playerAvatar: display.avatarUrl,
      playerNickname: display.nickName,
    });
    // 弹窗逻辑只在弹窗已关闭时生效:否则 chooseAvatar 走系统相册会触发 onShow,
    // 把正在编辑的弹窗强制关掉
    if (!this.data.showProfileSetup) {
      this.setData({
        showProfileSetup: !profile || profile.setupSeen !== true,
      });
    }
  },

  onProfileCommit(e) {
    // confirm 和 skip 都表示"用户已确认/跳过授权,写回 globalData 并关闭弹窗"
    getApp().globalData.userProfile = e.detail;
    this.loadUserProfile();
    this.setData({ showProfileSetup: false });
  },

  onProfileClose() {
    this.setData({ showProfileSetup: false });
  },

  onSidebarEditProfile() {
    this.setData({ showProfileSetup: true, profileMode: 'edit' });
  },

  onNavHeightChange(e) {
    this.setData({ navBarHeight: e.detail.height });
  },

  loadMapList() {
    const maps = wx.getStorageSync('maps') || [];
    const mapList = maps.slice(0, 3);
    this.setData({
      mapList,
      mapThumbnails: mapList.length > 0 ? mapList.map(() => 'https://anothersola.oss-cn-beijing.aliyuncs.com/pages/index/images/map-london.png') : []
    });
  },

  onToggleDrawer() {
    this.setData({ drawerOpen: !this.data.drawerOpen });
  },

  onCloseDrawer() {
    this.setData({ drawerOpen: false });
  },

  onSidebarItemTap(e) {
    this.onCloseDrawer();
    switch (e.detail.id) {
      case 'createMap':   this.onCreateMap(); break;
      case 'viewAllMaps': this.onViewAll(); break;
      case 'loadLocalMap': this.onLoadLocalMap(); break;
      case 'exit':
        wx.showModal({
          title: '退出游戏',
          content: '确定要退出游戏吗？',
          confirmText: '退出',
          cancelText: '取消',
          success: (res) => { if (res.confirm) wx.exitMiniProgram(); }
        });
        break;
    }
  },

  onCreateMap() {
    wx.navigateTo({
      url: '/pages/create/create'
    });
  },

  onViewAll() {
    wx.navigateTo({
      url: '/pages/history/history'
    });
  },

  onMapTap(e) {
    const { mapId } = e.currentTarget.dataset;
    wx.navigateTo({
      url: `/pages/game/game?mapId=${mapId}`
    });
  },

  onLoadLocalMap() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: (res) => {
        const filePath = res.tempFiles[0].path;
        importMapFromFile(filePath)
          .then((mapData) => {
            // 导入成功(不管用户是否立即开始游戏)
            analytics.trackEvent(analytics.EVENT.MAP_IMPORT, { map_id: mapData.id, source: 'local_file' });
            wx.showModal({
              title: '导入成功',
              content: `地图「${mapData.name}」已导入，是否立即开始游戏？`,
              confirmText: '开始游戏',
              cancelText: '稍后',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  wx.navigateTo({
                    url: `/pages/game/game?mapId=${mapData.id}`
                  });
                }
              }
            });
          })
          .catch((err) => {
            wx.showToast({ title: err.message || '导入失败', icon: 'none' });
          });
      },
      fail: (err) => {
        if (err.errMsg !== 'chooseMessageFile:fail cancel') {
          wx.showToast({ title: '选择文件失败', icon: 'none' });
        }
      }
    });
  }
});