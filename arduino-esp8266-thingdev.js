'use strict';

function initTasks(gulp) {
  require('./arduino-esp8266.js')(gulp, { board: { board: 'thingdev', parameters: '' }});
}

module.exports = initTasks;
