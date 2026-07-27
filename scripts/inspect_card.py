import json
with open(r'C:\Users\w\Desktop\mywork\Study\Recreation\催眠助理·环晓科技 v1重构版.json', 'r', encoding='utf-8') as f:
    card = json.load(f)
for r in card['data']['extensions']['regex_scripts']:
    if r.get('scriptName') == '外部页面注入':
        rs = r['replaceString']
        print('Total len:', len(rs))
        print('First 30 chars:', repr(rs[:30]))
        print('Last 30 chars:', repr(rs[-30:]))
        # 取出 code block 内部
        if rs.startswith('```text') and rs.endswith('```'):
            inner = rs[7:-3]
            print('Inner len:', len(inner))
            print('Inner start:', repr(inner[:200]))
            print('Inner end:', repr(inner[-200:]))
        else:
            print('Not properly wrapped')
            print('starts with ```:', rs.startswith('```'))
            print('ends with ```:', rs.endswith('```'))
