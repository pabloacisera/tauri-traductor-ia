#!/bin/bash
# create-clean-zip.sh
temp_dir=$(mktemp -d)
rsync -av --exclude='.git' \
          --exclude='*venv' \
          --exclude='*node_modules' \
          --exclude='*__pycache__' \
          --exclude='*.pyc' \
          --exclude='*.pyo' \
          --exclude='dist' \
          ./ "$temp_dir/"
cd "$temp_dir"
zip -r "$OLDPWD/app.zip" .
cd "$OLDPWD"
rm -rf "$temp_dir"
