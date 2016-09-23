'use strict';

function initTasks(gulp) {
  require('./arduino-esp8266.js')(gulp, { board: { board: 'huzzah', parameters: 'CpuFrequency=80,UploadSpeed=115200,FlashSize=4M3M' }});
}

module.exports = initTasks;
