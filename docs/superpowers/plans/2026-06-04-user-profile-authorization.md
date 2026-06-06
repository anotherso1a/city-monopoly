# User Profile Authorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Commit policy:** Per user memory `feedback_no_auto_commit.md`, the executor (main session or subagent) MUST NOT run `git add` / `git commit` / `git push` / `git merge` without explicit user instruction in the current turn. Each task's "Commit" step should be performed only when the user asks for it.

**Goal:** Replace all hardcoded user avatar/nickname across the app with a WeChat-native authorization flow (`chooseAvatar` + `type="nickname"`), persisted in storage, with current values as fallback.

**Architecture:** 3 layers — `utils/userProfile.js` (storage + helpers) → `app.js` globalData (single source of truth at runtime) → `components/profile-setup/` (reusable modal using WeChat native components). Sidebar's avatar becomes a `chooseAvatar` button for inline avatar change; full edit flow (including nickname) uses the modal triggered from a Sidebar event.

**Tech Stack:** WeChat Mini Program (WXML, WXSS, JS, JSON), native `<button open-type="chooseAvatar">`, native `<input type="nickname">`, `wx.getFileSystemManager().saveFile`, `wx.setStorage` / `wx.getStorageSync`.

---

## File Structure

| Path | Action | Responsibility |
|---|---|---|
| `utils/userProfile.js` | **Create** | `DEFAULT_USER_PROFILE` + `loadProfile` / `saveProfile` / `getProfileInitial` / `persistAvatar` |
| `app.js` | Modify | Add `userProfile` to globalData; `onLaunch` loads from storage |
| `app.json` | Modify | Register `profile-setup` component globally |
| `components/profile-setup/profile-setup.{wxml,js,wxss,json}` | **Create × 4** | Modal with `chooseAvatar` button + `nickname` input; `firstLaunch` / `edit` modes |
| `components/Sidebar/sidebar.js` | Modify | Remove hardcoded nickname default; handle `chooseavatar`; add `profileChange` and `editProfile` triggers |
| `components/Sidebar/sidebar.wxml` | Modify | Wrap avatar in `<button open-type="chooseAvatar">`; nickname becomes always-disabled `<input type="nickname">` |
| `pages/index/index.js` | Modify | Read avatar/nickname from globalData; add `showProfileSetup`; `onShow` checks `setupSeen` |
| `pages/index/index.wxml` | Modify | Pass `nickname` to Sidebar; render `<profile-setup>` |
| `pages/game/game.js` | Modify | Same shape as index |
| `pages/game/game.wxml` | Modify | Same shape as index |
| `pages/image-share/image-share.js` | Modify | Add `avatar` data field; `onLoad` populates from globalData |
| `pages/history/history.js` | Modify | Delete unused `playerAvatar` data field |

---

## Task 1: Create `utils/userProfile.js`

**Files:**
- Create: `utils/userProfile.js`

- [ ] **Step 1: Write the module**

```javascript
// utils/userProfile.js — 用户授权信息存储 + 工具
// 存储形态:{ avatarUrl, nickName, nicknameInitial, setupSeen }
// setupSeen: false(从未见过授权弹窗) / true(用户点过"保存"或"跳过")
// App.onLaunch 调 loadProfile 写进 globalData,运行期单一来源
// 兜底(DEFAULT):从未授权过或 storage 解析失败时,各字段都有合理默认值

const STORAGE_KEY = 'userProfile';

const DEFAULT_USER_PROFILE = {
  // 兜底:avatar 选 index 页面用的那张(index/game 路径不同,改造后都从 globalData 读,差异消失)
  avatarUrl: 'https://anothersola.oss-cn-beijing.aliyuncs.com/pages/index/images/player-avatar.png',
  // 昵称统一用 Sidebar 的 '城市探索者'(image-share 原来的 '城市漫游者' 弃用)
  nickName: '城市探索者',
  nicknameInitial: '城',
  setupSeen: false,
};

function loadProfile() {
  const saved = wx.getStorageSync(STORAGE_KEY);
  if (saved && saved.avatarUrl && saved.nickName) {
    return saved;
  }
  return { ...DEFAULT_USER_PROFILE };
}

function saveProfile(profile) {
  wx.setStorageSync(STORAGE_KEY, profile);
}

function getProfileInitial(nickName) {
  return (nickName && nickName.length > 0) ? nickName[0] : '城';
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
  saveProfile,
  getProfileInitial,
  persistAvatar,
};
```

