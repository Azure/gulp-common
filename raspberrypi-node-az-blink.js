var raspberrypi = require('./raspberrypi-node.js');

var all = require('./all.js');
var config = (all.fileExistsSync('../config.json')) ? require('../config.json') : require('../../config.json');
var Q = require('q');
var simssh = require('simple-ssh');

var sendMessageToIoTHub = function (callback) {
  var deferred = Q.defer();

  // Send command to device
  var ssh = new simssh({
    host: config.device_host_name_or_ip_address,
    user: config.device_user_name,
    pass: config.device_password
  });

  ssh.on('error', function (e) {
    // when we pass error via deferred.reject, stack will be displayed
    // as it is just string, we can just replace it with message
    e.stack = "ERROR: " + e.message;
    deferred.reject(e);
  });

  var targetFolder = config.project_folder ? config.project_folder : '.';
  var startFile = config.start_file ? config.start_file : 'az-blink.js';
  ssh.exec('sudo nodejs ' + targetFolder + '/' + startFile, {
    pty: true,
    out: function (o) { console.log(o); }, // Always log to console when running.
    exit: function () {
      return callback(deferred);
    }
  }).start();

  return deferred.promise;
}

function initTasks(gulp, options) {
  raspberrypi.initTasks(gulp);

  gulp.task('run', function () {
    options.main();
    return sendMessageToIoTHub(options.callback);
  });
}

module.exports = initTasks;
module.exports.initTasks = initTasks;