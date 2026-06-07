// game 页面 - 主游戏页
// 流程: getMap → GameEngine.initFresh/resume → syncFromEngine → Board 重绘
// 样式沿用 docs/design/game.html 的纸面/手绘风格,地图数据从 storage 读取

const { getMap, getMaps, getCumulativeExp, addCumulativeExp } = require('../../utils/storage');
const { haversineMeters } = require('../../services/distanceService');
const { GameEngine } = require('../../services/gameEngine');
const { exportMap } = require('../../services/shareService');
const { loadProfile, getDisplayProfile } = require('../../utils/userProfile');
const { fetchWalkingDistanceMeters } = require('../../services/distanceService');
const analytics = require('../../services/analytics');
// weRun 步数 — 暂时静默(避免未配置云开发时控制台噪声 + 鼓励付费模式不划算)
// const { fetchStepCount } = require('../../services/weRunService');

// 把米数格式化成"1.2km" / "850m" 之类的展示文案
// < 1km 走米,≥ 1km 走公里(1 位小数)
function formatDistance(meters) {
  const m = Math.max(0, Math.round(meters || 0));
  if (m < 1000) return `${m}m`;
  return `${(m / 1000).toFixed(1)}km`;
}

Page({
  data: {
    drawerOpen: false,
    sidebarItems: ['viewAllMaps', 'viewTimeline', 'editMap', 'shareMap', 'loadLocalMap', 'settle', 'exit'],
    navBarHeight: 88,
    diceShaking: false,
    diceText: '投掷骰子',
    cardOpacity: 1,
    modalVisible: false,
    selectedGrid: { poi: {} },
    isCurrentGrid: false,
    isAnimating: false,

    // User data (从 globalData 读取后填充)
    playerAvatar: '',
    playerNickname: '',
    showProfileSetup: false,
    profileMode: 'firstLaunch',

    // 累计探索经验 — 从 storage 读取后格式化,展示在侧边栏
    cumulativeExpLabel: '0 经验',

    // 步数(wx.getWeRunData,onShow 时更新) — 显示成 "1234 步" / "未获取" / "--"
    stepCountLabel: '--',

    // 徒步距离(累加自 game.state.distance,单位米) — 显示成 "1.2km" / "0m"
    walkingDistanceLabel: '0m',

    // 已完成游戏只读模式 — true 时隐藏骰子按钮,显示提示条
    isCompletedView: false,

    // Engine & map state
    engine: null,
    mapId: null,
    gameId: null,
    grids: [],
    currentGridIndex: 0,
    currentLap: 0,
    currentGold: 0,
    currentGrid: { type: 'poi', poi: {} },
    currentTitle: '位置',
    currentDesc: '',
    currentIconClass: 'icon-location',
    currentGridCheckedIn: false,
    _poiMarkers: null,
    shareFilePath: null,

    // Board view
    viewMode: 'overview',
    boardScale: 1,
    boardOffsetX: 0,
    boardOffsetY: 0,

    // Chance card
    chanceCardVisible: false,
    chanceCardDescription: '',
    chanceCardGoldChange: 0,

    // Photo card
    photoCardVisible: false,
    photoCardImage: '',
    photoCardLocationName: '',
    photoCardPhotoDate: '',
    photoCardDescription: '',
    photoCardAchievementPoint: 0,
    // 标记当前弹出的拍照卡是否对应"本次新打卡"(true)还是"查看已有照片"(false)
    // 用于决定 onPhotoCardContinue 是否触发机会卡
    photoCardIsNewCheckin: false,
  },

  // 读取累计经验并格式化为 sidebar 用的标签
  _loadCumulativeExpLabel() {
    this.setData({ cumulativeExpLabel: `${getCumulativeExp()} 经验` });
  },

  onLoad(options) {
    this._pageLoadStart = Date.now();
    this._loadCumulativeExpLabel();
    const { mapId } = options || {};
    const targetId = mapId || (getMaps()[0] && getMaps()[0].id);
    if (!targetId) {
      wx.showToast({ title: '没有可用地图', icon: 'none' });
      return;
    }
    const mapData = getMap(targetId);
    if (!mapData) {
      wx.showToast({ title: '地图不存在', icon: 'error' });
      return;
    }
    this._startOrResumeGame(mapData);
  },

  onReady() {
    if (this._pageLoadStart) {
      analytics.trackPerf(
        analytics.EVENT.PAGE_LOAD,
        { page: 'game' },
        Date.now() - this._pageLoadStart
      );
    }
  },

  onShow() {
    analytics.trackEvent(analytics.EVENT.PAGE_VIEW, { page: 'game' });
    this.loadUserProfile();
    this._loadCumulativeExpLabel();
    // 步数暂时不拉 — 云函数需要按量付费配置,没用户时先静默
    // this._refreshStepCount();
  },

  // 微信步数 —— 暂时禁用,等需要时恢复
  // 用户拒绝授权 / 未配置云开发 / 设备不支持 → 显示 '--'
  // async _refreshStepCount() {
  //   try {
  //     const step = await fetchStepCount();
  //     this.setData({
  //       stepCountLabel: step == null ? '--' : `${step.toLocaleString('en-US')} 步`,
  //     });
  //   } catch (err) {
  //     console.warn('[weRun] fetchStepCount failed:', err);
  //     this.setData({ stepCountLabel: '--' });
  //   }
  // },

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
    // 微信隐私合规:授权弹窗必须由用户主动点击触发,不能进入页面时自动弹。
    // 这里只刷新展示数据,不再根据 profile 状态自动 setData({ showProfileSetup: true })。
    // 弹窗入口:
    //   1. 侧边栏头部点击 → onSidebarEditProfile(已存在)
    //   2. 分享等需要头像昵称的动作 → 各动作入口处按需引导(如 onShareMap)
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

  // 沿用 game.js 的 initFresh / resume 流程
  // 已完成游戏:不再自动重开,弹提示后进入只读模式(无投骰子按钮)
  _startOrResumeGame(mapData) {
    if (!mapData.currentGame) {
      this._beginNewGame(mapData);
      return;
    }
    if (mapData.currentGame.status === 'playing') {
      const engine = new GameEngine(mapData.id, mapData).resume();
      this.setData({ engine, mapId: mapData.id, gameId: engine.state.id });
      this.syncFromEngine();
      this.prepareShareFile(mapData);
      return;
    }
    // status === 'completed' — 进入只读查看模式
    // 不弹 modal —— 底部 3 按钮(继续游玩/查看时间线/清空数据)就是新交互入口
    const engine = new GameEngine(mapData.id, mapData).resume();
    this.setData({
      engine,
      mapId: mapData.id,
      gameId: engine.state.id,
      isCompletedView: true,  // 控制 UI:隐藏骰子,展示底部 3 按钮
    });
    this.syncFromEngine();
    this.prepareShareFile(mapData);
  },

  _beginNewGame(mapData) {
    const engine = new GameEngine(mapData.id, mapData).initFresh();
    this.setData({ engine, mapId: mapData.id, gameId: engine.state.id });
    this.syncFromEngine();
    this.prepareShareFile(mapData);
    analytics.trackEvent(analytics.EVENT.GAME_START, {
      map_id: mapData.id,
      grid_count: (mapData.grids || []).length,
      mode: 'fresh',
    });
    wx.showToast({ title: '游戏开始', icon: 'success' });
  },

  // 处理 engine 各种操作的 save 返回结果,失败时弹"无法保存"modal
  _handleSaveResult(result) {
    if (!result || result.saved !== false) return;
    wx.showModal({
      title: '无法保存进度',
      content: '存储已满，请删除部分地图后继续',
      confirmText: '去清理',
      cancelText: '继续游戏（仅本会话）',
      success: (res) => {
        if (res.confirm) {
          wx.navigateTo({ url: '/pages/history/history' });
        }
      }
    });
  },

  // 从 engine 同步到 page data(与 game.js 一致 + 派生 UI 字段)
  syncFromEngine() {
    const engine = this.data.engine;
    if (!engine) return;
    const state = engine.getState();
    const map = engine.map;
    const currentGrid = engine.getCurrentGrid();

    const currentGold = Number(state.currentGold || 0).toLocaleString('en-US');
    // 徒步距离:打卡时通过高德步行 API 累加,这里只读不写
    const walkingDistanceLabel = formatDistance(state.distance || 0);
    // 每个格子都是 POI;title/desc/icon 永远从 grid.poi 取
    const currentIconClass = this._getIconForPoi(currentGrid.poi);
    const currentTitle = (currentGrid.poi && currentGrid.poi.name) || '位置';
    const currentDesc = (currentGrid.poi && currentGrid.poi.address) || '';

    this.setData({
      grids: map.grids || [],
      currentGridIndex: state.currentGridIndex,
      currentLap: state.currentLap,
      currentGold,
      walkingDistanceLabel,
      currentGrid,
      currentTitle,
      currentDesc,
      currentIconClass,
      currentGridCheckedIn: (state.checkins || []).some(
        c => c.gridIndex === state.currentGridIndex
      )
    });
  },

  _getIconForPoi(poi) {
    if (!poi) return 'icon-location';
    if (poi.iconClass) return poi.iconClass;
    const typeMap = {
      '历史区': 'icon-home',
      '集市': 'icon-shop',
      '桥梁': 'icon-bank',
      '博物馆': 'icon-bowuguan',
      '公园': 'icon-park',
      '广场': 'icon-location',
      '摩天楼': 'icon-bangonglou',
      '教堂': 'icon-jiaotang',
      '街区': 'icon-city',
      '车站': 'icon-road_sign'
    };
    return typeMap[poi.type] || 'icon-location';
  },

  // ============ Sidebar — 与 game 页面的 7 个操作保持一致 ============
  onToggleDrawer() {
    this.setData({ drawerOpen: !this.data.drawerOpen });
  },

  onNavHeightChange(e) {
    this.setData({ navBarHeight: e.detail.height });
  },

  onCloseDrawer() {
    this.setData({ drawerOpen: false });
  },

  // Sidebar 通用分发: 按 item id 路由到具体的处理函数
  onSidebarItemTap(e) {
    const map = {
      viewAllMaps:  this.onViewAllMaps,
      viewTimeline: this.onViewTimeline,
      editMap:      this.onEditMap,
      shareMap:     this.onShareMap,
      loadLocalMap: this.onLoadLocalMap,
      settle:       this.onSettle,
      exit:         this.onExitGame,
    };
    const handler = map[e.detail.id];
    if (handler) handler.call(this);
  },

  onViewAllMaps() {
    this.onCloseDrawer();
    wx.navigateTo({ url: '/pages/history/history' });
  },

  onViewTimeline() {
    this.onCloseDrawer();
    const mapId = this.data.mapId;
    if (!mapId) {
      wx.showToast({ title: '地图数据未加载', icon: 'none' });
      return;
    }
    wx.navigateTo({ url: `/pages/logs/logs?mapId=${mapId}` });
  },

  onEditMap() {
    this.onCloseDrawer();
    const mapId = this.data.mapId;
    if (mapId) {
      wx.navigateTo({ url: `/pages/edit/edit?id=${mapId}` });
    }
  },

  onShareMap() {
    this.onCloseDrawer();
    const { shareFilePath, mapId } = this.data;
    if (!shareFilePath) {
      wx.showToast({ title: '地图数据准备中，请稍后再试', icon: 'none' });
      return;
    }
    wx.shareFileMessage({
      filePath: shareFilePath,
      fileName: shareFilePath.split('/').pop(),
      success: () => {
        analytics.trackEvent(analytics.EVENT.MAP_SHARE, { map_id: mapId, source: 'sidebar' });
        wx.showToast({ title: '分享成功', icon: 'success' });
      },
      fail: (err) => {
        console.error('[onShareMap] shareFileMessage fail:', err);
        analytics.reportError(analytics.EVENT.ERROR_API_SHARE, { map_id: mapId, source: 'sidebar' }, err);
        wx.showToast({ title: '分享失败', icon: 'none' });
      }
    });
  },

  onLoadLocalMap() {
    this.onCloseDrawer();
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: (res) => {
        const filePath = res.tempFiles[0].path;
        const { importMapFromFile } = require('../../services/shareService');
        importMapFromFile(filePath)
          .then((mapData) => {
            wx.showModal({
              title: '导入成功',
              content: `地图「${mapData.name}」已导入，是否立即开始游戏？`,
              confirmText: '开始游戏',
              cancelText: '稍后',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  wx.redirectTo({ url: `/pages/game/game?mapId=${mapData.id}` });
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
  },

  onSettle() {
    this.onCloseDrawer();
    const engine = this.data.engine;
    if (!engine) return;
    const stats = engine.getStatistics();
    const mapId = this.data.mapId;
    wx.showModal({
      title: '🏁 结算游戏',
      content: `投掷次数：${stats.totalDiceRolls}\n打卡次数：${stats.totalCheckins}\n总金币：${stats.currentGold}\n总距离：${stats.totalDistance}米\n\n结算后游戏将标记为「已完成」，无法继续探索。`,
      confirmText: '确认结算',
      cancelText: '取消',
      confirmColor: '#cf3a3a',
      success: (res) => {
        if (res.confirm) {
          const saveResult = engine.settle();
          this._handleSaveResult(saveResult);
          if (saveResult.saved) {
            analytics.trackEvent(analytics.EVENT.GAME_END, {
              map_id: mapId,
              total_dice_rolls: stats.totalDiceRolls,
              total_checkins: stats.totalCheckins,
              total_gold: stats.currentGold,
              total_distance: stats.totalDistance,
              total_laps: engine.state.currentLap,
            });
            wx.redirectTo({ url: `/pages/settlement/settlement?mapId=${mapId}` });
          } else {
            wx.showToast({ title: '结算失败，请重试', icon: 'none' });
          }
        }
      }
    });
  },

  onExitGame() {
    this.onCloseDrawer();
    wx.showModal({
      title: '退出游戏',
      content: '确定要退出当前游戏吗？',
      confirmText: '退出',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) wx.navigateBack();
      }
    });
  },

  // ============ 已完成游戏底部 3 按钮 ============
  // 继续游玩 —— 状态翻转为「进行中」,数据完全保留
  // 注意:不重置任何进度(金币/打卡/机会卡/距离都不动)
  onContinueGame() {
    const engine = this.data.engine;
    if (!engine) return;
    const saveResult = engine.markReopened();
    this._handleSaveResult(saveResult);
    if (!saveResult || saveResult.saved === false) return;
    this.setData({ isCompletedView: false });
    this.syncFromEngine();
    wx.showToast({ title: '已恢复进行中', icon: 'success' });
  },

  // 清空数据并重新游玩 —— 抹掉 currentGame,然后用同一份地图定义开一局新的
  // 等价于"历史页面 onRestartMap"的效果,只是入口换到了游戏页
  onRestartGame() {
    const engine = this.data.engine;
    if (!engine) return;
    const mapId = this.data.mapId;
    wx.showModal({
      title: '清空数据重新游玩',
      content: '将清空当前地图的探险进度(金币/打卡/机会卡历史),地图定义(POI、机会卡)保留。确认开始新的探险?',
      confirmText: '确认清空',
      cancelText: '取消',
      confirmColor: '#ba1a1a',
      success: (res) => {
        if (!res.confirm) return;
        const clearResult = engine.clearGameData();
        this._handleSaveResult(clearResult);
        if (!clearResult || clearResult.saved === false) return;
        // 拉一份最新的 map(没有 currentGame 了),_beginNewGame 会从空状态开局
        const mapData = getMap(mapId);
        if (!mapData) {
          wx.showToast({ title: '地图不存在', icon: 'error' });
          return;
        }
        this._beginNewGame(mapData);
      },
    });
  },

  // 预准备分享文件 — 走 shareService.exportMap,脱敏 currentGame,只带地图定义
  async prepareShareFile(mapData) {
    try {
      const filePath = await exportMap(mapData);
      this.setData({ shareFilePath: filePath });
    } catch (err) {
      console.error('[prepareShareFile] fail:', err);
    }
  },

  // 卸载时清理预生成的分享文件 — 否则会留在 wx.env.USER_DATA_PATH 里
  // 直到下次 exportMap 调用 clearOldShareFiles 才会被清,属于懒清理
  onUnload() {
    const { shareFilePath } = this.data;
    if (!shareFilePath) return;
    wx.getFileSystemManager().unlink({
      filePath: shareFilePath,
      success: () => { this.setData({ shareFilePath: null }); },
      fail: () => { this.setData({ shareFilePath: null }); }
    });
  },

  // ============ Board 事件 ============
  setViewMode(e) {
    const mode = e.currentTarget.dataset.mode;
    this.setData({ viewMode: mode });
    if (mode === 'focus') {
      const { _poiMarkers, currentGridIndex, _canvasWidth, _canvasHeight } = this.data;
      if (!_poiMarkers || !_poiMarkers[currentGridIndex]) return;
      if (!_canvasWidth || !_canvasHeight) return;
      const marker = _poiMarkers[currentGridIndex];
      const boardScale = 2;
      const cx = _canvasWidth / 2;
      const cy = _canvasHeight / 2;
      this.setData({
        boardScale,
        boardOffsetX: (cx - marker.x) * boardScale,
        boardOffsetY: (cy - marker.y) * boardScale
      });
    } else {
      this.setData({
        boardScale: 1,
        boardOffsetX: 0,
        boardOffsetY: 0
      });
    }
  },

  onPoiMarkersUpdate(e) {
    const { poiMarkers, canvasWidth, canvasHeight } = e.detail;
    this.setData({
      _poiMarkers: poiMarkers,
      _canvasWidth: canvasWidth,
      _canvasHeight: canvasHeight
    });
  },

  onGridTap(e) {
    const index = e.detail.index;
    const grid = this.data.grids[index];
    if (!grid) return;
    const isCurrentGrid = index === this.data.currentGridIndex;
    this.setData({
      modalVisible: true,
      selectedGrid: grid,
      isCurrentGrid
    });
  },

  onPan(e) {
    const { deltaX, deltaY } = e.detail;
    const { boardScale } = this.data;
    const scaledDeltaX = deltaX * boardScale;
    const scaledDeltaY = deltaY * boardScale;
    const { boardOffsetX, boardOffsetY } = this.data;
    this.setData({
      boardOffsetX: boardOffsetX + scaledDeltaX,
      boardOffsetY: boardOffsetY + scaledDeltaY
    });
  },

  onPanEnd() {},

  onPinch(e) {
    const { scaleDelta } = e.detail;
    const { boardScale } = this.data;
    const newScale = boardScale * scaleDelta;
    const clampedScale = Math.max(0.5, Math.min(3, newScale));
    this.setData({ boardScale: clampedScale });
  },

  // ============ Roll Dice — engine.rollDice + 逐格 engine.move(1) ============
  onRollDice() {
    if (this.data.diceShaking || this.data.isAnimating) return;
    const engine = this.data.engine;
    if (!engine) return;

    // focus 模式聚焦在当前格,看不到点位移动;投掷时强制切回全览
    if (this.data.viewMode !== 'overview') {
      this.setData({
        viewMode: 'overview',
        boardScale: 1,
        boardOffsetX: 0,
        boardOffsetY: 0
      });
    }

    this.setData({ diceShaking: true, diceText: '投掷中...', isAnimating: true });
    const diceValue = engine.rollDice();

    setTimeout(() => {
      this.setData({
        diceShaking: false,
        diceText: `前进 ${diceValue} 步!`
      });
      this._animateMovement(diceValue);
    }, 600);
  },

  async _animateMovement(stepsToMove) {
    const engine = this.data.engine;
    const previousIndex = engine.state.currentGridIndex;

    for (let i = 0; i < stepsToMove; i++) {
      const saveResult = engine.move(1);
      this._handleSaveResult(saveResult);
      this.syncFromEngine();
      this.setData({ cardOpacity: 0.5 });
      setTimeout(() => this.setData({ cardOpacity: 1 }), 150);
      await this._sleep(450);
    }

    if (engine.state.currentGridIndex < previousIndex && stepsToMove > 0) {
      wx.showToast({ title: '完成一圈!奖励金币', icon: 'success' });
    }

    // 任务:机会卡不再自动触发,改为"拍照打卡后由用户点继续前进"驱动
    // 落在机会格时只显示 toast/静默,等待用户主动打卡
    const grid = engine.getCurrentGrid();
    if (grid.chanceCards && grid.chanceCards.length > 0) {
      wx.showToast({ title: '这是一个机会格,打卡后试试运气', icon: 'none' });
    }

    this.setData({ diceText: '投掷骰子', isAnimating: false });
  },

  // ============ Chance Card — 沿用 game.js drawChanceCard 流程 ============
  showChanceCard() {
    const engine = this.data.engine;
    const result = engine.drawChanceCard();
    this._handleSaveResult(result);
    if (!result || !result.card) return;
    const card = result.card;
    this.setData({
      chanceCardVisible: true,
      chanceCardDescription: card.description,
      chanceCardGoldChange: card.goldChange
    });
  },

  onChanceCardCollect() {
    this._closeChanceCard();
  },

  onChanceCardClose() {
    this._closeChanceCard();
  },

  _closeChanceCard() {
    this.setData({
      chanceCardVisible: false,
      chanceCardDescription: '',
      chanceCardGoldChange: 0
    });
    this.syncFromEngine();
  },

  // ============ Info Card Actions ============
  onInfoCardTap() {
    this.onGridTap({ detail: { index: this.data.currentGridIndex } });
  },

  onNavigate() {
    const poi = this.data.currentGrid.poi;
    if (!poi || !poi.location || !poi.location.lat) {
      wx.showToast({ title: '此位置无法导航', icon: 'none' });
      return;
    }
    wx.openLocation({
      latitude: poi.location.lat,
      longitude: poi.location.lng,
      name: poi.name || '目的地',
      address: poi.address || '',
      scale: 15
    });
  },

  // "打卡"按钮 — 沿用 game.js 的拍照打卡流程
  // 每个格子都是 POI,不再需要 type 守卫
  onCheckin() {
    const engine = this.data.engine;
    if (!engine) return;
    if (this.data.currentGridCheckedIn) {
      // 已打卡 → 展示最近一次打卡的庆祝弹窗
      this._showExistingCheckinPhoto();
      return;
    }
    this._doCheckin();
  },

  _doCheckin() {
    const engine = this.data.engine;
    const grid = engine.getCurrentGrid();
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera'],
      success: (res) => {
        const photoPath = res.tempFilePaths[0];
        // 同步预估本次打卡应得经验(首次 +10,后续 5+haversine*1.3/100),
        // 存进 checkin 事件 —— 拍照弹窗、logs 展示从此事件里读。
        // _accumulateWalkingDistance 拿到 AMap 精确米数后,会补差额并把
        // expAwarded 更新为精确值。
        const expAwarded = this._estimateCheckinExp(grid);
        const result = engine.checkin(photoPath, '', expAwarded);
        if (result.success) {
          // 经验值规则:
          //   - 首次打卡(无"上一格"):+10 exp(启动奖励)
          //   - 后续每次打卡:+5 + Math.floor(米数/100) exp
          // 逻辑统一在 _accumulateWalkingDistance 里处理,这里不再单独加经验。
          this.syncFromEngine();
          this._showPhotoCard(grid, photoPath);
          // 异步算步行距离,失败静默(用户感知不到)
          this._accumulateWalkingDistance(grid);
          analytics.trackEvent(analytics.EVENT.GAME_CHECKIN, {
            map_id: this.data.mapId,
            grid_index: engine.state.currentGridIndex,
            poi_name: (grid.poi && grid.poi.name) || '',
            lap: engine.state.currentLap,
            has_chance_card: !!(grid.chanceCards && grid.chanceCards.length),
          });
        } else if (result.message) {
          wx.showToast({ title: result.message, icon: 'none' });
        }
        this._handleSaveResult(result);
      }
    });
  },

  // 累加"当前打卡点 → 上一次打卡点"的步行距离 + 经验
  // 经验规则:
  //   - 首次打卡(只有自己一条 checkin):+10 exp(启动奖励,无距离经验)
  //   - 后续每次打卡:+5 + Math.floor(米数/100) exp
  //   - 上一次打卡点缺失(数据异常)/高德 API 失败/米数 0:本次不拿距离经验
  //     (但首次打卡仍 +10)
  //   - 距离累加逻辑(engine.addDistance)只对"能算到米数"的情况生效
  //
  // 避免双发:_doCheckin 已同步存了 haversine 估算值 expAwarded 到 checkin 事件,
  // 本函数拿到 AMap 精确米数后:
  //   - 首次分支(无上一格):估算就是 10,加 10
  //   - 后续分支:加 (5+⌊amap/100⌋) - expAwarded 的差额,
  //     并调 engine.updateLastCheckinExp() 把事件里 expAwarded 改成精确值
  //   - AMap 失败/为 0:不动,保留 haversine 估算值
  async _accumulateWalkingDistance(currentGrid) {
    const engine = this.data.engine;
    if (!engine) return;
    const state = engine.getState();
    const checkins = (state.checkins || []).filter(c => c.gridIndex !== undefined);
    const isFirstCheckin = checkins.length < 2;

    // 首次打卡:无距离可算,只给 +10 启动奖励
    if (isFirstCheckin) {
      addCumulativeExp(10);
      this._loadCumulativeExpLabel();
      return;
    }

    // checkins 数组按 push 顺序就是时间顺序,倒数第二条就是"上一次"
    // 拍完照后当前 gridIndex 也在 checkins 里,跳过它
    const previousCheckin = checkins[checkins.length - 2];
    if (!previousCheckin) return;
    const previousGrid = engine.map.grids && engine.map.grids[previousCheckin.gridIndex];
    if (!previousGrid || !previousGrid.poi || !previousGrid.poi.location) return;
    if (!currentGrid.poi || !currentGrid.poi.location) return;

    const meters = await fetchWalkingDistanceMeters(
      { lng: previousGrid.poi.location.lng, lat: previousGrid.poi.location.lat },
      { lng: currentGrid.poi.location.lng, lat: currentGrid.poi.location.lat },
    );
    if (!meters || meters <= 0) return;  // API 失败 / 无效数据

    const saveResult = engine.addDistance(meters);
    this._handleSaveResult(saveResult);
    this.syncFromEngine();  // 刷新顶部徒步距离显示

    // 后续打卡经验:基础 +5 + 每 100m +1
    // 1.2km 走下来 +5 + 12 = 17 exp,50m 小区内走 +5 + 0 = 5 exp
    const expExact = 5 + Math.floor(meters / 100);

    // 补差额:避免与 _doCheckin 里 haversine 估算值 expAwarded 双发
    // (估算可能比精确值大或小,我们以精确值为准)
    const checkin = state.checkins[state.checkins.length - 1];
    const expEstimated = (checkin && typeof checkin.expAwarded === 'number') ? checkin.expAwarded : expExact;
    const delta = expExact - expEstimated;
    if (delta !== 0) {
      addCumulativeExp(delta);
    }
    // 把事件里 expAwarded 改成精确值,logs 展示用它
    const updateResult = engine.updateLastCheckinExp(expExact);
    this._handleSaveResult(updateResult);
    this._loadCumulativeExpLabel();
  },

  // 弹出当前格最近一次打卡的庆祝弹窗(查看历史照片)
  _showExistingCheckinPhoto() {
    const engine = this.data.engine;
    const state = engine.getState();
    const grid = engine.getCurrentGrid();
    const checkins = (state.checkins || []).filter(c => c.gridIndex === state.currentGridIndex);
    if (checkins.length === 0) return;
    const last = checkins[checkins.length - 1];
    const ts = new Date(last.timestamp);
    const photoDate = `${ts.getFullYear()}年${ts.getMonth() + 1}月${ts.getDate()}日`;
    this.setData({
      photoCardVisible: true,
      photoCardImage: last.photoUrl || '',
      photoCardLocationName: (grid.poi && grid.poi.name) || '',
      photoCardPhotoDate: photoDate,
      photoCardDescription: (grid.poi && grid.poi.description) || '你到达了新地标，并在这里留下了一张珍贵的照片。',
      // 查看历史照片 → 本次不加经验,传 0 让 wxml 隐藏掉"探索经验"那一行
      photoCardAchievementPoint: 0,
      // 查看已有照片 → 不触发机会卡(只有新打卡才视为"完成"流程)
      photoCardIsNewCheckin: false,
    });
  },

  _showPhotoCard(grid, photoPath) {
    const now = new Date();
    const photoDate = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日`;
    // 预估本次打卡经验(与 _accumulateWalkingDistance 加经验的逻辑保持一致):
    //   - 首次打卡(checkins.length === 1):+10
    //   - 后续:+5 + Math.floor(haversine 直线距离米数/100)
    // haversine 同步算(不调 AMap)—— 拍照弹窗需要立即显示数字,
    // 而米数走 AMap 是异步的。这里不调 AMap 走 haversine 直线 * 1.3 估算步行
    // 距离(与 distanceService 的兑底逻辑一致),保证弹窗与实际加经验数字一致。
    const expAwarded = this._estimateCheckinExp(grid);
    this.setData({
      photoCardVisible: true,
      photoCardImage: photoPath,
      photoCardLocationName: (grid.poi && grid.poi.name) || '',
      photoCardPhotoDate: photoDate,
      photoCardDescription: (grid.poi && grid.poi.description) || '你到达了新地标，并在这里留下了一张珍贵的照片。',
      photoCardAchievementPoint: expAwarded,
      // 新打卡的标志位:onPhotoCardContinue 据此决定是否触发机会卡
      photoCardIsNewCheckin: true,
    });
  },

  // 预估本次打卡应得的经验值(首次 +10,后续 5+haversine/100)
  // 给拍照弹窗同步显示用,实际加分走 _accumulateWalkingDistance 异步
  _estimateCheckinExp(grid) {
    const engine = this.data.engine;
    if (!engine) return 0;
    const state = engine.getState();
    const checkins = (state.checkins || []).filter(c => c.gridIndex !== undefined);
    if (checkins.length < 2) return 10;  // 首次打卡
    if (!grid || !grid.poi || !grid.poi.location) return 5;  // 没坐标走基础 +5
    const previousCheckin = checkins[checkins.length - 2];
    const previousGrid = engine.map.grids && engine.map.grids[previousCheckin.gridIndex];
    if (!previousGrid || !previousGrid.poi || !previousGrid.poi.location) return 5;
    const straight = haversineMeters(
      { lng: previousGrid.poi.location.lng, lat: previousGrid.poi.location.lat },
      { lng: grid.poi.location.lng, lat: grid.poi.location.lat },
    );
    const estimated = Math.round(straight * 1.3);
    return 5 + Math.floor(estimated / 100);
  },

  onPhotoCardContinue() {
    const isNewCheckin = this.data.photoCardIsNewCheckin;
    this._closePhotoCard();
    // 任务:机会卡由"拍照打卡完成"驱动(更刺激用户去打卡)
    // 站在机会格 → 必须拍照打卡 → 弹拍照卡 → 点继续前进才抽卡
    // 跳过拍照流程就不会触发(自动停止后也不再自动弹卡,见 _animateMovement)
    if (!isNewCheckin) return;
    const engine = this.data.engine;
    if (!engine) return;
    const grid = engine.getCurrentGrid();
    if (grid.chanceCards && grid.chanceCards.length > 0) {
      this.showChanceCard();
    }
  },

  onPhotoCardRetake() {
    this._closePhotoCard();
    const engine = this.data.engine;
    if (!engine) return;
    wx.chooseImage({
      count: 1,
      sizeType: ['compressed'],
      sourceType: ['camera'],
      success: (res) => {
        const photoPath = res.tempFilePaths[0];
        const result = engine.replaceCheckinPhoto(photoPath);
        if (result.success) {
          this.syncFromEngine();
          this._showPhotoCard(engine.getCurrentGrid(), photoPath);
        } else if (result.message) {
          wx.showToast({ title: result.message, icon: 'none' });
        }
        this._handleSaveResult(result);
      }
    });
  },

  _closePhotoCard() {
    this.setData({
      photoCardVisible: false,
      photoCardImage: '',
      photoCardLocationName: '',
      photoCardPhotoDate: '',
      photoCardDescription: '',
      photoCardAchievementPoint: 0
    });
  },

  closeModal() {
    this.setData({ modalVisible: false });
  },

  stopBubble() {},

  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
});
