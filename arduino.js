'use strict';

var all = require('./all.js');
var config = (all.fileExistsSync('../config.json')) ? require('../config.json') : require('../../config.json');
var fs = require('fs');
var args = require('get-gulp-args')();

// XXX - this function shall be replaced
function azhRunLocalCmd(cmd, verbose, cb) {
  try {
    var ret = require('child_process').execSync(cmd);
    if (verbose) console.log(String(ret));
    if (cb) cb();
  } catch (e) {
    e.stack = "ERROR: " + e;
    if (cb) cb(e);
  }
}

function initTasks(gulp, options) {

  var runSequence = require('run-sequence').use(gulp);

  // package:arch:board[:parameters]
  var board_descriptor = options.board.package + ':' + 
                         options.board.arch + ":" + 
                         options.board.board + 
                         ((options.board.parameters.length > 0) ? (':' + options.board.parameters) : '');

  gulp.task('install-tools-java', false, function (cb) {
    if (process.platform == 'win32') {
      cb();
    } else if (process.platform == 'linux') {
      // install java and a few other things
      azhRunLocalCmd('sudo apt-get update && sudo apt-get install -y default-jre xvfb libxtst6', args.verbose, cb);
    } else if (process.platform == 'darwin') {
      // at the moment don't install java for OS X, it's probably there anyway
      cb();
    }
  })

  gulp.task('install-tools-arduino', false, function(cb) {
    if (process.platform == 'win32') {
      if (all.folderExistsSync(all.getToolsFolder() + '/arduino-1.6.11')) {
        console.log('ARDUINO TOOLS ALREADY INSTALLED');
        cb();
      } else {
        fs.mkdirSync(all.getToolsFolder());
        all.downloadAndUnzip('https://downloads.arduino.cc/arduino-1.6.11-windows.zip', all.getToolsFolder() + '/arduino.zip', all.getToolsFolder(), function() {
          console.log("ARDUINO INSTALLATION SUCCESSFUL IN : " + all.getToolsFolder());
          cb();
        }, function(err) {
          console.log("ARDUINO INSTALLATION FAILED" + err);
          cb(err);
        });
      }
    } else if (process.platform == 'linux') {
      // install arduino
      azhRunLocalCmd('sudo apt-get update && sudo apt-get install -y wget xz-utils; sudo wget -q -O- https://downloads.arduino.cc/arduino-1.6.11-linux64.tar.xz | sudo tar xJ -C /opt; ln -s /opt/arduino-1.6.11/arduino /usr/local/bin/; ln -s /opt/arduino-1.6.11/arduino-builder /usr/local/bin/; chmod 777 gulp-common/arduino-headless.sh', args.verbose, cb);
    } else if (process.platform == 'darwin') {
      // at the moment we will attempt the same approach as for windows
      if (all.folderExistsSync(all.getToolsFolder() + '/Arduino.app')) {
        console.log('ARDUINO TOOLS ALREADY INSTALLED');
        cb();
      } else {
        if (!all.folderExistsSync(all.getToolsFolder())) {
          fs.mkdirSync(all.getToolsFolder());
        }

        all.download('https://downloads.arduino.cc/arduino-1.6.11-macosx.zip', all.getToolsFolder() + '/arduino.zip', function() {
          azhRunLocalCmd('open --wait-apps ' + all.getToolsFolder() + '/arduino.zip', args.verbose, cb);
        }, function(err) {
          console.log("ARDUINO INSTALLATION FAILED" + err);
          cb(err);
        });
      }
    }
  })

  gulp.task('install-tools-arduino-init-libraries', false, function(cb) {
    // When installing libraries via arduino for the first time, library_index.json doesn't exist
    // apparently this causes operation to fail. So this is a workaround, we will attemp to install
    // nonexisting 'dummy' library to prevent subsequent failure
    all.runLocalCmd(getArduinoCommand() + ' --install-library dummy', args.verbose, function (result) {
      cb();
    });
  });


  gulp.task('install-tools-azure', false, function(cb) {
    installLibrary('AzureIoTHub', cb);
  });

  gulp.task('install-tools', 'Installs Arduino, boards specific and Azure tools', function (callback) {
    runSequence('install-tools-java', 'install-tools-arduino', 'install-tools-arduino-init-libraries', 'install-tools-board-specific', 'install-tools-azure', callback);
  });

  gulp.task('build', 'Builds sample code', function (cb) {
    updateConfigHeaderFileSync();
    all.runLocalCmd(getArduinoCommand() + ' --verify --board ' + board_descriptor + ' ' + process.cwd() + '/app/app.ino --verbose-build', args.verbose, cb);
  });

  gulp.task('deploy', 'Deploys binary to the device', function (cb) {
    updateConfigHeaderFileSync();
    if (!!config.device_port.trim()) {
      all.runLocalCmd(getArduinoCommand() + ' --upload --board ' + board_descriptor + ' --port ' + config.device_port + ' ' + process.cwd() + '/app/app.ino --verbose-upload', args.verbose, cb);
    } else {
      cb(new Error('Port is not defined in config.json file'));
    }
  });

  gulp.task('default', 'Installs tools, builds and deploys sample to the board', function(callback) {
    runSequence('install-tools', 'deploy', callback);
  })

  function updateConfigHeaderFileSync() {
    /*  String containing Hostname, Device Id & Device Key in the format:                       */
    /*  "HostName=<host_name>;DeviceId=<device_id>;SharedAccessKey=<device_key>"                */
    /*  "HostName=<host_name>;DeviceId=<device_id>;SharedAccessSignature=<device_sas_token>"    */
    var connectionString = 'HostName=' + config.iot_hub_host_name + ';DeviceId=' + config.iot_hub_device_id + ';SharedAccessKey=' + config.iot_hub_device_key;
    var headerContent = 'static const char* connectionString = "' + connectionString + '";\r\n' +
                        'static const char* ssid = "' + config.wifi_ssid + '";\r\n' +
                        'static const char* pass = "' + config.wifi_password + '";\r\n';

    fs.writeFileSync('./app/config.h', headerContent);
  }
}

