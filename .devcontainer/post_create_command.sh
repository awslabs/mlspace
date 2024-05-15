#!/bin/bash

cd frontend/
sudo apt-get update -y
sudo apt-get install -y libgtk2.0-0 libgtk-3-0 libnotify-dev libgconf-2-4 libnss3 libxss1 libasound2 libxtst6 xauth xvfb libgbm-dev
npm install
node_modules/.bin/cypress install
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