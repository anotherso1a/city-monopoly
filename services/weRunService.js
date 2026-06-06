// 微信步数服务 —— wx.getWeRunData
//
// 数据形态:微信返回的是 encryptedData,本地解不开,必须走云函数 / 自有后端解密
// 这里只做"获取 + 透传",真正的 step 数字由调用方决定怎么落
//
// 使用流程:
//   1) 需在微信开发者工具 / 微信云开发控制台开通云开发,并部署 cloudfunctions/getStepCount
//   2) 在 app.js 的 onLaunch 里初始化 wx.cloud
//   3) 调用方 await fetchStepCount() 即可
//
// 未配置云开发 / 用户拒绝授权时:resolve(null),调用方按 fallback 处理

// 调用云函数解密 encryptedData,返回 step 数字
// 云函数名 / 入参 / 返回结构见 cloudfunctions/getStepCount/index.js
const CLOUD_FN_NAME = 'getStepCount';

/**
 * 获取微信步数 —— 调用方 await 即可
 * @returns {Promise<number|null>} 成功返回步数数字;失败 / 未配置云开发返回 null
 */
function fetchStepCount() {
  return new Promise((resolve) => {
    if (typeof wx === 'undefined' || typeof wx.getWeRunData !== 'function') {
      resolve(null);
      return;
    }
    wx.getWeRunData({
      success: (res) => {
        // 没开通云开发时 wx.cloud 不存在 — 直接 null 兜底
        if (!wx.cloud || typeof wx.cloud.callFunction !== 'function') {
          resolve(null);
          return;
        }
        wx.cloud.callFunction({
          name: CLOUD_FN_NAME,
          data: {
            // cloudID 由微信直接给云开发,免去自己解密
            weRunData: res,
          },
          success: (cloudRes) => {
            const step = cloudRes && cloudRes.result && cloudRes.result.step;
            resolve(typeof step === 'number' ? step : null);
          },
          fail: () => {
            resolve(null);
          },
        });
      },
      fail: () => {
        // 用户拒绝授权 / 设备不支持 — 不抛错,fallback null
        resolve(null);
      },
    });
  });
}

module.exports = { fetchStepCount };
