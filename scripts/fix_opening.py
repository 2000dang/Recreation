import re

path = r'C:\Users\w\Desktop\mywork\Study\Recreation\dist\V20260721\开局.html'
with open(path, 'r', encoding='utf-8') as f:
    html = f.read()

changes = []

# === 1. 步骤导航：删除"② 能力评估"，剩下三步重新编号 ===
old_nav = '''  <div class="step-nav">
    <div class="step active" data-step="1"><span class="tt">① 身份登记</span></div>
    <div class="step" data-step="2"><span class="tt">② 能力评估</span></div>
    <div class="step" data-step="3"><span class="tt">③ 资源与模式</span></div>
    <div class="step" data-step="4"><span class="tt">④ 确认降临</span></div>
  </div>'''
new_nav = '''  <div class="step-nav">
    <div class="step active" data-step="1"><span class="tt">① 身份登记</span></div>
    <div class="step" data-step="2"><span class="tt">② 资源与模式</span></div>
    <div class="step" data-step="3"><span class="tt">③ 入职公司</span></div>
  </div>'''
html = html.replace(old_nav, new_nav)
changes.append('步骤导航 4→3步')

# === 2. 删除 pane-2 整个区块 (能力评估) ===
pane2_start = html.find('<!-- STEP 2: 能力评估 -->')
pane3_comment = html.find('<!-- STEP 3: 资源与模式 -->')
if pane2_start != -1 and pane3_comment != -1:
    html = html[:pane2_start] + html[pane3_comment:]
    changes.append('删除 pane-2 (能力评估)')

# === 3. pane-3 → pane-2: 重命名id ===
html = html.replace('id="pane-3"', 'id="pane-2"')
html = html.replace('id="pane-4"', 'id="pane-3"')
html = html.replace('<!-- STEP 3: 资源与模式 -->', '<!-- STEP 2: 资源与模式 -->')
html = html.replace('<!-- STEP 4: 确认 -->', '<!-- STEP 3: 入职公司 -->')
changes.append('pane id 重新编号 (3→2, 4→3)')

# === 4. 删除 催眠工具 form-group ===
tool_block = '''      <div class="grid-2">
        <div class="form-group">
          <label>催眠工具</label>
          <select class="form-control" id="f-tool">
            <option value="无">无</option>
            <option value="基础催眠仪">基础催眠仪</option>
            <option value="神经接口手环">神经接口手环</option>
            <option value="脑机同步耳机" selected>脑机同步耳机</option>
          </select>
        </div>
      </div>'''
if tool_block in html:
    html = html.replace(tool_block, '')
    changes.append('删除 催眠工具 选择器')

# === 5. 简化破解模式为2选项 ===
old_crack = '''      <div class="section-title" style="margin-top:18px">破解模式</div>
      <div class="crack-options">
        <div class="crack-card" data-crack="关闭">
          <div class="crack-name">🔒 关闭</div>
          <div class="crack-desc">标准游戏模式，系统规则严格生效。推荐首次体验。</div>
        </div>
        <div class="crack-card" data-crack="基础">
          <div class="crack-name">🔓 基础</div>
          <div class="crack-desc">解锁部分限制，可见隐藏变量，获得更多操控空间。</div>
        </div>
        <div class="crack-card selected" data-crack="深度">
          <div class="crack-name">⚡ 深度</div>
          <div class="crack-desc">完全曝光系统后台，自由操控角色、事件与剧情走向。</div>
        </div>
      </div>
      <input type="hidden" id="f-crack" value="深度">'''
new_crack = '''      <div class="section-title" style="margin-top:18px">破解模式</div>
      <div class="crack-options">
        <div class="crack-card selected" data-crack="关闭">
          <div class="crack-name">🔒 普通模式</div>
          <div class="crack-desc">标准规则，贡献点经济与权限体系正常运作。推荐首次体验。</div>
        </div>
        <div class="crack-card" data-crack="开启">
          <div class="crack-name">⚡ 绝对权限</div>
          <div class="crack-desc">获取系统最高管理权限，所有限制解除，贡献点无限，自由操控一切。</div>
        </div>
      </div>
      <input type="hidden" id="f-crack" value="关闭">'''
html = html.replace(old_crack, new_crack)
changes.append('破解模式 3选1→2选1(普通/绝对权限)，默认普通')

# === 6. 确认页标题和按钮 ===
html = html.replace('<div class="section-title">建档确认</div>',
                      '<div class="section-title">入职确认</div>')
html = html.replace('降临 · 开始剧情',
                      '入职 · 开始剧情')
html = html.replace('跳过建档，默认开局',
                      '快速入职，默认开局')
changes.append('第3步标题和按钮文案')

# === 7. JS: TOTAL_STEPS ===
html = html.replace('var POOL = 40, curStep = 1, TOTAL_STEPS = 4;',
                     'var curStep = 1, TOTAL_STEPS = 3;')
changes.append('TOTAL_STEPS 4→3, 移除 POOL')

