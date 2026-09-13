function safeDecode(value) {
  try { return decodeURIComponent(value); } catch { return value; }
}

function parseCookies(header = '') {
  if (!header) return {};
  const out = {};
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    if (!name) continue;
    out[name] = safeDecode(part.slice(index + 1).trim());
  }
  return out;
}

function assertSafeToken(label, value) {
  const text = String(value);
  if (/\r|\n|\0/.test(text)) throw new Error(`${label} contains invalid control characters`);
  return text;
}

function serializeCookie(name, value, options = {}) {
  name = assertSafeToken('Cookie name', name);
  value = assertSafeToken('Cookie value', value);
  if (!/^[!#$%&'*+\-.^_`|~0-9A-Za-z]+$/.test(name)) throw new Error('Cookie name is invalid');
  const parts = [`${name}=${encodeURIComponent(value)}`];
  if (options.maxAge !== undefined) parts.push(`Max-Age=${Math.trunc(options.maxAge)}`);
  if (options.domain) parts.push(`Domain=${assertSafeToken('Cookie domain', options.domain)}`);
  if (options.path) parts.push(`Path=${assertSafeToken('Cookie path', options.path)}`);
  if (options.httpOnly) parts.push('HttpOnly');
  if (options.secure) parts.push('Secure');
  if (options.sameSite) parts.push(`SameSite=${assertSafeToken('Cookie SameSite', options.sameSite)}`);
  return parts.join('; ');
}

module.exports = { parseCookies, serializeCookie };
