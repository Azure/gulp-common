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
  var workspace = './ble_sample/';

  // stick config into gulp object
  gulp.config = config;

  if (typeof all.gulpTaskBI === 'function') {
    all.gulpTaskBI(gulp, 'nodejs', 'gateway', ((options && options.appName) ? options.appName : 'unknown'));
  }

  var runSequence = require('run-sequence').use(gulp);

  gulp.task('init', 'Initializes sample', function (cb) {

    if (options.configPostfix && options.configTemplate) {
      all.updateGlobalConfig(options.configPostfix, options.configTemplate['ssh-config']);
      saveConfigFile(config.bleConfig, options.configTemplate['ble-config']);
      saveConfigFile(config.azFuncConfig, options.configTemplate['azure-function-config']);
    }

    cb();
  });

  gulp.task('setup-remote', 'Copy script to remote', function (cb) {
    var cpList = [
      'app/.ble_gateway.json',
      'app/sensortagdisco.js',
      'app/testconnect.js',
      'app/deploy.js',
      'app/run.js',
      'app/lib/bleconfig.js',
      'app/lib/bluetoothctl.js',
      'app/lib/interactcli.js',
      'app/lib/util.js'
    ];
    var link = [];
    for (var i = 0; i < cpList.length; i++) {
      link.push(workspace + cpList[i].slice('app/'.length));
    }
    all.uploadFilesViaScp(cpList, link, cb);
  });

  gulp.task('clean-remote', 'clean remote', function (cb) {
    all.sshExecCmd('sudo rm -rf ' + workspace, { verbose: false }, function(err) {
      if (err) {
        cb(err);
      } else {
        cb();
      }
    });
  });

  gulp.task('clean-local', 'clean local', function (cb) {
    try{
      if(all.fileExistsSync(config.bleConfig)) {
        fs.unlinkSync(config.bleConfig);
      }
      if(all.fileExistsSync(config.azFuncConfig)) {
        fs.unlinkSync(config.azFuncConfig);
      }
    }catch(err){
      cb(err);
      return;
    }
    cb();
  });

  gulp.task('clean', 'clean local and remote', ['clean-local', 'clean-remote']);

  gulp.task('devdisco', 'discovery Sensortag device', ['setup-remote'], function (cb) {
    all.sshExecCmd('cd ' + workspace + '; node sensortagdisco.js', { verbose: true }, function (err) {
      if (err) {
        cb(err);
      } else {
        cb();
      }
    });
  });

  gulp.task('testconnect', 'test connectivity of mac address', ['setup-remote'], function (cb) {
    all.sshExecCmd('cd ' + workspace + '; node testconnect.js ' + args['mac'], { verbose: true }, function (err) {
      if (err) {
        cb(err);
      } else {
        cb();
      }
    });
  });

  gulp.task('run', 'run ble_sample on NUC', ['setup-remote', 'upload-config'], function (cb) {
    all.sshExecCmd('cd ' + workspace + '; node run.js', { verbose: true }, function (err) {
      if (err) {
        cb(err);
      } else {
        cb();
      }
    });
  });

  gulp.task('deploy', 'deplo ble_sample on NUC', ['setup-remote', 'upload-config'], function(cb) {
    var force = args['force'] || args['f'];
    var global = args['global'] || args['g'];
    var options = '' + (force ? ' --force' : '') + (global ? ' --global' : '');
    all.sshExecCmd('cd ' + workspace + '; node deploy.js' + options, { verbose: true }, function (err) {
      if (err) {
        cb(err);
      } else {
        cb();
      }
    });
  });

  gulp.task('upload-config', 'upload config.json to NUC', function (cb) {
    // copy file into NUC
    all.uploadFilesViaScp([ getConfigFilepath(config.bleConfig) ], [workspace + 'config.json'], cb);
  });
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

function saveConfigFile(postfix, config) {
  var oldConfig = readGlobalConfig(postfix);
  var newConfig = Object.assign(config, oldConfig);
  fs.writeFileSync(getConfigFilepath(postfix), JSON.stringify(newConfig, null, 2));
}

function getConfigFilepath(postfix) {
  return all.getToolsFolder() + '/config-' + postfix + '.json';
}

function readGlobalConfig(postfix) {
  var filename = getConfigFilepath(postfix);
  if (all.fileExistsSync(filename)) {
    return require(filename);
  }

  return {};
}

module.exports = initTasks;
