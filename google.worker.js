const UPSTREAM = 'ipv6.google.com.hk';
const UPSTREAM_V4 = 'www.google.com.hk';
const BLOCKED_REGION = ['TK'];
const REPLACE_DICT = {
  $upstream: '$custom_domain',
  'www.google.com/': 'example.com/',
  'gstatic.com': 'gstatic.cn',
  'ajax.googleapis.com': 'ajax.lug.ustc.edu.cn',
  'fonts.googleapis.com': 'fonts.googleapis.cn',
  'themes.googleusercontent.com': 'google-themes.lug.ustc.edu.cn',
  'www.gravatar.com/avatar': 'dn-qiniu-avatar.qbox.me/avatar',
  'www.google.co.jp': '$custom_domain',
  'www.google.com.sg': '$custom_domain',
  'books.google.com.hk': '$custom_domain',
  'books.google.co.jp': '$custom_domain',
  'books.google.com.sg': '$custom_domain',
  'maps.google.com.hk': '$custom_domain',
  'maps.google.co.jp': '$custom_domain',
  'maps.google.com.sg': '$custom_domain',
  'maps.google.com': '$custom_domain',
  'books.google.com': '$custom_domain',
};

addEventListener('fetch', (event) => {
  event.respondWith(fetchAndApply(event.request));
});

async function fetchAndApply(request) {
  const region = request.headers.get('cf-ipcountry').toUpperCase();
  let url = new URL(request.url);
  let hostName = url.host;  // 这是 $custom_domain

  if (url.protocol === 'http:') {
    url.protocol = 'https:';
    return Response.redirect(url.href);
  }

  const isImageSearch = url.href.includes('tbm=isch') || url.href.includes('/img');
  const upstreamDomain = isImageSearch ? UPSTREAM_V4 : UPSTREAM;
  url.host = upstreamDomain;

  if (BLOCKED_REGION.includes(region)) {
    return new Response('Access denied: WorkersProxy is not available in your region yet.', {
      status: 403,
    });
  }

  const newRequestHeaders = new Headers(request.headers);
  newRequestHeaders.set('Host', upstreamDomain);
  newRequestHeaders.set('Referer', request.url);

  const originalResponse = await fetch(url.href, {
    method: request.method,
    headers: newRequestHeaders,
  });

  const newResponseHeaders = new Headers(originalResponse.headers);
  newResponseHeaders.set('cache-control', 'public, max-age=14400');
  newResponseHeaders.set('access-control-allow-origin', '*');
  newResponseHeaders.set('access-control-allow-credentials', 'true');
  newResponseHeaders.delete('content-security-policy');
  newResponseHeaders.delete('content-security-policy-report-only');
  newResponseHeaders.delete('clear-site-data');

  let responseBody = originalResponse.body;
  if (newResponseHeaders.get('content-type')?.includes('text/html')) {
    responseBody = await replaceResponseText(originalResponse, upstreamDomain, hostName);
  } else {
    responseBody = await originalResponse.blob();
  }

  return new Response(responseBody, {
    status: originalResponse.status,
    headers: newResponseHeaders,
  });
}

async function replaceResponseText(response, upstreamDomain, hostName) {
  let text = await response.text();
  for (let [key, value] of Object.entries(REPLACE_DICT)) {
    key = key.replace('$upstream', upstreamDomain).replace('$custom_domain', hostName);
    value = value.replace('$upstream', upstreamDomain).replace('$custom_domain', hostName);
    text = text.replace(new RegExp(key, 'g'), value);
  }
  return text;
}