/* 催眠助理·环晓科技 — 悬浮球状态栏 v2.4.0
 *
 * 机制对齐轮回「主神终端」(常驻模式):
 *   - 球常驻 document.body, 关闭聊天/切角色均不卸载(与轮回一致)
 *   - CHAT_CHANGED / MESSAGE_DELETED / MESSAGE_SWIPED → debouncedRefresh(仅刷新数据)
 *   - IIFE 启动即 preClean(): 移除旧球 + 解绑旧事件 + 清 guardTimer(防多版本共存)
 *   - guardTimer 每 15s 检查球在不在 DOM, 不在则重建(防被误删, 非卸球)
 *   - getContext 仅取 chatId 用于渲染标题, 不判挂/卸
 *
 * v2.3.x 的"关闭聊天自动卸球"是偏离轮回的需求, 已整体删除(该需求导致
 * eventOn 吃事件 / isChatUiVisible 误判 / 旧闭包点不动 等全部 bug)
 *
 * 保留本卡特性: 🌙 图标 / 6 分类 Tab / 🔓 破解模式开关(环晓科技员工系统 ROOT)
 */
(function () {
  'use strict';

  // ===== 1. 锁定主窗口 =====
  var GS_PARENT = (function () {
    try { if (window.parent && window.parent !== window && window.parent.document && window.parent.document.body) return window.parent; } catch (e) {}
    try { if (window.top && window.top !== window && window.top.document && window.top.document.body) return window.top; } catch (e) {}
    return window;
  })();
  var doc = GS_PARENT.document;
  var _ = GS_PARENT._ || window._;

  var CARD_KEY = '催眠助理'; // 角色名匹配关键字
  var CATEGORIES = [
    { key: '主角状态', icon: '🧑' },
    { key: '环境与系统', icon: '🏢' },
    { key: '助理管理', icon: '👥' },
    { key: '催眠系统', icon: '🌀' },
    { key: '隐藏场景', icon: '🔞' },
    { key: '剧情进度', icon: '📜' }
  ];
  var curTab = '主角状态';
  var lastDataHash = null;
  var chatTitle = '';

  function log() {
    var args = ['[HX-Float]'].concat(Array.prototype.slice.call(arguments));
    try { (GS_PARENT.console || console).log.apply(GS_PARENT.console || console, args); } catch (e) {}
  }

  // ===== 2. MVU 读写 =====
  function getMvu() {
    try { if (GS_PARENT.Mvu && typeof GS_PARENT.Mvu.getMvuData === 'function') return GS_PARENT.Mvu; } catch (e) {}
    return null;
  }
  function getStatData() {
    var mvu = getMvu(); if (!mvu) return null;
    try {
      var data = mvu.getMvuData({ type: 'message', message_id: 'latest' });
      if (data && data.stat_data) return data.stat_data;
      if (data && typeof data === 'object') return data;
    } catch (e) {}
    return null;
  }
  function setVar(path, value) {
    var mvu = getMvu();
    if (!mvu || !_ || typeof _.set !== 'function') return;
    try {
      var data = mvu.getMvuData({ type: 'message', message_id: 'latest' }) || {};
      if (!data.stat_data) data.stat_data = {};
      _.set(data.stat_data, path, value);
      var cloned = (_.cloneDeep) ? _.cloneDeep(data) : JSON.parse(JSON.stringify(data));
      mvu.replaceMvuData(cloned, { type: 'message', message_id: 'latest' });
      try { mvu.replaceMvuData(cloned, { type: 'chat' }); } catch (e) {}
    } catch (e) { try { GS_PARENT.console.warn('[HX-Float] 写回失败', e && e.message); } catch (e2) {} }
  }

  // ===== 3. 样式与渲染 =====
  function ensureStyle() {
    if (doc.getElementById('hx-stat-style')) return;
    var st = doc.createElement('style');
    st.id = 'hx-stat-style';
    st.textContent = [
      '#hx-stat-ball{position:fixed;top:70px;right:16px;z-index:2147483647;font-family:-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;pointer-events:none;}',
      '#hx-stat-ball *{pointer-events:auto;}',
      '#hx-stat-ball .hx-fab{width:36px;height:36px;border-radius:50%;background:rgba(245,245,255,.95);color:#5b3fa0;display:flex;align-items:center;justify-content:center;font-size:18px;cursor:pointer;box-shadow:0 0 0 2px rgba(155,109,255,.45),0 4px 16px rgba(0,0,0,.45);backdrop-filter:blur(4px);user-select:none;transition:transform .15s ease,box-shadow .15s ease;}',
      '#hx-stat-ball .hx-fab:hover{transform:scale(1.08);box-shadow:0 0 0 3px rgba(155,109,255,.65),0 6px 22px rgba(0,0,0,.55);}',
      '#hx-stat-ball .hx-panel{position:absolute;top:44px;right:0;width:310px;max-height:78vh;overflow:auto;background:rgba(22,18,36,.97);border:1px solid rgba(155,109,255,.45);border-radius:14px;color:#e8e3f5;font-size:13px;box-shadow:0 14px 40px rgba(0,0,0,.55);display:none;}',
      '#hx-stat-ball .hx-panel.open{display:block;}',
      '#hx-stat-ball .hx-tabs{display:flex;flex-wrap:wrap;gap:5px;padding:10px;border-bottom:1px solid rgba(155,109,255,.25);}',
      '#hx-stat-ball .hx-tab{padding:4px 8px;border-radius:8px;background:rgba(155,109,255,.14);cursor:pointer;white-space:nowrap;font-size:12px;}',
      '#hx-stat-ball .hx-tab.active{background:rgba(155,109,255,.42);}',
      '#hx-stat-ball .hx-row{display:flex;justify-content:space-between;gap:8px;padding:3px 11px;line-height:1.55;}',
      '#hx-stat-ball .hx-k{color:#a99fd0;}',
      '#hx-stat-ball .hx-v{color:#fff;text-align:right;cursor:pointer;max-width:58%;word-break:break-all;}',
      '#hx-stat-ball .hx-sub{padding-left:14px;}',
      '#hx-stat-ball .hx-toolbar{display:flex;align-items:center;justify-content:space-between;padding:7px 11px;border-bottom:1px solid rgba(155,109,255,.25);font-size:12px;color:#a99fd0;background:rgba(155,109,255,.06);}',
      '#hx-stat-ball .hx-hack-label{font-weight:600;letter-spacing:0.5px;}',
      '#hx-stat-ball .hx-hack-switch{position:relative;width:36px;height:18px;border-radius:9px;background:rgba(155,109,255,.18);cursor:pointer;transition:background .15s;flex-shrink:0;}',
      '#hx-stat-ball .hx-hack-switch.on{background:rgba(255,170,80,.6);}',
      '#hx-stat-ball .hx-hack-knob{position:absolute;top:2px;left:2px;width:14px;height:14px;border-radius:50%;background:#fff;transition:left .18s ease;box-shadow:0 1px 3px rgba(0,0,0,.3);}',
      '#hx-stat-ball .hx-hack-switch.on .hx-hack-knob{left:20px;}',
      '#hx-stat-ball .hx-hack-tip{padding:6px 11px;font-size:11px;color:#ffb84d;background:rgba(255,170,80,.10);border-bottom:1px solid rgba(255,170,80,.25);}'
    ].join('');
    doc.head.appendChild(st);
  }

  function renderCell(k, v, path) {
    var row = doc.createElement('div');
    row.className = 'hx-row';
    var kEl = doc.createElement('span');
    kEl.className = 'hx-k';
    kEl.textContent = k;
    var vEl = doc.createElement('span');
    vEl.className = 'hx-v';
    if (typeof v === 'boolean') {
      vEl.textContent = v ? '✓' : '✗';
      vEl.title = '单击切换';
      vEl.onclick = (function (cur, p) { return function (ev) { try { if (ev && ev.stopPropagation) ev.stopPropagation(); if (ev && ev.preventDefault) ev.preventDefault(); } catch (e) {} setVar(p, !cur); }; })(v, path);
    } else if (typeof v === 'object' && v !== null) {
      vEl.textContent = '{…}';
      if (getHackMode()) {
        // 破解模式:对象也允许编辑
        vEl.style.cursor = 'pointer';
        vEl.title = '破解模式:双击以 JSON 文本编辑该对象';
        vEl.ondblclick = (function (kName, p, cur) {
          return function (ev) { try { if (ev && ev.stopPropagation) ev.stopPropagation(); if (ev && ev.preventDefault) ev.preventDefault(); } catch (e) {}
            var def = JSON.stringify(cur, null, 2);
            var nv = null;
            try { nv = GS_PARENT.prompt('⚡ 破解模式 - 修改 ' + kName + ' (JSON 格式):', def); } catch (e) { nv = prompt('修改 ' + kName + ' (JSON 格式):', def); }
            if (nv === null) return;
            try { var parsed = JSON.parse(nv); setVar(p, parsed); }
            catch (err) { try { GS_PARENT.alert('JSON 解析失败:' + err.message); } catch (e) { alert('JSON 解析失败:' + err.message); } }
          };
        })(k, path, v);
      } else {
        vEl.title = '对象不可编辑(开启 🔓 破解模式后可编辑)';
        vEl.style.cursor = 'default';
      }
    } else {
      vEl.textContent = (v === '' || v === null || v === undefined) ? '—' : String(v);
      vEl.title = '双击编辑';
      vEl.ondblclick = (function (kName, p) {
        return function (ev) { try { if (ev && ev.stopPropagation) ev.stopPropagation(); if (ev && ev.preventDefault) ev.preventDefault(); } catch (e) {}
          var nv = null;
          try { nv = GS_PARENT.prompt('修改 ' + kName + '：', vEl.textContent === '—' ? '' : vEl.textContent); } catch (e) { nv = prompt('修改 ' + kName + '：', vEl.textContent === '—' ? '' : vEl.textContent); }
          if (nv === null) return;
          var num = Number(nv);
          var val = (nv !== '' && !isNaN(num) && nv.trim() !== '') ? num : nv;
          setVar(p, val);
        };
      })(k, path);
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
          var sub = doc.createElement('div');
          sub.className = 'hx-sub';
          var head = doc.createElement('div');
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
    var root = doc.getElementById('hx-stat-ball');
    if (!root) return;
    var panel = root.querySelector('.hx-panel');
    if (!panel) return;
    panel.innerHTML = '';
    var hackOn = getHackMode();
    // ===== 破解模式开关 =====
    var tb = doc.createElement('div');
    tb.className = 'hx-toolbar';
    tb.innerHTML =
      '<span class="hx-hack-label">🔓 破解模式</span>' +
      '<span class="hx-hack-switch' + (hackOn ? ' on' : '') + '" data-on="' + (hackOn ? '1' : '0') + '"><span class="hx-hack-knob"></span></span>';
    panel.appendChild(tb);
    (function () {
      var sw = tb.querySelector('.hx-hack-switch');
      if (!sw) return;
      sw.onclick = function (ev) {
        try { if (ev && ev.stopPropagation) ev.stopPropagation(); if (ev && ev.preventDefault) ev.preventDefault(); } catch (e) {}
        var on = sw.getAttribute('data-on') === '1';
        setHackMode(!on);
        log('破解模式 → ' + (!on ? 'ON' : 'OFF'));
        render();
      };
    })();
    // hack 模式提示条
    if (hackOn) {
      var tip = doc.createElement('div');
      tip.className = 'hx-hack-tip';
      tip.textContent = '⚡ 破解模式已开启：已获得环晓科技员工系统最高权限(ROOT)，并解锁全部面板字段(对象可双击编辑)';
      panel.appendChild(tip);
    }
    // ===== 6 个分类 Tab =====
    var tabs = doc.createElement('div');
    tabs.className = 'hx-tabs';
    CATEGORIES.forEach(function (c) {
      var t = doc.createElement('div');
      t.className = 'hx-tab' + (c.key === curTab ? ' active' : '');
      t.textContent = c.icon + c.key;
      t.onclick = (function (k) { return function (ev) { try { if (ev && ev.stopPropagation) ev.stopPropagation(); } catch (e) {} curTab = k; render(); }; })(c.key);
      tabs.appendChild(t);
    });
    panel.appendChild(tabs);

    var data = getStatData();
    if (!data) {
      var empty = doc.createElement('div');
      empty.className = 'hx-row';
      empty.innerHTML = '<span class="hx-k">变量未初始化</span>';
      panel.appendChild(empty);
      return;
    }
    var sub = data[curTab];
    if (!sub || typeof sub !== 'object') {
      var none = doc.createElement('div');
      none.className = 'hx-row';
      none.innerHTML = '<span class="hx-k">' + curTab + '：空</span>';
      panel.appendChild(none);
      return;
    }
    renderObject(panel, sub, curTab, 0);
  }

  // ===== 4. 挂载(常驻, 不卸载) =====
  function mount() {
    if (!doc.body) { log('body 未就绪'); return false; }
    // 强制重建: 避免旧版本脚本闭包残留导致点不动(对齐轮回 samPreClean 思路)
    var old = doc.getElementById('hx-stat-ball');
    if (old) { try { old.remove(); } catch (e) {} }
    try {
      ensureStyle();
      var root = doc.createElement('div');
      root.id = 'hx-stat-ball';
      var fab = doc.createElement('div');
      fab.className = 'hx-fab';
      fab.textContent = '🌙';
      fab.title = '环晓科技状态栏（点击展开/收起）';
      var panel = doc.createElement('div');
      panel.className = 'hx-panel';

      fab.onclick = function (ev) {
        try { if (ev && ev.stopPropagation) ev.stopPropagation(); } catch (e) {}
        // 动态查找 panel, 避免闭包引用陈旧 DOM
        var root = fab.parentNode;
        if (!root) return;
        var p = root.querySelector('.hx-panel');
        if (!p) return;
        if (p.classList.contains('open')) {
          p.classList.remove('open');
        } else {
          render();
          p.classList.add('open');
        }
      };

      root.appendChild(fab);
      root.appendChild(panel);
      doc.body.appendChild(root);
      log('悬浮球已挂载(常驻)');
      render();
      return true;
    } catch (e) {
      try { GS_PARENT.console.error('[HX-Float] 挂载失败', e); } catch (e2) {}
      return false;
    }
  }

  // ===== 5. 生命周期(对齐轮回: 常驻 + preClean + guardTimer) =====
  function preClean() {
    // IIFE 启动即清理旧实例, 防止多版本脚本共存导致事件/定时器累积(对齐轮回 samPreClean)
    try {
      var old = doc.getElementById('hx-stat-ball');
      if (old) old.remove();
      var style = doc.getElementById('hx-stat-style');
      if (style) style.remove();
      if (GS_PARENT.__hx_guard_timer__) { clearInterval(GS_PARENT.__hx_guard_timer__); GS_PARENT.__hx_guard_timer__ = null; }
    } catch (e) {}
  }

  // 防抖刷新: 500ms 内多次事件只触发一次 render(纯读不写, 无死循环)
  // 对齐轮回 debouncedRefresh, CHAT_CHANGED/MESSAGE_DELETED/MESSAGE_SWIPED/MVU 更新都走它
  function debouncedRefresh() {
    if (GS_PARENT.__hx_refresh_t__) clearTimeout(GS_PARENT.__hx_refresh_t__);
    GS_PARENT.__hx_refresh_t__ = setTimeout(function () {
      GS_PARENT.__hx_refresh_t__ = null;
      render();
    }, 500);
  }

  // 仅取 chatId 用于渲染标题, 不判挂/卸
  function syncTitle() {
    try {
      var win = GS_PARENT || window;
      var api = (win.SillyTavern && typeof win.SillyTavern.getContext === 'function') ? win.SillyTavern.getContext
               : (typeof win.getContext === 'function' ? win.getContext : null);
      if (!api) return;
      var ctx = api();
      if (ctx && ctx.chatId) chatTitle = ctx.chatId;
    } catch (e) {}
  }

  // guardTimer: 每 15s 检查球在不在 DOM, 不在则重建(防被误删, 非卸球, 对齐轮回)
  function startGuard() {
    if (GS_PARENT.__hx_guard_timer__) clearInterval(GS_PARENT.__hx_guard_timer__);
    GS_PARENT.__hx_guard_timer__ = setInterval(function () {
      if (!doc.getElementById('hx-stat-ball')) {
        log('guard: 球丢失, 重建');
        mount();
      }
    }, 15000);
  }

  // 「破解模式」状态 — 开启时允许强行修改只读字段/对象/数值
  // 状态写入 MVU 的 stat_data.__hx_hack_mode(持久化跨对话) + localStorage(快速读取)
  function getHackMode() {
    try {
      var ls = GS_PARENT.localStorage && GS_PARENT.localStorage.getItem('hx_hack_mode');
      if (ls === '1') return true;
      var d = getStatData();
      if (d && d.__hx_hack_mode === true) return true;
    } catch (e) {}
    return false;
  }
  function setHackMode(on) {
    try { if (GS_PARENT.localStorage) GS_PARENT.localStorage.setItem('hx_hack_mode', on ? '1' : '0'); } catch (e) {}
    try { setVar('__hx_hack_mode', on ? true : false); } catch (e) {}
  }

  function init() {
    log('init 开始(常驻模式, 对齐轮回)');
    if (!doc.body) {
      var wait = setInterval(function () {
        if (doc.body) { clearInterval(wait); init(); }
      }, 200);
      setTimeout(function () { clearTimeout(wait); clearInterval(wait); }, 10000);
      return;
    }
    // 常驻挂载(不判挂/卸)
    mount();
    syncTitle();
    // 事件绑定(GS_PARENT.__hx_bound__ 防多版本重复注册)
    if (!GS_PARENT.__hx_bound__) {
      GS_PARENT.__hx_bound__ = true;
      var eon = (typeof GS_PARENT.eventOn === 'function') ? GS_PARENT.eventOn : (typeof eventOn === 'function' ? eventOn : null);
      try {
        if (typeof tavern_events !== 'undefined') {
          if (tavern_events.CHAT_CHANGED) eon(tavern_events.CHAT_CHANGED, debouncedRefresh);
          if (tavern_events.MESSAGE_DELETED) eon(tavern_events.MESSAGE_DELETED, debouncedRefresh);
          if (tavern_events.MESSAGE_SWIPED) eon(tavern_events.MESSAGE_SWIPED, debouncedRefresh);
          log('已监听 CHAT_CHANGED/MESSAGE_DELETED/MESSAGE_SWIPED → debouncedRefresh');
        }
      } catch (e) {}
      // MVU 变量更新结束 → 刷新
      try {
        var mvu = getMvu();
        if (mvu && mvu.events && mvu.events.VARIABLE_UPDATE_ENDED && eon) {
          eon(mvu.events.VARIABLE_UPDATE_ENDED, debouncedRefresh);
          log('已监听 VARIABLE_UPDATE_ENDED → debouncedRefresh');
        }
      } catch (e) {}
    } else {
      log('事件已绑定过, 跳过');
    }
    // guardTimer 兜底(防球被误删, 非卸球)
    startGuard();
    try { GS_PARENT.__悬浮球状态栏_loaded__ = true; } catch (e) { window.__悬浮球状态栏_loaded__ = true; }
    log('init 完成(常驻)');
  }

  // ===== 启动 =====
  preClean();  // IIFE 顶部预清理旧实例
  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