- [ ] **Step 2: Manual smoke test in IDE**

Open any page that uses `require('../../utils/userProfile')` and `console.log(loadProfile())` in `onLoad` — should print an object with all 4 fields. Then clear storage in IDE → re-run → should print DEFAULT. Remove the `console.log` after verifying.

- [ ] **Step 3: Commit**

```bash
git add utils/userProfile.js
git commit -m "feat(userProfile): add storage + helper module for user profile"
```

---

## Task 2: Wire `app.js` + `app.json`

**Files:**
- Modify: `app.js` (line 4 import, line 8-10 globalData, line 13-17 onLaunch)
- Modify: `app.json` (line 30-35 usingComponents)

- [ ] **Step 1: Update `app.js`**

Replace the top of `app.js` (lines 1-17) with:

```javascript
// 小程序全局入口文件
// 初始化全局数据和管理地图存储

const { getStorageUsage } = require('./utils/storage');
const { loadProfile } = require('./utils/userProfile');

App({
  // 全局数据 - 可通过 getApp() 获取
  globalData: {
    maps: [],           // 保存的所有地图列表
    userProfile: null,  // 由 onLaunch 加载后赋值(始终非空)
  },

  // 小程序启动时执行
  onLaunch(options) {
    this.loadMapsFromStorage();
    this.globalData.userProfile = loadProfile();
    this.handleOpenMapFile(options);
    this.checkStorageQuota();
  },
  // ... 以下方法(checkStorageQuota / onShow / handleOpenMapFile / loadMapsFromStorage / saveMapsToStorage)原样保留
```

- [ ] **Step 2: Update `app.json` — register profile-setup globally**

In `app.json` `usingComponents`, add the new entry:

```json
"usingComponents": {
  "board": "/components/Board/board",
  "dice": "/components/Dice/dice",
  "navigation-bar": "/components/NavigationBar/navigation-bar",
  "empty-search": "/components/empty-search/empty-search",
  "profile-setup": "/components/profile-setup/profile-setup"
}
```

(Global registration means every page can use `<profile-setup>` without per-page JSON config.)

- [ ] **Step 3: Manual test in IDE**

Run app → in console add `getApp().globalData.userProfile` → verify it's a non-null object with `avatarUrl` / `nickName` / `setupSeen` fields.

- [ ] **Step 4: Commit**

```bash
git add app.js app.json
git commit -m "feat(app): load user profile on launch + register profile-setup globally"
```

---

## Task 3: Create `components/profile-setup/` (4 files)

**Files:**
- Create: `components/profile-setup/profile-setup.json`
- Create: `components/profile-setup/profile-setup.wxml`
- Create: `components/profile-setup/profile-setup.js`
- Create: `components/profile-setup/profile-setup.wxss`

- [ ] **Step 1: Create `profile-setup.json`**

```json
{
  "component": true,
  "usingComponents": {}
}
```

- [ ] **Step 2: Create `profile-setup.wxml`**

