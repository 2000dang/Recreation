/* 催眠助理·环晓科技 — 悬浮球状态栏 v3.0.0
 * 
 * 基于轮回卡「主神终端」源码重构，保留其核心交互框架：
 *   - preClean (IIFE 启动清理旧实例, 防多版本并存)
 *   - 球+面板挂主窗口 body + 拖拽系统 (setupDragEngines)
 *   - 面板开关 (togglePanel) + 防抖刷新 (debouncedRefresh)
 *   - 编辑模式 (editDisplayHtml / stageEdit / writeBackMvu)
 *   - 守卫定时器 (guardTimer 15s 重建)
 *   - eventOn 绑定 CHAT_CHANGED / MESSAGE_DELETED / MESSAGE_SWIPED
 * 
 * 内容替换为催眠卡：
 *   - 6 分类 Tab (主角状态 / 环境与系统 / 助理管理 / 催眠系统 / 隐藏场景 / 剧情进度)
 *   - 破解模式开关 (环晓科技员工系统 ROOT 权限)
 *   - 暗紫配色 (环晓科技视觉)
 */
(function () {
  'use strict';
  try { console.log('%c[环晓·终端] ⚡ 悬浮球状态栏 v3.0 接入中...', 'color:#b39dff;font-weight:bold'); } catch (e) {}

  // ===== 1. 锁定主窗口 (来自轮回) =====
  var GS_PARENT = (function () {
    try { if (window.parent && window.parent !== window && window.parent.document && window.parent.document.body) return window.parent; } catch (e) {}
    try { if (window.top && window.top !== window && window.top.document && window.top.document.body) return window.top; } catch (e) {}
    return window;
  })();
  var $ = (GS_PARENT.jQuery || GS_PARENT.$ || window.jQuery || window.$);
  var document = GS_PARENT.document;
  var _ = (GS_PARENT._ || window._);

  // ===== 2. 缓存配置 =====
  var HX_CONFIG = {
    pos:    'hx_ball_pos_v3',
    open:   'hx_panel_open_v3',
    tab:    'hx_tab_v3',
    edit:   'hx_edit_v3',
    hack:   'hx_hack_mode',
    theme:  'hx_theme_v3'
  };

  // ===== 3. 分类定义 =====
  var CATEGORIES = [
    { key: '主角状态', icon: '🧑' },
    { key: '环境与系统', icon: '🏢' },
    { key: '助理管理', icon: '👥' },
    { key: '催眠系统', icon: '🌀' },
    { key: '隐藏场景', icon: '🔞' },
    { key: '剧情进度', icon: '📜' }
  ];

  // ===== 4. 受保护(只读)字段 =====
  function isReadonlyPath(path) { return false; }  // 破解模式下允许改所有字段

  // ===== 5. 预清理旧实例 (来自轮回) =====
  function hxPreClean() {
    try {
      if ($) {
        $('#hx-stat-ball, #hx-stat-panel, #hx-stat-modal, #hx-stat-style').remove();
        $(document).off('.hx');
      }
      if (window.__hx_guard_timer__) clearInterval(window.__hx_guard_timer__);
      if (window.__hx_refresh_timer__) clearTimeout(window.__hx_refresh_timer__);
    } catch (e) { console.warn('[环晓·终端] 预清理失败:', e && e.message); }
  }
  hxPreClean();

  // ===== 6. MVU 读写 (来自轮回) =====
  function getMvuGlobal() {
    try { if (typeof GS_PARENT.Mvu !== 'undefined') return GS_PARENT; } catch (e) {}
    try { if (typeof window.Mvu !== 'undefined') return window; } catch (e) {}
    return null;
  }
  function getStatData() {
    var win = getMvuGlobal();
    if (win && win.Mvu && typeof win.Mvu.getMvuData === 'function') {
      try {
        var r = win.Mvu.getMvuData({ type: 'message', message_id: 'latest' });
        if (r && r.stat_data) return r.stat_data;
        if (r && typeof r === 'object') return r;
      } catch (e) {}
    }
    return null;
  }
  function writeBackMvu(mutator) {
    try {
      var win = getMvuGlobal();
      if (!win || !win.Mvu || typeof win.Mvu.getMvuData !== 'function' || typeof win.Mvu.replaceMvuData !== 'function') {
        console.warn('[环晓·终端] MVU写回API不可用');
        return false;
      }
      var mvuData = win.Mvu.getMvuData({ type: 'message', message_id: 'latest' });
      if (!mvuData || !mvuData.stat_data) { console.warn('[环晓·终端] 无可写数据'); return false; }
      var before = (_ && _.cloneDeep) ? _.cloneDeep(mvuData) : JSON.parse(JSON.stringify(mvuData));
      var cloned = (_ && _.cloneDeep) ? _.cloneDeep(mvuData) : JSON.parse(JSON.stringify(mvuData));
      if (typeof mutator === 'function') mutator(cloned.stat_data);
      win.Mvu.replaceMvuData(cloned, { type: 'message', message_id: 'latest' });
      try { win.Mvu.replaceMvuData(cloned, { type: 'chat' }); } catch (e2) {}
      try {
        var evtName = win.Mvu.events && win.Mvu.events.VARIABLE_UPDATE_ENDED;
        if (evtName && typeof win.eventEmit === 'function') win.eventEmit(evtName, cloned, before);
        else if (evtName && typeof eventEmit === 'function') eventEmit(evtName, cloned, before);
      } catch (e3) {}
      return true;
    } catch (e) { console.error('[环晓·终端] 写回MVU失败:', e); return false; }
  }

  // ===== 7. 工具函数 (来自轮回) =====
  function esc(s) { if (s === null || s === undefined) return ''; return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function safeNum(v, def) { var n = Number(v); return Number.isFinite(n) ? n : (def || 0); }
  function safeStr(v, def) { return (v === null || v === undefined) ? (def || '') : String(v); }
  function isMobile() { return (GS_PARENT.innerWidth || 1024) <= 768; }
  function getCurrentTab() { try { var t = localStorage.getItem(HX_CONFIG.tab); if (t) return t; } catch(e){} return '主角状态'; }
  function setCurrentTab(t) { try { localStorage.setItem(HX_CONFIG.tab, t); } catch(e){} }
  function isEditMode() { try { return localStorage.getItem(HX_CONFIG.edit) === '1'; } catch(e){ return false; } }
  function setEditMode(on) { try { localStorage.setItem(HX_CONFIG.edit, on ? '1' : '0'); } catch(e){} pendingEdits = {}; }
  function getHackMode() { try { return localStorage.getItem(HX_CONFIG.hack) === '1'; } catch(e){} return false; }
  function setHackMode(on) {
    var next = !!on;
    try { localStorage.setItem(HX_CONFIG.hack, next ? '1' : '0'); } catch(e){}
    try { writeBackMvu(function(sd) {
      if (!sd) return;
      var p = sd.主角状态 || {};
      if (next) {
        sd.__hx_backup_contrib = (typeof p.贡献点 === 'number' && p.贡献点 >= 0) ? p.贡献点 : 5;
        sd.__hx_backup_hypnosis_level = p.催眠权限等级 || 1;
        sd.__hx_backup_mental = (typeof p.精神状态 === 'number') ? p.精神状态 : 100;
        p.贡献点 = -1;
        p.催眠权限等级 = 10;
        p.精神状态 = 100;
        p.破解模式 = true;
      } else {
        p.贡献点 = 50;
        p.催眠权限等级 = (typeof sd.__hx_backup_hypnosis_level === 'number') ? sd.__hx_backup_hypnosis_level : 1;
        p.精神状态 = (typeof sd.__hx_backup_mental === 'number') ? sd.__hx_backup_mental : 100;
        p.破解模式 = false;
      }
      sd.__hx_hack_mode = next;
    }); } catch(e){}
  }
  function getTheme() { try { return localStorage.getItem(HX_CONFIG.theme) || 'dark'; } catch(e){} return 'dark'; }
  function setTheme(t) { try { localStorage.setItem(HX_CONFIG.theme, t); } catch(e){} }
  var pendingEdits = {};
  function stageEdit(path, val, type) { if (!path) return; pendingEdits[path] = { val: val, type: type || 'text' }; }

  // ===== 8. 编辑模式 HTML 生成器 (来自轮回) =====
  function editDisplayInner(val) {
    var vs = (val === null || val === undefined) ? '' : (Array.isArray(val) ? val.join(',') : String(val));
    return (vs === '' ? '<span class="hx-ed-ph">空</span>' : esc(vs));
  }
  function editDisplayHtml(path, val, type, optsStr) {
    var optsAttr = optsStr ? ' data-opts="'+esc(optsStr)+'"' : '';
    return '<span class="hx-ed-wrap" data-path="'+esc(path)+'" data-type="'+esc(type||'text')+'"'+optsAttr+'>'
      + '<span class="hx-ed-val">'+editDisplayInner(val)+'</span>'
      + '<span class="hx-ed-ico">✎</span>'
      + '</span>';
  }
  function editRealInputHtml(path, val, type) {
    var v = (val === null || val === undefined) ? '' : String(val);
    if (type === 'textarea') return '<textarea class="hx-edit-input" data-path="'+esc(path)+'" data-type="textarea" rows="2" style="width:100%;min-height:40px;resize:vertical;">'+esc(v)+'</textarea>';
    return '<input class="hx-edit-input" type="'+esc(type||'text')+'" data-path="'+esc(path)+'" data-type="'+esc(type||'text')+'" value="'+esc(v)+'" />';
  }
  function editRealSelectHtml(path, options, val) {
    var html = '<select class="hx-edit-input" data-path="'+esc(path)+'" data-type="select">';
    options.forEach(function(o) { html += '<option value="'+esc(o)+'"'+(String(o)===String(val)?' selected':'')+'>'+esc(o)+'</option>'; });
    html += '</select>'; return html;
  }

  // ===== 9. CSS 注入 =====
  function buildCSS() {
    return '\n'
+ '#hx-stat-ball { position: fixed; top: 70px; right: 16px; z-index: 999999; width: 36px; height: 36px;'
+ '  border-radius: 50%; background: linear-gradient(135deg, rgba(245,245,255,0.95), rgba(210,195,255,0.9));'
+ '  border: 1.5px solid rgba(155,109,255,0.5); box-shadow: 0 0 12px rgba(155,109,255,0.35), 0 4px 16px rgba(0,0,0,0.45);'
+ '  display: flex; align-items: center; justify-content: center; cursor: pointer; user-select: none;'
+ '  font-size: 18px; color: #5b3fa0; backdrop-filter: blur(4px);'
+ '  transition: transform 0.15s ease, box-shadow 0.15s ease; }'
+ '#hx-stat-ball:hover { transform: scale(1.08); box-shadow: 0 0 18px rgba(155,109,255,0.55), 0 6px 22px rgba(0,0,0,0.55); }'
+ '#hx-stat-ball .hx-core { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; }'
+ '#hx-stat-panel { display: none; flex-direction: column; position: fixed; top: 110px; right: 16px;'
+ '  width: 330px; max-height: 78vh; overflow: hidden auto; background: rgba(18,14,30,0.97);'
+ '  border: 1px solid rgba(155,109,255,0.35); border-radius: 14px; color: #e8e3f5; font-size: 13px;'
+ '  box-shadow: 0 14px 40px rgba(0,0,0,0.55); z-index: 999998; font-family: -apple-system,"PingFang SC","Microsoft YaHei",sans-serif; }'
+ '#hx-stat-panel.open { display: flex; }'
+ '#hx-stat-modal { display: none; position: fixed; top:0; left:0; width:100vw; height:100vh; z-index:1000000;'
+ '  background: rgba(0,0,0,0.65); align-items: center; justify-content: center; }'
+ '#hx-stat-modal.open { display: flex; }'
+ '.hx-modal-box { background: rgba(22,18,36,0.98); border: 1px solid rgba(155,109,255,0.4); border-radius: 14px;'
+ '  max-width: 600px; width: 90vw; max-height: 80vh; overflow: auto; box-shadow: 0 14px 40px rgba(0,0,0,0.6); }'
+ '.hx-modal-head { display:flex; justify-content:space-between; padding:12px 16px; border-bottom:1px solid rgba(155,109,255,0.25);'
+ '  font-weight:bold; color:#b39dff; }'
+ '.hx-modal-close { cursor:pointer; font-size:16px; }'
+ '.hx-modal-body { padding: 12px 16px; }'
+ '.hx-topbar { display:flex; justify-content:space-between; align-items:center; padding:9px 12px;'
+ '  border-bottom:1px solid rgba(155,109,255,0.25); background:rgba(155,109,255,0.06); }'
+ '.hx-topbar .hx-tl-info { font-size:12px; color: #9b8fc0; }'
+ '.hx-topbar .hx-tl-title { font-size:13px; color: #d5c8f5; font-weight:600; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; max-width:200px; }'
+ '.hx-topbar .hx-tl-actions { display:flex; gap:6px; flex-shrink:0; }'
+ '.hx-icon-btn { width:28px; height:28px; border-radius:6px; background:rgba(155,109,255,0.12); border:none; color:#b39dff;'
+ '  font-size:14px; display:flex; align-items:center; justify-content:center; cursor:pointer; transition:background 0.15s; }'
+ '.hx-icon-btn:hover { background:rgba(155,109,255,0.28); }'
+ '.hx-icon-btn.edit-on { background:rgba(255,170,80,0.25); color:#ffb84d; }'
+ '.hx-hack-toggle { display:flex; align-items:center; gap:4px; font-size:11px; color:#ffb84d; cursor:pointer; padding:2px 6px;'
+ '  border-radius:6px; background:rgba(255,170,80,0.08); transition:background 0.15s; }'
+ '.hx-hack-toggle:hover { background:rgba(255,170,80,0.18); }'
+ '.hx-hack-toggle.on { background:rgba(255,170,80,0.2); }'
+ '.hx-hack-badge { font-size:11px; font-weight:bold; }'
+ '.hx-hack-tip { padding:6px 12px; font-size:11px; color:#ffb84d; background:rgba(255,170,80,0.10);'
+ '  border-bottom:1px solid rgba(255,170,80,0.25); }'
+ '.hx-tab-rail { display:flex; flex-wrap:wrap; gap:5px; padding:10px; border-bottom:1px solid rgba(155,109,255,0.2);'
+ '  background:rgba(155,109,255,0.04); }'
+ '.hx-tab-btn { padding:5px 9px; border-radius:8px; background:rgba(155,109,255,0.10); cursor:pointer; white-space:nowrap;'
+ '  font-size:12px; color:#a99fd0; border:none; transition:background 0.15s,color 0.15s; }'
+ '.hx-tab-btn.active { background:rgba(155,109,255,0.35); color:#fff; font-weight:600; }'
+ '.hx-tab-btn:hover:not(.active) { background:rgba(155,109,255,0.20); }'
+ '.hx-tab-content { flex:1; overflow-y:auto; padding:6px 0; }'
+ '.hx-empty { text-align:center; padding:30px 20px; color:#9b8fc0; font-size:13px; }'
+ '.hx-row { display:flex; justify-content:space-between; align-items:center; gap:8px; padding:5px 12px; min-height:30px; }'
+ '.hx-row:hover { background:rgba(155,109,255,0.06); }'
+ '.hx-k { color:#9b8fc0; font-size:12px; white-space:nowrap; }'
+ '.hx-v { color:#f0ecff; font-size:13px; text-align:right; word-break:break-all; flex:1; }'
+ '.hx-sub { padding-left:14px; }'
+ '.hx-sub .hx-k { color:#7d709f; }'
+ '.hx-edit-badge { padding:8px 12px; font-size:11px; color:#ffb84d; background:rgba(255,170,80,0.08);'
+ '  border-bottom:1px solid rgba(255,170,80,0.2); }'
+ '.hx-save-btn { display:block; width:calc(100% - 24px); margin:8px 12px; padding:8px; background:rgba(155,109,255,0.3);'
+ '  border:1px solid rgba(155,109,255,0.5); border-radius:8px; color:#fff; font-size:13px; cursor:pointer; }'
+ '.hx-save-btn:hover { background:rgba(155,109,255,0.45); }'
+ '.hx-ed-wrap { display:inline-flex; align-items:center; gap:4px; cursor:pointer; }'
+ '.hx-ed-ph { color:#7d709f; font-style:italic; }'
+ '.hx-ed-ico { font-size:10px; opacity:0.4; }'
+ '.hx-ed-wrap:hover .hx-ed-ico { opacity:1; }'
+ '.hx-edit-input { background:rgba(0,0,0,0.4); border:1px solid rgba(155,109,255,0.5); color:#fff; padding:2px 6px;'
+ '  border-radius:4px; font-size:13px; width:100%; box-sizing:border-box; }'
+ '@keyframes hxPulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }'
+ '\n/* 白天主题 */'
+ '#hx-stat-panel.light { background: rgba(245,242,255,0.97); color: #2d1f4a; border-color: rgba(120,80,200,0.35); }'
+ '#hx-stat-panel.light .hx-k { color: #6b5b8a; }'
+ '#hx-stat-panel.light .hx-v { color: #1a1035; }'
+ '#hx-stat-panel.light .hx-row:hover { background: rgba(120,80,200,0.06); }'
+ '#hx-stat-panel.light .hx-topbar { background: rgba(120,80,200,0.06); border-bottom-color: rgba(120,80,200,0.2); }'
+ '#hx-stat-panel.light .hx-tl-title { color: #3d2070; }'
+ '#hx-stat-panel.light .hx-tab-rail { background: rgba(120,80,200,0.03); border-bottom-color: rgba(120,80,200,0.15); }'
+ '#hx-stat-panel.light .hx-tab-btn { background: rgba(120,80,200,0.08); color: #6b5b8a; }'
+ '#hx-stat-panel.light .hx-tab-btn.active { background: rgba(120,80,200,0.3); color: #2d1f4a; }'
+ '#hx-stat-panel.light .hx-icon-btn { background: rgba(120,80,200,0.1); color: #6b5b8a; }'
+ '#hx-stat-panel.light .hx-hack-tip { background: rgba(255,170,80,0.08); }'
+ '#hx-stat-panel.light .hx-sub .hx-k { color: #8b7ba5; }'
+ '#hx-stat-panel.light .hx-empty { color: #8b7ba5; }'
+ '#hx-stat-panel.light .hx-modal-box { background: rgba(245,242,255,0.98); border-color: rgba(120,80,200,0.3); }';
  }

  function initHxCss() {
    var old = document.getElementById('hx-stat-style');
    if (old) old.remove();
    var styleEl = document.createElement('style');
    styleEl.id = 'hx-stat-style';
    styleEl.type = 'text/css';
    styleEl.innerHTML = buildCSS();
    document.head.appendChild(styleEl);
  }

  // ===== 10. 面板开关 (来自轮回) =====
  function togglePanel() {
    var $panel = $('#hx-stat-panel');
    var $ball = $('#hx-stat-ball');
    var isOpen = $panel.hasClass('open');
    if (isOpen) {
      $panel.removeClass('open').css('display', 'none');
      $ball.stop(true, true).fadeIn(160);
      try { localStorage.setItem(HX_CONFIG.open, '0'); } catch(e){}
    } else {
      if (isMobile()) { $panel.css({left:'',top:'',right:'',bottom:'',height:''}); }
      else {
        var r = $ball[0].getBoundingClientRect();
        var vw = GS_PARENT.innerWidth, vh = GS_PARENT.innerHeight;
        var nl = Math.max(20, Math.min(vw - 340, r.left > vw/2 ? r.left - 340 - 10 : r.left + 50));
        var nt = Math.max(20, Math.min(vh - 600, r.top));
        $panel.css({left:nl+'px', top:nt+'px', right:'auto', bottom:'auto'});
      }
      $panel.css('display', 'flex').addClass('open');
      $ball.stop(true, true).fadeOut(160);
      try { localStorage.setItem(HX_CONFIG.open, '1'); } catch(e){}
      renderAll();
    }
  }

  // ===== 11. 拖拽系统 (来自轮回, 仅球可拖) =====
  function setupDragEngine() {
    var $ball = $('#hx-stat-ball');
    var $panel = $('#hx-stat-panel');
    if (!$ball.length || !$panel.length) return;
    if (!$ball.data('hxDragBound')) {
      $ball.data('hxDragBound', '1');
      var sx1=0, sy1=0, ox1=0, oy1=0, dragging1=false, moved1=false;
      try {
        var savedPos = localStorage.getItem(HX_CONFIG.pos);
        if (savedPos && !isMobile()) {
          var arr = savedPos.split(',');
          if (arr.length === 2) {
            $ball[0].style.setProperty('left', arr[0]+'px', 'important');
            $ball[0].style.setProperty('top', arr[1]+'px', 'important');
            $ball[0].style.setProperty('right', 'auto', 'important');
          }
        }
      } catch(e){}
      $ball[0].addEventListener('touchstart', handleBallDown, { passive: false });
      $ball.on('mousedown', function(e) { if (e.button !== 0) return; handleBallDown(e); });
      function handleBallDown(e) {
        var p = e.originalEvent && e.originalEvent.touches ? e.originalEvent.touches[0] : (e.touches ? e.touches[0] : e);
        sx1 = p.clientX; sy1 = p.clientY;
        var r = $ball[0].getBoundingClientRect(); ox1 = r.left; oy1 = r.top;
        dragging1 = true;
        document.addEventListener('mousemove', handleBallMove);
        document.addEventListener('touchmove', handleBallMove, { passive: false });
        document.addEventListener('mouseup', handleBallUp);
        document.addEventListener('touchend', handleBallUp);
      }
      function handleBallMove(me) {
        if (!dragging1) return;
        var mp = me.originalEvent && me.originalEvent.touches ? me.originalEvent.touches[0] : (me.touches ? me.touches[0] : me);
        var dx = mp.clientX - sx1, dy = mp.clientY - sy1;
        if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
          moved1 = true;
          var vw = GS_PARENT.innerWidth||1024, vh = GS_PARENT.innerHeight||768;
          var sz = $ball[0].offsetWidth || 36;
          var nl = Math.max(10, Math.min(vw-sz-10, ox1+dx));
          var nt = Math.max(10, Math.min(vh-sz-10, oy1+dy));
          $ball[0].style.setProperty('right','auto','important');
          $ball[0].style.setProperty('bottom','auto','important');
          $ball[0].style.setProperty('left', nl+'px','important');
          $ball[0].style.setProperty('top', nt+'px','important');
          if (me.type === 'touchmove' && me.cancelable) me.preventDefault();
        }
      }
      function handleBallUp() {
        if (dragging1 && moved1) {
          try { localStorage.setItem(HX_CONFIG.pos, parseInt($ball[0].style.left)+','+parseInt($ball[0].style.top)); } catch(e){}
        }
        dragging1 = false;
        document.removeEventListener('mousemove', handleBallMove);
        document.removeEventListener('touchmove', handleBallMove);
        document.removeEventListener('mouseup', handleBallUp);
        document.removeEventListener('touchend', handleBallUp);
        setTimeout(function() { moved1 = false; }, 50);
      }
      $ball.on('click', function() { if (!moved1) togglePanel(); });
    }
  }

  // ===== 12. DOM 注入 =====
  function initHxDOM() {
    if (!document.getElementById('hx-stat-ball')) {
      var tpl = '<div id="hx-stat-ball"><div class="hx-core">🌙</div></div><div id="hx-stat-panel"></div><div id="hx-stat-modal"></div>';
      $('body').append(tpl);
      setupDragEngine();
      bindUIEvents();
    }
  }

  // ===== 13. 弹窗 =====
  function showModal(title, bodyHtml) {
    var $m = $('#hx-stat-modal');
    if (!$m.length) { $('body').append('<div id="hx-stat-modal"></div>'); $m = $('#hx-stat-modal'); }
    $m.html('<div class="hx-modal-box"><div class="hx-modal-head"><span>'+esc(title)+'</span><span class="hx-modal-close">✕</span></div><div class="hx-modal-body">'+bodyHtml+'</div></div>');
    $m[0].scrollTop = 0;
    $m.addClass('open');
    $m.off('click.hxModal').on('click.hxModal', '.hx-modal-close', function() { $('#hx-stat-modal').removeClass('open'); });
    $m.off('click.hxModalBg').on('click.hxModalBg', function(e) { if (e.target === this) $('#hx-stat-modal').removeClass('open'); });
  }

  // ===== 14. UI 事件绑定 (来自轮回) =====
  function bindUIEvents() {
    var $panel = $('#hx-stat-panel');
    // 关闭
    $panel.off('click.hxClose').on('click.hxClose', '.hx-icon-btn.close', function() {
      if (isEditMode()) setEditMode(false);
      if ($('#hx-stat-panel').hasClass('open')) togglePanel();
    });
    // 刷新
    $panel.off('click.hxRefresh').on('click.hxRefresh', '.hx-icon-btn.refresh', function() {
      if (isEditMode()) setEditMode(false);
      renderAll();
    });
    // 破解模式
    $panel.off('click.hxHack').on('click.hxHack', '.hx-hack-toggle', function(e) {
      e.stopPropagation();
      setHackMode(!getHackMode());
      renderAll();
    });
    // 主题切换
    $panel.off('click.hxTheme').on('click.hxTheme', '.hx-theme-btn', function() {
      var next = getTheme() === 'dark' ? 'light' : 'dark';
      setTheme(next);
      renderAll();
    });
    // 公司地图
    $panel.off('click.hxMap').on('click.hxMap', '.hx-map-btn', function() {
      showMap();
    });
    // Tab 切换
    $panel.off('click.hxTab').on('click.hxTab', '.hx-tab-btn', function() {
      var tab = $(this).data('tab');
      setCurrentTab(tab);
      renderTabContent(tab);
      $panel.find('.hx-tab-btn').removeClass('active');
      $(this).addClass('active');
    });
    // 编辑态: 点击编辑框进入输入
    $panel.off('click.hxEditWrap').on('click.hxEditWrap', '.hx-ed-wrap', function(e) {
      if (!isEditMode()) return;
      var $wrap = $(this);
      var path = $wrap.attr('data-path');
      var type = $wrap.attr('data-type') || 'text';
      var optsStr = $wrap.attr('data-opts') || '';
      var val = $wrap.find('.hx-ed-val').text();
      if (val === '空') val = '';
      var inputHtml;
      if (optsStr) {
        var opts = String(optsStr).split('|');
        inputHtml = editRealSelectHtml(path, opts, val);
      } else {
        inputHtml = editRealInputHtml(path, val, type);
      }
      $wrap.addClass('editing').html(inputHtml);
      var input = $wrap.find('.hx-edit-input');
      if (input.length) { input.focus(); if (type !== 'select') input[0].select(); }
    });
    // 编辑态: 失焦/回车 暂存
    $panel.off('blur.hxEdit change.hxEdit keydown.hxEdit')
      .on('blur', '.hx-edit-input', function() { flushEditable($(this)); })
      .on('change', '.hx-edit-input[data-type="select"]', function() { flushEditable($(this)); })
      .on('keydown', '.hx-edit-input', function(e) { if (e.which === 13) { e.preventDefault(); flushEditable($(this)); } });
    // 保存按钮
    $panel.off('click.hxSave').on('click.hxSave', '.hx-save-btn', function() {
      if (Object.keys(pendingEdits).length === 0) return;
      var saved = false;
      writeBackMvu(function(statData) {
        if (!statData) return;
        Object.keys(pendingEdits).forEach(function(path) {
          var ed = pendingEdits[path];
          if (!ed) return;
          if (ed.type === 'number') ed.val = Number(ed.val);
          if (path.indexOf('.身份') >= 0 || path.indexOf('.职业') >= 0) ed.val = String(ed.val).split(/[\/,，]/).map(function(s){return s.trim();}).filter(Boolean);
          if (_ && typeof _.set === 'function') _.set(statData, path, ed.val);
        });
        saved = true;
      });
      if (saved) { pendingEdits = {}; renderAll(); console.log('%c[环晓·终端] ✅ 已保存 %d 条修改', 'color:#86efac', Object.keys(pendingEdits).length || '全部'); }
    });
  }

  function flushEditable($el) {
    if (!$el || !$el.length) return;
    var path = $el.attr('data-path');
    if (!path) return;
    var type = $el.attr('data-type') || 'text';
    var val = $el.is('select') ? $el.val() : $el.val();
    if (type === 'number') { var n = Number(val); val = Number.isFinite(n) ? n : 0; }
    if (path.indexOf('.身份') >= 0 || path.indexOf('.职业') >= 0) {
      val = String(val).split(/[\/,，]/).map(function(s){return s.trim();}).filter(Boolean);
    }
    stageEdit(path, val, type);
    var $wrap = $el.closest('.hx-ed-wrap');
    if (!$wrap.length) { $wrap = $el.wrap('<span class="hx-ed-wrap"></span>').closest('.hx-ed-wrap'); }
    var disp = editDisplayInner(val);
    $wrap.attr('data-path', path).attr('data-type', type);
    $wrap.removeClass('editing').html(disp + '<span class="hx-ed-ico">✎</span>');
  }

  // ===== 15.5 公司地图 =====
  var BUILDING = [
    {floor:'B2',name:'地下停车场',type:'parking'},
    {floor:'B1',name:'数据中心·Sisterhood机密',type:'secret'},
    {floor:'1F',name:'大厅前台·门禁',type:'public'},
    {floor:'4F',name:'待分配中心·面试间',type:'office'},
    {floor:'6F',name:'公共食堂·社交中心',type:'dining'},
    {floor:'8F',name:'研发部·天台吸烟区',type:'office'},
    {floor:'9F',name:'女员工专用层(泳池/健身)',type:'restricted'},
    {floor:'12F',name:'主任办公室·母婴室',type:'office'},
    {floor:'13F',name:'人力资源·行政部',type:'office'},
    {floor:'17F',name:'第三医务室·改造手术',type:'medical'},
    {floor:'22F',name:'实习助理区·白丝制服',type:'restricted'},
    {floor:'23F',name:'正式助理区',type:'restricted'},
    {floor:'24F',name:'辅骑/主骑候补区',type:'restricted'},
    {floor:'25F',name:'总裁办公室',type:'office'},
    {floor:'26F',name:'隐藏层·行为观察实验室',type:'secret'},
    {floor:'28F',name:'人体实验室·姜舞主场',type:'secret'}
  ];
  function showMap() {
    var sd = getStatData();
    var env = (sd && sd['环境与系统']) || {};
    var curFloor = env['当前楼层'] || '';
    var curLoc = env['当前位置'] || '';
    var curScene = env['当前场景'] || '';
    // 提取楼层数字
    var floorNum = '';
    var m = curFloor.match(/(\d+)/);
    if (m) floorNum = m[1]+'F';
    // 判断是否在室内
    var isOutside = !curFloor || curFloor.indexOf('层') === -1 && curFloor.indexOf('F') === -1 && curFloor.indexOf('楼') === -1;
    var html = '';
    if (isOutside) {
      html += '<div style="text-align:center;padding:30px 10px;">';
      html += '<div style="font-size:36px;margin-bottom:12px;">📍</div>';
      html += '<div style="font-size:16px;color:#ffb84d;font-weight:bold;margin-bottom:6px;">当前位置（公司外部）</div>';
      if (curFloor || curLoc) html += '<div style="font-size:13px;color:#a99fd0;">'+esc(curFloor||'')+' '+esc(curLoc||'')+'</div>';
      if (curScene) html += '<div style="font-size:12px;color:#7d709f;margin-top:4px;">场景：'+esc(curScene)+'</div>';
      html += '<div style="margin-top:20px;font-size:11px;color:#7d709f;">进入环晓科技大厦后显示公司内部楼层地图</div>';
      html += '</div>';
    } else {
      html += '<div style="text-align:center;margin-bottom:10px;font-size:14px;color:#b39dff;font-weight:bold;">📍 环晓科技总部 · 25层写字楼</div>';
      // 楼层地图
      html += '<div style="display:flex;flex-direction:column;gap:3px;max-height:50vh;overflow-y:auto;">';
      var seen = {};
      BUILDING.forEach(function(b) {
        var label = b.name || '';
        var icon = b.type==='secret'?'🔒':b.type==='restricted'?'🚫':b.type==='medical'?'🏥':b.type==='dining'?'🍽️':b.type==='parking'?'🅿️':'🏢';
        var isCurrent = floorNum && (b.floor === floorNum);
        var bg = isCurrent?'background:linear-gradient(90deg,rgba(134,239,172,0.25),rgba(134,239,172,0.08));border-left:3px solid #86efac;':'background:rgba(155,109,255,0.04);';
        html += '<div style="display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:6px;'+bg+'">';
        html += '<div style="width:36px;text-align:center;font-weight:bold;font-size:12px;color:'+(isCurrent?'#86efac':'#b39dff')+';">'+b.floor+'</div>';
        html += '<div style="font-size:11px;color:'+(isCurrent?'#d5f0e0':'#a99fd0')+';">'+icon+' '+esc(label)+'</div>';
        if (isCurrent) html += '<div style="font-size:10px;color:#86efac;margin-left:auto;">← 当前位置</div>';
        html += '</div>';
      });
      html += '</div>';
      // 当前详情
      if (curFloor || curLoc || curScene) {
        html += '<div style="margin-top:12px;padding:10px;background:rgba(134,239,172,0.06);border-radius:8px;font-size:11px;color:#a99fd0;line-height:1.8;">';
        if (curFloor) html += '<b>楼层：</b>'+esc(curFloor)+'　';
        if (curLoc) html += '<b>位置：</b>'+esc(curLoc)+'　';
        if (curScene) html += '<b>场景：</b>'+esc(curScene);
        html += '</div>';
      }
    }
    showModal('🗺️ 环晓科技 · 公司地图', html);
  }

  // ===== 15. 渲染字段项 =====
  function renderField(key, val, basePath) {
    var path = basePath + '.' + key;
    var vType = typeof val;
    // 对象嵌套(<2层): 展开子字段
    if (val && typeof val === 'object' && !Array.isArray(val) && !(val instanceof Date)) {
      var html = '<div class="hx-sub"><div class="hx-row"><span class="hx-k">'+esc(key)+'</span></div>';
      Object.keys(val).forEach(function(kk) {
        html += renderField(kk, val[kk], path);
      });
      html += '</div>';
      return html;
    }
    // 数组
    if (Array.isArray(val)) {
      var arrHtml = '<div class="hx-sub"><div class="hx-row"><span class="hx-k">'+esc(key)+' ['+val.length+']</span></div>';
      val.forEach(function(item, idx) {
        arrHtml += renderField('['+idx+']', item, path);
      });
      arrHtml += '</div>';
      return arrHtml;
    }
    // 标量
    var hackOn = getHackMode();
    var isHackField = (key === '破解模式');
    var isContrib = (key === '贡献点');
    var isMental = (key === '精神状态');
    var isHypnosis = (key === '催眠权限等级');
    var display, rowStyle = '';
    if (vType === 'boolean') {
      if (isHackField && val) {
        display = '<span style="color:#86efac;font-weight:bold;text-shadow:0 0 6px rgba(134,239,172,0.6);">🟢 ROOT ACTIVE</span>';
        rowStyle = 'background:linear-gradient(90deg,rgba(134,239,172,0.12),rgba(134,239,172,0.03));border-left:2px solid #86efac;';
      } else if (isHackField && !val) {
        display = '<span style="color:#f87171;opacity:0.5;">✗</span>';
        rowStyle = 'opacity:0.5;';
      } else {
        display = val ? '<span style="color:#86efac;">✓</span>' : '<span style="color:#f87171;">✗</span>';
      }
    } else if (vType === 'number') {
      if (isContrib && hackOn) {
        display = '<span style="color:#ffd1a0;font-weight:bold;font-size:15px;">∞</span>';
      } else if (isMental && hackOn) {
        display = '<span style="color:#86efac;font-weight:bold;">100</span>';
      } else if (isHypnosis && hackOn) {
        display = '<span style="color:#ffd1a0;font-weight:bold;">10 (最高)</span>';
      } else {
        display = String(val);
      }
    } else {
      display = esc(String(val === '' || val === null || val === undefined ? '—' : val));
    }
    return '<div class="hx-row" style="'+rowStyle+'"><span class="hx-k">'+esc(key)+'</span><span class="hx-v">'+display+'</span></div>';
  }

  function renderTabContent(tab) {
    var $content = $('#hx-tab-content');
    if (!$content.length) return;
    var sd = getStatData();
    if (!sd || !sd[tab]) {
      $content.html('<div class="hx-empty">'+CATEGORIES.find(function(c){return c.key===tab;}).icon+' '+tab+'：暂无数据</div>');
      return;
    }
    var sub = sd[tab];
    var html = '';
    Object.keys(sub).forEach(function(key) {
      html += renderField(key, sub[key], tab);
    });
    $content.html(html || '<div class="hx-empty">空</div>');
  }

  // ===== 16. 主渲染入口 =====
  function renderAll() {
    try {
      var ae = document.activeElement;
      if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA')) {
        var pn = document.getElementById('hx-stat-panel');
        if (pn && pn.contains(ae)) ae.blur();
      }
    } catch(e) {}
    var sd = getStatData();
    var $panel = $('#hx-stat-panel');
    if (!sd) {
      $panel.html('<div class="hx-topbar"><div class="hx-tl-info"><div class="hx-tl-title">终端未响应</div></div><div class="hx-tl-actions"><div class="hx-icon-btn refresh" title="刷新数据">🔄</div><div class="hx-icon-btn close" title="关闭">✕</div></div></div><div class="hx-empty"><div style="font-size:36px;opacity:0.6;animation:hxPulse 2s infinite;">📡</div><div style="margin-top:10px;">变量尚未初始化...</div></div>');
      return;
    }
    // 当前时间
    var now = new Date();
    var dateStr = now.getFullYear() + '-' +
      ('0'+(now.getMonth()+1)).slice(-2) + '-' +
      ('0'+now.getDate()).slice(-2) + ' ' +
      ('0'+now.getHours()).slice(-2) + ':' +
      ('0'+now.getMinutes()).slice(-2);
    var editMode = isEditMode();
    var hackOn = getHackMode();
    var curTab = getCurrentTab();
    var html = '';
    // 顶栏
    html += '<div class="hx-topbar">';
    html += '<div class="hx-tl-info"><div class="hx-tl-title">🌙 '+dateStr+'</div></div>';
    html += '<div class="hx-tl-actions">';
    html += '<div class="hx-hack-toggle'+(hackOn?' on':'')+'"><span class="hx-hack-badge">🔓</span></div>';
    html += '<div class="hx-icon-btn hx-theme-btn" title="切换主题(暗/亮)">'+(getTheme()==='light'?'☀️':'🌙')+'</div>';
    html += '<div class="hx-icon-btn hx-map-btn" title="公司地图">🗺️</div>';
    html += '<div class="hx-icon-btn refresh" title="刷新数据">🔄</div>';
    html += '<div class="hx-icon-btn close" title="关闭">✕</div>';
    html += '</div></div>';
    // 破解模式提示
    if (hackOn) {
      html += '<div class="hx-hack-tip">⚡ 破解模式已开启：已获得环晓科技员工系统最高权限(ROOT)</div>';
    }
    // Tab 栏
    html += '<div class="hx-tab-rail">';
    CATEGORIES.forEach(function(c) {
      html += '<div class="hx-tab-btn'+(c.key === curTab ? ' active' : '')+'" data-tab="'+esc(c.key)+'">'+c.icon+' '+esc(c.key)+'</div>';
    });
    html += '</div>';
    // 编辑模式额外UI
    if (editMode) {
      html += '<div class="hx-edit-badge">编辑模式 · 点击数值就地修改，失焦/回车暂存，结束时点保存写回MVU</div>';
    }
    // Tab 内容容器
    html += '<div class="hx-tab-content" id="hx-tab-content"></div>';
    if (editMode && Object.keys(pendingEdits).length > 0) {
      html += '<div class="hx-save-btn">💾 保存修改 ('+Object.keys(pendingEdits).length+' 条)</div>';
    }
    $panel.html(html);
    $panel.toggleClass('light', getTheme() === 'light');
    renderTabContent(curTab);
  }

  // ===== 17. 生命周期 (来自轮回) =====
  var debouncedRefresh = null;
  function setupDebouncedRefresh() {
    var win = getMvuGlobal();
    debouncedRefresh = function() {
      if (window.__hx_refresh_timer__) clearTimeout(window.__hx_refresh_timer__);
      window.__hx_refresh_timer__ = setTimeout(function() {
        window.__hx_refresh_timer__ = null;
        if ($('#hx-stat-panel').hasClass('open') && !isEditMode()) renderAll();
      }, 500);
    };
    try {
      if (win && win.Mvu && win.Mvu.events) {
        if (typeof eventOn === 'function') eventOn(win.Mvu.events.VARIABLE_UPDATE_ENDED, debouncedRefresh);
      }
    } catch(e){}
    try {
      if (typeof tavern_events !== 'undefined') {
        if (tavern_events.MESSAGE_DELETED && typeof eventOn === 'function') eventOn(tavern_events.MESSAGE_DELETED, debouncedRefresh);
        if (tavern_events.MESSAGE_SWIPED  && typeof eventOn === 'function') eventOn(tavern_events.MESSAGE_SWIPED,  debouncedRefresh);
        if (tavern_events.CHAT_CHANGED    && typeof eventOn === 'function') eventOn(tavern_events.CHAT_CHANGED,    debouncedRefresh);
      }
    } catch(e){}
  }

  function init() {
    initHxCss();
    initHxDOM();
    renderAll();
    try {
      if (localStorage.getItem(HX_CONFIG.open) === '1') {
        var $panel = $('#hx-stat-panel');
        var $ball = $('#hx-stat-ball');
        if (!isMobile()) {
          var r = $ball[0].getBoundingClientRect();
          var vw = GS_PARENT.innerWidth, vh = GS_PARENT.innerHeight;
          var nl = Math.max(20, Math.min(vw - 340, r.left > vw/2 ? r.left - 340 - 10 : r.left + 50));
          var nt = Math.max(20, Math.min(vh - 600, r.top));
          $panel.css({left:nl+'px', top:nt+'px', right:'auto', bottom:'auto'});
        }
        $panel.css('display','flex').addClass('open');
        $panel.toggleClass('light', getTheme() === 'light');
        $ball.hide();
      }
    } catch(e){}
    setupDebouncedRefresh();
    // 守卫定时器: 15s 检查球存在(来自轮回)
    window.__hx_guard_timer__ = setInterval(function() {
      if (!document.getElementById('hx-stat-ball') || !document.getElementById('hx-stat-panel')) {
        initHxDOM();
        renderAll();
      }
    }, 15000);
    try { GS_PARENT.__悬浮球状态栏_loaded__ = true; } catch(e) { window.__悬浮球状态栏_loaded__ = true; }
    try { console.log('%c[环晓·终端] ✅ v3.0 初始化完成', 'color:#86efac;font-weight:bold'); } catch(e){}
  }

  // ===== 18. 启动 =====
  (function bootstrap() {
    if ($ && document.body) init();
    else setTimeout(bootstrap, 200);
  })();

  try { $(window).on('unload.hx', hxPreClean); } catch(e) {}
})();
