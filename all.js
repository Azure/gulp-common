/*
* Gulp Common - Microsoft Sample Code - Copyright (c) 2016 - Licensed MIT
*/
'use strict';

var fs = require('fs');
var request = require('request');
var unzip = require('unzip');
var simssh = require('simple-ssh');
var scp2 = require('scp2')
var biHelper = require('./biHelper.js');

/**
 * Uploads files to the device
 * @param {} config
 * @param {string[]} sourceFileList - List of local files
 * @param {string[]} targetFileList - List of files at destination
 * @param {callback} cb - Callback
 */
function uploadFilesViaScp(config, sourceFileList, targetFileList, cb)
{
  if(sourceFileList.length == 0) {
    if (cb) cb();
    return;
  }

  var prefix = config.device_user_name + ':' + config.device_password + '@' + config.device_host_name_or_ip_address + ':';

  scp2.scp(sourceFileList[0], prefix + targetFileList[0], function(err) {
    if (err) {
      if (cb) {
        err.stack = "SCP file transfer failed (" + err + ")";
        cb(err);

        // clear callback, SCP2 seems to be calling error callback twice, and that looks ugly
        cb = null;
      }
    } else {
      console.log( "- file '" +  sourceFileList[0] + "' transferred" );
      
      sourceFileList.splice(0, 1);
      targetFileList.splice(0, 1);
      uploadFilesViaScp(config, sourceFileList, targetFileList, cb);
    }
  });
}

/**
 * Executes command locally
 * @param {string} cmd - Command to be executed
 * @param {boolean} verbose - If true, command output will be printed to stdout
 * @param {callback} cb - Callback on completion
 */
function localExecCmd(cmd, verbose, cb) {
  try {
    var args = cmd.split(' ');
    cmd = args.splice(0, 1);
    var cp = require('child_process').spawn(cmd[0], args);

    cp.stdout.on('data', function(data) {
      if (verbose) process.stdout.write(String(data));
    });

    cp.stderr.on('data', function(data) {
      if (verbose) process.stdout.write(String(data));
    });

    cp.on('close', function(code) {
      
      if (cb) {
        if (0 == code) {
          cb();
        } else {
          var e = new Error("External command failed");
          e.stack = "exit code: " + code;
          cb(e);
        }
      }
    });
  } catch (e) {
    e.stack = "ERROR: " + e;
    if (cb) cb(e);
  }
}

/**
 * Executes sequence of commands locally
 * @param {string[]} cmds - List of commands to be executed
 * @param {boolean} verbose - If true, command output will be printed to stdout
 * @param {callback} cb - Callback on completion
 */
function localExecCmds(cmds, verbose, cb) {

  // check if there are any commands to execute
  if (cmds.length == 0) {
    if (cb) cb();
    return;
  }

  // execute first command
  localExecCmd(cmds.splice(0, 1)[0], verbose, function (e) {
    if (e) {
      if (cb) cb(e);
      return;
    }

    // continue with remaining commands
    localExecCmds(cmds, verbose, cb);
  })
}

/**
 * Clone repository locally
 * @param {string}    url       - URL of git repository to clone
 * @param {string}    folder    - Destination folder
 * @param {boolean}   verbose   - If true, command output will be printed to stdout
 * @param {callback}  cb        - Callback on completion
 */
function localClone(url, folder, verbose, cb) {
  if (folderExistsSync(folder)) {
    console.log('Repo ' + url + ' was already cloned...');
    if(cb) cb();
  } else {
    localExecCmd('git clone ' + url + ' ' + folder, verbose, cb);
  }
}

/**
 * Execute command via SSH
 * @param {string}    cmd       - command to be execture
 * @param {object}    config    - Config (content of config.json)
 * @param {object}    options   - If true, command output will be printed to stdout
 * @param {callback}  cb        - Callback on completion
 */
function sshExecCmd(cmd, config, options, cb) {
  var ssh = new simssh({
    host: config.device_host_name_or_ip_address,
    user: config.device_user_name,
    pass: config.device_password
  });

  var output = '';

  ssh.on('error', function (e) {
    // when we pass error via deferred.reject, stack will be displayed
    // as it is just string, we can just replace it with message
    e.stack = "ERROR: " + e.message;
    console.log("ERROR OCCURED");
    cb(e);
  });

  ssh.exec(cmd, {
    pty: true,
    out: function (o) {
      if (options && options.verbose) {
        process.stdout.write(o);
      }

      output += String(o);
    },
    exit: function() {
      // setting short timeout, as exit handler may be called before remaining data
      // arrives via out
      setTimeout(function() {
        if (options && options.marker) {
          if (output.indexOf(options.marker) < 0) {
            var err = new Error("SSH command hasn't completed successfully");
            err.stack = err.message;
            err.marker = true;
            cb(err);
            return;
          }
        }
        if (cb) cb();
      }, 1000);
    }
  }).start();
}

/**
 * Delete folder recursively and synchronously.
 * @param {string}    path      - folder to be deleted
 */
function deleteFolderRecursivelySync(path) {
  if( fs.existsSync(path) ) {
    fs.readdirSync(path).forEach(function(file,index){
      var curPath = path + "/" + file;
      if(fs.lstatSync(curPath).isDirectory()) { // recurse
        deleteFolderRecursivelySync(curPath);
      } else { // delete file
        fs.unlinkSync(curPath);
      }
    });
    fs.rmdirSync(path);
  }
};

