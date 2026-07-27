import re

path = r'C:\Users\w\Desktop\mywork\Study\Recreation\dist\V20260721\悬浮球状态栏.js'
with open(path, 'r', encoding='utf-8') as f:
    js = f.read()

changes = []

# === 1. 替换 CATEGORIES: emoji -> inline SVG ===
old_cats = '''    var CATEGORIES = [
        { key: '主角状态', icon: '🪪' },
        { key: '环境与系统', icon: '🎯' },
        { key: '助理管理', icon: '👥' },
        { key: '催眠系统', icon: '🎭' },
        { key: '隐藏场景', icon: '🕳️' },
        { key: '剧情进度', icon: '📈' }
    ];'''

ICON_SVG = '''    // 内联 SVG 图标 (避免 emoji 字体兼容问题, stroke=currentColor 自动跟随主题)
    var ICON_PROFILE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 4-6 8-6s8 2 8 6"/></svg>';
    var ICON_ENV     = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.5"/><line x1="12" y1="2" x2="12" y2="5"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="2" y1="12" x2="5" y2="12"/><line x1="19" y1="12" x2="22" y2="12"/></svg>';
    var ICON_TEAM    = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3"/><circle cx="17" cy="9" r="2.5"/><path d="M3 19c0-3 3-5 6-5s6 2 6 5"/><path d="M14 18.5c0-2 2-3.5 4-3.5s4 1.5 4 3.5"/></svg>';
    var ICON_MASK    = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 8h18v3a9 9 0 0 1-18 0V8z"/><circle cx="9" cy="11.5" r="1.2"/><circle cx="15" cy="11.5" r="1.2"/><path d="M12 4.5l-1.5 2M12 4.5l1.5 2"/></svg>';
    var ICON_EYE     = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="2.5"/><line x1="5" y1="5" x2="9" y2="9"/><line x1="19" y1="5" x2="15" y2="9"/></svg>';
    var ICON_CHART   = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/></svg>';

    var CATEGORIES = [
        { key: '主角状态', icon: ICON_PROFILE },
        { key: '环境与系统', icon: ICON_ENV },
        { key: '助理管理', icon: ICON_TEAM },
        { key: '催眠系统', icon: ICON_MASK },
        { key: '隐藏场景', icon: ICON_EYE },
        { key: '剧情进度', icon: ICON_CHART }
    ];'''

if old_cats in js:
    js = js.replace(old_cats, ICON_SVG)
    changes.append('6 个分类图标: emoji -> inline SVG')
else:
    print('WARN: CATEGORIES block not found')

# === 2. CHAT_CHANGED 角色ID检测, 切换角色自销毁 ===
old_evt = '''                // 酒馆原生事件: 删楼层/切 swipe/切聊天 → MVU 快照回退或切换, 需刷新
                //    MVU 事件体系只覆盖"变量更新", 不覆盖"楼层变更", 故须补酒馆事件
                if (typeof tavern_events !== 'undefined') {
                    if (tavern_events.MESSAGE_DELETED && typeof eventOn === 'function') eventOn(tavern_events.MESSAGE_DELETED, debouncedRender);
                    if (tavern_events.MESSAGE_SWIPED  && typeof eventOn === 'function') eventOn(tavern_events.MESSAGE_SWIPED,  debouncedRender);
                    if (tavern_events.CHAT_CHANGED    && typeof eventOn === 'function') eventOn(tavern_events.CHAT_CHANGED,    debouncedRender);
                }'''

new_evt = '''                // 酒馆原生事件: 删楼层/切 swipe/切聊天 → MVU 快照回退或切换, 需刷新
                //    MVU 事件体系只覆盖"变量更新", 不覆盖"楼层变更", 故须补酒馆事件
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
                }'''

if old_evt in js:
    js = js.replace(old_evt, new_evt)
    changes.append('CHAT_CHANGED + 角色ID检测, 切换角色自销毁')
else:
    print('WARN: event setup block not found')

with open(path, 'w', encoding='utf-8') as f:
    f.write(js)

print('=== Done ===')
for i, c in enumerate(changes, 1):
    print(f'  {i}. {c}')
print(f'Size: {len(js):,} bytes')

for term in ['🪪', '🎯', '👥', '🎭', '🕳️', '📈']:
    if term in js:
        print(f'WARN emoji remains: {term}')
