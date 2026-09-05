const BASE_URL = 'https://backend.appmiaoda.com/projects/supabase331454395508113408/functions/v1/mp-api'
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoyMDk4NDUyMDg2LCJpc3MiOiJzdXBhYmFzZSIsInJvbGUiOiJhbm9uIiwic3ViIjoiYW5vbiJ9.A3cFRx15YmT0DQbY3d0DFLMzsjFmgzMLaCgXF4LGn0'

function request(path, method = 'GET', body) {
  return new Promise((resolve, reject) => {
    wx.showLoading({ title: '加载中', mask: true })
    wx.request({
      url: `${BASE_URL}${path}`,
      method,
      header: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ANON_KEY}`,
      },
      data: body,
      success: (res) => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(res.data)
        } else {
          const msg = res.data?.error || res.data?.message || `请求失败 (${res.statusCode})`
          reject(new Error(msg))
        }
      },
      fail: (err) => {
        reject(new Error(err.errMsg || '网络请求失败'))
      },
      complete: () => {
        wx.hideLoading()
      },
    })
  })
}

module.exports = {
  // 查询工单列表
  listWorkOrders: () => request('/work-orders'),

  // 根据工单编号查询工单
  getWorkOrder: (workNo) => request(`/work-orders/${workNo}`),

  // 获取或生成流转卡
  getFlowCard: (workNo) => request(`/flow-card/${workNo}`),

  // 报工
  submitReport: (workNo, data) => request(`/work-orders/${workNo}/report`, 'POST', data),

  // 质检
  submitInspect: (workNo, data) => request(`/work-orders/${workNo}/inspect`, 'POST', data),
}
