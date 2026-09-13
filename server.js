const http = require('node:http');
const { loadConfig } = require('./src/config');
const { createApp } = require('./src/app');
const { VERSION } = require('./src/branding');
const config = loadConfig();
http.createServer(createApp(config)).listen(config.port, '0.0.0.0', () => {
  console.log(`preston.ai v${VERSION} listening on ${config.port}`);
});
