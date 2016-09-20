var all = require('./all.js');
var config = (all.fileExistsSync('../config.json')) ? require('../config.json') : require('../../config.json');
var board = (all.fileExistsSync('../board.json')) ? require('../board.json') : require('../../board.json');
var fs = require('fs');
var args = require('get-gulp-args')();

function initTasks(gulp) {
  var runSequence = require('run-sequence').use(gulp);
  
  gulp.task('install-tools-java', false, function (cb) {
    if (process.platform == 'win32') {
      cb();
    } else if (process.platform == 'linux') {
      // install java and a few other things
      all.azhRunLocalCmd('sudo apt-get update && sudo apt-get install -y default-jre xvfb libxtst6', args.verbose, cb);
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
          updateToolchain('arduino-1.6.11-windows');
          cb();
        }, function(err) {
          console.log("ARDUINO INSTALLATION FAILED" + err);
          cb(err);
        });
      }
    } else if (process.platform == 'linux') {
      // install arduino
      all.azhRunLocalCmd('sudo apt-get update && sudo apt-get install -y wget xz-utils; sudo wget -q -O- https://downloads.arduino.cc/arduino-1.6.11-linux64.tar.xz | sudo tar xJ -C /opt; ln -s /opt/arduino-1.6.11/arduino /usr/local/bin/; ln -s /opt/arduino-1.6.11/arduino-builder /usr/local/bin/; chmod 777 gulp-common/arduino-headless.sh', args.verbose, cb);
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
          all.azhRunLocalCmd('open --wait-apps ' + all.getToolsFolder() + '/arduino.zip', args.verbose, cb);
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
    all.azhRunLocalCmd(getArduinoCommand() + ' --install-library dummy', args.verbose, function (err) {
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
    all.azhRunLocalCmd(getArduinoCommand() + ' --verify --board ' + board.descriptor + ' ' + process.cwd() + '/app/app.ino --verbose-build', args.verbose, cb);
  });

  gulp.task('deploy', 'Deploys binary to the device', function (cb) {
    updateConfigHeaderFileSync();
    if (!!config.device_port.trim()) {
      all.azhRunLocalCmd(getArduinoCommand() + ' --upload --board ' + board.descriptor + ' --port ' + config.device_port + ' ' + process.cwd() + '/app/app.ino --verbose-upload', args.verbose, cb);
    } else {
      cb(new Error('Port is not defined in config.json file'));
    }
  });

  gulp.task('default', 'Installs tools, builds and deploys sample to the board', function(callback) {
    runSequence('install-tools', 'deploy', callback);
  })

  function updateToolchain(toolchain) {
    if (null != config) {
      config.toolchain = toolchain;
      writeConfig(config);
    }
  }

  function writeConfig() {
    if (config != null) {
      fs.writeFile('config.json', JSON.stringify(config));
    }
  }

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

function getPackageFolder() {
  if (process.platform === 'win32') {
      return process.env['USERPROFILE'] + '/AppData/Local/Arduino15/packages';
  } else if (process.platform === 'linux') {
      return process.env['HOME'] + '/.arduino15/packages';
  } else if (process.platform === 'darwin') {
      return process.env['HOME'] + '/Library/Arduino15/packages';
  }
}

function installLibrary(name, cb) {
  if (all.folderExistsSync(getLibraryFolder() + '/' + name)) {
    console.log('Library ' + name + ' was already installed...');
    cb();
  } else {

    all.azhRunLocalCmd(getArduinoCommand() + ' --install-library ' + name, args.verbose, function (err) {
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
    if (process.platform == 'win32') {
      all.azhRunLocalCmd('cd ' + getLibraryFolder() + ' & git clone ' + url, args.verbose, function (err) {
        if (err) return cb(err);
        cb();
      });
    } else if (process.platform == 'linux') {
      all.azhRunLocalCmd('cd ' + getLibraryFolder() + '; git clone ' + url, args.verbose, function (err) {
        if (err) return cb(err);
        cb();
      });
    }
  }
}

function installPackage(name, subname, addUrl, cb) {
  if (all.folderExistsSync(getPackageFolder() + '/' + name + '/hardware/' + subname )) {
    console.log('Package ' + name + ':' + subname + ' was already installed...');
    cb();
  } else {
    all.azhRunLocalCmd(getArduinoCommand() + ' --pref boardsmanager.additional.urls=' + addUrl, args.verbose, function (err) {
      if (err) return cb(err);
      all.azhRunLocalCmd(getArduinoCommand() + ' --install-boards "' + name + ':' + subname + '"', args.verbose, function (err) {
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
