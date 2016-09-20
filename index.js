function initTasks(boardId) {
  require('./' + boardId + '.js').initTasks( require('gulp-help')(require('gulp')) );
}

module.exports.initTasks = initTasks;
