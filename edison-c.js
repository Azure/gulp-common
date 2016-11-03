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
    var repoFolderPath = all.getToolsFolder() + '/' + 'azure-iot-sdks';
    fs.exists(repoFolderPath, function (exists) {
      if (exists) {
        console.log('Azure IoT SDK repo already exists in folder ' + repoFolderPath);
      } else {
        console.log('Clone Azure IoT SDK to folder ' + repoFolderPath + '. It will take several minutes.');
        all.localExecCmd("git clone --recursive https://github.com/Azure/azure-iot-sdks.git " + repoFolderPath, args.verbose, cb);
      }
    });
  });

  gulp.task('upload-sdk-to-device', false, function (cb) {
    // TODO: check the folder existence on device before copy.
    // Console output: 1. already exists; 2. may take several minutes.
    var folderName = 'azure-iot-sdks';
    var repoFolderPath = all.getToolsFolder() + '/' + folderName + '/';

    var src = [];
    src.push(repoFolderPath);
    var target = [];
    target.push('./' + folderName + '/');

    all.uploadFilesViaScp(src, target, function (err) {
      if (err) {
        console.log(err);
      }
      if (cb) {
        cb(err);
      }
    });
  });

  gulp.task('build-iot-sdk-on-device', false, function (cb) {
    all.sshExecCmds(["cd ~/azure-iot-sdks && sudo c/build_all/linux/build.sh --skip-unittests"],
      {
        verbose: args.verbose,
        sshPrintCommands: true,
        validate: true
      }, cb);
  });

  gulp.task('install-tools', 'Installs required software on the device', function (cb) {
    runSequence('install-mraa', 'clone-iot-sdk', 'upload-sdk-to-device', 'build-iot-sdk-on-device', cb);
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
