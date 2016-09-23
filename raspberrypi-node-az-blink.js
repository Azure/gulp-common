var raspberrypi = require('./raspberrypi-node.js');

var all = require('./all.js');
var EventHubClient = require('azure-event-hubs').Client;
var exec = require('child_process').exec;
var moment = require('moment');
var Q = require('q');
var simssh = require('simple-ssh');
var storage = require('azure-storage');
var args = require('get-gulp-args')();

var config = (all.fileExistsSync('../config.json')) ? require('../config.json') : require('../../config.json');
var params = (all.fileExistsSync('../arm-template-param.json')) ? require('../arm-template-param.json').parameters : require('../../arm-template-param.json').parameters;

var sendMessageAndReadIotHub = function () {
  var deferred = Q.defer();

  // Listen device-to-cloud messages
  var printError = function (err) {
    console.log(err.message);
  };
  var printMessage = function (message) {
    console.log('[IoT Hub] Received message: ' + JSON.stringify(message.body) + '\n');
  };

  var iotHubClient = EventHubClient.fromConnectionString(config.iot_hub_connection_string);
  iotHubClient.open()
    .then(iotHubClient.getPartitionIds.bind(iotHubClient))
    .then(function (partitionIds) {
      return partitionIds.map(function (partitionId) {
        return iotHubClient.createReceiver(config.iot_hub_consumer_group_name, partitionId, { 'startAfterTime': Date.now() - 10000 }).then(function (receiver) {
          receiver.on('errorReceived', printError);
          receiver.on('message', printMessage);
        });
      });
    })
    .catch(printError);

  // Send command to device
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

  var targetFolder = config.project_folder ? config.project_folder : '.';
  var startFile = config.start_file ? config.start_file : 'az-blink.js';
  ssh.exec('sudo nodejs ' + targetFolder + '/' + startFile, {
    pty: true,
    out: function (o) { console.log(o); }, // Always log to console when running.
    exit: function () {
      iotHubClient.close();
      deferred.resolve();
    }
  }).start();

  return deferred.promise;
}

var sendMessageAndReadAzureTable = function () {
  var command = 'az storage account show-connection-string -g ' + config.resource_group + ' -n ' + params.resoucePrefix.value + 'storage';
  exec(command, function (err, stdout, stderr) {
    if (err) {
      console.error('ERROR:\n' + err);
      return;
    }
    if (stderr) {
      console.error('Message from STDERR:\n' + stderr);
    }
    if (stdout) {
      var connStr = JSON.parse(stdout).connectionString;
      if (connStr) {
        var tableService = storage.createTableService(connStr);
        var condition = 'PartitionKey eq ? and RowKey gt ? ';
        var tableName = 'DeviceData';
        var timestamp = moment.utc().format('hhmmssSSS');
        var isCancelled = false;
        var messageCount = 0;
        function readNewMessage() {
          var query = new storage.TableQuery().where(condition, moment.utc().format('YYYYMMDD'), timestamp);

          tableService.queryEntities(tableName, query, null, function (error, result, response) {
            if (error) {
              console.error('Fail to read messages:\n' + error);
              setTimeout(readNewMessage, 0);
              return;
            }

            // result.entries contains entities matching the query
            if (result.entries.length > 0) {
              for (var i = 0; i < result.entries.length; i++) {
                console.log('[Azure table] Read message #' + ++messageCount + ': ' + result.entries[i].message['_'] + '\n');

                if (result.entries[i].RowKey['_'] > timestamp) {
                  timestamp = result.entries[i].RowKey['_'];
                }
              }
            }
            if (!isCancelled) {
              setTimeout(readNewMessage, 0);
            }
          });
        }

        readNewMessage();

        // Send command to device
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

        var targetFolder = config.project_folder ? config.project_folder : '.';
        var startFile = config.start_file ? config.start_file : 'az-blink.js';
        ssh.exec('sudo nodejs ' + targetFolder + '/' + startFile, {
          pty: true,
          out: function (o) { console.log(o); }, // Always log to console when running.
          exit: function () {
            // Wait 5 more sends so that Azure function has the chance to process sent messages.
            setTimeout(function () {
              isCancelled = true;
              deferred.resolve();
            }, 5000);
          }
        }).start();

        return deferred.promise;
      } else {
        console.error('ERROR: Fail to get connection string of Azure Storage account.')
      }
    } else {
      console.error('ERROR: No output when getting connection string of Azure Storage account.');
    }
  });
}

function initTasks(gulp) {
  raspberrypi.initTasks(gulp);

  gulp.task('run', function () {
    if (args['read-storage']) {
      sendMessageAndReadAzureTable();
    }
    else {
      sendMessageAndReadIotHub();
    }
  });
}

module.exports = initTasks;
module.exports.initTasks = initTasks;