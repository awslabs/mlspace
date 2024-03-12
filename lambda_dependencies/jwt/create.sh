#!/bin/bash

set -e

mkdir -p /asset-output/python
pushd /asset-output/python

python3 -m pip install --no-deps pyjwt -t .