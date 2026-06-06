# user-profile 用户授权(头像/昵称)接入设计

## 背景

现状:**整个应用的用户头像和昵称都是硬编码**,且默认值还不一致:

- `pages/index/index.js:8` / `pages/game/game.js:24`:`playerAvatar` 是写死的 OSS URL
- `components/Sidebar/sidebar.js:23-24`:prop 默认 `'城市探索者'` + 空 avatar
- `pages/image-share/image-share.js:670-671`:写死 `'城市漫游者'` + `nicknameInitial: '城'`(且和 Sidebar 默认值不一致)
- `app.globalData` 没有 user 字段,`utils/storage.js` 没有 user 相关 helper
- 全项目 0 处 `wx.getUserProfile` / `<button open-type="chooseAvatar">` / `<input type="nickname">`

需要把硬编码全部替换成"微信授权获取 + 持久化 + 兜底用现在硬编码值"的方案。

## 微信 2021+ 隐私合规约束

`wx.getUserProfile` 已废弃,新流程必须用微信原生组件让用户**主动操作**:

- **头像**:`<button open-type="chooseAvatar" bind:chooseavatar="onChooseAvatar">` — 弹底部 sheet 选 / 拍照
- **昵称**:`<input type="nickname" value="{{...}}">` — 系统预填微信昵称,用户可改

这两个组件必须由用户**物理点击**才能触发,不能静默调用。所以"一次性静默授权"已不现实,必须有一个 UI 入口让用户去操作。

`chooseAvatar` 回调给的 `detail.avatarUrl` 是 `wxfile://` **临时路径**,冷启动后会失效(这个坑 `pages/image-share/` 已经踩过,见 `project_image_share_page` memory)。需要在拿到路径后立刻用 `wx.getFileSystemManager().saveFile()` 转为永久路径再存。

不需要在 `app.json` 里加 `scope.userInfo`(新 API 不需要这个 scope)。

## 架构(3 层)

### 1. 工具层 — `utils/userProfile.js` **(新文件)**

```js
const DEFAULT_USER_PROFILE = {
  // 兜底:avatar 选 index 页面用的那张(目前 index/game 路径不同,改造后都从 globalData 读,差异消失)
  avatarUrl: 'https://anothersola.oss-cn-beijing.aliyuncs.com/pages/index/images/player-avatar.png',
  // 昵称统一用 Sidebar 的 '城市探索者'(image-share 原来的 '城市漫游者' 弃用)
  nickName: '城市探索者',
  nicknameInitial: '城',
};
const STORAGE_KEY = 'userProfile';

function loadProfile() {
  const saved = wx.getStorageSync(STORAGE_KEY);
  // 始终非空 — 没存过或解析失败都给 DEFAULT
  return (saved && saved.avatarUrl && saved.nickName) ? saved : DEFAULT_USER_PROFILE;
}
function saveProfile(profile) {
  wx.setStorageSync(STORAGE_KEY, profile);
}
function getProfileInitial(nickName) {
  // 取昵称第一个字,空时用 '城'
  return (nickName && nickName.length > 0) ? nickName[0] : '城';
}
// 拿到 chooseAvatar 的临时路径后,转永久再回写
function persistAvatar(tempPath) {
  const fsm = wx.getFileSystemManager();
  return new Promise((resolve, reject) => {
    fsm.saveFile({ tempFilePath: tempPath, success: r => resolve(r.savedFilePath), fail: reject });
  });
}
```

导出:`DEFAULT_USER_PROFILE` / `loadProfile` / `saveProfile` / `getProfileInitial` / `persistAvatar`。

### 2. App 层 — `app.js`

- `globalData.userProfile = null`(初始占位)
- `onLaunch` 调 `loadProfile()` 把结果写进 `globalData.userProfile`(始终非空)
- 任何页面用 `getApp().globalData.userProfile` 拿

### 3. UI 层 — `components/profile-setup/` **(新组件,4 文件)**

可复用弹窗,内部用微信原生组件。Props/Events:

| 名称 | 类型 | 说明 |
|---|---|---|
| props `visible` | `Boolean` | 是否显示 |
| props `mode` | `'firstLaunch' \| 'edit'` | 首次启动时显示「跳过」按钮,编辑模式不显示 |
| events `confirm` | `{ avatarUrl, nickName, nicknameInitial }` | 用户保存(选择了头像 + 输入了昵称) |
| events `skip` | (无 payload) | 首次启动点跳过(内部自动写 DEFAULT 进 storage) |
| events `close` | (无 payload) | 编辑模式下用户点取消 |

内部结构:
- 半屏弹窗,标题「设置你的头像和昵称」/ 编辑模式「修改头像和昵称」
- `<button class="avatar-slot" open-type="chooseAvatar" bind:chooseavatar="onChoose">` — 圆形头像位,显示当前 avatar 或 placeholder
- `<input type="nickname" placeholder="请输入昵称" value="{{nickName}}" bind:blur="onNicknameChange">`
- 底部:首次模式有「跳过」+「保存」两按钮;编辑模式有「取消」+「保存」

