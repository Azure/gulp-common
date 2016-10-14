/*
* Gulp Common - Microsoft Sample Code - Copyright (c) 2016 - Licensed MIT
*/
'use strict';

var args = require('get-gulp-args')();

var all;

/**
 * Main entry point for all Arduino configurations.
 * @param {object} gulp     - Gulp instance
 * @param {object} options  - Arduino specific options
 */
function initTasks(gulp, options) {
  var runSequence = require('run-sequence').use(gulp);
  all = require('./all.js')(options);
  var config = all.getConfig();

  // package:arch:board[:parameters]
  var boardDescriptor = options.board.package + ':' +
    options.board.arch + ":" +
    options.board.board +
    ((options.board.parameters.length > 0) ? (':' + options.board.parameters) : '');

  gulp.task('install-tools-java', false, function (cb) {
    if (process.platform == 'win32') {
      cb();
    } else if (process.platform == 'linux') {
      // install java and a few other things
      all.localExecCmds(['sudo apt-get update',
        'sudo apt-get install -y default-jre xvfb libxtst6'],
        args.verbose, cb);
    } else if (process.platform == 'darwin') {
      // at the moment don't install java for OS X, it's probably there anyway
      cb();
    }
  })

  gulp.task('install-tools-arduino', false, function (cb) {
    if (process.platform == 'win32') {
      all.localRetrieve('https://downloads.arduino.cc/arduino-1.6.11-windows.zip', { folder: 'arduino-1.6.11' }, cb);
    } else if (process.platform == 'linux') {
      all.localRetrieve('https://downloads.arduino.cc/arduino-1.6.11-linux64.tar.xz', { folder: 'arduino-1.6.11' }, function (err) {
        if (err) {
          cb(err);
        } else {
          // install arduino
          all.localExecCmds(['sudo ln -s -f ' + all.getToolsFolder() + '/arduino-1.6.11/arduino /usr/local/bin/',
            'sudo ln -s -f ' + all.getToolsFolder() + '/arduino-1.6.11/arduino-builder /usr/local/bin/',
            'sudo chmod 777 node_modules/gulp-common/arduino-headless.sh'], args.verbose, cb);
        }
      });
    } else if (process.platform == 'darwin') {
      // at the moment we will attempt the same approach as for windows
      if (all.folderExistsSync(all.getToolsFolder() + '/Arduino.app')) {
        console.log('ARDUINO TOOLS ALREADY INSTALLED');
        cb();
      } else {
        all.localRetrieve('https://downloads.arduino.cc/arduino-1.6.11-macosx.zip', { folder: 'arduino-1.6.11' }, cb);
      }
    }
  })

  gulp.task('install-tools-arduino-init-libraries', false, function (cb) {
    // When installing libraries via arduino for the first time, library_index.json doesn't exist
    // apparently this causes operation to fail. So this is a workaround, we will attemp to install
    // nonexisting 'dummy' library to prevent subsequent failure
    all.localExecCmd(getArduinoCommand() + ' --install-library dummy', args.verbose, function () {
      cb();
    });
  });

  gulp.task('install-tools-package', false, function (cb) {
    installPackage(options.board.package, options.board.arch, options.board.packageUrl, cb);
  })

  gulp.task('install-tools-libraries', false, function (cb) {
    installLibraries(options.libraries, cb);
  })

  gulp.task('install-tools', 'Installs Arduino, boards specific and Azure tools', function (callback) {
    runSequence('install-tools-java', 'install-tools-arduino',
      'install-tools-arduino-init-libraries', 'install-tools-package', 'install-tools-libraries', callback);
  });

  gulp.task('build', 'Builds sample code', function (cb) {
    all.writeConfigH();
    all.localExecCmd(getArduinoCommand() + ' --verify --board ' +
      boardDescriptor + ' ' + process.cwd() + '/app/app.ino --verbose-build', args.verbose, cb);
  });

  gulp.task('deploy', 'Deploys binary to the device', function (cb) {
    all.writeConfigH();
    if (!config.device_port.trim()) {
      all.localExecCmd(getArduinoCommand() + ' --upload --board ' + boardDescriptor +
        ' --port ' + config.device_port + ' ' + process.cwd() + '/app/app.ino --verbose-upload', args.verbose, cb);
    } else {
      cb(new Error('Port is not defined in config'));
    }
  });

  // Arduino doesn't really have 'run' as 'deploy' resets the board and runs the sample
  gulp.task('run', 'Runs deployed sample on the board', ['deploy']);

  gulp.task('default', 'Installs tools, builds and deploys sample to the board', function (callback) {
    runSequence('install-tools', 'deploy', callback);
  })
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
    return 'sudo ./node_modules/gulp-common/arduino-headless.sh';
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
  if (all.folderExistsSync(getPackageFolder() + '/' + name + '/hardware/' + arch)) {
    console.log('Package ' + name + ':' + arch + ' was already installed...');
    cb();
  } else {
    // add all known urls, if we remove any, packages will become invisible by arduino
    all.localExecCmds([getArduinoCommand() + ' --pref boardsmanager.additional.urls='
      + 'https://adafruit.github.io/arduino-board-index/package_adafruit_index.json'
      + ',' + 'http://arduino.esp8266.com/stable/package_esp8266com_index.json',
      getArduinoCommand() + ' --install-boards ' + name + ':' + arch],
      args.verbose, cb);
  }
}

module.exports = initTasks;
