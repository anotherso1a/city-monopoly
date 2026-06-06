// 空状态组件
Component({
  properties: {
    // 插图图片
    illustrationImage: {
      type: String,
      value: 'https://anothersola.oss-cn-beijing.aliyuncs.com/pages/historyempty/images/empty-city-map.png'
    },
    // 标题
    headline: {
      type: String,
      value: 'No maps yet!'
    },
    // 描述文本
    description: {
      type: String,
      value: 'Start your adventure by creating one. Your urban empire awaits its first street.'
    },
    // 按钮图标
    actionIcon: {
      type: String,
      value: 'plus-circle'
    },
    // 按钮文本
    actionText: {
      type: String,
      value: 'Create First Map'
    },
    // 提示文本（可选）
    tip: {
      type: String,
      value: ''
    },
    // 跳转页面路径
    actionUrl: {
      type: String,
      value: '/pages/create/create'
    }
  },

  methods: {
    onActionTap() {
      const { actionUrl } = this.properties;
      if (actionUrl) {
        wx.navigateTo({ url: actionUrl });
      }
      this.triggerEvent('actiontap');
    }
  }
});
