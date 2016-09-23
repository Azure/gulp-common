'use strict';

var arduino = require('./arduino.js');

function initTasks(gulp, options) {
  options.board.package = 'esp8266';
  options.board.arch = 'esp8266';
  arduino.initTasks(gulp, options);

  gulp.task('install-tools-board-specific', false, function(cb) {
    arduino.installPackage('esp8266', 'esp8266', 'http://arduino.esp8266.com/stable/package_esp8266com_index.json', cb);
  })
}

module.exports.initTasks = initTasks;
