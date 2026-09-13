'use strict';

function renderSettingsMenu() {
  return `<details class="settings-menu"><summary aria-label="Open settings menu">☰ Settings</summary><nav class="settings-menu-panel" aria-label="Settings"><a href="/notifications">Notifications</a><a href="/settings/calendars">Calendars</a><a href="/me/settings/gmail">Gmail</a><div class="settings-menu-divider" aria-hidden="true"></div><form method="post" action="/auth/logout"><button type="submit">Log out</button></form></nav></details>`;
}

function settingsMenuStyles() {
  return `<style data-settings-menu-styles>.settings-menu{position:relative;display:inline-block}.settings-menu summary{list-style:none;cursor:pointer;border:1px solid #d7e0e4;background:#fff;color:#122432;border-radius:9px;padding:8px 10px;font:inherit;font-weight:750;font-size:12px;line-height:1.2;white-space:nowrap;user-select:none}.settings-menu summary::-webkit-details-marker{display:none}.settings-menu summary:focus-visible,.settings-menu-panel a:focus-visible,.settings-menu-panel button:focus-visible{outline:3px solid #2f80ed;outline-offset:2px}.settings-menu[open] summary{background:#f7f9fa}.settings-menu-panel{position:absolute;right:0;top:calc(100% + 8px);z-index:100;display:grid;min-width:220px;padding:7px;background:#fff;border:1px solid #d7e0e4;border-radius:12px;box-shadow:0 14px 36px rgba(18,36,50,.16)}.settings-menu-panel a,.settings-menu-panel button{display:block;width:100%;border:0;background:transparent;color:#122432;text-align:left;text-decoration:none;border-radius:8px;padding:10px 11px;font:inherit;font-size:13px;font-weight:700;cursor:pointer}.settings-menu-panel a:hover,.settings-menu-panel button:hover{background:#f2f5f6}.settings-menu-panel form{margin:0}.settings-menu-divider{height:1px;background:#e5ebee;margin:5px 3px}@media(max-width:650px){.settings-menu summary{padding:7px 9px;font-size:11px}.settings-menu-panel{min-width:210px;max-width:calc(100vw - 20px)}}</style>`;
}

const HOME_ACTIONS = '<a class="button" href="/notifications">Notifications</a><a class="button" href="/settings/calendars">Calendars</a><a class="button" href="/me/settings/gmail">Gmail</a><form method="post" action="/auth/logout"><button class="button" type="submit">Log out</button></form>';

function enhanceHomeSettingsMenu(html) {
  let out = String(html || '');
  if (!out.includes('class="settings-menu"')) {
    out = out.replace(HOME_ACTIONS, renderSettingsMenu());
  }
  if (!out.includes('data-settings-menu-styles')) {
    out = out.replace('</head>', `${settingsMenuStyles()}</head>`);
  }
  return out;
}

module.exports = { renderSettingsMenu, settingsMenuStyles, enhanceHomeSettingsMenu };
