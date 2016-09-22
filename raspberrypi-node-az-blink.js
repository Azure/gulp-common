var raspberrypi = require('./raspberrypi-node.js');

// For DEMO purpose. We can discuss later whether we should put it to gulp-common.
var all = require('./all.js');
var exec = require('child_process').exec;
var moment = require('moment');
var storage = require('azure-storage');

var config = (all.fileExistsSync('../config.json')) ? require('../config.json') : require('../../config.json');
var params = (all.fileExistsSync('../arm-template-param.json')) ? require('../arm-template-param.json').parameters : require('../../arm-template-param.json').parameters;

function initTasks(gulp) {
  raspberrypi.initTasks(gulp);

  // TODO: allow user to pass resource group as parameter if default value is not what they want.
  gulp.task('read-message', function () {
    var command = 'az storage account connection-string -g ' + config.resource_group + ' -n ' + params.resoucePrefix.value + 'storage';
    exec(command, function (err, stdout, stderr) {
      if (err) {
        console.error('ERROR:\n' + err);
        return;
      }
      if (stderr) {
        console.error('Message from STDERR:\n' + stderr);
      }
      if (stdout) {
        var connStr = JSON.parse(stdout).ConnectionString;
        if (connStr) {
          var tableService = storage.createTableService(connStr);
          var condition = 'PartitionKey eq ? and RowKey gt ? ';
          var tableName = 'DeviceData';
          var timestamp = moment.utc().format('hhmmssSSS');

          function readNewMessage() {
            var query = new storage.TableQuery().where(condition, moment.utc().format('YYYYMMDD'), timestamp);

            tableService.queryEntities(tableName, query, null, function (error, result, response) {
              if (error) {
                console.error('Fail to read messages:\n' + error);
                setTimeout(readNewMessage, 0);
                return;
              }

              timestamp = moment.utc().format('hhmmssSSS');

              // result.entries contains entities matching the query
              if (result.entries.length == 0) {
                console.log('\nNo New Message.');
              } else {
                console.log('\nNew Messages:');
                for (var i = 0; i < result.entries.length; i++) {
                  console.log(result.entries[i].message['_']);
                  // Update timestamp for next table query
                  if (result.entries[i].RowKey['_'] > timestamp) {
                    timestamp = result.entries[i].RowKey['_'];
                  }
                }
              }
              setTimeout(readNewMessage, 0);
            });
          }

          readNewMessage();
        } else {
          console.error('ERROR: Fail to get connection string of Azure Storage account.')
        }
      } else {
        console.error('ERROR: No output when getting connection string of Azure Storage account.');
      }
    });
  });
}

module.exports = initTasks;
module.exports.initTasks = initTasks;