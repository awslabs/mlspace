#!/bin/bash

set -e

mkdir -p /asset-output/python
pushd /asset-output/python

python3 -m pip install --no-deps dynamodb_json -t .
python3 -m pip install --no-deps simplejson -t .
python3 -m pip install --no-deps cachetools==7.0.5 -t .
python3 -m pip install --no-cache-dir pyseto==1.9.1 -t .
python3 -m pip install --no-cache-dir authlib==1.6.9 -t .
python3 -m pip install --no-cache-dir pydantic==2.12.5 -t .
python3 -m pip install --no-cache-dir requests==2.33.1 -t .
python3 -m pip install --no-cache-dir cryptography==46.0.7 -t .
python3 -m pip install boto3==1.42.86 -t .
