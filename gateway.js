/*
 * Gulp Common - Microsoft Sample Code - Copyright (c) 2016 - Licensed MIT
 */
'use strict';

var fs = require('fs');
var args = require('get-gulp-args')();

var all;

function initTasks(gulp, options) {
  gulp = require('gulp-help')(gulp, {
    hideDepsMessage: true
  });

  all = require('./all.js')(options);

  var config = flatten(all.getConfig());
  var workspace = './ble_sample/';
  var nodeCmd = getNodeCmd({
    'debug': args['debug']
  });

  // stick config into gulp object
  gulp.config = config;

  if (typeof all.gulpTaskBI === 'function') {
    all.gulpTaskBI(gulp, 'nodejs', 'gateway', ((options && options.appName) ? options.appName : 'unknown'));
  }

  gulp.task('init', 'Initialize config files in user\'s profile folder.', function(cb) {

    if (options.configPostfix && options.configTemplate) {
      all.updateGlobalConfig(options.configPostfix, options.configTemplate['ssh-config']);
      saveConfigFile(config.sensortagConfig, options.configTemplate['sensortag-config']);
      saveConfigFile(config.azureConfig, options.configTemplate['azure-config']);
    }

    cb();
  });

  gulp.task('install-tools', 'Install necessary tools on the gateway.', function(cb) {
    var fileList = [
      '.ble_gateway.json',
      'discover-sensortag.js',
      'test-connectivity.js',
      'deploy.js',
      'run.js',
      'lib/bleconfig.js',
      'lib/bluetoothctl.js',
      'lib/interactcli.js',
      'lib/util.js'
    ];
    var appfolder = '../Tools/';
    var cpList = [];
    var link = [];
    for (var i = 0; i < fileList.length; i++) {
      cpList.push(appfolder + fileList[i]);
      link.push(workspace + fileList[i]);
    }
    all.uploadFilesViaScp(cpList, link, cb);
  });

  gulp.task('clean-remote', false, function(cb) {
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

  gulp.task('clean-local', false, function(cb) {
    all.deleteFolderRecursivelySync(all.getToolsFolder());
    cb();
  });

  gulp.task('clean', 'Remove config files in user\'s profile folder and remove tools on the gateway.', ['clean-remote', 'clean-local']);

  gulp.task('discover-sensortag', 'Discover TI SensorTag. Run after "install-tools".', function(cb) {
    all.sshExecCmd('cd ' + workspace + '; ' + nodeCmd + ' discover-sensortag.js', {
      verbose: true
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        cb();
      }
    });
  });

  // usage: gulp test-connectivity --mac <mac address>
  gulp.task('test-connectivity', 'Test connectivity of the SensorTag. Run after "install-tools".', function(cb) {
    if (!args['mac']) {
      cb('usage: gulp test-connectivity --mac <mac address>');
      return;
    }

    all.sshExecCmd('cd ' + workspace + '; ' + nodeCmd + ' test-connectivity.js ' + args['mac'], {
      verbose: true
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        cb();
      }
    });
  }, {
    options: {
      'mac <mac address>': '[Required] Specific your SensorTag\'s mac address.'
    }
  });

  gulp.task('run', 'Run the BLE sample application in the Gateway SDK.', ['install-tools', 'upload-config'], function(cb) {
    all.sshExecCmd('cd ' + workspace + '; ' + nodeCmd + ' run.js', {
      verbose: true
    }, function(err) {
      if (err) {
        cb(err);
      } else {
        cb();
      }
    });
  });

  // Copy config file to the gateway machine
  gulp.task('upload-config', false, function(cb) {
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

function getNodeCmd(options) {
  options = Object.assign({
    'debug': false
  }, options);
  var cmd = 'node';
  if (options.debug) {
    cmd += ' --debug-brk=5858';
  }
  return cmd;
}

module.exports = initTasks;
