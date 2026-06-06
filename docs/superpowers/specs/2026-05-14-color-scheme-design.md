# City Monopoly 配色设计方案

> 版本：v1.1
> 日期：2026-05-14
> 状态：已批准

## 1. 设计背景

原始 PRD 采用经典大富翁风格配色（棕红、金色、米白）。根据 Logo 设计风格（城市大富翁游戏 Logo：金色字体、蓝天白云、粉色花朵、绿色植物），重新设计配色方案，在 Logo 明亮3D感基础上增加游戏质感。

## 2. 核心调色板

| 角色 | 颜色名称 | HEX | 说明 |
|------|----------|-----|------|
| 财富金 | Wealth Gold | `#FFB800` | 主色调，Logo 金色，象征财富与成功 |
| 阳光黄 | Sun Yellow | `#FFD54F` | 高亮、次要金色元素 |
| 深金 | Deep Gold | `#E6A200` | 按钮按下态、阴影 |
| 幸运绿 | Lucky Green | `#4CAF50` | 打卡成功、增长、正向奖励 |
| 生机绿 | Fresh Green | `#81C784` | 次要绿色、装饰元素 |
| 天空蓝 | Sky Blue | `#29B6F6` | 天空、城市背景、链接 |
| 清新蓝 | Fresh Blue | `#4FC3F7` | 水面、装饰元素 |
| 樱花粉 | Cherry Pink | `#F48FB1` | 花朵装饰、温馨提示 |
| 暖橙 | Warm Orange | `#FF7043` | 活力、CTA 按钮渐变 |
| 金币铜 | Coin Bronze | `#BF8D30` | 金币图标、古铜质感 |

## 3. 功能色

| 用途 | 颜色名称 | HEX | 说明 |
|------|----------|-----|------|
| 机会卡底色 | Chance Red | `#C41E3A` → `#8B0000` | 深红渐变，保留传统大富翁感 |
| 机会卡文字 | Cream White | `#FFF8E7` | 米白，保证可读性 |
| 危险/惩罚 | Danger Red | `#D32F2F` | 扣除金币、负向事件 |
| 成功色 | Success Green | `#4CAF50` | 正向反馈、打卡成功 |
| 警告色 | Warning Orange | `#FF9800` | 提示、注意 |

## 4. 背景与文字

| 用途 | 颜色名称 | HEX | 说明 |
|------|----------|-----|------|
| 全局背景 | Sky White | `#F5F9FF` | 带蓝调的米白，清新通透 |
| 卡片背景 | Pure White | `#FFFFFF` | 浮层、卡片、弹窗 |
| 棋盘背景 | Board Sky | `#E3F2FD` → `#BBDEFB` | 天空蓝层次渐变 |
| 文字主色 | Charcoal | `#2D3436` | 深灰，柔和黑色 |
| 文字次要 | Medium Gray | `#636E72` | 中灰、辅助文字 |
| 文字浅色 | Light Gray | `#B2BEC3` | 禁用态、占位符 |
| 分割线 | Border Gray | `#E0E0E0` | 边框、分割线 |

## 5. 环形棋盘

| 元素 | 颜色 |
|------|------|
| 棋盘背景 | 渐变 `#E3F2FD` → `#BBDEFB` |
| 格子底色 | `#FFFFFF` + `1px #E0E0E0` 边框 |
| POI 格子 | 白底 + 类型图标 |
| 机会格 | `#C41E3A` 深红底 + `#FFB800` 金边 |
| 当前位置 | 金色光晕 `box-shadow: 0 0 20px #FFB800` |
| 起点格 | `#FFB800` 金底 + 金色图标 |
| 已打卡格 | 绿角标 `#4CAF50` |

## 6. 按钮

| 类型 | 背景 | 文字 | 边框 |
|------|------|------|------|
| 主按钮 | 渐变 `#FFB800` → `#FF9800` | `#FFFFFF` | 无 |
| 主按钮按下 | 渐变 `#E6A200` → `#F57C00` | `#FFFFFF` | 无 |
| 次按钮 | `#FFFFFF` | `#FFB800` | `1px #FFB800` |
| 次按钮按下 | `#FFF8E7` | `#E6A200` | `1px #E6A200` |
| 机会卡弹窗 | 渐变 `#C41E3A` → `#8B0000` | `#FFF8E7` | `#FFB800` 金边 |

## 7. 图标配色

| 图标 | 颜色 |
|------|------|
| 骰子 | `#FFB800` 金色 + `#FFFFFF` 点数 |
| 金币 | 渐变 `#FFD700` → `#FFB800` |
| 位置定位 | `#29B6F6` 天空蓝 |
| 打卡成功 | `#4CAF50` 幸运绿 |
| 机会卡 | `#C41E3A` 深红 |
| 导航箭头 | `#636E72` 中灰 |

## 8. 代码变量命名

```css
/* 核心色 */
--color-wealth-gold: #FFB800;
--color-sun-yellow: #FFD54F;
--color-deep-gold: #E6A200;
--color-lucky-green: #4CAF50;
--color-fresh-green: #81C784;
--color-sky-blue: #29B6F6;
--color-fresh-blue: #4FC3F7;
--color-cherry-pink: #F48FB1;
--color-warm-orange: #FF7043;
--color-coin-bronze: #BF8D30;

/* 功能色 */
--color-chance-red: #C41E3A;
--color-danger-red: #D32F2F;
--color-success: #4CAF50;
--color-warning: #FF9800;

/* 背景色 */
--color-bg-page: #F5F9FF;
--color-bg-card: #FFFFFF;
--color-bg-board: linear-gradient(#E3F2FD, #BBDEFB);

/* 文字色 */
--color-text-primary: #2D3436;
--color-text-secondary: #636E72;
--color-text-disabled: #B2BEC3;

/* 边框色 */
--color-border: #E0E0E0;
--color-gold-border: #FFB800;
```

## 9. 应用范围

- [x] 全局主题色（按钮、图标、Tab bar 等）
- [x] 棋盘/地图格子（环形棋盘、格子背景、当前位置高亮）
- [x] 机会卡样式（卡片背景、边框）
- [x] 金币/资产展示
- [x] 打卡时间线
- [x] PRD-v1.0.md 文档更新

## 10. 过渡方案

保留旧配色变量名到新变量的映射，确保现有代码无需大幅重写：

```css
/* 兼容旧命名 */
--color-primary: var(--color-wealth-gold);
--color-secondary: var(--color-chance-red);
--color-background: var(--color-bg-page);
--color-text: var(--color-text-primary);
```