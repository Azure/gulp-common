'use strict';

var all = require('./all.js');
var config = (all.fileExistsSync('../config.json')) ? require('../config.json') : require('../../config.json');

var simssh = require('simple-ssh');
var fs = require('fs');
var Q = require('q');
var args = require('get-gulp-args')();
var SAMPLE_NAME = 'main';
var PREBUILT_FOLDER = all.getToolsFolder() + '/prebuilt-libs';
var TOOLCHAIN_ZIP_FILE = all.getToolsFolder() + '/toolchain.zip';
var TOOLCHAIN_UNZIP_FOLDER = all.getToolsFolder() + '/gcc-linaro-arm-linux-gnueabihf-4.9-2014.09_win32';
var PREBUILT_SDK_REPO = 'https://github.com/zikalino/az-iot-sdk-prebuilt.git';
var COMPILER_NAME = (process.platform == 'win32' ?
                                        'gcc-linaro-arm-linux-gnueabihf-4.9-2014.09_win32' :
                                        'gcc-linaro-arm-linux-gnueabihf-4.9-2014.09_linux');
var COMPILER_FOLDER = all.getToolsFolder() + '/' + COMPILER_NAME + '/bin';

// XXX - move inside?
// setup BI
//if (typeof all.gulpTaskBI === 'function') {
//  all.gulpTaskBI(gulp, 'c', 'RaspberryPi', 'az-blink');
//}

