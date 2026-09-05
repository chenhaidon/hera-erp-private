const api = require('../../utils/api')

Page({
  data: {
    workNo: '',
    workOrder: {},
    currentProcess: null,
    inspectionItems: [],
    form: {
      result: '',
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
          { name: '裁剪', completed_quantity: 200, status: 'qc', sequence: 1 },
          { name: '缝制', completed_quantity: 0, status: 'pending', sequence: 2 },
        ],
      }
      this.setData({ workOrder })
      this.computeCurrentProcess(workOrder)
    }
  },

  computeCurrentProcess(workOrder) {
    const operations = workOrder.operations || []
    // 找工序顺序最小且状态为 qc（已完工待质检）的工序
    const qcProcess = operations
      .filter((op) => op.status === 'qc')
      .sort((a, b) => (a.sequence || 0) - (b.sequence || 0))[0]
    if (qcProcess) {
      const standards = workOrder.process_standards || [
        { name: '尺寸偏差', standard: '±2mm' },
        { name: '外观缺陷', standard: '无明显瑕疵' },
      ]
      const items = standards.map((s) => ({ ...s, value: '' }))
      this.setData({
        currentProcess: qcProcess,
        inspectionItems: items,
      })
    } else {
      this.setData({ currentProcess: null, inspectionItems: [] })
    }
  },

  onItemValueInput(e) {
    const index = e.currentTarget.dataset.index
    const value = e.detail.value
    this.setData({ [`inspectionItems[${index}].value`]: value })
  },

  selectResult(e) {
    this.setData({ 'form.result': e.currentTarget.dataset.result })
  },

  onRemarkInput(e) {
    this.setData({ 'form.remark': e.detail.value })
  },

  async submit() {
    if (!this.data.form.result) {
      wx.showToast({ title: '请选择判定结果', icon: 'none' })
      return
    }
    try {
      await api.submitInspect(this.data.workNo, {
        process_name: this.data.currentProcess.name,
        result: this.data.form.result,
        items: this.data.inspectionItems,
        remark: this.data.form.remark,
      })
      wx.showToast({ title: '质检提交成功', icon: 'success' })
      setTimeout(() => {
        this.loadWorkOrder(this.data.workNo)
        this.setData({ form: { result: '', remark: '' } })
      }, 1000)
    } catch (err) {
      wx.showToast({ title: err.message || '提交失败', icon: 'none' })
    }
  },
})
