
let gLiveRequests = {};

chrome.webRequest.onSendHeaders.addListener(details => {
  if (details.url.startsWith('http://localhost:8080/')) return {};

  let headers = new Headers();
  for (let header of details.requestHeaders) {
    if (header['name'] == 'cache-everything-request') return {};
    headers.append(header['name'], header['value']);
  }
  headers.append('cache-everything-request', 'x');
  gLiveRequests[details.requestId] = {};
  gLiveRequests[details.requestId]['requestId'] = details.requestId;
  gLiveRequests[details.requestId]["url"] = details.url;
  gLiveRequests[details.requestId]["startTime"] = new Date().getTime();
  gLiveRequests[details.requestId]["requestHeaders"] = details.requestHeaders;
  fetch(details.url, {
    headers: headers,
  }).then(response => {
    gLiveRequests[details.requestId]["duplicate_statusCode"] = response.status;
    gLiveRequests[details.requestId]["duplicate_responseHeaders"] = response.headers; // Just for debugging.
    response.blob().then(blob => {
      gLiveRequests[details.requestId]["duplicate_body"] = blob;
      maybeProcess(details.requestId);
    });
  });
}, { urls: ['<all_urls>'], },  ["requestHeaders"]);


chrome.webRequest.onResponseStarted.addListener(details => {
  if (details.url.startsWith('http://localhost:8080/')) return {};
  if (!(details.requestId in gLiveRequests)) return {};
  gLiveRequests[details.requestId]["real_statusCode"] = details.statusCode;
  gLiveRequests[details.requestId]["real_responseHeaders"] = details.responseHeaders;
  maybeProcess(details.requestId);
  return {};
}, { urls: ['<all_urls>'], },  ["responseHeaders"]);

function maybeProcess(requestId) {
  if (!("duplicate_statusCode" in gLiveRequests[requestId])) return;
  if (!("duplicate_body" in gLiveRequests[requestId])) return;
  if (!("real_statusCode" in gLiveRequests[requestId])) return;
  if (!("real_responseHeaders" in gLiveRequests[requestId])) return;
  let info = gLiveRequests[requestId];
  delete gLiveRequests[requestId];
  if (info["duplicate_statusCode"] != info["real_statusCode"]) {
    // The request statuses don't match, so we shouldn't have much confidence in it. Abort.
    delete gLiveRequests[requestId];
    return;
  }
  let statusCode = info["real_statusCode"];
  let requestHeaders = info["requestHeaders"];
  let responseHeaders = info["real_responseHeaders"];
  let body = info["duplicate_body"];

  fetch('http://localhost:8080/' + encodeURIComponent(info["url"]), {
    body: body,
    headers: {
      'local-cache-status-code': JSON.stringify(statusCode),
      'local-cache-request-headers': JSON.stringify(requestHeaders),
      'local-cache-response-headers': JSON.stringify(responseHeaders),
    },
    method: 'PUT',
  });
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
