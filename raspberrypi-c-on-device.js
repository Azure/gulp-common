﻿/*
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

  gulp.task('rpi-clone-azure-sdk', false, function(cb) {
    all.sshExecCmd("git clone https://github.com/Azure/azure-iot-sdks.git", { verbose: args.verbose }, cb);
  })

  gulp.task('rpi-build-azure-iot-sdk', false, function(cb) {
    all.sshExecCmd("cd ~/azure-iot-sdks && " + 
                   "sudo c/build_all/linux/setup.sh && " +
                   "sudo c/build_all/linux/build.sh --skip-unittests", { verbose: args.verbose }, cb);
  })

  gulp.task('install-tools', 'Installs required software on Raspberry Pi', function(cb) {
    runSequence('rpi-clone-azure-sdk', 'rpi-build-azure-iot-sdk', cb);
  });

  gulp.task('deploy', false, ['check-raspbian'], function (cb) {
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

    all.uploadFilesViaScp(src, dst, cb);
  });

  gulp.task('build', 'Builds sample code', ['deploy'], function (cb) {
    let cmds = [];
    let objs = '';

    if (options.app) {
      for (let i = 0; i < options.app.length; i++) {
        let f = targetFolder + '/' + options.app[i];

        if (f.endsWith('.c') || f.endsWith('.cpp')) {
          // in first step just compile sample file
          var cmdCompile = 'arm-linux-gnueabihf-gcc';

          if (f.endsWith('.c')) {
            cmdCompile += ' -std=c99';
          }
          
          let o = f.substring(0, f.lastIndexOf('.')) + '.o';

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

          cmdCompile += ' -o ' + o +
            ' -c ' + f;

          cmds.push(cmdCompile);
          objs += ' ' + o;
        }
      }
    }


    // second step -- link with prebuild libraries
    var cmdLink = 'arm-linux-gnueabihf-gcc ' +
      objs +
      ' -o ' + targetFolder + '/' + startFile +
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

    cmds.push(cmdLink);

    //all.sshExecCmd(cmds.join(' && '), { verbose: args.verbose }, cb);
    all.sshExecCmds(cmds, { verbose: args.verbose }, cb);
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
