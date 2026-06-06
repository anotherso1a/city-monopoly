# LLM API 集成(关闭 Mock + POI 预检)设计

## 背景

现状 LLM 集成是 mock 模式,`services/aiService.js` 直接 `return mockData`,真实 API 路径在 `f8291b8` 清理时被删除,`utils/request.js` 一起删了。同时项目里还有 3 处其它 mock 开关:`USE_MOCK_SEARCH`(poiService)、`USE_MOCK_LOCATION`(create)、`DEBUG_FORCE_EMPTY`(search)。API key 当前是 `config.local.js` 里的 AMap key,没有 LLM 字段。

本期要:

1. 重新接入真实 LLM(用户提供的 MiniMax key)
2. 关闭所有 mock(LLM 失败硬报错,无 mock 兜底)
3. 接入过程中做 POI 点位预检,数量不足时让用户决定怎么办
4. 把 LLM API key / endpoint / model 放进 config,避免硬编码

## 范围

**做**:

- 重新引入 `utils/request.js` 作为网络层
- 改写 `services/aiService.js`,调真实 LLM,prompt 用新版 schema(`chanceCards` 复数,全 `type: 'poi'`)
- `config.example.js` / `config.local.js` 增加 LLM 字段
- `pages/create/create.js` 在 step 1 → step 2 时做 POI 数量预检,不足显示 inline 提示
- 关闭 `USE_MOCK_SEARCH` / `USE_MOCK_LOCATION` / `DEBUG_FORCE_EMPTY`
- 删除 `services/mock.js`

**不做**:

- LLM 响应缓存(每次生成都是新的地图,无意义)
- LLM 失败重试(用户决定:硬报错,UI 层让用户重试)
- LLM 调用统计埋点(用户决定:先不做,埋点后续优化阶段再加)
- mock 兜底(`generateMap` 失败直接 throw,绝不返回 mock)

## 架构

```
utils/request.js           ← 新,通用 wx.request 包装
services/aiService.js      ← 改写,LLM 业务(鉴权/prompt/解析/校验)
services/poiService.js     ← 关 USE_MOCK_SEARCH
services/mock.js           ← 删
pages/create/create.js     ← 加 POI 预检 + 弹 modal
pages/search/search.js     ← 删 DEBUG_FORCE_EMPTY
config.example.js          ← 加 LLM 字段占位
config.local.js            ← 加 LLM 字段真实值
```

## 设计

### 1. `utils/request.js`(新文件,30 行)

通用 `wx.request` 包装。跟旧版(`f8291b8^`)的差异:

- 去掉内置 `wx.showLoading` / `wx.hideLoading` —— create 页面自己管 `generating` 状态,会重复
- 成功判断简化为 HTTP 2xx —— 旧版三种格式(`code === 0` / `status === '1'` / `base_resp.status_code === 0`)是为早期高德/MiniMax 混用写的,现在只接 MiniMax,只认 HTTP status
- 默认 timeout 30s;LLM 调用方传 600s

```js
// utils/request.js
// 通用网络请求 Promise 包装,只做 HTTP 层语义(状态码/超时/错误抛出)
// 不内置 wx.showLoading,UI 由调用方控制
// 不预设业务成功条件(不读 code/status/base_resp),只认 HTTP 2xx

const request = ({ url, method = 'GET', data, headers, timeout = 30000 }) => {
  return new Promise((resolve, reject) => {
    wx.request({
      url, method, data, header: headers, timeout,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject({
            statusCode: res.statusCode,
            message: `HTTP ${res.statusCode}`,
            body: res.data
          });
        }
      },
      fail: (err) => reject({
        statusCode: 0,
        message: (err && err.errMsg) || '网络错误'
      })
    });
  });
};

module.exports = request;
```

### 2. `services/aiService.js`(改写)

**Prompt 改造** —— 复用旧版主体(经过打磨,带"龙大婶饽饽铺"示例),调整金币范围为动态(基于 `initialGold` 算 10-20%)。

```js
// services/aiService.js
const request = require('../utils/request');
const { LLM_API_KEY, LLM_API_BASE_URL, LLM_MODEL } = require('../config.local');
const { generateId } = require('../utils/storage');

function buildMapGenerationPrompt(pois, gridCount, config) {
  const poiList = pois
    .map((p, i) => `${i + 1}. ${p.name} (${p.type}) - ${p.address}`)
    .join('\n');
  const initialGold = config.initialGold || 1000;
  const minGold = Math.round(initialGold * 0.1);   // 初始金币的 10%
  const maxGold = Math.round(initialGold * 0.2);   // 初始金币的 20%

  return `你是一个游戏设计师,需要根据以下 POI 数据设计一个大富翁风格的环形地图。

