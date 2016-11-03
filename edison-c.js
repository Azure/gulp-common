/*
* Gulp Common - Microsoft Sample Code - Copyright (c) 2016 - Licensed MIT
*/
'use strict';

var args = require('get-gulp-args')();

var all;

function initTasks(gulp, options) {
  all = require('./all.js')(options);

  var config = all.getConfig();
  var targetFolder = config.project_folder ? config.project_folder : '.';
  var startFile = config.start_file ? config.start_file : 'app';

  // stick config into gulp object
  gulp.config = config;

  if (typeof all.gulpTaskBI === 'function') {
    all.gulpTaskBI(gulp, 'c', 'Edison', ((options && options.appName) ? options.appName : 'unknown'));
  }

  var runSequence = require('run-sequence').use(gulp);

  gulp.task('init', 'Initializes sample', function (cb) {

    if (options.configPostfix && options.configTemplate) {
      all.updateGlobalConfig(options.configPostfix, options.configTemplate);
    }

    cb();
  });

  gulp.task('install-mraa', false, function (cb) {
    all.sshExecCmd("opkg install mraa", { verbose: args.verbose }, cb);
  });

  gulp.task('clone-iot-sdk', false, function (cb) {
    all.sshExecCmds(["if [ ! -d ~/azure-iot-sdks ]; " +
      "then git clone https://github.com/Azure/azure-iot-sdks.git && cd ~/azure-iot-sdks && git checkout a291a82; fi",
      'cd ~/azure-iot-sdks/c/uamqp && if ! [ "$(ls -A .)" ]; ' +
    'then git clone https://github.com/Azure/azure-uamqp-c.git . && git checkout 6f05a06; fi',
      'cd ~/azure-iot-sdks/c/umqtt && if ! [ "$(ls -A .)" ]; ' +
    'then git clone https://github.com/Azure/azure-umqtt-c.git . && git checkout d09ed25; fi',
      'cd ~/azure-iot-sdks/c/parson && if ! [ "$(ls -A .)" ]; ' +
    'then git clone https://github.com/kgabis/parson.git . && git checkout c22be79; fi',
      'cd ~/azure-iot-sdks/c/c-utility && if ! [ "$(ls -A .)" ]; ' +
    'then git clone https://github.com/Azure/azure-c-shared-utility.git . && git checkout d42faec; fi',
      'cd ~/azure-iot-sdks/c/uamqp/c-utility && if ! [ "$(ls -A .)" ]; ' +
    'then git clone https://github.com/Azure/azure-c-shared-utility.git . && git checkout 749fdbd; fi',
      'cd ~/azure-iot-sdks/c/umqtt/c-utility && if ! [ "$(ls -A .)" ]; ' +
    'then git clone https://github.com/Azure/azure-c-shared-utility.git . && git checkout 749fdbd; fi'],
      {
        verbose: args.verbose,
        sshPrintCommands: true,
        validate: true
      }, cb);
  });

  gulp.task('build-iot-sdk', false, function (cb) {
    all.sshExecCmds(["cd ~/azure-iot-sdks && sudo c/build_all/linux/build.sh --skip-unittests"],
      {
        verbose: args.verbose,
        sshPrintCommands: true,
        validate: true
      }, cb);
  });

  gulp.task('install-tools', 'Installs required software on the device', function (cb) {
    runSequence('install-mraa', 'clone-iot-sdk', 'build-iot-sdk', cb);
  });


  gulp.task('deploy', 'Deploy and build sample code on the device', function (cb) {
    let src = [];
    let dst = [];

    if (options.app) {
      for (let i = 0; i < options.app.length; i++) {
        let f = options.app[i];
        src.push('./app/' + f);
        dst.push(targetFolder + '/' + f);
      }
    }

    all.uploadFilesViaScp(src, dst, function (err) {
      if (err) {
        cb(err);
      } else {
        all.sshExecCmds(['cd ' + targetFolder + ' && cmake .',
          'cd ' + targetFolder + ' && make'],
          {
            verbose: args.verbose,
            sshPrintCommands: true,
            validate: true
          }, cb);
      }
    });
  });

  gulp.task('run-internal', false, function (cb) {
    var param = '';
    if (config.iot_device_connection_string) {
      param = '"' + config.iot_device_connection_string + '"';
    }

    all.sshExecCmd('sudo chmod +x ' + targetFolder + '/' + startFile + ' ; sudo '
      + targetFolder + '/' + startFile + ' ' + param, { verbose: true, sshPrintCommands: true }, cb);
  });

  gulp.task('run', 'Runs deployed sample on the board', ['run-internal']);

  gulp.task('default', 'Deploys and runs sample on the board', function (callback) {
    runSequence('install-tools', 'deploy', 'run', callback);
  });
}

module.exports = initTasks;
