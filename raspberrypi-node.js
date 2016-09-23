'use strict';

var all = require('./all.js');
var config = (all.fileExistsSync('../config.json')) ? require('../config.json') : require('../../config.json');
var simssh = require('simple-ssh');
var Q = require('q');
var args = require('get-gulp-args')();

function initTasks(gulp) {
  var runSequence = require('run-sequence').use(gulp);

  if (typeof all.gulpTaskBI === 'function') {
    all.gulpTaskBI(gulp, 'nodejs', 'RaspberryPi', 'az-blink');
  }

  gulp.task('install-tools', 'Installs required software on Raspberry Pi', function () {
    var deferred = Q.defer();
    var input = 'Y\r';
    var ssh = new simssh({
      host: config.device_host_name_or_ip_address,
      user: config.device_user_name,
      pass: config.device_password
    });

    ssh.on('error', function (e) {
      // when we pass error via deferred.reject, stack will be displayed
      // as it is just string, we can just replace it with message
      e.stack = "ERROR: " + e.message;
      deferred.reject(e);
    });

    ssh.exec('sudo apt-get update && sudo apt-get install npm', {
      pty: true,
      in: input,
      out: function (o) { if (args.verbose) console.log(o); },
      exit: function() { deferred.resolve(); }
    }).start();
    
    return deferred.promise;
  });

  gulp.task('deploy', 'Deploys compiled sample to the board', function(){
    var deferred = Q.defer();

    var targetFolder = config.project_folder ? config.project_folder : '.';
    all.uploadFilesViaScp(config, ['az-blink.js', 'device-package.json', 'config.json'], [targetFolder + '/az-blink.js', targetFolder + '/package.json', targetFolder + '/config.json'], function(){
      console.log("- Installing npm packages on device");
      
      var ssh = new simssh({
        host: config.device_host_name_or_ip_address,
        user: config.device_user_name,
        pass: config.device_password
      });

      ssh.on('error', function (e) {
        // when we pass error via deferred.reject, stack will be displayed
        // as it is just string, we can just replace it with message
        e.stack = "ERROR: " + e.message;
        deferred.reject(e);
      });

      ssh.exec('cd ' + targetFolder + ' && npm install', {
        pty: true,
        out: function (o) { if (args.verbose) console.log(o); },
        exit: function() { deferred.resolve(); }
      }).start();
    });

    return deferred.promise;
  });


  gulp.task('run', 'Runs deployed sample on the board', function () {
    var deferred = Q.defer();

    var ssh = new simssh({
      host: config.device_host_name_or_ip_address,
      user: config.device_user_name,
      pass: config.device_password
    });

    ssh.on('error', function (e) {
      // when we pass error via deferred.reject, stack will be displayed
      // as it is just string, we can just replace it with message
      e.stack = "ERROR: " + e.message;
      deferred.reject(e);
    });

    var targetFolder = config.project_folder ? config.project_folder : '.';
    var startFile = config.start_file ? config.start_file : 'az-blink.js';
    ssh.exec('sudo nodejs ' + targetFolder + '/' + startFile, {
      pty: true,
      out: function (o) { console.log(o); }, // Always log to console when running.
      exit: function() { deferred.resolve(); }
    }).start();

    return deferred.promise;
  });

  gulp.task('default', 'Builds, deploys and runs sample on the board', function(callback) {
    runSequence('install-tools', 'deploy', 'run', callback);
  })
}

module.exports.initTasks = initTasks;