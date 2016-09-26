'use strict';

var arduino = require('./arduino.js');

function initTasks(gulp, options) {

  // [REVIEW] verify and pass options
  // [REVIEW] install-tools-board-specific is no longer supported
  arduino.initTasks(gulp);

  gulp.task('install-tools-board-specific', false, function(cb) {
    arduino.installPackage('Intel', 'i686', '', cb);
  });
};

module.exports.initTasks = initTasks;
