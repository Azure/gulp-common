'use strict';

// [REVIEW] remove install-tools-board-specific - this should be done via options

/**
 * Main entry point for all Arduino ESP8266 boards.
 * @param {object} gulp     - Gulp instance
 * @param {object} options  - Arduino specific options 
 */
function initTasks(gulp, options) {
  
  var arduino = require('./arduino.js');

  options.board.package = 'esp8266';
  options.board.arch = 'esp8266';
  arduino.initTasks(gulp, options);

  gulp.task('install-tools-board-specific', false, function(cb) {
    arduino.installPackage('esp8266', 'esp8266', 'http://arduino.esp8266.com/stable/package_esp8266com_index.json', cb);
  })
}

module.exports = initTasks;
