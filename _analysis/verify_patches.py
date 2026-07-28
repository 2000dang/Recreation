# -*- coding: utf-8 -*-
with open(r'_analysis/build_hx_v2.py', encoding='utf-8') as f:
    text = f.read()

checks = {
    'New entries (-200)': '真实世界·角色独立宣言',
    'New entries (-199)': '第一推动力与蝴蝶效应',
    'New entries (-198)': '机会窗口与世界持续性',
    'WORLD_RULE empowerment': '真实世界宣言',
    'system_prompt 8th': '放纵的叙事直觉',
    '1060 tension': '叙事张力引擎',
    '杨玉兰 rewrite': '活色生香的娇躯',
    '娄琛雨 rewrite': '熟透了的美味',
    '姜舞 rewrite': '冷艳科学家',
    '萧茹 rewrite': '温顺助手',
    '陈丹娜 rewrite': '实用主义少女',
}
for name, marker in checks.items():
    ok = marker in text
    print(f'  {"V" if ok else "X"} {name}')

# Check truncated entries
for name in ['次要女性角色图鉴', '林逸（高管·左眼重伤）']:
    pattern = "{'comment': '" + name + "'"
    idx = text.find(pattern)
    if idx >= 0:
        cstart = text.find("'content': '", idx) + 11
        cend = text.find("', 'enabled'", cstart)
        content = text[cstart:cend]
        print(f'  Length of {name}: {len(content)} 字')
        if len(content) < 200:
            print(f'    TRUNCATED! First 150: {content[:150]}')
    else:
        print(f'  {name}: NOT FOUND')
