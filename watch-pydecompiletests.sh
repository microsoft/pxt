#!/bin/sh

# set -e

# TODO(dz): move this into jake somehow?

RUNNER_IN="node_modules/typescript/lib/typescript.js built/pxtlib.js built/pxtcompiler.js built/pxtpy.js built/pxtsim.js built/tests/pydecompile-test/pydecompilerunner.js"
RUNNER="./built/tests/pydecompile-test/runner.js"

fswatch $RUNNER_IN --one-per-batch | while read filename; do
    cat $RUNNER_IN > $RUNNER
    ./node_modules/.bin/mocha $RUNNER --reporter dot
done


