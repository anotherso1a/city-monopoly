// Sidebar 组件 — 通用侧边栏菜单, 页面通过 items 数组声明要显示的项
// Item ID 由组件内置字典维护, 页面只关心"显示哪几项"+"点了之后干什么"

const ITEM_CATALOG = {
  createMap:    { label: '开始探索',       icon: 'icon-compass',      danger: false },
  viewAllMaps:  { label: '查看所有地图',   icon: 'icon-home',         danger: false },
  viewTimeline: { label: '查看时间线',     icon: 'icon-book',         danger: false },
  editMap:      { label: '编辑地图',       icon: 'icon-edit-square',  danger: false },
  shareMap:     { label: '分享地图',       icon: 'icon-share',        danger: false },
  loadLocalMap: { label: '载入本地地图',   icon: 'icon-sync',         danger: false },
  settle:       { label: '结算游戏',       icon: 'icon-trophy',       danger: false },
  exit:         { label: '退出游戏',       icon: 'icon-logout',       danger: true  },
};

Component({
  options: {
    // 让 app.wxss 全局工具类 (iconfont / sketch-border-sm / ink-divider-sm) 透进来
    styleIsolation: 'apply-shared',
  },
  properties: {
    visible:  { type: Boolean, value: false },
    items:    { type: Array,   value: [] },
    avatar:   { type: String,  value: '' },
    nickname: { type: String,  value: '' },
    level:    { type: String,  value: '0 经验' },  // 累计探索经验,由调用方从 storage 注入
  },
  data: {
    renderedItems: [],
  },
  observers: {
    'items': function (items) {
      this._computeRendered(items);
    },
  },
  lifetimes: {
    attached() {
      this._computeRendered(this.data.items);
    },
  },
  methods: {
    _computeRendered(items) {
      const out = [];
      let dividerInserted = false;
      for (const id of items || []) {
        const meta = ITEM_CATALOG[id];
        if (!meta) continue;
        if (meta.danger && !dividerInserted) {
          out.push({ divider: true, key: '__divider__' });
          dividerInserted = true;
        }
        out.push({ id, label: meta.label, icon: meta.icon, danger: meta.danger, key: id });
      }
      this.setData({ renderedItems: out });
    },

    onOverlayTap() {
      this.triggerEvent('close');
    },

    onNoop() {},

    onItemTap(e) {
      const { id } = e.currentTarget.dataset;
      this.triggerEvent('itemtap', { id });
    },

    onAvatarTap() {
      // 头部整块可点 -> 触发编辑弹窗
      this.triggerEvent('editProfile');
    },
  },
});