# === 8. JS: 删除属性系统全部代码 ===
attr_start = html.find('// === 属性系统 ===')
crack_js_comment = html.find('// === 破解模式 ===')
if attr_start != -1 and crack_js_comment != -1:
    html = html[:attr_start] + html[crack_js_comment:]
    changes.append('删除属性系统JS (handleAttrDelta/updateAttrUI/attr事件)')

# === 9. JS: setStep 中去掉 updateAttrUI 调用 ===
old_setstep = '''    // 步骤3初始化破解卡片
    if(n===3) initCrackCards();
    // 步骤2初始化属性面板
    if(n===2) updateAttrUI();
    reportHeight();'''
new_setstep = '''    // 步骤2初始化破解卡片
    if(n===2) initCrackCards();
    reportHeight();'''
html = html.replace(old_setstep, new_setstep)
changes.append('修正 setStep 破解卡片初始化步骤号 3→2')

# === 10. JS: validateStep 修正 ===
old_vs_attr = '''    if(n===2){
      if(poolLeft()<0){ e.textContent='属性点数超限（精神+身体基准10，剩余从40点池分配）'; return false; }
    }
    if(n===3){'''
html = html.replace(old_vs_attr, '''    if(n===2){''')
changes.append('删除旧 step2 属性验证')

old_vs_err = "if(isNaN(cr)||cr<0){ e.textContent='贡献点须为非负整数'; return false; }\n      if(isNaN(mo)||mo<0){ e.textContent='资金须为非负整数'; return false; }"
new_vs_err = "if(isNaN(cr)||cr<0){ $('err-2').textContent='贡献点须为非负整数'; return false; }\n      if(isNaN(mo)||mo<0){ $('err-2').textContent='资金须为非负整数'; return false; }"
html = html.replace(old_vs_err, new_vs_err)
changes.append('修正 validateStep err-2 引用')

# === 11. JS: collect() 移除属性和工具字段 ===
old_collect = '''      rank: $('f-rank').value,
      mental: getAttr('mental'),
      phys: getAttr('phys'),
      hypAuth: getAttr('hyp'),
      credit: parseInt($('f-credit').value,10)||0,
      money: parseInt($('f-money').value,10)||0,
      tool: $('f-tool').value,
      crackMode: $('f-crack').value'''
new_collect = '''      rank: $('f-rank').value,
      credit: parseInt($('f-credit').value,10)||0,
      money: parseInt($('f-money').value,10)||0,
      crackMode: $('f-crack').value'''
html = html.replace(old_collect, new_collect)
changes.append('collect() 移除 mental/phys/hypAuth/tool')

# === 12. JS: buildSummary() 移除属性行 ===
old_summary = '''      ['姓名', d.name], ['性别', d.gender], ['年龄', d.age+'岁'],
      ['部门', d.dept], ['工号', d.empId], ['职级', d.rank],
      ['精神韧性', d.mental+' [ '+tierLabel(d.mental,'mental')+' ]'],
      ['身体素质', d.phys+' [ '+tierLabel(d.phys,'phys')+' ]'],
      ['催眠权限', 'Lv.'+d.hypAuth+' [ '+tierLabel(d.hypAuth,'hyp')+' ]'],
      ['催眠工具', d.tool],
      ['贡献点', String(d.credit)], ['个人资金', '¥'+String(d.money)],
      ['破解模式', d.crackMode]'''
new_summary = '''      ['姓名', d.name], ['性别', d.gender], ['年龄', d.age+'岁'],
      ['部门', d.dept], ['工号', d.empId], ['职级', d.rank],
      ['贡献点', String(d.credit)], ['个人资金', '¥'+String(d.money)],
      ['破解模式', d.crackMode==='关闭'?'普通模式':'绝对权限']'''
html = html.replace(old_summary, new_summary)
changes.append('buildSummary() 移除属性行')

# === 13. JS: buildPrompt() 移除能力评估段落 ===
old_prompt_part = '''    parts.push('');
    parts.push('【能力评估】');
    parts.push('精神韧性：'+d.mental+' [ '+tierLabel(d.mental,'mental')+' ]');
    parts.push('身体素质：'+d.phys+' [ '+tierLabel(d.phys,'phys')+' ]');
    parts.push('催眠权限等级：Lv.'+d.hypAuth+' [ '+tierLabel(d.hypAuth,'hyp')+' ]');
    if(d.tool!=='无') parts.push('配备工具：'+d.tool);
    parts.push('');'''
if old_prompt_part in html:
    html = html.replace(old_prompt_part, '')
    changes.append('buildPrompt() 移除能力评估/工具段落')

# === 14. JS: buildPrompt() 破解模式文案 ===
old_crack_prompt = "parts.push('破解模式：'+(d.crackMode==='关闭'?'标准游戏规则':d.crackMode==='基础'?'部分系统解锁':'完全系统曝光'));"
new_crack_prompt = "parts.push('破解模式：'+(d.crackMode==='关闭'?'普通模式':'绝对权限'));"
html = html.replace(old_crack_prompt, new_crack_prompt)
changes.append('buildPrompt() 破解模式文案简化')

