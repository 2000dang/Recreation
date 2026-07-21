/* ==========================================================================
 * [环晓科技] 外部资源统一加载层 (Huánxiǎo Resource Loader)
 * 资源路径规范: cdn.jsdelivr.net/gh/<USER>/<REPO>@<BRANCH>/dist/<VERSION>/<FILE>
 *
 * 能力覆盖:
 *   - loadImage(key)        图片: 缓存 -> 网络 -> fallback 三级回退
 *   - loadData(key)         数据(JSON): 缓存 -> 网络 -> 默认对象
 *   - injectIframe(url,el)  机制A: 注入自适应高度 iframe (配合外部 HTML 资源)
 *   - renderImageInto(id,k) 供正则脚本内联 <script> 调用, 把占位替换为 <img>
 *   - renderDataInto(id,k)  供正则脚本内联 <script> 调用, 把占位替换为 <pre>
 *   - preload([keys])       批量预热
 *
 * 本地测试: 把 HX_CDN_BASE 改成本地服务器地址, 或运行后调用 HX.setBase('http://localhost:8080/dist/V20260721')
 * ========================================================================== */
(function (global) {
  'use strict';

  /* ===== 0. 可配置 CDN 基址 (发布前替换为你的 GitHub 仓库) ===== */
  // 例: 'https://cdn.jsdelivr.net/gh/MyUser/huanxiao-resources@main/dist/V20260721'
  let HX_CDN_BASE = 'https://cdn.jsdelivr.net/gh/2000dang/Recreation@main/dist/V20260721';

  const CACHE_PREFIX = 'hx_res_';
  const DEFAULT_TIMEOUT = 8000;

  /* ===== 1. 资源清单 (rel = 相对 CDN_BASE 的路径) ===== */
  const MANIFEST = {
    // —— 图片类（女角色立绘，取自 character_book 主要女性角色） ——
    '张雪': { type: 'image', rel: 'img/张雪.png', fallback: FALLBACK_SVG('张雪') },
    '杨玉兰': { type: 'image', rel: 'img/杨玉兰.png', fallback: FALLBACK_SVG('杨玉兰') },
    '娄琛雨': { type: 'image', rel: 'img/娄琛雨.png', fallback: FALLBACK_SVG('娄琛雨') },
    '秦燕霞': { type: 'image', rel: 'img/秦燕霞.png', fallback: FALLBACK_SVG('秦燕霞') },
    '卫璎': { type: 'image', rel: 'img/卫璎.png', fallback: FALLBACK_SVG('卫璎') },
    '陈丹娜': { type: 'image', rel: 'img/陈丹娜.png', fallback: FALLBACK_SVG('陈丹娜') },
    '孟雅雯': { type: 'image', rel: 'img/孟雅雯.png', fallback: FALLBACK_SVG('孟雅雯') },
    '赵加莹': { type: 'image', rel: 'img/赵加莹.png', fallback: FALLBACK_SVG('赵加莹') },
    '萧茹': { type: 'image', rel: 'img/萧茹.png', fallback: FALLBACK_SVG('萧茹') },
    '姜舞': { type: 'image', rel: 'img/姜舞.png', fallback: FALLBACK_SVG('姜舞') },
    '晴晴': { type: 'image', rel: 'img/晴晴.png', fallback: FALLBACK_SVG('晴晴') },
    '妫妡娆': { type: 'image', rel: 'img/妫妡娆.png', fallback: FALLBACK_SVG('妫妡娆') },
    '姚嫣': { type: 'image', rel: 'img/姚嫣.png', fallback: FALLBACK_SVG('姚嫣') },
    '许双苓': { type: 'image', rel: 'img/许双苓.png', fallback: FALLBACK_SVG('许双苓') },
    '袁梦晗': { type: 'image', rel: 'img/袁梦晗.png', fallback: FALLBACK_SVG('袁梦晗') },
    '梁思珏': { type: 'image', rel: 'img/梁思珏.png', fallback: FALLBACK_SVG('梁思珏') },
    '冯艳': { type: 'image', rel: 'img/冯艳.png', fallback: FALLBACK_SVG('冯艳') },
    '刘子娴': { type: 'image', rel: 'img/刘子娴.png', fallback: FALLBACK_SVG('刘子娴') },
    // —— 页面类 (机制A) ——
    '封面': { type: 'html', rel: '封面.html' },
    '开局': { type: 'html', rel: '开局.html' },
  };

  function FALLBACK_SVG(label) {
    const t = (label || '?').slice(0, 2);
    return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(
      '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120">' +
      '<rect width="100%" height="100%" rx="12" fill="#16263a"/>' +
      '<text x="50%" y="54%" font-size="34" fill="#5fd0ff" text-anchor="middle" dominant-baseline="middle" font-family="sans-serif">' + t + '</text>' +
      '</svg>');
  }

  /* ===== 2. 工具 ===== */
  function log() { try { console.log('%c[资源加载器]', 'color:#7fd1ff', ...arguments); } catch (e) {} }
  function warn() { try { console.warn('%c[资源加载器]', 'color:#ffb454', ...arguments); } catch (e) {} }
  function resolve(rel) { return HX_CDN_BASE + '/' + String(rel).replace(/^\/+/, ''); }
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function withTimeout(promise, ms) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('timeout')), ms);
      Promise.resolve(promise).then(
        v => { clearTimeout(timer); resolve(v); },
        e => { clearTimeout(timer); reject(e); }
      );
    });
  }

  /* ===== 3. 图片加载 (缓存 -> 网络 -> fallback) ===== */
  async function loadImage(key, opts) {
    opts = opts || {};
    const item = MANIFEST[key] || { type: 'image', rel: opts.rel, fallback: opts.fallback };
    const cacheKey = CACHE_PREFIX + 'img_' + key;
    const cached = lsGet(cacheKey);
    if (cached) { log('图片命中缓存:', key); return cached; }
    try {
      const url = item.rel ? resolve(item.rel) : opts.url;
      const resp = await withTimeout(fetch(url, { cache: 'no-cache' }), DEFAULT_TIMEOUT);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const blob = await resp.blob();
      const dataUrl = await blobToDataURL(blob);     // 存 dataURL 可跨会话复用
      lsSet(cacheKey, dataUrl);
      log('图片加载成功:', key);
      return dataUrl;
    } catch (e) {
      warn('图片加载失败, 回退占位:', key, e.message);
      return item.fallback || opts.fallback || FALLBACK_SVG(key);
    }
  }

  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = reject;
      r.readAsDataURL(blob);
    });
  }

  /* ===== 4. 数据加载 (JSON) ===== */
  async function loadData(key, opts) {
    opts = opts || {};
    const item = MANIFEST[key] || { type: 'data', rel: opts.rel, fallback: opts.fallback || '{}' };
    const cacheKey = CACHE_PREFIX + 'data_' + key;
    const cached = lsGet(cacheKey);
    if (cached) { try { return JSON.parse(cached); } catch (_) {} }
    try {
      const url = item.rel ? resolve(item.rel) : opts.url;
      const resp = await withTimeout(fetch(url, { cache: 'no-cache' }), DEFAULT_TIMEOUT);
      if (!resp.ok) throw new Error('HTTP ' + resp.status);
      const json = await resp.json();
      lsSet(cacheKey, JSON.stringify(json));
      log('数据加载成功:', key);
      return json;
    } catch (e) {
      warn('数据加载失败, 回退默认:', key, e.message);
      const fb = item.fallback || opts.fallback || '{}';
      try { return typeof fb === 'string' ? JSON.parse(fb) : fb; } catch (_) { return {}; }
    }
  }

  /* ===== 5. 机制A: iframe 注入 + 自适应高度 ===== */
  function injectIframe(url, container, opts) {
    opts = opts || {};
    container = typeof container === 'string' ? document.querySelector(container) : container;
    if (!container) { warn('injectIframe: 容器不存在'); return null; }
    container.innerHTML = '';
    const frame = document.createElement('iframe');
    frame.src = url + (url.indexOf('?') >= 0 ? '&' : '?') + 'v=' + (opts.v || Date.now());
    frame.setAttribute('scrolling', 'no');
    frame.style.cssText = 'width:100%;border:0;min-height:200px;background:transparent;';
    container.appendChild(frame);
    function onMsg(ev) {
      try {
        const d = ev.data || {};
        if (d && d.type === 'embed-resize' && d.height) frame.style.height = d.height + 'px';
      } catch (_) {}
    }
    window.addEventListener('message', onMsg);
    log('iframe 注入:', url);
    return frame;
  }

  /* ===== 6. 便捷渲染 (供正则 replaceString 内联 <script> 调用) ===== */
  async function renderImageInto(holderId, key) {
    const holder = document.getElementById(holderId);
    if (!holder) return;
    holder.textContent = '资源加载中…';
    const src = await loadImage(key);
    if (!src) { holder.textContent = '【图片缺失】' + key; return; }
    const img = document.createElement('img');
    img.src = src; img.alt = key;
    img.style.cssText = 'max-width:100%;border-radius:10px;display:block;margin:0 auto;';
    holder.innerHTML = ''; holder.appendChild(img);
  }

  async function renderDataInto(holderId, key) {
    const holder = document.getElementById(holderId);
    if (!holder) return;
    holder.textContent = '数据加载中…';
    const data = await loadData(key);
    const pre = document.createElement('pre');
    pre.textContent = JSON.stringify(data, null, 2);
    pre.style.cssText = 'white-space:pre-wrap;font-size:12px;line-height:1.5;margin:0;';
    holder.innerHTML = ''; holder.appendChild(pre);
  }

  /* ===== 7. 批量预热 ===== */
  async function preload(keys) {
    const list = keys || Object.keys(MANIFEST);
    return Promise.all(list.map(async k => {
      const t = MANIFEST[k] && MANIFEST[k].type;
      if (t === 'image') return loadImage(k);
      if (t === 'data') return loadData(k);
      return null;
    }));
  }

  /* ===== 8. 导出 / 本地测试切换基址 ===== */
  global.HX = Object.assign(global.HX || {}, {
    CDN_BASE: HX_CDN_BASE,
    MANIFEST,
    loadImage, loadData, injectIframe, preload, renderImageInto, renderDataInto,
    resolve,
    setBase(url) { HX_CDN_BASE = url; this.CDN_BASE = url; log('CDN_BASE 已切换为', url); },
  });

  log('资源加载层已挂载 | CDN_BASE =', HX_CDN_BASE, '| 清单条目 =', Object.keys(MANIFEST).length);
})(typeof window !== 'undefined' ? window : this);
