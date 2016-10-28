/*
* Gulp Common - Microsoft Sample Code - Copyright (c) 2016 - Licensed MIT
*/
'use strict';

var bi = require('az-iot-bi');

var biHelper = {};

biHelper.gulpTaskBI = function (gulpInst, language, board, sample) {
  bi.start();

  if (!gulpInst) {
    bi.trackEvent('null_gulp_inst', {
      language: language,
      board: board,
      sample: sample
    });
    bi.flush();
    return;
  }

  gulpInst.on('task_start', function(e) {
    bi.trackEvent(e.task + '-start' || 'gulp_task_start', {
      language: language,
      board: board,
      sample: sample,
    });
    bi.flush();
  });

  gulpInst.on('task_stop', function(e) {
    bi.trackEvent(e.task || 'gulp_task_stop', {
      language: language,
      board: board,
      sample: sample,
      duration: e.duration
    });
    bi.flush();
  });

  gulpInst.on('task_err', function(e) {
    bi.trackEvent(e.task || 'gulp_task_err', {
      language: language,
      board: board,
      sample: sample,
      duration: e.duration,
      error: e.err || e.message
    });
    bi.flush();
  });

  gulpInst.on('task_not_found', function(e) {
    bi.trackEvent(e.task || 'gulp_task_not_found', {
      language: language,
      board: board,
      sample: sample,
      error: 'task_not_found'
    });
    bi.flush();
  });
};

module.exports = biHelper;
