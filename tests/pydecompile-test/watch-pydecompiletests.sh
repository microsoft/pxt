#!/bin/sh

# TODO can this be done with jake instead?

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
PXT_DIR=$DIR/../..
PXT_BUILD="$PXT_DIR/built"
RUNNER_IN="$PXT_DIR/node_modules/typescript/lib/typescript.js $PXT_BUILD/pxtlib.js $PXT_BUILD/pxtcompiler.js $PXT_BUILD/pxtpy.js $PXT_BUILD/pxtsim.js $PXT_BUILD/tests/pydecompile-test/pydecompilerunner.js"
RUNNER="$PXT_BUILD/tests/pydecompile-test/runner.js"

function update_results() {
    ls $PXT_DIR/tests/pydecompile-test/**/*.local* | xargs rm
    cat $RUNNER_IN > $RUNNER
    $PXT_DIR/node_modules/.bin/mocha $RUNNER --reporter dot
}

update_results

fswatch $RUNNER_IN --one-per-batch | while read filename; do
    update_results
done


