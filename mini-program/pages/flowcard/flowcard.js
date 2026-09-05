const api = require('../../utils/api')

Page({
  data: {
    workNo: '',
    workOrder: {},
    flowCard: {},
  },

  onLoad(options) {
    const workNo = options.workNo || ''
    this.setData({ workNo })
    if (workNo) {
      this.loadFlowCard(workNo)
    }
  },

  async loadFlowCard(workNo) {
    try {
      const data = await api.getFlowCard(workNo)
      this.setData({
        workOrder: data.work_order || {},
        flowCard: data.flow_card || {},
      })
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
      // 兼容示例
      this.setData({
        workOrder: {
          work_no: workNo,
          product_name: '智能蓝牙音响',
          spec: '-',
          color: '-',
          plan_quantity: 200,
          start_date: '-',
          end_date: '-',
          process_route: '-',
          remark: 'AI Agent 创建',
        },
      })
    }
  },

  closePage() {
    wx.navigateBack()
  },

  printCard() {
    // 小程序中打印需要连接硬件或借助微信打印服务；这里先做提示
    wx.showToast({ title: '已调起打印（需连接打印机）', icon: 'none' })
  },
})
