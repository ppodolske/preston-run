function readForm(req, { maxBytes = 16384 } = {}) {
  return new Promise((resolve, reject) => {
    const type = String(req.headers && req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (type !== 'application/x-www-form-urlencoded') {
      const error = new Error('Unsupported form content type');
      error.statusCode = 415;
      reject(error);
      return;
    }
    let size = 0;
    const chunks = [];
    let finished = false;
    function fail(error) {
      if (finished) return;
      finished = true;
      reject(error);
    }
    req.on('data', chunk => {
      if (finished) return;
      size += chunk.length;
      if (size > maxBytes) {
        const error = new Error('Form body too large');
        error.statusCode = 413;
        fail(error);
        return;
      }
      chunks.push(chunk);
    });
    req.on('error', fail);
    req.on('end', () => {
      if (finished) return;
      finished = true;
      try {
        resolve(new URLSearchParams(Buffer.concat(chunks).toString('utf8')));
      } catch {
        const error = new Error('Malformed form body');
        error.statusCode = 400;
        reject(error);
      }
    });
  });
}

function safeOrigin(value) {
  if (!value) return null;
  try { return new URL(value).origin; } catch { return null; }
}

function isSameOriginRequest(req, config) {
  const expected = safeOrigin(config.siteUrl);
  if (!expected) return false;
  const origin = safeOrigin(req.headers && req.headers.origin);
  if (origin) return origin === expected;
  const referer = safeOrigin(req.headers && req.headers.referer);
  return Boolean(referer && referer === expected);
}

module.exports = { readForm, isSameOriginRequest };
