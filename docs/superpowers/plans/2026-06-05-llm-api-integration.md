# LLM API 集成(关闭 Mock + POI 预检)实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把"生成地图"从 mock 模式切换到真实 LLM(MiniMax)调用,关闭所有 mock 兜底,在用户配置点位前做 POI 数量预检。

**Architecture:** 三层拆分 —— `utils/request.js` 通用网络层(只判 HTTP 2xx)、`services/aiService.js` 调 LLM(用 `response_format: json_object`)、`services/poiService.js` 直连 AMap REST 翻 2 页 offset=25(SDK 不支持分页)。POI 预检放在 create 页面 **step 2 → step 3** 的过渡里,用用户在 step 2 选的实际 range;加载期间展示 `poiLoading` 状态。

**Tech Stack:** WeChat Mini Program(原生 JS / WXML / WXSS);LLM 用 MiniMax OpenAI 兼容协议;无新增测试框架,纯函数用 Node 自带 `assert` 做轻量验证,wx 相关逻辑在 WeChat dev tools 手动验证。

**Commit 约定:** 每个任务末尾有"Commit"步骤,但**不在自动执行流程中触发**。本计划执行期间一律等用户口头/书面触发 commit 才执行(沿用 `feedback_no_auto_commit` 规则)。

---

## 文件清单(实施前先看一遍)

| 路径 | 状态 | 职责 |
|---|---|---|
| `config.example.js` | 已部分完成(本期+上一期)| 模板,占位 + 注释,进 git |
| `config.local.js` | 已部分完成(本期+上一期)| 真实值,gitignore |
| `utils/request.js` | **新** | 通用 `wx.request` Promise 包装,30 行 |
| `services/aiService.js` | **改写** | LLM 业务:prompt + HTTP + 解析 + 校验 |
| `services/poiService.js` | **改** | 关 `USE_MOCK_SEARCH` |
| `services/mock.js` | **删** | mock 数据已不再需要 |
| `pages/create/create.js` | **改** | 关 `USE_MOCK_LOCATION` + 加 POI 预检 |
| `pages/create/create.wxml` | **改** | 加 POI 不足时的 inline 提示 UI |
| `pages/search/search.js` | **改** | 删 `DEBUG_FORCE_EMPTY` |

---

## 任务依赖图

```
Task 1 (config 字段)         ──→
Task 2 (utils/request.js)    ──→   Task 3 (aiService.js 改写) ──→ Task 8 (删 mock.js)
Task 4 (poiService 关 mock)  ──→   Task 7 (POI 预检 UI) ────────→ Task 8
Task 5 (create 关 mock)      ──→
Task 6 (search 删 debug)     ──→
```

可并行(无依赖):Task 1 / 2 / 4 / 5 / 6。Task 3 依赖 1+2。Task 7 依赖 4+5。Task 8 必须在最后。

---

### Task 1: Config 字段补全

**Files:**
- Modify: `config.example.js`(已写入,本任务核对 + 调注释)
- Modify: `config.local.js`(已写入,本任务核对)

- [ ] **Step 1: 核对 `config.example.js`**

确认 `config.example.js` 现状(上一阶段已写入):

```js
// config.example.js
// 本地配置文件模板。复制为 config.local.js 并填写真实值。
// config.local.js 在 .gitignore 中,不会提交到仓库。

module.exports = {
  // 高德地图微信小程序 SDK key
  // 申请地址:https://lbs.amap.com/dev/key/app
  // 申请时需绑定本小程序的 AppID(在 project.config.json 的 appid 字段)
  // 推荐在高德控制台配置域名/小程序白名单,避免 key 被滥用
  AMAP_KEY: 'a574d6ad99f0a0c479ee2aae1d7d5798',

  // LLM 配置(本期接入 MiniMax,OpenAI 兼容协议)
  // 申请地址:https://platform.minimaxi.com/
  // 1) API key:在控制台创建,填到 config.local.js 的 LLM_API_KEY
  // 2) BASE URL:国际版 https://api.minimaxi.com/v1,国内版 https://api.MiniMax.chat/v1
  // 3) Model:参考控制台模型列表,常用 MiniMax-M2 / abab6.5s-chat
  LLM_API_KEY: '<your-llm-key>',
  LLM_API_BASE_URL: 'https://api.minimaxi.com/v1',
  LLM_MODEL: 'MiniMax-M2',
};
```