```xml
<!--components/profile-setup/profile-setup.wxml-->
<view class="profile-mask {{visible ? 'show' : ''}}" catchtap="onMaskTap">
  <view class="profile-sheet" catchtap="onNoop">
    <text class="profile-title text-headline-md">
      {{mode === 'edit' ? '修改头像和昵称' : '设置你的头像和昵称'}}
    </text>

    <button
      class="avatar-slot"
      open-type="chooseAvatar"
      bind:chooseavatar="onChoose"
    >
      <image wx:if="{{avatarUrl}}" class="avatar-image" src="{{avatarUrl}}" mode="aspectFill" />
      <text wx:else class="avatar-placeholder iconfont icon-user"></text>
    </button>

    <input
      class="nickname-input"
      type="nickname"
      placeholder="请输入昵称"
      value="{{nickName}}"
      bind:blur="onNicknameBlur"
    />

    <view class="profile-actions">
      <button
        wx:if="{{mode === 'firstLaunch'}}"
        class="btn btn-skip"
        bindtap="onSkip"
      >跳过</button>
      <button
        wx:else
        class="btn btn-cancel"
        bindtap="onClose"
      >取消</button>
      <button
        class="btn btn-save"
        bindtap="onSave"
      >保存</button>
    </view>
  </view>
</view>
```

- [ ] **Step 3: Create `profile-setup.js`**

```javascript
// components/profile-setup/profile-setup.js
// 通用弹窗:首次启动引导 + 编辑入口
// 必须由用户物理点击触发(微信 2021+ 隐私合规)
// 内部调 utils/userProfile 完成持久化,然后通过 events 通知父页面更新 globalData

const { saveProfile, getProfileInitial, persistAvatar } = require('../../utils/userProfile');

Component({
  options: {
    styleIsolation: 'apply-shared',
  },
  properties: {
    visible: { type: Boolean, value: false },
    mode:    { type: String,  value: 'firstLaunch' },  // 'firstLaunch' | 'edit'
    initialAvatarUrl: { type: String, value: '' },
    initialNickName:  { type: String, value: '' },
  },
  data: {
    avatarUrl: '',
    nickName: '',
  },
  observers: {
    'visible, initialAvatarUrl, initialNickName': function (visible, avatar, nick) {
      if (visible) {
        this.setData({
          avatarUrl: avatar,
          nickName: nick,
        });
      }
    },
  },
  methods: {
    onMaskTap() {
      // firstLaunch 模式不允许点遮罩关闭(强制用户选跳过/保存)
      if (this.data.mode === 'firstLaunch') return;
      this.triggerEvent('close');
    },
    onNoop() {},

    async onChoose(e) {
      const tempPath = e.detail.avatarUrl;
      if (!tempPath) {
        wx.showToast({ title: '需要选择头像', icon: 'none' });
        return;
      }
      try {
        const savedPath = await persistAvatar(tempPath);
        this.setData({ avatarUrl: savedPath });
      } catch (err) {
        wx.showToast({ title: '头像保存失败', icon: 'none' });
      }
    },

    onNicknameBlur(e) {
      this.setData({ nickName: e.detail.value });
    },

    onSave() {
      const { avatarUrl, nickName } = this.data;
      if (!avatarUrl || !nickName) {
        wx.showToast({ title: '请选择头像和昵称', icon: 'none' });
        return;
      }
      const profile = {
        avatarUrl,
        nickName,
        nicknameInitial: getProfileInitial(nickName),
        setupSeen: true,
      };
      saveProfile(profile);
      this.triggerEvent('confirm', profile);
    },

    onSkip() {
      // 写 DEFAULT 进 storage,setupSeen 变 true 但字段保持默认
      const profile = {
        avatarUrl: 'https://anothersola.oss-cn-beijing.aliyuncs.com/pages/index/images/player-avatar.png',
        nickName: '城市探索者',
        nicknameInitial: '城',
        setupSeen: true,
      };
      saveProfile(profile);
      this.triggerEvent('skip', profile);
    },

    onClose() {
      this.triggerEvent('close');
    },
  },
});
```

- [ ] **Step 4: Create `profile-setup.wxss`**

