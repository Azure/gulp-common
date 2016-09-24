'use strict';

/**
 * Main entry point for all Arduino ESP8266 ThingDev configuration.
 * @param {object} gulp     - Gulp instance
 */
function initTasks(gulp) {
  require('./arduino-esp8266.js')(gulp, { board: { board: 'thingdev', parameters: ''}, libraries: [] });
}

module.exports = initTasks;
