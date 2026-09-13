'use strict';

const TOKENS = Object.freeze({
  colors: Object.freeze({
    background: '#eef2f4',
    card: '#ffffff',
    line: '#d7e0e4',
    ink: '#122432',
    muted: '#667781',
    navy: '#162a4c',
    blue: '#075b8e',
    green: '#147a4b',
    amber: '#9b6414',
    red: '#9d3030',
    focus: '#2f80ed'
  }),
  radii: Object.freeze({
    small: '9px',
    medium: '14px',
    large: '18px'
  }),
  maxWidths: Object.freeze({
    standard: '900px',
    wide: '1320px'
  }),
  breakpoints: Object.freeze({
    mobile: '620px',
    narrow: '760px'
  })
});

module.exports = { TOKENS };
