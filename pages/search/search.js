// search 页面 - 基于 design/search.html 转换
// 主路径: input 关键词 -> 点搜索按钮 / 键盘搜索键 -> 高德 getInputtips 搜 -> 列表选点
// 备选: "在地图上选" -> 拉起 wx.chooseLocation 调微信原生地图
// 选中后通过 eventChannel emit POI 回传给 create 页面

const { searchPoiByKeyword } = require('../../services/poiService');
const analytics = require('../../services/analytics');

Page({
  data: {
    query: '',
    searchFocused: false,
    results: [],
    loading: false,
    hasSearched: false,
    eventChannel: null,
    navBarHeight: 88
  },

  onLoad() {
    analytics.trackEvent(analytics.EVENT.PAGE_VIEW, { page: 'search' });
    this.setData({ eventChannel: this.getOpenerEventChannel() });
  },

  onNavHeightChange(e) {
    this.setData({ navBarHeight: e.detail.height });
  },

  onQueryInput(e) {
    this.setData({ query: e.detail.value });
  },

  onSearchFocus() {
    this.setData({ searchFocused: true });
  },

  onSearchBlur() {
    this.setData({ searchFocused: false });
  },

  onSearchSubmit() {
    const query = (this.data.query || '').trim();
    if (!query) return;
    this._runSearch(query);
  },

  onClearQuery() {
    this.setData({ query: '', results: [], hasSearched: false });
  },

  async _runSearch(query) {
    this.setData({ loading: true });
    const t0 = Date.now();
    try {
      const results = await searchPoiByKeyword(query);
      this.setData({ results, hasSearched: true, loading: false });
      analytics.trackPerf(analytics.EVENT.API_LATENCY_AMAP_INPUTTIPS, {
        query_len: query.length,
        result_count: (results || []).length,
      }, Date.now() - t0);
    } catch (err) {
      this.setData({ results: [], hasSearched: true, loading: false });
      analytics.reportError(analytics.EVENT.ERROR_API_AMAP, { stage: 'inputtips' }, err);
      wx.showToast({ title: '搜索失败，请重试', icon: 'none' });
    }
  },

  // 主路径: 用户点击搜索结果 -> 回传 POI
  onResultTap(e) {
    const { id } = e.currentTarget.dataset;
    const item = this.data.results.find(r => r.id === id);
    if (!item) return;
    this._emitPoi(item);
  },

  // 备选路径: 拉起微信原生地图选点
  onChooseFromMap() {
    wx.chooseLocation({
      success: (res) => {
        const poi = {
          id: `wx-${res.name}-${Date.now()}`,
          name: res.name,
          address: res.address || '',
          district: '',
          type: '',
          typecode: '',
          location: { lat: res.latitude, lng: res.longitude }
        };
        this._emitPoi(poi);
      },
      fail: (err) => {
        console.error('[search] wx.chooseLocation failed:', err);
        const msg = (err && err.errMsg) || '';

        if (msg.indexOf('cancel') !== -1) return; // 用户主动取消

        if (msg.indexOf('auth') !== -1 || msg.indexOf('authorize') !== -1) {
          wx.showModal({
            title: '需要位置权限',
            content: '请在设置中允许使用位置信息后再试',
            confirmText: '去设置',
            success: (r) => { if (r.confirm) wx.openSetting(); }
          });
          return;
        }

        // 其他错误: 可能是 requiredPrivateInfos 缺失 / 模拟器无定位 / 网络问题
        wx.showToast({ title: `地图选点失败: ${msg || '未知错误'}`, icon: 'none', duration: 3000 });
      }
    });
  },

  _emitPoi(poi) {
    const ec = this.data.eventChannel;
    if (ec && typeof ec.emit === 'function') {
      ec.emit('acceptPoiFromSearch', poi);
    }
    wx.navigateBack();
  }
});
