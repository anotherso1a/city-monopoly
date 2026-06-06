// 常量定义 - 项目中使用的所有配置常量
// 包括金币数量、骰子范围、存储键名等

// 常量对象
const Constants = {
  INITIAL_GOLD: 1000,        // 初始金币数量（游戏开始时玩家拥有的金币）
  LAP_REWARD_GOLD: 500,      // 绕圈奖励金币（绕完整圈后获得的金币奖励）
  DICE_MIN: 1,               // 骰子最小值
  DICE_MAX: 6,               // 骰子最大值（1-6 共 6 个面）

  // 游戏状态:写入 map.currentGame.status,所有页面/WXML 共享这套值
  // WXML 不能 import JS 常量,所以字符串 'playing' / 'completed' 会在 WXML 里硬写,
  // 修改时请同步搜 "GAME_STATUS"
  GAME_STATUS: {
    PLAYING:   'playing',    // 游戏中
    COMPLETED: 'completed',  // 已完成
  },
};

// 导出常量对象
module.exports = Constants;