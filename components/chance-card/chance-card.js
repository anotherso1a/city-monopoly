// ChanceCard component - 机会卡弹窗组件
// 显示机会卡信息，触发 collect/close 事件
// 金币增减出现时跑一个"老虎机"动画:前 60% 随机闪烁,后 40% ease-out 缓动到目标值

// 动画时长与阶段划分 — 调短会显得仓促,调长会拖沓
const ROLL_TOTAL_MS = 700;
const ROLL_FLICKER_RATIO = 0.6;  // 0~0.6 随机闪,0.6~1 缓动收尾
const ROLL_TICK_MS = 50;         // ~20fps,老虎机感

Component({
  properties: {
    visible: {
      type: Boolean,
      value: false
    },
    image: {
      type: String,
      value: 'https://anothersola.oss-cn-beijing.aliyuncs.com/components/chance-card/images/card.png'
    },
    description: {
      type: String,
      value: ''
    },
    goldChange: {
      type: Number,
      value: 0
    }
  },

  data: {
    // 由 goldChange observer 派生 — WXML 直接绑定,避免在模板里写三元
    goldChangeText: '',
    goldChangeClass: '',
    // 动画过程中实际渲染的值,初始为空字符串(等动画第一帧写入)
    animatedGoldText: '',
  },

  observers: {
    // 同时观察 goldChange + visible:卡片"出现"(visible 由 false→true)且金币非 0 时启动动画
    'goldChange, visible': function (goldChange, visible) {
      const isPositive = goldChange > 0;
      const sign = isPositive ? '+' : '-';
      const absTarget = Math.abs(goldChange);

      this.setData({
        goldChangeText: goldChange === 0 ? '' : `${sign}${absTarget}`,
        goldChangeClass: isPositive ? 'gold-positive' : 'gold-negative',
      });

      if (visible && goldChange !== 0) {
        this._animateGoldChange(goldChange);
      } else {
        this._clearGoldAnimation();
        this.setData({ animatedGoldText: '' });
      }
    }
  },

  lifetimes: {
    // 组件销毁时清掉未完成的 ticker,避免 setData 写到已卸载实例上
    detached() {
      this._clearGoldAnimation();
    }
  },

  methods: {
    // 点击"收下"按钮
    onCollect() {
      this.triggerEvent('collect', { goldChange: this.properties.goldChange });
    },

    // 点击遮罩层关闭
    onClose() {
      this.triggerEvent('close', {});
    },

    // 阻止事件冒泡
    noop() {},

    // 老虎机风格数字滚动:随机闪烁 → ease-out 减速收尾
    _animateGoldChange(target) {
      this._clearGoldAnimation();
      const isPositive = target > 0;
      const sign = isPositive ? '+' : '-';
      const absTarget = Math.abs(target);
      // 随机阶段显示范围 — 不让数字跑得离目标太离谱
      const flickerMax = Math.max(absTarget, 50);
      const startTime = Date.now();

      const tick = () => {
        const elapsed = Date.now() - startTime;
        const t = Math.min(1, elapsed / ROLL_TOTAL_MS);
        let displayValue;
        if (t < ROLL_FLICKER_RATIO) {
          // 闪烁阶段:随机数快速滚动
          displayValue = `${sign}${Math.floor(Math.random() * flickerMax)}`;
        } else {
          // 收尾阶段:ease-out cubic 减速到目标
          const settleT = (t - ROLL_FLICKER_RATIO) / (1 - ROLL_FLICKER_RATIO);
          const eased = 1 - Math.pow(1 - settleT, 3);
          const current = Math.floor(absTarget * eased);
          displayValue = `${sign}${current}`;
        }
        this.setData({ animatedGoldText: displayValue });
        if (t < 1) {
          this._animTimer = setTimeout(tick, ROLL_TICK_MS);
        } else {
          // 末帧:精确落到目标值,避免浮点累积误差
          this.setData({ animatedGoldText: `${sign}${absTarget}` });
          this._animTimer = null;
        }
      };
      tick();
    },

    _clearGoldAnimation() {
      if (this._animTimer) {
        clearTimeout(this._animTimer);
        this._animTimer = null;
      }
    }
  }
});