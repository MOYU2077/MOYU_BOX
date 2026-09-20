// index.js 浆料备料测算（项目下多浆料 · 抽样记录均值）
// 单位：产品按“车”计量；料浆按“升(L)”计量
// 模型：项目级共享“总计划车数 / 已生产车数”；每种浆料各自算单车用量、误差、后补
const MAX_SLURRIES = 12

Page({
  data: {
    projects: [],
    dark: false,
    themeIcon: '🌙'
  },

  onLoad() {
    let t = wx.getStorageSync('jp_theme')
    if (!t) {
      const info = wx.getSystemInfoSync()
      t = (info && info.theme === 'dark') ? 'dark' : 'light'
    }
    this.applyTheme(t === 'dark')
  },

  applyTheme(isDark) {
    this.setData({ dark: isDark, themeIcon: isDark ? '🌙' : '☀️' })
  },

  toggleTheme() {
    const next = !this.data.dark
    this.applyTheme(next)
    wx.setStorageSync('jp_theme', next ? 'dark' : 'light')
  },


  // 新增一个项目卡片（含 1 个默认浆料）
  addProject() {
    const list = this.data.projects
    const first = this.newSlurry(1)
    list.push({
      id: Date.now(),
      name: '项目' + (list.length + 1),
      totalPlan: '',       // 项目总计划车数（车，项目级）
      produced: '',        // 已生产车数（车，项目级，仅手动模式使用）
      manualProduced: false,
      slurries: [ first ],
      activeSlurry: first.id // 当前选中（Tab）的浆料
    })
    this.setData({ projects: list.map(computeProject) })
  },

  newSlurry(no) {
    return {
      id: Date.now() + Math.random(),
      no: String(no),              // 几号浆料（可改名）
      baseSlurry: '',              // 原料间给的基础料浆（L）
      samples: [{ end: '', remain: '' }], // 抽样记录（到第几车结束时剩多少 L，系统算单车用量=(基础料浆-剩余)÷车号）
      actualRemain: ''             // 现场实际剩余（L，选填）
    }
  },

  removeProject(e) {
    const id = e.currentTarget.dataset.id
    this.setData({
      projects: this.data.projects.filter(p => p.id !== id).map(computeProject)
    })
  },

  onNameInput(e) {
    this.updateField(e.currentTarget.dataset.id, 'name', e.detail.value)
  },

  onFieldInput(e) {
    const ds = e.currentTarget.dataset
    this.updateField(ds.id, ds.field, e.detail.value)
  },

  updateField(id, field, value) {
    const list = this.data.projects.map(p => {
      if (p.id === id) p[field] = value
      return p
    })
    this.setData({ projects: list.map(computeProject) })
  },

  // 切换“手动输入已生产”开关（项目级）
  onToggleProduced(e) {
    const id = e.currentTarget.dataset.id
    const list = this.data.projects.map(p => {
      if (p.id === id) p.manualProduced = e.detail.value
      return p
    })
    this.setData({ projects: list.map(computeProject) })
  },

  // 浆料子卡字段输入（no / baseSlurry / actualRemain）
  onSlurryInput(e) {
    const ds = e.currentTarget.dataset
    const list = this.data.projects.map(p => {
      if (p.id === ds.id) {
        p.slurries = p.slurries.map(s => {
          if (s.id === ds.sid) s[ds.field] = e.detail.value
          return s
        })
      }
      return p
    })
    this.setData({ projects: list.map(computeProject) })
  },

  // 选中某个浆料（Tab 切换）
  onSelectSlurry(e) {
    const ds = e.currentTarget.dataset
    const list = this.data.projects.map(p => {
      if (p.id === ds.id) p.activeSlurry = ds.sid
      return p
    })
    this.setData({ projects: list.map(computeProject) })
  },

  addSlurry(e) {
    const id = e.currentTarget.dataset.id
    const list = this.data.projects.map(p => {
      if (p.id === id && p.slurries.length < MAX_SLURRIES) {
        const s = this.newSlurry(p.slurries.length + 1)
        p.slurries.push(s)
        p.activeSlurry = s.id // 新增后自动打开
      }
      return p
    })
    this.setData({ projects: list.map(computeProject) })
  },

  removeSlurry(e) {
    const ds = e.currentTarget.dataset
    this.removeSlurryInner(ds.id, ds.sid)
  },

  removeSlurryInner(id, sid) {
    const list = this.data.projects.map(p => {
      if (p.id === id) {
        p.slurries = p.slurries.filter(s => s.id !== sid)
        if (p.activeSlurry === sid) p.activeSlurry = p.slurries.length ? p.slurries[0].id : ''
      }
      return p
    })
    this.setData({ projects: list.map(computeProject) })
  },

  // 长按圆球：修改编号 / 删除浆料
  onBallLongPress(e) {
    const ds = e.currentTarget.dataset
    const p = this.data.projects.find(x => x.id === ds.id)
    const s = p && p.slurries.find(x => x.id === ds.sid)
    if (!s) return
    wx.showActionSheet({
      itemList: ['修改编号', '删除浆料'],
      success: (res) => {
        if (res.tapIndex === 0) {
          wx.showModal({
            title: '修改浆料编号',
            editable: true,
            placeholderText: s.no || '浆料编号',
            success: (r) => {
              if (r.confirm) {
                s.no = (r.content || '').trim() || s.no
                this.setData({ projects: this.data.projects.map(computeProject) })
              }
            }
          })
        } else {
          wx.showModal({
            title: '确认删除',
            content: '确定删除“' + (s.no || '浆料') + '”吗？',
            confirmColor: '#fa5151',
            success: (r) => { if (r.confirm) this.removeSlurryInner(ds.id, ds.sid) }
          })
        }
      }
    })
  },

  addSample(e) {
    const ds = e.currentTarget.dataset
    const list = this.data.projects.map(p => {
      if (p.id === ds.id) {
        p.slurries = p.slurries.map(s => {
          if (s.id === ds.sid) s.samples.push({ end: '', remain: '' })
          return s
        })
      }
      return p
    })
    this.setData({ projects: list.map(computeProject) })
  },

  removeSample(e) {
    const ds = e.currentTarget.dataset
    const list = this.data.projects.map(p => {
      if (p.id === ds.id) {
        p.slurries = p.slurries.map(s => {
          if (s.id === ds.sid) s.samples.splice(Number(ds.idx), 1)
          return s
        })
      }
      return p
    })
    this.setData({ projects: list.map(computeProject) })
  },

  onSampleInput(e) {
    const ds = e.currentTarget.dataset
    const list = this.data.projects.map(p => {
      if (p.id === ds.id) {
        p.slurries = p.slurries.map(s => {
          if (s.id === ds.sid) s.samples[Number(ds.idx)][ds.field] = e.detail.value
          return s
        })
      }
      return p
    })
    this.setData({ projects: list.map(computeProject) })
  },

  // 生成补料申请（汇总本项目全部浆料）
  genApply(e) {
    const id = e.currentTarget.dataset.id
    const p = this.data.projects.find(x => x.id === id)
    if (!p || !p.computed || !p.computed.allReplenishValid) {
      wx.showToast({ title: '请先把各浆料数据填全', icon: 'none' })
      return
    }
    const c = p.computed
    const producedShown = isNaN(c.P) ? '?' : c.P
    const lines = []
    lines.push('【补料申请】' + (p.name || '未命名项目'))
    lines.push('项目总计划：' + (p.totalPlan || '?') + ' 车')
    lines.push('已生产：' + producedShown + ' 车' + (p.manualProduced ? '' : '（自动）'))
    c.slurries.forEach((sc, i) => {
      const s = p.slurries[i]
      const B = parseFloat(s.baseSlurry)
      const sampleText = (s.samples || [])
        .filter(sm => { const en = parseFloat(sm.end), rm = parseFloat(sm.remain); return !isNaN(en) && en > 0 && !isNaN(B) && !isNaN(rm) && rm >= 0 && rm <= B })
        .map(sm => { const rm = parseFloat(sm.remain); return '到第' + sm.end + '车 剩' + sm.remain + 'L（用' + (B - rm).toFixed(2) + 'L）' })
        .join('；')
      lines.push('— ' + (s.no || ('浆料' + (i + 1))) + ' —')
      lines.push('  基础料浆：' + (s.baseSlurry || '?') + ' L')
      lines.push('  抽样：' + (sampleText || '?'))
      lines.push('  单车实际用量：' + sc.unitText.replace('单车实际用量 ', ''))
      if (sc.diffValid) lines.push('  误差监控：' + sc.diffText)
      lines.push('  现场实际剩余：' + (isNaN(parseFloat(s.actualRemain)) ? '未填·按理论算' : s.actualRemain) + ' L')
      lines.push('  后补料浆：' + (sc.replenishType === 'enough' ? '无需补料（料浆充足）' : sc.replenish.toFixed(2) + ' L'))
    })
    lines.push('合计后补料浆：' + c.totalReplenishText + ' L')
    wx.setClipboardData({
      data: lines.join('\n'),
      success: () => wx.showToast({ title: '已复制，可发原料间', icon: 'none' })
    })
  },

  goGuide() {
    wx.navigateTo({ url: '/pages/guide/guide' })
  }
})

