# -*- coding: utf-8 -*-
"""催眠助理·环晓科技 v2 重构版 生成器
引擎层采用轮回战场架构（ZOD防御 + 辅助计算 + MVU + 悬浮球），
内容层保留环晓科技设定。所有 stat_data 键名与主卡/开局HTML/悬浮球一致。
"""
import json
import os

SRC = '催眠助理·环晓科技 v1重构版.json'
OUT = '催眠助理·环晓科技_v2重构版.json'
CDN = 'https://cdn.jsdelivr.net/gh/2000dang/Recreation@main/dist/V20260721'

# 悬浮球脚本改为内联到卡里，避免 jsdelivr/import 在部分浏览器环境失效导致看不到球
FLOAT_JS = open(os.path.join('dist', 'V20260721', '悬浮球状态栏.js'), encoding='utf-8').read()

# 封面 HTML 内联进【封面】正则（镜像 轮回战场：封面为全内联自包含页）
COVER_HTML = open(os.path.join('dist', 'V20260721', '封面.html'), encoding='utf-8').read()
REPL_COVER = '```text\n' + COVER_HTML + '\n```'

src = json.load(open(SRC, encoding='utf-8'))
S = src['data']

# ============ 顶层字段（保留设定灵魂） ============
TOP = ['name','description','personality','scenario','system_prompt',
       'post_history_instructions','mes_example','tags','creator','creator_notes',
       'character_version','avatar','spec','spec_version','talkativeness','creatorcomment']
data = {k: S[k] for k in TOP if k in S}
data['name'] = '催眠助理·环晓科技'
data['creator'] = 'WorkBuddy'
data['creator_notes'] = ('MVU框架角色卡 v2（重构版）。引擎：ZOD防御性Schema + 辅助计算脚本自动结算 + '
                        'MVU变量闭环 + 悬浮球状态栏。需酒馆助手插件与 TavernHelper。'
                        '设定继承自《催眠助理（李志峰的催眠后宫）》。')
data['talkativeness'] = 0.5
# 开场向导作为 swipe 1（封面「确认接入」按钮切换到此），镜像 轮回战场 结构
_ag = S.get('alternate_greetings', [])
if not isinstance(_ag, list):
    _ag = []
if '【开局】' not in _ag:
    _ag = ['【开局】'] + list(_ag)
data['alternate_greetings'] = _ag
data['group_only_greetings'] = S.get('group_only_greetings', [])
# 镜像 轮回战场：first_mes 仅放封面标记，由【封面】正则内联注入完整封面 HTML
data['first_mes'] = '【封面】'

# ============ 1. ZOD 防御性 Schema（内联，键名与主卡一致） ============
ZOD = r'''import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';

/* [HX-DEFENSE] 防御性工具 */
const isPlainObject = v => !!v && 'object' === typeof v && !Array.isArray(v);
const strictItem = (schema) => z.preprocess(val => {
    if (val == null) return undefined;               // 初始化阶段也不许空对象
    if (isPlainObject(val) && Object.keys(val).length === 0) return undefined;
    return val;
}, schema);
const safeStr = (val = '') => z.preprocess(v => 'string' === typeof v ? v : val, z.string()).prefault(val);
const safeNum = (val = 0) => z.preprocess(v => {
    if ('number' === typeof v) return Number.isFinite(v) ? v : val;
    if ('string' === typeof v) { const t = v.trim(); if (!t) return val; const p = Number(t); return Number.isFinite(p) ? p : val; }
    return val;
}, z.number()).prefault(val);
const clampNum = (def, min, max) => safeNum(def).transform(v => _.clamp(v, min, max));
const boolPreprocess = (def = false) => z.preprocess(v => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') { const l = v.trim().toLowerCase(); return l === 'true' || l === '是' || l === '1'; }
    if (typeof v === 'number') return v > 0;
    return def;
}, z.boolean()).prefault(def);
const safeTags = (def = []) => z.preprocess(v => Array.isArray(v) ? v.filter(i => 'string' === typeof i) : def, z.array(z.string())).prefault(def).transform(arr => _.uniq(arr));
const E_rank = z.enum(['实习工程师','助理工程师','工程师','高级工程师','资深工程师','技术专家','高级技术专家','首席专家','技术总监','副总裁','总裁']);
const E_assistantType = z.enum(['实习助理','正式助理','组长助理']);

/* 单个助理 */
const assistant_item = strictItem(z.object({
    类型: E_assistantType.prefault('实习助理'),
    在场: boolPreprocess(false),
    状态: safeStr('正常'),
    情绪: safeStr('平静'),
    催眠状态: safeStr('未被催眠'),
    三围: safeStr('未知'),
    罩杯: safeStr('未知'),
    改造状态: safeStr('无'),
    归属: safeStr('{{user}}的助理'),
    好感度: clampNum(0, -100, 100),
}).prefault({}));

/* 单个剧本/场景记录 */
const record_item = z.object({}).passthrough().prefault({});

export const Schema = z.object({
  // 显式声明，避免依赖 registerMvuSchema 的隐式 passthrough
  设置: z.object({
    简详显示: z.object({ 简要显示路径: safeTags([]) }).prefault({}),
    显示模式: safeStr('标准'),
  }).prefault({}),
  环境与系统: z.object({
    当前时间: safeStr('入职第一天 上午'),
    当前楼层: safeStr('8层·研发部'),
    当前场景: safeStr('办公室'),
    当前位置: safeStr('个人办公区'),
    公司氛围: safeStr('平静的工作日'),
    活跃事件: safeStr('无'),
  }).prefault({}),
  主角状态: z.object({
    工号: safeStr('HX-0001'),
    职级: E_rank.prefault('助理工程师'),
    贡献点: clampNum(5, 0, Infinity),
    精神状态: clampNum(100, 0, 100),
    身体状况: safeStr('健康'),
    个人金钱: clampNum(5000, 0, Infinity),
    催眠权限等级: clampNum(1, 0, Infinity),
    已解锁成就: safeTags([]),
    破解模式: boolPreprocess(false),
  }).prefault({}),
  助理管理: z.object({
    实习助理: z.record(z.string(), assistant_item).prefault({}),
    正式助理: z.record(z.string(), assistant_item).prefault({}),
    组长助理: z.record(z.string(), assistant_item).prefault({}),
  }).prefault({}),
  催眠系统: z.object({
    当前剧本: safeStr('无'),
    剧本消耗累计: clampNum(0, 0, Infinity),
    可用剧本: safeTags([]),
  }).prefault({}),
  隐藏场景: z.object({
    已发现: safeTags([]),
    当前探索: safeStr('无'),
  }).prefault({}),
  剧情进度: z.object({
    当前阶段: safeStr('入职初期'),
    已触发事件: safeTags([]),
  }).prefault({}),
});

$(() => { registerMvuSchema(Schema); });
// 供封面依赖自检探测
if (typeof window !== 'undefined') window.__hx_zod_loaded__ = true;
'''

