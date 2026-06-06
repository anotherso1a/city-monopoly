// edit 页面 - 基于 design/edit.html
// 合并 edit.js 逻辑，支持拖拽排序和完整编辑功能

const { getMap, generateId, saveMap } = require('../../utils/storage');
const analytics = require('../../services/analytics');

Page({
  data: {
    // 地图信息
    mapId: '',
    mapName: '伦敦雾',
    navBarHeight: 88,
    activeTileId: 1,

    // 地块列表数据（用于拖拽排序的位置计算）
    tiles: [
      { id: 1, name: '苏豪广场', desc: '伦敦市中心的繁华地带。', type: '商业', goldReward: 1200, taxRate: 5 },
      { id: 2, name: '牛津街', desc: '著名的商业街道。', type: '商业', goldReward: 800, taxRate: 4 },
      { id: 3, name: '摄政街', desc: '遍布奢华商店。', type: '商业', goldReward: 1500, taxRate: 6 },
      { id: 4, name: '邦德街', desc: '最贵的商业地产之一。', type: '商业', goldReward: 2000, taxRate: 8 }
    ],

    // 拖拽排序相关数据
    positionList: [],      // 位置列表
    countOneLine: 1,        // 纵向排序，每行1个
    outWidth: 654,         // 容器宽度 (rpx)
    itemWidth: 654,         // 每个元素宽度
    itemHeight: 120,        // 每个元素高度 (rpx)
    nowDragIndex: -1,       // 当前拖拽的索引
    showLine: -1,           // 显示位置指示线
    pxPerRpx: 0.5,          // 像素与rpx的换算比例

    // 编辑表单数据
    nodeName: '苏豪广场',
    nodeDesc: '伦敦市中心的繁华地带。',
    nodeAddress: '',
    nodeType: '商业',
    goldReward: 1200,
    taxRate: 5
  },

  onLoad(options) {
    analytics.trackEvent(analytics.EVENT.PAGE_VIEW, { page: 'edit', map_id: (options && (options.id || options.mapId)) || null });
    // 获取 px 与 rpx 的换算比例
    // 在 iPhone6 (750rpx 宽) 中，屏幕宽度 375px，所以 1px = 2rpx，即 1rpx = 0.5px
    // 不同设备比例可能不同，需要动态获取
    const systemInfo = wx.getSystemInfoSync();
    const pxPerRpx = systemInfo.windowWidth / 750;

    const { id, mapId } = options;
    const targetId = id || mapId;

    if (targetId) {
      // 从存储加载地图
      const mapData = getMap(targetId);
      if (mapData) {
        // 转换 grids 为 tiles 格式
        const tiles = this.convertGridsToTiles(mapData.grids || []);
        this.setData({
          mapId: targetId,
          mapName: mapData.config?.name || mapData.name || '伦敦雾',
          tiles: tiles,
          pxPerRpx: pxPerRpx
        });
        this.initPositionList();
        this.selectTile(tiles[0]?.id);
        return;
      }
    }

    // 使用默认数据，初始化位置列表
    this.setData({ pxPerRpx: pxPerRpx });
    this.initPositionList();
    this.selectTile(1);
  },

  onNavHeightChange(e) {
    this.setData({ navBarHeight: e.detail.height });
  },

  // 将 grids 数据转换为 tiles 格式
  // 每个格子都是 POI;_chanceCards 是隐藏字段,只在 round-trip 时回写,不参与 UI
  convertGridsToTiles(grids) {
    return grids.map((grid, index) => ({
      id: index + 1,
      name: grid.poi?.name || '未命名',
      desc: grid.poi?.description || '',
      type: grid.poi?.type || '商业',
      goldReward: grid.poi?.goldReward || 0,
      taxRate: grid.poi?.taxRate || 0,
      address: grid.poi?.address || '',
      _chanceCards: grid.chanceCards,
    }));
  },

  // 将 tiles 转换回 grids 格式
  // 编辑只动 POI 字段;卡组由 _chanceCards 原样写回,避免编辑 POI 时丢卡
  convertTilesToGrids(tiles) {
    return tiles.map((tile, index) => ({
      index,
      type: 'poi',
      poi: {
        name: tile.name,
        description: tile.desc,
        type: tile.type,
        goldReward: tile.goldReward,
        taxRate: tile.taxRate,
        address: tile.address || ''
      },
      chanceCards: tile._chanceCards,
    }));
  },

  // 初始化位置列表
  initPositionList() {
    const { tiles, countOneLine, outWidth, itemWidth, itemHeight } = this.data;
    const positionList = tiles.map((tile, index) => {
      const row = Math.floor(index / countOneLine);
      const col = index % countOneLine;
      return {
        id: tile.id,
        name: tile.name,
        left: col * itemWidth,
        boxTop: row * itemHeight
      };
    });
    this.setData({
      positionList,
      outWidth: countOneLine * itemWidth
    });
  },

  onTileSelect(e) {
    const tileId = e.currentTarget.dataset.id;
    this.selectTile(tileId);
  },

  selectTile(id) {
    const tile = this.data.tiles.find(t => t.id === id);
    if (tile) {
      this.setData({
        activeTileId: id,
        nodeName: tile.name,
        nodeDesc: tile.desc,
        nodeAddress: tile.address || '',
        nodeType: tile.type,
        goldReward: tile.goldReward,
        taxRate: tile.taxRate
      });
    }
  },

  onToolSelect(e) {
    const tool = e.currentTarget.dataset.tool;

    // 根据工具类型执行对应操作
    if (tool === 'delete') {
      this.onDeleteTile();
    } else if (tool === 'add') {
      this.onAddTile();
    }
  },

  onNameInput(e) {
    this.setData({ nodeName: e.detail.value });
    this.updateTileData('name', e.detail.value);
  },

  onDescInput(e) {
    this.setData({ nodeDesc: e.detail.value });
    this.updateTileData('desc', e.detail.value);
  },

  onAddressInput(e) {
    const address = e.detail.value;
    this.updateTileData('address', address);
  },

  onTypeSelect(e) {
    const type = e.currentTarget.dataset.type;
    this.setData({ nodeType: type });
    this.updateTileData('type', type);
  },

  onGoldInput(e) {
    const goldReward = parseInt(e.detail.value) || 0;
    this.setData({ goldReward });
    this.updateTileData('goldReward', goldReward);
  },

  onTaxInput(e) {
    const taxRate = parseInt(e.detail.value) || 0;
    this.setData({ taxRate });
    this.updateTileData('taxRate', taxRate);
  },

  // 更新 tiles 数组中指定 id 的字段
  updateTileData(key, value) {
    const tiles = this.data.tiles.map(t =>
      t.id === this.data.activeTileId ? { ...t, [key]: value } : t
    );
    this.setData({ tiles });
  },

  onApply() {
    // 应用修改 - 将表单数据同步到 tiles 数组
    const { activeTileId, nodeName, nodeDesc, nodeAddress, nodeType, goldReward, taxRate, tiles } = this.data;
    const updatedTiles = tiles.map(t =>
      t.id === activeTileId
        ? { ...t, name: nodeName, desc: nodeDesc, address: nodeAddress, type: nodeType, goldReward, taxRate }
        : t
    );
    this.setData({ tiles: updatedTiles });
    wx.showToast({
      title: '修改已应用',
      icon: 'success'
    });
  },

  // ========== 拖拽排序相关 ==========

  // 拖拽超时计时器ID，用于取消拖动
  dragTimeoutTimer: null,

  // 拖拽过程中计算位置
  // 核心思路：计算被拖动元素相对于原始位置的偏移量，来确定目标插入位置
  drag(e) {
    // 从 data 中获取所需数据
    const { tiles, itemHeight, nowDragIndex, positionList, pxPerRpx } = this.data;
    // movable-view 实时返回的 y 坐标（单位是 px）
    const y = e.detail.y;

    // 如果没有正在拖动的元素，直接返回
    if (nowDragIndex < 0) return;

    // 获取被拖动元素在 positionList 中的原始 y 坐标（单位是 rpx）
    // 例如：第4个元素（索引3），itemHeight=120rpx，则 boxTop = 3 * 120 = 360rpx
    const draggedOriginalYRpx = positionList[nowDragIndex]?.boxTop || 0;

    // 将原始 y 坐标从 rpx 转换为 px
    // 因为 e.detail.y 返回的是 px 单位，需要统一
    const draggedOriginalY = draggedOriginalYRpx * pxPerRpx;

    // 计算当前 y 坐标与原始位置的差值（单位统一为 px）
    // 向下拖动：offsetY > 0（正值）
    // 向上拖动：offsetY < 0（负值）
    const offsetY = y - draggedOriginalY;

    // 将 offsetY 从 px 转换回 rpx，再计算偏移了几个"位置"
    // itemHeight=120rpx，如果 offsetY=60px，换算后 offsetYRpx = 60 / pxPerRpx
    // 向下拖动60px：offsetItems = 1，向下拖动30px：offsetItems = 0.5
    const offsetYRpx = offsetY / pxPerRpx;
    const offsetItems = Math.round(offsetYRpx / itemHeight);

    // 计算目标索引：原始索引 + 偏移量
    // 然后用 Math.min/Math.max 限制在有效范围内 [0, tiles.length - 1]
    const targetIndex = Math.min(Math.max(nowDragIndex + offsetItems, 0), tiles.length - 1);
    console.log('[drag] draggedOriginalY:', draggedOriginalY, 'offsetY(px):', offsetY, 'offsetYRpx:', offsetYRpx, 'offsetItems:', offsetItems, 'targetIndex:', targetIndex);

    // 更新 showLine，WXML 中 showLine === index 的元素会显示蓝色插入线
    this.setData({ showLine: targetIndex });

    // 重置拖拽超时计时器
    // 如果 300ms 内没有新的 drag 或 touchend 事件触发，则认为用户取消了拖动
    this.resetDragTimeout();
  },

  // 重置拖拽超时计时器
  resetDragTimeout() {
    // 清除之前的计时器
    if (this.dragTimeoutTimer) {
      clearTimeout(this.dragTimeoutTimer);
    }
    // 设置新的计时器，300ms 后如果还在拖动状态则自动还原
    this.dragTimeoutTimer = setTimeout(() => {
      console.log('[dragTimeout] drag timeout, resetting');
      this.resetDragState();
    }, 300);
  },

  // 还原拖动状态
  resetDragState() {
    const { nowDragIndex, positionList, itemHeight } = this.data;
    if (nowDragIndex < 0) return;

    console.log('[resetDragState] nowDragIndex:', nowDragIndex);

    // 重置 positionList 到原始位置
    const restoredPositionList = positionList.map((pos, index) => ({
      ...pos,
      boxTop: index * itemHeight
    }));

    this.setData({
      nowDragIndex: -1,
      showLine: -1,
      positionList: restoredPositionList
    });
  },

  // movable-view 的 bindchange 事件处理器
  // 当 movable-view 被拖动时会持续触发此函数
  onMovableViewChange(e) {
    // e.currentTarget.dataset.myindex 是当前被拖动的 movable-view 的索引
    // 注意：微信小程序中，wx:for 循环的 index 需要通过这种方式获取
    const { nowDragIndex } = this.data;
    const myindex = e.currentTarget.dataset.myindex;
    console.log('[onMovableViewChange] myindex:', myindex, 'nowDragIndex:', nowDragIndex);

    // nowDragIndex === -1 表示这是拖动开始的第一帧
    // 此条件只会在第一次触发 change 事件时为 true
    if (nowDragIndex === -1 && myindex !== undefined) {
      // 开始拖动时，立即设置 showLine 为当前位置
      // 这样蓝色指示线会立刻显示出来，提升用户体验
      this.setData({ nowDragIndex: myindex, showLine: myindex });
    }
    // 执行位置计算逻辑
    this.drag(e);
  },

  // movable-view 的 bindtouchend 事件处理器
  // 当手指松开时触发，此时需要完成排序操作
  onMovableViewTouchEnd(e) {
    console.log('[onMovableViewTouchEnd] e.detail:', JSON.stringify(e.detail));

    // 从 data 中获取当前状态
    const { showLine, nowDragIndex, positionList } = this.data;
    console.log('[onMovableViewTouchEnd] showLine:', showLine, 'nowDragIndex:', nowDragIndex);
    console.log('[onMovableViewTouchEnd] positionList:', JSON.stringify(positionList));

    // 在重置状态前保存当前值
    // 因为 setData 是异步的，直接使用 nowDragIndex 在后续判断中可能已变化
    const savedShowLine = showLine;
    const savedNowDragIndex = nowDragIndex;
    console.log('[onMovableViewTouchEnd] saved:', savedNowDragIndex, '->', savedShowLine);

    // 清除拖拽超时计时器
    if (this.dragTimeoutTimer) {
      clearTimeout(this.dragTimeoutTimer);
      this.dragTimeoutTimer = null;
    }

    // 重置拖动状态
    // nowDragIndex = -1 表示没有正在拖动的元素
    // showLine = -1 隐藏蓝色指示线
    this.setData({ nowDragIndex: -1, showLine: -1 });

    // 判断是否需要执行排序
    // 条件1：savedNowDragIndex >= 0 有有效的拖动起始索引
    // 条件2：savedShowLine >= 0 有有效的目标位置
    // 条件3：起始位置和目标位置不同
    if (savedNowDragIndex >= 0 && savedShowLine >= 0 && savedNowDragIndex !== savedShowLine) {
      console.log('[onMovableViewTouchEnd] calling doSort');
      this.doSort(savedNowDragIndex, savedShowLine);
    } else {
      console.log('[onMovableViewTouchEnd] no sort - conditions not met');
    }
  },

  doSort(fromIndex, toIndex) {
    const { tiles, itemHeight } = this.data;
    console.log('[doSort] fromIndex:', fromIndex, 'toIndex:', toIndex);

    // 交换 tiles 中的位置
    const newTiles = [...tiles];
    const [movedItem] = newTiles.splice(fromIndex, 1);
    newTiles.splice(toIndex, 0, movedItem);

    // 更新位置列表
    const newPositionList = newTiles.map((tile, index) => {
      return {
        id: tile.id,
        name: tile.name,
        left: 0,
        boxTop: index * itemHeight
      };
    });

    // 更新选中状态到被移动的项目
    const movedTileId = tiles[fromIndex]?.id;

    console.log('[doSort] movedTileId:', movedTileId, 'newTiles:', JSON.stringify(newTiles.map(t => t.name)));

    this.setData({
      tiles: newTiles,
      positionList: newPositionList,
      activeTileId: movedTileId
    });

    // 更新当前编辑的表单数据
    const movedTile = newTiles.find(t => t.id === movedTileId);
    if (movedTile) {
      this.setData({
        nodeName: movedTile.name,
        nodeDesc: movedTile.desc,
        nodeType: movedTile.type,
        goldReward: movedTile.goldReward,
        taxRate: movedTile.taxRate
      });
    }
  },

  // ========== CRUD 操作 ==========

  // 删除当前选中的地块
  onDeleteTile() {
    const { tiles, activeTileId } = this.data;
    if (tiles.length <= 1) {
      wx.showToast({ title: '至少保留1个地块', icon: 'none' });
      return;
    }

    wx.showModal({
      title: '确认删除',
      content: '确定要删除这个地块吗？',
      success: (res) => {
        if (res.confirm) {
          const newTiles = tiles.filter(t => t.id !== activeTileId);
          this.setData({ tiles: newTiles });
          this.initPositionList();
          if (newTiles.length > 0) {
            this.selectTile(newTiles[0].id);
          }
          wx.showToast({ title: '已删除', icon: 'success' });
        }
      }
    });
  },

  // 添加新地块
  onAddTile() {
    const { tiles, mapId } = this.data;
    const newId = Math.max(...tiles.map(t => t.id), 0) + 1;
    const newTile = {
      id: newId,
      name: '新地块',
      desc: '请输入描述',
      type: '商业',
      goldReward: 100,
      taxRate: 5
    };

    const newTiles = [...tiles, newTile];
    this.setData({ tiles: newTiles });
    this.initPositionList();
    this.selectTile(newId);
    wx.showToast({ title: '已添加新地块', icon: 'success' });
  },

  // 保存地图
  onSaveMap() {
    const { mapId, tiles } = this.data;
    const grids = this.convertTilesToGrids(tiles);

    if (mapId) {
      // 覆盖原地图
      this.overwriteMap(grids);
    } else {
      // 保存为新地图
      this.saveAsNewMap(grids);
    }
  },

  saveAsNewMap(grids) {
    console.log('[Edit] saveAsNewMap called, mapId:', this.data.mapId);
    const oldMapData = getMap(this.data.mapId);
    if (!oldMapData) return;

    const newMapData = {
      ...oldMapData,
      id: generateId(),
      createdAt: new Date().toISOString(),
      grids: grids
    };

    const result = saveMap(newMapData);  // 新 API：upsert
    if (!result.saved) {
      wx.showToast({ title: '保存失败：' + (result.reason || '未知错误'), icon: 'none' });
      return;
    }

    wx.showToast({ title: '已保存为新地图', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 1000);
  },

  overwriteMap(grids) {
    console.log('[Edit] overwriteMap called, mapId:', this.data.mapId);
    const oldMapData = getMap(this.data.mapId);
    if (!oldMapData) return;

    oldMapData.grids = grids;

    const result = saveMap(oldMapData);  // 走 upsert，自动 replace 数组里同 id 的项
    if (!result.saved) {
      wx.showToast({ title: '保存失败：' + (result.reason || '未知错误'), icon: 'none' });
      return;
    }

    wx.showToast({ title: '已覆盖保存', icon: 'success' });
    setTimeout(() => wx.navigateBack(), 1000);
  },
});