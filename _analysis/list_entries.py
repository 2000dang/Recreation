import re
with open('_analysis/build_hx_v2.py', 'r', encoding='utf-8') as f:
    content = f.read()

# Find entry dicts -- look for comment + id patterns
parts = content.split("'comment':")
for p in parts[1:]:
    # Extract comment name
    end = p.find("'")
    comment = p[:end]
    # Find id
    idmatch = re.search(r"'id':\s*(\d+)", p)
    eid = idmatch.group(1) if idmatch else "???"
    # Find keys
    keysmatch = re.search(r"'keys':\s*\[([^\]]*)\]", p)
    keys = keysmatch.group(1) if keysmatch else ""
    print(f"{eid:>6}: {comment}")
