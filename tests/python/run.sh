#!/bin/sh

set -e

jake built/pxt.js
pxt pyconv -i parse0.py tmp/rtttl/adafruit_rtttl.py tmp/circuitplayground/adafruit_circuitplayground/express.py
#`find tmp -type f -name '*.py'`

# | while read LINE ; do
#  pxt pyconv -i $LINE
# done