如果文件已经是这个内容,跳过本步;否则用上方内容整体覆盖。

- [ ] **Step 2: 核对 `config.local.js`**

确认 `config.local.js` 真实 key 已写入,endpoint/model 是占位。`git status` 应当**看不到**这个文件(.gitignore 生效)。

- [ ] **Step 3: 手动验证**

在 WeChat dev tools 打开项目,Console 执行:

```js
const cfg = require('./config.local');
console.log(cfg.AMAP_KEY.slice(0, 8), '...', cfg.LLM_API_BASE_URL, cfg.LLM_MODEL);
```

预期输出:AMap key 前 8 位 + base URL + model 名(不要把完整 key 打印到 console,会进 IDE 日志)。

- [ ] **Step 4: Commit(checkpoint,等用户触发)**

本任务无独立 commit,跟随 Task 3 一起提交(因为只有 aiService.js 实际用到 LLM 字段)。

---

### Task 2: 通用网络层 `utils/request.js`

**Files:**
- Create: `utils/request.js`

- [ ] **Step 1: 创建 `utils/request.js`**

```js
// utils/request.js
// 通用网络请求 Promise 包装,只做 HTTP 层语义(状态码/超时/错误抛出)
// 不内置 wx.showLoading —— UI 由调用方控制
// 不预设业务成功条件(不读 code/status/base_resp),只认 HTTP 2xx

const request = ({ url, method = 'GET', data, headers, timeout = 30000 }) => {
  return new Promise((resolve, reject) => {
    wx.request({
      url,
      method,
      data,
      header: headers,
      timeout,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data);
        } else {
          reject({
            statusCode: res.statusCode,
            message: `HTTP ${res.statusCode}`,
            body: res.data,
          });
        }
      },
      fail: (err) => {
        reject({
          statusCode: 0,
          message: (err && err.errMsg) || '网络错误',
        });
      },
    });
  });
};

module.exports = request;
```

- [ ] **Step 2: 手动验证(WeChat dev tools)**

在 WeChat dev tools Console:

```js
const request = require('./utils/request');
// 测一发到公共 API,确认 Promise 链通
request({
  url: 'https://httpbin.org/get',
  method: 'GET',
  timeout: 5000,
}).then(d => console.log('OK:', d.url)).catch(e => console.error('FAIL:', e.message));
```

预期:控制台输出 `OK: https://httpbin.org/get`。

(`wx` 是 WeChat 全局对象,Node 直接 require 会报 `wx is not defined`,所以这步只能在 WeChat dev tools 跑。)

- [ ] **Step 3: 删临时文件**

(本任务无临时文件,跳过此步。)

- [ ] **Step 4: Commit(checkpoint,等用户触发)**

- [ ] **Step 5: Commit(checkpoint,等用户触发)**

Commit message: `feat(utils): add request wrapper for HTTP calls`

---

### Task 3: 改写 `services/aiService.js`

**Files:**
- Modify: `services/aiService.js`(已恢复旧版,本期重写)

- [ ] **Step 1: 重写整个文件**

完整替换 `services/aiService.js` 内容如下:

```js
// services/aiService.js
// LLM 服务 —— 调用 MiniMax 真实 API,prompt 基于旧版打磨过的版本
// 不做 mock 兜底,任何错误 throw,由调用方决定 UX

const request = require('../utils/request');
const { LLM_API_KEY, LLM_API_BASE_URL, LLM_MODEL } = require('../config.local');
const { generateId } = require('../utils/storage');

// 构建地图生成 prompt
// pois: POI 数据数组
// gridCount: 格子数量
// config: 地图配置(initialGold / lapRewardGold / allowRepeatCheckin)
// 返回: 完整 prompt 字符串
function buildMapGenerationPrompt(pois, gridCount, config) {
  const poiList = pois
    .map((p, i) => `${i + 1}. ${p.name} (${p.type}) - ${p.address}`)
    .join('\n');
  const initialGold = config.initialGold || 1000;
  const minGold = Math.round(initialGold * 0.1);  // 10%
  const maxGold = Math.round(initialGold * 0.2);  // 20%

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

// 生成地图的主函数
// pois: POI 数据数组(从高德 SDK 获取的真实地点)
// config: 地图配置 { gridCount, initialGold, lapRewardGold, allowRepeatCheckin }
// 返回: Promise,解析后得到地图数据对象
// 失败: 任何错误 throw,无 mock 兜底
async function generateMap(pois, config) {
  const gridCount = config.gridCount || 20;
  const prompt = buildMapGenerationPrompt(pois, gridCount, config);

  const data = await request({
    url: `${LLM_API_BASE_URL}/chat/completions`,
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${LLM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    data: {
      model: LLM_MODEL,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0.7,
    },
    timeout: 600000,  // 10 分钟,后续埋点优化
  });

  // response_format: json_object 兜底,LLM 不会夹带 markdown
  const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
  if (!content) {
    throw new Error('LLM 响应为空');
  }
  const mapData = JSON.parse(content);
  return validateAndFixMapData(mapData, pois);
}

// 验证并修复地图数据 —— 用 AMap POI 列表补缺失字段,加 ID/时间/version
// mapData: LLM 返回的地图数据
// pois: 真实 POI 列表(用于补缺失)
// 返回: 修复后的地图数据
function validateAndFixMapData(mapData, pois) {
  if (!mapData.grids || !Array.isArray(mapData.grids)) {
    mapData.grids = [];
  }

  const gridCount = mapData.grids.length || 20;

  for (let i = 0; i < gridCount; i++) {
    if (!mapData.grids[i]) {
      mapData.grids[i] = { index: i, type: 'poi', poi: null };
    } else {
      mapData.grids[i].index = i;
    }
  }

  mapData.id = mapData.id || generateId();
  mapData.createdAt = mapData.createdAt || new Date().toISOString();
  mapData.version = '1.0';

  const validPOIs = pois.filter((p) => p.location && p.location.lat && p.location.lng);
  mapData.grids.forEach((grid, idx) => {
    if (!grid.poi || !grid.poi.location) {
      const poi = validPOIs[idx % validPOIs.length];
      if (poi) {
        grid.poi = poi;
      }
    }
  });

  return mapData;
}

module.exports = {
  generateMap,
};
```

- [ ] **Step 2: 验证 prompt 函数(WeChat dev tools)**

prompt 函数是纯函数,但因为 `services/aiService.js` 顶部 require 了 `request` / `config.local` / `storage`,这些都依赖 `wx` 全局,所以**不能**直接 Node 跑,要在 WeChat dev tools 跑。

在 WeChat dev tools Console 粘贴 `buildMapGenerationPrompt` 整个函数体(从 Step 1 复制),然后:

```js
const pois = [
  { name: '测试POI-A', type: '餐饮', address: 'addr-A', location: { lat: 31.1, lng: 121.5 } },
  { name: '测试POI-B', type: '购物', address: 'addr-B', location: { lat: 31.2, lng: 121.6 } },
];
const prompt = buildMapGenerationPrompt(pois, 20, { initialGold: 1000, lapRewardGold: 500 });
console.log('金币范围:', prompt.match(/绝对值在 \d+~\d+/)[0]);
console.log('格子数:', prompt.match(/生成 \d+ 个格子/)[0]);
```

