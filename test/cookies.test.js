const assert = require('node:assert/strict');
const { parseCookies, serializeCookie } = require('../src/http/cookies');
assert.deepEqual(parseCookies('a=1; b=hello%20world'), { a:'1', b:'hello world' });
assert.deepEqual(parseCookies(''), {});
const value = serializeCookie('sb-test', 'abc', { httpOnly:true, secure:true, sameSite:'Lax', path:'/' });
assert.match(value, /^sb-test=abc;/);
for (const token of ['HttpOnly','Secure','SameSite=Lax','Path=/']) assert.match(value, new RegExp(token));
assert.throws(() => serializeCookie('bad\nname','x'), /control|invalid/);
console.log('cookie tests passed');
