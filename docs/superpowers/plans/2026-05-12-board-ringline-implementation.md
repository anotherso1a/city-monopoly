# Board 环形线路实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现环形不规则线路地图，点位用圆点标记，点击弹窗显示信息

**Architecture:** 新方案更简洁 — 只画线和点，不画格子。点位计算和渲染全在 Board 组件内

**Tech Stack:** 微信小程序 Canvas

---

## 文件结构

```
components/
├── Board/
│   ├── board.js      # 重写 render()，新线路绘制逻辑
│   ├── board.wxml    # 不变
│   └── board.wxss    # 不变

utils/
├── pathCalculator.js   # 替换：点位计算新算法
```

---

## 实现任务

### Task 1: 重写 PathCalculator 为点位计算器

**Files:**
- Create/Replace: `utils/pathCalculator.js`

- [ ] **Step 1: 创建新 PathCalculator**

```javascript
// pathCalculator.js - 环形不规则线路点位计算

const MIN_DISTANCE = 40;  // 点位最小间距（直径24 + 间隙16）

class PathCalculator {
  /**
   * 计算 N 个点位的不规则环形分布
   * @param {number} N - 点位总数
   * @param {number} canvasWidth - 画布宽度
   * @param {number} canvasHeight - 画布高度
   * @returns {Array<{x, y, angle, radius}>}
   */
  static calculate(N, canvasWidth, canvasHeight) {
    const cx = canvasWidth / 2;
    const cy = canvasHeight / 2;
    const baseRadius = Math.min(canvasWidth, canvasHeight) * 0.35;

    // 第一遍：随机生成所有点位
    const points = [];
    for (let i = 0; i < N; i++) {
      const angle = (i / N) * 2 * Math.PI - Math.PI / 2;
      const radiusVariation = 0.7 + Math.random() * 0.6; // 0.7 ~ 1.3
      const radius = baseRadius * radiusVariation;
      points.push({
        x: cx + radius * Math.cos(angle),
        y: cy + radius * Math.sin(angle),
        radius,
        angle: 0
      });
    }

    // 第二遍：检查间距，动态调整
    for (let iteration = 0; iteration < 10; iteration++) {
      let adjusted = false;
      for (let i = 0; i < N; i++) {
        const p1 = points[i];
        const p2 = points[(i + 1) % N];
        const dist = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);

        if (dist < MIN_DISTANCE) {
          // 往外推
          const midX = (p1.x + p2.x) / 2;
          const midY = (p1.y + p2.y) / 2;
          const pushFactor = (MIN_DISTANCE - dist) / 2 + 2;

          // 推两个点远离圆心方向
          const dir1 = Math.atan2(p1.y - cy, p1.x - cx);
          const dir2 = Math.atan2(p2.y - cy, p2.x - cx);

          p1.x += Math.cos(dir1) * pushFactor;
          p1.y += Math.sin(dir1) * pushFactor;
          p2.x += Math.cos(dir2) * pushFactor;
          p2.y += Math.sin(dir2) * pushFactor;

          adjusted = true;
        }
      }
      if (!adjusted) break;
    }

    // 第三遍：计算每个点沿路径的切线角度
    for (let i = 0; i < N; i++) {
      const p1 = points[i];
      const p2 = points[(i + 1) % N];
      const dx = p2.x - p1.x;
      const dy = p2.y - p1.y;
      points[i].angle = Math.atan2(dy, dx);
    }

    return points;
  }

  /**
   * 生成连接路径的线段数据（用于 canvas 绘制）
   * @param {Array} points - PathCalculator.calculate 返回的点位数组
   * @param {number} cornerRadius - 圆角半径
   * @returns {Array<{type, x, y, cornerRadius?}>}
   */
  static buildPathSegments(points, cornerRadius = 8) {
    const N = points.length;
    const segments = [];

    for (let i = 0; i < N; i++) {
      const curr = points[i];
      const next = points[(i + 1) % N];

      // 直线段到下一点中点
      const midX = (curr.x + next.x) / 2;
      const midY = (curr.y + next.y) / 2;

      segments.push({ type: 'lineTo', x: midX, y: midY });

      // 圆角过渡
      segments.push({
        type: 'arcTo',
        x1: next.x, y1: next.y,  // 圆弧终点（下一点）
        cornerRadius
      });
    }

    return segments;
  }
}

module.exports = { PathCalculator };
```

