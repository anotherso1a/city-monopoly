// PhotoCard Component - 拍照打卡弹窗组件
// 显示发现新地标的信息，触发事件由父组件处理

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    image: {
      type: String,
      value: ''
    },
    locationName: {
      type: String,
      value: ''
    },
    photoDate: {
      type: String,
      value: ''
    },
    description: {
      type: String,
      value: ''
    },
    achievementPoint: {
      type: Number,
      value: 0
    }
  },

  methods: {
    // Prevent tap propagation on overlay background
    onOverlayTap() {
      // Optional: could close modal here if desired
    },

    // Prevent tap propagation on card
    onCardTap(e) {
      // Stop event bubbling
    },

    // Click "Continue" button
    onContinue() {
      this.triggerEvent('continue', {
        achievementPoint: this.data.achievementPoint
      });
    },

    // Click "Retake" button
    onRetake() {
      this.triggerEvent('retake');
    }
  }
});