预期输出:
```
金币范围: 绝对值在 100~200
格子数: 生成 20 个格子
```

- [ ] **Step 3: 真实 LLM 端到端验证(手动)**

1. 打开 WeChat dev tools,运行项目
2. 进入 create 页面
3. 选一个真实位置(用 `USE_MOCK_LOCATION` 关闭后,会用真定位或搜索选点)
4. 走到 step 4,点"开始生成"
5. 观察:
   - 应该看到 `generating: true`,loading 动画
   - 几秒到几十秒后(取决于 LLM 响应),`generating: false`,显示生成的地图
   - LLM 失败时,弹 toast "生成地图失败: <msg>"

- [ ] **Step 4: 失败路径验证**

临时把 `config.local.js` 的 `LLM_API_KEY` 改成 `'invalid-key-xxx'`,再走一次生成。预期:抛错,UI 弹 toast。

验证完把 key 改回正确值。

- [ ] **Step 5: Commit(checkpoint,等用户触发)**

Commit message: `feat(ai): replace mock with real LLM call (MiniMax) + dynamic gold range`

提交文件:`services/aiService.js`,`utils/request.js`,`config.example.js`(本期调整的注释),`config.local.js` 仍然 gitignore 不提交。

---

### Task 4: 关 `USE_MOCK_SEARCH`(poiService)

**Files:**
- Modify: `services/poiService.js:123`(删 USE_MOCK_SEARCH 标志 + if 分支)

- [ ] **Step 1: 删除 mock flag 和分支**

在 `services/poiService.js`,找到这段:

```js
const USE_MOCK_SEARCH = true;
const MOCK_TIPS = [ ... 10 条 ... ];

const searchPoiByKeyword = (keyword, options = {}) => {
  if (!keyword || !keyword.trim()) {
    return Promise.resolve([]);
  }
  if (USE_MOCK_SEARCH) {
    return new Promise((resolve) => {
      setTimeout(() => resolve(MOCK_TIPS.map(transformTip)), 300);
    });
  }
  return new Promise((resolve, reject) => {
    const amapwx = new AMapWX({ key: AMAP_KEY });
    amapwx.getInputtips({ ... });
  });
};
```

替换为(整段精简):

```js
const searchPoiByKeyword = (keyword, options = {}) => {
  if (!keyword || !keyword.trim()) {
    return Promise.resolve([]);
  }
  return new Promise((resolve, reject) => {
    const amapwx = new AMapWX({ key: AMAP_KEY });
    amapwx.getInputtips({
      keywords: keyword.trim(),
      location: options.location || '',
      city: options.city || '',
      success: (res) => {
        const tips = (res && res.tips) || [];
        resolve(tips.map(transformTip));
      },
      fail: (err) => {
        console.error('Amap getInputtips failed:', err);
        reject(err);
      },
    });
  });
};
```

- [ ] **Step 2: 删除 MOCK_TIPS 常量**

把 `const USE_MOCK_SEARCH = true;` 和 `const MOCK_TIPS = [ ... ];` 两行整段删掉。

- [ ] **Step 3: 手动验证**

WeChat dev tools,进入 search 页面,输入"杨浦"(或任意关键词),点搜索。

预期:
- loading → 真实 inputtips 列表(包含杨浦区的真实 POI,不再只是 10 条 mock)
- 选一个点,回传 create 页面

- [ ] **Step 4: Commit(checkpoint,等用户触发)**

Commit message: `feat(poi): turn off USE_MOCK_SEARCH, use real AMap inputtips`

---

### Task 5: 关 `USE_MOCK_LOCATION`(create)

**Files:**
- Modify: `pages/create/create.js:39-52`

- [ ] **Step 1: 删 USE_MOCK_LOCATION 标志和 mock 分支**

`pages/create/create.js` 第 36-53 行:

```js
onLoad() {
  this.updateRangeSize();
  // 调试模式：使用模拟定位数据
  const USE_MOCK_LOCATION = true;

  if (USE_MOCK_LOCATION) {
    this.setData({
      location: {
        latitude: 39.9042,
        longitude: 116.4074,
        address: '北京市朝阳区建国路88号（模拟数据）'
      },
      gettingLocation: false
    });
  } else {
    this.getLocation();
  }
},
```

替换为:

```js
onLoad() {
  this.updateRangeSize();
  this.getLocation();
},
```

- [ ] **Step 2: 手动验证**

WeChat dev tools,进入 create 页面。

预期:
- 首次进入弹微信原生定位授权弹窗(若未授权过)
- 授权后,显示真实位置(可以对照微信"位置信息"看)
- 拒绝授权,显示"获取位置失败"toast(此时仍可走"搜索选点"备选路径)

- [ ] **Step 3: Commit(checkpoint,等用户触发)**

Commit message: `feat(create): turn off USE_MOCK_LOCATION, use real getLocation`

---

### Task 6: 删 `DEBUG_FORCE_EMPTY`(search)

**Files:**
- Modify: `pages/search/search.js:10, 56`

- [ ] **Step 1: 删常量 + 改 _runSearch**

`pages/search/search.js` 第 8-10 行:

```js
// 临时调试: 强制空结果,验证 empty-search 组件
// 看完效果改成 false 或删掉
const DEBUG_FORCE_EMPTY = true;
```

整段删掉。

第 53-62 行的 `_runSearch`:

```js
async _runSearch(query) {
  this.setData({ loading: true });
  try {
    const results = DEBUG_FORCE_EMPTY ? [] : await searchPoiByKeyword(query);
    this.setData({ results, hasSearched: true, loading: false });
  } catch (err) {
    this.setData({ results: [], hasSearched: true, loading: false });
    wx.showToast({ title: '搜索失败，请重试', icon: 'none' });
  }
},
```

替换为:

```js
async _runSearch(query) {
  this.setData({ loading: true });
  try {
    const results = await searchPoiByKeyword(query);
    this.setData({ results, hasSearched: true, loading: false });
  } catch (err) {
    this.setData({ results: [], hasSearched: true, loading: false });
    wx.showToast({ title: '搜索失败，请重试', icon: 'none' });
  }
},
```

- [ ] **Step 2: 手动验证**

WeChat dev tools,进入 search 页面,输入关键词,搜索。

预期:能搜出真实 POI(因为 Task 4 也同步生效),不再被强制空结果。

- [ ] **Step 3: Commit(checkpoint,等用户触发)**

可与 Task 5 合并:`feat(search,create): remove debug mock flags`

---

### Task 7: POI 预检(create 页面)

**Files:**
- Modify: `pages/create/create.js`(data + nextStep + 3 个 handler + startGenerateMap 改用缓存)
- Modify: `pages/create/create.wxml`(错误块从 step 1 挪到 step 2 + nav 按钮加 loading 状态)

> 关键设计:预检挪到 step 2 选完 range 之后才触发,用用户选的实际 range。原 step 1→2 用 default range 是浪费(选 1.5km 跟选 500m 拿到一样的预检结果)。

- [ ] **Step 1: data 加 poiLoading + insufficientPoiError 字段**

在 `pages/create/create.js` 的 `data` 块里加:

```js
poiLoading: false,           // step 2 POI 预检 loading(独立于 step 4 generating)
insufficientPoiError: null,  // { found, needed } 或 null
```

`_cachedPois` 不放进 data(放 data 会被序列化、影响性能、不需要响应式)。用 `this._cachedPois` 普通属性。

- [ ] **Step 2: 改 nextStep 为 async,加 POI 预检(step 2 → 3)**