// 计算单种浆料（依赖项目级已生产 P、总计划 T）
function computeSlurry(s, P, T) {
  const B = parseFloat(s.baseSlurry)
  const S = parseFloat(s.actualRemain)
  const c = {
    unitValid: false, unit: 0, sampleCars: 0, unitText: '',
    diffValid: false, diffText: '', diffType: '',
    replenishValid: false, replenish: 0, replenishText: '', replenishType: ''
  }
  // 【修正】单车用量 = (基础料浆总量 − 该车结束时剩余) ÷ 该车序号
  // 每条抽样都是从"第1车"起算的同一笔账，彼此重叠，不能相加；只能各自求值后取平均。
  let units = [], maxCar = 0
  ;(s.samples || []).forEach(sm => {
    sm.calcUse = ''
    const en = parseFloat(sm.end), rm = parseFloat(sm.remain)
    // 剩余需可观测且在 [0, 总配量] 内；end 必须是正的车序号
    if (!isNaN(en) && en > 0 && !isNaN(B) && !isNaN(rm) && rm >= 0 && rm <= B) {
      units.push((B - rm) / en)
      if (en > maxCar) maxCar = en
      sm.calcUse = (B - rm).toFixed(2)
    }
  })
  if (units.length > 0) {
    let sumU = 0
    units.forEach(x => { sumU += x })
    const u = sumU / units.length
    c.unitValid = true
    c.unit = u
    c.sampleCars = maxCar
    c.unitText = '单车实际用量 ' + u.toFixed(2) + ' L/车（到第 ' + maxCar + ' 车 · ' + units.length + ' 条抽样取均值）'
  }
  if (c.unitValid && !isNaN(B) && !isNaN(P)) {
    const theoryRemain = B - P * c.unit
    if (!isNaN(S)) {
      const diff = S - theoryRemain
      c.diffValid = true
      if (diff >= 0) {
        c.diffText = '误差监控：实际剩余比理论多 ' + diff.toFixed(2) + ' L（料浆有富余）'
        c.diffType = 'enough'
      } else {
        c.diffText = '误差监控：实际剩余比理论少 ' + (-diff).toFixed(2) + ' L（有损耗/需核查）'
        c.diffType = 'short'
      }
    }
  }
  if (c.unitValid && !isNaN(T) && !isNaN(P)) {
    const needProduce = T - P
    let valid = false, r = 0, basis = ''
    if (!isNaN(S)) {
      r = needProduce * c.unit - S
      valid = true
      basis = '实际剩余'
    } else if (!isNaN(B)) {
      r = T * c.unit - B
      valid = true
      basis = '理论值'
    }
    if (valid) {
      c.replenishValid = true
      if (r > 0) {
        c.replenish = r
        c.replenishText = '需后补料浆 ' + r.toFixed(2) + ' L（提交申请·' + basis + '）'
        c.replenishType = 'lack'
      } else {
        c.replenish = 0
        c.replenishText = '当前料浆可覆盖剩余生产，无需补料（' + basis + '）'
        c.replenishType = 'enough'
      }
    }
  }
  // 标签角标文字：绿=够 / 橙=需补 / 灰=未填
  c.badgeText = c.replenishValid ? (c.replenishType === 'enough' ? '够' : c.replenish.toFixed(1) + 'L') : ''
  // 圆形号码球状态：够=绿 / 不够=红 / 待算=灰
  let ballClass = 'gray', amtText = '待算'
  if (c.replenishValid) {
    if (c.replenishType === 'enough') { ballClass = 'green'; amtText = '够' }
    else { ballClass = 'red'; amtText = c.replenish.toFixed(1) + 'L' }
  }
  const noLen = (s.no || '').length
  c.ballClass = ballClass
  c.amtText = amtText
  c.ballFont = noLen <= 1 ? 40 : noLen === 2 ? 36 : noLen === 3 ? 28 : 24 // rpx，名字越长字号越小
  return c
}

