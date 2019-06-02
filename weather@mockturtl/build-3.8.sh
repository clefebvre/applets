#!/bin/bash

# Getting bash script file location
SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do # resolve $SOURCE until the file is no longer a symlink
  DIR="$( cd -P "$( dirname "$SOURCE" )" >/dev/null && pwd )"
  SOURCE="$(readlink "$SOURCE")"
  [[ $SOURCE != /* ]] && SOURCE="$DIR/$SOURCE" # if $SOURCE was a relative symlink, we need to resolve it relative to the path where the symlink file was located
done
DIR="$( cd -P "$( dirname "$SOURCE" )" >/dev/null && pwd )"

# Save current dir for convenience
path=${PWD}

cd $DIR/src
tsc -p ../tsconfig.38.json
mv applet.js ../files/weather@mockturtl/3.8
mv darkSky.js ../files/weather@mockturtl/3.8
mv ipApi.js ../files/weather@mockturtl/3.8
mv openWeatherMap.js ../files/weather@mockturtl/3.8
rm @cinnamon.js
cd $path
