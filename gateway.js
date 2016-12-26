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
  var workspace = './gateway_sample/';
  var nodeCmd = getNodeCmd({
    'debug': args['debug']
  });

  if (config.has_sensortag) {
    config.run = config.run || 'run-ble-sample.js';
  } else {
    config.run = config.run || 'run-simudev-sample.js';
  }

  // stick config into gulp object
  gulp.config = config;

  if (typeof all.gulpTaskBI === 'function') {
    var sample = config.has_sensortag ? 'BLE' : 'simulated';
    all.gulpTaskBI(gulp, 'c', 'gateway-' + sample, ((options && options.appName) ? options.appName : 'unknown'));
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
    var appfolder = '../Tools';
    transferFolderViaScp(appfolder, workspace, cb);
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
      runSequence('help', cb);
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

  gulp.task('compile', 'upload files to your Intel NUC and compile it', function(cb) {
    var src = config.workspace;
    if (!src || !fs.existsSync(src)) {
      cb(src + ' not found');
      return;
    }
    var dist = workspace + config.deploy_path;
    transferFolderViaScp(src, dist, function() {
      // run the build.sh
      all.sshExecCmd('cd ' + dist + '; chmod 777 build.sh; sed -i -e "s/\r$\/\/" build.sh; ./build.sh', {
        verbose: true
      }, function(err) {
        if (err) {
          cb(err);
        } else {
          cb();
        }
      });
    });

  });

  gulp.task('run', 'Run the gateway sample application in the Gateway SDK.', ['run-internal']);

  gulp.task('deploy', false, function(cb) {
    runSequence('install-tools', 'upload-config', cb);
  });

  gulp.task('run-internal', false, ['deploy'], function(cb) {
    var timeout = args['timeout'] || 40000;
    var script = config.run;
    var gatewayJson = args['config'] ? 'config.json' : '';
    all.sshExecCmd('cd ' + workspace + '; ' + nodeCmd + ' ' + script + ' ' + timeout + ' ' + gatewayJson, {
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
    all.uploadFilesViaScp([args['config'] || config.sensortagConfigPath], [workspace + 'config.json'], cb);
  });

  gulp.task('list-modules', false, function(cb) {
    var feeds = config.module_feeds;
    feeds = distinct(feeds);
    for (var i = 0; i < feeds.length; i++) {
      findRemoteFiles(feeds[i], 'so', (err) => {
        console.error(err.message || err);
      });
    }
    cb();
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

function transferFolderViaScp(src, dist, cb) {
  var fileList = getAllFilesRecursively(src);
  var distList = [];
  for (var i = 0; i < fileList.length; i++) {
    var filename = dist + fileList[i].slice(src.length);
    distList.push(filename);
  }
  all.uploadFilesViaScp(fileList, distList, cb);
}

// get all files' relative path in a folder recursively, except the '.' and '..'
function getAllFilesRecursively(folder) {
  var list = [];
  if (!folder || !fs.existsSync(folder)) {
    return list;
  }

  var files = fs.readdirSync(folder);
  for (var i = 0; i < files.length; i++) {
    var filename = folder + '/' + files[i];
    var state = fs.lstatSync(filename);
    if (state.isFile()) { /* file */
      list.push(filename);
    } else if (state.isDirectory()) { /* dir */
      list = list.concat(getAllFilesRecursively(filename));
    }
  }
  return list;
}

function findRemoteFiles(folder, extension, cb) {
  all.sshExecCmd('find ' + folder + ' | grep ".' + extension + '$"', {
    verbose: true
  }, function(err) {
    if (err) {
      cb(err);
    }
  });
}

// distinct an array, if one contains anther, remove the smaller scope one
function distinct(array) {
  var result = [];
  if (!array) {
    return result;
  }
  array = array.sort();

  for (var i = 0; i < array.length; i++) {
    var insert = array[i];
    var abandon = false;
    for (var j = result.length - 1; j >= 0; j--) {
      if(insert.indexOf(result[j]) === 0) {
        abandon = true;
        break;
      }
    }
    if(!abandon) {
      result.push(insert);
    }
  }
  // todo
  return result;
}

module.exports = initTasks;
