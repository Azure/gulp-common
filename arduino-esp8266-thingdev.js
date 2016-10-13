/*
* Gulp Common - Microsoft Sample Code - Copyright (c) 2016 - Licensed MIT
*/
'use strict';

/**
 * Main entry point for all Arduino ESP8266 ThingDev configuration.
 * @param {object} gulp     - Gulp instance
 */
function initTasks(gulp, options) {
  var all = require('./all.js')(options);

  if (typeof all.gulpTaskBI === 'function') {
    all.gulpTaskBI(gulp, 'c', 'thingdev', ((options && options.appName) ? options.appName : 'unknown'));
  }

  // initialize options if undefined
  if (typeof options != 'object') options = {};
  if (typeof options.libraries == 'undefined') options.libraries = [];
  if (typeof options.board == 'undefined') options.board = {};

  options.board.board = 'thingdev';
  options.board.parameters = '';

  require('./arduino-esp8266.js')(gulp, options);
}

module.exports = initTasks;
