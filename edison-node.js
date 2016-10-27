/*
* Gulp Common - Microsoft Sample Code - Copyright (c) 2016 - Licensed MIT
*/
'use strict';

var args = require('get-gulp-args')();
var fs = require('fs');

/**
 * Main entry point for all Intel Edison Node configuration.
 * @param {object} gulp     - Gulp instance
 * @param {object} options  - Intel Edison Node Specific options
 */
function initTasks(gulp, options) {
  var runSequence = require('run-sequence').use(gulp);
  var all = require('./all.js')(options);
  var config = all.getConfig();

  // stick config into gulp object
  gulp.config = config;

  if (typeof all.gulpTaskBI === 'function') {
    all.gulpTaskBI(gulp, 'nodejs', 'Edison', ((options && options.appName) ? options.appName : 'unknown'));
  }

  gulp.task('init', 'Initializes sample', function (cb) {

    if (options.configPostfix && options.configTemplate) {
      all.updateGlobalConfig(options.configPostfix, options.configTemplate);
    }

    cb();
  })

  gulp.task('deploy', 'Deploys sample code to the board', function (cb) {
    var targetFolder = config.project_folder ? config.project_folder : '.';
    var files = fs.readdirSync('./app');
    var filesLocal = [];
    var filesRemote = [];

    for (var i = 0; i < files.length; i++) {
      filesLocal.push('./app/' + files[i]);
      filesRemote.push(targetFolder + '/' + files[i]);
    }

    all.uploadFilesViaScp(filesLocal, filesRemote, function () {
      console.log("- Installing NPM packages on the device. It might take several minutes.");
      all.sshExecCmd('cd ' + targetFolder + ' && npm install', { verbose: args.verbose }, cb);
    });
  });

  gulp.task('run-internal', false, function (cb) {
    var targetFolder = config.project_folder ? config.project_folder : '.';
    var startFile = config.start_file ? config.start_file : 'app.js';
    var nodeCommand = 'node';

    if (args.debug) {
      nodeCommand += ' --debug-brk=5858';
    }

    var nodejsParam = '';
    if (config.iot_device_connection_string) {
      nodejsParam = ' "' + config.iot_device_connection_string + '"';
    }

    all.sshExecCmd('sudo' + ' ' + nodeCommand + ' ' + targetFolder + '/' + startFile + nodejsParam + ' && exit', { verbose: true }, cb);
  });

  gulp.task('run', 'Runs deployed sample on the board', ['run-internal']);

  gulp.task('default', 'Builds, deploys and runs sample on the board', function (callback) {
    runSequence('deploy', 'run', callback);
  })
}

module.exports = initTasks;
