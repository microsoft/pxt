#!/bin/sh

set -e

gulp build
pxt pyconv -i parse0.py `find tmp -type f -name '*.py'`