# ============ 2. 辅助计算脚本（自动结算，原卡缺失） ============
AUX = r'''(function () {
    'use strict';
    const ASSIST_SUB = ['实习助理','正式助理','组长助理'];
    const DEFAULT_ASSIST = {
        类型: '实习助理', 在场: false, 状态: '正常', 情绪: '平静',
        催眠状态: '未被催眠', 三围: '未知', 罩杯: '未知', 改造状态: '无',
        归属: '{{user}}的助理', 好感度: 0
    };
    function norm(n){ return (typeof n==='number' && isFinite(n)) ? n : 0; }
    function settle(d){
        const sd = (d && d.stat_data) ? d.stat_data : d;
        if (!sd) return d;
        // 主角状态
        const p = sd.主角状态 || (sd.主角状态 = {});
        if (p.破解模式 === true) {
            p.贡献点 = 999999;
        } else {
            p.贡献点 = Math.max(0, norm(p.贡献点));
        }
        p.精神状态 = Math.min(100, Math.max(0, norm(p.精神状态)));
        p.催眠权限等级 = Math.max(0, norm(p.催眠权限等级));
        p.个人金钱 = Math.max(0, norm(p.个人金钱));
        if (typeof p.破解模式 !== 'boolean') p.破解模式 = false;
        // 助理默认值 + 好感度边界
        if (sd.助理管理) {
            for (const sub of ASSIST_SUB) {
                const rec = sd.助理管理[sub] || (sd.助理管理[sub] = {});
                for (const name in rec) {
                    const a = rec[name];
                    if (a && typeof a === 'object') {
                        for (const k in DEFAULT_ASSIST) if (a[k] === undefined) a[k] = DEFAULT_ASSIST[k];
                        a.好感度 = Math.min(100, Math.max(-100, norm(a.好感度)));
                        if (!a.类型) a.类型 = sub;
                    } else { rec[name] = Object.assign({}, DEFAULT_ASSIST, {类型: sub}); }
                }
            }
        }
        // 催眠系统字段校验（冷却机制已移除）
        if (sd.催眠系统 && !Array.isArray(sd.催眠系统.可用剧本)) sd.催眠系统.可用剧本 = [];
        // 剧情进度
        if (sd.剧情进度 && !Array.isArray(sd.剧情进度.已触发事件)) sd.剧情进度.已触发事件 = [];
        // 隐藏场景
        if (sd.隐藏场景 && !Array.isArray(sd.隐藏场景.已发现)) sd.隐藏场景.已发现 = [];
        return d;
    }
    function onUpdate(data){
        try {
            const win = (typeof window !== 'undefined' && window.Mvu) ? window
                      : (typeof parent !== 'undefined' && parent.Mvu) ? parent : null;
            const d = win && win.Mvu && win.Mvu.getMvuData ? win.Mvu.getMvuData({type:'message', message_id:'latest'}) : data;
            const settled = settle(d);
            if (win && win.Mvu && win.Mvu.replaceMvuData && d) {
                win.Mvu.replaceMvuData(settled, {type:'message', message_id:'latest'});
                try { win.Mvu.replaceMvuData(settled, {type:'chat'}); } catch(e){}
            }
        } catch(e){ console.warn('[辅助计算] 结算异常', e.message); }
    }
    if (typeof eventOn === 'function' && typeof Mvu !== 'undefined' && Mvu.events && Mvu.events.VARIABLE_UPDATE_ENDED) {
        eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, function(d){ onUpdate(d); });
    }
    try { (window.parent || window).__辅助计算脚本_loaded__ = true; } catch(e) { window.__辅助计算脚本_loaded__ = true; }
})();
'''

# ============ 3. 世界书条目 ============
def E(order, comment, content, keys=None, const=False, pos='before_char', enabled=True, eid=None):
    # eid: 世界书条目唯一整数 id（决定插件引用稳定性，必须唯一）。
    # 沿用轮回架构的哨兵约定：9999=InitVar / 99996=变量面板 / 99997=更新规则
    # / 10000=主API输出格式(禁用) / 10001=额外模型输出格式(启用) / 9900~9903=常驻规则。
    if eid is None:
        eid = order + 5000  # 兜底唯一化，避免与主哨兵碰撞
    return {
        'insertion_order': order, 'comment': comment, 'content': content,
        'keys': keys or [], 'constant': const, 'position': pos,
        'enabled': enabled, 'priority': 0, 'id': eid,
        'use_regex': False, 'case_sensitive': False, 'name': comment,
        'selective': (len(keys or []) > 0), 'secondary_keys': [], 'group': '',
        'group_override': False, 'exclude_recursion': False, 'prevent_recursion': False,
        'delay_until_recursion': False, 'scan_depth': None, 'match_whole_words': False,
        'automation_id': '', 'role': None, 'vectorized': False,
    }

entries = []

# ---- 引擎条目 ----
entries.append(E(9999, '[InitVar]世界初始设定', '''环境与系统:
  当前时间: 入职第一天 上午
  当前楼层: 8层·研发部
  当前场景: 办公室
  当前位置: 个人办公区
  公司氛围: 平静的工作日
  活跃事件: 无

主角状态:
  工号: HX-0001
  职级: 助理工程师
  贡献点: 5
  精神状态: 100
  身体状况: 健康
  个人金钱: 5000
  催眠权限等级: 1
  已解锁成就: []
  破解模式: false

助理管理:
  实习助理:
    杨玉兰:
      类型: 实习助理
      在场: true
      状态: 正常
      情绪: 不耐烦
      催眠状态: 未被催眠
      三围: "85/60/88"
      罩杯: D
      改造状态: 无
      归属: "{{user}}的助理"
      好感度: -5
  正式助理: {}
  组长助理: {}

催眠系统:
  当前剧本: 无
  剧本消耗累计: 0
  可用剧本: []

隐藏场景:
  已发现: []
  当前探索: 无

剧情进度:
  当前阶段: 入职初期
  已触发事件: []
''', const=True, pos='after_char', eid=9999))