POI 数据:
${poiList}

要求:
1. 生成 ${gridCount} 个格子的环形地图
2. **每个格子都是真实 POI**(type: 'poi'),其中约 ${Math.floor(gridCount * 0.18)} 个 POI 额外附加 chanceCards 数组
   ——不要单独的 chance 格子,所有机会卡都挂在 POI 上面
3. POI 优先使用提供的真实地点;同类 POI 尽量分散,避免连续排列;数量不够时按同类型同区域风格补充
4. 每个带卡的 POI 生成 4 张卡(chanceCards 数组),每张卡描述一个独立事件
5. 卡片描述必须呼应 POI 的名字和类型,语气自然(像在那个地点真的遇到的小事),
   不能是泛泛的"你赢了/输了 X 金币";正负金币都要有
6. 金币变化范围(基于初始金币 ${initialGold},绝对值在 ${minGold}~${maxGold} 之间,即初始金币的 10%-20%):
   - 奖励: +${minGold} 到 +${maxGold}
   - 惩罚: -${minGold} 到 -${maxGold}
   - 数值随机分布,正负都要有

卡片描述示例(POI 是「龙大婶饽饽铺」糕饼店):
- description: "「龙大婶饽饽铺」的牛舌饼刚出炉,要不来一个?", goldChange: -25
- description: "在「龙大婶饽饽铺」凑单领了张满减券", goldChange: 20
- description: "老板娘送了块新做的山楂糕尝鲜", goldChange: 15
- description: "买了一盒带回家送朋友", goldChange: -35

重要:机会卡必须以 chanceCards 数组写在对应 POI 格子内(chanceCards: [...]),
不要新建 type:'chance' 格子。这样分享出去的地图,别人抽到的卡和你完全一样。

输出 JSON 格式(仅输出 JSON,不要其他内容):
{
  "name": "地图名称",
  "grids": [
    { "index": 0, "type": "poi", "poi": { "name": "...", "address": "...", "type": "...", "location": {...} } },
    { "index": 1, "type": "poi", "poi": { "name": "...", "address": "...", "type": "...", "location": {...} },
      "chanceCards": [
        { "description": "...", "goldChange": -25 },
        { "description": "...", "goldChange": 20 },
        { "description": "...", "goldChange": 15 },
        { "description": "...", "goldChange": -30 }
      ]
    }
  ]
}`;
}
```

**LLM 调用** —— 60s 太短,先保持 10 分钟(用户决定),后续埋点优化。

