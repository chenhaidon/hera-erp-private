App({
  onLaunch() {
    // 初始化全局角色缓存
    const role = wx.getStorageSync('currentRole') || 'worker'
    this.globalData.currentRole = role
    console.log('小程序启动，当前角色:', role)
  },
  globalData: {
    currentRole: 'worker',
  },
})
