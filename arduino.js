'use strict';

var all = require('./all.js');
// [REVIEW] this can be simplified now
var config = (all.fileExistsSync('../config.json')) ? require('../config.json') : require('../../config.json');
var fs = require('fs');
var args = require('get-gulp-args')();

/**
 * Main entry point for all Arduino configurations.
 * @param {object} gulp     - Gulp instance
 * @param {object} options  - Arduino specific options
 */
function initTasks(gulp, options) {

  var runSequence = require('run-sequence').use(gulp);

  // package:arch:board[:parameters]
  var board_descriptor = options.board.package + ':' + 
                         options.board.arch + ":" + 
                         options.board.board + 
                         ((options.board.parameters.length > 0) ? (':' + options.board.parameters) : '');

  // add Azure IoT Hub Library by default
  options.libraries.push('AzureIoTHub');

  gulp.task('install-tools-java', false, function (cb) {
    if (process.platform == 'win32') {
      cb();
    } else if (process.platform == 'linux') {
      // install java and a few other things
      all.localExecCmds([ 'sudo apt-get update',
                          'sudo apt-get install -y default-jre xvfb libxtst6'],
                        args.verbose, cb);
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
      all.localExecCmds([ 'sudo apt-get update',
                          'sudo apt-get install -y wget xz-utils',
                          'sudo wget -q -O '  + all.getToolsFolder() + '/arduino.tar.xz' + ' https://downloads.arduino.cc/arduino-1.6.11-linux64.tar.xz',
                          'sudo tar xJ -C /opt ' + all.getToolsFolder() + '/arduino.tar.xz' ,
                          'ln -s /opt/arduino-1.6.11/arduino /usr/local/bin/',
                          'ln -s /opt/arduino-1.6.11/arduino-builder /usr/local/bin/',
                          'chmod 777 gulp-common/arduino-headless.sh'], args.verbose, cb);
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
          all.localExecCmd('open --wait-apps ' + all.getToolsFolder() + '/arduino.zip', args.verbose, cb);
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
    all.localExecCmd(getArduinoCommand() + ' --install-library dummy', args.verbose, function (result) {
      cb();
    });
  });

  gulp.task('install-tools-package', false, function(cb) {    
    installPackage(options.board.package, options.board.arch, options.board.packageUrl, cb);
  })

  gulp.task('install-tools-libraries', false, function(cb) {    
    installLibraries(options.libraries, cb);
  })

  gulp.task('install-tools', 'Installs Arduino, boards specific and Azure tools', function (callback) {
    runSequence('install-tools-java', 'install-tools-arduino', 'install-tools-arduino-init-libraries',  'install-tools-package', 'install-tools-libraries', callback);
  });

  gulp.task('build', 'Builds sample code', function (cb) {
    updateConfigHeaderFileSync();
    all.localExecCmd(getArduinoCommand() + ' --verify --board ' + board_descriptor + ' ' + process.cwd() + '/app/app.ino --verbose-build', args.verbose, cb);
  });

  gulp.task('deploy', 'Deploys binary to the device', function (cb) {
    updateConfigHeaderFileSync();
    if (!!config.device_port.trim()) {
      all.localExecCmd(getArduinoCommand() + ' --upload --board ' + board_descriptor + ' --port ' + config.device_port + ' ' + process.cwd() + '/app/app.ino --verbose-upload', args.verbose, cb);
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

/**
 * Get Arduino command prefix for underlying operating system.
 * @returns {string}
 */
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

/**
 * Get Arduino library folder for underlying operating system.
 * @returns {string}
 */
function getLibraryFolder() {
  if (process.platform === 'win32') {
      return process.env['USERPROFILE'] + '/Documents/Arduino/libraries';
  } else if (process.platform === 'linux') {
      return process.env['HOME'] + '/Arduino/libraries';
  } else if (process.platform === 'darwin') {
      return process.env['HOME'] + '/Documents/Arduino/libraries';
  }
}

/**
 * Get Arduino 'arduino15' folder for underlying operating system.
 * @returns {string}
 */
function getArduino15Folder() {
  if (process.platform === 'win32') {
      return process.env['USERPROFILE'] + '/AppData/Local/Arduino15';
  } else if (process.platform === 'linux') {
      return process.env['HOME'] + '/.arduino15';
  } else if (process.platform === 'darwin') {
      return process.env['HOME'] + '/Library/Arduino15';
  }
}

/**
 * Get Arduino package folder for underlying operating system.
 * @returns {string}
 */
function getPackageFolder() {
  return getArduino15Folder() + '/packages';
}

/**
 * Install library using Arduino toolchain.
 * @param {string} name   - library name
 * @param {callback} cb   - callback
 */
function installLibrary(name, cb) {
  if (all.folderExistsSync(getLibraryFolder() + '/' + name)) {
    console.log('Library ' + name + ' was already installed...');
    cb();
  } else {

    all.localExecCmd(getArduinoCommand() + ' --install-library ' + name, args.verbose, function (err) {
      if (err) return cb(err);
      cb();
    });
  }
}

/**
 * Installs library using 'git clone'
 * @param {string} name   - library name
 * @param {string} url    - Git URL
 * @param {callback} cb   - callback
 */
function cloneLibrary(name, url, cb) {
  all.localClone(url, getLibraryFolder() + '/' + name, args.verbose, cb);
}

/**
 * Installs library (using Arduino toolchain or 'git clone')
 * @param {string} lib    - library name or Git URL
 * @param {callback} cb   - callback
 */
function installOrCloneLibrary(lib, cb) {
  var repo = lib.split('.git');

  if (repo.length > 1) {
    repo = repo[0].split('/');
    cloneLibrary(repo[repo.length - 1], lib, cb);
  } else {
    installLibrary(lib, cb);
  }
}

/**
 * Installs list of libraries (using Arduino toolchain or 'git clone')
 * @param {string[]} libs - list library names or Git URLs
 * @param {callback} cb   - callback
 */
function installLibraries(libs, cb) {
  // check if there are any libraries to install
  if (libs.length == 0) {
    cb();
    return;
  }

  // install first library from the list
  var lib = libs.splice(0, 1)[0];
  
  installOrCloneLibrary(lib, function (e) {

    // stop installing libraries if error occured
    if (e) {
      cb(e);
      return;
    }

    // continue with remaining commands
    installLibraries(libs, cb);
  })
}

/**
 * Installs package
 * @param {string} name   - package name
 * @param {string} arch   - architecture
 * @param {string} addUrl - additional package URL to be added to Arduino preferences
 * @param {callback} cb   - callback
 */
function installPackage(name, arch, addUrl, cb) {

  // make sure package index exists, if it doesn't exist, try to clean up directory to make sure no uncomplete installation exists
  if (!all.fileExistsSync(getArduino15Folder() + '/' + addUrl.split('/').slice(-1)[0])) {
    all.deleteFolderRecursivelySync(getPackageFolder() + '/' + name);
  }

  // now check if appropriate package folder exists
  if (all.folderExistsSync(getPackageFolder() + '/' + name + '/hardware/' + arch )) {
    console.log('Package ' + name + ':' + arch + ' was already installed...');
    cb();
  } else {
    // add all known urls, if we remove any, packages will become invisible by arduino
    all.localExecCmds( [ getArduinoCommand() + ' --pref boardsmanager.additional.urls=' + 'https://adafruit.github.io/arduino-board-index/package_adafruit_index.json' + ',' + 'http://arduino.esp8266.com/stable/package_esp8266com_index.json',
                         getArduinoCommand() + ' --install-boards ' + name + ':' + arch ],
                      args.verbose, cb);
  }
}

module.exports = initTasks;
