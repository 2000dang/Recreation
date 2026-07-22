/* 催眠助理·环晓科技 — 悬浮球状态栏 v2.3.8
 *
 * 关键修复(对齐 轮回 终端 v2 模式):
 *   1. 锁定 window.parent.document 作为操作主窗口 → position:fixed/z-index 在主视口生效
 *   2. 所有 DOM 操作走 doc=parent.document → render() 能找到 ball/panel 节点
 *   3. prompt() 走 GS_PARENT.prompt() → 避免 about:srcdoc 内不可见
 *   4. mount() 强制重建 → 避免重新导入后旧 ball 残留导致 click handler 仍是旧脚本
 *   5. init() 无条件主动挂球(不依赖 getContext),syncMount 用 window.parent.SillyTavern.getContext
 *      真实判断本卡/其他角色/无聊天;fab.onclick 动态查 panel 避免闭包陈旧引用
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
  var mountedFlag = false;
  var closeListenerAdded = false;
  var lastDataHash = null;

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
      '#hx-stat-ball .hx-sub{padding-left:14px;}'
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
      vEl.onclick = (function (cur, p) { return function () { setVar(p, !cur); }; })(v, path);
    } else if (typeof v === 'object' && v !== null) {
      vEl.textContent = '{…}';
      vEl.title = '对象不可编辑';
      vEl.style.cursor = 'default';
    } else {
      vEl.textContent = (v === '' || v === null || v === undefined) ? '—' : String(v);
      vEl.title = '双击编辑';
      vEl.ondblclick = (function (kName, p) {
        return function () {
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
    var tabs = doc.createElement('div');
    tabs.className = 'hx-tabs';
    CATEGORIES.forEach(function (c) {
      var t = doc.createElement('div');
      t.className = 'hx-tab' + (c.key === curTab ? ' active' : '');
      t.textContent = c.icon + c.key;
      t.onclick = (function (k) { return function () { curTab = k; render(); }; })(c.key);
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

  // ===== 4. 挂载/卸载 =====
  function unmount() {
    try {
      var existing = doc.getElementById('hx-stat-ball');
      if (existing) existing.remove();
      var style = doc.getElementById('hx-stat-style');
      if (style) style.remove();
      mountedFlag = false;
      log('已卸载');
    } catch (e) { try { GS_PARENT.console.warn('[HX-Float] 卸载异常', e && e.message); } catch (e2) {} }
  }

  function closeOnOutside(e) {
    try {
      var root = doc.getElementById('hx-stat-ball');
      if (!root) return;
      if (!root.contains(e.target)) {
        var panel = root.querySelector('.hx-panel');
        if (panel) panel.classList.remove('open');
      }
    } catch (e) {}
  }

  function mount() {
    if (!doc.body) { log('body 未就绪'); return false; }
    // 强制重建：避免重新导入后旧球残留导致 click handler 仍是旧脚本
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
        // 动态查找 panel,避免闭包引用陈旧 DOM(重新挂载/旧球残留场景)
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
      mountedFlag = true;
      // 点击其他位置关闭 (只挂一次)
      if (!closeListenerAdded) {
        doc.addEventListener('click', closeOnOutside);
        closeListenerAdded = true;
      }
      log('悬浮球已挂载');
      render();
      return true;
    } catch (e) {
      try { GS_PARENT.console.error('[HX-Float] 挂载失败', e); } catch (e2) {}
      return false;
    }
  }

  function debouncedRender() {
    if (GS_PARENT.__hx_render_t__) clearTimeout(GS_PARENT.__hx_render_t__);
    GS_PARENT.__hx_render_t__ = setTimeout(render, 120);
  }

  // ===== 5. 生命周期：跟随本卡聊天 =====
  // 关键:getContext 挂在 window.parent.SillyTavern.getContext (非 window.parent.getContext)
  function getContextSafe() {
    try {
      var win = GS_PARENT || window;
      var api = (win.SillyTavern && typeof win.SillyTavern.getContext === 'function') ? win.SillyTavern.getContext
               : (typeof win.getContext === 'function' ? win.getContext : null);
      if (!api) return null;
      return api();
    } catch (e) { return null; }
  }

  // 主窗口是否处于"聊天 UI 可见"状态(关闭聊天的兜底判定)
  function isChatUiVisible() {
    try {
      var ta = doc.querySelector('#send_textarea, textarea.input-message');
      if (ta && ta.offsetParent !== null) return true;
      var chat = doc.querySelector('#chat');
      if (chat && chat.offsetParent !== null && chat.querySelector('.mes')) return true;
      return false;
    } catch (e) { return true; }  // 不确定时保守返回可见,避免误卸
  }

  function syncMount() {
    try {
      var ballExists = !!doc.getElementById('hx-stat-ball');
      var ctx = getContextSafe();
      if (!ctx) {
        log('syncMount: 上下文取不到,保持现状 ball=' + ballExists);
        return;  // 不确定 → 保持现状
      }
      var chatId = ctx.chatId;
      var characterId = ctx.characterId;
      // 关键:用 chatId 判本卡,不用 ctx.name(主窗口下 ctx.name 经常是空字符串)
      log('syncMount: ball=' + ballExists + ', chatId=' + chatId + ', characterId=' + characterId);
      if (!chatId || !characterId) {
        // 无活跃聊天 → 关闭聊天/回列表(用聊天UI可见性兜底,避免动画瞬态误卸)
        if (ballExists && !isChatUiVisible()) {
          log('syncMount: 无活跃聊天且聊天UI不可见,卸载球');
          unmount();
        } else if (ballExists) {
          log('syncMount: 无活跃聊天但UI可见,暂留');
        }
        return;
      }
      // 用 chatId 包含本卡关键字判断本卡 — chatId 形如 "催眠助理·环晓科技 - 2026-07-22@..."
      if (chatId.indexOf(CARD_KEY) === -1 && chatId.indexOf('环晓') === -1) {
        // 明确是其他角色 → 立即卸
        if (ballExists) { log('syncMount: 其他角色(chatId=' + chatId + '),卸载球'); unmount(); }
        return;
      }
      // 本卡聊天活跃
      if (!ballExists) {
        log('syncMount: 本卡聊天(chatId=' + chatId + ')活跃,挂载球');
        setTimeout(mount, 50);
      } else {
        // 球已存在 → hash 校验
        var data = getStatData();
        if (data) {
          try {
            var hash = JSON.stringify(data);
            if (hash !== lastDataHash) { lastDataHash = hash; render(); }
          } catch (e) {}
        }
      }
    } catch (e) {
      try { GS_PARENT.console.warn('[HX-Float] syncMount 异常', e && e.message); } catch (e2) {}
    }
  }

  // 「关闭聊天」信号独立处理 — Tavern 此时 CHAT_CHANGED payload 为 undefined;
  // 但 QR2 模块传给 onChatChanged 的 payload 实际经常是字符串/undefined 不一,
  // 统一走 syncMount 让 syncMount 内部基于 getContext 真实数据判断
  function onChatChanged(payload) {
    try { log('CHAT_CHANGED 触发, payload type=' + (typeof payload) + ', val=' + (typeof payload === 'string' ? payload.slice(0, 60) : String(payload).slice(0, 60))); } catch (e) {}
    setTimeout(syncMount, 80);
  }

  // ===== 6. 启动 =====
  function bindMvuListener() {
    try {
      var mvu = getMvu();
      if (!mvu || !mvu.events || !mvu.events.VARIABLE_UPDATE_ENDED) return false;
      var evt = mvu.events.VARIABLE_UPDATE_ENDED;
      // 优先 GS_PARENT.eventOn(注入到主窗口作用域),次之当前 iframe 内
      var eon = (typeof GS_PARENT.eventOn === 'function') ? GS_PARENT.eventOn : (typeof eventOn === 'function' ? eventOn : null);
      if (eon) { eon(evt, debouncedRender); return true; }
    } catch (e) {}
    return false;
  }

  function init() {
    log('init 开始');
    try {
      log('init: GS_PARENT===window.parent=' + (GS_PARENT === window.parent) + ', body=' + !!doc.body + ', ST.getContext=' + (typeof (GS_PARENT.SillyTavern && GS_PARENT.SillyTavern.getContext)));
    } catch (e) {}
    if (!doc.body) {
      var wait = setInterval(function () {
        if (doc.body) { clearInterval(wait); init(); }
      }, 200);
      setTimeout(function () { clearTimeout(wait); clearInterval(wait); }, 10000);
      return;
    }
    // 无条件主动挂球,不依赖 getContext 判断(避免 init 时上下文未就绪导致静默不挂)
    if (!doc.getElementById('hx-stat-ball')) {
      log('init: 主动挂载球');
      setTimeout(mount, 50);
    } else {
      log('init: 球已存在,跳过初次挂载');
    }
    // 监听 MVU 变量更新(初次可能未就绪,2s 后再补一次)
    if (bindMvuListener()) log('已监听 VARIABLE_UPDATE_ENDED');
    else log('MVU 事件对象未就绪,2s 后重试');
    setTimeout(function () {
      if (bindMvuListener()) log('补监听 VARIABLE_UPDATE_ENDED 成功');
    }, 2000);
    // 监听酒馆事件
    try {
      if (typeof tavern_events !== 'undefined') {
        var eon = (typeof GS_PARENT.eventOn === 'function') ? GS_PARENT.eventOn : (typeof eventOn === 'function' ? eventOn : null);
        if (eon) {
          if (tavern_events.CHAT_CHANGED) eon(tavern_events.CHAT_CHANGED, onChatChanged);
          if (tavern_events.MESSAGE_DELETED) eon(tavern_events.MESSAGE_DELETED, debouncedRender);
          if (tavern_events.MESSAGE_SWIPED) eon(tavern_events.MESSAGE_SWIPED, debouncedRender);
        }
      }
    } catch (e) {}
    // 兜底轮询(3s):负责"切到其他角色"卸球 + 数据变更刷新
    setInterval(syncMount, 3000);
    try { GS_PARENT.__悬浮球状态栏_loaded__ = true; } catch (e) { window.__悬浮球状态栏_loaded__ = true; }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
