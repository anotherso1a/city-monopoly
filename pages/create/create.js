// createtest 页面 - 新 UI + create 页面逻辑
// 支持定位、选择搜索半径、格子数量、金币配置等

// 引入 POI 服务 - 用于获取周边地点
const { fetchPOIsForMap } = require('../../services/poiService');
// 引入 AI 服务 - 用于生成地图
const { generateMap } = require('../../services/aiService');
// 引入存储服务 - 用于保存地图
const { saveMap } = require('../../utils/storage');
// 引入常量 - 金币默认配置
const { INITIAL_GOLD, LAP_REWARD_GOLD } = require('../../utils/constants');
// 引入 POI tag 分组 - step 2 让用户选偏好
const { POI_TAG_GROUPS } = require('../../services/poiCategories');
// 埋点
const analytics = require('../../services/analytics');

// 地图默认中心 — 用户未定位时用(北京天安门,中性兜底)
const DEFAULT_MAP_CENTER = { lat: 39.908823, lng: 116.397470 };
// POI 标记上限 — 微信原生 <map> markers 太多会卡,只标前 N 个
const POI_MARKER_LIMIT = 30;

// 从 N 个 tag 中随机抽 3-4 个,作为 step 2 的默认选中
// 防止用户进入 step 2 后直接点下一步不做选择
const randomSelectTags = () => {
  const count = 3 + Math.floor(Math.random() * 2);  // 3 或 4
  const shuffled = [...POI_TAG_GROUPS].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(t => t.id);
};

// 把 POI 列表转为 <map> markers 格式
// 原生 <map> markers 限制:id 必须是数字,iconPath 可选(没设就用默认气泡)
const buildMapMarkers = (pois, userLocation) => {
  const markers = [];
  if (userLocation) {
    // 第一个 marker 永远是用户当前位置(高亮)
    markers.push({
      id: 0,
      latitude: userLocation.latitude,
      longitude: userLocation.longitude,
      width: 24,
      height: 24,
      // 红色 marker,用 system marker(自带)
      // callout 点击显示 — 暂不需要
    });
  }
  pois.slice(0, POI_MARKER_LIMIT).forEach((p, i) => {
    if (!p.location) return;
    markers.push({
      id: i + 1,
      latitude: p.location.lat,
      longitude: p.location.lng,
      width: 20,
      height: 20,
      callout: {
        content: p.name,
        color: '#514532',
        fontSize: 12,
        borderRadius: 4,
        padding: 4,
        display: 'BYCLICK',  // 点击才显示,避免遮挡
      },
    });
  });
  return markers;
};

