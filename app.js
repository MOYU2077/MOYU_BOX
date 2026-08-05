// app.js 是小程序的"入口文件"，每次打开小程序都会先运行这里
App({
  onLaunch() {
    // 小程序启动时执行（可选）
    console.log('小程序启动啦')
  },
  globalData: {
    // 可以在这里放全局共享的数据
    userName: '新手朋友'
  }
})
