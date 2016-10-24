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
  gulp.config = flatten(config);

  if (typeof all.gulpTaskBI === 'function') {
    all.gulpTaskBI(gulp, 'nodejs', 'gateway', ((options && options.appName) ? options.appName : 'unknown'));
  }

  // copy files into profile folder
  gulp.task('init', 'Initializes sample', function(cb) {

    if (options.configPostfix && options.configTemplate) {
      all.updateGlobalConfig(options.configPostfix, options.configTemplate['ssh-config']);
      saveConfigFile(config.bleConfig, options.configTemplate['ble-config']);
      saveConfigFile(config.azFuncConfig, options.configTemplate['azure-function-config']);
    }

    cb();
  });

  // copy inital files to the NUC
  gulp.task('setup-remote', 'Copy script to remote', function(cb) {
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
  gulp.task('devdisco', 'discovery Sensortag device', function(cb) {
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
  gulp.task('testconnect', 'test connectivity of mac address', function(cb) {
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
  gulp.task('run', 'run ble_sample on NUC', ['setup-remote', 'upload-config'], function(cb) {
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

  // copy all needed files into NUC, and generate the ble_gateway.json
  // usage: gulp deploy [options]
  // options:
  //     -g, --global: directly save the file into NUC's /usr/share/azureiotgatewaysdk/sample/ble_gateway/
  //     -f, --force: not update the config base on global config, but always reset the ble_gateway.json to default
  gulp.task('deploy', 'deplo ble_sample on NUC', ['setup-remote', 'upload-config'], function(cb) {
    var force = args['force'] || args['f'];
    var global = args['global'] || args['g'];
    var options = '' + (force ? ' --force' : '') + (global ? ' --global' : '');
    all.sshExecCmd('cd ' + workspace + '; node deploy.js' + options, {
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
  gulp.task('upload-config', 'upload config.json to NUC', function(cb) {
    all.uploadFilesViaScp([getConfigFilepath(config.bleConfig)], [workspace + 'config.json'], cb);
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
    return require(filename);
  }

  return {};
}

function flatten(rawConfig) {
  // path
  var config = {
    bleConfigPath: getConfigFilepath(rawConfig.bleConfig),
    azFuncConfigPath: getConfigFilepath(rawConfig.azFuncConfig)
  };

  // two object
  var bleConfig = readConfig(config.bleConfigPath);
  var azFuncConfig = readConfig(config.azFuncConfigPath);

  // merge
  var mergeConfig = Object.assign(bleConfig, azFuncConfig);
  return Object.assign(mergeConfig, rawConfig);
}

module.exports = initTasks;
