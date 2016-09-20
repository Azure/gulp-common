function initTasks(gulp, boardId) {
  return require('./' + boardId + '.js').initTasks( require('gulp-help')(gulp) );
}

module.exports.initTasks = initTasks;
