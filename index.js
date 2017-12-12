/*
* Gulp Common - Microsoft Sample Code - Copyright (c) 2016 - Licensed MIT
*/
'use strict';

/**
 * Main entry point for gulp-common.
 * @param {object} gulp     - external gulp instance
 * @param {string} boardId  - Board identifier. Must match one of the predefined boards.
 * @param {object} options  - options depending on particular board requirements
 */
function initTasks(gulp, boardId, options) {
  require('./' + boardId + '.js')(require('gulp-help')(gulp), options);
  return gulp;
}

module.exports = initTasks;
