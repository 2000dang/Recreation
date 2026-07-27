import json, re

path = r'C:\Users\w\Desktop\mywork\Study\Recreation\催眠助理·环晓科技 v1重构版.json'
opening_path = r'C:\Users\w\Desktop\mywork\Study\Recreation\dist\V20260721\开局.html'

# 读开局.html
with open(opening_path, 'r', encoding='utf-8') as f:
    opening_html = f.read()

# 提取 body 内容
body_match = re.search(r'<body[^>]*>(.*?)</body>', opening_html, re.DOTALL)
body_content = re.sub(r'<script[^>]*>.*?</script>', '', body_match.group(1), flags=re.DOTALL).strip() if body_match else opening_html

# 提取 style
style_match = re.search(r'<style[^>]*>(.*?)</style>', opening_html, re.DOTALL)
raw_style = style_match.group(1) if style_match else ''

# 清理 CSS: 去掉 html/body 选择器, 加 .hx-opening 作用域
cleaned_style = re.sub(r'\s*html,?body\s*\{[^}]*\}\s*', '\n', raw_style)
cleaned_style = re.sub(r'\s*\*[^{]*\{[^}]*\}\s*', '\n', cleaned_style)

# 把 :root 的 CSS 变量复制到 .hx-opening
root_match = re.search(r':root\s*\{([^}]*)\}', cleaned_style)
if root_match:
    root_vars = root_match.group(1)
    new_root = f':root, .hx-opening {{{root_vars}}}'
    cleaned_style = cleaned_style.replace(root_match.group(0), new_root)
else:
    new_root = ':root, .hx-opening {--bg:#080a10;--surface:#10131e;--surface2:#181d2c;--accent:#5fd0ff;--accent-d:#2b7fa8;--accent-bright:#8be0ff;--text:#e2e8f0;--sub:#8899aa;--sub2:#5c6b7c;--ok:#22c55e;--warn:#f59e0b;--danger:#ef4444;--info:#3b82f6;--border:rgba(95,208,255,.22);--border-light:rgba(255,255,255,.06);--input-bg:rgba(0,0,0,.35);--card-bg:var(--surface2);--radius-sm:3px;--radius-md:5px;--radius-lg:8px;--shadow:0 4px 20px rgba(0,0,0,.45);--shadow-lg:0 0 30px rgba(0,0,0,.7);--tf:.2s;--tn:.3s;--font-mono:Consolas,Courier New,monospace;}'
    cleaned_style = new_root + '\n' + cleaned_style

# 加 .hx-opening 作用域
def scope(text):
    result = []
    i = 0
    while i < len(text):
        brace_idx = text.find('{', i)
        if brace_idx == -1:
            result.append(text[i:])
            break
        depth = 1
        end = brace_idx + 1
        while end < len(text) and depth > 0:
            if text[end] == '{': depth += 1
            elif text[end] == '}': depth -= 1
            end += 1
        if depth != 0:
            result.append(text[i:])
            break
        selector = text[i:brace_idx]
        body = text[brace_idx+1:end-1]
        if ':root' in selector or '.hx-opening' in selector:
            result.append(text[i:end])
        elif selector.strip().startswith('@'):
            result.append(text[i:end])
        else:
            new_selectors = []
            for s in selector.split(','):
                s = s.strip()
                if not s: continue
                if s.startswith('.') and not s.startswith('.hx-opening'):
                    new_selectors.append('.hx-opening ' + s)
                elif s in ('html', 'body', 'html,body'):
                    continue
                else:
                    new_selectors.append(s)
            if new_selectors:
                result.append(', '.join(new_selectors) + ' {' + body + '}')
        i = end
    return ''.join(result)

cleaned_style = scope(cleaned_style)

# 构建开局 inline HTML
inline_opening = '<div class="hx-opening">' + cleaned_style + body_content + '</div>'
inline_opening_wrapped = '```text\n' + inline_opening + '\n```'

print(f'Opening HTML size: {len(inline_opening_wrapped)} 字符')

# 更新卡
with open(path, 'r', encoding='utf-8') as f:
    card = json.load(f)

# 找 开局 regex (findRegex = ==HX-OPENING==) 并替换 replaceString
for r in card['data']['extensions']['regex_scripts']:
    if r.get('findRegex') == '==HX-OPENING==':
        r['replaceString'] = inline_opening_wrapped
        print(f'更新开局 regex: 长度 {len(r["replaceString"])} 字符')
        break

with open(path, 'w', encoding='utf-8') as f:
    json.dump(card, f, ensure_ascii=False, indent=2)
print('Saved')
