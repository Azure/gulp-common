var arduino = require('./arduino.js');

function initTasks(gulp) {
  arduino.initTasks(gulp);

  gulp.task('install-tools-board-specific', false, function(cb) {
    arduino.installPackage('esp8266', 'esp8266', 'http://arduino.esp8266.com/stable/package_esp8266com_index.json', cb);
  })
}

module.exports.initTasks = initTasks;
