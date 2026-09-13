'use strict';

const { renderHomePage: renderBaseHomePage } = require('./home');
const { enhanceHomeSettingsMenu } = require('../ui/settings-menu');

function renderHomePage(args = {}) {
  return enhanceHomeSettingsMenu(renderBaseHomePage(args));
}

module.exports = { renderHomePage };
