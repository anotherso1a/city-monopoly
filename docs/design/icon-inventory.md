# icon 缺失/不合理清单

> 用于跟踪 [iconfont.cn](https://www.iconfont.cn/) 项目 **5187084** 与本项目的 icon 对齐情况。
>
> **当前字体:** `font_5187084_75v9saj78xx`(已 base64 内嵌到 [utils/iconfont.wxss](../../utils/iconfont.wxss),脱离网络)

## 1. 当前已对齐 ✓

### POI

| POI | 当前 icon | 备注 |
|------|----------|------|
| 教堂 | `icon-jiaotang` | v2 ✨ |
| 摩天楼 | `icon-bangonglou`(办公楼) | v2 ✨ |
| 博物馆 | `icon-bowuguan` | v2 ✨ |
| 公园 | `icon-park` | v3 ✨ |
| 街区 | `icon-city` | v3 ✨ |
| 车站 | `icon-road_sign` | v3 ✨ |
| 历史区 | `icon-home` | OK |
| 集市 | `icon-shop` | OK |
| 桥梁 | `icon-bank` | OK |
| 广场 | `icon-location` | OK |

### 其他

| 位置 | 当前 | 备注 |
|------|------|------|
| game 当前步数 | `icon-foot` | v3 ✨(原 `icon-check` 降级) |
| game 骰子按钮 | emoji `🎲` | 跨平台原生 emoji,免去 iconfont |
| edit "成就点 +N" | `icon-trophy` | 正确 ✓ |
| photo-card "继续前进" | `icon-right` | 右箭头 |
| index "查看全部" 箭头 | `icon-right` | 右箭头 |
| game 金币持有 | `icon-Dollar` | $ |
| edit 金币奖励 | `icon-Dollar` | $ |
| settlement 累计金币 | `icon-Dollar` | $ |

## 2. 待办

| 用途 | 现状 | 后续 |
|------|------|------|
| edit 税率 | 当前用 `icon-sync` 降级 | **整个税率字段后续会从 edit 删除**,届时移除 |

## 3. iconfont 已定义但项目暂未使用(可后续启用 / 删除)

**v2/v3 新加:**
- `icon-yiyuan`(医院) / `icon-xuexiao`(学校) / `icon-zhanguan`(展馆) — 潜在 POI 类型
- `icon-Cocktail-1` / `icon-Coffee-1` / `icon-Icecream` / `icon-Marshmallow` — 可做 chance card 装饰

**旧的:**
- `icon-signal-fill`(原骰子用,已改 emoji,可从 iconfont 删)
- `icon-image`(原街区用,已升级 city,无引用)
- `icon-check`(原步数用,已升级 foot,无引用)
- `icon-info-circle`(原摩天楼用,无引用)
- `icon-heart`(原公园用,无引用)
- `icon-book`(原博物馆用,无引用)
- `icon-frown` / `icon-meh` / `icon-smile` / `icon-rest` / `icon-camera` / `icon-bulb` / `icon-edit`(从未在本项目用过)

## 4. 字体更新流程

下次 iconfont.cn 改动后:

1. 在 iconfont.cn 项目 5187084 改 icon 并重新生成
2. 复制新的 css URL(形如 `https://at.alicdn.com/t/c/font_5187084_<HASH>.css?...`)
3. 本地下载 woff2 并 base64 化:
   ```bash
   curl -sL "https://at.alicdn.com/t/c/font_5187084_<HASH>.woff2?t=<TIMESTAMP>" -o /tmp/iconfont.woff2
   base64 -i /tmp/iconfont.woff2 | tr -d '\n' > /tmp/iconfont.b64
   ```
4. 把 [utils/iconfont.wxss](../../utils/iconfont.wxss) 里 `@font-face` 的 base64 部分替换,同步 `.icon-xxx:before` 列表(参考新 CSS 的 unicode 值)
5. 通知 Claude 检查项目内引用,补降级 / 升级新 icon