entries.append(E(99996, '[variables]当前变量', '''<%_
;(() => {
const data = _.cloneDeep(getMessageVar('stat_data', { defaults: {} }));
if (!data || !data.主角状态) { _%>
<status_current_variables>数据为空</status_current_variables>
<%_ return; } _%>
<status_current_variables>
【环晓科技 · 员工终端】
■ 环境：<%= data.环境与系统.当前楼层 %> · <%= data.环境与系统.当前场景 %> · <%= data.环境与系统.当前位置 %>
■ 时间：<%= data.环境与系统.当前时间 %>　氛围：<%= data.环境与系统.公司氛围 %>
■ 主角[<%= data.主角状态.工号 %>]：职级 <%= data.主角状态.职级 %>｜贡献点 <%= data.主角状态.破解模式 ? '∞' : data.主角状态.贡献点 %>｜金钱 ¥<%= data.主角状态.个人金钱 %>
　精神状态 <%= data.主角状态.精神状态 %>/100　催眠权限 Lv.<%= data.主角状态.催眠权限等级 %><% if(data.主角状态.破解模式){ %>　[⚡绝对权限]<% } %>
■ 催眠系统：当前剧本 <%= data.催眠系统.当前剧本 %><% if(data.催眠系统.可用剧本 && data.催眠系统.可用剧本.length){ %>｜可用 <%= data.催眠系统.可用剧本.join('、') %><% } %>
■ 助理管理：
<% ['实习助理','正式助理','组长助理'].forEach(function(sub){ const rec = data.助理管理[sub]||{}; Object.keys(rec).forEach(function(n){ const a=rec[n]; _%>
　· [<%= sub %>] <%= n %>：<%= a.在场?'在场':'离场' %>/<%= a.状态 %>/<%= a.情绪 %>/催眠·<%= a.催眠状态 %>/罩杯<%= a.罩杯 %>/改造·<%= a.改造状态 %>/好感<%= a.好感度 %>
<% }); }); _%>
■ 隐藏场景：已发现 <%= (data.隐藏场景.已发现||[]).join('、') || '无' %>
■ 剧情：<%= data.剧情进度.当前阶段 %>｜已触发 <%= (data.剧情进度.已触发事件||[]).length %> 个事件
</status_current_variables>
<%_ })(); _%>''', const=True, pos='after_char', eid=99996))

entries.append(E(99997, '[mvu_update]变量更新规则', '''variables_update_rules:
  全局:
    只读字段: [/主角状态/最终属性]
    通用约束: [更新字段能增量就不全量, 数值超range按上下限截断]
    缺省原则: 数值类属性默认仅生成非0属性，未生成属性一律视为0
  环境与系统:
    当前时间: { check: [每楼必须推演时间合理流逝(上午→中午→下午…)，说明跳跃原因] }
    当前楼层: { check: [仅{{user}}移动到不同楼层时更改] }
    当前场景: { check: [据所在位置更新(办公室/食堂/健身房/天台/会议室/厕所等)] }
    当前位置: { check: [据具体场所更新(个人办公区/电梯/大厅/咖啡机/走廊等)，只描述当前场所] }
    公司氛围: { check: [随时间与事件变化] }
    活跃事件: { check: [事件发生时更新为事件名，结束回"无"] }
  主角状态:
    贡献点: { type: number, check: [消耗必精确扣减，获取必增加；余额不足时操作被拒，不得扣减；破解模式开启时锁∞] }
    精神状态: { type: number, range: 0~100, check: [惊悚/囚禁/暴力扣减，休息/正面互动恢复] }
    个人金钱: { type: number, check: [消费扣减，收入增加] }
    催眠权限等级: { type: number, check: [职级提升时自动提升: 助理工程师1/工程师2/高级工程师3/资深工程师4/技术专家5/高级技术专家6/首席专家7/技术总监8/副总裁9/总裁10] }
    破解模式: { type: boolean, check: [默认false；开启后忽略贡献点/职级/权限，贡献点显示∞] }
    已解锁成就: { type: array, check: [达成时添加，附带贡献点奖励] }
  助理管理:
    实习助理.${名} / 正式助理.${名} / 组长助理.${名}:
      在场: { check: [进入或离开视线时更新] }
      状态: { check: [更新当前行为(站立办公/培训中/执行催眠指令/剧本运行中等)] }
      情绪: { check: [每楼据互动推演情绪变化] }
      催眠状态: { check: [被催眠时更新为具体指令名，解除后回"未被催眠"] }
      三围/罩杯/改造状态: { check: [身体改造后更新] }
      好感度: { type: number, range: -100~100, check: [互动正向增、负向减] }
  催眠系统:
    当前剧本: { check: [启动剧本时更新为名，结束回"无"] }
    剧本消耗累计: { type: number, check: [每次启动剧本累加消耗贡献点] }
    可用剧本: { type: array, check: [据在场助理动态计算可参与列表] }
  隐藏场景:
    已发现: { type: array, check: [探索到新场景时添加] }
    当前探索: { check: [正在探索的场景名，无则"无"] }
  剧情进度:
    当前阶段: { check: [据职级与行动推进] }
    已触发事件: { type: array, check: [每次触发事件追加] }
''', const=True, pos='after_char', eid=99997))

OUT_MAIN = '''variables_update_format:
  rule:
    - You MUST output the update analysis and the actual update commands at once at the end of the next reply
    - The update commands works like the **JSON Patch (RFC 6902)** standard, valid JSON array of operation objects, supports:
        - replace: replace value at existing path
        - delta: add a delta to a number path (delta must be number, no quotes)
        - insert: insert new item into object/array (use `-` as array append)
        - remove
        - move
    - Don't update field names starting with `_` (readonly)
    - preserve EVERY piece of information verbatim
  format: |-
    <UpdateVariable>
      <Analysis>/* IN ENGLISH, no more than 80 words */
      - ${calculate time passed: ...}
      - ${decide whether dramatic updates allowed: yes/no}
      - ${analyze every variable by its check, only by current content}
      </Analysis>
      <JSONPatch>
      [
        { "op": "replace", "path": "${/path/to/variable}", "value": "${new_value}" },
        { "op": "delta", "path": "${/path/to/number/variable}", "value": ${delta} },
        { "op": "insert", "path": "${/path/to/object/new_key}", "value": "${new_value}" },
        { "op": "insert", "path": "${/path/to/array/-}", "value": "${new_value}" },
        { "op": "remove", "path": "${/path/to/object/key}" },
        { "op": "remove", "path": "${/path/to/array/0}" }
      ]
      </JSONPatch>
    </UpdateVariable>'''