把 `pages/create/create.js` 的 `nextStep` 替换为:

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
},
```

- [ ] **Step 3: 改 startGenerateMap 用缓存的 POIs**

`startGenerateMap` 里:

```js
const pois = await fetchPOIsForMap({...});
```

替换为:

```js
const pois = this._cachedPois;
```

(因为 nextStep 已经 fetch 过并存到 `_cachedPois`。)

- [ ] **Step 4: 加 3 个 handler**

在 `pages/create/create.js` 的方法块里,加 3 个方法:

```js
// POI 不足 - 重新定位:清空 location 和缓存,回到 step 1
onPoiErrorRelocate() {
  this.setData({
    insufficientPoiError: null,
    location: null,
    step: 1,
  });
  this._cachedPois = null;
},

// POI 不足 - 用现有数额:gridCount 降为 found,跳到 step 3(跳过预检)
onPoiErrorUseExisting() {
  const { found } = this.data.insufficientPoiError;
  this.setData({
    insufficientPoiError: null,
    gridCount: found,
    step: 3,
  });
},

// POI 不足 - 扩大搜索范围:升一档 range(假设共 3 档:500/1000/1500),
// 已是最大档则直接返回。重新触发 nextStep 走预检(留在 step 2)
onPoiErrorExpandRange() {
  if (this.data.selectedRange >= 2) return;  // 0/1/2,已最大
  this.setData({
    selectedRange: this.data.selectedRange + 1,
    insufficientPoiError: null,
  });
  this.updateRangeSize();
  this.nextStep();
},
```

- [ ] **Step 5: WXML 挪错误块 + nav 按钮加 loading 状态**

**5a. 从 step 1 区域删除旧错误块**(原 `<view class="poi-error">...</view>` 整块)。

**5b. 在 step 2 区域(range-description 之后)加新的错误块**:

```xml
<!-- POI 不足提示:仅当 insufficientPoiError 非空时显示 -->
<view wx:if="{{insufficientPoiError}}" class="poi-error">
  <text class="poi-error-text">
    搜索到 {{insufficientPoiError.found}} 个 POI,不够 {{insufficientPoiError.needed}} 个格子
  </text>
  <view class="poi-error-actions">
    <button class="poi-error-btn" bindtap="onPoiErrorRelocate">重新定位</button>
    <button class="poi-error-btn" bindtap="onPoiErrorUseExisting">用现有数额</button>
    <button class="poi-error-btn" bindtap="onPoiErrorExpandRange">扩大范围</button>
  </view>
</view>
```

**5c. 改 nav 按钮:加 `!poiLoading` 守卫 + loading 状态元素**

把:
```xml
<view class="nav-buttons" wx:if="{{step < 4}}">
  <view class="btn-back text-headline-sm" bindtap="prevStep" wx:if="{{step > 1 && !generating}}">返回</view>
  <view class="btn-next text-headline-sm" bindtap="nextStep" wx:if="{{step < 4 && !generating}}">
    <text>下一步</text>
    <text class="iconfont btn-next-icon icon-right"></text>
  </view>
</view>
```

改为:
```xml
<view class="nav-buttons" wx:if="{{step < 4}}">
  <view class="btn-back text-headline-sm" bindtap="prevStep" wx:if="{{step > 1 && !generating && !poiLoading}}">返回</view>
  <view class="btn-next text-headline-sm" bindtap="nextStep" wx:if="{{step < 4 && !generating && !poiLoading}}">
    <text>下一步</text>
    <text class="iconfont btn-next-icon icon-right"></text>
  </view>
  <view class="btn-next text-headline-sm btn-loading" wx:if="{{step < 4 && poiLoading}}">
    <text>加载中...</text>
  </view>
