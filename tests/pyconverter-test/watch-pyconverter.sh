#!/bin/sh

# TODO can this be done with gulp instead?

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"

$DIR/../common/watch-tests.sh pyconverter-test pyconvertrunner