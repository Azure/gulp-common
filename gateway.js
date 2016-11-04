/*
 * Gulp Common - Microsoft Sample Code - Copyright (c) 2016 - Licensed MIT
 */
'use strict';

var fs = require('fs');
var args = require('get-gulp-args')();

var all;

function initTasks(gulp, options) {
  all = require('./all.js')(options);

  var config = flatten(all.getConfig());
  var workspace = './ble_sample/';

  // stick config into gulp object
  gulp.config = config;

  if (typeof all.gulpTaskBI === 'function') {
    all.gulpTaskBI(gulp, 'nodejs', 'gateway', ((options && options.appName) ? options.appName : 'unknown'));
  }

  // copy files into profile folder
  gulp.task('init', 'Initialize config files in the user’s profile folder', function(cb) {

    if (options.configPostfix && options.configTemplate) {
      all.updateGlobalConfig(options.configPostfix, options.configTemplate['ssh-config']);
      saveConfigFile(config.sensortagConfig, options.configTemplate['sensortag-config']);
      saveConfigFile(config.azureConfig, options.configTemplate['azure-config']);
    }

    cb();
  });

  // copy inital files to the NUC
  gulp.task('install-tools', 'Install necessary tools into the gateway', function(cb) {
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

  gulp.task('clean-remote', 'clean remote', function(cb) {
    all.sshExecCmd('sudo rm -rf ' + workspace, {
      verbose: false
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        cb();
      }
    });
  });

  gulp.task('clean-local', 'clean local', function(cb) {
    all.deleteFolderRecursivelySync(all.getToolsFolder());
    cb();
  });

  // remove the file in the local profile folder and remote NUC
  gulp.task('clean', 'clean local and remote', ['clean-remote', 'clean-local']);

  // discover sensortag device
  gulp.task('discover-sensortag', 'Discover sensortag devices, need run "install-tools" first', function(cb) {
    all.sshExecCmd('cd ' + workspace + '; node sensortagdisco.js', {
      verbose: true
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        cb();
      }
    });
  });

  // test sensortag's connectivity
  // usage: gulp testconnect --mac <mac address>
  gulp.task('test-connectivity', 'Test connectivity of the SensorTag, need run "install-tools" first', function(cb) {
    all.sshExecCmd('cd ' + workspace + '; node testconnect.js ' + args['mac'], {
      verbose: true
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        cb();
      }
    });
  });

  // run BLE sample on NUC
  gulp.task('run', 'Run the BLE sample application in the Gateway SDK', ['install-tools', 'upload-config'], function(cb) {
    all.sshExecCmd('cd ' + workspace + '; node run.js', {
      verbose: true
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        cb();
      }
    });
  });

  // copy config.json into NUC
  gulp.task('upload-config', 'Copy config file to the gateway machine', function(cb) {
    all.uploadFilesViaScp([config.sensortagConfigPath], [workspace + 'config.json'], cb);
  });
}

function saveConfigFile(postfix, config) {
  var filename = getConfigFilepath(postfix);
  var oldConfig = readConfig(filename);
  var newConfig = Object.assign(config, oldConfig);
  fs.writeFileSync(filename, JSON.stringify(newConfig, null, 2));
}

function getConfigFilepath(postfix) {
  return all.getToolsFolder() + '/config-' + postfix + '.json';
}

function readConfig(filename) {
  if (all.fileExistsSync(filename)) {
    return JSON.parse(fs.readFileSync(filename, 'utf8'));
  }

  return {};
}

function flatten(rawConfig) {
  // path
  var config = {
    sensortagConfigPath: getConfigFilepath(rawConfig.sensortagConfig),
    azureConfigPath: getConfigFilepath(rawConfig.azureConfig)
  };

  // two object
  var sensortagConfig = readConfig(config.sensortagConfigPath);
  var azureConfig = readConfig(config.azureConfigPath);

  // merge
  return Object.assign(config, sensortagConfig, azureConfig, rawConfig);
}

module.exports = initTasks;
