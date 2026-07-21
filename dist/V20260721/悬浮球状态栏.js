/* === 环晓科技 悬浮球状态栏 (外部化自 催眠助理·环晓科技 角色卡) ===
 * CDN: https://cdn.jsdelivr.net/gh/2000dang/Recreation@main/dist/V20260721/悬浮球状态栏.js
 * 本文件由 scripts/build_card.py 从卡片内联脚本抽离生成, 勿手动编辑。
 * ============================================================ */

(function(){
 try {
/* ==========================================================================
 * [环晓科技] 员工终端系统 UI (Huánxiǎo Staff Terminal) v2
 * 设计: 环晓科技 MVU 悬浮状态栏 UI
 *   - 多主题换肤(暗夜/绯红/靛蓝/羊皮纸) 通过 CSS 变量 + data-theme
 *   - 悬浮球启动器 + 面板 + 详情弹窗
 *   - 顶栏(标题 + 刷新/主题/突破/关闭) + 左侧分类 Tab + 右侧内容
 *   - 依据已注册 MVU Schema 通用渲染各分类(含 record 子卡)
 *   - 统一通过 Mvu.getMvuData 读取, 监听 VARIABLE_UPDATE_ENDED 自动刷新
 *   - 内联编辑(双击文本/数值, 单击布尔)写回 MVU: updateVariable / replaceMvuData
 * ========================================================================== */
(function () {
    'use strict';
    try { console.log('%c[员工终端] ⚡ 环晓科技 员工终端 v2 接入中...', 'color:#5fd0ff;font-weight:bold'); } catch (e) {}

    /* ===== 1. 父窗口重定向 (与 主神终端 一致) ===== */
    var GS = (function () {
        try { if (window.parent && window.parent !== window && window.parent.document && window.parent.document.body) return window.parent; } catch (e) {}
        try { if (window.top && window.top !== window && window.top.document && window.top.document.body) return window.top; } catch (e) {}
        return window;
    })();
    var $ = (GS.jQuery || GS.$ || window.jQuery || window.$);
    var document = GS.document;
    var _ = (GS._ || window._);

    /* ===== 2. 状态存储配置 (独立 key, 避免与 主神终端 冲突) ===== */
    var HX = {
        pos: 'hx4_pos_v2',
        open: 'hx4_open_v2',
        theme: 'hx4_theme_v2',
        tab: 'hx4_tab_v2'
    };

    /* ===== 3. 主题定义 (token 命名对齐 主神终端) ===== */
    var THEMES = {
        night:     { name: '暗夜', accent: '#5fd0ff', good: '#22c55e', warn: '#eab308', danger: '#ef4444', bg: 'rgba(14,20,32,0.9)', card: 'rgba(22,32,50,0.72)', border: 'rgba(95,208,255,0.28)', text: '#eaf2f8', sub: '#8b95a6', dark: '#070a10' },
        crimson:   { name: '绯红', accent: '#ff5f57', good: '#22c55e', warn: '#eab308', danger: '#ff4757', bg: 'rgba(28,12,16,0.92)', card: 'rgba(46,18,24,0.74)', border: 'rgba(255,95,87,0.3)', text: '#fff0f3', sub: '#b08896', dark: '#0e0406' },
        indigo:    { name: '靛蓝', accent: '#7c5cff', good: '#34d399', warn: '#fbbf24', danger: '#fb7185', bg: 'rgba(14,16,38,0.92)', card: 'rgba(28,30,58,0.74)', border: 'rgba(124,92,255,0.32)', text: '#eef0ff', sub: '#9094c0', dark: '#06081a' },
        parchment: { name: '羊皮', accent: '#a8761e', good: '#3a7d34', warn: '#b8860b', danger: '#c0392b', bg: 'rgba(245,235,210,0.96)', card: 'rgba(235,222,190,0.85)', border: 'rgba(168,118,30,0.35)', text: '#3a2a14', sub: '#7a6440', dark: '#e8d8b8' }
    };
    var THEME_ORDER = ['night', 'crimson', 'indigo', 'parchment'];

    /* 品质/枚举色板 (对齐 主神终端 --sam-q-*) */
    var Q = { F: '#94a3b8', E: '#f8fafc', D: '#22c55e', C: '#3b82f6', B: '#a855f7', A: '#f97316', S: '#eab308', SS: '#ef4444', SSS: '#ec4899' };

    /* ===== 4. 预清理旧实例 ===== */
    function hxPreClean() {
        try {
            if ($) {
                $('#hx4, #hx4-s, #hx4-p, #hx4-m, #hx-theme-style').remove();
                $(document).off('.hx4');
            }
            if (window.hxGuardTimer) clearInterval(window.hxGuardTimer);
            if (window.hxRefreshTimer) { clearInterval(window.hxRefreshTimer); window.hxRefreshTimer = null; }
        } catch (e) { console.warn('[员工终端] 预清理失败:', e.message); }
    }
    hxPreClean();

    /* ===== 5. 获取 MVU 全局与数据 (对齐 主神终端 回退链) ===== */
    function getMvuGlobal() {
        try { if (typeof window.Mvu !== 'undefined') return window; if (typeof GS.Mvu !== 'undefined') return GS; } catch (e) {}
        return null;
    }
    function getStatData() {
        try {
            var win = getMvuGlobal();
            if (win && win.Mvu && typeof win.Mvu.getMvuData === 'function') {
                var r = win.Mvu.getMvuData({ type: 'message', message_id: 'latest' });
                if (r && r.stat_data) return r.stat_data;
                if (r) return r;
            }
        } catch (e) { console.warn('[员工终端] getMvuData 异常:', e.message); }
        try { if (typeof GS.getAllVariables === 'function') { var v = GS.getAllVariables(); if (v && v.stat_data) return v.stat_data; } } catch (e) {}
        try { if (typeof getAllVariables === 'function') { var v = getAllVariables(); if (v && v.stat_data) return v.stat_data; } } catch (e) {}
        try { if (typeof GS.getMessageVar === 'function') return GS.getMessageVar('stat_data'); } catch (e) {}
        return null;
    }
    /* 写回 MVU (使用 _.set 深层写入 + replaceMvuData, 对齐 轮回战场 模式) */
    function setVar(path, value) {
        try {
            var win = getMvuGlobal();
            if (!win || !win.Mvu || typeof win.Mvu.getMvuData !== 'function') {
                // 回退: updateVariable (SillyTavern 原生API)
                if (win && win.Mvu && typeof win.Mvu.updateVariable === 'function') {
                    var r = win.Mvu.updateVariable(path, value);
                    if (r && typeof r.catch === 'function') r.catch(function () {});
                    afterWrite();
                    return true;
                }
                if (typeof updateVariable === 'function') {
                    var r2 = updateVariable(path, value);
                    if (r2 && typeof r2.catch === 'function') r2.catch(function () {});
                    afterWrite();
                    return true;
                }
                console.warn('[员工终端] 无可用 MVU 写回 API');
                return false;
            }

            // 读当前快照
            var d = win.Mvu.getMvuData({ type: 'message', message_id: 'latest' });
            if (!d || !d.stat_data) { console.warn('[员工终端] getMvuData 返回空'); return false; }

            // deep clone
            var cloned = (_ && _.cloneDeep) ? _.cloneDeep(d) : JSON.parse(JSON.stringify(d));

            // _.set 深层写入
            if (_ && typeof _.set === 'function') {
                _.set(cloned.stat_data, path, value);
            } else {
                setDeep(cloned.stat_data, path, value);
            }

            // ★ UI 突变标志: 告知辅助计算脚本跳过战斗轮次/冷却递减
            var GS_PARENT = GS;
            try {
                GS_PARENT.__hx4UIMutation = true;
                if (win !== GS_PARENT) win.__hx4UIMutation = true;
            } catch(e4) { try { window.__hx4UIMutation = true; } catch(e5) {} }

            // 写回 message 通道
            win.Mvu.replaceMvuData(cloned, { type: 'message', message_id: 'latest' });
            // 同步 chat 通道
            try { win.Mvu.replaceMvuData(cloned, { type: 'chat' }); } catch (e2) {}

            // ★ 手动广播 VARIABLE_UPDATE_ENDED (把 after, before 传给监听者)
            try {
                var evtName = win.Mvu.events && win.Mvu.events.VARIABLE_UPDATE_ENDED;
                var emit = win.eventEmit || (typeof eventEmit === 'function' ? eventEmit : null);
                if (evtName && emit) emit(evtName, cloned, d);
            } catch (e3) { console.warn('[员工终端] 广播 VARIABLE_UPDATE_ENDED 失败:', e3.message); }

            // 清除 UI 突变标志
            try {
                GS_PARENT.__hx4UIMutation = false;
                if (win !== GS_PARENT) win.__hx4UIMutation = false;
            } catch(e6) { try { window.__hx4UIMutation = false; } catch(e7) {} }

            render();
            return true;
        } catch (e) { console.warn('[员工终端] 写回失败:', e.message); return false; }
    }
    function afterWrite() {
        // 广播 + 刷新 (供 updateVariable 回退路径使用)
        try {
            var win = getMvuGlobal();
            var d = getStatData();
            var evt = win && win.Mvu && win.Mvu.events && win.Mvu.events.VARIABLE_UPDATE_ENDED;
            var emit = win && win.eventEmit ? win.eventEmit : (typeof eventEmit === 'function' ? eventEmit : null);
            if (evt && emit && d) emit(evt, d, d);
        } catch (e) {}
        render();
    }
    function setDeep(obj, path, value) {
        var ks = String(path).split('/').filter(Boolean);
        var c = obj;
        for (var i = 0; i < ks.length - 1; i++) { if (c[ks[i]] == null) c[ks[i]] = {}; c = c[ks[i]]; }
        c[ks[ks.length - 1]] = value;
    }
    function getPath(obj, path) {
        var ks = String(path).split('/').filter(Boolean);
        var c = obj;
        for (var i = 0; i < ks.length; i++) { if (c == null) return null; c = c[ks[i]]; }
        return c == null ? null : c;
    }

    /* ===== 6. 工具函数 ===== */
    function esc(s) {
        if (s === null || s === undefined) return '';
        return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
    }
    function isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
    function isRecordOfObjects(v) {
        if (!isPlainObject(v)) return false;
    var ks = Object.keys(v);
    if (!ks.length) return true; // 空对象按 record 处理, 渲染"暂无条目"
    return ks.every(function (k) { return isPlainObject(v[k]); });
    }
    function isBar(key, val) {
        return typeof val === 'number' && val >= 0 && val <= 100 && /状态|度|进度|完成|探索/.test(key);
    }
    function fmtVal(v) {
        if (v === null || v === undefined) return '—';
        if (Array.isArray(v)) return v.length ? v.map(function (x) { return esc(x); }).join('、') : '—';
        return esc(v);
    }
    function isMobile() { return (GS.innerWidth || document.documentElement.clientWidth || 360) <= 768; }
    function fitToViewport() {
        if (!isMobile()) return;
        try {
            var vw = GS.innerWidth || document.documentElement.clientWidth || 360;
            var vh = GS.innerHeight || document.documentElement.clientHeight || 640;
            var r = elPanel.getBoundingClientRect();
            var left = r.left, top = r.top, pw = r.width || elPanel.offsetWidth, ph = r.height || elPanel.offsetHeight;
            if (left + pw > vw - 8) left = vw - pw - 8;
            if (top + ph > vh - 8) top = vh - ph - 8;
            if (left < 8) left = 8; if (top < 8) top = 8;
            elPanel.style.right = 'auto'; elPanel.style.bottom = 'auto';
            elPanel.style.left = left + 'px'; elPanel.style.top = top + 'px';
        } catch (e) {}
    }

    /* ===== 6.5 编辑模式与防抖刷新 ===== */
    function isEditMode() {
        try { return !!(document.querySelector('#hx4-p .hx-edit-input')); } catch (e) { return false; }
    }
    var _refreshTimer = null;
    function debouncedRender() {
        if (_refreshTimer) clearTimeout(_refreshTimer);
        _refreshTimer = setTimeout(function () {
            _refreshTimer = null;
            try { if ($('#hx4-p').hasClass('open') && !isEditMode()) render(); } catch (e) {}
        }, 500);
    }

    /* ===== 7. 主题应用 ===== */
    function getTheme() {
        try { var t = localStorage.getItem(HX.theme); if (t && THEMES[t]) return t; } catch (e) {}
        return 'night';
    }
    function setTheme(t) {
        try { localStorage.setItem(HX.theme, t); } catch (e) {}
        applyThemeVars(t);
    }
    function applyThemeVars(t) {
        var th = THEMES[t] || THEMES.night;
        var targets = [elCard, elPanel, elModal];
        targets.forEach(function (el) {
            if (!el) return;
            el.style.setProperty('--hx-accent', th.accent);
            el.style.setProperty('--hx-good', th.good);
            el.style.setProperty('--hx-warn', th.warn);
            el.style.setProperty('--hx-danger', th.danger);
            el.style.setProperty('--hx-bg', th.bg);
            el.style.setProperty('--hx-card', th.card);
            el.style.setProperty('--hx-border', th.border);
            el.style.setProperty('--hx-text', th.text);
            el.style.setProperty('--hx-sub', th.sub);
            el.style.setProperty('--hx-dark', th.dark);
        });
        if (elPanel) elPanel.setAttribute('data-theme', t);
    }

    /* ===== 8. 样式 (结构性 CSS, 一次性注入; 颜色走 CSS 变量) ===== */
    try {
        var st = document.createElement('style');
        st.id = 'hx4-s';
        st.textContent =
            '#hx4,#hx4-p,#hx4-m{--hx-accent:#5fd0ff;--hx-good:#22c55e;--hx-warn:#eab308;--hx-danger:#ef4444;--hx-bg:rgba(14,20,32,.9);--hx-card:rgba(22,32,50,.72);--hx-border:rgba(95,208,255,.28);--hx-text:#eaf2f8;--hx-sub:#8b95a6;--hx-dark:#070a10;box-sizing:border-box}' +
            '#hx4 *,#hx4-p *,#hx4-m *{box-sizing:border-box}' +
            /* 悬浮球 */
            '#hx4{position:fixed;top:14px;right:14px;z-index:99999;width:248px;padding:10px 12px;background:var(--hx-bg);border:1px solid var(--hx-border);border-radius:16px;box-shadow:0 8px 30px rgba(0,0,0,.5);display:flex;align-items:center;gap:10px;color:var(--hx-text);font:13px "Segoe UI","Microsoft YaHei",sans-serif;cursor:grab;user-select:none;backdrop-filter:blur(14px) saturate(160%);-webkit-backdrop-filter:blur(14px) saturate(160%);transition:opacity .2s,transform .2s;touch-action:none}' +
            '#hx4.open{display:none}' +
            '#hx4 .hx-ico{flex:0 0 42px;height:42px;border-radius:50%;background:linear-gradient(135deg,var(--hx-dark),var(--hx-card));border:2px solid var(--hx-accent);display:flex;align-items:center;justify-content:center;font-size:20px;box-shadow:0 0 14px rgba(95,208,255,.25)}' +
            '#hx4 .hx-meta{flex:1;min-width:0}' +
            '#hx4 .hx-title{font-weight:600;line-height:1.3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
            '#hx4 .hx-sub{font-size:11px;color:var(--hx-sub);line-height:1.4;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}' +
            '#hx4 .hx-dot{flex:0 0 16px;height:16px;border-radius:50%;background:radial-gradient(circle,var(--hx-accent) 30%,transparent 70%);animation:hxp 1.6s infinite}' +
            '@keyframes hxp{0%,100%{opacity:.55;transform:scale(1)}50%{opacity:1;transform:scale(1.25)}}' +
            /* 面板 */
            '#hx4-p{position:fixed;top:14px;right:14px;z-index:99998;width:430px;max-width:calc(100vw - 24px);height:78vh;max-height:78vh;background:var(--hx-bg);border:1px solid var(--hx-border);border-radius:18px;box-shadow:0 10px 40px rgba(0,0,0,.55);display:none;flex-direction:column;overflow:hidden;font:13px "Segoe UI","Microsoft YaHei",sans-serif;color:var(--hx-text);backdrop-filter:blur(16px) saturate(160%);-webkit-backdrop-filter:blur(16px) saturate(160%)}' +
            '#hx4-p.open{display:flex}' +
            '#hx4-p .hx-header{display:flex;align-items:center;justify-content:space-between;padding:11px 14px;border-bottom:1px solid var(--hx-border);background:linear-gradient(180deg,rgba(255,255,255,.04),transparent);touch-action:none}' +
            '#hx4-p .hx-htitle{font-size:13px;font-weight:600;display:flex;align-items:center;gap:6px}' +
            '#hx4-p .hx-actions{display:flex;align-items:center;gap:6px}' +
            '#hx4-p .hx-btn{width:30px;height:30px;border-radius:8px;border:1px solid var(--hx-border);background:rgba(255,255,255,.06);color:var(--hx-text);cursor:pointer;font-size:13px;display:flex;align-items:center;justify-content:center;transition:all .15s;touch-action:manipulation}' +
            '#hx4-p .hx-btn:hover{background:var(--hx-accent);color:var(--hx-dark);border-color:var(--hx-accent)}' +
            '#hx4-p .hx-crack{display:flex;align-items:center;gap:5px;padding:4px 9px;border-radius:14px;border:1px solid var(--hx-border);background:rgba(255,255,255,.06);color:var(--hx-sub);cursor:pointer;font-size:11px;transition:all .15s;touch-action:manipulation}' +
            '#hx4-p .hx-crack.on{background:rgba(239,68,68,.22);border-color:var(--hx-danger);color:#fff}' +
            /* 主体: 左 rail + 右 content */
            '#hx4-p .hx-body{flex:1;display:flex;min-height:0}' +
            '#hx4-p .hx-rail{width:96px;flex:0 0 96px;padding:10px 8px;background:rgba(0,0,0,.18);border-right:1px solid var(--hx-border);display:flex;flex-direction:column;gap:6px;overflow-y:auto;-webkit-overflow-scrolling:touch}' +
            '#hx4-p .hx-tab{padding:9px 8px;border-radius:10px;border:1px solid transparent;background:transparent;color:var(--hx-sub);cursor:pointer;font-size:12px;text-align:center;line-height:1.25;transition:all .15s;touch-action:manipulation}' +
            '#hx4-p .hx-tab:hover{color:var(--hx-text);background:rgba(255,255,255,.05)}' +
            '#hx4-p .hx-tab.on{background:var(--hx-accent);color:var(--hx-dark);border-color:var(--hx-accent);font-weight:600;box-shadow:0 2px 10px rgba(95,208,255,.3)}' +
            '#hx4-p .hx-content{flex:1;padding:12px 14px;overflow-y:auto;-webkit-overflow-scrolling:touch;min-width:0}' +
            /* 区块/卡片 */
            '#hx4-p .hx-sec{margin-bottom:14px}' +
            '#hx4-p .hx-sec-h{font-size:12px;font-weight:600;color:var(--hx-accent);margin:0 0 8px;display:flex;align-items:center;gap:6px;letter-spacing:.3px}' +
            '#hx4-p .hx-card{background:var(--hx-card);border:1px solid var(--hx-border);border-radius:12px;padding:10px 12px;margin-bottom:8px}' +
            '#hx4-p .hx-card-h{font-size:12px;font-weight:600;margin:0 0 8px;padding-bottom:6px;border-bottom:1px dashed var(--hx-border);display:flex;align-items:center;justify-content:space-between;cursor:pointer}' +
            '#hx4-p .hx-card-h .hx-tag{font-size:11px;font-weight:500;color:var(--hx-sub)}' +
            '#hx4-p .hx-row{display:flex;align-items:flex-start;gap:8px;padding:4px 0;border-bottom:1px solid rgba(255,255,255,.05)}' +
            '#hx4-p .hx-row:last-child{border-bottom:none}' +
            '#hx4-p .hx-k{flex:0 0 38%;max-width:38%;color:var(--hx-sub);font-size:12px;line-height:1.4}' +
            '#hx4-p .hx-v{flex:1;min-width:0;color:var(--hx-text);font-size:12px;line-height:1.45;word-break:break-word}' +
            '#hx4-p .hx-v:hover{outline:1px dashed var(--hx-border);border-radius:6px;cursor:text}' +
            '#hx4-p .hx-type-num.hx-barwrap{display:block}' +
            '#hx4-p .hx-bar{height:7px;border-radius:5px;background:rgba(255,255,255,.12);overflow:hidden;margin-top:5px}' +
            '#hx4-p .hx-bar>i{display:block;height:100%;border-radius:5px;background:linear-gradient(90deg,var(--hx-accent),var(--hx-good));transition:width .4s}' +
            '#hx4-p .hx-chip{display:inline-block;padding:2px 8px;margin:2px 4px 2px 0;border-radius:10px;background:rgba(255,255,255,.08);border:1px solid var(--hx-border);color:var(--hx-text);font-size:11px}' +
            '#hx4-p .hx-bool{display:inline-flex;align-items:center;gap:5px;cursor:pointer;padding:1px 8px;border-radius:10px;font-size:11px;font-weight:600}' +
            '#hx4-p .hx-bool.y{background:rgba(34,197,94,.18);color:var(--hx-good);border:1px solid var(--hx-good)}' +
            '#hx4-p .hx-bool.n{background:rgba(239,68,68,.16);color:var(--hx-danger);border:1px solid var(--hx-danger)}' +
            '#hx4-p .hx-empty{color:var(--hx-sub);font-size:12px;padding:8px 0;text-align:center}' +
            '#hx4-p .hx-edit-input{width:100%;background:rgba(0,0,0,.35);border:1px solid var(--hx-accent);border-radius:6px;color:var(--hx-text);font:12px "Segoe UI",sans-serif;padding:3px 6px;outline:none}' +
            /* 弹窗 */
            '#hx4-m{position:fixed;inset:0;z-index:99997;display:none;align-items:center;justify-content:center;background:rgba(0,0,0,.45);backdrop-filter:blur(2px)}' +
            '#hx4-m.open{display:flex}' +
            '#hx4-m .hx-mbox{width:380px;max-width:calc(100vw - 32px);max-height:80vh;background:var(--hx-bg);border:1px solid var(--hx-border);border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.6);display:flex;flex-direction:column;overflow:hidden;color:var(--hx-text);font:13px "Segoe UI","Microsoft YaHei",sans-serif}' +
            '#hx4-m .hx-mhead{padding:12px 16px;border-bottom:1px solid var(--hx-border);display:flex;align-items:center;justify-content:space-between;font-weight:600}' +
            '#hx4-m .hx-mbody{padding:12px 16px;overflow-y:auto;-webkit-overflow-scrolling:touch}' +
            /* 移动端底部弹出模式 (与 轮回 一致) */ +
            '@media(max-width:768px){' +
              '#hx4{top:auto;bottom:16px;right:16px;width:150px;padding:7px 10px;gap:8px;font-size:12px}' +
              '#hx4 .hx-ico{flex:0 0 36px;height:36px;font-size:16px}' +
              '#hx4 .hx-title{font-size:11px}' +
              '#hx4 .hx-sub{font-size:10px}' +
              '#hx4 .hx-dot{flex:0 0 12px;height:12px}' +
              '#hx4-p{left:0!important;right:0!important;top:auto!important;bottom:0!important;width:100vw;max-width:100vw;height:55vh;max-height:55vh;border-radius:18px 18px 0 0;border-bottom:none}' +
              '#hx4-p .hx-body{flex-direction:column}' +
              '#hx4-p .hx-rail{width:100%;flex:0 0 auto;flex-direction:row;overflow-x:auto;overflow-y:hidden;padding:6px 8px;gap:4px;border-right:none;border-bottom:1px solid var(--hx-border);white-space:nowrap}' +
              '#hx4-p .hx-tab{flex:0 0 auto;padding:6px 10px;font-size:11px;white-space:nowrap;display:inline-flex;align-items:center;gap:4px}' +
              '#hx4-p .hx-tab br{display:none}' +
              '#hx4-p .hx-tab svg{width:14px;height:14px;flex-shrink:0}' +
              '#hx4-p .hx-content{padding:10px;font-size:12px}' +
              '#hx4-p .hx-header{padding:9px 14px}' +
              '#hx4-p .hx-btn{width:28px;height:28px;font-size:12px}' +
              '#hx4-p .hx-k{flex:0 0 44%;max-width:44%;font-size:11px}' +
              '#hx4-p .hx-edit-input{font-size:14px;padding:6px 10px}' +
              '#hx4-m .hx-mbox{width:calc(100vw - 24px);max-height:70vh}' +
            '}' +
            '@media(max-width:480px){' +
              '#hx4{width:130px;bottom:10px;right:10px;padding:6px 8px}' +
              '#hx4 .hx-ico{flex:0 0 32px;height:32px}' +
              '#hx4-p{height:65vh;max-height:65vh;border-radius:16px 16px 0 0}' +
              '#hx4-p .hx-header{padding:8px 12px}' +
              '#hx4-p .hx-htitle{font-size:12px}' +
              '#hx4-p .hx-tab{padding:5px 8px;font-size:10px}' +
              '#hx4-p .hx-tab svg{width:12px;height:12px}' +
              '#hx4-m .hx-mbox{width:calc(100vw - 16px)}' +
            '}';
        document.head.appendChild(st);
    } catch (e) { console.warn('[员工终端] 样式注入失败:', e.message); }

    /* ===== 9. DOM 构建 ===== */
    var elCard, elPanel, elModal, elContent, elRail, elCp, elMoney, elTitle, elCrack, elClose, elRefresh, elTheme;

    /* ===== 9.5 内联 SVG 图标 (必须在 initHxDOM 之前定义, 因 DOM 构建会引用) ===== */
    var ICON_PROFILE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>';
    var ICON_ENV     = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>';
    var ICON_TEAM    = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 19c0-3 3-5 6-5s6 2 6 5"/><path d="M14 18.5c0-2 2-3.5 4-3.5s4 1.5 4 3.5"/></svg>';
    var ICON_MASK    = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h18v3a9 9 0 0 1-18 0V8z"/><circle cx="9" cy="11.5" r="1.2"/><circle cx="15" cy="11.5" r="1.2"/><path d="M12 4.5l-1.5 2M12 4.5l1.5 2"/></svg>';
    var ICON_EYE     = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="2.5"/><line x1="5" y1="5" x2="9" y2="9"/><line x1="19" y1="5" x2="15" y2="9"/></svg>';
    var ICON_CHART   = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/></svg>';

    function initHxDOM() {
        try {
            hxPreClean();
            elCard = document.createElement('div');
            elCard.id = 'hx4';
            elCard.innerHTML = '<div class="hx-ico">' + ICON_ENV + '</div><div class="hx-meta"><div class="hx-title">催眠助理·环晓科技</div><div class="hx-sub">¥<span id="hx-money">—</span> · 贡献点 <span class="hx-cp" id="hx-cp">—</span></div></div><div class="hx-dot"></div>';
            document.body.appendChild(elCard);
            elCp = elCard.querySelector('#hx-cp');
            elMoney = elCard.querySelector('#hx-money');

            elPanel = document.createElement('div');
            elPanel.id = 'hx4-p';
            elPanel.innerHTML =
                '<div class="hx-header"><span class="hx-htitle">' + ICON_PROFILE + ' 员工系统</span>' +
                '<div class="hx-actions">' +
                '<button class="hx-crack" id="hx-crack" title="突破模式"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg> 突破</button>' +
                '<button class="hx-btn" id="hx-refresh" title="刷新"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg></button>' +
                '<button class="hx-btn" id="hx-theme" title="切换主题"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 3a9 9 0 0 0 0 18z" fill="currentColor"/></svg></button>' +
                '<button class="hx-btn" id="hx-close" title="关闭"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg></button>' +
                '</div></div>' +
                '<div class="hx-body"><div class="hx-rail" id="hx-rail"></div><div class="hx-content" id="hx-content"></div></div>';
            document.body.appendChild(elPanel);
            elCrack = elPanel.querySelector('#hx-crack');
            elRefresh = elPanel.querySelector('#hx-refresh');
            elTheme = elPanel.querySelector('#hx-theme');
            elClose = elPanel.querySelector('#hx-close');
            elRail = elPanel.querySelector('#hx-rail');
            elContent = elPanel.querySelector('#hx-content');
            elTitle = elPanel.querySelector('.hx-htitle');

            elModal = document.createElement('div');
            elModal.id = 'hx4-m';
            elModal.innerHTML = '<div class="hx-mbox"><div class="hx-mhead"><span id="hx-mt"></span><button class="hx-btn" id="hx-mx">✕</button></div><div class="hx-mbody" id="hx-mb"></div></div>';
            document.body.appendChild(elModal);

            applyThemeVars(getTheme());
        } catch (e) { console.warn('[员工终端] DOM 构建失败:', e.message); }
    }
    initHxDOM();
    if (!elCard || !elPanel) return;

    /* ===== 10. 分类 (对齐 MVU Schema 顶层) ===== */
    var CATEGORIES = [
        { key: '主角状态', icon: ICON_PROFILE },
        { key: '环境与系统', icon: ICON_ENV },
        { key: '助理管理', icon: ICON_TEAM },
        { key: '催眠系统', icon: ICON_MASK },
        { key: '隐藏场景', icon: ICON_EYE },
        { key: '剧情进度', icon: ICON_CHART }
    ];
    var curTab = (function () { try { var t = localStorage.getItem(HX.tab); if (t) return t; } catch (e) {} return '主角状态'; })();

    function buildRail() {
        elRail.innerHTML = '';
        CATEGORIES.forEach(function (c) {
            var b = document.createElement('button');
            b.className = 'hx-tab' + (c.key === curTab ? ' on' : '');
            b.setAttribute('data-key', c.key);
            b.innerHTML = c.icon + '<br>' + c.key;
            b.addEventListener('click', function (e) { e.stopPropagation(); curTab = c.key; try { localStorage.setItem(HX.tab, curTab); } catch (e2) {} buildRail(); render(); });
            elRail.appendChild(b);
        });
    }

    /* ===== 11. 渲染 (通用 Schema 驱动) ===== */
    function renderFieldRow(key, val, path) {
        if (typeof val === 'boolean') {
            return '<div class="hx-row"><span class="hx-k">' + esc(key) + '</span>' +
                '<span class="hx-v"><span class="hx-bool ' + (val ? 'y' : 'n') + '" data-path="' + esc(path) + '">' + (val ? '✓ 是' : '✗ 否') + '</span></span></div>';
        }
        if (isBar(key, val)) {
            return '<div class="hx-row"><span class="hx-k">' + esc(key) + '</span>' +
                '<span class="hx-v hx-type-num hx-barwrap">' + esc(val) + '/100' +
                '<span class="hx-bar"><i style="width:' + Math.max(0, Math.min(100, val)) + '%"></i></span></span></div>';
        }
        if (typeof val === 'number') {
            return '<div class="hx-row"><span class="hx-k">' + esc(key) + '</span>' +
                '<span class="hx-v hx-type-num" data-path="' + esc(path) + '" data-type="number">' + esc(val) + '</span></div>';
        }
        var t = (Array.isArray(val)) ? 'array' : 'text';
        return '<div class="hx-row"><span class="hx-k">' + esc(key) + '</span>' +
            '<span class="hx-v hx-type-' + t + '" data-path="' + esc(path) + '" data-type="' + t + '">' +
            (Array.isArray(val) ? (val.length ? val.map(function (x) { return '<span class="hx-chip">' + esc(x) + '</span>'; }).join('') : '<span class="hx-empty">空</span>') : (val === '' || val == null ? '<span class="hx-empty">—</span>' : esc(val))) +
            '</span></div>';
    }

    function renderFields(obj, basePath) {
        if (!isPlainObject(obj)) return '';
        var html = '';
        Object.keys(obj).forEach(function (k) {
            var v = obj[k];
            var p = basePath + '/' + k;
            if (isPlainObject(v)) {
                // 嵌套子对象(非 record): 作为子卡片, 仅展开一层字段
                if (isRecordOfObjects(v)) {
                    html += renderRecordSection(k, v, p);
                } else {
                    html += '<div class="hx-card"><div class="hx-card-h">' + esc(k) + '</div>' + renderFields(v, p) + '</div>';
                }
            } else {
                html += renderFieldRow(k, v, p);
            }
        });
        return html;
    }

    // 主角状态: 始终渲染完整字段集(含金钱等数值), 缺失时回退 schema 默认值
    function fullProtagonist(ps) {
        ps = ps || {};
        return {
            '工号': (typeof ps['工号'] === 'string' && ps['工号']) ? ps['工号'] : 'HX-0001',
            '职级': (typeof ps['职级'] === 'string' && ps['职级']) ? ps['职级'] : '正式员工',
            '贡献点': (typeof ps['贡献点'] === 'number') ? ps['贡献点'] : 0,
            '个人金钱': (typeof ps['个人金钱'] === 'number') ? ps['个人金钱'] : 5000,
            '精神状态': (typeof ps['精神状态'] === 'number') ? ps['精神状态'] : 100,
            '身体状况': (typeof ps['身体状况'] === 'string' && ps['身体状况']) ? ps['身体状况'] : '健康',
            '催眠权限等级': (typeof ps['催眠权限等级'] === 'number') ? ps['催眠权限等级'] : 1,
            '已解锁成就': (Array.isArray(ps['已解锁成就']) ? ps['已解锁成就'] : []),
            '破解模式': !!ps['破解模式']
        };
    }

    function renderRecordSection(title, record, path) {
        var html = '<div class="hx-sec"><div class="hx-sec-h"><span class="hx-sec-ic">' + ICON_TEAM + '</span> ' + esc(title) + ' <span class="hx-tag">(' + Object.keys(record).length + ')</span></div>';
        var keys = Object.keys(record);
        if (!keys.length) { html += '<div class="hx-empty">暂无条目</div>'; }
        keys.forEach(function (name) {
            var entry = record[name];
            var p = path + '/' + name;
            var head = esc(name);
            // 取首个有代表性的状态字段作为角标
            var tag = '';
            if (entry && entry['催眠状态']) tag = entry['催眠状态'];
            else if (entry && entry['状态']) tag = entry['状态'];
            html += '<div class="hx-card"><div class="hx-card-h" data-detail-path="' + esc(p) + '"><span>' + head + '</span>' +
                (tag ? '<span class="hx-tag">' + esc(tag) + '</span>' : '') + '</div>' + renderFields(entry, p) + '</div>';
        });
        html += '</div>';
        return html;
    }

    function renderCategory(catKey, catObj) {
        if (!isPlainObject(catObj)) return '<div class="hx-empty">暂无数据</div>';
        // 助理管理 是 record-of-records, 走 renderFields 会自动以 record 区块渲染
        return renderFields(catObj, '/' + catKey);
    }

    function render() {
        try {
            var d = getStatData();
            var $panel = $('#hx4-p');
            if (!d) {
                // 终端未响应: 面板打开时启动 5s 自动刷新, 收到数据后清除
                if ($panel.hasClass('open') && !window.hxRefreshTimer) {
                    window.hxRefreshTimer = setInterval(function () {
                        try { if ($('#hx4-p').hasClass('open') && !isEditMode()) render(); } catch (e) {}
                    }, 5000);
                }
                return;
            }
            // 已收到数据: 清除"终端未响应"自动刷新定时器
            if (window.hxRefreshTimer) { clearInterval(window.hxRefreshTimer); window.hxRefreshTimer = null; }
            // 悬浮球摘要
            var ps = d['主角状态'] || {};
            var crack = !!ps['破解模式'];
            if (elCp) elCp.textContent = crack ? '∞' : (ps['贡献点'] == null ? '0' : ps['贡献点']);
            if (elMoney) elMoney.textContent = crack ? '∞' : (ps['个人金钱'] == null ? '0' : ps['个人金钱']);
            if (elCrack) elCrack.classList.toggle('on', crack);

            if (curTab === '主角状态') {
                if (elContent) {
                    elContent.innerHTML = '<div class="hx-sec"><div class="hx-sec-h"><span class="hx-sec-ic">' + ICON_PROFILE + '</span> 主角状态</div>' + renderFields(fullProtagonist(ps), '/主角状态') + '</div>';
                }
            } else {
                var cat = d[curTab];
                if (elContent) {
                    if (cat == null) {
                        elContent.innerHTML = '<div class="hx-empty">' + esc(curTab) + '：暂无数据</div>';
                    } else {
                        elContent.innerHTML = '<div class="hx-sec"><div class="hx-sec-h">' + esc(curTab) + '</div>' + renderCategory(curTab, cat) + '</div>';
                    }
                }
            }
        } catch (e) { console.warn('[员工终端] 渲染失败:', e.message); }
    }

    /* ===== 12. 弹窗详情 ===== */
    function openModal(title, html) {
        try {
            elModal.querySelector('#hx-mt').textContent = title;
            elModal.querySelector('#hx-mb').innerHTML = html || '<div class="hx-empty">无内容</div>';
            elModal.classList.add('open');
        } catch (e) {}
    }
    function closeModal() { try { elModal.classList.remove('open'); } catch (e) {} }

    /* ===== 13. 内联编辑 ===== */
    function toggleBool(path) {
        try {
            var cur = getPath(getStatData(), path);
            setVar(path, !(cur === true));
        } catch (e) {}
    }
    function beginEdit(span) {
        try {
            var path = span.getAttribute('data-path');
            var type = span.getAttribute('data-type') || 'text';
            if (!path) return;
            if (type === 'array') return; // 数组暂不支持内联编辑
            var cur = getPath(getStatData(), path);
            if (type === 'number') cur = (typeof cur === 'number') ? cur : 0;
            else cur = (cur == null ? '' : String(cur));
            var input = document.createElement('input');
            input.className = 'hx-edit-input';
            input.value = cur;
            span.innerHTML = '';
            span.appendChild(input);
            input.focus();
            input.select();
            var commit = function () {
                var raw = input.value;
                var val = (type === 'number') ? (Number(raw)) : raw;
                if (type === 'number' && !isFinite(val)) val = 0;
                setVar(path, val);
            };
            input.addEventListener('keydown', function (e) {
                if (e.key === 'Enter') { e.preventDefault(); commit(); }
                else if (e.key === 'Escape') { e.preventDefault(); render(); }
            });
            input.addEventListener('blur', function () { commit(); });
        } catch (e) {}
    }

    /* ===== 14. 事件 ===== */
    function bindHxEvents() {
        try {
            elCard.addEventListener('click', function () {
                if (isMobile()) { elPanel.style.cssText = 'left:0;right:0;top:auto;bottom:0;width:100vw;max-width:100vw;margin:0;display:flex'; }
                elCard.classList.add('open');
                elPanel.classList.add('open');
                fitToViewport();
                render();
            });
            elClose.addEventListener('click', function (e) {
                e.stopPropagation();
                elPanel.classList.remove('open');
                elCard.classList.remove('open');
            });
            elRefresh.addEventListener('click', function (e) { e.stopPropagation(); render(); });
            elTheme.addEventListener('click', function (e) {
                e.stopPropagation();
                var cur = getTheme();
                var idx = THEME_ORDER.indexOf(cur);
                var next = THEME_ORDER[(idx + 1) % THEME_ORDER.length];
                setTheme(next);
            });
            elCrack.addEventListener('click', function (e) {
                e.stopPropagation();
                toggleBool('/主角状态/破解模式');
            });
            elModal.querySelector('#hx-mx').addEventListener('click', function (e) { e.stopPropagation(); closeModal(); });
            elModal.addEventListener('click', function (e) { if (e.target === elModal) closeModal(); });

            // 内容区: 布尔切换 + 文本/数值双击编辑 + 卡片点击看详情
            elContent.addEventListener('click', function (e) {
                var b = e.target.closest('.hx-bool');
                if (b) { e.stopPropagation(); toggleBool(b.getAttribute('data-path')); return; }
                var cardH = e.target.closest('.hx-card-h[data-detail-path]');
                if (cardH) {
                    e.stopPropagation();
                    var p = cardH.getAttribute('data-detail-path');
                    var name = cardH.querySelector('span').textContent;
                    var obj = getPath(getStatData(), p);
                    openModal(name, renderFields(obj, p));
                }
            });
            elContent.addEventListener('dblclick', function (e) {
                var v = e.target.closest('.hx-v');
                if (v && !v.classList.contains('hx-bool')) { e.stopPropagation(); beginEdit(v); }
            });

            // 拖拽(悬浮球 / 面板头部)
            var dragging = false, sx = 0, sy = 0, ix = 0, iy = 0;
            function startDrag(e) {
                var t = e.touches ? e.touches[0] : e;
                dragging = true;
                sx = t.clientX; sy = t.clientY;
                var r = elCard.getBoundingClientRect();
                ix = r.left; iy = r.top;
                elCard.style.right = 'auto'; elCard.style.bottom = 'auto';
                elCard.style.left = ix + 'px'; elCard.style.top = iy + 'px';
                try { localStorage.setItem(HX.pos, JSON.stringify({ left: ix, top: iy })); } catch (e2) {}
                if (e.cancelable) e.preventDefault();
            }
            function onMove(e) {
                if (!dragging) return;
                var t = e.touches ? e.touches[0] : e;
                var dx = t.clientX - sx, dy = t.clientY - sy;
                elCard.style.left = (ix + dx) + 'px'; elCard.style.top = (iy + dy) + 'px';
                if (e.cancelable) e.preventDefault();
            }
            function stopDrag() { dragging = false; }
            elCard.addEventListener('mousedown', startDrag);
            elCard.addEventListener('touchstart', startDrag, { passive: false });
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', stopDrag);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', stopDrag);
            var ph = elPanel.querySelector('.hx-header');
            if (ph) {
                ph.addEventListener('mousedown', function (e) { if (e.target.closest('.hx-btn,.hx-crack')) return; startDrag(e); });
                ph.addEventListener('touchstart', function (e) { if (e.target.closest('.hx-btn,.hx-crack')) return; startDrag(e); }, { passive: false });
            }

            // 恢复上次位置 (仅当落点位于视口内, 避免陈旧/非法坐标把卡片甩到屏幕外或(0,0))
            try {
                var pos = JSON.parse(localStorage.getItem(HX.pos) || 'null');
                if (pos && typeof pos.left === 'number' && typeof pos.top === 'number') {
                    var vw2 = GS.innerWidth || document.documentElement.clientWidth || 360;
                    var vh2 = GS.innerHeight || document.documentElement.clientHeight || 640;
                    if (pos.left >= 0 && pos.top >= 0 && pos.left <= vw2 - 40 && pos.top <= vh2 - 40) {
                        elCard.style.right = 'auto'; elCard.style.bottom = 'auto';
                        elCard.style.left = pos.left + 'px'; elCard.style.top = pos.top + 'px';
                    } else {
                        try { localStorage.removeItem(HX.pos); } catch (e3) {}
                    }
                }
            } catch (e2) {}

            buildRail();
            render();

            // 监听 MVU 更新, 自动刷新(防抖版)
            var win = getMvuGlobal();
            try {
                if (win && win.Mvu && win.Mvu.events) {
                    $(document).off('VARIABLE_UPDATE_ENDED.hx4');
                    $(document).on('VARIABLE_UPDATE_ENDED.hx4', debouncedRender);
                    var evtName = win.Mvu.events.VARIABLE_UPDATE_ENDED;
                    if (evtName && typeof eventOn === 'function') eventOn(evtName, debouncedRender);
                }
                // 酒馆原生事件: 删楼层/切 swipe/切聊天 → MVU 快照回退或切换, 需刷新
                // ★ 角色切换检测: 在 CHAT_CHANGED 时判断当前角色 ID 是否变化
                //   若已切换到其他角色, 彻底自销毁 + 停止 DOM 守护, 不再自我复活
                var _getCharId = function () {
                    try {
                        var sCtx = (GS.SillyTavern && typeof GS.SillyTavern.getContext === 'function') ? GS.SillyTavern.getContext() : null;
                        if (sCtx) return sCtx.characterId || (sCtx.character && sCtx.character.avatar) || null;
                    } catch (e) {}
                    try { return (GS.characterId != null ? GS.characterId : (GS.this_chid != null ? GS.this_chid : null)); } catch (e2) {}
                    return null;
                };
                var _initCharId = _getCharId();
                if (typeof tavern_events !== 'undefined') {
                    if (tavern_events.MESSAGE_DELETED && typeof eventOn === 'function') eventOn(tavern_events.MESSAGE_DELETED, debouncedRender);
                    if (tavern_events.MESSAGE_SWIPED  && typeof eventOn === 'function') eventOn(tavern_events.MESSAGE_SWIPED,  debouncedRender);
                    if (tavern_events.CHAT_CHANGED && typeof eventOn === 'function') {
                        eventOn(tavern_events.CHAT_CHANGED, function () {
                            try {
                                var _nowId = _getCharId();
                                if (_initCharId && _nowId && _initCharId !== _nowId) {
                                    // 角色已切换: 彻底清理, 停止守护
                                    try { _cleanup(); } catch (eC) {}
                                    if (window.hxGuardTimer) { clearInterval(window.hxGuardTimer); window.hxGuardTimer = null; }
                                    try { console.log('%c[员工终端] 角色已切换, 终端已自销毁', 'color:#f59e0b'); } catch (eLog) {}
                                    return;
                                }
                            } catch (eChk) {}
                            debouncedRender();
                        });
                    }
                }
            } catch (e) {}
        } catch (e) { console.warn('[员工终端] 事件绑定失败:', e.message); }
    }
    bindHxEvents();

    // DOM守护定时器: 球/面板被移除则重建
    window.hxGuardTimer = setInterval(function () {
        if (!document.getElementById('hx4') || !document.getElementById('hx4-p')) {
            try { initHxDOM(); bindHxEvents(); } catch (e) {}
        }
    }, 15000);
    try { (window.parent || window).__悬浮球状态栏_loaded__ = true; } catch (e) { window.__悬浮球状态栏_loaded__ = true; }

    /* ===== 15. 离开清理 ===== */
    try {
        var _cleanup = function () {
            ['hx4', 'hx4-s', 'hx4-p', 'hx4-m', 'hx-theme-style'].forEach(function (x) {
                var e = document.getElementById(x);
                if (e && e.parentNode) e.parentNode.removeChild(e);
            });
        };
        if (GS.addEventListener) GS.addEventListener('beforeunload', _cleanup);
        setTimeout(function () {
            try {
                var obs = new MutationObserver(function () {
                    try {
                        var card = document.getElementById('hx4');
                        if (!card) { obs.disconnect(); return; }
                        if (card.parentNode !== document.body) { _cleanup(); obs.disconnect(); }
                    } catch (e) {}
                });
                var chatEl = document.querySelector('.chat, #chat, [id*="chat"]');
                if (chatEl) obs.observe(chatEl, { childList: true, subtree: true });
            } catch (e2) {}
        }, 2000);
    } catch (e3) {}

    try { console.log('%c[员工终端] ✅ 环晓科技 员工终端 v2 就绪', 'color:#5fd0ff;font-weight:bold'); } catch (e) {}
})();

 } catch(e){ console.error('%c[悬浮球状态栏] 运行异常','color:red', e); }
})();
