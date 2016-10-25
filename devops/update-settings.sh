#!/bin/sh
if [ "X$1" = "X" ] ; then
  s=settings
else
  s="$1"
fi

pxt api config/$s > settings.json
vi settings.json
pxt api config/$s - < settings.json
rm settings.json
pxt api pokecloud '{}'
