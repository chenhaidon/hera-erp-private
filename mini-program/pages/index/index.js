const api = require('../../utils/api')
const app = getApp()

const statusMap = {
  pending: '待排产',
  issued: '已下发',
  producing: '生产中',
  qc: '待质检',
  pending_inbound: '待入库',
  inbound: '已入库',
  closed: '已结案',
}

const statusClassMap = {
  pending: 'badge-orange',
  issued: 'badge-purple',
  producing: 'badge-purple',
  qc: 'badge-orange',
  pending_inbound: 'badge-orange',
  inbound: 'badge-green',
  closed: 'badge-green',
}

Page({
  data: {
    currentRole: 'worker',
    workOrders: [],
  },

  onLoad() {
    this.setData({ currentRole: app.globalData.currentRole })
  },

  onShow() {
    this.loadWorkOrders()
  },

  selectRole(e) {
    const role = e.currentTarget.dataset.role
    app.globalData.currentRole = role
    wx.setStorageSync('currentRole', role)
    this.setData({ currentRole: role })
  },

  async loadWorkOrders() {
    try {
      const data = await api.listWorkOrders()
      this.setData({ workOrders: Array.isArray(data) ? data : [] })
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
      // 兼容无网络：显示示例数据
      this.setData({
        workOrders: [
          {
            work_no: 'MFG-20260707-8505',
            product_name: '智能蓝牙音响',
            plan_quantity: 200,
            completed_quantity: 0,
            progress: 0,
            status: 'producing',
          },
        ],
      })
    }
  },

  statusLabel(status) {
    return statusMap[status] || status
  },

  statusBadgeClass(status) {
    return statusClassMap[status] || 'badge-purple'
  },

  scanCode() {
    wx.navigateTo({ url: '/pages/scan/scan' })
  },

  goFlowCard(e) {
    const workNo = e.currentTarget.dataset.workno
    wx.navigateTo({ url: `/pages/flowcard/flowcard?workNo=${workNo}` })
  },
})
