# image-share 海报页改造为弹窗组件设计

## 背景

现状:`pages/image-share/image-share` 是个独立页面。用户从 [pages/settlement/settlement.js:120-126](../../pages/settlement/settlement.js) 或 [pages/logs/logs.js:124](../../pages/logs/logs.js) 点「生成分享海报」按钮后,`wx.navigateTo` 跳到该页。页面内:

- Painter 离屏 canvas 渲染海报
- 用 `poster-skeleton`(假骨架)填充等待时间
- 渲染完成后(`bind:imgOK`)展示生成的图,有保存到相册 + 关闭按钮

要改的体验:点击「生成分享海报」**不再跳页**,直接在当前页弹弹窗;loading 期间(海报还没生成完)弹窗本身不显示,先弹原生 `wx.showLoading` toast;生成完成才弹出弹窗展示图;`poster-skeleton` 不再需要(因为弹窗在显示时已经是图)。

## 架构

```
settlement.wxml ─┐
                 ├─ <poster-share visible mapId bind:close />
logs.wxml ───────┘
```

新建 `components/poster-share/` 组件,把现有 [pages/image-share/image-share.js](../../pages/image-share/image-share.js) 的渲染逻辑(`buildPalette` / `drawStatCell` / `drawPlaceTags` / `drawPolaroid` / `_loadFromGame` / `_renderPoster` 等)整体搬进组件。两个入口页页面级引用,不走全局 `app.json`。

## 组件接口

| 名称 | 类型 | 说明 |
|---|---|---|
| props `visible` | `Boolean` | 父页控制开关。`false → true` 触发渲染流程;`true → false` 关闭并清空 |
| props `mapId` | `String` | 可空,空时用默认数据(沿用原页行为) |
| event `close` | (无 payload) | 用户点关闭按钮触发;父页应据此把 `visible` 设回 `false` |

## 数据流

```
[settlement.wxml] 用户点「生成分享海报」
  ↓
[settlement.js] onSharePoster() → setData({ posterVisible: true })
  ↓
[poster-share.js] observers.visible(false→true):
  - wx.showLoading({ title: '正在生成…', mask: true })
  - 读取 mapId → engine.getState() → 构造 data → buildPalette
  - setData({ posterPalette })   ← Painter 开始绘制
  ↓
[Painter] bind:imgOK 回调 onPosterImgOK:
  - wx.hideLoading()
  - setData({ posterImageUrl: tempPath, _showModal: true })  ← 此刻弹窗才显示
  ↓
用户操作:
  - 点「保存到相册」→ wx.saveImageToPhotosAlbum(原逻辑保留)
  - 点「关闭预览」→ triggerEvent('close')
  ↓
[settlement.js] onPosterClose() → setData({ posterVisible: false })
  ↓
[poster-share.js] observers.visible(true→false):
  - 清空 posterImageUrl / posterPalette / _showModal,下次再开重新渲染
```

关键:`visible` 只是「请求开始流程」的信号,组件内部用 `_showModal` 标志控制弹窗本体的显隐。`visible=true` 阶段如果 `_showModal=false` → 弹窗不显示,只有 toast loading。`imgOK` 后 `_showModal=true`,弹窗才出现并立刻是完整的图(用户无骨架感)。

## 组件 wxml 结构

顶层两个兄弟节点,关系如下:

```
<!-- 1. 弹窗(仅当 _showModal=true 显示) -->
<view wx:if="{{_showModal}}" class="modal-mask" catchtap="onMaskTap">
  <view class="modal-content" catchtap="onContentTap">
    <image
      class="poster-image"
      src="{{posterImageUrl}}"
      mode="widthFix"
      show-menu-by-longpress="{{true}}"
    />
    <view class="actions">
      <button class="btn-save" bindtap="onSave">保存到相册</button>
      <button class="btn-close" bindtap="onClose">关闭预览</button>
    </view>
  </view>
</view>

<!-- 2. 屏外 Painter,永远挂载,不在 wx:if 内 -->
<view class="offscreen-canvas">
  <painter
    palette="{{posterPalette}}"
    use2D="{{true}}"
    bind:imgOK="onPosterImgOK"
    bind:imgErr="onPosterImgErr"
  />
</view>
```

关键点:

- Painter canvas 必须挂载在 DOM 里才能跑(`wx:if` 隐藏会让 canvas 不存在 → Painter 不工作)。所以它在 wx:if **外**,顶层挂着,永远存在。
- `.offscreen-canvas` 通过 wxss 定位到屏外(`position: absolute; left: -9999rpx; top: -9999rpx;`),用户看不到。
- 弹窗本体用 `wx:if="{{_showModal}}"` 控制,只有渲染完成后才出现,且出现时已经是完整的图,无骨架。
- **遮罩点击不关弹窗**(`onMaskTap` 空实现,只吃掉事件防穿透到下方页面)。
- **`catchtap` on content** 防止 content 点击冒泡到 mask。
- **图片长按**:`show-menu-by-longpress` 沿用原页面,给用户微信原生菜单(保存/转发/复制)。
- **样式**:默认弹窗(半透明黑遮罩 + 白底圆角阴影卡片),无特殊纸张/邮戳效果。

