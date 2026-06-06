// 小程序全局入口文件
// 初始化全局数据和管理地图存储

const { getStorageUsage } = require('./utils/storage');
const { loadProfile } = require('./utils/userProfile');
const analytics = require('./services/analytics');

App({
  // 全局数据 - 可通过 getApp() 获取
  globalData: {
    maps: [],                       // 保存的所有地图列表
    userProfile: null,              // 由 onLaunch / 各页面 loadUserProfile 加载(可能为 null)
    _coldStartTime: 0,              // 冷启动时间戳 —— onLaunch 入口设,onLaunch 末尾报
  },

  // 小程序启动时执行
  onLaunch(options) {
    this.globalData._coldStartTime = Date.now();
    this._registerGlobalErrorHandlers();
    this.loadMapsFromStorage();
    this.globalData.userProfile = loadProfile();
    this.handleOpenMapFile(options);
    this.checkStorageQuota();
    // 冷启动耗时
    analytics.trackPerf(
      analytics.EVENT.APP_COLD_START,
      {},
      Date.now() - this.globalData._coldStartTime
    );
  },

  // 注册全局错误处理 —— 转发到埋点
  _registerGlobalErrorHandlers() {
    // JS 同步错误
    if (typeof wx.onError === 'function') {
      wx.onError((err) => {
        analytics.reportError(analytics.EVENT.ERROR_GLOBAL, {}, err);
      });
    }
    // Promise 未捕获 reject
    if (typeof wx.onUnhandledRejection === 'function') {
      wx.onUnhandledRejection((res) => {
        const reason = (res && (res.reason || res)) || 'unknown';
        analytics.reportError(analytics.EVENT.ERROR_PROMISE, {}, reason);
      });
    }
  },

  // 启动时检查存储用量，超过 80% 弹非阻塞 modal + 埋点预警
  checkStorageQuota() {
    const usage = getStorageUsage();
    if (usage.percent > analytics.ALERT_THRESHOLDS.STORAGE_USAGE_PERCENT) {
      const usedMB = (usage.usedKB / 1024).toFixed(1);
      const limitMB = (usage.limitKB / 1024).toFixed(0);
      // 预警埋点 —— ops 看到 dashboard 报警
      analytics.fireAlert(analytics.EVENT.ALERT_STORAGE_USAGE, {
        percent: usage.percent,
        used_mb: parseFloat(usedMB),
        limit_mb: parseFloat(limitMB),
      });
      wx.showModal({
        title: '本地存储快满了',
        content: `已用 ${usedMB} MB（共 ${limitMB} MB），建议删除部分地图释放空间`,
        confirmText: '去看看',
        cancelText: '知道了',
        success: (res) => {
          if (res.confirm) {
            wx.navigateTo({ url: '/pages/history/history' });
          }
        }
      });
    }
  },

  // 小程序从后台进入前台时执行
  onShow(options) {
    // 热启动耗时(从后台回前台)
    const warmStart = Date.now();
    this.handleOpenMapFile(options);  // 处理打开地图文件
    analytics.trackPerf(analytics.EVENT.APP_WARM_START, {}, Date.now() - warmStart);
  },

  // 处理打开地图文件 (从分享或 URL scheme)
  handleOpenMapFile(options) {
    let filePath = null;

    // 处理文件分享场景 (scene 1044)
    if (options.scene === 1044 && options.referrerInfo) {
      filePath = options.referrerInfo.extraData?.filePath;
    }

    // 处理 URL scheme 等方式传递的 file 参数
    if (!filePath && options.query && options.query.file) {
      filePath = options.query.file;
    }

    if (!filePath) return;

    const { importMapFromFile } = require('./services/shareService');
    importMapFromFile(filePath)
      .then((mapData) => {
        if (!mapData) throw new Error('无效的地图数据');
        // Update global maps list if needed
        if (this.globalData && this.globalData.maps) {
          const exists = this.globalData.maps.find(m => m.id === mapData.id);
          if (!exists) {
            this.globalData.maps.push(mapData);
            this.saveMapsToStorage();
          }
        }
        wx.showToast({ title: '地图导入成功', icon: 'success' });
      })
      .catch((err) => {
        wx.showToast({ title: err.message || '导入失败', icon: 'none' });
      });
  },

  // 从 localStorage 加载地图数据到全局变量
  loadMapsFromStorage() {
    const maps = wx.getStorageSync('maps') || [];  // 从 storage 获取 maps，无则为空数组
    this.globalData.maps = maps;  // 设置到全局数据
  },

  // 将全局地图数据保存到 localStorage
  saveMapsToStorage() {
    wx.setStorageSync('maps', this.globalData.maps);  // 写入 storage
  }
});