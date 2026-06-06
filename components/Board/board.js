// 地图画布组件 - 负责渲染环形不规则线路和 POI 标记点
// 支持拖动、缩放、点击选中格子等功能
// 使用 Canvas 2D 进行绘制，性能高效

// 引入路径计算器 - 用于生成环形线路和 POI 标记点坐标
const { PathCalculator } = require('../../utils/pathCalculator');

Component({
  // 组件的属性（外部传入）
  properties: {
    grids: {              // 格子数组（全部 POI,部分挂 chanceCards）
      type: Array,
      value: []
    },
    currentGridIndex: {   // 当前所在的格子索引（用于高亮显示）
      type: Number,
      value: 0
    },
    currentLap: {         // 当前已绕圈数（用于显示）
      type: Number,
      value: 0
    },
    scale: {             // 缩放比例（1 表示原始大小）
      type: Number,
      value: 1
    },
    offsetX: {           // X 方向偏移量（拖动时使用）
      type: Number,
      value: 0
    },
    offsetY: {           // Y 方向偏移量（拖动时使用）
      type: Number,
      value: 0
    },
    templateId: {        // 模板 ID（预留参数）
      type: String,
      value: null
    },
    seed: {              // 随机种子（用于生成确定性的线路形状）
      type: Number,
      value: null
    }
  },

  // 组件内部数据
  data: {},

  // 组件生命周期
  lifetimes: {
    // 组件attached到页面时调用，初始化 Canvas
    attached() {
      this.initCanvas();
    },
    // 组件从页面移除时调用，清理资源
    detached() {
      if (this.ctx) {
        this.ctx = null;  // 清理 Canvas 上下文
      }
    }
  },

  // 属性观察器 - 当这些属性变化时重新渲染
  observers: {
    'grids,currentGridIndex,scale,offsetX,offsetY,templateId': function() {
      this.render();  // 任意一个属性变化都重新绘制
    }
  },

  methods: {
    // 初始化 Canvas，获取 Canvas 节点和上下文
    initCanvas() {
      // 创建选择器查询（在组件范围内查询）
      const query = wx.createSelectorQuery().in(this);
      query.select('.board-canvas')  // 选择 canvas 元素
        .fields({ node: true, size: true })  // 获取 node（用于获取 Canvas）和 size
        .exec((res) => {  // 执行查询，回调中获取结果
          if (res[0]) {  // 获取到 Canvas
            const canvas = res[0].node;  // Canvas 节点
            const ctx = canvas.getContext('2d');  // Canvas 2D 上下文

            // 获取设备像素比，用于高清屏幕
            const dpr = wx.getSystemInfoSync().pixelRatio;
            // 设置 Canvas 实际像素尺寸（乘以 dpr 实现高清）
            canvas.width = res[0].width * dpr;
            canvas.height = res[0].height * dpr;
            // 缩放 ctx 以适配 dpr
            ctx.scale(dpr, dpr);

            // 保存 Canvas 相关对象到组件实例
            this.canvas = canvas;
            this.ctx = ctx;
            this.dpr = dpr;
            // 初始化完成后开始首次渲染
            this.render();
          }
        });
    },

    // 渲染地图：绘制线路和 POI 标记点
    render() {
      // 如果 Canvas 上下文不存在则不渲染
      if (!this.ctx) return;

      const ctx = this.ctx;  // Canvas 上下文
      // 获取 Canvas 逻辑尺寸（除以 dpr 还原逻辑像素）
      const canvasWidth = this.canvas.width / this.dpr;
      const canvasHeight = this.canvas.height / this.dpr;
      // 获取组件属性
      const grids = this.properties.grids;
      const currentIndex = this.properties.currentGridIndex;
      const scale = this.properties.scale || 1;
      const offsetX = this.properties.offsetX || 0;
      const offsetY = this.properties.offsetY || 0;

      // 清空画布
      ctx.clearRect(0, 0, canvasWidth, canvasHeight);

      
      // 保存当前绘图状态（很重要，必须配对 restore）
      ctx.save();

      // 设置变换：先将画布中心移到 offset 位置
      ctx.translate(canvasWidth / 2 + offsetX, canvasHeight / 2 + offsetY);
      // 应用缩放
      ctx.scale(scale, scale);
      // 再将坐标系移回画布中心（配合前面的 translate 实现偏移效果）
      ctx.translate(-canvasWidth / 2, -canvasHeight / 2);

      // 只在格子数或种子变化时重新计算路径（避免每次拖动都重新生成）
      const seed = this.properties.templateId || (grids.length * 999 + 42);
      if (this._lastGridCount !== grids.length || this._lastSeed !== seed) {
        this._lastGridCount = grids.length;
        this._lastSeed = seed;
        // 调用 PathCalculator 计算路径点和 POI 标记点
        const result = PathCalculator.calculate(grids.length, canvasWidth, canvasHeight, seed);
        this._pathPoints = result.pathPoints;   // 保存路径点
        this._poiMarkers = result.poiMarkers;  // 保存 POI 标记点
        // 通知父组件 POI 标记点数组与画布 CSS 像素尺寸（用于聚焦模式计算偏移量）
        this.triggerEvent('poimarkersupdate', {
          poiMarkers: this._poiMarkers,
          canvasWidth,
          canvasHeight
        });
      }

      // 绘制环形线路
      this.drawPath(ctx, this._pathPoints);

      // 绘制所有 POI 标记点
      for (let i = 0; i < this._poiMarkers.length; i++) {
        this.drawPoint(ctx, this._poiMarkers[i], i, currentIndex === i);
      }

      // 恢复绘图状态（与前面的 save 配对）
      ctx.restore();
    },

    // 绘制环形线路（使用圆角过渡的折线）
    // ctx: Canvas 上下文
    // points: 路径点数组
    drawPath(ctx, points) {
      if (points.length < 2) return;  // 点数不足则不绘制

      const N = points.length;
      const cornerRadius = 10;  // 圆角半径

      ctx.beginPath();  // 开始新路径
      ctx.moveTo(points[0].x, points[0].y);  // 移动到第一个点

      // 遍历所有路径点，绘制圆角折线
      for (let i = 0; i < N; i++) {
        const curr = points[i];       // 当前点
        const next = points[(i + 1) % N];  // 下一个点（环形，最后一个的下一个是第一个）

        // 计算当前点到下一点的向量和距离
        const dx = next.x - curr.x;
        const dy = next.y - curr.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        // 圆角半径：不超过线段长度的一半
        const r = Math.min(cornerRadius, dist / 2);

        // 计算圆弧起点（在线段上，向圆弧方向延伸 r 距离）
        const lineEndX = curr.x + dx * (1 - r / dist);
        const lineEndY = curr.y + dy * (1 - r / dist);
        ctx.lineTo(lineEndX, lineEndY);  // 画直线到圆弧起点

        // 绘制圆角：arcTo(x1, y1, x2, y2, radius)
        // 从当前点（lineEnd）到 next点 画圆弧
        ctx.arcTo(next.x, next.y, lineEndX, lineEndY, r);
      }

      ctx.closePath();  // 闭合路径（从最后一个点回到第一个点）

      // 设置线条样式
      ctx.strokeStyle = '#D4A84B';  // 金色线条
      ctx.lineWidth = 4;           // 线条宽度
      ctx.lineJoin = 'round';      // 圆角连接
      ctx.lineCap = 'round';       // 圆角端点
      ctx.stroke();  // 绘制
    },

    // 绘制 POI 标记点
    // ctx: Canvas 上下文
    // point: { x, y } 位置
    // gridIndex: 格子索引（用于显示序号）
    // isActive: 是否为当前格（当前格高亮显示）
    drawPoint(ctx, point, gridIndex, isActive) {
      const { x, y } = point;  // 解构位置
      // 当前格：16px 金色高亮点；非当前格：5px 钢蓝色小圆点
      const dotRadius = isActive ? 16 : 5;

      ctx.save();  // 保存绘图状态
      ctx.translate(x, y);  // 移动坐标系到点位置

      // 如果是当前格，添加外发光效果
      if (isActive) {
        ctx.shadowColor = '#FFD700';  // 金色阴影
        ctx.shadowBlur = 20;          // 模糊半径 20px
      }

      // 绘制圆点背景
      ctx.beginPath();
      ctx.arc(0, 0, dotRadius, 0, 2 * Math.PI);  // 画圆
      ctx.fillStyle = isActive ? '#FFD700' : '#5D8AA8';  // 金色或钢蓝
      ctx.fill();  // 填充

      // 非当前格到此为止（只画小圆点，不显示序号）
      if (!isActive) {
        ctx.restore();
        return;
      }

      // 以下是当前格的额外绘制（序号文字）
      ctx.shadowBlur = 0;  // 清除阴影，避免影响文字

      // 文字始终垂直朝上（固定方向，不随旋转）
      ctx.fillStyle = '#333';   // 深灰色文字
      ctx.font = 'bold 14px sans-serif';  // 加粗 14px
      ctx.textAlign = 'center';   // 水平居中
      ctx.textBaseline = 'middle';  // 垂直居中
      ctx.fillText(`${gridIndex + 1}`, 0, 0);  // 绘制序号（1-based）

      ctx.restore();  // 恢复绘图状态
    },

    // 触摸开始事件
    onTouchStart(e) {
      if (e.touches.length === 2) {
        // 双指触控：记录双指距离（用于后续计算缩放）
        this._lastPinchDistance = this._getPinchDistance(e);
      } else if (e.touches.length === 1) {
        // 单指触控：记录起始位置（用于后续计算拖动）
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
        this._isPanning = false;  // 标记尚未开始拖动
        this._wasPinching = false;  // 重置缩放标记
      }
    },

    // 触摸移动事件
    onTouchMove(e) {
      if (e.touches.length === 2) {
        // 双指缩放
        const distance = this._getPinchDistance(e);
        if (this._lastPinchDistance) {
          // 计算缩放比例变化量
          const scaleDelta = distance / this._lastPinchDistance;
          // 触发 pinch 事件，通知父组件
          this.triggerEvent('pinch', { scaleDelta });
        }
        this._lastPinchDistance = distance;  // 更新上次的距离
        this._wasPinching = true;  // 标记正在缩放
      } else if (e.touches.length === 1) {
        // 单指拖动
        const touch = e.touches[0];
        // 计算与起始位置的差值
        const deltaX = touch.clientX - this.touchStartX;
        const deltaY = touch.clientY - this.touchStartY;
        this._isPanning = true;  // 标记已开始拖动
        // 除以缩放比例，将屏幕像素转换为逻辑坐标系的移动距离
        const scale = this.properties.scale || 1;
        // 触发 pan 事件，通知父组件
        this.triggerEvent('pan', { deltaX: deltaX / scale, deltaY: deltaY / scale });
        // 更新起始位置（实现连续拖动）
        this.touchStartX = touch.clientX;
        this.touchStartY = touch.clientY;
      }
    },

    // 触摸结束事件
    onTouchEnd(e) {
      // 如果还有触摸点仍在屏幕上，说明是多指中的一指抬起
      // 更新起始位置，让剩余手指可以正常拖动
      if (e.touches.length > 0) {
        this.touchStartX = e.touches[0].clientX;
        this.touchStartY = e.touches[0].clientY;
        return;
      }

      // 如果之前在缩放，设置短时禁用期防止误触发点击，然后重置状态
      if (this._wasPinching) {
        this._wasPinching = false;
        this._lastPinchDistance = null;
        // 300ms 内禁用点击事件，防止误触发
        this._clickDisabled = true;
        setTimeout(() => {
          this._clickDisabled = false;
        }, 300);
        return;
      }

      // 如果之前在拖动，触发 panend 事件
      if (this._isPanning) {
        this._isPanning = false;
        this.triggerEvent('panend', {});
        return;
      }

      // 点击事件被禁用（双指操作后的禁用期内）
      if (this._clickDisabled) {
        return;
      }

      const touch = e.changedTouches[0];  // 获取结束的手指
      if (!touch) return;  // 没有有效触摸点则返回

      const poiMarkers = this._poiMarkers;  // 获取 POI 标记点数组
      if (!poiMarkers || poiMarkers.length === 0) return;  // 无标记点则返回

      // 获取 Canvas 在页面中的位置信息
      const query = wx.createSelectorQuery().in(this);
      query.select('.board-canvas').boundingClientRect().exec((res) => {
        if (!res[0]) return;  // 获取失败则返回
        const rect = res[0];

        // 计算点击位置相对于 Canvas 的坐标
        const relX = touch.clientX - rect.left;
        const relY = touch.clientY - rect.top;

        // 获取当前的缩放和偏移属性
        const scale = this.properties.scale || 1;
        const offsetX = this.properties.offsetX || 0;
        const offsetY = this.properties.offsetY || 0;

        // 逆变换：将屏幕坐标转换为逻辑坐标
        // render 中的变换是:
        // translate(canvasWidth/2 + offsetX, canvasHeight/2 + offsetY)
        // scale(scale)
        // translate(-canvasWidth/2, -canvasHeight/2)
        // 所以逆变换是: (relX + canvasWidth/2) / scale - canvasWidth/2 - offsetX
        const canvasWidth = rect.width;
        const canvasHeight = rect.height;
        const logicX = (relX - canvasWidth/2 - offsetX) / scale + canvasWidth/2;
        const logicY = (relY - canvasHeight/2 - offsetY) / scale + canvasHeight/2;

        // 在所有 POI 标记点中找最近的点
        let nearestIdx = -1;
        let nearestDist = Infinity;

        // 遍历所有标记点，找到 30px 范围内最近的点
        for (let i = 0; i < poiMarkers.length; i++) {
          const m = poiMarkers[i];
          const dist = Math.sqrt((m.x - logicX) ** 2 + (m.y - logicY) ** 2);
          if (dist < 30 && dist < nearestDist) {  // 距离小于 30px 且比当前最近更近
            nearestDist = dist;
            nearestIdx = i;
          }
        }

        // 找到有效的点，触发 gridtap 事件
        if (nearestIdx >= 0) {
          this.triggerEvent('gridtap', { index: nearestIdx });
        }
      });
    },

    // 计算双指之间的距离
    // e: 触摸事件对象
    // 返回：两个触摸点之间的距离（像素）
    _getPinchDistance(e) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;  // X 方向差值
      const dy = e.touches[0].clientY - e.touches[1].clientY;  // Y 方向差值
      return Math.sqrt(dx * dx + dy * dy);  // 勾股定理计算距离
    }
  }
});