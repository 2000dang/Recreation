# -*- coding: utf-8 -*-
"""Fix real newlines in character entry content -> \n escapes"""
with open(r'_analysis/build_hx_v2.py', encoding='utf-8') as f:
    text = f.read()

chars = ['杨玉兰','娄琛雨','秦燕霞','卫璎','赵加莹','姜舞','萧茹','陈丹娜','张雪','颜傲雪（总监级反派）','次要女性角色图鉴']
fixed = 0

for name in chars:
    pat = "{'comment': '" + name + "'"
    idx = text.find(pat)
    if idx < 0:
        print(f'? {name}: not found')
        continue
    
    cstart = text.find("'content': '", idx) + 11
    if cstart < 11:
        print(f'? {name}: no content')
        continue
    cend = text.find("', 'enabled'", cstart)
    if cend < 0:
        cend = text.find("', 'extensions'", cstart)
    if cend < 0:
        cend = text.find("', 'keys'", cstart)
    if cend < 0:
        print(f'? {name}: no content end')
        continue
    
    old = text[cstart:cend]
    if '\n' not in old:
        print(f'- {name}: no real newlines')
        continue
    
    # Real newline to \n escape
    new = old.replace('\n', '\\n')
    text = text[:cstart] + new + text[cend:]
    print(f'V {name}: {len(old)} -> {len(new)}')
    fixed += 1

with open(r'_analysis/build_hx_v2.py', 'w', encoding='utf-8') as f:
    f.write(text)
print(f'\nFixed {fixed} entries')

import py_compile
try:
    py_compile.compile(r'_analysis/build_hx_v2.py', doraise=True)
    print('V Python syntax OK!')
except py_compile.PyCompileError as e:
    print(f'X Syntax error: {e}')
