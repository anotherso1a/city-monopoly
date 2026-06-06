// utils/request.js
// 通用网络请求 Promise 包装,只做 HTTP 层语义(状态码/超时/错误抛出)
// 不内置 wx.showLoading —— UI 由调用方控制
// 不预设业务成功条件(不读 code/status/base_resp),只认 HTTP 2xx

const request = ({ url, method = 'GET', data, headers, timeout = 30000 }) => {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data,
      header: headers,
      timeout,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject({
            statusCode: res.statusCode,
            message: `HTTP ${res.statusCode}`,
            body: res.data,
          });
        }
      },
      fail: (err) => {
        reject({
          statusCode: 0,
          message: (err && err.errMsg) || '网络错误',
        });
      },
    });
  });
};

module.exports = request;
