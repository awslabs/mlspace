#!/bin/bash

set -e

mkdir -p /asset-output/python
pushd /asset-output/python

python3 -m pip install --no-deps dynamodb_json -t .
python3 -m pip install --no-deps simplejson -t .
python3 -m pip install --no-deps cachetools -t .
python3 -m pip install --no-cache-dir pyseto -t .
python3 -m pip install boto3 -t .