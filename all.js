'use strict';

var fs = require('fs');
var ssh2 = require('ssh2');
var request = require('request');
var unzip = require('unzip');
var simssh = require('simple-ssh');
var scp2 = require('scp2')
var biHelper = require('./biHelper.js');

function uploadFiles(config, sourceFileList, targetFileList, callback) {
  var finishedFileNumber = 0;
  var totalFileNumber = sourceFileList.length;

  var conn = new ssh2();
  conn.on(
    'connect',
     function(){}
  );

  conn.on(
    'ready',
    function () {
      conn.sftp(
        function (err, sftp) {
          if ( err ) {
            console.log( "--- SFTP error: %s", err );
            
            callback(err);
            return;
          }

          for(let i = 0; i < sourceFileList.length; i++)
          {
            // TODO:
            // If the target file list contain folder that doesn't exist in device, the upload will fail.
            // Will create the folder if it doesn't exist.
            
            // upload file
            var readStream = fs.createReadStream( sourceFileList[i] );
            var writeStream = sftp.createWriteStream( targetFileList[i] );

            var onClose = function(){
              console.log( "- file '" +  sourceFileList[i] + "' transferred" );
              if(++finishedFileNumber == totalFileNumber)
              {
                sftp.end();
                conn.end();
                
                if (callback){
                  callback();
                }
              }
            };
            
            // what to do when transfer finishes
            writeStream.on(
              'close',
              onClose
            );

            // initiate transfer of file
            readStream.pipe( writeStream );
          } 
        }
      );
    }
  );

  conn.on(
    'error',
    function (err) {
      console.log( "- connection error: %s", err );
    }
  );

  conn.on(
    'end',
    function(){}
  );

  conn.connect({
    "host": config.device_host_name_or_ip_address,
    "port": config.ssh_port ? config.ssh_port : 22,
    "username": config.device_user_name,
    "password": config.device_password
  });
}

function uploadFilesViaScp(config, sourceFileList, targetFileList, callback)
{
  if(sourceFileList.length == 0) return;
  
  var prefix = config.device_user_name + ':' + config.device_password + '@' + config.device_host_name_or_ip_address + ':';

  var onClose = function(){
    console.log( "- file '" +  sourceFileList[0] + "' transferred" );
    
    if(sourceFileList.length == 1)
    {
      if (callback){
        callback();
      }
    }
    else
    {
      sourceFileList.splice(0, 1);
      targetFileList.splice(0, 1);
      uploadFilesViaScp(config, sourceFileList, targetFileList, callback);
    }
  };

  scp2.scp(sourceFileList[0], prefix + targetFileList[0], onClose);
}

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

function localExecCmds(cmds, verbose, cb) {

  // check if there are any commands to execute
  if (cmds.length == 0) {
    cb();
    return;
  }

  // execute first command
  localExecCmds(cmds.splice(0, 1)[0], verbose, function (e) {
    if (e) {
      cb(e);
      return;
    }

    // continue with remaining commands
    localExecCmds(cmds, verbose, cb);
  })
}

function localClone(url, folder, verbose, cb) {
  if (folderExistsSync(folder)) {
    console.log('Repo ' + url + ' was already cloned...');
    cb();
  } else {
    localExecCmd('git clone ' + url + ' ' + folder, verbose, cb);
  }
}


function azhSshExec(cmd, config, verbose, cb) {
  var ssh = new simssh({
    host: config.device_host_name_or_ip_address,
    user: config.device_user_name,
    pass: config.device_password
  });

  ssh.on('error', function (e) {
    // when we pass error via deferred.reject, stack will be displayed
    // as it is just string, we can just replace it with message
    e.stack = "ERROR: " + e.message;
    cb(e);
  });

  ssh.exec(cmd, {
    pty: true,
    out: function (o) { if (verbose) console.log(o); },
    exit: function() { cb(); }
  }).start();
}

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

function fileExistsSync(path) {
  try {
    return fs.statSync(path).isFile();
  } catch (e) {
    return false;
  }
}

function folderExistsSync(path) {
  try {
    return fs.statSync(path).isDirectory();
  } catch (e) {
    return false;
  }
}

function download(srcZipUrl, targetZipPath, successCB, failureCB)
{
  var zipStream = request(srcZipUrl)
  .pipe(fs.createWriteStream(targetZipPath));
  
  zipStream.on('error', function(err){
    err.stack = err.message;
    if(failureCB) failureCB(err);
  });
  
  zipStream.on('close', function(){
    if(successCB) successCB();
  });
}

function downloadAndUnzip(srcZipUrl, targetZipPath, unzipFolder, successCB, failureCB)
{
  var zipStream = request(srcZipUrl)
  .pipe(fs.createWriteStream(targetZipPath));
  
  zipStream.on('error', function(err){
    err.stack = err.message;
    if(failureCB) failureCB(err);
  });
  
  zipStream.on('close', function(){
    var extractStream = fs.createReadStream(targetZipPath).pipe(unzip.Extract({path:unzipFolder}));
    extractStream.on('error', function(err){
      err.stack = err.message;
      if(failureCB) failureCB(err);
    });
    extractStream.on('close', function(){
      if(successCB) successCB();
    });
  });
}

function getToolsFolder() {
  return process.env[(process.platform == 'win32') ? 'USERPROFILE' : 'HOME'] + '/vsc-iot-tools';
}

module.exports.uploadFiles = uploadFiles;
module.exports.uploadFilesViaScp = uploadFilesViaScp;
module.exports.localExecCmd = localExecCmd;
module.exports.localExecCmds = localExecCmds;
module.exports.localClone = localClone;
module.exports.azhSshExec = azhSshExec;
module.exports.deleteFolderRecursivelySync = deleteFolderRecursivelySync;
module.exports.fileExistsSync = fileExistsSync;
module.exports.folderExistsSync = folderExistsSync;
module.exports.downloadAndUnzip = downloadAndUnzip;
module.exports.download = download;
module.exports.gulpTaskBI = biHelper.gulpTaskBI;
module.exports.getToolsFolder = getToolsFolder;