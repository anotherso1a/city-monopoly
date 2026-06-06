/**
 * localStorage polyfill for Node 22+.
 *
 * Node 22+ 自带一个空的 globalThis.localStorage(没 getItem/setItem 方法),
 * miniprogram-ci 2.x 的 debug.js 假定 localStorage 有这些方法 —— 直接调就挂。
 *
 * miniprogram-ci 上传时 fork 子进程做编译,父进程的 global 改动不会传给子进程,
 * 所以要走 NODE_OPTIONS=--require=<本文件> 让子进程也自动 require。
 *
 * 不写盘,关进程就没,够用。
 */
'use strict';

const _store = new Map();
globalThis.localStorage = {
  getItem: (k) => (_store.has(k) ? _store.get(k) : null),
  setItem: (k, v) => _store.set(k, String(v)),
  removeItem: (k) => _store.delete(k),
  clear: () => _store.clear(),
  key: (i) => Array.from(_store.keys())[i] || null,
  get length() { return _store.size; },
};
