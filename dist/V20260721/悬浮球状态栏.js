/* 催眠助理·环晓科技 — 悬浮球状态栏
 * 严格遵循《轮回战场》悬浮球技术模式重建：
 *   - 通过 Mvu.getMvuData 读取 stat_data
 *   - 监听 Mvu.events.VARIABLE_UPDATE_ENDED 自动刷新
 *   - 内联编辑(双击文本/数值, 单击布尔)经 _.set 深写 + Mvu.replaceMvuData 写回
 * 分类(key)与 MVU Schema 顶层节点严格一致：主角状态/环境与系统/助理管理/催眠系统/隐藏场景/剧情进度
 */
(function () {
  'use strict';

  var CATEGORIES = [
    { key: '主角状态', icon: '🧑' },
    { key: '环境与系统', icon: '🏢' },
    { key: '助理管理', icon: '👥' },
    { key: '催眠系统', icon: '🌀' },
    { key: '隐藏场景', icon: '🔞' },
    { key: '剧情进度', icon: '📜' }
  ];

  var curTab = '主角状态';

  function getMvuGlobal() {
    try {
      if (typeof window !== 'undefined' && window.Mvu && typeof window.Mvu.getMvuData === 'function') return window;
      if (typeof window !== 'undefined' && window.parent && window.parent.Mvu && typeof window.parent.Mvu.getMvuData === 'function') return window.parent;
    } catch (e) {}
    return null;
  }

  function getStatData() {
    var win = getMvuGlobal();
    if (!win) return null;
    try {
      var data = win.Mvu.getMvuData({ type: 'message', message_id: 'latest' });
      if (data && data.stat_data) return data.stat_data;
      if (data && typeof data === 'object') return data;
    } catch (e) {}
    return null;
  }

  function setVar(path, value) {
    var win = getMvuGlobal();
    if (!win || !win._ || typeof win._.set !== 'function' || !win.Mvu || typeof win.Mvu.replaceMvuData !== 'function') return;
    try {
      var data = win.Mvu.getMvuData({ type: 'message', message_id: 'latest' }) || {};
      if (!data.stat_data) data.stat_data = {};
      win._.set(data.stat_data, path, value);
      var cloned = (win._ && win._.cloneDeep) ? win._.cloneDeep(data) : JSON.parse(JSON.stringify(data));
      win.Mvu.replaceMvuData(cloned, { type: 'message', message_id: 'latest' });
      try { win.Mvu.replaceMvuData(cloned, { type: 'chat' }); } catch (e) {}
    } catch (e) { console.warn('[悬浮球] 写回失败', e && e.message); }
  }

  function ensureStyle() {
    if (document.getElementById('hx-stat-style')) return;
    var st = document.createElement('style');
    st.id = 'hx-stat-style';
    st.textContent = [
      '#hx-stat-ball{position:fixed;top:64px;right:12px;z-index:99990;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;}',
      '#hx-stat-ball .hx-fab{width:42px;height:42px;border-radius:50%;background:rgba(155,109,255,.92);color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.35);user-select:none;}',
      '#hx-stat-ball .hx-panel{position:absolute;top:50px;right:0;width:300px;max-height:78vh;overflow:auto;background:rgba(18,16,28,.96);border:1px solid rgba(155,109,255,.4);border-radius:12px;color:#e8e3f5;font-size:13px;box-shadow:0 10px 30px rgba(0,0,0,.5);display:none;}',
      '#hx-stat-ball .hx-panel.open{display:block;}',
      '#hx-stat-ball .hx-tabs{display:flex;flex-wrap:wrap;gap:4px;padding:8px;border-bottom:1px solid rgba(155,109,255,.25);}',
      '#hx-stat-ball .hx-tab{padding:3px 7px;border-radius:6px;background:rgba(155,109,255,.12);cursor:pointer;white-space:nowrap;}',
      '#hx-stat-ball .hx-tab.active{background:rgba(155,109,255,.4);}',
      '#hx-stat-ball .hx-row{display:flex;justify-content:space-between;gap:8px;padding:3px 10px;line-height:1.5;}',
      '#hx-stat-ball .hx-k{color:#a99fd0;}',
      '#hx-stat-ball .hx-v{color:#fff;text-align:right;cursor:pointer;}',
      '#hx-stat-ball .hx-sub{padding-left:14px;}',
      '#hx-stat-ball .hx-edit{background:#2a2440;border:1px solid #6d5bb0;color:#fff;border-radius:4px;width:120px;font-size:12px;}'
    ].join('');
    document.head.appendChild(st);
  }

  function renderCell(k, v, path) {
    var row = document.createElement('div');
    row.className = 'hx-row';
    var kEl = document.createElement('span');
    kEl.className = 'hx-k';
    kEl.textContent = k;
    var vEl = document.createElement('span');
    vEl.className = 'hx-v';
    if (typeof v === 'boolean') {
      vEl.textContent = v ? '✓' : '✗';
      vEl.title = '单击切换';
      vEl.onclick = function () { setVar(path, !v); };
    } else if (typeof v === 'object' && v !== null) {
      vEl.textContent = '{…}';
      vEl.title = '展开';
      vEl.onclick = function () { setVar(path, v); };
    } else {
      vEl.textContent = (v === '' || v === null || v === undefined) ? '—' : String(v);
      vEl.title = '双击编辑';
      vEl.ondblclick = function () {
        var nv = prompt('修改 ' + k + '：', vEl.textContent === '—' ? '' : vEl.textContent);
        if (nv === null) return;
        var num = Number(nv);
        var val = (nv !== '' && !isNaN(num) && nv.trim() !== '') ? num : nv;
        setVar(path, val);
      };
    }
    row.appendChild(kEl); row.appendChild(vEl);
    return row;
  }

  function renderObject(container, obj, basePath, depth) {
    if (!obj || typeof obj !== 'object') return;
    var isArr = Array.isArray(obj);
    Object.keys(obj).forEach(function (key) {
      var val = obj[key];
      var path = basePath ? basePath + '.' + key : key;
      if (val && typeof val === 'object' && !(val instanceof Date)) {
        if (depth < 2) {
          var sub = document.createElement('div');
          sub.className = 'hx-sub';
          var head = document.createElement('div');
          head.className = 'hx-row';
          head.innerHTML = '<span class="hx-k">' + (isArr ? '[' + key + ']' : key) + '</span>';
          sub.appendChild(head);
          renderObject(sub, val, path, depth + 1);
          container.appendChild(sub);
        } else {
          container.appendChild(renderCell(isArr ? '[' + key + ']' : key, val, path));
        }
      } else {
        container.appendChild(renderCell(isArr ? '[' + key + ']' : key, val, path));
      }
    });
  }

  function render() {
    var root = document.getElementById('hx-stat-ball');
    if (!root) return;
    var panel = root.querySelector('.hx-panel');
    if (!panel) return;
    panel.innerHTML = '';
    var tabs = document.createElement('div');
    tabs.className = 'hx-tabs';
    CATEGORIES.forEach(function (c) {
      var t = document.createElement('div');
      t.className = 'hx-tab' + (c.key === curTab ? ' active' : '');
      t.textContent = c.icon + c.key;
      t.onclick = function () { curTab = c.key; render(); };
      tabs.appendChild(t);
    });
    panel.appendChild(tabs);

    var data = getStatData();
    if (!data) {
      var empty = document.createElement('div');
      empty.className = 'hx-row';
      empty.innerHTML = '<span class="hx-k">变量未初始化</span>';
      panel.appendChild(empty);
      return;
    }
    var sub = data[curTab];
    if (!sub || typeof sub !== 'object') {
      var none = document.createElement('div');
      none.className = 'hx-row';
      none.innerHTML = '<span class="hx-k">' + curTab + '：空</span>';
      panel.appendChild(none);
      return;
    }
    renderObject(panel, sub, curTab, 0);
  }

  function mount() {
    if (document.getElementById('hx-stat-ball')) { render(); return; }
    ensureStyle();
    var root = document.createElement('div');
    root.id = 'hx-stat-ball';
    var fab = document.createElement('div');
    fab.className = 'hx-fab';
    fab.textContent = '📊';
    fab.title = '环晓科技状态栏';
    var panel = document.createElement('div');
    panel.className = 'hx-panel';
    fab.onclick = function () { panel.classList.toggle('open'); if (panel.classList.contains('open')) render(); };
    root.appendChild(fab);
    root.appendChild(panel);
    document.body.appendChild(root);
    render();
  }

  function debouncedRender() {
    if (window.__hx_render_t__) clearTimeout(window.__hx_render_t__);
    window.__hx_render_t__ = setTimeout(render, 120);
  }

  function init() {
    mount();
    var win = getMvuGlobal();
    if (win && win.Mvu && win.Mvu.events && win.Mvu.events.VARIABLE_UPDATE_ENDED) {
      var evt = win.Mvu.events.VARIABLE_UPDATE_ENDED;
      if (typeof eventOn === 'function') eventOn(evt, debouncedRender);
    }
    // 兜底：DOM 变动也尝试刷新
    if (typeof MutationObserver !== 'undefined') {
      var mo = new MutationObserver(debouncedRender);
      mo.observe(document.body, { childList: true, subtree: true });
    }
    window.__hx_float_loaded__ = true;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
