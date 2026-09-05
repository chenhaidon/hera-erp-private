const app = getApp()

Page({
  data: {
    manualWorkNo: '',
  },

  onLoad() {
    // 页面加载后自动调起扫码
    this.startScan()
  },

  startScan() {
    wx.scanCode({
      onlyFromCamera: true,
      scanType: ['qrCode'],
      success: (res) => {
        this.routeByResult(res.result)
      },
      fail: (err) => {
        if (err.errMsg && err.errMsg.includes('cancel')) {
          // 用户取消，留在当前页面等待手动输入
          return
        }
        wx.showToast({ title: err.errMsg || '扫码失败', icon: 'none' })
      },
    })
  },

  onManualInput(e) {
    this.setData({ manualWorkNo: e.detail.value })
  },

  manualEnter() {
    const workNo = this.data.manualWorkNo.trim()
    if (!workNo) {
      wx.showToast({ title: '请输入工单编号', icon: 'none' })
      return
    }
    this.routeByResult(workNo)
  },

  parseWorkNo(text) {
    if (!text) return ''
    // 支持纯工单号、URL 查询参数、JSON 格式
    if (/^[\w-]+$/.test(text.trim())) {
      return text.trim()
    }
    try {
      const url = new URL(text, 'http://example.com')
      const fromQuery = url.searchParams.get('workNo')
      if (fromQuery) return fromQuery
    } catch {
      // ignore
    }
    try {
      const obj = JSON.parse(text)
      if (obj.workNo) return obj.workNo
    } catch {
      // ignore
    }
    const match = text.match(/workNo=([\w-]+)/)
    return match ? match[1] : ''
  },

  parseMode(text) {
    if (!text) return ''
    try {
      const url = new URL(text, 'http://example.com')
      const fromQuery = url.searchParams.get('mode')
      if (fromQuery) return fromQuery
    } catch {
      // ignore
    }
    const match = text.match(/mode=([\w-]+)/)
    return match ? match[1] : ''
  },

  routeByResult(text) {
    const workNo = this.parseWorkNo(text)
    if (!workNo) {
      wx.showToast({ title: '无法识别二维码内容', icon: 'none' })
      return
    }
    const mode = this.parseMode(text)
    const role = app.globalData.currentRole
    if (mode === 'inspect' || role === 'inspector') {
      wx.navigateTo({ url: `/pages/inspect/inspect?workNo=${workNo}` })
    } else {
      wx.navigateTo({ url: `/pages/report/report?workNo=${workNo}` })
    }
  },
})
