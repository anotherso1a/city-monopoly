// 分享服务 - 处理地图文件的导出和导入
// 支持 JSON 格式地图文件，用于跨设备分享地图

const { saveMap, getMaps } = require('../utils/storage');
const analytics = require('./analytics');

// 写分享文件前先清掉旧的 .json — 避免目录里堆历史分享产物
function clearOldShareFiles(dirPath) {
  const fs = wx.getFileSystemManager();
  return new Promise((resolve) => {
    fs.readdir({
      dirPath,
      success: (res) => {
        const files = (res.files || []).filter(f => f.endsWith('.json'));
        Promise.all(files.map((file) => unlinkQuiet(`${dirPath}/${file}`))).then(() => resolve());
      },
      fail: () => resolve()
    });
  });
}

function unlinkQuiet(filePath) {
  return new Promise((resolve) => {
    wx.getFileSystemManager().unlink({
      filePath,
      success: () => resolve(true),
      fail: () => resolve(false)
    });
  });
}

// 导出地图为 JSON 文件到用户数据目录
// 参数：mapData - 要导出的地图对象
// 返回：保存后的文件路径 (Promise)
async function exportMap(mapData) {
  // 分享只带定义，不带 currentGame（避免把进行中的进度发别人）
  const { currentGame, ...cleanMap } = mapData;
  const jsonString = JSON.stringify(cleanMap);
  const fileName = `${cleanMap.id || `share-${Date.now()}`}.json`;
  const filePath = `${wx.env.USER_DATA_PATH}/${fileName}`;
  const t0 = Date.now();

  await clearOldShareFiles(wx.env.USER_DATA_PATH);

  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().writeFile({
      filePath,
      data: jsonString,
      encoding: 'utf8',
      success: () => {
        analytics.trackPerf(analytics.EVENT.API_LATENCY_SHARE_GENERATE, {
          bytes: jsonString.length,
        }, Date.now() - t0);
        resolve(filePath);
      },
      fail: (err) => {
        analytics.reportError(analytics.EVENT.ERROR_API_SHARE, {
          stage: 'export_write',
          map_id: cleanMap.id,
        }, err);
        reject(err);
      }
    });
  });
}

// 从 JSON 文件导入地图
// 参数：filePath - 要读取的文件路径
// 返回：Promise，解析后的地图数据
function importMapFromFile(filePath) {
  return new Promise((resolve, reject) => {
    const fs = wx.getFileSystemManager();  // 获取文件系统管理器

    fs.readFile({  // 读取文件内容
      filePath,  // 文件路径
      encoding: 'utf8',  // 编码格式
      success: (res) => {  // 读取成功回调
        try {
          const mapData = JSON.parse(res.data);  // 解析 JSON 数据

          // 验证地图数据格式
          if (!mapData.grids || !Array.isArray(mapData.grids)) {  // 缺少 grids 或不是数组
            analytics.reportError(analytics.EVENT.ERROR_PARSE, { stage: 'import_format' }, new Error('无效的地图文件格式'));
            reject(new Error('无效的地图文件格式'));  // 抛出格式错误
            return;  // 终止执行
          }

          // 如果地图数据没有 ID，生成一个 UUID
          if (!mapData.id) {
            mapData.id = generateUUID();  // 生成唯一标识符
          }

          // 检查是否已存在相同 ID 的地图
          const existingMaps = getMaps();
          const exists = existingMaps.some(m => m.id === mapData.id);

          if (exists) {
            // 如果地图名不同，生成新 ID 避免覆盖
            mapData.id = generateUUID();
          }

          saveMap(mapData);  // 保存到本地存储

          resolve(mapData);  // 返回解析后的地图数据
        } catch (err) {  // JSON 解析失败
          analytics.reportError(analytics.EVENT.ERROR_PARSE, { stage: 'import_json' }, err);
          reject(new Error('解析地图文件失败'));  // 抛出解析错误
        }
      },
      fail: (err) => {  // 读取文件失败
        analytics.reportError(analytics.EVENT.ERROR_API_SHARE, { stage: 'import_read' }, err);
        reject(new Error('读取文件失败'));  // 抛出错误
      }
    });
  });
}

// 生成 UUID v4 风格的唯一标识符
// 返回：随机 UUID 字符串，格式 xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;  // 生成 0-15 的随机数
    const v = c === 'x' ? r : (r & 0x3 | 0x8);  // x 用原值，y 用特定位运算
    return v.toString(16);  // 转为十六进制字符串
  });
}

module.exports = {
  exportMap,  // 导出地图函数
  importMapFromFile,  // 导入地图函数
};
