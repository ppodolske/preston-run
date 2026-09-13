function html(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type':'text/html; charset=utf-8', ...headers });
  res.end(body);
}
function redirect(res, location, status = 302) {
  res.writeHead(status, { location, 'cache-control':'no-store' });
  res.end();
}
function json(res, status, payload, headers = {}) {
  res.writeHead(status, { 'content-type':'application/json; charset=utf-8', ...headers });
  res.end(JSON.stringify(payload));
}
function text(res, status, body, headers = {}) {
  res.writeHead(status, { 'content-type':'text/plain; charset=utf-8', ...headers });
  res.end(body);
}
module.exports = { html, redirect, json, text };
