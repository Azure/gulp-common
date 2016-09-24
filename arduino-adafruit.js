'use strict';

var arduino = require('./arduino.js');

function initTasks(gulp, options) {

  // set board options
  options.board.package = 'adafruit';
  options.board.arch = 'samd';

  // add adafruit specific libraries
  options.libraries.push('https://github.com/adafruit/Adafruit_WINC1500.git');
  options.libraries.push('RTCZero');

  // init base arduino tasks  
  arduino.initTasks(gulp, options);

  gulp.task('install-tools-board-specific', false, function (cb) {
    arduino.installPackage('adafruit', 'samd', 'https://adafruit.github.io/arduino-board-index/package_adafruit_index.json', cb);
  });
}

module.exports = initTasks;
