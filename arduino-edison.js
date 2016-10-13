/*
* Gulp Common - Microsoft Sample Code - Copyright (c) 2016 - Licensed MIT
*/
'use strict';

var arduino = require('./arduino.js');

function initTasks(gulp, options) {
  var all = require('./all.js')(options);

  if (typeof all.gulpTaskBI === 'function') {
    all.gulpTaskBI(gulp, 'c', 'edison', ((options && options.appName) ? options.appName : 'unknown'));
  }

  arduino.initTasks(gulp);

  gulp.task('install-tools-board-specific', false, function(cb) {
    arduino.installPackage('Intel', 'i686', '', cb);
  });
}

module.exports.initTasks = initTasks;
