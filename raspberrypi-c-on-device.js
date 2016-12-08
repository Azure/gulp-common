/*
* Gulp Common - Microsoft Sample Code - Copyright (c) 2016 - Licensed MIT
*/
'use strict';

var args = require('get-gulp-args')();
var fs = require('fs');
var path = require('path');

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

  gulp.task('install-tools', 'Installs required software on the device', function (cb) {
    all.sshExecCmds(["grep -q -F 'deb http://ppa.launchpad.net/aziotsdklinux/ppa-azureiot/ubuntu vivid main' /etc/apt/sources.list "
      + "|| sudo sh -c \"echo 'deb http://ppa.launchpad.net/aziotsdklinux/ppa-azureiot/ubuntu vivid main' >> /etc/apt/sources.list\"",
      "grep -q -F 'deb-src http://ppa.launchpad.net/aziotsdklinux/ppa-azureiot/ubuntu vivid main' /etc/apt/sources.list "
      + "|| sudo sh -c \"echo 'deb-src http://ppa.launchpad.net/aziotsdklinux/ppa-azureiot/ubuntu vivid main' >> /etc/apt/sources.list\"",
      "sudo apt-key adv --keyserver keyserver.ubuntu.com --recv-keys FDA6A393E4C2257F",
      "sudo apt-get update",
      "sudo apt-get install -y azure-iot-sdk-c-dev",
      "sudo apt-get install -y cmake"
    ],
      {
        verbose: args.verbose,
        sshPrintCommands: true,
        validate: true
      }, cb);
  })

  gulp.task('buildsdk', 'Build azure iothub sdk on the device', function (cb) {
    runSequence('rpi-clone-azure-sdk', 'rpi-build-azure-iot-sdk', cb);
  })

  gulp.task('rpi-clone-azure-sdk', false, function (cb) {
    all.sshExecCmds(["if [ ! -d ~/azure-iot-sdks ]; then git clone https://github.com/Azure/azure-iot-sdks.git; fi",
      "cd azure-iot-sdks && git submodule update --init -- c/uamqp",
      "cd azure-iot-sdks && git submodule update --init -- c/umqtt",
      "cd azure-iot-sdks && git submodule update --init -- c/c-utility",
      "cd azure-iot-sdks && git submodule update --init -- c/parson",
      "cd azure-iot-sdks/c/uamqp && git submodule update --init -- c-utility",
      "cd azure-iot-sdks/c/umqtt && git submodule update --init -- c-utility",
    ],
      {
        verbose: args.verbose,
        sshPrintCommands: true,
        validate: true
      }, cb);
  })

  gulp.task('rpi-build-azure-iot-sdk', false, function (cb) {
    all.sshExecCmds(["cd ~/azure-iot-sdks && sudo c/build_all/linux/setup.sh",
      "cd ~/azure-iot-sdks && sudo c/build_all/linux/build.sh --skip-unittests"],
      {
        verbose: args.verbose,
        sshPrintCommands: true,
        validate: true
      }, cb);
  })

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

    // optionally copy X.509 certificate(s) and associated private key(s) to the device
    if (config.iot_device_connection_string &&
      config.iot_device_connection_string.toLowerCase().indexOf('x509=true') >=0) {

      var toolsFolder = all.getToolsFolder();
      var certName = all.getDeviceId() + '-cert.pem';
      var certPath = path.join(toolsFolder, certName);
      var keyName = all.getDeviceId() + '-key.pem';
      var keyPath = path.join(toolsFolder, keyName);

      if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
        src.push(certPath);
        dst.push(targetFolder + '/' + certName);
        src.push(keyPath);
        dst.push(targetFolder + '/' + keyName);
      }
    }

    all.uploadFilesViaScp(src, dst, function (err) {
      if (err) {
        cb(err);
      } else {
        var cmakecmd = 'cmake .';
        if (args.localsdk === 'true') {
          cmakecmd = 'cmake -Dazure_IoT_Sdks=~/azure-iot-sdks .';
        }
        all.sshExecCmds(['cd ' + targetFolder + ' && '+ cmakecmd,
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

    all.sshExecCmd('sudo chmod +x ./' + startFile + ' ; sudo ./' + startFile + ' ' + param,
      { verbose: true, sshPrintCommands: true, baseDir: targetFolder }, cb);
  });

  gulp.task('run', 'Runs deployed sample on the board', ['run-internal']);

  gulp.task('all', 'Builds, deploys and runs sample on the board', function (callback) {
    runSequence('install-tools', 'deploy', 'run', callback);
  })
}

module.exports = initTasks;