```js
async function generateMap(pois, config) {
  const gridCount = config.gridCount || 20;
  const prompt = buildMapGenerationPrompt(pois, gridCount, config);

  const data = await request({
    url: `${LLM_API_BASE_URL}/chat/completions`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LLM_API_KEY}`,
      'Content-Type': 'application/json'
    },
    data: {
      model: LLM_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7
    },
    timeout: 600000   // 10 分钟,后续根据埋点数据优化
  });

  // 解析 LLM 响应 —— response_format 兜底,直接 JSON.parse
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('LLM 响应为空');
  const mapData = JSON.parse(content);

  // 校验 + 用 AMap POI 补缺失字段
  return validateAndFixMapData(mapData, pois);
}
```

**`validateAndFixMapData`** 保持现有逻辑(从 f8291b8^ 继承),不变。

### 3. POI 点位预检(`pages/create/create.js`)

在 **step 2 → step 3** 的 `nextStep` 中,先 fetch POIs 并展示 loading,数量不足显示 inline 提示 + 3 按钮(不用弹 modal,inline 更轻量):

> **关键设计**:预检挪到 step 2 选完 range 之后才触发,用用户选的实际 range。原 step 1→2 用 default range 是浪费,选 1.5km 跟选 500m 拿到一样的预检结果。

```js
async nextStep() {
  if (this.data.step === 2) {
    if (!this.data.location) {
      wx.showToast({ title: '请先获取位置', icon: 'none' });
      return;
    }
    // 防并发:POI 预检异步期间,双击下一步 / 扩大范围都会进这里
    if (this._fetchingPois) return;

    this._fetchingPois = true;
    this.setData({ poiLoading: true });
    try {
      const { location, range } = this.data;
      const pois = await fetchPOIsForMap({
        location: `${location.longitude},${location.latitude}`,
        radius: range,
        categories: ['餐饮', '购物', '景区'],
      });
      this._cachedPois = pois;

      if (pois.length < this.data.gridCount) {
        this.setData({
          insufficientPoiError: { found: pois.length, needed: this.data.gridCount },
        });
        return;  // 不前进,等用户选 3 个动作之一
      }
      this.setData({ insufficientPoiError: null });
    } catch (err) {
      console.error('POI 预检失败:', err);
      wx.showToast({ title: 'POI 获取失败,请重试', icon: 'none' });
      return;  // 留在 step 2 让用户重试
    } finally {
      this._fetchingPois = false;
      this.setData({ poiLoading: false });
    }
  }
  this.setData({ step: this.data.step + 1 });
  if (this.data.step === 4) {
    this.startGenerateMap();
  }
}
```

UI 层:
- WXML "下一步"按钮在 `poiLoading=true` 时改为"加载中..."(无 `bindtap`,无箭头),返回按钮也隐藏
- 三个动作按钮处理:
  - 重新定位 → 清空 `location` 和 `_cachedPois`,回到 step 1
  - 用现有数额 → gridCount 降为 found,跳到 step 3(跳过预检)
  - 扩大范围 → 升一档 range,重新触发 `nextStep`
- 错误块放在 step 2 区域(range 选择区下方),不再放 step 1

### 4. Config 字段

**`config.example.js`**(模板,**会进 git,永远用占位**):

```js
module.exports = {
  // 高德地图微信小程序 SDK key
  AMAP_KEY: '<your-amap-key>',
  // LLM 配置(MiniMax,OpenAI 兼容协议)
  LLM_API_KEY: '<your-llm-key>',
  LLM_API_BASE_URL: 'https://api.minimaxi.com/v1',
  LLM_MODEL: 'MiniMax-M2',
};
```

**`config.local.js`**(本地真实值,**gitignore,绝不进 git**):

```js
module.exports = {
  AMAP_KEY: '<已填>',
  // 真实 key 填这里
  LLM_API_KEY: '<实际 key 字符串>',
  LLM_API_BASE_URL: '<实际 endpoint>',
  LLM_MODEL: '<实际 model 名>',
};
```

**关键约束**:
- `config.example.js` 永远只放占位字符串,不允许出现任何真实 key(包含历史的、当前有效的、未来即将失效的)
- 真实 key **只**存在于 `config.local.js` 一次性写入,后续在 `aiService.js` 通过 `require('../config.local').LLM_API_KEY` 引用
- 任何代码、注释、commit message、文档中**严禁出现真实 key 的完整字符串**

本期实施后,`config.local.js` 中的真实 key 由用户提供并由我写入文件,endpoint 和 model 由用户后续自行填入。

### 5. Mock 关闭清单

| 位置 | 现状 | 动作 |
|---|---|---|
| `services/poiService.js:123` | `USE_MOCK_SEARCH = true` | 删常量 + 删 `if` 分支,只走真实 `amapwx.getInputtips` |
| `pages/create/create.js:39` | `USE_MOCK_LOCATION = true` | 删常量,`onLoad` 走 `getLocation` |
| `pages/search/search.js:10` | `DEBUG_FORCE_EMPTY = true` | 删常量 + 删 `? [] :` 短路 |
| `services/aiService.js:5` | `require('./mock')` | 删 import,`generateMap` 不再返回 mock |
| `services/mock.js` | 265 行硬编码地图 | 删文件 |

## 错误处理

`generateMap` 任何错误(网络/超时/HTTP 非 2xx/LLM 响应空/JSON 解析失败/schema 不符)→ `throw new Error('具体原因')` → `pages/create/create.js` 的 `try/catch` 弹 `wx.showToast({ title: '生成地图失败: <msg>', icon: 'none', duration: 3000 })`。

**不**做:
- 不静默吞错
- 不返回 mock 兜底
- 不自动重试
- 不自动降级到本地生成

## 已知风险

**API key 泄露**: 本期 session 中用户提供的 MiniMax key 通过明文聊天传递,存在泄露风险。实施完成后,**用户应到 MiniMax 控制台 rotate 该 key**,在 `config.local.js` 中更新。`config.example.js` 永远不写真实 key(只放占位)。

## 后续(本期不做)

- LLM 调用统计埋点:记录 prompt 长度、响应长度、生成耗时、token 用量,用于后续 timeout / max_tokens 优化
- 失败重试:目前单次失败直接报错,后续可加重试 + 退避
- 用户主题输入:让用户输入"美食之旅"/"网红打卡"等主题,LLM 据此生成更聚焦的 chanceCards