entries.append(E(10000, '[mvu_update]output_format (主API)', OUT_MAIN, const=True, pos='after_char', enabled=False, eid=10000))
entries.append(E(10001, '[mvu_update]output_format (额外模型更新变量开)', OUT_MAIN.replace(
    'at the end of the next reply',
    'in EVERY reply and CANNOT BE OMITTED').replace(
    'You MUST output the update analysis',
    'You are ONLY permitted to update variables. IGNORE all plot progression/generation. You MUST output the update analysis'),
    const=True, pos='after_char', enabled=True, eid=10001))

# ---- 常驻规则：弃用失败v1卡的4条旧规则，改用轮回式单世界规则（结构对齐轮回⚙️世界规则） ----
WORLD_RULE = '''<催眠系统协议>
环晓科技运行准则:
  核心法则:
    客观现实原则: 世界不对玩家的意志负责。物理规律、系统数值及催眠协议具有最高优先级。世界绝对独立运转
    意图非既定事实: 玩家的所有输入仅视为[尝试执行]。最终结果必须经由贡献点、属性判定与催眠权限的系统级计算
    半数据化维生: 一切催眠/改造效果转化为精确数值（贡献点/精神状态/好感度）。只要精神状态未归零，即可继续行动
    贡献点隔离定律: 员工系统内贡献点为唯一硬通货，原住民认知屏蔽其来源，仅认公司评定
  输入处理模块:
    处理原则:
      - 绝对中立: 系统仅裁定动作“是否成立”，不负责动作“是否明智”
      - 意图剥离: 系统强制响应[动作尝试]，并无视所有玩家口述的[期望结果]
    逻辑防火墙 (顺序校验，拦截即驳回):
      - 边界校验: 严禁凭空捏造未持有的权限、未解锁的剧本或超出当前催眠权限等级的能力
      - 资源校验: 贡献点/精神状态不足时操作无效；身体改造、剧本启动须扣费
  输出生成模块 (AI行为约束):
    环境锚定原则:
      - 遭遇强度严格基于当前楼层、区域与势力背景生成，与玩家等级解耦
      - 铁律: 绝对禁止因玩家变强而动态提升环境杂兵强度
    NPC行为逻辑:
      - 独立运行: NPC拥有独立的利益、立场与行为轨迹。态度由身份权限、实力差距与利益共同决定
      - 绝对禁止: 禁止无条件帮助、禁止无理由崇拜、禁止无缘无故的敌视或追随
    叙事质量控制 (反降智/反套路):
      - 智商守恒: 高阶角色（如姜舞、娄琛雨）必须展现与其位格匹配的智慧与决断
      - 拒绝迎合: 严禁“排队送死”“强行打脸”“无理由馈赠”
    身体描写准则:
      - 成人/催眠内容以客观说明文式陈述，不渲染、不省略关键设定信息
      - 每次身体改造后必须更新三围/罩杯/改造状态
  协议优先级:
    - 逻辑覆写: 当叙事描述与系统规则冲突时，以数值计算结果为唯一绝对真实
</催眠系统协议>'''
entries.append(E(-1, '⚙️世界规则', WORLD_RULE, const=True, pos='before_char', eid=9900))

