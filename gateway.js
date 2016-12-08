/*
 * Gulp Common - Microsoft Sample Code - Copyright (c) 2016 - Licensed MIT
 */
'use strict';

var fs = require('fs');
var args = require('get-gulp-args')();

var all;
var runSequence;

function initTasks(gulp, options) {
  gulp = require('gulp-help')(gulp, {
    hideDepsMessage: true
  });

  runSequence = require('run-sequence').use(gulp);

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
      var sensortagConfig = options.configTemplate['sensortag-config'];
      if (config['has_sensortag']) {
        sensortagConfig['devices'][0]['BLE_mac_address'] = '[SensorTag mac address]';
      }

      saveConfigFile(options.configPostfix, options.configTemplate['ssh-config']);
      saveConfigFile(config['sensortag_config_postfix'], sensortagConfig);
      saveConfigFile(config['azure_config_postfix'], options.configTemplate['azure-config']);
    }

    cb();
  });

  gulp.task('install-tools', 'Install necessary tools on the gateway.', function(cb) {
    var fileList = [
      '.ble_gateway.json',
      '.simulate_device_cloud_upload.json',
      'discover-sensortag.js',
      'test-connectivity.js',
      'deploy.js',
      'run-ble-sample.js',
      'run-simudev-sample.js',
      'lib/ble-config.js',
      'lib/gateway-config.js',
      'lib/simudev-config.js',
      'lib/bluetoothctl.js',
      'lib/interactcli.js',
      'lib/util.js',
      'lib/test-connectivity.js'
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
    all.sshExecCmd('rm -rf ' + workspace, {
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
      'mac <mac address>': '[REQUIRED] Specific your SensorTag\'s mac address.'
    }
  });

  gulp.task('run', 'Run the BLE sample application in the Gateway SDK.', ['run-internal']);

  gulp.task('deploy', false, function(cb) {
    runSequence('install-tools', 'upload-config', cb);
  });

  gulp.task('run-internal', false, ['deploy'], function(cb) {
    var script = config.has_sensortag ? 'run-ble-sample.js' : 'run-simudev-sample.js';
    all.sshExecCmd('cd ' + workspace + '; ' + nodeCmd + ' ' + script, {
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
  console.log('Create / update global config file at ' + filename);
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
  // read local config
  rawConfig = Object.assign(readConfig('../config.json'), rawConfig);

  // path
  var config = {
    sensortagConfigPath: getConfigFilepath(rawConfig['sensortag_config_postfix']),
    azureConfigPath: getConfigFilepath(rawConfig['azure_config_postfix'])
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