</view>
```

- [ ] **Step 6: WXSS 加样式**

在 `pages/create/create.wxss` 末尾加:

```css
.poi-error {
  margin-top: 24rpx;
  padding: 24rpx;
  background: #fff4e5;
  border-radius: 12rpx;
  border: 2rpx solid #ffd591;
}
.poi-error-text {
  display: block;
  font-size: 28rpx;
  color: #d46b08;
  margin-bottom: 16rpx;
}
.poi-error-actions {
  display: flex;
  gap: 16rpx;
}
.poi-error-btn {
  flex: 1;
  font-size: 26rpx;
  background: #fff;
  color: #d46b08;
  border: 2rpx solid #ffd591;
}
```

(具体颜色匹配项目主色,如有 design system 约束按约束调。)

- [ ] **Step 7: 手动验证(三种情况)**

**Case A: 充足** —— 选上海某地,range=1km,gridCount=20,大概率充足。预期:点"下一步"后看到"加载中..."(约 1-2s),自动进 step 3,无错误 UI。

**Case B: 不足** —— 选偏远地点,或手动把 gridCount 调到 50(临时改 UI 测试),预期:点"下一步"后看到"加载中...",然后在 step 2 区域显示 inline 错误 UI + 3 个按钮。

**Case C: 不足 → 扩大范围** —— 选偏远 + 1km,点"扩大范围"。预期:range 升一档,自动重新预检(再次显示"加载中...");若还不足,继续显示错误;若充足,直接进 step 3。

- [ ] **Step 8: Commit(checkpoint,等用户触发)**

Commit message: `feat(create): add POI pre-check with inline error UI`

---

### Task 8: 删 `services/mock.js`

**Files:**
- Delete: `services/mock.js`
- Verify: `services/aiService.js` 已经不 import 它(Task 3 已重写)

- [ ] **Step 1: 确认没人 import mock.js**

```bash
cd /Users/sunanchen/workspace/city-monapoly
grep -rn "require.*['\"].*mock['\"]" --include="*.js" --include="*.wxml" --include="*.json"
```

预期:无任何匹配(Task 3 已重写 aiService.js,删了 `require('./mock')`)。

- [ ] **Step 2: 删文件**

```bash
rm /Users/sunanchen/workspace/city-monapoly/services/mock.js
```

- [ ] **Step 3: 手动验证**

WeChat dev tools 重新编译项目,确认:
- 编译无错(无 "Cannot find module" 错误)
- 跑一遍"生成地图",正常工作

- [ ] **Step 4: Commit(checkpoint,等用户触发)**

Commit message: `chore(cleanup): delete unused services/mock.js`

---

## 自查清单(写 plan 后做)

- [x] **Spec 覆盖**: 全部 8 项 spec 要点都有对应任务
  - utils/request.js → Task 2
  - aiService.js 改写 → Task 3
  - config 字段 → Task 1
  - POI 预检 → Task 7
  - Mock 关闭(5 处)→ Task 4 / 5 / 6 / 8
- [x] **占位符扫描**: 已 grep 全部任务,无 TBD/TODO/FIXME
- [x] **类型/方法名一致**: `buildMapGenerationPrompt` / `validateAndFixMapData` / `generateMap` / `nextStep` / `startGenerateMap` / `onPoiErrorRelocate` / `onPoiErrorUseExisting` / `onPoiErrorExpandRange` / `insufficientPoiError` / `_cachedPois` 在引入处和引用处完全一致
- [x] **范围合适**: 单个 plan 内完成,不需要拆 sub-project

## 已知风险(给执行者)

1. **没有自动化测试**: 所有验证靠 WeChat dev tools 手动。**LLM 真实调用有成本和延迟**,需要用户在端到端验证前确认 `config.local.js` 的 key 是有效的。
2. **API key 泄露**: 用户提供的 key 在 chat 明文传输过。**执行者(用户)在实施后必须 rotate 这个 key**,更新 `config.local.js`。
3. **Timeout 600 秒过长**: 后续埋点优化。本期不优化。
4. **POI 预检的 inline UI 样式**: 我给的样式是占位,如有 design system 约束需调整(grep `app.wxss` 或现有按钮样式)。