// 计算单个项目：派生项目级已生产 P，再汇总各浆料
function computeProject(p) {
  const T = parseFloat(p.totalPlan)
  const c = {
    autoProduced: '', P: NaN,
    needProduceValid: false, needProduce: 0,
    slurries: [], totalReplenish: 0, allSlurryValid: true, allReplenishValid: false
  }
  // 自动已生产：取所有浆料抽样记录里的最大车号
  let maxEnd = NaN
  ;(p.slurries || []).forEach(s => {
    ;(s.samples || []).forEach(sm => {
      const en = parseFloat(sm.end)
      if (!isNaN(en) && en > 0) {
        if (isNaN(maxEnd) || en > maxEnd) maxEnd = en
      }
    })
  })
  let P
  if (p.manualProduced) {
    P = parseFloat(p.produced)
  } else {
    P = maxEnd
    c.autoProduced = isNaN(maxEnd) ? '' : String(maxEnd)
  }
  c.P = P
  if (!isNaN(T) && !isNaN(P)) {
    c.needProduceValid = true
    c.needProduce = T - P
  }
  let total = 0, allValid = true
  ;(p.slurries || []).forEach(s => {
    const sc = computeSlurry(s, P, T)
    c.slurries.push(sc)
    if (sc.replenishValid) total += sc.replenish
    else allValid = false
  })
  c.totalReplenish = total
  c.totalReplenishText = total.toFixed(2) // 吸底合计统一两位小数，避免浮点误差
  c.allSlurryValid = allValid
  c.allReplenishValid = allValid && (p.slurries || []).length > 0
  p.computed = c
  return p
}
