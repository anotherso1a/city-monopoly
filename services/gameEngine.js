// 游戏引擎 - 管理游戏状态、掷骰、移动、打卡、机会卡等核心逻辑
// 负责游戏数据的持久化（写入 map.currentGame）和游戏过程的记录

const { generateId, updateMapGameState } = require('../utils/storage');
const { INITIAL_GOLD, LAP_REWARD_GOLD, DICE_MIN, DICE_MAX, GAME_STATUS } = require('../utils/constants');

// 机会卡 badge 池 — 抽卡时按 goldChange 符号随机抽一个固化到 history
// 日志页直接读固化值,不再二次随机 — 同一张卡每次回看都是同一个标签
const POSITIVE_BADGES = ['幸运事件', '财神眷顾', '天降横财', '小赚一笔'];
const NEGATIVE_BADGES = ['意外开销', '破财消灾', '飞来横祸', '略施小惩'];
const NEUTRAL_BADGES = ['平安无事', '虚惊一场'];

function pickChanceCardBadge(goldChange) {
  let pool;
  if (goldChange > 0) pool = POSITIVE_BADGES;
  else if (goldChange < 0) pool = NEGATIVE_BADGES;
  else pool = NEUTRAL_BADGES;
  return pool[Math.floor(Math.random() * pool.length)];
}

class GameEngine {
  // 构造函数
  // mapId: 地图ID
  // mapData: 完整地图数据（含 grids / config / 可选 currentGame）
  // 注意：构造函数不会自动加载 currentGame，由调用方显式调用 initFresh() 或 resume()
  // 机会卡来自地图数据（grid.chanceCards，由 AI 在生成地图时定好）。
  // 卡池是确定的（分享出去的地图，卡池一致），但抽卡是随机的 — 同一玩家每次抽到哪张不一定。
  constructor(mapId, mapData) {
    this.mapId = mapId;
    this.map = mapData;
    this.state = null;
  }

  // 全新开一局
  initFresh() {
    this.state = {
      id: generateId(),
      mapId: this.mapId,
      startedAt: new Date().toISOString(),
      endedAt: null,
      currentGridIndex: 0,
      currentLap: 0,
      currentGold: this.map.config && this.map.config.initialGold
        ? this.map.config.initialGold
        : INITIAL_GOLD,
      diceRolls: 0,
      checkins: [],
      chanceCardHistory: [],
      distance: 0,
      status: GAME_STATUS.PLAYING,
    };
    this.save();
    return this;
  }

  // 从已存在的 currentGame 恢复
  // map.currentGame 必须存在；否则抛错
  resume() {
    if (!this.map.currentGame) {
      throw new Error('该地图没有进行中的游戏');
    }
    this.state = { ...this.map.currentGame };
    return this;
  }

  // 掷骰子，返回 1-6 随机整数（不触发 save，save 发生在 move 里）
  rollDice() {
    const result = DICE_MIN + Math.floor(Math.random() * (DICE_MAX - DICE_MIN + 1));
    this.state.diceRolls++;
    return result;
  }

  // 移动棋子，返回 save 结果 { saved, reason? }
  move(steps) {
    const previousIndex = this.state.currentGridIndex;
    this.state.currentGridIndex = (this.state.currentGridIndex + steps) % this.map.grids.length;
    if (previousIndex + steps >= this.map.grids.length) {
      this.state.currentLap++;
      this.state.currentGold += this.map.config && this.map.config.lapRewardGold
        ? this.map.config.lapRewardGold
        : LAP_REWARD_GOLD;
    }
    return this.save();
  }

  // 获取当前所在格子
  getCurrentGrid() {
    return this.map.grids[this.state.currentGridIndex];
  }

  // 打卡，返回 { success, message?, saved, reason? }
  // photoPath: 打卡照片路径（可选）
  // note: 打卡备注（可选）
  checkin(photoPath, note = '') {
    const grid = this.getCurrentGrid();
    if (!this.map.config || !this.map.config.allowRepeatCheckin) {
      const alreadyCheckedIn = this.state.checkins.some(c => c.gridIndex === this.state.currentGridIndex);
      if (alreadyCheckedIn) {
        return { success: false, message: '此位置已打卡', saved: true, reason: 'already_checked_in' };
      }
    }
    this.state.checkins.push({
      gridIndex: this.state.currentGridIndex,
      timestamp: new Date().toISOString(),
      photoUrl: photoPath,
      note: note || (grid.poi && grid.poi.name),
    });
    const saveResult = this.save();
    return { success: true, saved: saveResult.saved, reason: saveResult.reason };
  }