- [ ] **Step 2: 验证文件**

```bash
node -e "const { PathCalculator } = require('./utils/pathCalculator'); const r = PathCalculator.calculate(8, 300, 300); console.log('8 points:', r.map(p => ({x: p.x.toFixed(0), y: p.y.toFixed(0)})));"
```

---

### Task 2: 重写 Board render() 绘制环形线路

**Files:**
- Modify: `components/Board/board.js`

- [ ] **Step 1: 重写 render()**

替换现有的 render() 方法：

```javascript
render() {
  if (!this.ctx) return;

  const ctx = this.ctx;
  const canvasWidth = this.canvas.width / this.dpr;
  const canvasHeight = this.canvas.height / this.dpr;
  const grids = this.properties.grids;
  const currentIndex = this.properties.currentGridIndex;
  const scale = this.properties.scale || 1;
  const offsetX = this.properties.offsetX || 0;
  const offsetY = this.properties.offsetY || 0;

  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  ctx.save();
  ctx.translate(canvasWidth / 2 + offsetX, canvasHeight / 2 + offsetY);
  ctx.scale(scale, scale);
  ctx.translate(-canvasWidth / 2, -canvasHeight / 2);

  // 计算点位
  const points = PathCalculator.calculate(grids.length, canvasWidth, canvasHeight);

  // 画线路
  this.drawPath(ctx, points);

  // 画点位标记
  for (let i = 0; i < points.length; i++) {
    this.drawPoint(ctx, points[i], i, currentIndex === i);
  }

  // 画中心信息
  this.drawCenterInfo(ctx, canvasWidth / 2, canvasHeight / 2, currentIndex, grids[currentIndex]);

  ctx.restore();
},

drawPath(ctx, points) {
  if (points.length < 2) return;

  const N = points.length;
  const cornerRadius = 10;

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 0; i < N; i++) {
    const curr = points[i];
    const next = points[(i + 1) % N];

    // 中点
    const midX = (curr.x + next.x) / 2;
    const midY = (curr.y + next.y) / 2;

    // 圆角：找到中点关于 curr-next 连线的垂点作为控制点
    const dx = next.x - curr.x;
    const dy = next.y - curr.y;
    const len = Math.sqrt(dx * dx + dy * dy);
    const ux = -dy / len;
    const uy = dx / len;

    // 控制点在连线法线方向，距离取决于拐角角度
    const cornerOffset = cornerRadius * 0.5;
    const ctrlX = midX + ux * cornerOffset;
    const ctrlY = midY + uy * cornerOffset;

    ctx.quadraticCurveTo(ctrlX, ctrlY, next.x, next.y);
  }

  ctx.closePath();

  // 线段样式
  ctx.strokeStyle = '#D4A84B';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
},

drawPoint(ctx, point, index, isActive) {
  const { x, y, angle } = point;
  const dotRadius = isActive ? 16 : 12;

  ctx.save();
  ctx.translate(x, y);

  // 外发光（当前格）
  if (isActive) {
    ctx.shadowColor = '#FFD700';
    ctx.shadowBlur = 15;
  }

  // 圆点背景
  ctx.beginPath();
  ctx.arc(0, 0, dotRadius, 0, 2 * Math.PI);
  ctx.fillStyle = isActive ? '#FFD700' : '#FFF';
  ctx.fill();
  ctx.strokeStyle = isActive ? '#FFF' : '#D4A84B';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.shadowBlur = 0;

  // 序号文字（反向旋转保持正向）
  ctx.rotate(-angle);
  ctx.fillStyle = isActive ? '#333' : '#666';
  ctx.font = `bold ${isActive ? 16 : 14}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(`${index + 1}`, 0, 0);

  ctx.restore();
},
```

- [ ] **Step 2: 更新 onGridTap 点击检测逻辑**

替换 onGridTap：

```javascript
onGridTap(e) {
  // 点击检测改为通过点位坐标计算
  // 由 touchend 触发，在 onTouchEnd 中处理
},