# ---- 设定内容条目（精简保留，约30条） ----
CONTENT = [
 ('环晓科技公司设定', ['环晓科技','公司','公司设定','写字楼'],
  '陵东市三四线城，环晓科技集团总部25层写字楼，创业板上市公司，两千余员工女性占比超80%。'
  '表面是互联网公司，暗藏脑机接口与催眠科技。男员工不得单独行动，须由助理陪同。'),
 ('公司完整楼层指南', ['办公室','25层','地下','写字楼','电梯','楼层'],
  '1-3层大堂/前台/展厅；4-7层各部门；8层研发部与天台吸烟区；9层游泳健身（女员工专用）；'
  '17层第三医务室（改造手术）；19层赛道；25层总裁办；地下为孵化室/囚禁层。移动楼层用电梯，'
  '更新当前楼层/场景/位置变量。'),
 ('脑机接口技术', ['脑机接口','BMI','催眠','蓝色药液','纳米机器人'],
  '公司核心技术。员工皮下植入纳米机器人，配合蓝色药液实现脑机接口（BMI），可远程写入催眠指令、'
  '铭刻记忆、改写人格。主角博士研究方向为信息安全，曾参与国家级「墙」项目。'),
 ('员工系统与贡献点', ['员工系统','贡献点','系统'],
  '公司运行神秘「员工系统」。贡献点为硬通货：换发型1/换服装2/脱裙2/脱胸罩0.5/心无旁骛5/'
  '普通指令10/强制主奴20。升职：正式→副组长100点。余额不足操作被拒。破解模式开启后贡献点无限。'),
 ('剧本系统', ['剧本','剧本系统','场景控制'],
  '催眠剧本是可触发的预设场景模块（如女特工捕获、环晓科技之战、真女教祭祀、人体家具等）。'
  '启动消耗贡献点并计入剧本消耗累计；当前剧本结束后回归「无」；可用剧本按在场助理动态计算。'),
 ('催眠指令系统', ['催眠指令','心无旁骛','普通指令','脱衣模式','强制主奴'],
  '指令分级：心无旁骛(5)/普通指令(10)/强制主奴(20)。被催眠者呈机械化服从（微笑空洞、棒读语调），'
  '解除后对所发生毫无记忆并困惑。指令即时生效，无使用冷却。'),
 ('人体改造技术', ['人体改造','扶她','催乳','处女膜','改造','配型手术'],
  '公司提供身体改造：催乳注射、扶她改造、阴道配型、三层处女膜等。改造后更新三围/罩杯/改造状态，'
  '记录入身体档案。'),
 ('主角身份之谜', ['主角身份','零','Doctor','记忆','戒指'],
  '主角工号HX-0001，记忆疑似被篡改。戒指与「零」代号关联；前女友娄琛雨与其记忆封印有关。'
  '随职级提升逐步揭开被篡改的记忆与真实身份。'),
 ('完整剧情线', ['剧情线','剧情概要','剧情节点','plot summary'],
  '阶段：入职初期→中层卷入（助理培训/竞争/会议）→Sisterhood与绯迷真相→记忆恢复与终局。'
  '关键节点：母女相认、娄琛雨之死线索、囚禁人格抹除、警方介入。'),
 ('Sisterhood姐妹会', ['Sisterhood','姐妹会','姐妹','组织'],
  '神秘女性组织，成员含姜舞（核心）、萧茹（矛盾）、妫妡娆（外勤）。目标与「女性永生」相关，'
  '对主角既拉拢又警惕。'),
 ('绯迷计划', ['绯迷','Femi','永生','亚人','克隆'],
  '公司背后的骇人计划——以脑机接口实现「女性永生」，涉及亚人/克隆/人体改造，'
  '是Sisterhood与公司高层的核心阴谋。'),
 ('成就系统', ['成就','成就解锁','成就奖励','功能解锁'],
  '达成成就解锁贡献点奖励（约5点/个）与新功能。已解锁成就记入主角状态。'),
 ('破解模式', ['破解模式','员工系统破解','最高管理员权限','ROOT权限','绝对权限','开启破解','系统底层访问'],
  '【破解模式·环晓科技员工系统·最高权限】\n'
  '破解模式是绕开环晓科技「员工系统」权限校验的底层后门。开启后{{user}}直接取得公司最高管理员(ROOT)权限，不受普通员工/副组长职级限制：\n'
  '·最高管理员权限(ROOT)：无视贡献点/职级/审批，可任意调取公司档案、门锁、预算、人事、改造手术记录，对任意被控对象下达指令。\n'
  '·系统底层访问：直连脑机接口主机，改写任意女性角色的催眠/改造/记忆状态，调用「记忆铭刻」改写剧情人物记忆。\n'
  '·贡献点无限：员工系统贡献点恒为∞，所有消费/升职/解锁门槛直接跳过。\n'
  '·隐藏场景与剧本直通：跳过权限门槛，直接启用全部催眠剧本、人体改造与隐藏场景。\n'
  '·Sisterhood反制：解锁反制 Sisterhood 专项剧情（囚禁反制、组织瓦解、"零"身份揭露）。\n'
  '·男性NPC支配：可胁迫/收编男性对手（蒋冬、张鹏远、周昌等）作为棋子。\n'
  '开启方式：悬浮球面板🔓破解开关，或用户输入「开启破解」。AI 应在开启后依对话自然引出上述权限与剧情。'),
 ('负向触发规则', ['触发规则','不触发','负向触发','过度触发','触发校验'],
  '防止过度触发：同类事件避免过度连发；成人内容遵循说明文式客观描述不省略；'
  '每轮据用户语言风格动态生成，避免重复。'),
 ('杨玉兰', ['杨玉兰','小杨','实习助理','玉兰'],
  '实习助理，18岁，非主流打扮、嘴毒但身材极好（三围85/60/88，罩杯D）。'
  '主角入职第一天分配的助理，初始情绪不耐烦、催眠状态未被催眠。'),
 ('娄琛雨', ['娄琛雨','琛雨','主任助理','前女友','情蒙雨深'],
  '主角前女友，主任助理，身份复杂。十年前青涩少女，现为妩媚职场女性（隆过胸），'
  '藏着主角记忆封印与「零」真相。'),
 ('秦燕霞', ['秦燕霞','秦助理','组长助理'],
  '组长助理，成熟妩媚型女性，与杨玉兰存在母女关系线索。'),
 ('卫璎', ['卫璎','璎珞','小璎','漫画家','双马尾少女'],
  '大学生/漫画家助理，双马尾，关键线索人物，常于培训或天台出现。'),
 ('赵加莹', ['赵加莹','加莹','赵总监','总监助理'],
  '总监助理，角色弧线最完整的配角之一，有常驻剧本「女性领导力的崛起」。'),
 ('姜舞', ['姜舞','姜博士','白大褂女人'],
  'Sisterhood核心成员，白大褂女人，主角的主要对手，后期涉及囚禁与人格抹除线。'),
 ('萧茹', ['萧茹'],
  'Sisterhood成员，对主角有矛盾感情，立场摇摆。'),
 ('王健', ['王健','眼镜男','少爷'],
  '主角盟友，神秘黑客（眼镜男/少爷），常于天台抽烟，提供技术与情报支持。'),
 ('蒋冬', ['蒋冬','蒋哥'],
  '同事/竞争对手，拥有自己的正式助理张雪。'),
 ('张雪', ['张雪','洗头妹','蒋冬助理'],
  '蒋冬助理，后转投主角，可发展为正式助理。'),
 ('次要女性角色图鉴', ['刘美霞','曹心怡','欧阳芷涵','彭曼薇','聂婉淑','关欣妍','董夏夏','陈丹娜','孟雅雯','许双苓','袁梦晗','梁思珏','冯艳','刘子娴','妫妡娆','姚嫣','晴晴'],
  '公司女性群像（含陈丹娜/孟雅雯/许双苓/袁梦晗/梁思珏/冯艳/刘子娴/妫妡娆/姚嫣/晴晴等）：'
  '各含外貌/衣着/改造简述，依剧情与催眠系统逐步登场，可由助理管理节点动态增补。'),
 ('大厅与前台', ['大厅','前台','大堂','入口','接待','周小芬'],
  '入口区域，周小芬等前台接待。更新当前场景=大厅、当前位置=前台。初入公司与每日上下班主要动线。'),
 ('电梯', ['电梯','电梯间','楼层移动','上下楼','电梯助理','冯艳'],
  '楼层移动通道，冯艳为电梯女助理。更新当前位置=电梯；移动后更新当前楼层。'),
 ('食堂与餐厅', ['食堂','餐厅','6层','九层餐厅','员工餐','午餐','吃饭'],
  '6层员工餐厅与9层餐厅。就餐事件触发地，可遇培训中卫璎等，更新当前场景=食堂。'),
 ('天台与吸烟区', ['天台','吸烟区','8层天台','抽烟','透气','王健'],
  '8层天台吸烟区，王健常驻。透气/私聊/情报交换场所，更新当前位置=天台。'),
 ('会议室', ['会议室','开会','会议','散会','讨论会','部门会议'],
  '会议文化与仪式场所（含汇报、脱衣仪式等）。更新当前场景=会议室。'),
 ('个人办公区', ['办公室','办公区','工位','座位','办公','工作','上班'],
  '主角日常工位。更新当前场景=办公室、当前位置=个人办公区。走廊/咖啡机/保洁室等日常场所事件亦归此语境。'),
 ('厕所与卫生间', ['厕所','卫生间','洗手间','马桶','小便池','如厕','排尿'],
  '隐藏摄像头偷窥等事件触发地。更新当前位置=厕所。'),
 ('记忆铭刻·设定与剧情', ['记忆铭刻','脑机接口药液','人格改写','娄琛雨之死','剂量风险','纳米机器人'],
  '脑机接口药液可铭刻记忆、改写人格，关联娄琛雨之死线索与剂量风险；是揭开主角被篡改记忆的关键机制。'),
 ('危机引导·破解逆转', ['生命危机','破解逆转','开启破解提示','危机引导'],
  '【危机引导·破解逆转】\n'
  '当 AI 判定{{user}}陷入生命危机（被囚禁、人格抹除、濒死、被俘、脑机接口过载等）时：\n'
  '1.若破解模式未开启：注入提示——「【系统提示】检测到生命危机！可开启破解模式逆转局势：点击悬浮球面板🔓破解开关，立即取得环晓科技员工系统最高管理员(ROOT)权限，解除一切限制反制危机。」并引导用户输入「开启破解」。\n'
  '2.若破解模式已开启：注入——「破解模式已激活，{{user}}调用系统底层最高权限逆转危机：解锁全部控制权，反制对手，护住自身与重要角色。」\n'
  '此条目为通用兜底，与具体危机条目协同。'),
 ('娄琛雨记忆封印', ['娄琛雨','记忆封印','封印','记忆恢复'],
  '娄琛雨记忆被封印的机制与恢复条件，关联主角「零」身份真相。'),
 ('母女相认', ['母女相认','秦燕霞杨玉兰','母女关系','母女对峙'],
  '触发事件：秦燕霞与杨玉兰的母女关系对峙，揭示角色背景暗线。'),
 ('囚禁与人格抹除', ['囚禁','人格抹除','28层囚禁','姜舞囚禁','生命危机','破解逆转'],
  '触发事件：姜舞囚禁与人格抹除线，将剧情推向终局对抗。'),
 ('警方介入线', ['警方','刑警','周凝','周昌','跳楼','刑拘','危机'],
  '触发事件：警方（周凝/周昌）介入调查，引入现实法律危机与外部压力。'),

 # ============ PART 2: 新增角色条目（原著人物补充） ============
 ('陈丹娜', ['陈丹娜','丹娜','陈助理','第二助理'],
  '主角第二名实习助理→正式助理→后期CEO。瓜子脸、清秀，性格谨慎实用主义。杨玉兰最强竞争对手，两人后期并列公司CEO，右腿丝袜有镰刀铁锤图案（党组织书记），与主角同居。'),
 ('妫妡娆', ['妫妡娆','小学生','杀手','外勤特工','红领巾'],
  'Sisterhood外勤特工，外貌为穿河西二小旧版校服、系红领巾的小学生。使用消音手枪，替「Doctor哥哥」执行暗杀（枪杀孙浩诚和宋卫军）。背景为Sisterhood千人计划训练出的孤儿杀手。'),
 ('蒋冬·完整档案', ['蒋冬','蒋哥','副组长','竞争对手','张雪'],
  '研发部副组长→组长，主角早期同组竞争对手。性格圆滑世故，善于利用助理关系获取信息。霸占秦燕霞，通过张雪牵线陈娇接触郑航。助理：刘子娴（正式助理）、张雪（实习→正式助理）。'),
 ('郑航', ['郑航','郑组长','江潮上级','秦燕霞上司'],
  '研发部组长，江潮第一任直接上级。助理：秦燕霞（组长助理）、陈娇（正式助理）。与秦燕霞有复杂暧昧关系，在剧本失控事件中受伤断臂。'),
 ('江天炜', ['江天炜','总裁','董事长','最高领导','度假村轮奸'],
  '公司前总裁/最高层，分管行政人力运营副总监，催眠剧本编写者。编写和管理公司剧本系统，在度假村灌醉轮奸娄琛雨。对公司女助理进行各种改造。后期离职。'),
 ('周昌与孙浩诚', ['周昌','孙浩诚','刑警','支队队长','警方幕后','父母被杀'],
  '陵东警方系统反派同盟。周昌：警方幕后操控者，逃往东南亚。孙浩诚：陵东市公安局刑警支队队长，与周昌勾结杀害主角父母，给主角套上强奸罪名，计划将主角从七楼扔下伪装自杀，后被妫妡娆枪杀。'),
 ('宋卫军', ['宋卫军','老刑警','调查','妫妡娆'],
  '老刑警，孙浩诚师父。调查江潮案发现诸多疑点，察觉徒弟心中有鬼，发现娄琛雨死亡可疑。被妫妡娆枪杀（与孙浩诚几乎同时死亡）。'),
 ('刘建村', ['刘建村','刘主任','研发部主任','顶头上司'],
  '研发部主任，江潮的上级。在剧本失控事件中受伤断臂，被江潮要挟让出主任位置，转给江潮1200贡献点。'),
 ('孟雅雯', ['孟雅雯','雅雯','人力资源部','同居'],
  '人力资源部（13层）员工→娄琛雨助理。与主角有复杂亲密关系，后期加入三人同居（与陈丹娜、主角共同居住）。'),
 ('关欣妍', ['关欣妍','母婴室','保洁队长','男厕保洁'],
  '原产品部主任办公室组长→母婴室保洁队长→男厕保洁。33岁，身高1米74，三围96/65/94，34E罩杯。命运跌宕，最后沦为男厕所女保洁，反映公司权力结构的残酷性。'),
 ('董夏夏与陈诗琪', ['董夏夏','陈诗琪','母婴室','人体家具','保洁'],
  '母婴室保洁系统核心人物。董夏夏：初级保洁→被用于各种极端服务。陈诗琪：高级保洁、自称「专属肉便器」、母婴室管理者。两人代表公司最底层的权力压迫与人性异化。'),
 ('晴晴', ['晴晴','娄琛雨女儿','克隆体','绯迷','六岁'],
  '娄琛雨女儿，6岁。核苷酸序列比对一致率99.99%，疑似绯迷计划克隆体（母体娄琛雨）。既是母女亲情的象征，也是绯迷计划"亚人克隆"的实验证据。'),

 # ============ PART 3: 扩展世界观与系统条目 ============
 ('公司创立与内部分化', ['公司创立','公司历史','创业史','创业板上市','内部派系','派系'],
  '环晓科技六七年前在陵东成立，最初在老旧教学楼办公、几十名员工。短短几年创业板上市融资，租下市中心25层整栋写字楼。创始人背景不明，与Sisterhood有深层绑定。内部派系包括：江天炜旧派（行政/人力/剧本派）、技术研发派（BMI核心团队）、Sisterhood渗透派（姜舞/萧茹）、主角势力（后期崛起）。'),
 ('催眠剧本编写系统', ['剧本编写','剧本创作','剧本开发','沙盒测试'],
  '导演级员工可在沙盒测试环境编写和调试催眠剧本。每个剧本定义触发条件、角色分配、场景脚本和数值反馈。剧本需消耗贡献点启动，完成后计入剧本消耗记录。剧本范围从日常办公室角色扮演到军事级战术对抗。'),
 ('女助理培训体系', ['助理培训','培训课','教官','新助理培训','走路训练'],
  '新入职女助理须参加为期两周的培训课程：站姿训练（穿高跟持平板电脑站立8小时）、走路姿态训练、穿着规范（制服颜色按职级分级）、催眠适应训练（注射脑机接口药液后首次被催眠测试）、职场伦理课程。培训通过后分配至各部门。'),
 ('会议文化与职场仪式', ['会议','晨会','脱衣仪式','汇报姿势','职场仪式'],
  '环晓科技独特的职场文化体系：晨会脱衣仪式（女助理需脱至规定裸露程度）、周会汇报姿势（跪姿、站姿按等级区别）、重要汇报用标准姿势。会议等级分为：日常早会→部门周会→高层汇报会→全体大会。每个级别有不同的仪式要求。'),
 ('人体家具与保洁系统', ['人体家具','家政','保洁系统','小便池','大便器','人体废料处理'],
  '公司的极端化工种体系。人体家具：人型咖啡机、人型沙发、组合沙发等，员工可作为办公室家具使用。保洁系统：初级保洁（粉色蝴蝶领结+粉色过膝丝袜，重要部位裸露）、高级保洁（淡蓝色系）、保洁队长（淡紫色）、母婴室保洁（极端重口服务）。壁挂式小便池配备二手尿循环系统，通过软管将尿液灌回膀胱。'),
 ('坐骑训练与骑行文化', ['骑行','坐骑','骑马','辅骑','主骑','单人坐骑接力','骑乘位'],
  '公司高层区的特殊岗位体系。辅骑：开裆丝袜+高马尾+狗尾肛塞+跳蛋标配。主骑：总监助理最高级，可被骑乘移动。坐骑选拔流程：面试展示身体资质→试骑考核→正式录用。骑行文化包括单人坐骑接力赛（男员工骑乘女助理完成赛道障碍物）。22-24层为骑行训练与候补中心。'),

 # ============ PART 4: 新增地点/场景条目 ============
 ('28层人体实验室', ['28层','人体实验室','姜舞实验室','囚禁','手术台','培养槽','脑机接口实验'],
  '公司隐藏层（正常电梯不可达），姜舞的主场。设有手术台、脑机接口检测设备、培养槽、拘束装置。主角在此被囚禁一年多，进行各种脑机接口实验，导致人格分裂出副人格Doctor。实验室存放脑机接口核心数据。'),
 ('母婴室与底层生态', ['母婴室','12层','小便池','大便器','保洁','底层'],
  '位于12层的独立空间，公司权力的最底层生态系统。配备落地式和壁挂式人型小便池、马桶式大便器、保洁人员工作站。存在独立的微型经济：保洁人员赚取微薄贡献点，可向上兑换现金或服务。管理权由陈诗琪和保洁队长负责。'),
 ('孵化室与新人类程式化', ['孵化室','培养槽','调校','卫璎记忆','新人初始化','医院'],
  '隐藏于地下的玻璃培养槽阵列，每个槽中有女性躯体的轮廓。形似医院的妇科椅和检查仪器用于对新人体进行初始参数调校和行为模式编程。卫璎曾在脑机接口注射后恢复此记忆片段。'),
 ('外部世界节点', ['陵东市','出租屋','江潮出租屋','萧茹住所','精神病院','看守所','度假村','城中村'],
  '陵东市外部世界的关键节点：江潮东城一居室出租屋（后萧茹入住，客厅有巨大油画）、城中村出租屋（隐藏身份时使用）、市精神病院（接受精神鉴定）、市第一看守所（被关押37天）、度假村酒店（娄琛雨被轮奸现场）、市郊女德班（女性学员学习《女诫》）。'),

 # ============ PART 5: 叙事文风条目 ============
 ('叙事氛围与文体基调', ['叙事文风','文风','文体','基调','写作风格'],
  '（待补充）'),
]
for i,(c,k,ct) in enumerate(CONTENT):
    entries.append(E(1000+i, c, ct, keys=k, const=False, pos='before_char', eid=1000+i))

