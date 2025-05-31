#!/bin/bash

set -e

echo "Building Kagi FastGPT Browser Extension..."

echo "Cleaning previous builds..."
rm -rf dist

echo "Building Chrome extension..."
mkdir -p dist/chrome
cp -r icons dist/chrome/
cp background.js content.js sidebar.css toggle-sidebar.js dist/chrome/
cp manifest.json dist/chrome/

echo "Building Firefox extension..."
mkdir -p dist/firefox
cp -r icons dist/firefox/
cp background.js content.js sidebar.css toggle-sidebar.js dist/firefox/
node scripts/create-firefox-manifest.js

echo "Creating Chrome package..."
cd dist/chrome
zip -r ../kagi-fastgpt-chrome-v1.0.0.zip . > /dev/null
cd ../..

echo "Creating Firefox package..."
cd dist/firefox
zip -r ../kagi-fastgpt-firefox-v1.0.0.zip . > /dev/null
cd ../..

echo "Build complete!"
echo ""
echo "Package files created:"
echo "   Chrome:  dist/kagi-fastgpt-chrome-v1.0.0.zip"
echo "   Firefox: dist/kagi-fastgpt-firefox-v1.0.0.zip"
echo ""
echo "Development directories:"
echo "   Chrome:  dist/chrome/"
echo "   Firefox: dist/firefox/" 