function getArduinoCommand() {
  if (process.platform === 'win32') {
    // we don't have arduino setup for windows yet, so in current version
    // i assume that that it's available in the path
    return all.getToolsFolder() + '/arduino-1.6.11/arduino_debug.exe';
  } else if (process.platform === 'linux') {
    return 'sudo ./gulp-common/arduino-headless.sh';
  } else if (process.platform === 'darwin') {
    return 'open ' + all.getToolsFolder() + '/Arduino.app --wait-apps --args';
  }
}

function getLibraryFolder() {
  if (process.platform === 'win32') {
      return process.env['USERPROFILE'] + '/Documents/Arduino/libraries';
  } else if (process.platform === 'linux') {
      return process.env['HOME'] + '/Arduino/libraries';
  } else if (process.platform === 'darwin') {
      return process.env['HOME'] + '/Documents/Arduino/libraries';
  }
}

function getArduino15Folder() {
  if (process.platform === 'win32') {
      return process.env['USERPROFILE'] + '/AppData/Local/Arduino15';
  } else if (process.platform === 'linux') {
      return process.env['HOME'] + '/.arduino15';
  } else if (process.platform === 'darwin') {
      return process.env['HOME'] + '/Library/Arduino15';
  }
}

function getPackageFolder() {
  return getArduino15Folder() + '/packages';
}

function installLibrary(name, cb) {
  if (all.folderExistsSync(getLibraryFolder() + '/' + name)) {
    console.log('Library ' + name + ' was already installed...');
    cb();
  } else {

    all.runLocalCmd(getArduinoCommand() + ' --install-library ' + name, args.verbose, function (err) {
      if (err) return cb(err);
      cb();
    });
  }
}

function cloneLibrary(name, url, cb) {
  if (all.folderExistsSync(getLibraryFolder() + '/' + name)) {
    console.log('Library ' + name + ' was already installed...');
    cb();
  } else {
    all.runLocalCmd('git clone ' + url + ' ' + getLibraryFolder() + '/' + name, args.verbose, function (err) {
      if (err) return cb(err);
      cb();
    });
  }
}

function installPackage(name, subname, addUrl, cb) {

  // make sure package index exists, if it doesn't exist, try to clean up directory to make sure no uncomplete installation exists
  if (!all.fileExistsSync(getArduino15Folder() + '/' + addUrl.split('/').slice(-1)[0])) {
    all.deleteFolderRecursivelySync(getPackageFolder() + '/' + name);
  }

  // now check if appropriate package folder exists
  if (all.folderExistsSync(getPackageFolder() + '/' + name + '/hardware/' + subname )) {
    console.log('Package ' + name + ':' + subname + ' was already installed...');
    cb();
  } else {
    // add all known urls, if we remove any, packages will become invisible by arduino
    all.runLocalCmd(getArduinoCommand() + ' --pref boardsmanager.additional.urls=' + 'https://adafruit.github.io/arduino-board-index/package_adafruit_index.json' + ',' + 'http://arduino.esp8266.com/stable/package_esp8266com_index.json', args.verbose, function (err) {
      if (err) return cb(err);
      all.runLocalCmd(getArduinoCommand() + ' --install-boards ' + name + ':' + subname, args.verbose, function (err) {
        if (err) return cb(err);
        cb();
      });
    });
  }
}

module.exports.initTasks = initTasks;
module.exports.getArduinoCommand = getArduinoCommand;
module.exports.getLibraryFolder = getLibraryFolder;
module.exports.getPackageFolder = getPackageFolder;
module.exports.installLibrary = installLibrary;
module.exports.cloneLibrary = cloneLibrary;
module.exports.installPackage = installPackage;
