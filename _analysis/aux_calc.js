// 这是一个用于数值计算和属性更新的脚本，适用于角色扮演游戏中的角色属性管理。
// 在每轮结束后自动触发，确保角色属性始终保持最新状态。
(function () {
    'use strict';
    
    /** 是否已初始化日志 */
    let isInitLog = false;
    /**
     * 防重入标志：防止脚本修改 stat_data 后触发 schema reconciliation
     * 再次进入 VARIABLE_UPDATE_ENDED 导致无限循环
     */
    let isProcessing = false;
    /**
     * 核心函数：在 stat_data 更新完成后执行，进行数值计算和属性更新
     * @param {*} rawVariables 原始变量
     * @param {*} rawVariablesBefore 之前的原始变量
     */
    function onUpdateData(rawVariables, rawVariablesBefore) {
        // 防重入：如果正在处理中，直接跳过
        if (isProcessing) {
            return;
        }
        isProcessing = true;

        try {
            /** 当前数据 */
            const statData = rawVariables?.stat_data;
            /** 之前的当前数据 */
            const statDataBefore = rawVariablesBefore?.stat_data;

            if (!statData) return;

            const users = statData.主角;
            if (!users) return;

            // ★ 先回滚受保护字段，再执行后续计算
            guardProtectedFields(statData, statDataBefore);

            // 初始化日志（只打印一次）
            if (!isInitLog) {
                isInitLog = true;
            }

            // 重算所有角色属性（传入 before 供 NPC 群体 THP/数量同步判断）
            recalcAllCharacters(statData, statDataBefore);

            // 插入：功法熟练度守卫 (模块4)
            // guardProficiency(statData.主角);

            // 插入：伴生神器自动成长 (模块3)
            // processArtifactGrowth(statData.主角);

            // 插入：全自动收菜系统 (模块1)
            autoHarvestAssets(statData);

            // 【新增】：执行三大后台清理逻辑
            const isCombat = statData.系统状态?.是否战斗中 === true;

            // 1. 清理主角的背包和状态
            if (statData.主角) {
                cleanupZeroQuantityItems(statData.主角);
                processStatusDuration(statData.主角, isCombat);
            }
            
            // 2. 清理 NPC 的背包和状态
            if (statData.关系列表) {
                Object.values(statData.关系列表).forEach(npc => {
                    if (!npc) return;
                    cleanupZeroQuantityItems(npc);
                    processStatusDuration(npc, isCombat);
                });
                
                // 3. 清理已死亡的 NPC
                cleanupDeadNPCs(statData);
            }

            // 4. 世界稳定值自动推演 (模块9)
            calcWorldStability(statData);

            // 5. 战斗轮次与形态冷却全自动管理 (模块10)
            processCombatAndCooldowns(statData, statDataBefore);

        } finally {
            isProcessing = false;
        }
    };

    // ===== 轻量路径工具(供数据守卫使用) =====
    /** 按 a.b.c 路径读取嵌套值 */
    function getByPath(obj, path) {
        return path.split('.').reduce((o, k) => o?.[k], obj);
    }

    /** 按 a.b.c 路径写入嵌套值(父节点不存在则放弃,不创建) */
    function setByPath(obj, path, value) {
        const keys = path.split('.');
        let cur = obj;
        for (let i = 0; i < keys.length - 1; i++) {
            if (cur[keys[i]] === undefined) return;
            cur = cur[keys[i]];
        }
        cur[keys[keys.length - 1]] = value;
    }

    /** 变更检测:对象走 JSON 序列化比较,基本类型走 === */
    function hasChanged(oldVal, newVal) {
        if (oldVal === newVal) return false;
        if (typeof oldVal === 'object' && typeof newVal === 'object') {
            return JSON.stringify(oldVal) !== JSON.stringify(newVal);
        }
        return true;
    }

    /** 安全深拷贝(优先 lodash,回退 JSON) */
    function clonePlainValue(value) {
        if (value === undefined) return undefined;
        if (typeof _ !== 'undefined' && _?.cloneDeep) return _.cloneDeep(value);
        return JSON.parse(JSON.stringify(value));
    }

    /**
     * 数据守卫：回滚被 AI 篡改的只读字段 + 规范化新增装备
     * 覆盖 主角 和 关系列表 中的所有在场 NPC
     * @param {object} statData 本次更新后的 stat_data
     * @param {object} statDataBefore 上一帧 stat_data
     */
    function guardProtectedFields(statData, statDataBefore) {
        if (!statDataBefore) return;

        // —— 1. 定义受保护的路径（相对于角色对象） ——
        // 这些字段在 schema 中标注了 readonly: true
        const PROTECTED_RELATIVE_PATHS = [
            'HP_MAX',
            'EP_MAX',
            '最终属性',   // 整个属性对象由后台全量计算，AI 禁止修改
        ];

        // —— 2. 通用的回滚函数：对比并回滚一个角色对象的只读字段 ——
        function rollbackProtectedFields(char, charBefore, label) {
            if (!char || typeof char !== 'object') return;
            if (!charBefore || typeof charBefore !== 'object') return;

            for (const path of PROTECTED_RELATIVE_PATHS) {
                const oldVal = getByPath(charBefore, path);
                const newVal = getByPath(char, path);
                if (oldVal !== undefined && hasChanged(oldVal, newVal)) {
                    console.warn(
                        `[变量守卫] ⚠️ ${label} 只读字段被外部修改: ${path} ` +
                        `(${JSON.stringify(oldVal)} → ${JSON.stringify(newVal)})，已回滚`
                    );
                    setByPath(char, path, oldVal);
                }
            }
        }

        // —— 3. 回滚主角 ——
        const user = statData?.主角;
        const userBefore = statDataBefore?.主角;
        if (user && userBefore) {
            rollbackProtectedFields(user, userBefore, '主角');
        }

        // —— 4. 回滚关系列表中的所有在场 NPC ——
        const rel = statData?.关系列表;
        const relBefore = statDataBefore?.关系列表;
        if (rel && typeof rel === 'object' && relBefore && typeof relBefore === 'object') {
            for (const [name, npc] of Object.entries(rel)) {
                if (!npc || typeof npc !== 'object') continue;

                const npcBefore = relBefore[name];
                if (!npcBefore || typeof npcBefore !== 'object') continue;

                rollbackProtectedFields(npc, npcBefore, `NPC:${name}`);
            }
        }

        // —— 5. 新增装备守卫（主角装备，原有逻辑保持不变） ——
        // 仅处理“新增装备”，不动已有装备
        const oldEquip = statDataBefore?.主角?.装备 || {};
        const newEquip = statData?.主角?.装备 || {};
        for (const [equipKey, equipVal] of Object.entries(newEquip)) {
            if (!equipVal || typeof equipVal !== 'object') continue;
            const isNewEquip = oldEquip[equipKey] === undefined;
            if (!isNewEquip) continue;

            // 状态规范化：仅允许 0|1，其余一律归正为 0（未穿戴）
            if (equipVal.状态 !== 0 && equipVal.状态 !== 1) {
                console.warn(
                    `[变量守卫] ⚠️ 新增装备 "${equipKey}" 状态非法(${JSON.stringify(equipVal.状态)})，已归正为 0(未穿戴)`
                );
                equipVal.状态 = 0;
            }

            // 类型校验：应为 0-9 整数，非法仅告警（留待装备计算阶段处理）
            const typeVal = equipVal.类型;
            const isValidType = Number.isInteger(typeVal) && typeVal >= 0 && typeVal <= 9;
            if (!isValidType) {
                console.warn(
                    `[变量守卫] ⚠️ 新增装备 "${equipKey}" 类型非法(${JSON.stringify(typeVal)})，` +
                    `应为 0-9 整数，留待装备计算阶段处理`
                );
            }
        }
    }

    // ===== 属性全量重算（属性面板是只读汇总，由后台统计各来源加值）=====
    // 设计模型（经用户确认）：
    //   1. 属性面板 = 只读汇总。AI 只动血统/装备/技能/状态/形态，后台把加值统计进 属性
    //   2. 六维：本体值 + 血统加成（装备不加六维）；若形态激活，则形态属性替代血统（二选一）
    //   3. 衍生属性：公式 + 加值叠加（ATK=(力+敏)/2 + 装备ATK + 形态ATK ...）
    //   4. 检定：仅 先攻DC/防御DC；基础值 + 装备加值（形态无检定字段）
    //   5. 层级(位格)：只读，仅作修正值上限，绝不写回
    //   6. HP/EP：写顶级字段（属性对象全量只读，不在其内写 HP/EP 避免与守卫打架）
    //   注：状态.效果、形态.效果 为字符串，留待第三阶段字符串解析器统一处理

    const ATTR_NAMES = ['力量', '敏捷', '体质', '精神', '感知', '魅力'];
    const DERIVED_ATTRS = ['ATK', 'DEF', 'MATK', 'MDEF', 'AP'];
    const CHECK_ATTRS = ['先攻DC', '防御DC'];
    // 装备/形态可能提供的加值键（用于通用累加）
    const BONUS_KEYS = [...DERIVED_ATTRS, ...CHECK_ATTRS];
    // 位格 → 属性修正值上限（旧代码 TIER_MODIFIER_CAPS）
    const TIER_MODIFIER_CAPS = {
        'F': 12, 'E': 30, 'D': 60, 'C': 90, 'B': 120,
        'A': 150, 'S': 180, 'SS': 230, 'SSS': 270
    };
    // 视为"状态正常"的形态库.状态取值（非这些值则视为受损，不计入面板）
    const FORM_OK_STATES = ['', '正常', '完好', '无损'];

    /** 安全取数 */
    function safeNum(v, def = 0) {
        const n = Number(v);
        return Number.isFinite(n) ? n : def;
    }

    /** 旧代码 calcModifier：属性值 → 修正值曲线 */
    function calcModifier(attrVal) {
        if (!attrVal || attrVal < 1) return 0;
        if (attrVal <= 10) return Math.floor(attrVal * 1.5);
        if (attrVal <= 100) return Math.floor(15 + Math.sqrt(attrVal - 10) * 3);
        if (attrVal <= 1000) return Math.floor(45 + Math.sqrt(attrVal - 100) * 2.5);
        if (attrVal <= 10000) return Math.floor(120 + Math.sqrt(attrVal - 1000) * 2);
        return Math.floor(300 + Math.sqrt(attrVal - 10000) * 1.5);
    }

    /**
     * 判定当前形态是否激活且状态正常（激活则形态属性替代血统，二选一）
     * @returns {object|null} 激活的形态库条目；未激活则 null
     */
    function getActiveForm(char) {
        const cur = char.当前形态;
        if (!cur || typeof cur !== 'object') return null;
        if (cur.激活 !== true) return null;
        const name = cur.名称;
        if (!name) return null;
        const entry = char.形态库 && char.形态库[name];
        if (!entry || typeof entry !== 'object') return null;
        // 状态字段为空字符串或正常类取值才视为可用
        if (!FORM_OK_STATES.includes(String(entry.状态 ?? '').trim())) return null;
        return entry;
    }

    /**
     * NPC 群体单位 THP/数量同步
     * 规则（仅 NPC）:
     *   - 新建实体 / 无上一帧：始终信任 [数量]，强制 THP = HP_MAX*(数量-1)
     *     （AI 常按错误 HP 预填 THP，客户端必须覆盖）
     *   - 已有实体且 THP 相对上一帧减少：按 THP 反推人数
     *   - 增援（数量变大）：按新编制补满 THP
     *   - 单名成员属性/HP_MAX 不乘人数；THP 表示“其余成员”的生命池
     * @param {object} char 当前 NPC
     * @param {object|null} charBefore 上一帧 NPC（可空）
     * @param {string} label 日志标识
     */
    function syncNpcGroupThp(char, charBefore, label) {
        if (!char || typeof char !== 'object') return;
        // 仅处理关系列表 NPC；主角无“数量”群体语义
        if (!label || String(label).indexOf('NPC:') !== 0) return;
        // 无数量字段的旧数据按单体处理
        if (char.数量 === undefined || char.数量 === null) return;

        const maxHp = Math.max(1, safeNum(char.HP_MAX, 1));
        let qty = Math.max(1, Math.floor(safeNum(char.数量, 1)));
        let thp = Math.max(0, Math.floor(safeNum(char.THP, 0)));
        const isNew = !(charBefore && typeof charBefore === 'object');
        const thpBefore = isNew ? 0 : Math.max(0, safeNum(charBefore.THP, 0));
        const qtyBefore = (!isNew && charBefore.数量 != null)
            ? Math.max(1, Math.floor(safeNum(charBefore.数量, 1)))
            : qty;
        const fullPool = function(n) { return maxHp * (Math.max(1, n) - 1); };

        // 单体（数量<=1）：THP 仅为普通护盾，不参与群体编制
        if (qty <= 1) {
            if (char.数量 !== 1 && char.数量 !== undefined) char.数量 = 1;
            return;
        }

        // 1) 新建群体：强制按数量灌满 THP，忽略 AI 预填的错误 THP
        //    例：AI 写 HP=30,THP=60,数量=3，实际 HP_MAX=80 → 应 THP=160,数量=3
        if (isNew) {
            const pool = fullPool(qty);
            if (thp !== pool) {
                console.log(
                    `[群体单位] ${label}: 新建灌池 THP ${thp} → ${pool} ` +
                    `(数量=${qty}, HP_MAX=${maxHp})`
                );
            } else {
                console.log(
                    `[群体单位] ${label}: 新建灌池 THP=${pool} ` +
                    `(数量=${qty}, HP_MAX=${maxHp})`
                );
            }
            char.THP = pool;
            char.数量 = qty;
            return;
        }

        // 2) 增援：AI 显式提高了数量 → 按新编制补满群体 THP 池
        if (qty > qtyBefore) {
            const need = fullPool(qty);
            if (thp < need) {
                console.log(
                    `[群体单位] ${label}: 编制增援 数量 ${qtyBefore} → ${qty}, THP ${thp} → ${need}`
                );
                char.THP = need;
            }
            char.数量 = qty;
            return;
        }

        // 3) 脱战/清零后重灌：数量>1 且当前与上一帧 THP 均为 0
        if (thp === 0 && thpBefore === 0) {
            const pool = fullPool(qty);
            char.THP = pool;
            char.数量 = qty;
            console.log(
                `[群体单位] ${label}: 重灌群体 THP=${pool} ` +
                `(数量=${qty}, HP_MAX=${maxHp})`
            );
            return;
        }

        // 4) 承伤路径：仅当 THP 相对上一帧下降时，才用 THP 反推人数
        //    （禁止用 AI 错误预填的 THP 在首帧/未受伤时砍人数）
        if (thp < thpBefore) {
            if (thp <= 0) {
                char.数量 = 1;
                char.THP = 0;
                console.log(`[群体单位] ${label}: THP 耗尽，数量 ${qty} → 1`);
                return;
            }
            const derived = 1 + Math.ceil(thp / maxHp);
            // 上限钳制为上一帧编制，防止把额外护盾算成增员
            const capped = Math.max(1, Math.min(qtyBefore, derived));
            if (qty !== capped) {
                console.log(
                    `[群体单位] ${label}: 数量 ${qty} → ${capped} ` +
                    `(THP ${thpBefore} → ${thp}, HP_MAX=${maxHp})`
                );
            }
            char.数量 = capped;
            return;
        }

        // 5) THP 未下降：保持数量；若 THP 被写成 0 但上一帧>0 已在分支4处理
        //    若 THP 异常偏低且数量未变，不擅自改写（战斗中以 AI 扣 THP 为准）
        char.数量 = qty;
    }

    /**
     * 重算单个角色（主角或NPC）的全套属性面板
     * @param {object} char 角色对象（主角 或 关系列表[某NPC]）
     * @param {string} label 日志标识
     * @param {object|null} [charBefore] 上一帧角色对象（NPC 群体同步用）
     */
    function recalcCharacter(char, label, charBefore) {
        if (!char || typeof char !== 'object') return;
        // ★ 后台守卫: 当前形态未激活时, 自动清空名称(防止残留脏数据导致 getActiveForm 误判)
        try {
            const cur = char.当前形态;
            if (cur && typeof cur === 'object' && cur.激活 !== true && cur.名称) {
                cur.名称 = '';
                if (label) console.log(`[属性重算] ${label}: 当前形态未激活, 已清空残留名称`);
            }
        } catch (e) {}
        if (!char.最终属性) char.最终属性 = {};
        const attr = char.最终属性;
        const 血统 = char.血统 || {};
        const 装备 = char.装备 || {};

        // —— 0. 判定形态激活（二选一：形态 vs 血统）——
        const activeForm = getActiveForm(char);
        const formActive = activeForm !== null;
        // 血统/形态二选一：激活形态时用形态属性当六维本体，否则用 属性.六维(=0) + 血统加成
        const sixSource = formActive ? (activeForm.原始属性 || {}) : null;

        // —— 1. 最终六维 ——
        // 本卡无独立"本体六维"字段：六维只来自血统（默认）或激活的形态（二选一）
        // 状态.原始属性 的六维加成始终叠加（无论形态是否激活）
        const 状态 = char.状态 || {};
        const statusSix = {};
        ATTR_NAMES.forEach(a => { statusSix[a] = 0; });
        Object.values(状态).forEach(s => {
            if (s && typeof s === 'object' && s.原始属性) {
                ATTR_NAMES.forEach(a => { statusSix[a] += safeNum(s.原始属性[a]); });
            }
        });

        const finalBase = {};
        if (formActive) {
            // 形态激活：六维全来自形态（忽略血统）+ 状态加成
            ATTR_NAMES.forEach(a => { finalBase[a] = safeNum(sixSource[a]) + statusSix[a]; });
        } else {
            // 默认：本体六维恒为0，血统为唯一加值来源 + 状态加成
            ATTR_NAMES.forEach(a => {
                let v = 0;
                Object.values(血统).forEach(b => {
                    if (b && typeof b === 'object' && b.原始属性) v += safeNum(b.原始属性[a]);
                });
                finalBase[a] = v + statusSix[a];
            });
        }
        ATTR_NAMES.forEach(a => { attr[a] = finalBase[a]; });

        // 计算层级
        const sum = (attr.力量 || 0) + (attr.敏捷 || 0) + (attr.体质 || 0) + 
                (attr.精神 || 0) + (attr.感知 || 0) + (attr.魅力 || 0);

        // 层级映射逻辑
        let newTier = 'F';
        if (sum >= 100000) newTier = 'SSS';
        else if (sum >= 30000) newTier = 'SS';
        else if (sum >= 10000) newTier = 'S';
        else if (sum >= 3000) newTier = 'A';
        else if (sum >= 1000) newTier = 'B';
        else if (sum >= 300) newTier = 'C';
        else if (sum >= 100) newTier = 'D';
        else if (sum >= 30) newTier = 'E';
        else newTier = 'F';

        // 只有发生变化才写回，且因为层级是 readonly，通过这种方式更新
        if (char.层级 !== newTier && label !== '主角') {
            // console.log(`[层级升维] 总属性点:${sum} -> 层级由 ${char.层级} 升至 ${newTier}`);
            char.层级 = newTier; // 写入
        }

        // —— 2. 修正值（受位格上限约束；位格只读，不写回）——
        const tier = char.层级;
        const modifierCap = TIER_MODIFIER_CAPS[tier];
        ATTR_NAMES.forEach(a => {
            let m = calcModifier(finalBase[a]);
            if (Number.isFinite(modifierCap)) m = Math.min(m, modifierCap);
            attr[`${a}修正`] = m;
        });

        // —— 3. 汇总装备 + 形态的衍生/检定加值 ——
        // 武器(类型0,状态1)的ATK/MATK独立收集(后续各自+无武装成条目); 非武器装备全部属性计入bonus; 武器的DEF等仍计入bonus
        const bonus = {};
        BONUS_KEYS.forEach(k => { bonus[k] = 0; });
        const weapons = []; // [{name, atk, matk}]
        Object.entries(装备).forEach(([wname, e]) => {
            if (!e || typeof e !== 'object' || e.状态 !== 1) return;
            if (!e.原始属性) return;
            if (safeNum(e.类型, 0) === 0) {
                // 武器: ATK/MATK单独记录, 其他属性(DEF/MDEF/AP/检定)仍计入bonus
                weapons.push({ name: wname, atk: safeNum(e.原始属性.ATK), matk: safeNum(e.原始属性.MATK) });
                BONUS_KEYS.forEach(k => { if (k !== 'ATK' && k !== 'MATK') bonus[k] += safeNum(e.原始属性[k]); });
            } else {
                // 非武器: 全部属性(含ATK/MATK)计入bonus → 进入无武装
                BONUS_KEYS.forEach(k => { bonus[k] += safeNum(e.原始属性[k]); });
            }
        });
        // 形态（仅激活时）：形态.原始属性 含 ATK/DEF/MATK/MDEF/AP（11键，无检定）; ATK/MATK计入无武装
        if (formActive) {
            DERIVED_ATTRS.forEach(k => { bonus[k] += safeNum(sixSource[k]); });
        }
        // 状态.原始属性：ATK/DEF/MATK/MDEF/AP/先攻DC/防御DC 全部计入bonus（状态无武器拆分逻辑）
        Object.values(状态).forEach(s => {
            if (s && typeof s === 'object' && s.原始属性) {
                BONUS_KEYS.forEach(k => { bonus[k] += safeNum(s.原始属性[k]); });
            }
        });

        // —— 4. HP_MAX / EP_MAX（旧公式；写顶级字段）——
        const { 体质, 精神, 感知 } = finalBase;
        const oldMaxHP = safeNum(char.HP_MAX, safeNum(attr.HP_MAX));
        const newMaxHP = Math.max(1, Math.floor(体质 * 8));
        const oldMaxEP = safeNum(char.EP_MAX, safeNum(attr.EP_MAX));
        const newMaxEP = Math.max(0, Math.floor((精神 + 感知 / 2) * 4));
        char.HP_MAX = newMaxHP;
        char.EP_MAX = newMaxEP;

        // —— 5. 智能HP/EP管理（升级按增量补、降级截断、初始化满血）——
        const isInit = (!oldMaxHP || oldMaxHP <= 10);
        const curHP = safeNum(char.HP, safeNum(attr.HP));
        const curEP = safeNum(char.EP, safeNum(attr.EP));
        if (isInit) {
            char.HP = newMaxHP;
            char.EP = newMaxEP;
        } else {
            if (newMaxHP > oldMaxHP) {
                char.HP = Math.min(curHP + (newMaxHP - oldMaxHP), newMaxHP);
            } else if (curHP > newMaxHP) {
                char.HP = newMaxHP;
            }
            if (newMaxEP > oldMaxEP) {
                char.EP = Math.min(curEP + (newMaxEP - oldMaxEP), newMaxEP);
            } else if (curEP > newMaxEP) {
                char.EP = newMaxEP;
            }
        }

        // —— 5.5 NPC 群体单位：THP 池初始化 + 按 THP 反推数量 ——
        // 必须在 HP_MAX 结算之后；主角跳过；数量<=1 时 THP 仍是普通护盾
        syncNpcGroupThp(char, charBefore || null, label);

        // —— 6. 衍生属性（公式 + 加值叠加）——
        // ATK/MATK 不再写顶层, 而是按"握持法则"拆入 最终属性.武器:
        //   无武装 = 公式换算 + 非武器装备/形态的ATK/MATK(bonus.ATK/MATK已排除武器)
        //   {武器名} = 武器原始属性ATK/MATK + 无武装ATK/MATK
        const { 力量, 敏捷 } = finalBase;
        const unarmedATK  = Math.floor((力量 + 敏捷) / 2) + bonus.ATK;
        const unarmedMATK = Math.floor(精神 / 2) + bonus.MATK;
        // 重建武器对象(每次全量重建, 防止脱下后旧条目遗留)
        attr.武器 = {};
        attr.武器.无武装 = { ATK: unarmedATK, MATK: unarmedMATK };
        weapons.forEach(w => {
            attr.武器[w.name] = { ATK: w.atk + unarmedATK, MATK: w.matk + unarmedMATK };
        });
        // 删除顶层ATK/MATK(已挪入武器结构; 旧数据残留也一并清除)
        delete attr.ATK;
        delete attr.MATK;
        // DEF/MDEF/AP 仍在顶层(武器的DEF等加成已计入bonus)
        attr.DEF  = Math.floor(体质 / 2) + bonus.DEF;
        attr.MDEF = Math.floor(感知 / 2) + bonus.MDEF;
        attr.AP   = bonus.AP;

        // —— 新增：把护甲折算成减伤率，写回面板（前台替代固定防御）——
        attr.物理减伤率 = calcReduction(attr.DEF, tier || 'E');
        attr.魔法减伤率 = calcReduction(attr.MDEF, tier || 'E');

        // —— 7. 检定（基础值 + 装备加值；仅 先攻DC/防御DC）——
        attr.先攻DC = Math.floor((attr.敏捷修正 + attr.精神修正 / 2) / 2) + bonus.先攻DC;
        attr.防御DC = 30 + Math.floor((attr.体质修正 + attr.敏捷修正) / 2) + bonus.防御DC;

        const formTag = formActive ? `[形态:${char.当前形态.名称}]` : '[血统]';
        console.log(
            `[属性重算] ${label} ${formTag}: ` +
            `六维={力${finalBase.力量}/敏${finalBase.敏捷}/体${finalBase.体质}/精${finalBase.精神}/感${finalBase.感知}/魅${finalBase.魅力}} ` +
            `HP=${char.HP}/${newMaxHP} EP=${char.EP}/${newMaxEP} ` +
            `无武装ATK=${unarmedATK} MATK=${unarmedMATK} 武器x${weapons.length} ` +
            `DEF=${attr.DEF}(+${bonus.DEF}) ` +
            `先攻=${attr.先攻DC}(+${bonus.先攻DC}) 防御=${attr.防御DC}(+${bonus.防御DC})` +
            (Number.isFinite(modifierCap) ? '' : '(位格未命中,修正不限)')
        );
    }

    /** 遍历主角 + 全部NPC，逐个重算（后台全量计算，与是否在场无关） */
    function recalcAllCharacters(statData, statDataBefore) {
        if (!statData) return;
        // 主角
        if (statData.主角) {
            recalcCharacter(statData.主角, '主角', statDataBefore?.主角);
        }
        // 关系列表全部NPC（不在场也需重算属性，供面板查阅；是否展示给AI由变量可见性控制）
        const rel = statData.关系列表;
        const relBefore = statDataBefore?.关系列表;
        if (rel && typeof rel === 'object') {
            Object.entries(rel).forEach(([name, npc]) => {
                if (!npc || typeof npc !== 'object') return;
                const npcBefore = (relBefore && typeof relBefore === 'object') ? relBefore[name] : null;
                recalcCharacter(npc, `NPC:${name}`, npcBefore);
            });
        }
    }

    /** 资产全自动收菜系统 */
    function autoHarvestAssets(statData) {
        const assets = statData?.资产;
        const worldTime = statData?.世界?.时间;
        if (!assets || typeof assets !== 'object' || !worldTime) return;

        // 解析你的世界时间: "2026年-06月-23日-清晨"
        const timeMatch = String(worldTime).match(/(\d+)年-(\d+)月-(\d+)日/);
        if (!timeMatch) return;
        const currentDays = parseInt(timeMatch[1]) * 365 + parseInt(timeMatch[2]) * 30 + parseInt(timeMatch[3]);

        Object.entries(assets).forEach(([assetName, asset]) => {
            if (!asset || !asset.建设序列) return;
            if (!Array.isArray(asset.待办事件)) asset.待办事件 = [];

            Object.entries(asset.建设序列).forEach(([seqName, seq]) => {
                if (!seq.产出 || seq.产出 === '无' || seq.产出 === '待定') return;

                // 初始化或读取上次产出时间
                if (!seq._上次产出天数) {
                    seq._上次产出天数 = currentDays;
                    return;
                }

                const daysPassed = currentDays - seq._上次产出天数;
                const cycle = 7; // 默认7天一收菜

                if (daysPassed >= cycle) {
                    const harvestCount = Math.floor(daysPassed / cycle);
                    const todoMsg = `【自动收菜】${assetName}-${seqName} 经过了${daysPassed}天，产出了：${seq.产出} (共${harvestCount}份，请查收并清空此条待办)`;
                    
                    // 避免重复推送
                    if (!asset.待办事件.includes(todoMsg)) {
                        asset.待办事件.push(todoMsg);
                        console.log(`[资产收菜] 触发：${todoMsg}`);
                    }
                    
                    // 更新时间戳
                    seq._上次产出天数 += harvestCount * cycle;
                }
            });
        });
    }

    // ===== 模块 2：护甲收益递减 (对数防御曲线 - 动态层级适配版) =====
    const REDUCTION_CAP = 75; // 最高减伤 75%
    const ALPHA = 16;
    const LOG_DEN = Math.log(1 + ALPHA); // ln(17)

    /**
     * 【核心修复】：各阶位对应的理论满防值（防具上限 + 体质换算上限）
     * 来源依据：对照你的《品质效果数值规则》各阶位六维总和与防御阈值推算
    */ 
    const TIER_DEF_SCALE = {
        'F': 20,       // F级萌新满防基准
        'E': 60,       // E级满防基准
        'D': 200,      // D级
        'C': 600,      // C级
        'B': 2000,     // B级
        'A': 6000,     // A级
        'S': 20000,    // S级
        'SS': 60000,   // SS级
        'SSS': 150000  // SSS级半神满防基准
    };

    /** 传入防御总值与角色当前层级 */
    function calcReduction(defenseValue, tier) {
        // 获取当前阶位的满防基准（兜底为E级）
        const fullScale = TIER_DEF_SCALE[tier] || TIER_DEF_SCALE['E'];
        const defense = Math.max(0, safeNum(defenseValue, 0));
        
        // 计算当前防御在当前阶位下的比例
        const scale = defense / fullScale;
        
        // 带入对数递减公式
        const rawReduction = REDUCTION_CAP * Math.log(1 + ALPHA * scale) / LOG_DEN;
        
        // 限制最高不得超过 75%
        return Math.min(REDUCTION_CAP, Math.round(rawReduction)); 
    }

    /** 伴生神器自动成长 */
    function processArtifactGrowth(char) {
        if (!char || !char.装备) return;
        
        // 假设伴生神器的装备标签为 "伴生神器" 或 "可成长"，在装备列表中查找
        const artifact = Object.values(char.装备).find(e => e.标签?.includes("伴生神器") || e.标签?.includes("可成长"));
        
        if (!artifact) return;

        const currentTier = char.层级; // F ~ SSS
        const oldTier = artifact.品质;

        // 如果神器品质已经等于主角层级，则不需要成长
        if (oldTier === currentTier) return;

        // 装备品质自动对齐主角位格
        artifact.品质 = currentTier;
        
        // 动态重写特效与属性
        if (!artifact.效果) artifact.效果 = {};
        if (!artifact.原始属性) artifact.原始属性 = {};

        // 根据不同层级解锁词条 (像修仙小说的本命法宝解封一样)
        switch(currentTier) {
            case 'E':
                artifact.效果['真名初现'] = "攻击时额外造成小幅灵魂震荡";
                artifact.原始属性['ATK'] = 50;
                break;
            case 'C':
                artifact.效果['火之高兴'] = "无视目标 20% 物理减伤率";
                artifact.原始属性['ATK'] = 500;
                break;
            case 'A':
                artifact.效果['焚天'] = "每次攻击附带基于目标最大HP 5% 的真实灼烧";
                artifact.原始属性['ATK'] = 3000;
                break;
            case 'SSS':
                artifact.效果['概念级·初火'] = "绝对必中，且击杀目标后直接抹除其在世界法则中的因果";
                artifact.原始属性['ATK'] = 50000;
                break;
        }
        
        console.log(`[神器成长] 伴生神器已随主角突破！当前品质: ${currentTier}`);
    }

    /** 功法/熟练度 溢出进阶守卫 */
    function guardProficiency(char) {
        if (!char || !char.技能) return;
        
        // 设定阶位升阶门槛
        const TIER_THRESHOLDS = { '入门': 100, '熟练': 300, '精通': 1000, '宗师': 5000, '化境': Infinity };
        const TIER_ORDER = Object.keys(TIER_THRESHOLDS);

        Object.entries(char.技能).forEach(([skillName, skill]) => {
            // 假设通过“熟练度”字段来控制
            if (skill.熟练度 === undefined || skill.掌握程度 === undefined) return;

            let currentExp = safeNum(skill.熟练度, 0);
            let currentTier = skill.掌握程度; // 比如 "入门"
            
            let threshold = TIER_THRESHOLDS[currentTier] || Infinity;

            // 如果熟练度溢出，自动进阶
            while (currentExp >= threshold && threshold !== Infinity) {
                currentExp -= threshold; // 扣除门槛，保留溢出
                
                const nextIndex = TIER_ORDER.indexOf(currentTier) + 1;
                currentTier = TIER_ORDER[nextIndex];
                threshold = TIER_THRESHOLDS[currentTier];
                
                // console.log(`[功法突破] 恭喜！${skillName} 突破至 ${currentTier}！`);
                
                // 进阶时自动增强技能伤害系数
                if (skill.效果 && skill.效果['基础伤害倍率']) {
                    skill.效果['基础伤害倍率'] = (parseFloat(skill.效果['基础伤害倍率']) + 0.5) + "x";
                }
            }

            // 写回数据
            skill.掌握程度 = currentTier;
            skill.熟练度 = currentExp;
            skill.升阶阈值 = threshold;
        });
    }

    /** 物品数量归零清理 */
    function cleanupZeroQuantityItems(char) {
        if (!char || !char.背包) return;
        Object.keys(char.背包).forEach(itemName => {
            const item = char.背包[itemName];
            // 只要数量 <= 0，或者字段缺失，立刻删除
            if (item && (item.数量 === undefined || item.数量 === null || item.数量 <= 0)) {
                delete char.背包[itemName];
                console.log(`[背包清理] 物品 "${itemName}" 数量归零，已自动删除。`);
            }
        });
    }

    /** 状态回合衰减与过期清理 */
    function processStatusDuration(char, isCombat) {
        if (!char || !char.状态) return;
        const statusesToRemove = [];
        
        Object.entries(char.状态).forEach(([statusName, statusData]) => {
            if (!statusData || typeof statusData.持续 !== 'string') return;
            
            // 仅在战斗中，处理带有“回合”字样的状态倒计时
            if (isCombat && statusData.持续.includes('回合')) {
                let rounds = parseInt(statusData.持续);
                if (!isNaN(rounds) && rounds > 0) {
                    rounds -= 1; // 回合数 -1
                    if (rounds <= 0) {
                        statusesToRemove.push(statusName);
                    } else {
                        // 更新回字符串，例如 "2回合"
                        statusData.持续 = `${rounds}回合`;
                    }
                }
            }
            // 非战斗状态的持续时间（如"3天"或"直至被净化"）留给 AI 在剧情中判断
        });
        
        // 集中删除到期的状态
        statusesToRemove.forEach(name => {
            delete char.状态[name];
            console.log(`[状态清理] ${char.名称 || '角色'} 的状态 [${name}] 已到期，后台自动移除。`);
        });
    }

    /** 死亡 NPC 清理 (防误删强化版) */
    function cleanupDeadNPCs(statData) {
        if (!statData || !statData.关系列表) return;
        Object.keys(statData.关系列表).forEach(npcName => {
            const npc = statData.关系列表[npcName];
            if (!npc) return;
            
            // 1. 终极保护伞：如果是队友，或者好感度 > 30，绝对不删（为复活道具/技能保留肉体）
            const isTeammate = npc.是否队友 === true;
            const highAffinity = typeof npc.好感度 === 'number' && npc.好感度 > 30;
            if (isTeammate || highAffinity) {
                return; // 直接跳过，免受清理
            }

            // 2. 智能死亡判定
            // 判断条件 A：HP 归零，并且状态里没有“濒死”二字
            const isHpZero = (typeof npc.HP === 'number' && npc.HP <= 0);
            // 遍历状态名，防止 AI 起名字叫“严重濒死”之类的
            const isDying = npc.状态 && Object.keys(npc.状态).some(key => key.includes('濒死')); 
            const isHpDead = isHpZero && !isDying;
            
            // 判断条件 B：AI 直接在状态里明确写了包含“死亡”的词汇（双重保险）
            const isExplicitlyDead = npc.状态 && Object.keys(npc.状态).some(key => key.includes('死亡'));

            // 3. 满足任意死亡条件，且没有保护伞，直接从内存中抹除
            if (isHpDead || isExplicitlyDead) {
                delete statData.关系列表[npcName];
                console.log(`[阵亡清理] 敌对或路人 NPC "${npcName}" 已确认死亡（无复活价值），后台自动移除。`);
            }
        });
    }

    /** 世界稳定值自动推演 */
    function calcWorldStability(statData) {
        if (!statData || !statData.世界 || !statData.世界.因果轨道 || statData.设置.世界超稳) return;
        const records = statData.世界.因果轨道.偏移记录;
        
        let totalOffset = 0;
        if (records && typeof records === 'object') {
            Object.values(records).forEach(record => {
                if (record && typeof record.影响程度 === 'number') {
                    totalOffset += record.影响程度;
                }
            });
        }
        
        // 稳定值上限100，减去所有偏移记录的累加值
        const newStability = Math.max(0, 100 + totalOffset);
        
        if (statData.世界.稳定 !== newStability) {
            console.log(`[世界法则] 稳定值重算: 100 + ${totalOffset}(偏移总和) = ${newStability}`);
            statData.世界.稳定 = newStability;
        }
    }

    /** 战斗轮次与技能冷却全自动管理 */
    function processCombatAndCooldowns(statData, statDataBefore) {
        // ★ UI 来源守卫: 若本次 VARIABLE_UPDATE_ENDED 由悬浮球UI操作(穿脱装备/道具/激活形态)触发, 跳过轮次推进+冷却递减
        //   避免反复穿脱导致战斗轮次+1 / 形态冷却-1 / 回合制状态-1; 属性重算等其他模块不受影响, 照常执行
        //   注: 本脚本运行在iframe(about:srcdoc), 悬浮球运行在主窗口, 标志写在主窗口上。
        //   本脚本无 GS_PARENT 变量, 用 window.parent(主文档) → window.top → window 三级 fallback 读取。
        try {
            let flagWin = null;
            try { if (typeof GS_PARENT !== 'undefined' && GS_PARENT) flagWin = GS_PARENT; } catch(e){}
            if (!flagWin) { try { if (window.parent && window.parent !== window) flagWin = window.parent; } catch(e){} }
            if (!flagWin) { try { if (window.top && window.top !== window) flagWin = window.top; } catch(e){} }
            if (!flagWin) flagWin = window;
            if (flagWin && flagWin.__samsaraUIMutation === true) {
                console.log('[战斗系统] 检测到本次更新来自UI操作(__samsaraUIMutation), 跳过轮次推进与冷却递减');
                return;
            }
        } catch (e) {}
        const combat = statData?.系统状态;
        const combatBefore = statDataBefore?.系统状态;
        if (!combat) return;

        let deltaRound = 0;
        const isCombatNow = combat.是否战斗中 === true;
        const wasCombatBefore = combatBefore?.是否战斗中 === true;

        // —— 1. 处理轮次自动递增 ——
        if (isCombatNow) {
            if (!wasCombatBefore) {
                combat.当前轮次 = 1; // 刚进战
                console.log(`[战斗系统] 进入战斗，当前轮次初始化为 1`);
            } else {
                const beforeRound = safeNum(combatBefore.当前轮次, 1);
                const aiRound = safeNum(combat.当前轮次, 1);
                // 后台强力接管递增，防止 AI 双重加算
                if (aiRound <= beforeRound) {
                    combat.当前轮次 = beforeRound + 1;
                }
                deltaRound = combat.当前轮次 - beforeRound;
                console.log(`[战斗系统] 轮次推进: ${beforeRound} -> ${combat.当前轮次}`);
            }
        } else {
            combat.当前轮次 = 0;
            deltaRound = 999; // 标记为脱战状态，用于强制清空冷却

            // 仅在“刚刚脱离战斗”的这个瞬间触发清零！
            if (wasCombatBefore) {
                console.log(`[战斗系统] 离开战斗，触发冷却与护盾(THP)清空协议`);
                
                // 1. 清空主角的临时生命值
                if (statData.主角 && typeof statData.主角.THP !== 'undefined') {
                    statData.主角.THP = 0;
                    console.log(`[战斗系统] 主角 THP 已脱战归零`);
                }

                // 2. 清空所有NPC的临时生命值
                //    注意：本帧 recalc 已跑完；群体单位 THP 会被清掉后需同帧按数量重灌
                if (statData.关系列表) {
                    Object.entries(statData.关系列表).forEach(([npcName, npc]) => {
                        if (!npc || npc.在场 === false) return;
                        if (typeof npc.THP !== 'undefined') npc.THP = 0;
                        // 群体：THP 清零后按当前数量重灌（人数已在战斗中被 THP 反推过，不回满人数）
                        const qty = Math.max(1, Math.floor(safeNum(npc.数量, 1)));
                        if (qty > 1) {
                            const maxHp = Math.max(1, safeNum(npc.HP_MAX, 1));
                            const pool = maxHp * (qty - 1);
                            npc.THP = pool;
                            console.log(
                                `[战斗系统] 群体 NPC:${npcName} 脱战重灌 THP=${pool} (数量=${qty})`
                            );
                        }
                    });
                }
            }
        }

        // —— 2. 冷却递减逻辑引擎 ——
        function tickCooldowns(actor, actorBefore, label) {
            if (!actor) return;
            
            const processDict = (dict, dictBefore) => {
                if (!dict) return;
                Object.entries(dict).forEach(([name, item]) => {
                    if (!item || typeof item.冷却 !== 'string') return;
                    
                    const oldItem = dictBefore?.[name];
                    const oldCdStr = oldItem?.冷却 || "0";
                    const newCdStr = item.冷却;
                    
                    // 解析字符串，例如 "2/3 回合" 提取出 cur=2, max=3
                    const parseCD = (str) => {
                        if (!str || str === "0") return { cur: 0, max: 0 };
                        const m = str.match(/^(\d+)\s*\/\s*(\d+)/);
                        if (m) return { cur: parseInt(m[1]), max: parseInt(m[2]) };
                        return { cur: 0, max: 0 };
                    };

                    const oldCD = parseCD(oldCdStr);
                    const newCD = parseCD(newCdStr);

                    if (newCD.max === 0) return; // 0/0的无CD技能直接跳过

                    // 【神级拦截】：如果 AI 刚把当前冷却拉高（即本回合释放了该技能），则本回合绝不扣减！
                    if (newCD.cur > oldCD.cur && isCombatNow) {
                        console.log(`[冷却系统] ${label} 刚释放了 [${name}]，冷却已置为 ${newCdStr}，本轮不扣减。`);
                        return;
                    }

                    // 开始随轮次扣减
                    let finalCur = newCD.cur;
                    if (deltaRound === 999) {
                        finalCur = 0; // 脱战清零
                    } else if (deltaRound > 0) {
                        finalCur = Math.max(0, newCD.cur - deltaRound);
                    }

                    // 写回标准格式
                    const finalStr = finalCur === 0 ? "0" : `${finalCur}/${newCD.max} 回合`;
                    if (item.冷却 !== finalStr) {
                        console.log(`[冷却系统] ${label} 的 [${name}] 冷却倒数: ${item.冷却} -> ${finalStr}`);
                        item.冷却 = finalStr;
                    }
                });
            };

            // 遍历技能库和形态库
            // processDict(actor.技能, actorBefore?.技能);
            processDict(actor.形态库, actorBefore?.形态库);
        }

        // 执行主角的冷却递减
        tickCooldowns(statData.主角, statDataBefore?.主角, "主角");
        // 执行在场 NPC 的冷却递减
        if (statData.关系列表) {
            Object.entries(statData.关系列表).forEach(([npcName, npc]) => {
                if (npc.在场 !== false) {
                    tickCooldowns(npc, statDataBefore?.关系列表?.[npcName], `NPC:${npcName}`);
                }
            });
        }
    }

    // 初始化事件注册
    const init = async () => {
        await waitGlobalInitialized('Mvu');
        eventOn(Mvu.events.VARIABLE_UPDATE_ENDED, onUpdateData);
        try { (window.parent || window).__辅助计算脚本_loaded__ = true; } catch(e) { window.__辅助计算脚本_loaded__ = true; }
        console.log('[辅助计算脚本] 脚本已加载 ');
        toastr.success('[辅助计算脚本] 脚本已加载 ');
    };

    $(init);

})();