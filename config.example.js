// config.example.js
// 本地配置文件模板。复制为 config.local.js 并填写真实值。
// config.local.js 在 .gitignore 中,不会提交到仓库。

module.exports = {
  // 高德地图微信小程序 SDK key
  // 申请地址:https://lbs.amap.com/dev/key/app
  // 申请时需绑定本小程序的 AppID(在 project.config.json 的 appid 字段)
  // 推荐在高德控制台配置域名/小程序白名单,避免 key 被滥用
  AMAP_KEY: 'a574d6ad99f0a0c479ee2aae1d7d5798',

  // LLM 配置(本期接入 MiniMax,OpenAI 兼容协议)
  // 申请地址:https://platform.minimaxi.com/
  // 1) API key:在控制台创建,填到 config.local.js 的 LLM_API_KEY
  // 2) BASE URL:国际版 https://api.minimaxi.com/v1,国内版 https://api.MiniMax.chat/v1
  // 3) Model:必须用 M3 系列,M2.x 的 thinking 无法关闭,地图生成会卡 2-3min
  //    aiService.js 里有 thinking: { type: 'disabled' } 配 M3 用
  LLM_API_KEY: '<your-llm-key>',
  LLM_API_BASE_URL: 'https://api.minimaxi.com/v1',
  LLM_MODEL: 'MiniMax-M3',
};
