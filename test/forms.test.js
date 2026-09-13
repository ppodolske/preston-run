const assert = require('node:assert/strict');
const { Readable } = require('node:stream');
const { readForm, isSameOriginRequest } = require('../src/http/forms');

function request(body, headers={}) {
  const req = Readable.from([Buffer.from(body)]);
  req.headers = headers;
  return req;
}

(async () => {
  let form = await readForm(request('name=Preston&notes=hello+world', {'content-type':'application/x-www-form-urlencoded'}));
  assert.equal(form.get('name'), 'Preston');
  assert.equal(form.get('notes'), 'hello world');

  await assert.rejects(readForm(request('x=1', {'content-type':'application/json'})), error => error.statusCode === 415);
  await assert.rejects(readForm(request('x='.padEnd(100, 'a'), {'content-type':'application/x-www-form-urlencoded'}), {maxBytes:10}), error => error.statusCode === 413);

  const config = {siteUrl:'https://preston.run'};
  assert.equal(isSameOriginRequest({headers:{origin:'https://preston.run'}}, config), true);
  assert.equal(isSameOriginRequest({headers:{origin:'https://evil.example'}}, config), false);
  assert.equal(isSameOriginRequest({headers:{referer:'https://preston.run/people'}}, config), true);
  assert.equal(isSameOriginRequest({headers:{referer:'https://evil.example/people'}}, config), false);
  assert.equal(isSameOriginRequest({headers:{}}, config), false);
  console.log('form tests passed');
})().catch(error => { console.error(error); process.exit(1); });
