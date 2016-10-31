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
  })

  gulp.task('install-tools', 'Installs required software on the device', function (cb) {
    all.sshExecCmd("opkg install mraa", { verbose: args.verbose }, cb);
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
    all.sshExecCmd('sudo chmod +x ' + targetFolder + '/' + startFile + ' ; sudo '
      + targetFolder + '/' + startFile, { verbose: true, sshPrintCommands: true }, cb);
  });

  gulp.task('run', 'Runs deployed sample on the board', ['run-internal']);

  gulp.task('default', 'Deploys and runs sample on the board', function (callback) {
    runSequence('install-tools', 'deploy', 'run', callback);
  })
}

module.exports = initTasks;
