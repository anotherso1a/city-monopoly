// utils/userProfile.js — 用户授权信息存储 + 工具
// 存储形态(由调用方决定):
//   - 完整 profile { avatarUrl, nickName, setupSeen: true }:用户已保存
//   - 仅有 { setupSeen: true }:用户看过弹窗但拒绝授权(展示层会用 DEFAULT 兜底)
// loadProfile 只如实返回 storage 中保存的内容,null 表示"完全没存过"
// DEFAULT_USER_PROFILE 仅用于展示层兜底,绝不被 loadProfile 返回,也不被存进 storage

const STORAGE_KEY = 'userProfile';

const DEFAULT_USER_PROFILE = {
  // 兜底:avatar 选 index 页面用的那张(index/game 路径不同,改造后都从 globalData 读,差异消失)
  avatarUrl: 'https://anothersola.oss-cn-beijing.aliyuncs.com/pages/index/images/player-avatar.png',
  // 昵称统一用 Sidebar 的 '城市探索者'(image-share 原来的 '城市漫游者' 弃用)
  nickName: '城市探索者',
};

function loadProfile() {
  const saved = wx.getStorageSync(STORAGE_KEY);
  if (saved && typeof saved === 'object') {
    return saved;
  }
  return null;
}

// 展示层用:返回带完整字段的 profile(有保存值用保存值,否则 DEFAULT 兜底)
// 调用方在拿不到授权数据的地方(Sidebar 头像/昵称、海报头像)用它
function getDisplayProfile() {
  const saved = loadProfile();
  if (saved && saved.avatarUrl && saved.nickName) {
    return saved;
  }
  return { ...DEFAULT_USER_PROFILE };
}

function saveProfile(profile) {
  wx.setStorageSync(STORAGE_KEY, profile);
}

// chooseAvatar 回调给的 avatarUrl 是 wxfile:// 临时路径,冷启动后会失效
// 拿到后必须立刻转永久路径再存
function persistAvatar(tempPath) {
  const fsm = wx.getFileSystemManager();
  return new Promise((resolve, reject) => {
    fsm.saveFile({
      tempFilePath: tempPath,
      success: (r) => resolve(r.savedFilePath),
      fail: reject,
    });
  });
}

module.exports = {
  DEFAULT_USER_PROFILE,
  loadProfile,
  getDisplayProfile,
  saveProfile,
  persistAvatar,
};