## 错误处理

- `bind:imgErr` → `wx.hideLoading()` + `wx.showToast({ title: '生成失败', icon: 'none' })` + `triggerEvent('close')`
- `getMap(mapId)` 返回空或 `mapData.currentGame` 缺失 → 走默认数据兜底(沿用原 `_loadFromGame` 行为)
- 用户拒绝相册权限 → 沿用原 `_handleAuthDeny` 弹模态引导去设置

## 关闭后的清理

`visible: true → false` 的 observer 内:
- 清空 `posterImageUrl`、`posterPalette`、`_showModal`
- 这样下次打开弹窗时是干净状态,会重新渲染(数据可能变,比如关卡进度更新)

## 接入点改动

| 文件 | 类型 | 改动 |
|---|---|---|
| `components/poster-share/poster-share.{js,json,wxml,wxss}` | **新增 4 文件** | 从 image-share 页面搬运 + 改造为组件 |
| `pages/settlement/settlement.js` | 修改 | `onSharePoster` 改为 `setData({ posterVisible: true })`,新增 `onPosterClose` |
| `pages/settlement/settlement.wxml` | 修改 | 加 `<poster-share visible="{{posterVisible}}" mapId="{{mapId}}" bind:close="onPosterClose" />` |
| `pages/settlement/settlement.json` | 修改 | `usingComponents` 加 `poster-share` |
| `pages/logs/logs.js` | 修改 | 同 settlement.js |
| `pages/logs/logs.wxml` | 修改 | 同 settlement.wxml |
| `pages/logs/logs.json` | 修改 | 同 settlement.json |
| `pages/image-share/` | **删除整个目录** | 不再有人引用 |
| `app.json` | 修改 | 移除 `pages/image-share/image-share` 注册 |
| `project.private.config.json` | 修改 | 移除 image-share 编译入口 |

## 关键设计决定

1. **`visible` 单向控制,组件内 `_showModal` 决定弹窗显隐**。这两个状态分开是为了实现「点击后立刻 loading,渲染完才弹窗」—— `visible=true` 但 `_showModal=false` 是中间态。
2. **canvas 永远屏外挂载**。不依赖弹窗显隐,避免 `wx:if` 让 canvas 不存在导致 Painter 跑不起来。
3. **遮罩点击不关闭**。按用户要求,只能点「关闭预览」按钮。但 mask 仍要 `catchtap` 防止误穿透。
4. **关闭后清空状态**。下次开启重新走完整渲染流程,保证数据是最新的(用户回到 settlement 之后可能改了状态)。
5. **`poster-skeleton` 完全废弃**。新组件不需要骨架 —— 弹窗显示时已经是完成的图。原 image-share.wxss 里相关样式跟着页面目录一起删。
6. **保留 `show-menu-by-longpress`**。让用户能长按图片直接保存/转发(微信原生菜单),与「保存到相册」按钮互为冗余。
7. **不引入全局组件**。只有 settlement / logs 用,页面级 `usingComponents` 就够;未来扩展时一行配置可加。

## 测试

MVP 阶段 IDE 手测,主要 case:

- [ ] settlement 点「生成分享海报」→ 中央转圈 → 弹窗弹出 + 直接是图,无骨架
- [ ] logs 同上
- [ ] 弹窗里点「保存到相册」→ toast「已保存到相册」,相册多一张图
- [ ] 弹窗里点「关闭预览」→ 弹窗消失,回到 settlement 页(无跳页)
- [ ] 弹窗里点遮罩 → **弹窗不关**(关键)
- [ ] 长按图片 → 微信原生菜单(保存/转发/复制)
- [ ] 关闭弹窗后再次点「生成分享海报」→ 可以重新弹出,数据正常
- [ ] mapId 缺失的入口 → 走默认数据兜底,不报错
- [ ] Painter 渲染失败模拟(改 palette 注入错值)→ toast「生成失败」+ 弹窗不弹

## 不在范围

- 不重写 buildPalette 渲染逻辑(整体平移)
- 不优化 Painter 性能(MVP 不必)
- 不引入弹窗动画库(用 CSS opacity/transform 简单过渡即可,如果不做也接受)
- 不做「分享卡片回流」(独立页删掉后这条路径就没了,如有需要后续单独立项)
- 不动 settlement / logs 其他无关功能
