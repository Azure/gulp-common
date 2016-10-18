﻿/*
* Gulp Common - Microsoft Sample Code - Copyright (c) 2016 - Licensed MIT
*/
'use strict';

var fs = require('fs');
var args = require('get-gulp-args')();

var all;

function initTasks(gulp, options) {
  all = require('./all.js')(options);

  var SAMPLE_NAME = 'main';
  var PREBUILT_FOLDER = all.getToolsFolder() + '/az-iot-sdk-prebuilt';
  var config = all.getConfig();

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

  gulp.task('rpi-clone-wiring-pi', false, function(cb) {
    all.sshExecCmd("git clone --recursive https://github.com/WiringPi/WiringPi.git", { verbose: args.verbose }, cb);
  })

  gulp.task('rpi-build-azure-iot-sdk', false, function(cb) {
    all.sshExecCmd("sudo ~/azure-iot-sdks/c/build_all/linux/setup.sh && " +
                   "sudo ~/azure-iot-sdks/c/build_all/linux/build.sh --skip-unittests", { verbose: args.verbose }, cb);
  })

  gulp.task('install-tools', 'Installs required software on Raspberry Pi', function(cb) {
    runSequence('rpi-install-tools', 'rpi-clone-azure-sdk', 'rpi-clone-wiring-pi', 'rpi-build-azure-iot-sdk', cb);
  });

  gulp.task('build', 'Builds sample code', function (cb) {

    // write config file only if any
    all.writeConfigH();

    // remove old out directory and create empty one
    all.deleteFolderRecursivelySync('out');
    fs.mkdirSync('out');

    // in first step just compile sample file
    var cmdCompile = getCompilerFolder() + '/arm-linux-gnueabihf-gcc ' +
      // XXX - don't include this
      //'-I' + PREBUILT_FOLDER + '/raspbian-jessie-sysroot/usr/include ' +
      '-I' + PREBUILT_FOLDER + '/inc/wiringpi ' +
      '-I' + PREBUILT_FOLDER + '/inc/serializer ' +
      '-I' + PREBUILT_FOLDER + '/inc/azure-c-shared-utility ' +
      '-I' + PREBUILT_FOLDER + '/inc/platform_specific ' +
      '-I' + PREBUILT_FOLDER + '/inc ' +
      '-I' + PREBUILT_FOLDER + '/inc/iothub_client ' +
      '-I' + PREBUILT_FOLDER + '/inc/azure-uamqp-c ' +
      '-o out/' + SAMPLE_NAME + '.o ' +
      '-c app/' + SAMPLE_NAME + '.c';

    // second step -- link with prebuild libraries
    var cmdLink = getCompilerFolder() + '/arm-linux-gnueabihf-gcc ' +
      'out/' + SAMPLE_NAME + '.o ' +
      '-o out/' + SAMPLE_NAME +
      ' -rdynamic ' +
      PREBUILT_FOLDER + '/raspbian-jessie/libserializer.a ' +
      PREBUILT_FOLDER + '/raspbian-jessie/libiothub_client.a ' +
      PREBUILT_FOLDER + '/raspbian-jessie/libiothub_client_amqp_transport.a ' +
      PREBUILT_FOLDER + '/raspbian-jessie/libaziotplatform.a ' +
      '-lwiringPi ' +
      PREBUILT_FOLDER + '/raspbian-jessie/libaziotsharedutil.a ' +
      PREBUILT_FOLDER + '/raspbian-jessie/libuamqp.a ' +
      PREBUILT_FOLDER + '/raspbian-jessie/libaziotsharedutil.a ' +
      '-lssl ' +
      '-lcrypto ' +
      '-lcurl ' +
      '-lpthread ' +
      '-lm ' +
      '-lssl ' +
      '-lcrypto ' +
      '--sysroot=' + PREBUILT_FOLDER + '/raspbian-jessie-sysroot ' +
      // for some reason --sysroot option doesn't work very well on OS X, so i had to add following:
      '-Wl,-rpath,' + PREBUILT_FOLDER + '/raspbian-jessie-sysroot/usr/lib/arm-linux-gnueabihf,-rpath,'
      + PREBUILT_FOLDER + '/raspbian-jessie-sysroot/lib/arm-linux-gnueabihf';

    all.localExecCmds([cmdCompile, cmdLink], args.verbose, cb)
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

  gulp.task('deploy', 'Deploys compiled sample to the board', ['check-raspbian'], function (cb) {
    all.uploadFilesViaScp(['./out/' + SAMPLE_NAME], ['./' + SAMPLE_NAME + '/' + SAMPLE_NAME], cb);
  });

  gulp.task('run-internal', false, function (cb) {
    all.sshExecCmd('sudo chmod +x ./' + SAMPLE_NAME + '/' + SAMPLE_NAME + ' ; sudo ./'
      + SAMPLE_NAME + '/' + SAMPLE_NAME, { verbose: true }, cb);
  });

  gulp.task('run', 'Runs deployed sample on the board', ['run-internal']);

  gulp.task('all', 'Builds, deploys and runs sample on the board', function (callback) {
    runSequence('install-tools', 'build', 'deploy', 'run', callback);
  })
}

function getCompilerName() {

  if (process.platform == 'win32') {
    return 'gcc-linaro-arm-linux-gnueabihf-4.9-2014.09_win32';
  } else if (process.platform == 'linux') {
    return 'arm-linux-gnueabihf';
  } else if (process.platform == 'darwin') {
    return 'arm-linux-gnueabihf';
  }

  return '';
}

function getCompilerFolder() {
  return all.getToolsFolder() + '/' + getCompilerName() + '/bin';
}

module.exports = initTasks;
