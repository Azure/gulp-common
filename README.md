# Gulp Common

## Introduction

Gulp Common is a helper module providing supporting **gulp** tasks for building and deployment of applications for various hardware platforms.

## Including Gulp Toolchain in an application.

Including gulp tools in sample code directory requires very minimal effort from developer.

First of all appropriate references need to be included in **package.json**:

        "gulp": "^3.9.1",
        "gulp-common": "Azure/gulp-common.git#release-1.0.11"

Secondly, **gulpfile.js** shall be created with following content:

        require('gulp-common')(require('gulp'), '<board identifier>');

Currently supported board identifiers:
- arduino-esp8266-huzzah
- arduino-esp8266-thingdev
- arduino-adafruit-samd-feather-m0
- arduino-edison
- raspberry-pi-c
- raspberry-pi-node

## Commands Provided by Gulp

### Installing Tools

Following command will install tools on either developer's machine and the board.

    $ gulp install-tools

In the future it will be possible to specify additional options, for example:

    $ gulp install-tools docker

### Building Code
Following command will build sample code:

    $ gulp build

Command is not applicable to Node.js.

### Deploying Code / Binary
Following command will deploy Node.js source code or C/C++ executable to the board:

    $ gulp deploy

Command is not applicable to Node.js.

### Running Code
Following command will execute Node.js application or C/C++ executable:

    $ gulp run

Command can be executed with **debug** parameter to start applicatin in debugging mode:

    $ gulp run debug