onTouchEnd(e) {
  const touch = e.changedTouches[0];
  if (!touch) return;

  // 获取 touch 在 canvas 坐标系的实际位置
  const query = wx.createSelectorQuery().in(this);
  query.select('.board-canvas').boundingClientRect().exec((res) => {
    if (!res[0]) return;

    const rect = res[0];
    const canvasX = (touch.clientX - rect.left);
    const canvasY = (touch.clientY - rect.top);

    // 考虑 scale 和 offset 的逆变换
    const canvasWidth = this.canvas.width / this.dpr;
    const canvasHeight = this.canvas.height / this.dpr;
    const scale = this.properties.scale || 1;
    const offsetX = this.properties.offsetX || 0;
    const offsetY = this.properties.offsetY || 0;

    // 变换到逻辑坐标
    const logicX = (canvasX - canvasWidth / 2 - offsetX) / scale + canvasWidth / 2;
    const logicY = (canvasY - canvasHeight / 2 - offsetY) / scale + canvasHeight / 2;

    // 在 PathCalculator 计算的点位中查找最近的
    const points = PathCalculator.calculate(this.properties.grids.length, canvasWidth, canvasHeight);
    let nearestIdx = -1;
    let nearestDist = Infinity;

    for (let i = 0; i < points.length; i++) {
      const dist = Math.sqrt((points[i].x - logicX) ** 2 + (points[i].y - logicY) ** 2);
      if (dist < nearestDist && dist < 30) {
        nearestDist = dist;
        nearestIdx = i;
      }
    }

    if (nearestIdx >= 0) {
      this.triggerEvent('gridtap', { index: nearestIdx });
    }
  });
},
```

- [ ] **Step 3: 清理无用的旧方法**

删除或保留：
- `drawGrid` — 不再需要，可删除
- `drawCenterInfo` — 保留

- [ ] **Step 4: 测试验证**

在模拟器中打开游戏页面，观察：
- 线路是否不规则环形
- 点位是否圆点 + 序号
- 当前格是否高亮
- 点击点位是否弹窗

---

### Task 3: 优化圆角连接算法

**Files:**
- Modify: `components/Board/board.js`

- [ ] **Step 1: 实现真正的圆角线段**

当前 drawPath 用 quadraticCurveTo，但圆角效果不够精确。用 lineTo + arcTo 交替：

```javascript
drawPath(ctx, points) {
  if (points.length < 2) return;

  const N = points.length;
  const cornerRadius = 10;

  ctx.beginPath();

  // 从 points[0] 开始
  ctx.moveTo(points[0].x, points[0].y);

  for (let i = 0; i < N; i++) {
    const curr = points[i];
    const next = points[(i + 1) % N];

    // 当前点到下一点的距离
    const dx = next.x - curr.x;
    const dy = next.y - curr.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    // 圆角大小不超过线段长度的一半
    const r = Math.min(cornerRadius, dist / 2);

    // 直线段（到圆弧起点）
    const lineEndX = curr.x + dx * (1 - r / dist);
    const lineEndY = curr.y + dy * (1 - r / dist);
    ctx.lineTo(lineEndX, lineEndY);

    // 圆弧
    ctx.arcTo(next.x, next.y, lineEndX, lineEndY, r);
  }

  ctx.closePath();

  ctx.strokeStyle = '#D4A84B';
  ctx.lineWidth = 4;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
},
```

---

### Task 4: 最终验证

- [ ] **Step 1: 用不同格子数测试**

15、18、20、24、30 格的地图渲染效果

- [ ] **Step 2: 测试点击和弹窗**

点击不同点位，确认弹窗显示正确信息

- [ ] **Step 3: 测试拖动和缩放**

确认交互功能正常

---

## 验收标准

1. 线路完全不规则，视觉上无明显重复或对称
2. 点位圆点 + 序号，当前格高亮金色
3. 线路拐角处有圆角过渡，不是尖角
4. 点击点位 → 弹窗显示该点位信息
5. 拖动和缩放正常
6. 任意格子数（5-40）都能正常渲染

---

## 执行方式

**Two execution options:**

**1. Subagent-Driven (recommended)** —  dispatch a fresh subagent per task, review between tasks

**2. Inline Execution** — Execute tasks in this session using executing-plans

Which approach?