
let gLiveRequests = {};

browser.webRequest.onSendHeaders.addListener(details => {
  if (details.url.startsWith('http://localhost:8080/')) return {};
  if (gLiveRequests[details.requestId]["url"] != details.url) {
    throw Error();
  }
  gLiveRequests[details.requestId]["requestHeaders"] = details.requestHeaders;
  maybeProcess(details.requestId);
}, { urls: ['<all_urls>'], },  ["requestHeaders"]);

// https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/API/webRequest/filterResponseData
browser.webRequest.onBeforeRequest.addListener(details => {
  if (details.url.startsWith('http://localhost:8080/')) return {};
  if (details.requestId in gLiveRequests) {
    throw Error();
  }
  gLiveRequests[details.requestId] = {};
  gLiveRequests[details.requestId]['requestId'] = details.requestId;
  gLiveRequests[details.requestId]["url"] = details.url;
  gLiveRequests[details.requestId]["startTime"] = new Date().getTime();
  let filter = browser.webRequest.filterResponseData(details.requestId);
  let decoder = new TextDecoder("utf-8");
  let encoder = new TextEncoder();
  filter.ondata = (event) => {
    gLiveRequests[details.requestId]["data"] = event.data;
    maybeProcess(details.requestId);
    filter.write(event.data)
    filter.disconnect();
  };
  return {};
}, { urls: ['<all_urls>'], },  ["blocking"]);


browser.webRequest.onResponseStarted.addListener(details => {
  if (details.url.startsWith('http://localhost:8080/')) return {};
  gLiveRequests[details.requestId]["statusCode"] = details.statusCode;
  gLiveRequests[details.requestId]["responseHeaders"] = details.responseHeaders;
  maybeProcess(details.requestId);
}, { urls: ['<all_urls>'], },  ["responseHeaders"]);

function maybeProcess(requestId) {
  let info = gLiveRequests[requestId];
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
  delete gLiveRequests[requestId];
}

setInterval(_ => {
  let now = new Date().getTime();
  for (requestId in gLiveRequests) {
    if (now - gLiveRequests[requestId]["startTime"] > 60000) {
      console.log('timeout', gLiveRequests[requestId]);
      delete gLiveRequests[requestId];
    }
  }
});
