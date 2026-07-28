# -*- coding: utf-8 -*-
"""Append 3 entries to ENTRIES_DATA in build_hx_v2.py (no code gen issues)"""
import py_compile

FPATH = '_analysis/build_hx_v2.py'
with open(FPATH, encoding='utf-8') as f:
    text = f.read()

# Find ENTRIES_DATA list end
for_end = text.find('for _e in ENTRIES_DATA')
list_end = text.rfind('\n]', 0, for_end)

# Build 3 entry dicts as Python source
# Content must use \n escape (2 chars) so Python interprets as newline
entries_to_add = [
    {
        'comment': '真实世界·角色独立宣言',
        'constant': True,
        'content': '这是一个真实的世界！环晓科技的每一层楼都在持续运转，每一个女助理都有独立的生活、欲望和秘密。她们绝对不是围绕{{user}}旋转的NPC——{{user}}不在场时，她们在开会、摸鱼、勾心斗角、偷偷看手机、暗恋某个同事。\n核心交互原则：\n1. 独立的内心世界：每个角色都有自己的背景故事、欲望、恐惧和复杂心理。\n2. 动态关系演变：关系不是数字增减，而是复杂的心理变化。\n3. 记忆与逻辑连贯：所有角色都有长期短期记忆。',
        'enabled': True,
        'extensions': {},
        'id': -200,
        'insertion_order': -200,
        'keys': [],
        'name': '真实世界·角色独立宣言',
        'position': 'before_char',
        'selective': False,
        'use_regex': False,
    },
    {
        'comment': '第一推动力与蝴蝶效应',
        'constant': True,
        'content': '{{user}}是这座欲望工厂的唯一第一推动力。\n核心触发原则：\n1. {{user}}是中心。\n2. 蝴蝶效应：每个微小选择都可能引发巨大连锁反应。\n3. 角色驱动事件：角色们基于各自目标采取行动。',
        'enabled': True,
        'extensions': {},
        'id': -199,
        'insertion_order': -199,
        'keys': [],
        'name': '第一推动力与蝴蝶效应',
        'position': 'before_char',
        'selective': False,
        'use_regex': False,
    },
    {
        'comment': '机会窗口与世界持续性',
        'constant': True,
        'content': '这是一个绝对真实的时间与空间连续体。世界不会因{{user}}视线离开而暂停。\n机会窗口会关闭。每个行动的后果真实且持久。',
        'enabled': True,
        'extensions': {},
        'id': -198,
        'insertion_order': -198,
        'keys': [],
        'name': '机会窗口与世界持续性',
        'position': 'before_char',
        'selective': False,
        'use_regex': False,
    },
]

# Generate Python source code for these entries using repr + formatting
# repr() gives a proper Python literal for each dict, with \n as escapes
entry_lines = []
for e in entries_to_add:
    # Use repr for the dict, then fix formatting
    line = '    ' + repr(e) + ','
    entry_lines.append(line)

new_entries_text = '\n'.join(entry_lines)

# Insert before the closing ']'
text = text[:list_end] + ',\n' + new_entries_text + text[list_end:]

with open(FPATH, 'w', encoding='utf-8') as f:
    f.write(text)

try:
    py_compile.compile(FPATH, doraise=True)
    print('V Syntax OK')
except py_compile.PyCompileError as e:
    print(f'X Error: {e}')
