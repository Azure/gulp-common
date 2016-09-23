'use strict';

function initTasks(gulp, boardId, options) {
  return require('./' + boardId + '.js')(require('gulp-help')(gulp), options);
}

module.exports = initTasks;