Page({
  data: {
    step: 1,                    // 当前步骤（1-4）
    selectedRange: 1,           // 选中的范围索引（0=500m, 1=1km, 2=1.5km）
    rangeSizeClass: '',         // 范围圆圈样式类
    location: null,            // 用户位置 { latitude, longitude, address }
    gettingLocation: false,    // 是否正在获取定位
    range: 1000,               // POI 搜索半径（米）
    mapName: '',               // 地图名称
    gridCount: 20,             // 格子数量
    allowRepeatCheckin: false, // 是否允许重复打卡
    initialGold: INITIAL_GOLD, // 初始金币
    lapRewardGold: LAP_REWARD_GOLD,  // 绕圈奖励金币
    generating: false,         // 是否正在生成地图
    poiLoading: false,         // step 2 POI 预检 loading
    generatedMap: null,        // 生成的地图数据
    navBarHeight: 88,
    insufficientPoiError: null,  // { found, needed } 或 null
    tagGroups: POI_TAG_GROUPS,   // 静态 tag 列表(step 2 渲染用)
    selectedTags: [],            // 用户选中的 tag id 数组,onLoad 随机初始化
    mapIdea: '',                 // 玩家偏好描述(step 3 输入)

    // 原生 <map> 相关
    mapCenterLat: DEFAULT_MAP_CENTER.lat,
    mapCenterLng: DEFAULT_MAP_CENTER.lng,
    mapMarkers: [],              // 原生 <map> markers 数据
    mapScale: 16,                // 缩放级别,值越大越详细
    amapSubkey: '',              // 微信原生 map 用腾讯底图,不需要 AMap key,留空
  },

  onNavHeightChange(e) {
    this.setData({ navBarHeight: e.detail.height });
  },

  onLoad() {
    analytics.trackEvent(analytics.EVENT.PAGE_VIEW, { page: 'create' });
    this.updateRangeSize();
    this.getLocation();
    this.setData({ selectedTags: randomSelectTags() });
  },

  // 切换 tag 选中状态
  onTagToggle(e) {
    const tagId = e.currentTarget.dataset.id;
    const { selectedTags } = this.data;
    const idx = selectedTags.indexOf(tagId);
    if (idx >= 0) {
      this.setData({ selectedTags: selectedTags.filter(id => id !== tagId) });
    } else {
      this.setData({ selectedTags: [...selectedTags, tagId] });
    }
  },

  // 重新随机一组默认 tag(用户主动触发)
  onRandomizeTags() {
    this.setData({ selectedTags: randomSelectTags() });
  },

  // 玩家偏好描述输入
  onMapIdeaInput(e) {
    this.setData({ mapIdea: e.detail.value || '' });
  },

  // 跳转到搜索页选点, 通过 eventChannel 回传 POI
  onSearchHintTap() {
    wx.navigateTo({
      url: '/pages/search/search',
      events: {
        acceptPoiFromSearch: (poi) => {
          if (!poi) return;
          const location = {
            latitude: poi.location.lat,
            longitude: poi.location.lng,
            address: poi.name + (poi.address ? `（${poi.address}）` : '')
          };
          this.setData({
            location,
            mapCenterLat: location.latitude,
            mapCenterLng: location.longitude,
            // 选了新中心点后清掉旧 markers,等 step 2 POI 预检再标
            mapMarkers: buildMapMarkers([], location),
          });
          wx.showToast({ title: `已选：${poi.name}`, icon: 'none' });
        }
      }
    });
  },

  onRangeSelect(e) {
    const index = parseInt(e.currentTarget.dataset.index);
    this.setData({ selectedRange: index });
    this.updateRangeSize();
  },

  updateRangeSize() {
    const sizes = ['size-small', '', 'size-large'];
    this.setData({ rangeSizeClass: sizes[this.data.selectedRange] || '' });
    // 更新 range 值（500m, 1000m, 1500m）
    const rangeValues = [500, 1000, 1500];
    this.setData({ range: rangeValues[this.data.selectedRange] });
  },

  // 获取用户当前位置
  getLocation() {
    this.setData({ gettingLocation: true });

    wx.getLocation({
      type: 'gcj02',
      success: (res) => {
        const { latitude, longitude } = res;
        const location = { latitude, longitude, address: '已获取定位' };
        // 定位成功 — 地图中心 + 标用户当前位置
        this.setData({
          location,
          gettingLocation: false,
          mapCenterLat: latitude,
          mapCenterLng: longitude,
          mapMarkers: buildMapMarkers(this._cachedPois || [], location),
        });
      },
      fail: () => {
        this.setData({ gettingLocation: false });
        wx.showToast({ title: '获取位置失败', icon: 'none' });
      }
    });
  },

  // 选择格子数量
  selectGridCount(e) {
    this.setData({ gridCount: parseInt(e.currentTarget.dataset.count) });
  },

  // 切换是否允许重复打卡
  onAllowRepeatChange(e) {
    this.setData({ allowRepeatCheckin: e.detail.value });
  },

  // 地图名称输入
  onMapNameInput(e) {
    this.setData({ mapName: e.detail.value });
  },

  // 初始金币输入
  onInitialGoldInput(e) {
    this.setData({ initialGold: parseInt(e.detail.value) || INITIAL_GOLD });
  },

  // 绕圈奖励金币输入
  onLapRewardInput(e) {
    this.setData({ lapRewardGold: parseInt(e.detail.value) || LAP_REWARD_GOLD });
  },

  async nextStep() {
    // step 2 → 3:POI 预检 + 加载状态
    // 关键变化:之前预检在 step 1→2 用 default range;现在用用户在 step 2 选的实际 range
    if (this.data.step === 2) {
      if (!this.data.location) {
        wx.showToast({ title: '请先获取位置', icon: 'none' });
        return;
      }
      if (this.data.selectedTags.length === 0) {
        wx.showToast({ title: '至少选一个想去的地方', icon: 'none' });
        return;
      }
      // 防并发:POI 预检异步期间,双击下一步 / 扩大范围都会进这里
      if (this._fetchingPois) return;

      this._fetchingPois = true;
      this.setData({ poiLoading: true });
      try {
        const { location, range, selectedTags } = this.data;
        const pois = await fetchPOIsForMap({
          location: `${location.longitude},${location.latitude}`,
          radius: range,
          tags: selectedTags,
        });
        this._cachedPois = pois;

        // 拿到 POI 后刷新地图 markers — 让玩家直观看到周边候选点
        this.setData({
          mapMarkers: buildMapMarkers(pois, location),
        });

        if (pois.length < this.data.gridCount) {
          this.setData({
            insufficientPoiError: { found: pois.length, needed: this.data.gridCount },
          });
          return;  // 不前进,等用户选 3 个动作之一
        }
        this.setData({ insufficientPoiError: null });
      } catch (err) {
        console.error('POI 预检失败:', err);
        analytics.reportError(analytics.EVENT.ERROR_API_POI, { stage: 'precheck' }, err);
        wx.showToast({ title: 'POI 获取失败,请重试', icon: 'none' });
        return;  // 留在 step 2 让用户重试
      } finally {
        this._fetchingPois = false;
        this.setData({ poiLoading: false });
      }
    }
    this.setData({ step: this.data.step + 1 });
    if (this.data.step === 4) {
      this.startGenerateMap();
    }
    // step 3 → 4 算正式开始生成(用户在 step 1-3 收集了 location/tags/gridCount/idea)
    if (this.data.step === 4) {
      analytics.trackEvent(analytics.EVENT.MAP_CREATE_START, {
        location_type: this.data.location ? 'gps' : 'fallback',
        tag_count: this.data.selectedTags.length,
      });
    }
  },

  prevStep() {
    if (this.data.step > 1) {
      this.setData({ step: this.data.step - 1 });
    }
  },

  // 开始生成地图
  async startGenerateMap() {
    const { location, mapName, gridCount, allowRepeatCheckin, initialGold, lapRewardGold, mapIdea } = this.data;

    if (!location) {
      wx.showToast({ title: '请先获取位置', icon: 'none' });
      return;
    }

    this.setData({ generating: true });

    // 最小展示时长 — 让 drawing-progress 动画能被看见
    // mock 数据返回几乎是瞬时的,真实接口可能有几百 ms,补到 2500ms 是合适的体验下限
    // 真实接口本身慢于这个值时,不会多等
    const MIN_DURATION_MS = 2500;
    const startTime = Date.now();

    try {
      const pois = this._cachedPois;

      const finalMapName = mapName || `我的探索-${new Date().toLocaleDateString()}`;

      const mapConfig = {
        name: finalMapName,
        gridCount,
        allowRepeatCheckin,
        initialGold,
        lapRewardGold,
        mapIdea,  // 玩家偏好描述,可空;aiService 会用 <<<USER_MAP_IDEA>>> 包裹传给 LLM
      };

      const generatedMap = await generateMap(pois, mapConfig);

      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, MIN_DURATION_MS - elapsed);
      if (remaining > 0) {
        await new Promise(resolve => setTimeout(resolve, remaining));
      }

      this.setData({ generatedMap, generating: false });
      // 成功埋点 —— LLM 实际耗时(不含最小展示)
      analytics.trackEvent(analytics.EVENT.MAP_CREATE_SUCCESS, {
        duration_ms: elapsed,
        poi_count: pois ? pois.length : 0,
        llm_used: true,
      });
      // POI 过滤比例(若有)
      if (pois) {
        analytics.trackEvent(analytics.EVENT.POI_COUNT_FILTERED, {
          before: pois.length,
          after: pois.length,
          filter_ratio: 1.0,
        });
      }
    } catch (err) {
      console.error('生成地图失败:', err);
      analytics.reportError(analytics.EVENT.MAP_CREATE_FAIL, { duration_ms: Date.now() - startTime }, err);
      this.setData({ generating: false });
      wx.showToast({ title: '生成地图失败', icon: 'none' });
    }
  },

  // 重新生成地图
  regenerateMap() {
    this.startGenerateMap();
  },

  // 保存地图
  saveMap() {
    const { generatedMap } = this.data;
    if (!generatedMap) return;

    saveMap(generatedMap);

    wx.showToast({ title: '地图已保存', icon: 'success' });

    setTimeout(() => {
      wx.navigateTo({ url: `/pages/game/game?mapId=${generatedMap.id}` });
    }, 1500);
  },

  // POI 不足 - 重新定位:清空 location 和缓存,回到 step 1
  onPoiErrorRelocate() {
    this.setData({
      insufficientPoiError: null,
      location: null,
      step: 1,
    });
    this._cachedPois = null;
  },

  // POI 不足 - 用现有数额:gridCount 降为 found,跳到 step 3(跳过预检)
  onPoiErrorUseExisting() {
    const { found } = this.data.insufficientPoiError;
    this.setData({
      insufficientPoiError: null,
      gridCount: found,
      step: 3,
    });
  },

  // POI 不足 - 扩大搜索范围:升一档 range(假设共 3 档:500/1000/1500),
  // 已是最大档则直接返回。重新触发 nextStep 走预检
  onPoiErrorExpandRange() {
    if (this.data.selectedRange >= 2) return;  // 0/1/2,已最大
    this.setData({
      selectedRange: this.data.selectedRange + 1,
      insufficientPoiError: null,
    });
    this.updateRangeSize();
    this.nextStep();
  }
});