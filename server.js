const http = require('node:http');
const { loadConfig } = require('./src/config');
const { createApp } = require('./src/app');
const config = loadConfig();
http.createServer(createApp(config)).listen(config.port, '0.0.0.0', () => {
  console.log(`preston.ai v0.5.0 listening on ${config.port}`);
});
