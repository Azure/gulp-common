'use strict';

/**
 * Main entry point for all Arduino ESP8266 Feather Huzzah configuration.
 * @param {object} gulp     - Gulp instance
 */
function initTasks(gulp) {
  require('./arduino-esp8266.js')(gulp, { board: { board: 'huzzah', parameters: 'CpuFrequency=80,UploadSpeed=115200,FlashSize=4M3M'}, libraries: [] });
}

module.exports = initTasks;