```css
/* components/profile-setup/profile-setup.wxss */
.profile-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.2s;
  z-index: 999;
}
.profile-mask.show {
  opacity: 1;
  pointer-events: auto;
}

.profile-sheet {
  width: 100%;
  background: #fff8f3;
  border-radius: 24rpx 24rpx 0 0;
  padding: 48rpx 48rpx 64rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 32rpx;
}

.profile-title {
  color: #2b1d0e;
}

.avatar-slot {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: #f5ecd7;
  border: 2rpx dashed #d5c4ab;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  line-height: 1;
}
.avatar-slot::after {
  border: none;
}
.avatar-image {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}
.avatar-placeholder {
  font-size: 80rpx;
  color: #d5c4ab;
}

.nickname-input {
  width: 100%;
  height: 88rpx;
  background: #fff;
  border: 2rpx solid #d5c4ab;
  border-radius: 16rpx;
  padding: 0 24rpx;
  font-size: 28rpx;
  color: #2b1d0e;
}

.profile-actions {
  width: 100%;
  display: flex;
  gap: 24rpx;
  margin-top: 16rpx;
}
.profile-actions .btn {
  flex: 1;
  height: 80rpx;
  line-height: 80rpx;
  font-size: 28rpx;
  border-radius: 16rpx;
  padding: 0;
}
.btn-skip,
.btn-cancel {
  background: #f5ecd7;
  color: #514532;
}
.btn-save {
  background: #7c5800;
  color: #fff8f3;
}
```

- [ ] **Step 5: Manual test in IDE**

Temporarily add `<profile-setup visible="{{true}}" mode="firstLaunch" />` to `pages/index/index.wxml` → run → verify:
- Modal slides up from bottom
- Title is "设置你的头像和昵称"
- Tap avatar → WeChat chooseAvatar sheet appears
- Tap 跳过 → modal closes
- Reopen with `visible="{{true}}"` again → tap 跳过 → modal closes (no re-trigger, since setupSeen is now true)

Remove the temporary `<profile-setup>` element after verifying.

- [ ] **Step 6: Commit**

```bash
git add components/profile-setup/
git commit -m "feat(profile-setup): reusable modal for first-launch + edit flows"
```

---

## Task 4: Update `components/Sidebar/sidebar.{js,wxml}`

**Files:**
- Modify: `components/Sidebar/sidebar.js` (line 20-29 properties, line 40-66 methods)
- Modify: `components/Sidebar/sidebar.wxml` (line 3-9 sidebar-header)

- [ ] **Step 1: Update `sidebar.js`**

In the `properties` block, change the nickname default to empty:

```javascript
properties: {
  visible:  { type: Boolean, value: false },
  items:    { type: Array,   value: [] },
  avatar:   { type: String,  value: '' },
  nickname: { type: String,  value: '' },  // 移除硬编码 '城市探索者' default,由父页面从 globalData 注入
  level:    { type: String,  value: '12级大亨' },
},
```

Add new methods inside the `methods` object (before the closing `},`):

```javascript
async onChooseAvatar(e) {
  const tempPath = e.detail.avatarUrl;
  if (!tempPath) {
    wx.showToast({ title: '需要选择头像', icon: 'none' });
    return;
  }
  try {
    const { persistAvatar, saveProfile, getProfileInitial } = require('../../utils/userProfile');
    const savedPath = await persistAvatar(tempPath);
    const app = getApp();
    const current = app.globalData.userProfile || {};
    const profile = {
      avatarUrl: savedPath,
      nickName: current.nickName || '城市探索者',
      nicknameInitial: getProfileInitial(current.nickName || '城市探索者'),
      setupSeen: true,
    };
    saveProfile(profile);
    app.globalData.userProfile = profile;
    this.triggerEvent('profileChange', profile);
  } catch (err) {
    wx.showToast({ title: '头像保存失败', icon: 'none' });
  }
},

onAvatarTap() {
  // 头像 button 已用 chooseAvatar 触发头像选择
  // 同时让父页面弹编辑弹窗(改昵称/再选一次头像)
  this.triggerEvent('editProfile');
},
```

- [ ] **Step 2: Update `sidebar.wxml`**

Replace the entire `sidebar-header` block (lines 3-9):

