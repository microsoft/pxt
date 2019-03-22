#!/bin/sh

# set -e

# TODO(dz): move this into jake somehow?

RUNNER_IN="node_modules/typescript/lib/typescript.js built/pxtlib.js built/pxtcompiler.js built/pxtpy.js built/pxtsim.js built/tests/pydecompile-test/pydecompilerunner.js"
RUNNER="./built/tests/pydecompile-test/runner.js"

function update_results() {
    ls ./tests/pydecompile-test/**/*.local* | xargs rm
    cat $RUNNER_IN > $RUNNER
    ./node_modules/.bin/mocha $RUNNER --reporter dot
}

update_results

fswatch $RUNNER_IN --one-per-batch | while read filename; do
    update_results
done


