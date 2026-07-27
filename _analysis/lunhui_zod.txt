import { registerMvuSchema } from 'https://testingcf.jsdelivr.net/gh/StageDog/tavern_resource/dist/util/mvu_zod.js';

// ==========================================
// 🛡️ 高阶防御性工具函数 (防止 AI 输出格式幻觉)
// ==========================================

const isPlainObject = v => !!v && 'object' === typeof v && !Array.isArray(v);

// 【核心修复】严格实体拦截器：拒绝 AI 拿 `{}` 敷衍了事
const strictItem = (schema) => z.preprocess(val => {
    // 如果 AI 敢传入空对象，直接将其转为 undefined，触发 Zod 的 required 报错拦截！
    if (isPlainObject(val) && Object.keys(val).length === 0) {
        return undefined; 
    }
    return val;
}, schema); // 坚决不在尾部加 .prefault({})，让 MVU 真正报错打回

const safeStr = (val = '') => z.preprocess(v => 'string' === typeof v ? v : val, z.string()).prefault(val);

const safeNum = (val = 0) => z.preprocess(v => {
    if ('number' === typeof v) return Number.isFinite(v) ? v : val;
    if ('string' === typeof v) {
        const trimmed = v.trim();
        if (!trimmed) return val;
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : val;
    }
    return val;
}, z.number()).prefault(val);

const clampNum = (defaultVal, min, max) => safeNum(defaultVal).transform(v => _.clamp(v, min, max));

const boolPreprocess = (defaultVal = false) => z.preprocess(v => {
    if (typeof v === 'boolean') return v;
    if (typeof v === 'string') {
        const lower = v.trim().toLowerCase();
        return lower === 'true' || lower === '是' || lower === '1';
    }
    if (typeof v === 'number') return v > 0;
    return defaultVal;
}, z.boolean()).prefault(defaultVal);

const safeTags = (defaultVal = []) => z.preprocess(
    v => Array.isArray(v) ? v.filter(item => 'string' === typeof item) : defaultVal,
    z.array(z.string())
).prefault(defaultVal).transform(arr => _.uniq(arr));


// ==========================================
// 🎲 核心枚举与共用模块
// ==========================================

const E_quality = z.enum(['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS']);
const E_attr6 = z.enum(['力量', '敏捷', '体质', '精神', '感知', '魅力']);

// 所有 add 类实体全部套上 strictItem，杜绝白板生成
// 血统
const bloodline_item = strictItem(z.object({
    品质: E_quality.prefault('F'),
    标签: safeTags([]),
    原始属性: z.record(E_attr6, safeNum(0)).prefault({}),
    效果: z.record(z.string(), z.string()).prefault({}),
    描述: safeStr('')
}));
// 技能
const skill_item = strictItem(z.object({
    品质: E_quality.prefault('F'),
    类型: clampNum(0, 0, 2), // 0-主动 1-被动 2-特殊
    标签: safeTags([]),
    效果: z.record(z.string(), z.string()).prefault({}),
    描述: safeStr(''),
    消耗: safeStr('')
}));
// 装备
const equip_item = strictItem(z.object({
    品质: E_quality.prefault('F'),
    类型: clampNum(0, 0, 8),
    标签: safeTags([]),
    原始属性: z.record(z.string(), safeNum(0)).prefault({}),
    效果: z.record(z.string(), z.string()).prefault({}),
    描述: safeStr(''),
    消耗: safeStr(''),
    状态: clampNum(0, 0, 2) // 0-未装备 1-已装备 2-仓库
}));
// 道具
const backpack_item = strictItem(z.object({
    品质: E_quality.prefault('F'), // 【修复】收束品质
    类型: safeStr(''),
    数量: clampNum(1, 0, 999999), 
    标签: safeTags([]), 
    效果: z.record(z.string(), z.string()).prefault({}),
    描述: safeStr(''),
    状态: clampNum(0, 0, 2) // 0-随身背包 1-战术栏 2-仓库
}));
// 状态
const buff_item = strictItem(z.object({
    类型: z.enum(['增益', '减益', '特殊']).prefault('增益'),
    品质: E_quality.prefault('F'),
    持续: safeStr('1回合'), // 【修复】防无限持续
    来源: safeStr(''),
    原始属性: z.record(z.string(), safeNum(0)).prefault({}),
    效果: safeStr('')
}));