「跳过」逻辑:写 DEFAULT 进 storage,关弹窗,触发 `skip` event。
「保存」逻辑:校验 `avatarUrl` + `nickName` 都非空(否则 toast 提示),否则 `saveProfile` + 触发 `confirm` event,父页面更新 `app.globalData.userProfile`。

## 接入点改动

| 文件 | 类型 | 改动 |
|---|---|---|
| `utils/userProfile.js` | **新增** | 见上 5 个导出 |
| `app.js` | 修改 | `onLaunch` 调 `loadProfile` 写 `globalData.userProfile` |
| `components/profile-setup/profile-setup.{wxml,js,wxss,json}` | **新增 4 文件** | 弹窗组件,见上 |
| `pages/index/index.js` | 修改 | `data.playerAvatar` 从硬编码 → `getApp().globalData.userProfile.avatarUrl`(或再加 nickname);新增 `showProfileSetup: false` 状态 + `onShow` 检测 + 弹窗事件回调 |
| `pages/index/index.wxml` | 修改 | 加 `<profile-setup visible="{{showProfileSetup}}" mode="firstLaunch" bind:confirm="onProfileConfirm" bind:skip="onProfileSkip" />` |
| `pages/game/game.js` | 修改 | 同 index.js |
| `pages/game/game.wxml` | 修改 | 同 index.wxml |
| `components/Sidebar/sidebar.wxml` | 修改 | 头像包一层 `<button open-type="chooseAvatar" bind:chooseavatar="onChooseAvatar">`,昵称改为 `<input type="nickname" value="{{nickname}}" bind:blur="onNicknameBlur">`;input 加 `disabled="{{!editing}}"` 之类,避免常态可输入太刺眼(细节在 plan 阶段定) |
| `components/Sidebar/sidebar.js` | 修改 | 删除 prop default 的硬编码 `'城市探索者'`(避免重复);`onChooseAvatar` 调 `persistAvatar` → `saveProfile` → 触发 `profileChange` event(**父页面在回调里必须同步 `getApp().globalData.userProfile = newProfile`**,否则页面状态和 globalData 会脱钩);新增 `triggerEvent('editProfile')` 父页面用来弹编辑弹窗 |
| `pages/image-share/image-share.js` | 修改 | `onLoad` 读 `getApp().globalData.userProfile` 写进 `data.nickname` / `data.nicknameInitial` / `data.avatar`;默认值来源改成 `DEFAULT_USER_PROFILE`(从 `utils/userProfile` import) |
| `pages/history/history.js` | **顺手清理** | `playerAvatar` 是 dead state,这次删除(不算无关重构,会影响这次改动的一致性) |

## 关键设计决定

1. **昵称默认值统一为 `'城市探索者'`**(Sidebar 的那个)。`image-share` 原来的 `'城市漫游者'` 弃用。
2. **「跳过」= 写 DEFAULT 进 storage**。这样:
   - `globalData.userProfile` 始终非空,所有消费者不用 null check
   - Sidebar / 海报永远有头像可显示
   - "skip" 状态本身不需要单独存,storage 里有 DEFAULT 就等于跳过了
3. **不引入 `wx.getUserProfile`**(已废弃),纯走新 API 流程。
4. **avatar 临时路径必须在 `onChooseAvatar` 里立刻 `persistAvatar`**,不能存原 `wxfile://` 路径(冷启动失效)。
5. **本地存储 vs 服务端**:按 MVP 范围(见 `project_storage_mvp_scope` memory),只本地 `wx.setStorage`。将来上服务端再叠一层同步逻辑。
6. **Sidebar 头像常态是否可点**:为了让"随时可改"成立,Sidebar 头像**常态就是 `<button>`**(微信对这种 button 默认可点击样式,需要样式上 cover 一下去掉默认背景/边框)。细节在 plan 阶段定。
7. **`nicknameInitial` 的来源**:从 `nickName[0]` 派生,不再单独存(避免数据不一致)。`utils/userProfile.js` 暴露 `getProfileInitial(nickName)` 工具函数。

## 测试

MVP 阶段主要是 IDE 手测:

- [ ] 首次启动(清 storage)→ 弹窗出现 → 点跳过 → storage 有 DEFAULT,Sidebar 显示默认头像
- [ ] 首次启动 → 弹窗出现 → 选头像 + 输入昵称 → 保存 → 弹窗关闭,Sidebar 实时更新
- [ ] 选完头像,**杀掉小程序重开** → 头像还在(验证 `persistAvatar` 起作用)
- [ ] 进 Sidebar → 点头像 → 弹窗(无跳过按钮)→ 改昵称 → 保存 → 实时更新
- [ ] 进 image-share → 海报头像/昵称用授权值
- [ ] 取消微信授权场景:`chooseAvatar` 回调里如果 `detail.avatarUrl` 为空,弹 toast 提示「需要选择头像」,不关闭弹窗

## 不在范围

- 不做"换头像历史记录"(只保留当前一个)
- 不做"昵称长度/敏感词校验"(信任微信侧的预填)
- 不做"账号系统 / 多设备同步"(MVP 纯本地)
- 不动 `pages/history/history.wxss` 等无关样式文件
- 不重构 Sidebar 的 prop 接口(只新增 1 个 event `editProfile`,不改已有 props 的语义)