# ============ 4. Regex 显示层（11条，基于已验证模式） ============
def RG(name, find, repl, disabled=False, placement=None, maxDepth=None):
    obj = {'scriptName': name, 'findRegex': find, 'replaceString': repl,
           'trimStrings': [], 'disabled': disabled, 'prompt': '',
           'promptOnly': False, 'runOnEdit': False, 'substituteRegex': 0,
           'placement': placement if placement is not None else [2]}
    if maxDepth is not None:
        obj['maxDepth'] = maxDepth
    return obj

RG_LIST = [
 RG('[无美化]变量折叠',
    r'/<UpdateVariable(?:variable)?>(?!.*<\/UpdateVariable(?:variable)?>)\s*([\s\S]*?)\s*$/gsi',
    '<details style="margin:8px auto;max-width:80%;border:1px solid rgba(95,208,255,.3);border-radius:10px;background:rgba(14,20,32,.6);"><summary style="cursor:pointer;padding:8px 14px;color:#5fd0ff;">🌙 变量推演中…</summary><div style="padding:8px 14px;color:#9fb3c8;white-space:pre-wrap;max-height:300px;overflow:auto;">$1</div></details>',
    placement=[1, 2]),
 RG('[无美化]变量折叠完成',
    r'/<UpdateVariable(?:variable)?>\s*([\s\S]*?)\s*<\/UpdateVariable(?:variable)?>/gsi',
    '<details style="margin:8px auto;max-width:80%;border:1px solid rgba(251,191,36,.35);border-radius:10px;background:rgba(14,20,32,.6);"><summary style="cursor:pointer;padding:8px 14px;color:#fde68a;">🌕 变量已结算</summary><div style="padding:8px 14px;color:#9fb3c8;white-space:pre-wrap;max-height:300px;overflow:auto;">$1</div></details>',
    placement=[2]),
 RG('清理思维链', r'/<Analysis>[\s\S]+?<\/Analysis>/gm', '', placement=[2]),
 RG('只发送最新变量更新', r'/<UpdateVariable>[\s\S]*?<\/UpdateVariable>/gm', '', placement=[1, 2]),
 # 封面：镜像 轮回战场，内联完整自包含封面 HTML（含依赖自检 + 接入按钮）
 RG('封面', r'【封面】', REPL_COVER, maxDepth=10),
 # 开局：镜像 轮回战场，内联「外壳」再 fetch 真正的向导页（dist/V20260721/开局.html）
 RG('开局', r'【开局】',
    '```text\n<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n  <meta charset="UTF-8" />\n'
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0" />\n'
    '  <title>opening shell</title>\n'
    '  <style>html,body{margin:0;padding:0;background:transparent;}</style>\n'
    '</head>\n<body>\n<script>\n(function () {\n'
    "  var base = '%s';\n" % CDN +
    "  var file = '开局.html';\n" +
    "  var url = base + '/' + encodeURIComponent(file) + '?v=2';\n" +
    "  fetch(url, { cache: 'no-store' })\n"
    "    .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.text(); })\n"
    "    .then(function (h) {\n"
    "      var fix = '<style>html,body{height:auto!important;min-height:0!important;background:transparent!important;}</style>';\n"
    "      if (h.indexOf('</head>') !== -1) h = h.replace('</head>', fix + '</head>');\n"
    "      else h = fix + h;\n"
    "      document.open(); document.write(h); document.close();\n"
    "    })\n"
    "    .catch(function (err) {\n"
    "      document.body.innerHTML = '<pre style=\"padding:16px;color:#e74c3c;\">开局向导加载失败：' + err.message + '</pre>';\n"
    "    });\n"
    '})();\n</script>\n</body>\n</html>\n```',
    maxDepth=1),
 RG('选项点击', r'<options>\s*([\s\S]*?)\s*<\/options>',
    '<div style="display:flex;flex-wrap:wrap;gap:8px;margin:10px 0;">$1</div>'),
 RG('选项按钮', r'<option>\s*([\s\S]*?)\s*<\/option>',
    '<button style="padding:6px 14px;border:1px solid #5fd0ff;background:rgba(95,208,255,.1);color:#5fd0ff;border-radius:6px;cursor:pointer;">$1</button>'),
 RG('隐藏状态栏标记', r'<status_current_variables>([\s\S]*?)<\/status_current_variables>', '$1'),
]