```xml
<view class="sidebar-header sketch-border-sm">
  <button
    class="sidebar-avatar-btn"
    open-type="chooseAvatar"
    bind:chooseavatar="onChooseAvatar"
    bindtap="onAvatarTap"
  >
    <image wx:if="{{avatar}}" class="sidebar-avatar" src="{{avatar}}" mode="aspectFill"></image>
    <text wx:else class="sidebar-avatar-placeholder iconfont icon-user"></text>
  </button>
  <view class="sidebar-user">
    <input
      class="sidebar-nickname text-headline-sm"
      type="nickname"
      value="{{nickname}}"
      placeholder="设置昵称"
      disabled="{{true}}"
    />
    <text class="sidebar-level text-body-sm">{{level}}</text>
  </view>
</view>
```

- [ ] **Step 3: Add styles to `sidebar.wxss` for new elements**

Find `sidebar.wxss` and add (or merge with existing avatar/nickname styles):

```css
.sidebar-avatar-btn {
  width: 112rpx;   /* 匹配现有 .sidebar-avatar 尺寸 */
  height: 112rpx;
  border-radius: 50%;
  background: transparent;
  border: none;
  padding: 0;
  line-height: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  margin-right: 24rpx;
  flex-shrink: 0;
}
.sidebar-avatar-btn::after {
  border: none;
}
.sidebar-avatar {
  width: 112rpx;
  height: 112rpx;
  border-radius: 50%;
  background-color: #f7eed2;
}
.sidebar-avatar-placeholder {
  font-size: 56rpx;
  color: #d5c4ab;
}
.sidebar-nickname {
  /* disabled input 在某些小程序版本会显灰,这里强制保持显示色 */
  color: #1f1c0b;
  background: transparent;
  border: none;
  padding: 0;
  pointer-events: none;
  margin-bottom: 4rpx;
}
```

(Inspect existing `sidebar.wxss` first — if `.sidebar-avatar` or `.sidebar-nickname` already have width/height/color rules, drop the duplicates and only add the new `.sidebar-avatar-btn` and `.sidebar-avatar-placeholder` rules. **Current `sidebar.wxss` has `.sidebar-avatar` at `112rpx × 112rpx`** — use 112rpx for `.sidebar-avatar-btn` to match.)

- [ ] **Step 4: Manual test in IDE**

Run app on index page → open Sidebar → verify:
- Avatar renders inside a button, looks like a circle, displays the current avatar
- Tap avatar → WeChat chooseAvatar sheet appears → pick an avatar → Sidebar avatar updates in place
- Kill app → reopen → Sidebar still shows the new avatar (validates `saveFile` persistence)
- Tap avatar (after pick) → `editProfile` event fires → parent should open edit modal — verify by hooking `console.log` on `onSidebarEditProfile` in index.js (added in Task 5)

- [ ] **Step 5: Commit**

```bash
git add components/Sidebar/sidebar.js components/Sidebar/sidebar.wxml components/Sidebar/sidebar.wxss
git commit -m "feat(sidebar): avatar chooseAvatar button + profileChange/editProfile events"
```

---

## Task 5: Update `pages/index/index.{js,wxml}`

**Files:**
- Modify: `pages/index/index.js` (line 5-18 data + add new methods)
- Modify: `pages/index/index.wxml` (line 62-68 Sidebar props + add `<profile-setup>`)

- [ ] **Step 1: Update `index.js`**

Replace the top of `index.js` (lines 1-22) with:

