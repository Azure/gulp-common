/*
* Gulp Common - Microsoft Sample Code - Copyright (c) 2016 - Licensed MIT
*/
'use strict';

/**
 * Main entry point for all Arduino Adafruit Feather M0 configuration.
 * @param {object} gulp     - Gulp instance
 */
function initTasks(gulp, options) {
  var all = require('./all.js')(options);

  if (typeof all.gulpTaskBI === 'function') {
    all.gulpTaskBI(gulp, 'c', 'feather_m0', ((options && options.appName) ? options.appName : 'unknown'));
  }

  // initialize options if undefined
  if (typeof options != 'object') options = {};
  if (typeof options.libraries == 'undefined') options.libraries = [];
  if (typeof options.board == 'undefined') options.board = {};

  options.board.board = 'adafruit_feather_m0';
  options.board.parameters = '';

  require('./arduino-adafruit.js')(gulp, options);
}

module.exports = initTasks;