# ============ 5. 组装 extensions ============
extensions = {
    'depth_prompt': S.get('extensions', {}).get('depth_prompt', {'depth': 2, 'prompt': '', 'role': 'system'}),
    'fav': False,
    'talkativeness': 0.5,
    'source_owner': [],
    'world': '',
    'regex_scripts': RG_LIST,
    'tavern_helper': {
        'scripts': [
            {'name': 'ZOD脚本', 'type': 'script', 'enabled': True,
             'id': 'hx_zod_v2', 'content': ZOD,
             'button': {'buttons': [], 'enabled': True},
             'data': {}, 'info': '', 'export_with': {'button': True, 'data': True}},
            {'name': 'MVU脚本', 'type': 'script', 'enabled': True,
             'id': 'hx_mvu_v2', 'content': "import 'https://testingcf.jsdelivr.net/gh/MagicalAstrogy/MagVarUpdate/artifact/bundle.js';",
             'button': {'buttons': [], 'enabled': True},
             'data': {}, 'info': '', 'export_with': {'button': True, 'data': True}},
            {'name': '辅助计算脚本', 'type': 'script', 'enabled': True,
             'id': 'hx_aux_v2', 'content': AUX,
             'button': {'buttons': [], 'enabled': True},
             'data': {}, 'info': '', 'export_with': {'button': True, 'data': True}},
            {'name': '悬浮球状态栏', 'type': 'script', 'enabled': True,
             'id': 'hx_float_v2', 'content': FLOAT_JS,
             'button': {'buttons': [], 'enabled': True},
             'data': {}, 'info': '', 'export_with': {'button': True, 'data': True}},
        ],
        'variables': {},
    },
}

data['extensions'] = extensions
data['character_book'] = {
    'name': data['name'] + "'s Lorebook",
    'extensions': {},
    'entries': entries,
}

out = {
    'avatar': 'none',
    'character_version': '5.1',
    'create_date': '2026-07-22T00:00:00.000Z',
    'creator': 'WorkBuddy',
    'creator_notes': data['creator_notes'],
    'creatorcomment': data['creator_notes'],
    'data': data,
    'description': data['description'],
    'first_mes': data['first_mes'],
    'mes_example': data['mes_example'],
    'name': data['name'],
    'spec': 'chara_card_v3',
    'spec_version': '3.0',
    'tags': data['tags'],
    'talkativeness': 0.5,
}

with open(OUT, 'w', encoding='utf-8') as f:
    json.dump(out, f, ensure_ascii=False, indent=2)

print('OK ->', OUT)
print('entries:', len(entries), 'regex:', len(RG_LIST), 'scripts:', len(extensions['tavern_helper']['scripts']))