function initTasks(gulp) {
  var runSequence = require('run-sequence').use(gulp);

  gulp.task('install-tools', 'Installs Raspberry Pi crosscompiler and libraries', function () {

    // make sure tools folder exists
    if (!all.folderExistsSync(all.getToolsFolder()))
      fs.mkdirSync(all.getToolsFolder());

    // clone helper repository to tools folder -- if it doesn't exists
    if (!all.folderExistsSync(PREBUILT_FOLDER + '/.git')) {
      all.azhRunLocalCmd('git clone ' + PREBUILT_SDK_REPO + ' ' + PREBUILT_FOLDER, args.verbose, function(result) {
        // XXX - handle result
      });
    }

    if (process.platform == 'win32') {
      if(!all.fileExistsSync(TOOLCHAIN_ZIP_FILE) || !all.folderExistsSync(TOOLCHAIN_UNZIP_FOLDER))
      {
        var deferred = Q.defer();

        all.downloadAndUnzip('https://releases.linaro.org/14.09/components/toolchain/binaries/gcc-linaro-arm-linux-gnueabihf-4.9-2014.09_win32.zip', TOOLCHAIN_ZIP_FILE,
        all.getToolsFolder(), function() { deferred.resolve();}, 
        function(err){deferred.reject(err);});
        
        return deferred.promise; 
      }
    } else if (process.platform == 'linux') {

      // just use wget and tar commands sequentially
      // trying to find reliable gulp tools may be very time consuming
      all.azhRunLocalCmd('cd ' + all.getToolsFolder() + '; wget https://releases.linaro.org/14.09/components/toolchain/binaries/gcc-linaro-arm-linux-gnueabihf-4.9-2014.09_linux.tar.xz; tar xf gcc-linaro-arm-linux-gnueabihf-4.9-2014.09_linux.tar.xz; rm gcc-linaro-arm-linux-gnueabihf-4.9-2014.09_linux.tar.xz', args.verbose, function (result) {});

      // below are compiler's dependencies on 64-bit platform
      if (process.arch == 'x64') {
        all.azhRunLocalCmd('sudo dpkg --add-architecture i386', args.verbose, function (result) {});
        all.azhRunLocalCmd('sudo apt-get -y update', args.verbose, function (result) {});
        all.azhRunLocalCmd('sudo apt-get -y install libc6:i386 libncurses5:i386 libstdc++6:i386', args.verbose, function (result) {});
        all.azhRunLocalCmd('sudo apt-get -y install lib32z1', args.verbose, function (result) {});
      }
    } else {
      console.log('We dont have tools for your operating system at this time');
    }
  });

  gulp.task('build', 'Builds sample code', function() {

    // write config file only if data is available in config.json
    if (config.iot_hub_host_name) {
      /*  String containing Hostname, Device Id & Device Key in the format:                       */
      /*  "HostName=<host_name>;DeviceId=<device_id>;SharedAccessKey=<device_key>"                */
      /*  "HostName=<host_name>;DeviceId=<device_id>;SharedAccessSignature=<device_sas_token>"    */
      var connectionString = 'HostName=' + config.iot_hub_host_name + ';DeviceId=' + config.iot_hub_device_id + ';SharedAccessKey=' + config.iot_hub_device_key;
      var headerContent = 'static const char* connectionString = ' + '"' + connectionString + '"' + ';';
      if (fs.existsSync( './config.h' )){
        // the content of config.h is generated from config.json
        fs.writeFileSync('./config.h', headerContent);
      }else {
        console.log('config file does not exist');
      }
    }

    // XXX - check if toolchain is configured here

    // remove old out directory and create empty one
    all.deleteFolderRecursivelySync('out');
    fs.mkdirSync('out');

    // in first step just compile sample file
    var cmd = COMPILER_FOLDER + '/arm-linux-gnueabihf-gcc ' + 
              '-I' + PREBUILT_FOLDER + '/raspbian-jessie-sysroot/usr/include ' +
              '-I' + PREBUILT_FOLDER + '/inc/serializer ' +
              '-I' + PREBUILT_FOLDER + '/inc/azure-c-shared-utility ' +
              '-I' + PREBUILT_FOLDER + '/inc/platform_specific ' +
              '-I' + PREBUILT_FOLDER + '/inc ' +
              '-I' + PREBUILT_FOLDER + '/inc/iothub_client ' +
              '-I' + PREBUILT_FOLDER + '/inc/azure-uamqp-c ' +
              '-o out/' + SAMPLE_NAME + '.o ' +
              '-c ' + SAMPLE_NAME + '.c';

    all.azhRunLocalCmd(cmd, args.verbose, function (result) {});

    // second step -- link with prebuild libraries
    cmd = COMPILER_FOLDER + '/arm-linux-gnueabihf-gcc ' +
              'out/' + SAMPLE_NAME + '.o ' + 
              '-o out/' + SAMPLE_NAME +
              ' -rdynamic ' + 
              PREBUILT_FOLDER + '/raspbian-jessie/libserializer.a ' +
              PREBUILT_FOLDER + '/raspbian-jessie/libiothub_client.a ' +
              PREBUILT_FOLDER + '/raspbian-jessie/libiothub_client_amqp_transport.a ' +
              PREBUILT_FOLDER + '/raspbian-jessie/libaziotplatform.a ' +
              '-lwiringPi ' + 
              PREBUILT_FOLDER + '/raspbian-jessie/libaziotsharedutil.a ' +
              PREBUILT_FOLDER + '/raspbian-jessie/libuamqp.a ' +
              PREBUILT_FOLDER + '/raspbian-jessie/libaziotsharedutil.a ' +
              '-lssl ' +
              '-lcrypto ' +
              '-lcurl ' +
              '-lpthread ' +
              '-lm ' +
              '-lssl ' +
              '-lcrypto ' +
              '--sysroot=' + PREBUILT_FOLDER + '/raspbian-jessie-sysroot';

    all.azhRunLocalCmd(cmd, args.verbose, function (result) {});
  });

  gulp.task('check-raspbian', false, function() {
    var deferred = Q.defer();

    var ssh = new simssh({
      host: config.device_host_name_or_ip_address,
      user: config.device_user_name,
      pass: config.device_password
    });

    ssh.on('error', function (e) {
      // when we pass error via deferred.reject, stack will be displayed
      // as it is just string, we can just replace it with message
      e.stack = "ERROR: " + e.message;
      deferred.reject(e);
    });

    ssh.exec('uname -a', {
      pty: true,
      out: function (out) {
        if (!out.startsWith('Linux raspberrypi 4.4')) {
          console.log('--------------------');
          console.log('WARNING: Unsupported OS version - sample code may not work properly');
          console.log(out);
          console.log('--------------------');
        }
        deferred.resolve();
      }
    }).start();

    return deferred.promise;
  })

  gulp.task('deploy', 'Deploys compiled sample to the board', ['check-raspbian'], function(){
    var deferred = Q.defer();
    
    all.uploadFiles(config, ['out/' + SAMPLE_NAME], ['./' + SAMPLE_NAME], function(){deferred.resolve();});
    
    return deferred.promise;
  });

  gulp.task('run', 'Runs deployed sample on the board', function () {
    var deferred = Q.defer();

    var ssh = new simssh({
      host: config.device_host_name_or_ip_address,
      user: config.device_user_name,
      pass: config.device_password
    });

    ssh.on('error', function (e) {
      // when we pass error via deferred.reject, stack will be displayed
      // as it is just string, we can just replace it with message
      e.stack = "ERROR: " + e.message;
      deferred.reject(e);
    });

    ssh.exec('sudo chmod +x ./'+ SAMPLE_NAME + ' ; sudo ./' + SAMPLE_NAME, {
      pty: true,
      out: console.log.bind(console),
      exit: function() { deferred.resolve(); }
    }).start();

    return deferred.promise;
  });

  gulp.task('all', 'Builds, deploys and runs sample on the board', function(callback) {
    runSequence('install-tools', 'build', 'deploy', 'run', callback);
  })
}

module.exports.initTasks = initTasks;
