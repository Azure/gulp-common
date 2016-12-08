#!/bin/bash
SCREEN=3
Xvfb :$SCREEN -nolisten tcp -screen :$SCREEN 1280x800x24 &
xvfb="$!"
DISPLAY=:$SCREEN arduino "$@"
RETVAL=$?
kill -9 $xvfb
exit $RETVAL