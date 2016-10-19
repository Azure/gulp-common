/*
* Gulp Common - Microsoft Sample Code - Copyright (c) 2016 - Licensed MIT
*/
'use strict';

var fs = require('fs');
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

  gulp.task('rpi-install-tools', false, function(cb) {
    all.sshExecCmd("sudo apt-get update && " +
                   "sudo apt-get -y install curl libcurl4-openssl-dev uuid-dev uuid g++ make cmake git unzip openjdk-7-jre libssl-dev libncurses-dev subversion gawk",
                   { verbose: args.verbose }, cb);
  })

  gulp.task('rpi-clone-azure-sdk', false, function(cb) {
    all.sshExecCmd("git clone --recursive https://github.com/Azure/azure-iot-sdks.git", { verbose: args.verbose }, cb);
  })

  //gulp.task('rpi-clone-wiring-pi', false, function(cb) {
  //  all.sshExecCmd("git clone --recursive https://github.com/WiringPi/WiringPi.git", { verbose: args.verbose }, cb);
  //})

  gulp.task('rpi-build-azure-iot-sdk', false, function(cb) {
    all.sshExecCmd("cd ~/azure-iot-sdks && " + 
                   "sudo c/build_all/linux/setup.sh && " +
                   "sudo c/build_all/linux/build.sh --skip-unittests", { verbose: args.verbose }, cb);
  })

  gulp.task('install-tools', 'Installs required software on Raspberry Pi', function(cb) {
    runSequence('rpi-install-tools', 'rpi-clone-azure-sdk', /*'rpi-clone-wiring-pi',*/ 'rpi-build-azure-iot-sdk', cb);
  });

  gulp.task('deploy', false, ['check-raspbian'], function (cb) {
    // write config file only if any
    all.writeConfigH();

    all.uploadFilesViaScp(['./app/main.c', './app/config.h'], [targetFolder + '/main.c', targetFolder + '/config.h'], cb);
  });

  gulp.task('build', 'Builds sample code', ['deploy'], function (cb) {

    // in first step just compile sample file
    var cmdCompile = 'arm-linux-gnueabihf-gcc -std=c99';

    if (options.inc) {
      for (let i = 0; i < options.inc.length; i++) {
        let p = options.inc[i];

        if (p.startsWith('~')) {
          cmdCompile += ' -I/home/pi' + p.split('~')[1];
        } else {
          cmdCompile += ' -I' + p;
        }
      }
    }

    cmdCompile += ' -o ' + targetFolder + '/main.o ' +
      '-c ' + targetFolder + '/main.c';

    // second step -- link with prebuild libraries
    var cmdLink = 'arm-linux-gnueabihf-gcc ' +
      targetFolder + '/main.o ' +
      '-o ' + targetFolder + '/' + startFile +
      ' -rdynamic ';

    if (options.lib) {
      for (let i = 0; i < options.lib.length; i++) {
        let l = options.lib[i];

        if (l.startsWith('~')) {
          cmdLink += ' /home/pi' + l.split('~')[1];
        } else {
          cmdLink += ' -l' + l;
        }
      }
    }

    all.sshExecCmd(cmdCompile + " && " + cmdLink, { verbose: args.verbose }, cb);
  });

  gulp.task('check-raspbian', false, function (cb) {
    all.sshExecCmd('uname -a', { verbose: args.verbose, marker: 'Linux raspberrypi 4.4' }, function (err) {
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

  gulp.task('run-internal', false, function (cb) {
    all.sshExecCmd('sudo chmod +x ' + targetFolder + '/' + startFile + ' ; sudo '
      + targetFolder + '/' + startFile, { verbose: true }, cb);
  });

  gulp.task('run', 'Runs deployed sample on the board', ['run-internal']);

  gulp.task('all', 'Builds, deploys and runs sample on the board', function (callback) {
    runSequence('install-tools', 'build', 'deploy', 'run', callback);
  })
}

module.exports = initTasks;
