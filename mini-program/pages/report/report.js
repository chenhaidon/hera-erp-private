const api = require('../../utils/api')
const app = getApp()

const processStatusMap = {
  pending: '待开工',
  pending_start: '待开工',
  running: '生产中',
  qc: '待质检',
  completed: '已完工',
  closed: '已关闭',
}

const processStatusClassMap = {
  pending: 'badge-orange',
  pending_start: 'badge-orange',
  running: 'badge-purple',
  qc: 'badge-orange',
  completed: 'badge-green',
  closed: 'badge-green',
}

Page({
  data: {
    workNo: '',
    workOrder: {},
    currentProcess: null,
    form: {
      completed_qty: '',
      remark: '',
    },
  },

  onLoad(options) {
    const workNo = options.workNo || ''
    this.setData({ workNo })
    if (workNo) {
      this.loadWorkOrder(workNo)
    }
  },

  async loadWorkOrder(workNo) {
    try {
      const data = await api.getWorkOrder(workNo)
      this.setData({ workOrder: data.work_order || {} })
      this.computeCurrentProcess(data.work_order || {})
    } catch (err) {
      wx.showToast({ title: err.message || '加载失败', icon: 'none' })
      // 兼容示例
      const workOrder = {
        work_no: workNo,
        product_name: '智能蓝牙音响',
        plan_quantity: 200,
        operations: [
          { name: '裁剪', plan_quantity: 200, completed_quantity: 0, status: 'pending_start' },
          { name: '缝制', plan_quantity: 200, completed_quantity: 0, status: 'pending' },
        ],
      }
      this.setData({ workOrder })
      this.computeCurrentProcess(workOrder)
    }
  },

  computeCurrentProcess(workOrder) {
    const operations = workOrder.operations || []
    // 找工序顺序中最小且未完成的工序
    const unfinished = operations
      .filter((op) => (op.status === 'pending_start' || op.status === 'running' || op.status === 'pending') && (op.completed_quantity || 0) < (op.plan_quantity || 0))
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))[0]
    if (unfinished) {
      unfinished.remaining = (unfinished.plan_quantity || 0) - (unfinished.completed_quantity || 0)
    }
    this.setData({ currentProcess: unfinished || null })
  },

  processStatusLabel(status) {
    return processStatusMap[status] || status
  },

  processBadgeClass(status) {
    return processStatusClassMap[status] || 'badge-purple'
  },

  onQtyInput(e) {
    this.setData({ 'form.completed_qty': e.detail.value })
  },

  onRemarkInput(e) {
    this.setData({ 'form.remark': e.detail.value })
  },

  async submit() {
    const qty = parseInt(this.data.form.completed_qty, 10)
    if (isNaN(qty) || qty <= 0) {
      wx.showToast({ title: '请输入有效的完成数量', icon: 'none' })
      return
    }
    const remaining = this.data.currentProcess.remaining
    if (qty > remaining) {
      wx.showToast({ title: `不能超过剩余数量 ${remaining}`, icon: 'none' })
      return
    }
    try {
      await api.submitReport(this.data.workNo, {
        process_name: this.data.currentProcess.name,
        completed_qty: qty,
        remark: this.data.form.remark,
      })
      wx.showToast({ title: '报工成功', icon: 'success' })
      setTimeout(() => {
        this.loadWorkOrder(this.data.workNo)
        this.setData({ form: { completed_qty: '', remark: '' } })
      }, 1000)
    } catch (err) {
      wx.showToast({ title: err.message || '报工失败', icon: 'none' })
    }
  },
})
