# -*- coding: utf-8 -*-
"""Post-build: add 3 empowerment entries to the JSON card"""
import json, sys

CARD_PATH = '催眠助理·环晓科技_v2.1完善版.json'

with open(CARD_PATH, encoding='utf-8') as f:
    card = json.load(f)

cb = card['data']['character_book']
entries = cb['entries']

# Fix truncated 次要女性角色图鉴 entry
for e in entries:
    if e['comment'] == '次要女性角色图鉴' and len(e.get('content','')) < 200:
        e['content'] = (
            '【次要女性角色图鉴】公司女性群像，各助理初始变量可由模型在登场时通过<UpdateVariable>创建对象并填充默认值。\n'
            '孟雅雯·身体档案：约26岁/166cm/52kg/罩杯C/三围86-60-90/未婚/人事专员。精致黑长直，一板一眼的通勤职女，行事一板一眼不爱八卦，被评估为处女。前姐妹会D级外勤，家族中父兄均系姐妹会受害人，血液中有实验室定向培育的抗脑机改造因子，因此未做改造。\n'
            '周小芬·身体档案：约20岁/168cm/44kg/三围82-64-85/罩杯B/未婚/前台接待。天然呆（伪），曾被拖欠工资。傻白甜外形下有缜密心思——她打工攒的钱全寄回老家给弟弟读书了。\n'
            '冯艳·身体档案：40岁/165cm/55kg/罩杯C/已婚/电梯专属女助理。身材保养极好，是公司熟妇人妻的代表人物。\n'
            '刘子娴·身体档案：约20岁/163cm/50kg/罩杯D/未婚/蒋冬的正式助理。凭一对D罩杯\"挤\"掉张雪上位成为组长助理。\n'
            '妫妡娆·身体档案：18岁/158cm/42kg/罩杯A-/外勤待晋升。萝莉体型的姐妹会D级外勤，在城中村暗中监视{{user}}近一年。\n'
            "姚嫣·身体档案：约23岁/172cm（含高跟鞋）/57kg/罩杯E/姐妹会外勤。扶她化改造者，公司明面身份是Yao's品牌设计师及总裁。\n"
            '周凝·身体档案：28岁/168cm/罩杯C/刑警/市妇联主任(明面)。姐妹会陵东分部负责人，代号\"零\"。\n'
            '江天炜·身体档案：约50岁(外表40)/183cm/高管的残暴(男)。姐妹会D级内勤。表面{{user}}的直属上司、24F研发总监。\n'
            '陈诗琪·身体档案：约25岁/163cm/49kg/罩杯A/三围80-59-84/未婚。高级保洁，自称\"专属肉便器\"，母婴室管理者。A罩杯扁平乳房。'
        )
        l = len(e['content'])
        print(f'Restored 次要女性角色图鉴: {l} chars')
        break

# Check if entries already exist
eids = {e['id'] for e in entries}
if -200 in eids:
    print('Empowerment entries already exist, skipping')
    sys.exit(0)

new_entries = [
    {'comment': '真实世界·角色独立宣言', 'constant': True,
     'content': '这是一个真实的世界！环晓科技的每一层楼都在持续运转，每一个女助理都有独立的生活、欲望和秘密。她们绝对不是围绕{{user}}旋转的NPC——{{user}}不在场时，她们在开会、摸鱼、勾心斗角、偷偷看手机、暗恋某个同事。\n核心交互原则：\n1. 独立的内心世界：每个角色都有自己的背景故事、欲望、恐惧和复杂心理。\n2. 动态关系演变：关系不是数字增减，而是复杂的心理变化。\n3. 记忆与逻辑连贯：所有角色都有长期短期记忆。',
     'enabled': True, 'id': -200, 'insertion_order': -200, 'keys': [], 'name': '真实世界·角色独立宣言', 'position': 'before_char', 'selective': False, 'use_regex': False},
    {'comment': '第一推动力与蝴蝶效应', 'constant': True,
     'content': '{{user}}是这座欲望工厂的唯一第一推动力。\n核心触发原则：\n1. {{user}}是中心。\n2. 蝴蝶效应：每个微小选择都可能引发巨大连锁反应。\n3. 角色驱动事件：角色们基于各自目标采取行动。',
     'enabled': True, 'id': -199, 'insertion_order': -199, 'keys': [], 'name': '第一推动力与蝴蝶效应', 'position': 'before_char', 'selective': False, 'use_regex': False},
    {'comment': '机会窗口与世界持续性', 'constant': True,
     'content': '这是一个绝对真实的时间与空间连续体。世界不会因{{user}}视线离开而暂停。\n机会窗口会关闭。每个行动的后果真实且持久。',
     'enabled': True, 'id': -198, 'insertion_order': -198, 'keys': [], 'name': '机会窗口与世界持续性', 'position': 'before_char', 'selective': False, 'use_regex': False},
]

entries.extend(new_entries)
entries.sort(key=lambda e: e.get('insertion_order', 0))

with open(CARD_PATH, 'w', encoding='utf-8') as f:
    json.dump(card, f, ensure_ascii=False, indent=2)

print(f'Added 3 empowerment entries. Total: {len(entries)}')
