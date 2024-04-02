#!/bin/bash

cd frontend/ && npm install
cd ..

npm install

python3 -m venv .venv
. .venv/bin/activate
cd backend
pip install .
pip3 install -r requirements.txt
pip3 install -r test/requirements.txt

cd ..

pre-commit install