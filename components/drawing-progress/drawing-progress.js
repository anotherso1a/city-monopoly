// drawing-progress 组件 - loading 状态展示
// 内部自管理: 骰子点数循环 (750ms) + 进度条抖动 (300ms, 58-62%) +
//            headline 5 条消息循环 (2500ms 切换, 0.3s 淡入淡出)

const DOT_LAYOUTS = {
  1: [true,  false, false, false],
  2: [true,  false, false, true ],
  3: [true,  true,  true,  false],
  4: [true,  true,  true,  true ]
};

const MESSAGES = [
  '正在勾勒街道骨架...',
  '翻阅旧地图中...',
  '正在填充 POI 坐标...',
  '准备你的探索者笔记...',
  '正在为每个格子定价值...'
];

const PROGRESS_INTERVAL_MS = 800;
const PROGRESS_MAX = 90;
const PROGRESS_MIN_DELTA = 0.5;
const PROGRESS_DECAY_FACTOR = 0.02;
const MESSAGE_INTERVAL_MS = 2500;
const MESSAGE_FADE_MS = 300;

Component({
  options: {
    styleIsolation: 'apply-shared'
  },
  data: {
    face: 4,
    dotLayout: DOT_LAYOUTS[4],
    progress: 0,
    messages: MESSAGES,
    currentIndex: 0,
    headlineOpacity: 1
  },

  _diceTimer: null,
  _progressTimer: null,
  _messageTimer: null,
  _fadeOutTimer: null,

  lifetimes: {
    attached() {
      this._startTimers();
    },
    detached() {
      this._stopTimers();
    }
  },

  methods: {
    _startTimers() {
      this._diceTimer = setInterval(() => {
        const face = Math.floor(Math.random() * 4) + 1;
        this.setData({
          face,
          dotLayout: DOT_LAYOUTS[face]
        });
      }, 750);

      this._progressTimer = setInterval(() => {
        const remaining = PROGRESS_MAX - this.data.progress;
        if (remaining <= 0) {
          clearInterval(this._progressTimer);
          this._progressTimer = null;
          return;
        }
        const delta = Math.max(
          PROGRESS_MIN_DELTA,
          remaining * PROGRESS_DECAY_FACTOR * (0.5 + Math.random())
        );
        this.setData({ progress: Math.round(Math.min(PROGRESS_MAX, this.data.progress + delta)) });
      }, PROGRESS_INTERVAL_MS);

      this._messageTimer = setInterval(() => {
        this.setData({ headlineOpacity: 0 });
        this._fadeOutTimer = setTimeout(() => {
          // 去掉 isAttached() check —— WeChat 没有这个方法,会抛 TypeError。
          // _stopTimers() 在 detached() 已 clearInterval/clearTimeout,定时器不会在卸载后触发
          this.setData({
            currentIndex: (this.data.currentIndex + 1) % MESSAGES.length,
            headlineOpacity: 1
          });
          this._fadeOutTimer = null;
        }, MESSAGE_FADE_MS);
      }, MESSAGE_INTERVAL_MS);
    },

    _stopTimers() {
      if (this._diceTimer)     { clearInterval(this._diceTimer);     this._diceTimer = null; }
      if (this._progressTimer) { clearInterval(this._progressTimer); this._progressTimer = null; }
      if (this._messageTimer)  { clearInterval(this._messageTimer);  this._messageTimer = null; }
      if (this._fadeOutTimer)  { clearTimeout(this._fadeOutTimer);   this._fadeOutTimer = null; }
    }
  }
});