/**
 * Checks of file exists synchronously.
 * @param {string}    path      - File to be checked
 * @returns {boolean}
 */
function fileExistsSync(path) {
  try {
    return fs.statSync(path).isFile();
  } catch (e) {
    return false;
  }
}

/**
 * Checks if folder exists synchronously.
 * @param {string}    path      - Folder to be checked
 * @returns {boolean}
 */
function folderExistsSync(path) {
  try {
    return fs.statSync(path).isDirectory();
  } catch (e) {
    return false;
  }
}

/**
 * Downloads file.
 * @param {string}    url     - Source file URL
 * @param {string}    target  - Target file path
 * @param {callback}  cb
 */
function download(url, target, cb)
{
  var stream = request(url).pipe(fs.createWriteStream(target));
  
  stream.on('error', function(err){
    err.stack = err.message;
    cb(err);
  });
  
  stream.on('close', function(){
    if (cb) cb();
  });
}

/**
 * Downloads file.
 * @param {string}    srcZipUrl     - Source file URL
 * @param {string}    targetZipPath - Target file path
 * @param {string}    unzipFolder   - Target folder for unzipping
 * @param {callback}  cb
 */
function downloadAndUnzip(srcZipUrl, targetZipPath, unzipFolder, cb)
{
  download(srcZipUrl, targetZipPath, function (err) {
    if (err) {
      if (cb) cb(err);
    } else {
      var extractStream = fs.createReadStream(targetZipPath).pipe(unzip.Extract({path:unzipFolder}));
      extractStream.on('error', function(err) {
        err.stack = err.message;
        if (cb) cb(err);
      });
      extractStream.on('close', function() {
        if (cb) cb();
      });       
    }
  })

}

/**
 * Downloads and installs archive or git repository, depending on URL type.
 * Archive/repository will be by default unpacked/cloned into default tools
 * directory with deafult name.
 * 
 * @param {string} url      - archive / respository URL
 * @param {object} options  - options
 * @param {callback}  cb    - callback
 */
function localRetrieve(url, options, cb) {
  var filename = url.split('/').slice(-1)[0];

  var folder = (options && options.folder) ? options.folder : '';

  // extract expected folder name from filename if not given in options
  if (folder == '') {
    folder = filename.slice(0, filename.lastIndexOf('.'));

    if (folder.endsWith('.tar')) {
      folder = folder.slice(0, folder.indexOf('.tar'));
    }
  }

  var path = getToolsFolder() + '/' + filename;

  if (folderExistsSync(getToolsFolder() + '/' + folder)) {
    console.log(" ... package '" + filename + "' already installed...");
    cb();
    return;
  }

  if (filename.endsWith('.git')) {
    localClone(url, getToolsFolder() + '/' + folder, false, cb);
  } else {
    download(url, path, function (err) {
      if (err) {
        if (cb) cb(err);
      } else {
        if (process.platform == 'darwin') {

          // for OS X use open command to uncompress all the archives
          // XXX - handle verbose properly
          localExecCmd('open --wait-apps ' + path, false, cb);
          return;

        } else if (filename.endsWith('.zip')) {

          // for all zip archives on Windows and Ubuntu we will use node module 
          var extractStream = fs.createReadStream(path).pipe(unzip.Extract({ path: getToolsFolder() }));
          extractStream.on('error', function(err) {
            err.stack = err.message;
            if (cb) cb(err);
          });
          extractStream.on('close', function() {
            if (cb) cb();
          });
          return;

        } else if (process.platform == 'linux') {
          // Ubuntu specific stuff, just use tar to uncompress all the other archives
          if (filename.endsWith('.tar.gz')) {

            var cmds = [
              'sudo tar xvz --file=' + path + ' -C ' + getToolsFolder(),
              'sudo rm ' + path ];
            // XXX - handle verbosity
            localExecCmds(cmds, true, cb)
            return;

          } else if (filename.endsWith('.tar.xz')) {

            var cmds = [
              'sudo apt-get update',
              'sudo apt-get install -y wget xz-utils',
              'sudo tar xJ --file=' + path + ' -C ' + getToolsFolder(),
              'sudo rm ' + path ];
            // XXX - handle verbosity
            localExecCmds(cmds, true, cb)
            return;
          }
        }

        // format is not supported yet on current platform
        var err = new Error('Archive format not supported');
        cb(err);
      } 
    });
  }
}

/**
 * Get tools folder for host operating system
 * @returns {string}
 */
function getToolsFolder() {
  var folder = process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'] + '/vsc-iot-tools';

  if (!folderExistsSync(folder)) {
    fs.mkdirSync(folder);
  }

  return folder;
}

module.exports.uploadFilesViaScp = uploadFilesViaScp;
module.exports.localExecCmd = localExecCmd;
module.exports.localExecCmds = localExecCmds;
module.exports.localClone = localClone;
module.exports.localRetrieve = localRetrieve;
module.exports.sshExecCmd = sshExecCmd;
module.exports.deleteFolderRecursivelySync = deleteFolderRecursivelySync;
module.exports.fileExistsSync = fileExistsSync;
module.exports.folderExistsSync = folderExistsSync;
module.exports.downloadAndUnzip = downloadAndUnzip;
module.exports.download = download;
module.exports.gulpTaskBI = biHelper.gulpTaskBI;
module.exports.getToolsFolder = getToolsFolder;