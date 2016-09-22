
function initTasks(gulp) {
  require('./arduino-adafruit.js')(gulp, { board: { board: 'adafruit_feather_m0', parameters: '' }});
}

module.exports = initTasks;
