import json, re
with open(r'C:\Users\w\Desktop\mywork\Study\Recreation\催眠助理·环晓科技 v1重构版.json', 'r', encoding='utf-8') as f:
    card = json.load(f)

print('=== first_mes ===')
print(repr(card['data']['first_mes']))

print('\n=== alternate_greetings[0] ===')
print(repr(card['data']['alternate_greetings'][0]))

print('\n=== hx-html regex ===')
for r in card['data']['extensions']['regex_scripts']:
    fr = r.get('findRegex', '')
    if 'HX-COVER' in fr or 'HX-OPENING' in fr or 'hx-html' in fr:
        print(f'findRegex: {repr(fr)}')
        print(f'placement: {r.get("placement")}')
        print(f'markdownOnly: {r.get("markdownOnly")}')
        # 测试匹配
        if 'HX-COVER' in fr:
            m = re.search(fr, card['data']['first_mes'])
            print(f'匹配 first_mes: {bool(m)}')
        if 'HX-OPENING' in fr:
            m = re.search(fr, card['data']['alternate_greetings'][0])
            print(f'匹配 alternate_greetings[0]: {bool(m)}')
        print()
