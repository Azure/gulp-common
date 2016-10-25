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
    all.gulpTaskBI(gulp, 'c', 'RaspberryPi', ((options && options.appName) ? options.appName : 'unknown'));
  }

  var runSequence = require('run-sequence').use(gulp);

  gulp.task('init', 'Initializes sample', function (cb) {

    if (options.configPostfix && options.configTemplate) {
      all.updateGlobalConfig(options.configPostfix, options.configTemplate);
    }

    cb();
  })

  gulp.task('check-raspbian', false, function (cb) {
    all.sshExecCmd('uname -a', { verbose: args.verbose, marker: 'Linux raspberrypi 4.4', sshPrintCommands: true }, function (err) {
      if (err) {
        if (err.marker) {
          console.log('--------------------');
          console.log('WARNING: Unsupported OS version - sample code may not work properly');
          console.log('--------------------');
          cb();
        } else {
          cb(err);
        }
      } else {
        cb();
      }
    });
  })

  gulp.task('rpi-clone-azure-sdk', false, function(cb) {
    all.sshExecCmds([ "if [ ! -d ~/azure-iot-sdks ]; then git clone https://github.com/Azure/azure-iot-sdks.git; fi",
                      "cd azure-iot-sdks && git submodule update --init -- c/uamqp",
                      "cd azure-iot-sdks && git submodule update --init -- c/umqtt",
                      "cd azure-iot-sdks && git submodule update --init -- c/c-utility",
                      "cd azure-iot-sdks && git submodule update --init -- c/parson",
                      "cd azure-iot-sdks/c/uamqp && git submodule update --init -- c-utility",
                      "cd azure-iot-sdks/c/umqtt && git submodule update --init -- c-utility",
                      ],
                      { verbose: args.verbose,
                        sshPrintCommands: true,
                        validate: true }, cb);
  })

  gulp.task('rpi-build-azure-iot-sdk', false, function(cb) {
    all.sshExecCmds([ "cd ~/azure-iot-sdks && sudo c/build_all/linux/setup.sh --no-mqtt",
                      "cd ~/azure-iot-sdks && sudo c/build_all/linux/build.sh --skip-unittests --no-mqtt" ],
                    { verbose: args.verbose,
                      sshPrintCommands: true,
                      validate: true }, cb);
  })

  gulp.task('install-tools', 'Installs required software on the device', function(cb) {
    runSequence('check-raspbian', 'rpi-clone-azure-sdk', 'rpi-build-azure-iot-sdk', cb);
  });

  gulp.task('deploy', 'Deploy and build sample code on the device', function (cb) {
    // write config file only if any
    all.writeConfigH();

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
        all.sshExecCmds( [ 'cd ' + targetFolder + ' && cmake .',
                           'cd ' + targetFolder + ' && make' ],
                         { verbose: args.verbose,
                           sshPrintCommands: true,
                           validate: true }, cb);
      }
    });
  });

  gulp.task('run-internal', false, function (cb) {
    all.sshExecCmd('sudo chmod +x ' + targetFolder + '/' + startFile + ' ; sudo '
      + targetFolder + '/' + startFile, { verbose: true, sshPrintCommands: true }, cb);
  });

  gulp.task('run', 'Runs deployed sample on the board', ['run-internal']);

  gulp.task('all', 'Builds, deploys and runs sample on the board', function (callback) {
    runSequence('install-tools', 'build', 'deploy', 'run', callback);
  })
}

module.exports = initTasks;
