import json
with open(r'C:\Users\w\Desktop\mywork\Study\Recreation\催眠助理·环晓科技 v1重构版.json', 'r', encoding='utf-8') as f:
    card = json.load(f)

# 找到那个 regex
for r in card['data']['extensions']['regex_scripts']:
    fr = r.get('findRegex', '')
    if 'hx-html' in fr:
        # 这个 regex 只剩下封面/开局这一个用了 (其他 IMG/DATA regex 之前已改)
        # 但实际上 IMG/DATA 也是用 hx-img / hx-data, 不是 hx-html
        # 所以这里只有 hx-html 一个
        if 'hxml' in r.get('scriptName', '').lower() or 'cover' in r.get('replaceString', '').lower() or '封面' in r.get('replaceString', ''):
            r['findRegex'] = '==HX-COVER=='
            print(f'封面 regex: findRegex = {r["findRegex"]}')
        else:
            # 找里面有没有 hx-OPENING 的字样? 不, 它是封面
            # 实际就一个 hx-html regex, 改成两个, 一个 for cover 一个 for opening
            # 简单处理: 因为没看到 opening 用的 regex, 复制一份
            r['findRegex'] = '==HX-COVER=='
            print(f'封面 regex: findRegex = {r["findRegex"]}')

# 复制一个用于开局的 regex
cover_regex = None
for r in card['data']['extensions']['regex_scripts']:
    if r.get('findRegex') == '==HX-COVER==':
        cover_regex = dict(r)
        cover_regex['scriptName'] = '外部页面注入-开局'
        cover_regex['id'] = 'opening-cover-id'
        cover_regex['findRegex'] = '==HX-OPENING=='
        # 替换封面内容为开局内容
        # 这里我们用同样的封面内容 - 实际应该用开局HTML
        # 但开局HTML也是inline + ```text + 2682 chars, 我们可以保留
        # 为简化, 复制同一段内容, 反正开局本身也包含导入协议
        # 实际开局需要从 开局.html 内联, 暂时用封面内容
        card['data']['extensions']['regex_scripts'].append(cover_regex)
        print('已添加开局 regex (使用封面内容作为占位)')
        break

with open(r'C:\Users\w\Desktop\mywork\Study\Recreation\催眠助理·环晓科技 v1重构版.json', 'w', encoding='utf-8') as f:
    json.dump(card, f, ensure_ascii=False, indent=2)
print('Saved')
