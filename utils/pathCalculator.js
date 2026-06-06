// 路径计算器 - 计算不规则环形地图的线路和点位
// 用于 Canvas 绘制环形线路，生成不可预测但可重现的地图形状

// Mulberry32 伪随机数生成器（基于种子）
// 相同种子产生相同序列，用于地图分享时保证一致性
class PathCalculator {
  /**
   * 创建基于种子的伪随机数生成器
   * Mulberry32 算法：速度快，周期长，适合游戏
   * seed: 种子数值（相同种子产生相同随机序列）
   */
  static _createRNG(seed) {
    let state = seed;
    return function() {
      state |= 0;  // 确保 state 是 32 位整数
      state = state + 0x6D2B79F5 | 0;  // 线性同余生成器更新
      let t = Math.imul(state ^ state >>> 15, 1 | state);  // 混淆
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;  // 进一步混淆
      return ((t ^ t >>> 14) >>> 0) / 4294967296;  // 返回 [0, 1) 的小数
    };
  }

  /**
   * 计算 N 个 POI 标记点的不规则环形路径分布
   * 使用椭圆基础 + 随机半径变化生成不规则形状
   * @param {number} N - 点位数量（格子数量）
   * @param {number} canvasWidth - 画布宽度
   * @param {number} canvasHeight - 画布高度
   * @param {number|string} seed - 随机种子（默认12345），相同种子=相同地图
   * @returns {Object} { pathPoints, poiMarkers } - 路径点和 POI 标记点
   */
  static calculate(N, canvasWidth, canvasHeight, seed = 12345) {
    // 将 seed 转为数值（如果是字符串则累加字符码）
    const numericSeed = typeof seed === 'string'
      ? seed.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
      : seed;
    const random = PathCalculator._createRNG(numericSeed);  // 创建随机数生成器

    const cx = canvasWidth / 2;   // 画布中心 X
    const cy = canvasHeight / 2;  // 画布中心 Y
    const baseRadiusX = canvasWidth * 0.4;  // 椭圆横轴（宽度 40%）
    const baseRadiusY = canvasHeight * 0.4; // 椭圆纵轴（高度 40%）

    // ====== 步骤1：生成路径控制点（受控随机）======
    // 生成 40-80 个路径点，N 越大，点越多
    const pathPointCount = Math.max(40, Math.min(80, Math.floor(N * 4)));
    const pathPoints = [];  // 路径点数组

    const angleStep = (2 * Math.PI) / pathPointCount;  // 每个路径点的角度步长

    // 相邻半径变化要平滑：限制最大变化量 30%
    // 初始半径比例（0.8 到 1.2 之间）
    let prevRatio = 0.8 + random() * 0.4;

    // 沿椭圆生成路径点
    for (let i = 0; i < pathPointCount; i++) {
      const angle = i * angleStep - Math.PI * 3 / 4;  // 从左上角开始（-135度）

      // 计算当前点的半径比例（限制与前一点的相对变化在 30% 内）
      const minRatio = prevRatio * 0.7;   // 最小变化：前一点的 70%
      const maxRatio = prevRatio * 1.3;   // 最大变化：前一点的 130%
      const noise = (random() - 0.5) * 0.1;  // 噪声范围：-0.05 到 +0.05
      const ratio = Math.max(minRatio, Math.min(maxRatio, prevRatio + noise));  // 限制在范围内

      // 计算该点的坐标（椭圆上的点）
      const x = cx + baseRadiusX * ratio * Math.cos(angle);  // X = 中心X + 半径X * 比例 * cos角度
      const y = cy + baseRadiusY * ratio * Math.sin(angle);  // Y = 中心Y + 半径Y * 比例 * sin角度

      pathPoints.push({ x, y });  // 添加路径点
      prevRatio = ratio;  // 更新前一个比例
    }

    // ====== 步骤2：计算路径总长度======
    let totalLength = 0;  // 路径总长度
    const segmentLengths = [];  // 每个线段的长度
    for (let i = 0; i < pathPointCount; i++) {
      const curr = pathPoints[i];  // 当前点
      const next = pathPoints[(i + 1) % pathPointCount];  // 下一个点（环形）
      const dist = Math.sqrt((next.x - curr.x) ** 2 + (next.y - curr.y) ** 2);  // 两点距离
      segmentLengths.push(dist);  // 保存线段长度
      totalLength += dist;  // 累加到总长度
    }

    // ====== 步骤3：沿路径分配 N 个 POI 标记点======
    const poiMarkers = [];  // POI 标记点数组
    const avgSpacing = totalLength / N;  // 平均间距 = 总长度 / 点数

    for (let i = 0; i < N; i++) {
      // 计算该点的目标距离（沿路径的起始位置）
      const baseDist = (i / N) * totalLength;  // 基础距离：按比例分配
      // 加入随机偏移（±15% 的平均间距，增加不规则性）
      const offset = avgSpacing * (random() - 0.5) * 0.3;
      // 最终距离（取模保证在路径范围内）
      const dist = (baseDist + offset + totalLength) % totalLength;

      // 找到该距离所在的线段
      let accumulated = 0;  // 已累计的距离
      let segIndex = 0;     // 线段索引
      for (let j = 0; j < pathPointCount; j++) {
        if (accumulated + segmentLengths[j] > dist) {  // 目标距离在该线段内
          segIndex = j;  // 记录线段索引
          break;  // 跳出循环
        }
        accumulated += segmentLengths[j];  // 累加线段长度
      }

      // 计算该点在线段上的具体位置（线性插值）
      const localDist = dist - accumulated;  // 距离线段起点的距离
      const curr = pathPoints[segIndex];     // 线段起点
      const next = pathPoints[(segIndex + 1) % pathPointCount];  // 线段终点
      const segLen = segmentLengths[segIndex];  // 线段长度
      const t = segLen > 0 ? localDist / segLen : 0;  // 插值参数 [0, 1]
      const x = curr.x + (next.x - curr.x) * t;  // 计算 X 坐标
      const y = curr.y + (next.y - curr.y) * t;  // 计算 Y 坐标

      // 添加 POI 标记点
      poiMarkers.push({
        x,      // X 坐标
        y,      // Y 坐标
        index: i  // 格子索引
      });
    }

    // 返回路径点和 POI 标记点
    return { pathPoints, poiMarkers };
  }
}

// 导出路径计算器
module.exports = { PathCalculator };