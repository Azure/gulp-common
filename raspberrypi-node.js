'use strict';

var all = require('./all.js');
var config = require('../../config.json');
var args = require('get-gulp-args')();
var fs = require('fs');

/**
 * Main entry point for all Rapberry Pi Node configuration.
 * @param {object} gulp     - Gulp instance
 * @param {object} options  - Raspberry Pi Node Specific options
 */
function initTasks(gulp, options) {
  var runSequence = require('run-sequence').use(gulp);

  if (typeof all.gulpTaskBI === 'function') {
    all.gulpTaskBI(gulp, 'nodejs', 'RaspberryPi', ((options && options.appName) ? options.appName : 'unknown'));
  }

  gulp.task('install-tools', 'Installs required software on Raspberry Pi', function (cb) {
    all.sshExecCmd('(curl -sL https://deb.nodesource.com/setup_4.x | sudo -E bash -) && sudo apt-get -y install nodejs', config, args.verbose, cb);
  });

  gulp.task('deploy', 'Deploys sample code to the board', function (cb) {
    var targetFolder = config.project_folder ? config.project_folder : '.';
    var files = fs.readdirSync('./app');
    var filesLocal = [];
    var filesRemote = [];
    console.log(files);

    for (var i = 0; i < files.length; i++) {
      filesLocal.push('./app/' + files[i]);
      filesRemote.push(targetFolder + '/' + files[i]);
    }

    all.uploadFilesViaScp(config, filesLocal, filesRemote, function () {
      // [REVIEW] failure is not handled properly
      all.sshExecCmd('cd ' + targetFolder + ' && npm install', config, args.verbose, cb);
    });
  });

  gulp.task('run-internal', false, function (cb) {
    var targetFolder = config.project_folder ? config.project_folder : '.';
    var startFile = config.start_file ? config.start_file : 'app.js';
    var nodeCommand = 'nodejs';
    if (args.debug) {
      nodeCommand += ' --debug-brk=5858';
    }

    all.sshExecCmd('sudo' + ' ' + nodeCommand + ' ' + targetFolder + '/' + startFile + ' && exit', config, true, cb);
  });

  gulp.task('run', 'Runs deployed sample on the board', [ 'run-internal' ]);

  gulp.task('default', 'Builds, deploys and runs sample on the board', function (callback) {
    runSequence('install-tools', 'deploy', 'run', callback);
  })
}

module.exports = initTasks;
