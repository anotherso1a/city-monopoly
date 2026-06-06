// 存储服务 - 封装微信 localStorage
// 数据形态：maps: Array<Map>，每项包含完整定义 + currentGame: GameState | null
// games key 不再使用，旧数据用户手动清

const StorageService = {
  // 获取所有保存的地图
  // 返回：地图数组
  getMaps() {
    return wx.getStorageSync('maps') || [];
  },

  // 根据 ID 获取单个地图
  getMap(id) {
    return this.getMaps().find(m => m.id === id);
  },

  // 保存地图（upsert by id）。
  // 自动归一化：保证写入的 map 一定有 currentGame 字段（null 也算）。
  // 返回 { saved, reason? }：成功 { saved: true }；配额不足 { saved: false, reason: 'quota_exceeded' }
  saveMap(map) {
    const normalized = { ...map, currentGame: map.currentGame ?? null };

    const usage = this.getStorageUsage();
    if (usage.percent >= 1.0) {
      return { saved: false, reason: 'quota_exceeded' };
    }

    try {
      const maps = this.getMaps();
      const idx = maps.findIndex(m => m.id === normalized.id);
      if (idx >= 0) {
        maps[idx] = normalized;
      } else {
        maps.push(normalized);
      }
      wx.setStorageSync('maps', maps);
      return { saved: true };
    } catch (e) {
      return { saved: false, reason: 'quota_exceeded' };
    }
  },

  // 删除地图（自然级联 currentGame）
  deleteMap(id) {
    const maps = this.getMaps().filter(m => m.id !== id);
    wx.setStorageSync('maps', maps);
  },

  // 更新某地图的游戏进度。找不到对应 map 时返回 map_not_found，不写盘。
  // 返回 { saved, reason? }
  updateMapGameState(mapId, gameState) {
    const map = this.getMap(mapId);
    if (!map) {
      return { saved: false, reason: 'map_not_found' };
    }
    return this.saveMap({ ...map, currentGame: gameState });
  },

  // 获取存储用量信息
  // 返回 { usedKB, limitKB, percent }；wx.getStorageInfoSync 不可用时返回 0/10240/0
  getStorageUsage() {
    try {
      const info = wx.getStorageInfoSync();
      const usedKB = info.currentSize || 0;
      const limitKB = info.limitSize || 10240;
      return {
        usedKB,
        limitKB,
        percent: limitKB > 0 ? usedKB / limitKB : 0,
      };
    } catch (e) {
      return { usedKB: 0, limitKB: 10240, percent: 0 };
    }
  },

  // 累计探索经验 —— 跨地图/跨局累加,存在 user-level 存储 key 而非 map 内
  // 这样删除地图不会丢失;用户清空 storage 才会重置(等于重置全部进度)
  // 返回累计经验值(数字,默认 0)
  getCumulativeExp() {
    return wx.getStorageSync('cumulativeExp') || 0;
  },

  // 累加 delta(通常 +1),返回新的累计值
  addCumulativeExp(delta = 1) {
    const next = this.getCumulativeExp() + delta;
    wx.setStorageSync('cumulativeExp', next);
    return next;
  },

  // 生成唯一 ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  },
};

// 便捷导出
const getMap = (id) => StorageService.getMap(id);
const getMaps = () => StorageService.getMaps();
const saveMap = (map) => StorageService.saveMap(map);
const deleteMap = (id) => StorageService.deleteMap(id);
const updateMapGameState = (mapId, state) => StorageService.updateMapGameState(mapId, state);
const getStorageUsage = () => StorageService.getStorageUsage();
const generateId = () => StorageService.generateId();
const getCumulativeExp = () => StorageService.getCumulativeExp();
const addCumulativeExp = (delta) => StorageService.addCumulativeExp(delta);

module.exports = {
  getMap,
  getMaps,
  saveMap,
  deleteMap,
  updateMapGameState,
  getStorageUsage,
  generateId,
  getCumulativeExp,
  addCumulativeExp,
};
