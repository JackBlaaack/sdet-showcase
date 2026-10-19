#!/bin/sh
# Starts orders-sut, runs one package.json test script against it in Docker,
# removes the containers and exits with the code of the tests.
#
#   scripts/test-docker.sh [test|test:api|test:ui]
#
# The reference build of the SUT is used unless SUT_BUGS is set (all = planted defects).
set -u

export TEST_SCRIPT="${1:-test}"
export SUT_BUGS="${SUT_BUGS:-none}"

docker compose up --build --attach tests --exit-code-from tests
code=$?
docker compose down
exit "$code"
