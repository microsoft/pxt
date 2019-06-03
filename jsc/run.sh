#!/bin/sh

f="jscprep.js ../built/web/pxtworker.js ../built/web/worker.js ../../pxt-32/built/target.js interface.js"
cp $f script.json ../../pxt-vm-ios/js
jsc $f
