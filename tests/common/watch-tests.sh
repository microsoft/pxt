#!/bin/sh

# TODO can this be done with jake instead?

if [ $# -ne 2 ]; then
    echo "Usage: watch-tests.h <test-folder> <test-runner-filename>"
    echo "E.g.: watch-tests.h runtime-trace-tests tracerunner"
    exit 1
fi

TEST_FOLDER=$1
TEST_RUNNER_NAME=$2

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
PXT_DIR=$DIR/../..
PXT_BUILD="$PXT_DIR/built"
RUNNER_IN="$PXT_DIR/node_modules/typescript/lib/typescript.js $PXT_BUILD/pxtlib.js $PXT_BUILD/pxtcompiler.js $PXT_BUILD/pxtpy.js $PXT_BUILD/pxtsim.js $PXT_BUILD/tests/$TEST_FOLDER/$TEST_RUNNER_NAME.js"
RUNNER="$PXT_BUILD/tests/$TEST_FOLDER/runner.js"

if ! [ -x "$(command -v fswatch)" ]; then
  echo 'Please install fswatch to use this script.' >&2
  exit 1
fi

function run_test() {
    ls $PXT_DIR/tests/$TEST_FOLDER/**/*.local* | xargs rm
    cat $RUNNER_IN > $RUNNER
    $PXT_DIR/node_modules/.bin/mocha $RUNNER --reporter dot
}

run_test

fswatch $RUNNER_IN --one-per-batch | while read filename; do
    run_test
done
