# -*- coding: utf-8 -*-
import json

PATH = r"C:\Users\w\Desktop\mywork\Study\Recreation\【都市美艳后宫】.json"
data = json.load(open(PATH, encoding="utf-8"))

print("=== 顶层结构 ===")
print("keys:", sorted(data.keys()))

# 判定格式
if "data" in data and isinstance(data["data"], dict) and "name" in data["data"]:
    fmt = "Risu/CAI 包裹 (data)"
    card = data["data"]
else:
    fmt = "V2 扁平"
    card = data
print("格式:", fmt)
print()

# 核心字段
print("=== 核心字段 ===")
for k in ["name","description","first_mes","personality","scenario","mes_example","system_prompt","post_history_instructions","creator_notes","creatorcomment","character_version","spec","spec_version","tags","talkativeness"]:
    v = card.get(k)
    if v is None:
        print("  %-22s: (无)" % k)
    else:
        if isinstance(v, str):
            print("  %-22s: %d 字, 前80字: %r" % (k, len(v), v[:80]))
        else:
            print("  %-22s: %r" % (k, v))

print()
print("=== system_prompt 全文 ===")
sp = card.get("system_prompt", "")
if sp:
    print(sp[:2000])
    if len(sp) > 2000:
        print("...(共%d字)" % len(sp))
else:
    print("(空)")

print()
print("=== extensions ===")
ext = card.get("extensions", {})
if isinstance(ext, dict):
    for k, v in ext.items():
        if isinstance(v, (dict, list)):
            print("  %-22s: %s, len=%d" % (k, type(v).__name__, len(v)))
        else:
            print("  %-22s: %r" % (k, str(v)[:60]))
    
    # 深入 regex
    regex = ext.get("regex_scripts", [])
    if regex:
        print("\n  --- regex_scripts (%d 条) ---" % len(regex))
        for r in regex:
            if isinstance(r, dict):
                print("    [%s] %s" % (r.get("scriptName","?"), r.get("find","")[:80]))
    
    # 脚本
    scripts = ext.get("scripts", [])
    if scripts:
        print("\n  --- scripts (%d 条) ---" % len(scripts))
        for s in scripts:
            if isinstance(s, dict):
                print("    %s %s" % (s.get("name","?"), (s.get("content","")[:80] if s.get("content") else "")))
else:
    print("  (非dict)")

print()
print("=== character_book ===")
cb = card.get("character_book")
if not cb:
    print("  (无)")
else:
    print("  name:", cb.get("name"))
    print("  scan_depth:", cb.get("scan_depth"))
    print("  token_budget:", cb.get("token_budget"))
    entries = cb.get("entries", [])
    print("  entries: %d 条" % len(entries))
    
    # 查看前10条内容的风格
    print("\n  前10条示例 (ids & names):")
    for e in entries[:10]:
        name = e.get("name","(无)")
        content_preview = (e.get("content","")[:120] if e.get("content") else "")
        keys = e.get("keys", [])
        io = e.get("insertion_order")
        print("    id=%-5s name=%-32s io=%-4s keys=%s" % (e.get("id"), name, io, str(keys[:3])))
        print("      content: %s" % content_preview.replace('\n', '\\n'))

    # 统计常驻条目
    constant_cnt = sum(1 for e in entries if isinstance(e, dict) and e.get("constant"))
    enabled_cnt = sum(1 for e in entries if isinstance(e, dict) and e.get("enabled") != False)
    print("\n  constant: %d 条, enabled: %d 条" % (constant_cnt, enabled_cnt))

    # 查看 id 范围
    ids = [e.get("id") for e in entries if isinstance(e, dict)]
    print("  id 范围: %s ~ %s" % (min(ids), max(ids)))

print()
print("=== avatar ===")
print(repr(card.get("avatar"))[:40])
