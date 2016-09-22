
var arduino = require('./arduino.js');

function initTasks(gulp, options) {
  var runSequence = require('run-sequence').use(gulp);

  options.board.package = 'adafruit';
  options.board.arch = 'samd';
  
  arduino.initTasks(gulp, options);

  gulp.task('install-tools-adafruit-via-arduino', false, function(cb) {
    arduino.installPackage('adafruit', 'samd', 'https://adafruit.github.io/arduino-board-index/package_adafruit_index.json', cb);
  })

  gulp.task('install-tools-winc1500', false, function(cb) {
    arduino.cloneLibrary('Adafruit_WINC1500', 'https://github.com/adafruit/Adafruit_WINC1500.git', cb);    
  });

  gulp.task('install-rtczero', false, function(cb) {
    arduino.installLibrary('RTCZero', cb);
  });

  gulp.task('install-tools-board-specific', false, function (cb) {
    runSequence('install-tools-adafruit-via-arduino', 'install-tools-winc1500', 'install-rtczero', cb);
  });
}

module.exports = initTasks;
module.exports.initTasks = initTasks;
