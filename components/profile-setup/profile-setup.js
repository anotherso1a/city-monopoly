// components/profile-setup/profile-setup.js
// 通用弹窗:首次启动引导 + 编辑入口
// 必须由用户物理点击触发(微信 2021+ 隐私合规)
// 内部调 utils/userProfile 完成持久化,然后通过 events 通知父页面更新 globalData

const { saveProfile, persistAvatar } = require('../../utils/userProfile');

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
      this._avatarPending = true;
      try {
        const savedPath = await persistAvatar(tempPath);
        this.setData({ avatarUrl: savedPath });
      } catch (err) {
        wx.showToast({ title: '头像保存失败', icon: 'none' });
      } finally {
        this._avatarPending = false;
      }
    },

    onNicknameInput(e) {
      // 微信 type="nickname" 选择器修改值后,某些情况下 bind:blur 不触发;
      // bind:input 实时同步 data,确保 picker 设置的昵称被捕获
      this.setData({ nickName: e.detail.value });
    },

    onNicknameBlur(e) {
      // 兜底:直接键盘输入时 bind:input 也会触发,但 blur 用于最后一次确认
      const value = e.detail.value;
      if (value !== this.data.nickName) {
        this.setData({ nickName: value });
      }
    },

    onSave() {
      // 阻止在头像持久化未完成时误触保存(此时 avatarUrl 还是空)
      if (this._avatarPending) {
        wx.showToast({ title: '头像保存中,请稍候', icon: 'none' });
        return;
      }
      const { avatarUrl, nickName } = this.data;
      if (!avatarUrl || !nickName) {
        wx.showToast({ title: '请选择头像和昵称', icon: 'none' });
        return;
      }
      const profile = {
        avatarUrl,
        nickName,
        setupSeen: true,
      };
      saveProfile(profile);
      this.triggerEvent('confirm', profile);
    },

    onSkip() {
      // 只存 setupSeen 标志(展示层会用 DEFAULT 兜底),不把 DEFAULT 写进 storage
      const profile = { setupSeen: true };
      saveProfile(profile);
      this.triggerEvent('skip', profile);
    },

    onClose() {
      this.triggerEvent('close');
    },
  },
});
