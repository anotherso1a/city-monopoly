# City-walk 成绩数据源规划

> **状态:** 待启动(本文件只描述需要接入的三项需求,未细化到具体实现任务)

## 背景

后续 city-walk 玩法的成绩需要由「距离」+「步数」两个维度构成,创建地图时也要给用户直观的地图视图。本期不实现,只把需求记下来,等做 city-walk 业务流时再细化。

## 需求

### 1. 经纬度距离计算

两坐标点之间距离,支持以下两种方式之一(或都支持):

- **直线距离**:`haversine` 公式,纯前端计算,无外部依赖
- **导航距离**:调腾讯/微信小程序路线规划 SDK,返回实际步行/驾车距离

**待定:** 选哪种 / 是否两种都要 / 切换入口放哪。

### 2. 微信步数获取(`wx.getWeRunData`)

- 进入 city-walk 时取一次基线步数
- 结束/到达终点时再取一次
- 两次差值 = 本次 walk 的步数成绩

**风险点(实施前要验证):** `getWeRunData` 解密后的步数是「当日累计」还是「session 累计」。**只有 session 累计**才适合「开始/结束两次取差」的算法,当日累计的话用户在 walk 期间正常走路/上下楼都会算进去,无法分摊到具体 walk。

### 3. 创建地图使用原生地图组件

创建地图(create 流程)时用微信小程序**原生 `<map>` 组件**渲染地图,而不是只展示 POI 列表文字。预期用法:

- 在 `pages/create/create` 顶部或侧边放 `<map>`,展示用户当前定位
- 搜出来的 POI / 圈选范围内的 POI 在地图上以 `markers` 形式标出
- 用户可以缩放/平移地图来直观确认 POI 分布

**为什么不直接复用现有 AMap 选点 SDK:** 现有 `pages/search/search` 用的是高德 inputtips 选点,功能是「输入关键词→选一个 POI」,不带地图视图;create 流程需要的是「圈定一片区域→看 POI 分布」,体验上需要地图。

**前置:** 微信原生 `<map>` 默认走腾讯地图;如果项目坚持用高德,需评估是否换成 `amap-wx` 提供的地图组件(待确认是否提供完整 `<map>` 替代)。

## 关联文件

- `services/poiService.js` —— 后续可能要在 POI 上挂 distance / walk 路线字段
- `app.json` —— `getWeRunData` 之前需要确认是否要在 `requiredPrivateInfos` 声明(参考 `project_wechat_required_private_infos` 规则)
- `pages/create/create.wxml` / `pages/create/create.js` —— 添加 `<map>` 组件 + markers 数据
- `components/drawing-progress/` —— 生成地图时的进度组件,与 `<map>` 是不同阶段(创建期 vs 生成期),不冲突
- 暂无 city-walk 页面,等业务流设计时再补

## 下一步

等 PRD/设计稿/业务流设计稿出来后,再回来把这份文档细化成可执行计划(可能拆成 3-4 个子任务)。