```javascript
// index 页面 - 基于 design/index.html 转换

const { importMapFromFile } = require('../../services/shareService');

Page({
  data: {
    bgImage: 'https://anothersola.oss-cn-beijing.aliyuncs.com/pages/index/images/bg-city.png',
    mapThumbnails: [
      'https://anothersola.oss-cn-beijing.aliyuncs.com/pages/index/images/map-london.png',
      'https://anothersola.oss-cn-beijing.aliyuncs.com/pages/index/images/map-tokyo.png',
      'https://anothersola.oss-cn-beijing.aliyuncs.com/pages/index/images/map-paris.png'
    ],
    drawerOpen: false,
    sidebarItems: ['createMap', 'viewAllMaps', 'loadLocalMap', 'exit'],
    mapList: [],
    navBarHeight: 88,

    // 用户授权相关(从 globalData 读取后填充)
    playerAvatar: '',
    playerNickname: '',
    showProfileSetup: false,
    profileMode: 'firstLaunch',
  },

  onLoad() {
    this.loadUserProfile();
    this.loadMapList();
  },

  onShow() {
    this.loadUserProfile();
  },

  loadUserProfile() {
    const profile = getApp().globalData.userProfile;
    if (!profile) return;
    this.setData({
      playerAvatar: profile.avatarUrl,
      playerNickname: profile.nickName,
      showProfileSetup: profile.setupSeen !== true,
    });
  },

  onProfileConfirm(e) {
    getApp().globalData.userProfile = e.detail;
    this.loadUserProfile();
    this.setData({ showProfileSetup: false });
  },

  onProfileSkip(e) {
    getApp().globalData.userProfile = e.detail;
    this.loadUserProfile();
    this.setData({ showProfileSetup: false });
  },

  onProfileClose() {
    this.setData({ showProfileSetup: false });
  },

  onSidebarEditProfile() {
    this.setData({ showProfileSetup: true, profileMode: 'edit' });
  },

  onSidebarProfileChange() {
    this.loadUserProfile();
  },

  onNavHeightChange(e) {
    this.setData({ navBarHeight: e.detail.height });
  },
  // ... loadMapList / 其他原方法保留不变
```

- [ ] **Step 2: Update `index.wxml`**

Replace the `<sidebar>` block (lines 62-68) and add `<profile-setup>` after it:

```xml
<sidebar
  visible="{{drawerOpen}}"
  items="{{sidebarItems}}"
  avatar="{{playerAvatar}}"
  nickname="{{playerNickname}}"
  bind:close="onCloseDrawer"
  bind:itemtap="onSidebarItemTap"
  bind:editProfile="onSidebarEditProfile"
  bind:profileChange="onSidebarProfileChange"
/>

<profile-setup
  visible="{{showProfileSetup}}"
  mode="{{profileMode}}"
  initialAvatarUrl="{{playerAvatar}}"
  initialNickName="{{playerNickname}}"
  bind:confirm="onProfileConfirm"
  bind:skip="onProfileSkip"
  bind:close="onProfileClose"
/>
```

- [ ] **Step 3: Manual test in IDE**

Clear storage in IDE → run app:
- Modal appears automatically (setupSeen is false in DEFAULT)
- Tap 跳过 → modal closes, Sidebar shows default avatar/昵称
- Kill app → reopen → modal does NOT reappear (setupSeen is now true in storage)
- Clear storage again → reopen → tap 保存 after picking avatar + entering nickname → modal closes, Sidebar shows new avatar/昵称
- Open Sidebar → tap avatar → modal reopens with "修改头像和昵称" title → change nickname → save → Sidebar updates in real time

- [ ] **Step 4: Commit**

```bash
git add pages/index/index.js pages/index/index.wxml
git commit -m "feat(index): use globalData userProfile + profile-setup first-launch flow"
```

---

## Task 6: Update `pages/game/game.{js,wxml}`

**Files:**
- Modify: `pages/game/game.js` (line 22-24 playerAvatar, add new methods)
- Modify: `pages/game/game.wxml` (line 11-17 Sidebar props + add `<profile-setup>`)

- [ ] **Step 1: Update `game.js`**

In the `data` block, replace the `playerAvatar` line and add profile-setup state:

```javascript
data: {
  drawerOpen: false,
  sidebarItems: ['viewAllMaps', 'viewTimeline', 'editMap', 'shareMap', 'loadLocalMap', 'settle', 'exit'],
  navBarHeight: 88,
  diceShaking: false,
  diceFilled: true,
  diceText: '投掷骰子',
  cardOpacity: 1,
  modalVisible: false,
  selectedGrid: { poi: {} },
  isCurrentGrid: false,
  isAnimating: false,

  // User data (从 globalData 读取后填充)
  playerAvatar: '',
  playerNickname: '',
  showProfileSetup: false,
  profileMode: 'firstLaunch',

  // ... 其余字段(engine / mapId / gameId / grids 等)原样保留
```