# === 15. JS: buildPrompt() 暗线 ===
old_crack_dark = "parts.push('4. 暗线铺垫：破解模式 '+d.crackMode+' 已激活。"
new_crack_dark = "parts.push('4. 暗线铺垫：绝对权限模式已激活。"
html = html.replace(old_crack_dark, new_crack_dark)
changes.append('buildPrompt() 破解暗线文案')

# === 16. JS: buildPrompt() 变量接入 ===
old_var_note = "parts.push('7. 变量接入：角色属性已写入MVU系统。请基于精神状态('+d.mental+')、身体状况('+d.phys+')自然体现在叙事中（如精力充沛、疲惫、敏锐等）。');"
new_var_note = "parts.push('7. 变量接入：角色档案已写入MVU系统。请基于职级与部门自然体现在叙事中。');"
html = html.replace(old_var_note, new_var_note)
changes.append('buildPrompt() 变量接入改为职级/部门')

# === 17. JS: syncMVU() 移除属性字段 ===
old_sync = """      var ps = cloned.stat_data['主角状态'];
      win._.set(ps, '工号', d.empId);
      win._.set(ps, '职级', d.rank);
      win._.set(ps, '贡献点', d.credit);
      win._.set(ps, '个人金钱', d.money);
      win._.set(ps, '精神状态', d.mental);
      win._.set(ps, '身体状况', tierLabel(d.phys,'phys'));
      win._.set(ps, '催眠权限等级', d.hypAuth);
      win._.set(ps, '破解模式', d.crackMode!=='关闭');"""
new_sync = """      var ps = cloned.stat_data['主角状态'];
      win._.set(ps, '工号', d.empId);
      win._.set(ps, '职级', d.rank);
      win._.set(ps, '贡献点', d.credit);
      win._.set(ps, '个人金钱', d.money);
      win._.set(ps, '破解模式', d.crackMode!=='关闭');"""
html = html.replace(old_sync, new_sync)
changes.append('syncMVU() 移除属性字段')

# === 18. JS: syncMVU fallback ===
old_fallback = """          win.Mvu.updateVariable('主角状态', {
            工号:d.empId, 职级:d.rank, 贡献点:d.credit, '个人金钱':d.money,
            '精神状态':d.mental, '身体状况':tierLabel(d.phys,'phys'), '催眠权限等级':d.hypAuth,
            '破解模式':d.crackMode!=='关闭'
          });"""
new_fallback = """          win.Mvu.updateVariable('主角状态', {
            工号:d.empId, 职级:d.rank, 贡献点:d.credit, '个人金钱':d.money,
            '破解模式':d.crackMode!=='关闭'
          });"""
html = html.replace(old_fallback, new_fallback)
changes.append('syncMVU fallback 移除属性字段')

# === 19. JS: 初始化清理 ===
old_init = """  window.addEventListener('load',function(){
    updateAttrUI();
    document.querySelector('.crack-card[data-crack="深度"]').classList.add('selected');
    reportHeight();
    setTimeout(reportHeight,300);"""
new_init = """  window.addEventListener('load',function(){
    reportHeight();
    setTimeout(reportHeight,300);"""
html = html.replace(old_init, new_init)
changes.append('删除 load 初始化中旧代码')

# === 20. skipDescend 修复 ===
old_skip_func = "d.crackMode = '关闭';\n    syncMVU(d);\n    var p = '【环晓科技 · 默认开局】"
new_skip_func = "d.credit = d.credit||100;\n    d.money = d.money||5000;\n    d.crackMode = '关闭';\n    syncMVU(d);\n    var p = '【环晓科技 · 默认开局】"
html = html.replace(old_skip_func, new_skip_func)
changes.append('skipDescend 补齐 credit/money 默认值')

# === 21. err-msg id 重新编号 ===
html = html.replace('id="err-3"', 'id="err-2"')
html = html.replace('id="err-4"', 'id="err-3"')
changes.append('err-msg id 重新编号 (3→2, 4→3)')

# === 22. 清理 desc 中的 err 引用 ===
html = html.replace("$('err-4').textContent='请返回第一步填写姓名'; setStep(1);",
                     "$('err-3').textContent='请返回第一步填写姓名'; setStep(1);")
changes.append('descend() err-4→err-3')

# 写入
with open(path, 'w', encoding='utf-8') as f:
    f.write(html)

print('=== 开局.html 改造完成 ===')
for i, c in enumerate(changes, 1):
    print(f'  {i:2d}. {c}')

step_count = len(re.findall(r'<div class="step[^"]*" data-step="', html))
pane_count = len(re.findall(r'class="step-pane', html))
print(f'\n验证: {step_count} 个步骤导航, {pane_count} 个面板 (应为 3/3)')
print(f'文件大小: {len(html):,} 字节')

for term in ['mental', 'phys', 'hypAuth', 'f-tool', 'poolLeft', 'updateAttrUI', 'handleAttrDelta', 'getAttr']:
    status = '⚠ 残留' if term in html else '✓ 已清除'
    print(f'{status}: {term}')
