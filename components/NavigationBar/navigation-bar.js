Component({
  properties: {
    title: {
      type: String,
      value: ''
    },
    // 类型: "back" 显示返回按钮, "menu" 显示菜单按钮
    type: {
      type: String,
      value: 'menu'
    },
    // 透明模式: 去掉背景/阴影/底边, 让页面内容透过来
    transparent: {
      type: Boolean,
      value: false
    },
    // 深色模式: 把图标/标题改成深色, 配 transparent 在浅色背景上用
    dark: {
      type: Boolean,
      value: false
    },
    // 自定义返回: true 时只触发 'back' 事件,让页面自己处理(用于"游戏结束"等终态页)
    // false(默认)走 navigateBack / 首页兜底
    customBack: {
      type: Boolean,
      value: false
    }
  },

  data: {
    height: 0,
    statusHeight: 0
  },

  lifetimes: {
    attached() {
      const info = wx.getSystemInfoSync();
      const menuButton = wx.getMenuButtonBoundingClientRect();
      const statusHeight = info.statusBarHeight || 20;
      // 16rpx 兜底到胶囊下面,把胶囊彻底包进导航栏里
      // 1rpx = windowWidth / 750 px,所以 16rpx = 16 * windowWidth / 750 px
      const bottomGapPx = Math.round(16 * info.windowWidth / 750);
      const height = menuButton.bottom + bottomGapPx;

      this.setData({
        height,
        statusHeight
      });
      // 通知页面同步把 main-content 的顶部偏移调到 nav 高度 + 16rpx
      this.triggerEvent('heightchange', { height });
    }
  },

  methods: {
    onBack() {
      // 自定义返回模式:只触发事件,让页面自己决定(用于"游戏结束"等终态页)
      if (this.data.customBack) {
        this.triggerEvent('back');
        return;
      }
      // 默认行为:有历史栈就 go back,没历史栈 fallback 到首页
      // settlement 之类的页面是用 wx.redirectTo 进的(没有上一页),navigateBack 会静默失败
      const pages = getCurrentPages();
      if (pages.length > 1) {
        wx.navigateBack();
      } else {
        wx.switchTab({
          url: '/pages/index/index',
          fail: () => wx.reLaunch({ url: '/pages/index/index' })
        });
      }
    },

    onMenuTap() {
      this.triggerEvent('menutap');
    }
  }
});