Add new methods in the `Page({ ... })` object (alongside existing `onLoad` / `onShow` / etc.):

```javascript
onShow() {
  this.loadUserProfile();
},

loadUserProfile() {
  const profile = getApp().globalData.userProfile;
  if (!profile) return;
  this.setData({
    playerAvatar: profile.avatarUrl,
    playerNickname: profile.nickName,
    showProfileSetup: profile.setupSeen !== true,
  });
},

onProfileConfirm(e) {
  getApp().globalData.userProfile = e.detail;
  this.loadUserProfile();
  this.setData({ showProfileSetup: false });
},

onProfileSkip(e) {
  getApp().globalData.userProfile = e.detail;
  this.loadUserProfile();
  this.setData({ showProfileSetup: false });
},

onProfileClose() {
  this.setData({ showProfileSetup: false });
},

onSidebarEditProfile() {
  this.setData({ showProfileSetup: true, profileMode: 'edit' });
},

onSidebarProfileChange() {
  this.loadUserProfile();
},
```

(If `onShow` is already defined in the page, merge its existing body with `this.loadUserProfile()` — preserve any existing logic and just add the call.)

- [ ] **Step 2: Update `game.wxml`**

Replace the `<sidebar>` block (lines 11-17) and add `<profile-setup>` after it:

```xml
<sidebar
  visible="{{drawerOpen}}"
  items="{{sidebarItems}}"
  avatar="{{playerAvatar}}"
  nickname="{{playerNickname}}"
  bind:close="onCloseDrawer"
  bind:itemtap="onSidebarItemTap"
  bind:editProfile="onSidebarEditProfile"
  bind:profileChange="onSidebarProfileChange"
/>

<profile-setup
  visible="{{showProfileSetup}}"
  mode="{{profileMode}}"
  initialAvatarUrl="{{playerAvatar}}"
  initialNickName="{{playerNickname}}"
  bind:confirm="onProfileConfirm"
  bind:skip="onProfileSkip"
  bind:close="onProfileClose"
/>
```

- [ ] **Step 3: Manual test in IDE**

From index page, navigate to game page:
- If storage was empty when first launching, modal should have already shown on index — game page should NOT re-show it (setupSeen is true)
- Sidebar shows current avatar/昵称
- Tap Sidebar avatar → modal opens in edit mode → change → save → game page state updates
- Open a fresh storage → directly deep-link to game page → modal should appear on game page itself

- [ ] **Step 4: Commit**

```bash
git add pages/game/game.js pages/game/game.wxml
git commit -m "feat(game): use globalData userProfile + profile-setup first-launch flow"
```

---

## Task 7: Update `pages/image-share/image-share.js`

**Files:**
- Modify: `pages/image-share/image-share.js` (line 666-687 data block + onLoad)

- [ ] **Step 1: Update `data` block**

In the `data` block, change the nickname/nicknameInitial/avatar fields:

```javascript
data: {
  navBarHeight: 88,
  mapId: '',

  nickname: '',         // 由 onLoad 从 globalData 填充
  nicknameInitial: '',  // 由 onLoad 从 globalData 填充
  avatar: '',           // 由 onLoad 从 globalData 填充
  completedDate: formatDate(),
  distanceLabel: '12.8 km',
  coins: 2450,
  places: ['武康大楼', '静安公园', '外滩码头'],
  photos: [],

  posterPalette: null,
  posterImageUrl: '',
  renderingLabel: RENDER_LABEL_DEFAULT,
  renderError: '',

  saving: false,
  saved: false,
  saveLabel: SAVE_LABEL_DEFAULT,
  saveIcon: '📷',
},
```

- [ ] **Step 2: Update `onLoad`**

