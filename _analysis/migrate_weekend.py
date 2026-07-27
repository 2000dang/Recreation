# -*- coding: utf-8 -*-
"""将周末直接编辑的 JSON 改动固化进 build_hx_v2.py。

策略：
- 6 个 MVU 引擎条目(9900/9999/99996/99997/10000/10001)保持原 E() 调用不变
  （它们未被改动，E() 可精确复现）。
- 其余 123 个非 MVU 条目以完整保真 dict 字面量写入构建脚本，
  保留 use_regex/selective/secondary_keys/group/priority 等所有字段
  （E() 写死 use_regex=False，会破坏周末版的触发方式，故不能直接用 E()）。
- 条目按周末 JSON 的自然顺序输出，保证重建后列表顺序一致。
"""
import json
import io

WJ = '催眠助理·环晓科技_v2.1完善版.json'
SRC = '_analysis/build_hx_v2.py'

MVU_IDS = {9900, 9999, 99996, 99997, 10000, 10001}

with open(WJ, encoding='utf-8') as f:
    wj = json.load(f)
wj_entries = wj['data']['character_book']['entries']

# 生成 ENTRIES_DATA 区块
buf = io.StringIO()
buf.write('# ============ 世界书条目（数据驱动，源自周末更新版 JSON） ============\n')
buf.write('# 注意：此区块由 migrate_weekend.py 从当前 JSON 自动生成。\n')
buf.write('# 如需手动增删条目，请改 JSON 后重跑 migrate_weekend.py，不要手工编辑此列表。\n')
buf.write('ENTRIES_DATA = [\n')
for e in wj_entries:
    if e['id'] in MVU_IDS:
        continue
    lit = repr(e)
    buf.write('    ' + lit + ',\n')
buf.write(']\n')
buf.write('\n')
buf.write('for _e in ENTRIES_DATA:\n')
buf.write('    entries.append(_e)\n')

generated = buf.getvalue()

with open(SRC, encoding='utf-8') as f:
    text = f.read()

# 定位替换区间：从 "CONTENT = [" 或已生成的 "ENTRIES_DATA = [" 到 "# ============ 4. Regex" 之前
# （支持重入：首次替换 CONTENT 区块，之后若再跑则从 ENTRIES_DATA 区块替换）
end_marker = '# ============ 4. Regex'
if 'CONTENT = [' in text:
    start_marker = 'CONTENT = ['
elif 'ENTRIES_DATA = [' in text:
    start_marker = 'ENTRIES_DATA = ['
else:
    raise SystemExit('找不到 CONTENT 或 ENTRIES_DATA 标记')

si = text.index(start_marker)
ei = text.index(end_marker)
# 保留 end_marker 之前的换行清理
prefix = text[:si]
suffix = text[ei:]

new_text = prefix + generated + '\n' + suffix

with open(SRC, 'w', encoding='utf-8') as f:
    f.write(new_text)

print('已替换构建脚本条目区块。')
print('ENTRIES_DATA 条目数:', sum(1 for e in wj_entries if e['id'] not in MVU_IDS))
