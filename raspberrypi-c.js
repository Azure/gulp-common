﻿/*
* Gulp Common - Microsoft Sample Code - Copyright (c) 2016 - Licensed MIT
*/
'use strict';

var all = require('./all.js');
var config = require(process.cwd() + '/config.json');

var fs = require('fs');
var args = require('get-gulp-args')();

var SAMPLE_NAME = 'main';
var PREBUILT_FOLDER = all.getToolsFolder() + '/az-iot-sdk-prebuilt';
var TOOLCHAIN_ZIP_FILE = all.getToolsFolder() + '/toolchain.zip';
var TOOLCHAIN_UNZIP_FOLDER = all.getToolsFolder() + '/gcc-linaro-arm-linux-gnueabihf-4.9-2014.09_win32';

function initTasks(gulp, options) {

  if (typeof all.gulpTaskBI === 'function') {
    all.gulpTaskBI(gulp, 'c', 'RaspberryPi', ((options && options.appName) ? options.appName : 'unknown'));
  }

  var runSequence = require('run-sequence').use(gulp);

  gulp.task('install-tools', 'Installs Raspberry Pi crosscompiler and libraries', function (cb) {

    // clone helper repository to tools folder -- if it doesn't exists
    all.localRetrieve('https://github.com/zikalino/az-iot-sdk-prebuilt.git', null, function(error) {

      if (error) {
        cb(error);
        return;
      }

      if (process.platform == 'win32') {
        all.localRetrieve('https://releases.linaro.org/14.09/components/toolchain/binaries/gcc-linaro-arm-linux-gnueabihf-4.9-2014.09_win32.zip', null, cb);
      } else if (process.platform == 'linux') {
        all.localRetrieve('https://github.com/me-no-dev/RasPiArduino/releases/download/0.0.1/arm-linux-gnueabihf-linux64.tar.gz', null, cb);
      } else if (process.platform == 'darwin') {
        all.localRetrieve('https://github.com/me-no-dev/RasPiArduino/releases/download/0.0.1/arm-linux-gnueabihf-osx.tar.gz', null, cb);
      } else {
        console.log('We dont have tools for your operating system at this time');
        cb(new Error('We dont have tools for your operating system at this time'));
      }
    });
  });

  gulp.task('build', 'Builds sample code', function(cb) {

    // write config file only if data is available in config.json
    if (config.iot_hub_host_name) {
      /*  String containing Hostname, Device Id & Device Key in the format:                       */
      /*  "HostName=<host_name>;DeviceId=<device_id>;SharedAccessKey=<device_key>"                */
      /*  "HostName=<host_name>;DeviceId=<device_id>;SharedAccessSignature=<device_sas_token>"    */
      var connectionString = 'HostName=' + config.iot_hub_host_name + ';DeviceId=' + config.iot_hub_device_id + ';SharedAccessKey=' + config.iot_hub_device_key;
      var headerContent = 'static const char* connectionString = ' + '"' + connectionString + '"' + ';';
      fs.writeFileSync('./app/config.h', headerContent);
    }

    // remove old out directory and create empty one
    all.deleteFolderRecursivelySync('out');
    fs.mkdirSync('out');

    // in first step just compile sample file
    var cmd_compile = getCompilerFolder() + '/arm-linux-gnueabihf-gcc ' +
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
    var cmd_link = getCompilerFolder() + '/arm-linux-gnueabihf-gcc ' +
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
              //'--sysroot=' + PREBUILT_FOLDER + '/raspbian-jessie-sysroot ' +
              // for some reason --sysroot option doesn't work very well on OS X, so i had to add following:
              '-Wl,-rpath,' + PREBUILT_FOLDER + '/raspbian-jessie-sysroot/usr/lib/arm-linux-gnueabihf,-rpath,' + PREBUILT_FOLDER + '/raspbian-jessie-sysroot/lib/arm-linux-gnueabihf';

    all.localExecCmds([cmd_compile, cmd_link ], args.verbose, cb)
  });

  gulp.task('check-raspbian', false, function(cb) {
    all.sshExecCmd('uname -a', config, { verbose: args.verbose, marker: 'Linux raspberrypi 4.4' }, function(err) {
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

  gulp.task('deploy', 'Deploys compiled sample to the board', ['check-raspbian'], function(cb){
    all.uploadFilesViaScp(config, ['./out/' + SAMPLE_NAME], ['./' + SAMPLE_NAME + '/' + SAMPLE_NAME ], cb);
  });

  gulp.task('run', 'Runs deployed sample on the board', function (cb) {
    all.sshExecCmd('sudo chmod +x ./'+ SAMPLE_NAME + '/' + SAMPLE_NAME + ' ; sudo ./' + SAMPLE_NAME + '/' + SAMPLE_NAME, config, { verbose: true }, cb);
  });

  gulp.task('all', 'Builds, deploys and runs sample on the board', function(callback) {
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
