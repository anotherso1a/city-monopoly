# design-system 对齐改造设计

## 背景

基于 [docs/UI-DESIGN-GUIDE.md](../../UI-DESIGN-GUIDE.md) v2.0 定义的"手绘+纸面+serif"设计系统,以及 [docs/design/game.html](../../design/game.html) 的 game 页面实现,本次审计发现项目内 9 个页面 + 9 个组件中存在三类与基线不一致的问题:

1. **样式系统残留**:`app.wxss` 是冷蓝 + sans-serif + 胶囊按钮的旧实现,部分页面继续继承
2. **代码级不一致**:`px`/`rpx` 混用、字体硬编码、字号标尺不统一
3. **Icon 错配**:`icon-edit-note` 在 [pages/edit/edit.wxml:68](pages/edit/edit.wxml#L68) 引用但未定义(渲染丢失);10 处 icon 与语义不符

本次改造把所有 P0-P2 范围统一收敛到 game 页面的 paper / serif 风格。

## 设计基线(以 game 为准)

- **页面底色**:`#f7eed2`(纸面黄) / 内容区 `#fff9ed`(浅纸面)
- **字体**:serif(`Source Serif 4` → `Noto Serif SC` → `-apple-system`),技术标签用 monospace(`Courier Prime` → `'Courier New', monospace`)
- **单位**:全 rpx。`px` 出现在 6 个页面,均需转换
- **Sketch border**:`4rpx solid #837560` + 不对称圆角(基线 4 种:`sketch-border`、`sketch-border-sm`、`hand-drawn-border`、`card-border`)
- **Soft shadow**:`0 4rpx 12rpx rgba(131, 117, 96, 0.15)`
- **按压**:`transform: translate(2-8rpx, 2-8rpx) + box-shadow: 0`(硬阴影位移,不是 `scale(0.98)`)
- **入场动画**:`@keyframes ink-fade`(`translateY(10rpx) + opacity 0→1` 0.8s ease-out)

## 改动范围

| 文件 | 类型 | 改动 |
|------|------|------|
| [app.wxss](../app.wxss) | 修改 | page 字体改 serif,删 `#F5F9FF` 冷蓝;删除旧 `btn-primary` / `btn-secondary` 胶囊渐变;集中定义 `sketch-border-sm` / `ink-divider-sm` / `soft-shadow` / 字号标尺类 |
| [utils/iconfont.wxss](../utils/iconfont.wxss) | 修改 | 新增 6-8 个缺失 icon 定义;修复 broken `icon-edit-note` |
| [pages/index/index.wxss](pages/index/index.wxss) | 修改 | 蓝渐变 → 纸面;px → rpx;`HOT` 改中文 `热门` |
| [pages/create/create.wxss](pages/create/create.wxss) | 修改 | px → rpx;字体改 serif;删 `btn-primary` 旧胶囊引用 |
| [pages/edit/edit.wxss](pages/edit/edit.wxss) | 修改 | page 字体改 serif;px → rpx;`tile-item` 加 sketch 边角 |
| [pages/history/history.wxss](pages/history/history.wxss) | 修改 | `--page-bg: #f5f9ff` → 纸面;`map-name` 字号 px → rpx |
| [pages/historyempty/historyempty.wxss](pages/historyempty/historyempty.wxss) | 修改 | 字体改 serif |
| [pages/settlement/settlement.wxss](pages/settlement/settlement.wxss) | 修改 | 字体改 serif(`.hero-title` `.timeline-header-text` `.btn-share` `.btn-replay` `.stat-value`) |
| [pages/search/search.wxss](pages/search/search.wxss) | 修改 | 微调(基本已对齐) |
| [components/Sidebar/sidebar.wxss](components/Sidebar/sidebar.wxss) | 修改 | 把 `sketch-border-sm` / `ink-divider-sm` 类本地化(style isolation 失效的 bug) |
| [components/NavigationBar/navigation-bar.wxss](components/NavigationBar/navigation-bar.wxss) | 修改 | 字体改 serif;深金渐变保留(品牌识别) |
| [components/empty-search/empty-search.wxss](components/empty-search/empty-search.wxss) | 修改 | 字体改 serif |
| [components/chance-card/chance-card.wxss](components/chance-card/chance-card.wxss) | 修改 | `.headline-lg-mobile` 字号 `24px` → `32rpx` |
| [components/photo-card/photo-card.wxss](components/photo-card/photo-card.wxss) | 修改 | `.headline-lg-mobile` 字号 `24px` → `32rpx` |
| [components/log-entry/log-entry.wxss](components/log-entry/log-entry.wxss) | 修改 | 字体改 serif(`.location-text` `.polaroid-caption`) |
| [pages/edit/edit.wxml](pages/edit/edit.wxml) | 修改 | `icon-edit-note` 替换为 `icon-edit-square` |
| [pages/edit/edit.js](pages/edit/edit.js) | 修改 | POI icon 映射:`教堂`/`摩天楼`/`车站` 替换 |
| [pages/index/index.wxml](pages/index/index.wxml) | 修改 | `HOT` 文案改 `热门` |
| [pages/game/game.wxml](pages/game/game.wxml) | 修改 | 步数 icon `icon-check` → `icon-footprint`;骰子 icon 调整 |
| [components/Sidebar/sidebar.js](components/Sidebar/sidebar.js) | 修改 | 重复 `icon-location` 改为 `icon-compass` / `icon-home`;`icon-forward` → `icon-share` |
| [components/photo-card/photo-card.wxml](components/photo-card/photo-card.wxml) | 修改 | headline-lg-mobile class 替换;icon `icon-forward` → `icon-share` |

无新文件(iconfont 改动是追加),无新依赖,无新组件。

### 阻塞项(需要你手动操作)

**iconfont 新增 6 个 icon 需你操作**:

去 [iconfont.cn](https://www.iconfont.cn/) 项目 5187084,搜索并添加:
- `church` (教堂)
- `skyscraper` (摩天楼)
- `train` (车站)
- `footprint` (步数 / 足迹)
- `dice` / `casino` (骰子)
- `percent` (税率 / 百分比)

添加后**重新生成 CSS**,把新 URL 替换 [utils/iconfont.wxss:5-7](../utils/iconfont.wxss#L5-L7) 的 `@font-face` 里的 `t=...` 时间戳。

执行阶段(subagent)会等你更新后追加 6 条 `:before` 规则。如果你暂未更新,subagent 会用"降级方案":

| 应有 icon | 降级用 | 降级位置 |
|----------|--------|---------|
| `icon-church` | `icon-trophy` | `edit.js:163` (教堂) |
| `icon-skyscraper` | `icon-info-circle` | `edit.js:162` (摩天楼) — 现状 |
| `icon-train` | `icon-forward` | `edit.js:165` (车站) — 现状 |
| `icon-footprint` | `icon-check` | `game.wxml:34` 步数 — 现状 |
| `icon-dice` | `icon-signal-fill` | `game.wxml:104` 骰子 — 现状 |
| `icon-percent` | `icon-sync` | `edit.wxml:107` 税率 — 现状 |

降级方案 commit message 加 `[degraded-pending-iconfont-update]` 前缀,提醒后续去 iconfont 替换。

### 已知不在本轮(P3 后续处理)

- Dice 组件 paper 化([components/Dice/dice.wxss](../components/Dice/dice.wxss))
- game.wxss 的 `btn-nav` / `btn-checkin-modal` 蓝/绿渐变改 paper
- 各 page `--shadow-color` 等冗余变量清理
- index.wxss 的 `.drift` 动画是否要保留(语义上跟 game 不一致)
- empty-search 内的 🗺️ emoji 是否替换为插画
- iconfont 里未使用的 7 个 icon(calendar-check / camera / user / logout / setting / rest / shop)是否删除

## 关键设计决策

### 1. 字号标尺(集中在 `app.wxss`)

抽出 7 个全局字号类,所有页面统一用 class,不再内联 font-size:

| 类名 | size/line-height | 字体 | 用途 |
|------|-----------------|------|------|
| `.text-display-lg` | 96rpx / 112rpx | serif 700 | 结算页 hero(已用) |
| `.text-display-lg-mobile` | 64rpx / 80rpx | serif 700 | 主 hero(settlement/game 用) |
| `.text-headline-md` | 40rpx / 56rpx | serif 600 | 区块标题 |
| `.text-headline-sm` | 32rpx / 40rpx | serif 700 | 卡片标题 |
| `.text-body-lg` | 32rpx / 48rpx | serif 400 | 描述 |
| `.text-body-md` | 28rpx / 40rpx | serif 400 | 正文 |
| `.text-body-sm` | 24rpx / 32rpx | serif 400 | 辅助 |
| `.text-mono` | 24rpx / 32rpx | monospace 700 uppercase letter-spacing 0.1em | 标签 / 数据 |
| `.text-mono-sm` | 20rpx / 28rpx | monospace 600 uppercase letter-spacing 0.1em | 小标签 |

各 page 现有的 `.headline-lg-mobile` / `.body-md` 局部定义全部删除,改用全局类。

### 2. 字体默认(放在 `app.wxss` page {})

```css
page {
  font-family: "Source Serif 4", "Noto Serif SC", -apple-system, BlinkMacSystemFont, serif;
}
```

删除各 page / 组件硬编码的 `font-family: -apple-system, ...` 行。技术标签位置改用 `.text-mono`。

### 3. App-level 公共类(集中到 `app.wxss`)

- `.sketch-border-sm` — 沿用 game.wxss 已有的(`24rpx 8rpx 28rpx 10rpx / 8rpx 28rpx 10rpx 24rpx`)
- `.ink-divider-sm` — 沿用 game.wxss 已有的
- `.sketch-border` — 沿用 game.wxss 已有的
- `.ink-divider` — 沿用 game.wxss 已有的
- `.soft-shadow` — 沿用 game.wxss 已有的
- `.paper-texture` — 沿用 game.wxss 已有的
- `.animate-warm` — 沿用 game.wxss 已有的

每个页面不重复 `@keyframes ink-fade` / `@keyframes shake-dice` / `@keyframes ripple` / `@keyframes drift`,全部放 app.wxss。

### 4. 背景收敛

- 移除 `app.wxss` 的 `#F5F9FF` 冷蓝 → 删除
- `index.wxss` 蓝渐变 → paper background 渐变
- `history.wxss` 的 `--page-bg: #f5f9ff` → 删,继承 page 默认(`#f7eed2`)

### 5. 按压反馈统一

提取 `.btn-press` 工具类:

```css
.btn-press:active {
  transform: translate(4rpx, 4rpx);
  box-shadow: 0 0 0 0 transparent;
}
```

替换所有 `transform: scale(0.95/0.98)` 模式(只保留 game 投骰按钮的 `scale(0.98) + brightness`,因为它有 `filter: brightness(1.1)` 联动)。

### 6. Secondary 颜色:不统一,保留差异

**决策**:不强行统一。

- game 把 `--secondary` 用作 text tone(深棕 `#705a49`)
- 其他页把 `--secondary` 用作 brand red(`#b71032`)
- 两者语义不同(游戏内文字 vs 品牌强调色),合并会丢失品牌识别

### 7. NavigationBar 深金渐变:保留

**决策**:不改为 paper。

- 跨页一致的视觉锚点(用户随时知道自己在哪个 app)
- 纸面顶栏在视觉上太轻,会跟页面内容混在一起
- 仅把 `font-family: sans-serif` 改 serif 即可

### 8. Icon 替换表(明确决定)

| 位置 | 现状 | 改为 | 理由 |
|------|------|------|------|
| `edit.wxml:68` | `icon-edit-note` (未定义) | `icon-edit-square` | 修复 broken |
| `edit.js:163` `'教堂'` | `icon-trophy` | `icon-church`(新增) | 语义不符 |
| `edit.js:162` `'摩天楼'` | `icon-info-circle` | `icon-skyscraper`(新增) | 语义不符 |
| `edit.js:165` `'车站'` | `icon-forward` | `icon-train`(新增) | 语义不符 |
| `game.wxml:34` 步数 | `icon-check` | `icon-footprint`(新增) | 语义不符 |
| `game.wxml:104` 骰子 | `icon-signal-fill` | `icon-dice`(新增) | 语义不符 |
| `sidebar.js:5` 开始探索 | `icon-location` | `icon-compass` | 重复且弱 |
| `sidebar.js:6` 查看所有地图 | `icon-location` | `icon-home` | 重复且弱 |
| `sidebar.js:9` 分享地图 | `icon-forward` | `icon-share` | 语义不符 |
| `edit.wxml:107` 税率 | `icon-sync` | `icon-percent`(新增) | 弱语义 |
| `create.wxml:59` 搜索提示 | `icon-bulb` | `icon-search` | 弱语义 |
| `create.wxml:54` 定位 marker | `icon-plus-circle` | 保留(脉冲 marker 中心用 +) | 合理 |
| `photo-card.wxml` 分享按钮 | `icon-forward` | `icon-share` | 语义不符 |
| `empty-search` 地图 emoji | `🗺️` | 保留 emoji(已是装饰) | OK |

**用户需做的**:
- 去 [iconfont.cn](https://www.iconfont.cn/) 导入 6 个新 icon:church / skyscraper / train / footprint / dice / percent
- 在项目 iconfont 项目里更新一次,utils/iconfont.wxss 的 `@font-face` URL 替换

但这一步**是用户在外部做**,spec 阶段我们只列清单,**实现阶段**等用户更新后我们替换 `utils/iconfont.wxss` 的 URL + 追加 6 条 `:before` 规则。

如果用户暂未更新,采用**临时降级方案**:
- 用现有 icon 里最接近的(`icon-trophy` / `icon-home` / `icon-share` 等)凑数
- 在 commit message 里标 `[degraded-pending-iconfont-update]`

## 验收

1. 微信开发者工具打开后,无 console error / warning
2. 所有页面背景统一为 paper(无蓝渐变残留)
3. 全文搜索 `font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto` 内联声明 = 0
4. 全文搜索 `font-size: \d+px` 内联声明 = 0(非 rpx)
5. `app.wxss` 的胶囊 `btn-primary` 旧定义已删除
6. `icon-edit-note` 引用已替换
7. Sidebar 组件本地化 `sketch-border-sm` / `ink-divider-sm` 后视觉一致
8. 手动逐页走一遍 create 流程,确认 0 视觉回退