  // 替换当前格最近一次打卡的照片（不新增打卡记录，仅替换 photoUrl 和 timestamp）
  // photoPath: 新照片路径
  // 返回 { success, message?, saved, reason? }
  replaceCheckinPhoto(photoPath) {
    const checkins = this.state.checkins;
    for (let i = checkins.length - 1; i >= 0; i--) {
      if (checkins[i].gridIndex === this.state.currentGridIndex) {
        checkins[i] = {
          ...checkins[i],
          photoUrl: photoPath,
          timestamp: new Date().toISOString(),
        };
        const saveResult = this.save();
        return { success: true, saved: saveResult.saved, reason: saveResult.reason };
      }
    }
    return { success: false, message: '此位置未打卡' };
  }

  // 抽取机会卡，返回 { card, saved, reason? } 或 null（当前格的卡组为空）
  // 卡池来自 grid.chanceCards（地图里的确定性数组），抽卡是随机的
  // history 里只存 cardIndex + 固化的 badge,具体 card 内容由 logs 等消费方按需反查
  drawChanceCard() {
    const gridIndex = this.state.currentGridIndex;
    const grid = this.map.grids[gridIndex];
    if (!grid.chanceCards || grid.chanceCards.length === 0) return null;
    const cards = grid.chanceCards;

    const cardIndex = Math.floor(Math.random() * cards.length);
    const card = cards[cardIndex];

    this.state.currentGold += card.goldChange;
    this.state.chanceCardHistory.push({
      gridIndex,
      cardIndex,
      badge: pickChanceCardBadge(card.goldChange),
      timestamp: new Date().toISOString(),
    });
    const saveResult = this.save();
    return { card, saved: saveResult.saved, reason: saveResult.reason };
  }

  // 增加行进距离，返回 save 结果
  addDistance(meters) {
    this.state.distance += meters;
    return this.save();
  }

  // 结束游戏，返回 save 结果
  settle() {
    this.state.status = GAME_STATUS.COMPLETED;
    this.state.endedAt = new Date().toISOString();
    return this.save();
  }

  // 获取当前游戏状态（浅拷贝）
  getState() {
    return { ...this.state };
  }

  // 获取游戏时间线（用于结算/日志页面）
  // 注意:首条 checkin 如果落在 grid 0,会被显式 push 一次,后续 sortedCheckins 必须
  // 跳过第一条,否则会出现"同时间同内容两条"重复
  // 机会卡事件只带 cardIndex + 固化 badge,不嵌入 card 对象 — 由消费方按需反查
  getTimeline() {
    const events = [];
    const hasStartCheckin = this.state.checkins.length > 0
      && this.state.checkins[0].gridIndex === 0;
    if (hasStartCheckin) {
      events.push({ ...this.state.checkins[0] });
    } else {
      events.push({
        gridIndex: 0,
        timestamp: this.state.startedAt,
        note: '起点',
      });
    }
    const sortedCheckins = [...this.state.checkins].sort(
      (a, b) => new Date(a.timestamp) - new Date(b.timestamp)
    );
    const tail = hasStartCheckin ? sortedCheckins.slice(1) : sortedCheckins;
    events.push(...tail);
    this.state.chanceCardHistory.forEach(ch => {
      events.push({
        gridIndex: ch.gridIndex,
        timestamp: ch.timestamp,
        cardIndex: ch.cardIndex,
        badge: ch.badge,
        isChanceCard: true,
      });
    });
    return events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  // 获取游戏统计数据
  getStatistics() {
    const startTime = new Date(this.state.startedAt);
    const endTime = this.state.endedAt ? new Date(this.state.endedAt) : new Date();
    const durationMs = endTime - startTime;
    const hours = Math.floor(durationMs / 3600000);
    const minutes = Math.floor((durationMs % 3600000) / 60000);
    return {
      totalDiceRolls: this.state.diceRolls,
      totalDistance: this.state.distance,
      totalDuration: `${hours}小时${minutes}分钟`,
      currentGold: this.state.currentGold,
      totalCheckins: this.state.checkins.length,
      totalLaps: this.state.currentLap,
    };
  }

  // 持久化到 map.currentGame，返回 save 结果
  save() {
    return updateMapGameState(this.mapId, this.state);
  }
}

module.exports = { GameEngine };
