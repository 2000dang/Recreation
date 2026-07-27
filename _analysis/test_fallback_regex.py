# -*- coding: utf-8 -*-
"""模拟测试「裸JSONPatch兜底折叠」正则（JS /.../g -> Python re）"""
import re

# JS: /(^|\n)((?:```(?:json)?[ \t]*\n)?[ \t]*\[\s*\{\s*"op"[\s\S]*?\}\s*,?\s*\](?:[ \t]*\n```)?)(?![ \t\r\n]*<\/JSONPatch>)/g
PAT = re.compile(
    r'(^|\n)((?:```(?:json)?[ \t]*\n)?[ \t]*\[\s*\{\s*"op"[\s\S]*?\}\s*,?\s*\](?:[ \t]*\n```)?)(?![ \t\r\n]*</JSONPatch>)'
)
REPL = r'\1<details><summary>催眠印记</summary>\n\n\2\n</details>'

def run(name, text, expect_match):
    m = PAT.search(text)
    ok = (m is not None) == expect_match
    print(f"[{'PASS' if ok else 'FAIL'}] {name}: match={m is not None} (expect {expect_match})")
    if m and expect_match:
        out = PAT.sub(REPL, text)
        leaked = re.search(r'^\s*\[\s*\{\s*"op"', out.replace('<details><summary>催眠印记</summary>', ''), re.M)
        print(f"       折叠后裸露检查: {'仍裸露!' if leaked and '<details>' not in out else 'OK 已包进 details'}")
    return ok

results = []

# 1. 截图场景：正文 + 裸 [] patch（无标签）
t1 = '''杨玉兰皱起眉头看着你。

Variable Analysis: The user asked about hair. Mood shifts to defensive/annoyed.
[
  { "op": "replace", "path": "/环境/时间", "value": "上午10:30" },
  { "op": "replace", "path": "/助理管理/正式助理.杨玉兰/情绪", "value": "警惕" }
]'''
results.append(run('裸[]泄漏(截图场景)', t1, True))

# 2. 合法输出：包在 <JSONPatch> 内 → 不应匹配（避免双重折叠）
t2 = '''<UpdateVariable>
<Analysis>time passed 5 min</Analysis>
<JSONPatch>
[
  { "op": "replace", "path": "/环境/时间", "value": "上午10:35" }
]
</JSONPatch>
</UpdateVariable>'''
results.append(run('包在JSONPatch内(合法)', t2, False))

# 3. 普通正文数组 → 不应匹配
t3 = '你面前有三个选项：\n[打招呼, 离开, 观察]\n她还在等你。'
results.append(run('普通中文数组', t3, False))

# 4. 正文里的 markdown 链接/普通 json 数组（无 "op" 键）→ 不应匹配
t4 = '数据如下：\n[\n  { "name": "杨玉兰", "level": 3 }\n]\n以上。'
results.append(run('无op键的json数组', t4, False))

# 5. 代码围栏包着的裸 patch → 应匹配（连围栏一起折叠）
t5 = '''她转身离开了。

```json
[
  { "op": "delta", "path": "/贡献点", "value": 10 }
]
```'''
results.append(run('围栏包裸patch', t5, True))

# 6. 行内数组（非独立成段）→ 不应匹配
t6 = '文档写着 [{ "op": "replace" }] 这样的格式示例。'
results.append(run('行内示例(非行首)', t6, False))

# 7. 多个操作对象、含嵌套 value 的 patch
t7 = '''结束。
[
  { "op": "replace", "path": "/a", "value": { "x": [1,2] } },
  { "op": "insert", "path": "/b/-", "value": "新事件" },
  { "op": "remove", "path": "/c" }
]'''
results.append(run('多op嵌套value', t7, True))

# 8. 折叠后展示效果（场景1）
print('\n--- 场景1折叠输出预览 ---')
print(PAT.sub(REPL, t1))

print('\n总结:', 'ALL PASS' if all(results) else '存在FAIL，需修正!')