// 【修复】剥离 HP/EP 彻底贯彻“同生共死法则”，并加上属性上限保护
const form_attr = z.object({
    力量: clampNum(0, 0, 999999), 敏捷: clampNum(0, 0, 999999), 体质: clampNum(0, 0, 999999),
    精神: clampNum(0, 0, 999999), 感知: clampNum(0, 0, 999999), 魅力: clampNum(0, 0, 999999),
    ATK: clampNum(0, 0, 999999), DEF: clampNum(0, 0, 999999), MATK: clampNum(0, 0, 999999), MDEF: clampNum(0, 0, 999999), AP: clampNum(0, 0, 999999)
}).prefault({});
// 形态
const form_item = strictItem(z.object({
    品质: E_quality.prefault('F'),
    消耗: safeStr(''),
    冷却: safeStr('0回合'),   // 【新增】防无限爆甲流的冷却锁
    状态: safeStr('完好'),    // 【新增】叙事层面的损坏标记（完好/大破等）
    原始属性: form_attr,
    效果: z.record(z.string(), z.string()).prefault({}),
    技能: z.record(z.string(), skill_item).prefault({}),
    描述: safeStr('')
}));

const current_form = z.object({
    激活: boolPreprocess(false),
    名称: safeStr('')
}).prefault({});

const char_attr = z.object({
    力量: clampNum(0, 0, 999999), 敏捷: clampNum(0, 0, 999999), 体质: clampNum(0, 0, 999999),
    精神: clampNum(0, 0, 999999), 感知: clampNum(0, 0, 999999), 魅力: clampNum(0, 0, 999999),
    力量修正: clampNum(0, 0, 999999), 敏捷修正: clampNum(0, 0, 999999), 体质修正: clampNum(0, 0, 999999),
    精神修正: clampNum(0, 0, 999999), 感知修正: clampNum(0, 0, 999999), 魅力修正: clampNum(0, 0, 999999),
    DEF: clampNum(0, 0, 999999), MDEF: clampNum(0, 0, 999999), AP: clampNum(0, 0, 999999), 先攻DC: clampNum(0, 0, 999999), 防御DC: clampNum(0, 0, 999999),
    物理减伤率: clampNum(0, 0, 100), 魔法减伤率: clampNum(0, 0, 100),
    武器: z.record(z.string(), z.object({ ATK: clampNum(0, 0, 999999), MATK: clampNum(0, 0, 999999) }).prefault({})).prefault({})
}).prefault({});

const npc_schema = strictItem(z.object({
    在场: boolPreprocess(false),
    种族: safeStr('人类'),
    身份: safeTags([]),
    职业: safeTags([]),
    层级: E_quality.prefault('F'), // [readonly]
    HP_MAX: clampNum(0, 0, 999999),
    HP: clampNum(0, 0, 999999),
    THP: clampNum(0, 0, 999999),
    EP_MAX: clampNum(0, 0, 999999),
    EP: clampNum(0, 0, 999999),
    状态: z.record(z.string(), buff_item).prefault({}), 
    最终属性: char_attr,
    血统: z.record(z.string(), bloodline_item).prefault({}),
    装备: z.record(z.string(), equip_item).prefault({}),
    技能: z.record(z.string(), skill_item).prefault({}),
    背包: z.record(z.string(), backpack_item).prefault({}),
    形态库: z.record(z.string(), form_item).prefault({}),
    当前形态: current_form,
    性格: safeStr(''),
    喜爱: safeStr(''),
    外貌: safeStr(''),
    着装: safeStr(''),
    是否队友: boolPreprocess(false),
    好感度: clampNum(0, -100, 100),
    心里话: safeStr(''),
    背景故事: safeStr(''),
    数量: clampNum(1, 1, 999999)
})).transform(char => {
    // 跨节点幽灵机甲清理
    if (char.当前形态?.激活 && char.当前形态?.名称) {
        if (!char.形态库 || !char.形态库[char.当前形态.名称]) {
            char.当前形态.激活 = false;
            char.当前形态.名称 = '';
        }
    }
    return char;
});


