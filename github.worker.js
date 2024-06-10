// 站点配置对象
// 理论上更换上游只需修改domain即可。
const siteConfig = {
    domain: 'github.com',
    upstream_path: '/',
    blocked_region: ['KP', 'SY', 'PK', 'CU'],
    blocked_ip_address: ['0.0.0.0', '127.0.0.1'],
    https: true,
    replace_dict: {'$upstream': '$custom_domain'}
  }
  
  siteConfig.upstream = siteConfig.domain
  siteConfig.upstream_mobile = siteConfig.domain
  siteConfig.replace_dict[`//${siteConfig.domain}`] = ''
  
  // 以下保持默认，不要动
  addEventListener('fetch', event => {
    event.respondWith(fetchAndApply(event.request))
  })
  
  async function fetchAndApply(request) {
    // 获取请求头中的地区和 IP 信息
    const region = request.headers.get('cf-ipcountry')?.toUpperCase()
    const ip_address = request.headers.get('cf-connecting-ip')
    const user_agent = request.headers.get('user-agent')
    const url = new URL(request.url)
    
    // 设置协议
    if (siteConfig.https) {
      url.protocol = 'https:'
    } else {
      url.protocol = 'http:'
    }
  
    // 根据设备类型选择上游域名
    const upstream_domain = await isMobileDevice(user_agent) ? siteConfig.upstream_mobile : siteConfig.upstream
    url.host = upstream_domain
    
    // 设置路径
    if (url.pathname === '/') {
      url.pathname = siteConfig.upstream_path
    } else {
      url.pathname = siteConfig.upstream_path + url.pathname
    }
  
    // 检查地区和 IP 是否被屏蔽
    if (siteConfig.blocked_region.includes(region)) {
      return new Response('Access denied: WorkersProxy is not available in your region yet.', { status: 403 })
    }
    
    if (siteConfig.blocked_ip_address.includes(ip_address)) {
      return new Response('Access denied: Your IP address is blocked by WorkersProxy.', { status: 403 })
    }
    
    // 修改请求头
    const new_request_headers = new Headers(request.headers)
    new_request_headers.set('Host', url.hostname)
    new_request_headers.set('Referer', url.hostname)
  
    // 发送请求到上游服务器
    const original_response = await fetch(url.href, {
      method: request.method,
      headers: new_request_headers
    })
    
    // 修改响应头
    const new_response_headers = new Headers(original_response.headers)
    new_response_headers.set('access-control-allow-origin', '*')
    new_response_headers.set('access-control-allow-credentials', 'true')
    new_response_headers.delete('content-security-policy')
    new_response_headers.delete('content-security-policy-report-only')
    new_response_headers.delete('clear-site-data')
  
    // 文本替换
    let original_text
    if (new_response_headers.get('content-type')?.includes('text/html') && new_response_headers.get('content-type')?.includes('UTF-8')) {
      original_text = await replaceResponseText(original_response, upstream_domain, url.hostname)
    } else {
      original_text = await original_response.text()
    }
  
    // 返回修改后的响应
    return new Response(original_text, {
      status: original_response.status,
      headers: new_response_headers
    })
  }
  
  async function replaceResponseText(response, upstream_domain, host_name) {
    let text = await response.text()
    
    // 遍历替换字典进行文本替换
    for (const [key, value] of Object.entries(siteConfig.replace_dict)) {
      const pattern = new RegExp(key === '$upstream' ? upstream_domain : key, 'g')
      text = text.replace(pattern, value === '$upstream' ? upstream_domain : host_name)
    }
    return text
  }
  
  // 检测用户代理是否为移动设备
  async function isMobileDevice(user_agent) {
    const agents = ["Android", "iPhone", "SymbianOS", "Windows Phone", "iPad", "iPod"]
    return agents.every(agent => !user_agent.includes(agent))
  }
  