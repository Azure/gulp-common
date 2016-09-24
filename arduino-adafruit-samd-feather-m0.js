'use strict';

/**
 * Main entry point for all Arduino Adafruit Feather M0 configuration.
 * @param {object} gulp     - Gulp instance
 */
function initTasks(gulp) {
  require('./arduino-adafruit.js')(gulp, { board: { board: 'adafruit_feather_m0', parameters: '' }, libraries: []});
}

module.exports = initTasks;