Find `onLoad(options)` and add the globalData read at the top of the function (before any other logic):

```javascript
onLoad(options) {
  const profile = getApp().globalData.userProfile;
  this.setData({
    nickname: profile.nickName,
    nicknameInitial: profile.nicknameInitial,
    avatar: profile.avatarUrl,
  });
  // ... 其余原 onLoad 逻辑保留
},
```

- [ ] **Step 3: Manual test in IDE**

Clear storage → run app → 跳过 / 保存 profile → navigate to image-share → render poster → verify avatar + nickname appear on the rendered image as the authorized values (or default if skipped).

- [ ] **Step 4: Commit**

```bash
git add pages/image-share/image-share.js
git commit -m "feat(image-share): read user profile from globalData on load"
```

---

## Task 8: Cleanup `pages/history/history.js`

**Files:**
- Modify: `pages/history/history.js` (line 9)

- [ ] **Step 1: Delete dead state**

Remove line 9 (`playerAvatar: '...history/...'`) from the `data` block. Also remove the comment on line 8 (`// 用户头像 - 本地图片`) since it's no longer applicable.

- [ ] **Step 2: Manual test in IDE**

Open history page → confirm no visual change. Search the file for `playerAvatar` to confirm no remaining references.

- [ ] **Step 3: Commit**

```bash
git add pages/history/history.js
git commit -m "chore(history): remove unused playerAvatar data field"
```

---

## Self-Review

**Spec coverage (each spec requirement → which task implements it):**

| Spec requirement | Task |
|---|---|
| 3-layer architecture (utils / app / UI) | Tasks 1, 2, 3 |
| `loadProfile` always returns non-null | Task 1 |
| `wx.getUserProfile` avoided | (not used in any task) |
| `<button open-type="chooseAvatar">` for avatar | Tasks 3, 4 |
| `<input type="nickname">` for nickname | Tasks 3, 4 |
| Avatar temp path persisted via `saveFile` | Task 1 (`persistAvatar`), Task 3 (`onChoose`), Task 4 (`onChooseAvatar`) |
| `setupSeen` marker for first-launch detection | Task 1 (DEFAULT: false), Task 3 (save/skip: true), Tasks 5/6 (`onShow` check) |
| "Skip = write DEFAULT" semantics | Task 3 `onSkip` |
| Sidebar's `profileChange` parent-sync contract | Task 4 (writes `app.globalData.userProfile`) |
| Sidebar's `editProfile` event | Task 4 |
| Default nickName unified to '城市探索者' | Tasks 1, 3, 4 |
| image-share '城市漫游者' deprecated | Task 7 |
| `pages/history/history.js` dead state cleanup | Task 8 |
| No `scope.userInfo` in `app.json` | (correctly omitted in Task 2) |
| No server sync, local storage only | (no task adds it) |

**Placeholder scan:** No "TBD" / "TODO" / "implement later". One in-line "如果" hedge in Task 4 Step 3 (wxss inspection note) — this is a concrete instruction ("inspect existing styles first"), not a placeholder.

**Type/property name consistency:**
- `DEFAULT_USER_PROFILE` — defined once in Task 1; literal inlined in Task 3 `onSkip` (intentional, matches DEFAULT).
- `userProfile` (globalData key) — same across Tasks 2, 4, 5, 6, 7.
- `setupSeen` — boolean; defined in Task 1 DEFAULT, set `true` in Tasks 3, 4; checked `=== true` in Tasks 5, 6.
- Profile object shape `{ avatarUrl, nickName, nicknameInitial, setupSeen }` — consistent across all writers (Tasks 1, 3, 4).
- Event names — `confirm` / `skip` / `close` (profile-setup), `profileChange` / `editProfile` (Sidebar), bound in Tasks 3, 4, 5, 6. No mismatches.
- Props: `visible` / `mode` / `initialAvatarUrl` / `initialNickName` on `profile-setup`; `visible` / `items` / `avatar` / `nickname` / `level` on Sidebar. Consistent across definitions and consumers.

No issues found.
