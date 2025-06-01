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

echo "Creating and signing Firefox XPI package..."
cd dist/firefox

if [ -z "$WEB_EXT_API_KEY" ] || [ -z "$WEB_EXT_API_SECRET" ]; then
    echo "Warning: WEB_EXT_API_KEY and WEB_EXT_API_SECRET not set"
else
    echo "Signing extension with Mozilla..."
    if command -v web-ext &> /dev/null; then
        web-ext sign --api-key="$WEB_EXT_API_KEY" --api-secret="$WEB_EXT_API_SECRET" --artifacts-dir=../ --channel=unlisted
        cd ../..
        echo ""
        echo "Package files created:"
        echo "   Chrome:  dist/kagi-fastgpt-chrome-v1.0.0.zip"
        echo "   Firefox: dist/kagi_fastgpt_sidebar-1.0.0.xpi (SIGNED)"
    else
        echo "Error: web-ext not found. Install it with: npm install -g web-ext"
        echo "Creating unsigned XPI for development..."
        zip -r ../kagi-fastgpt-firefox-v1.0.0-unsigned.xpi . > /dev/null
        cd ../..
        echo ""
        echo "Package files created:"
        echo "   Chrome:  dist/kagi-fastgpt-chrome-v1.0.0.zip"
        echo "   Firefox: dist/kagi-fastgpt-firefox-v1.0.0-unsigned.xpi (UNSIGNED)"
    fi
fi
echo ""
echo "Development directories:"
echo "   Chrome:  dist/chrome/"
echo "   Firefox: dist/firefox/" 