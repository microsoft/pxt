#!/bin/sh

# TODO can this be done with jake instead?

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

$DIR/../common/watch-tests.sh runtime-trace-tests tracerunner