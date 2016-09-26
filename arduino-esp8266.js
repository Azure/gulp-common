﻿'use strict';

// [REVIEW] remove install-tools-board-specific - this should be done via options

/**
 * Main entry point for all Arduino ESP8266 boards.
 * @param {object} gulp     - Gulp instance
 * @param {object} options  - Arduino specific options 
 */
function initTasks(gulp, options) {
  
  options.board.package = 'esp8266';
  options.board.arch = 'esp8266';
  options.board.packageUrl = 'http://arduino.esp8266.com/stable/package_esp8266com_index.json';
  require('./arduino.js')(gulp, options);
}

module.exports = initTasks;