// ==========================================
// 🌍 主体 Schema 定义
// ==========================================

export const Schema = z.object({
    世界: z.object({
        时间: safeStr('待初始化'),
        地点: safeStr('待初始化'),
        名称: safeStr('待初始化'),
        难度: safeStr('F~A'),
        稳定: clampNum(100, 0, 120),
        法则: safeTags([]).transform(arr => {
            if (arr.length === 0) return []; // 【修复】天下没有无法则之地
            return _.take(arr, 10);
        }),
        货币: z.object({
            体系: safeStr(''),
            购买力基准: safeStr(''),
            经济波动: safeStr('')
        }).prefault({}),
        探索: z.record(z.string(), z.object({
            风险: E_quality.prefault('F'),
            探索度: clampNum(0, 0, 100),
            描述: safeStr(''),
            隐藏真相: safeStr('')
        }).prefault({})).prefault({}),
        势力: z.record(z.string(), z.object({
            实力: E_quality.prefault('F'),
            领地: safeStr(''),
            描述: safeStr(''),
            声望: clampNum(0, -5000, 10000)
        }).prefault({})).prefault({}),
        因果轨道: z.object({
            当前阶段: safeStr('待初始化'),
            故事线: safeStr('待初始化'),
            下一节点: safeStr('待初始化'),
            偏移记录: z.record(z.string(), strictItem(z.object({
                描述: safeStr(''),
                引发者: safeStr(''),
                影响程度: clampNum(0, -100, 120)
            }))).prefault({})
        }).prefault({}),
        异端雷达: z.object({
            当前模式: safeStr(''),
            异端上限: safeNum(0),
            活跃余量: safeNum(0)
        }).prefault({})
    }).prefault({}),

    任务: z.object({
        列表: z.record(z.string(), strictItem(z.object({
            委托方: safeStr(''),
            简介: safeStr(''),
            目标: safeStr(''),
            隐藏真相: safeStr(''),
            奖励: safeStr(''),
            交付: safeStr(''),
            状态: z.enum(['进行中', '可交付', '可结算', '失败']).prefault('进行中') // 【修复】收束任务状态
        }))).prefault({}),
        // 【已修复】固定击杀槽位
        击杀: z.object({
            F: safeNum(0), E: safeNum(0), D: safeNum(0),
            C: safeNum(0), B: safeNum(0), A: safeNum(0),
            S: safeNum(0), SS: safeNum(0), SSS: safeNum(0)
        }).prefault({}),
        贡献: z.record(z.string(), strictItem(z.object({
            剧情定性: safeStr('')
        }))).prefault({})
    }).prefault({}),

    主角: z.object({
        种族: safeStr('人类'),
        身份: safeTags([]),
        职业: safeTags([]),
        层级: E_quality.prefault('F'), // [readonly]
        HP_MAX: clampNum(0, 0, 999999),
        HP: clampNum(0, 0, 999999),
        THP: clampNum(0, 0, 999999),
        EP_MAX: clampNum(0, 0, 999999),
        EP: clampNum(0, 0, 999999),
        状态: z.record(z.string(), buff_item).prefault({}),
        最终属性: char_attr,
        血统: z.record(z.string(), bloodline_item).prefault({}),
        技能: z.record(z.string(), skill_item).prefault({}),
        装备: z.record(z.string(), equip_item).prefault({}),
        背包: z.record(z.string(), backpack_item).prefault({}),
        空间币: safeNum(0).transform(v => Math.max(0, v)),
        形态库: z.record(z.string(), form_item).prefault({}),
        当前形态: current_form
    }).prefault({}).transform(char => {
        // 主角跨节点幽灵机甲清理
        if (char.当前形态?.激活 && char.当前形态?.名称) {
            if (!char.形态库 || !char.形态库[char.当前形态.名称]) {
                char.当前形态.激活 = false;
                char.当前形态.名称 = '';
            }
        }
        return char;
    }),

    资产: z.record(z.string(), strictItem(z.object({
        类型: z.enum(['固定地产', '大型载具与要塞', '便携式据点']).prefault('固定地产'), // 【修复】枚举锁死
        主体规模: clampNum(1, 1, 10),
        完整度: clampNum(100, 0, 100),
        状态: safeStr(''),
        // 【已修复】可选节点，让固定地产无需生成此废料
        能源: z.object({
            类型: safeStr(''),
            当前: safeNum(0),
            上限: safeNum(0),
            描述: safeStr('')
        }).optional(),
        消耗单元: z.record(z.string(), z.object({
            余量: safeNum(0),
            上限: safeNum(0),
            加成: safeTags([])
        }).prefault({})).optional(),
        建设序列: z.record(z.string(), strictItem(z.object({
            阶段: z.enum(['基础', '进阶', '专业', '顶尖', '禁忌']).prefault('基础'),
            功能: safeStr(''),
            加成: safeTags([]),
            产出: safeStr(''),
            上次产出天数: safeNum(0)
        }))).prefault({}),
        驻扎人员: z.record(z.string(), safeStr('')).prefault({}),
        待办事件: safeTags([]) 
    }))).prefault({}),

    系统状态: z.object({
        是否战斗中: boolPreprocess(false),
        当前轮次: safeNum(0),
        进阶试炼已完成: boolPreprocess(false),
        是否在主神空间: boolPreprocess(false)
    }).prefault({}),

    关系列表: z.record(z.string(), npc_schema).prefault({}),

    传闻: z.object({
        街头巷议: z.record(z.string(), strictItem(z.object({
            说书人: safeStr(''),
            内容: safeStr(''),
            可信度: z.enum(['酒话', '可疑', '或许可信']).prefault('酒话')
        }))).prefault({}),
        情报交易: z.record(z.string(), strictItem(z.object({
            卖家: safeStr(''),
            情报评级: z.enum(['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS', 'SSS', '日常', '战略']).prefault('日常'),
            摘要: safeStr(''),
            要价: safeNum(0),
            真实内幕: safeStr('')
        }))).prefault({}),
        布告与檄文: z.record(z.string(), strictItem(z.object({
            发布者: safeStr(''),
            内容: safeStr(''),
            张贴位置: safeStr('')
        }))).transform(data => {
            const entries = _(data).entries().takeRight(3).value();
            return _.fromPairs(entries);
        }).prefault({})
    }).prefault({}),

    商城: z.object({
        血统列表: z.array(strictItem(z.object({
            名称: safeStr('未命名'),
            品质: E_quality.prefault('F'),
            标签: safeTags([]),
            原始属性: z.record(E_attr6, safeNum(0)).prefault({}),
            效果: z.record(z.string(), z.string()).prefault({}),
            描述: safeStr(''),
            价格: safeNum(0)
        }))).prefault([]),
        技能列表: z.array(strictItem(z.object({
            名称: safeStr('未命名'),
            品质: E_quality.prefault('F'),
            类型: clampNum(0, 0, 2), // 0-主动 1-被动 2-特殊
            标签: safeTags([]),
            效果: z.record(z.string(), z.string()).prefault({}),
            描述: safeStr(''),
            消耗: safeStr(''),
            价格: safeNum(0)
        }))).prefault([]),
        装备列表: z.array(strictItem(z.object({
            名称: safeStr('未命名'),
            品质: E_quality.prefault('F'),
            类型: clampNum(0, 0, 8), // 0武器 1手套 2头部 3胸部 4腿部 5鞋子 6披风 7饰品 8特殊
            标签: safeTags([]),
            原始属性: z.record(z.string(), safeNum(0)).prefault({}),
            效果: z.record(z.string(), z.string()).prefault({}),
            描述: safeStr(''),
            价格: safeNum(0)
        }))).prefault([]),
        道具列表: z.array(strictItem(z.object({
            名称: safeStr('未命名'),
            品质: E_quality.prefault('F'), // 【修复】收束品质
            类型: safeStr(''),
            数量: clampNum(1, 0, 999999),
            标签: safeTags([]),
            效果: z.record(z.string(), z.string()).prefault({}),
            描述: safeStr(''),
            价格: safeNum(0)
        }))).prefault([])
    }).prefault({})

}).prefault({});

// 注册完全体 Schema
$(() => {
    registerMvuSchema(Schema);
});