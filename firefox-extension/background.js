
let gFoo = {};

browser.webRequest.onSendHeaders.addListener(details => {
  if (details.url.startsWith('http://localhost:8080/')) return {};
  if (gFoo[details.requestId]["url"] != details.url) {
    throw Error();
  }
  gFoo[details.requestId]["requestHeaders"] = details.requestHeaders;
  maybeProcess(details.requestId);
}, { urls: ['<all_urls>'], },  ["requestHeaders"]);

// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/filterResponseData
browser.webRequest.onBeforeRequest.addListener(details => {
  if (details.url.startsWith('http://localhost:8080/')) return {};
  if (details.requestId in gFoo) {
    throw Error();
  }
  gFoo[details.requestId] = {};
  gFoo[details.requestId]['requestId'] = details.requestId;
  gFoo[details.requestId]["url"] = details.url;
  gFoo[details.requestId]["startTime"] = new Date().getTime();
  let filter = browser.webRequest.filterResponseData(details.requestId);
  let decoder = new TextDecoder("utf-8");
  let encoder = new TextEncoder();
  filter.ondata = (event) => {
    gFoo[details.requestId]["data"] = event.data;
    maybeProcess(details.requestId);
    filter.write(event.data)
    filter.disconnect();
  };
  return {};
}, { urls: ['<all_urls>'], },  ["blocking"]);


browser.webRequest.onResponseStarted.addListener(details => {
  if (details.url.startsWith('http://localhost:8080/')) return {};
  gFoo[details.requestId]["statusCode"] = details.statusCode;
  gFoo[details.requestId]["responseHeaders"] = details.responseHeaders;
  maybeProcess(details.requestId);
}, { urls: ['<all_urls>'], },  ["responseHeaders"]);

function maybeProcess(requestId) {
  let info = gFoo[requestId];
  if (!("requestHeaders" in info)) return;
  if (!("responseHeaders" in info)) return;
  if (!("data" in info)) return;
  fetch('http://localhost:8080/' + encodeURIComponent(info["url"]), {
    body: info["data"],
    headers: {
      'local-cache-status-code': JSON.stringify(info["statusCode"]),
      'local-cache-request-headers': JSON.stringify(info["requestHeaders"]),
      'local-cache-response-headers': JSON.stringify(info["responseHeaders"]),
    },
    method: 'PUT',
  });
  delete gFoo[requestId];
}

setInterval(_ => {
  let now = new Date().getTime();
  for (requestId in gFoo) {
    if (now - gFoo[requestId]["startTime"] > 60000) {
      console.log('timeout', gFoo[requestId]);
      delete gFoo[requestId];
    }
  }
});
