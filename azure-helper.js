/*
* Gulp Common - Microsoft Sample Code - Copyright (c) 2016 - Licensed MIT
*/
'use strict';

var prompt = require('gulp-prompt');

var all;

function initTasks(gulp, options) {
  all = require('./all.js')(options);

  gulp.task('configure', 'Interactive Azure IoT Hub configuration helper', function (cb) {

    // XXX - call az accounts, to get list of available accounts

    // XXX - 
    cb();
  })

  function loginToAzure(cb) {

    cb();
  }

  function selectAccount(cb) {
    cb();
  }
}

module.exports = initTasks;
