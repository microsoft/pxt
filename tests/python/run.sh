#!/bin/sh

set -e

jake built/pxt.js
pxt pyconv -i parse0.py `find tmp -type f -name '*.py'`
