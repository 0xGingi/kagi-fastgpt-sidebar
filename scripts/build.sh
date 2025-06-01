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
zip -r ../kagi-fastgpt-chrome-v1.0.5.zip . > /dev/null
cd ../..

echo "Submitting Firefox extension to Mozilla Add-ons store..."
cd dist/firefox

if [ -z "$WEB_EXT_API_KEY" ] || [ -z "$WEB_EXT_API_SECRET" ]; then
    echo "Warning: WEB_EXT_API_KEY and WEB_EXT_API_SECRET not set"
    echo "Creating unsigned XPI for development..."
    zip -r ../kagi-fastgpt-firefox-v1.0.5-unsigned.xpi . > /dev/null
    cd ../..
    echo ""
    echo "Package files created:"
    echo "   Chrome:  dist/kagi-fastgpt-chrome-v1.0.5.zip"
    echo "   Firefox: dist/kagi-fastgpt-firefox-v1.0.5-unsigned.xpi (UNSIGNED - for manual upload)"
    echo ""
    echo "To submit Firefox extension to store:"
    echo "1. Set WEB_EXT_API_KEY and WEB_EXT_API_SECRET environment variables"
    echo "2. Run this script again, or manually upload the unsigned XPI to:"
    echo "   https://addons.mozilla.org/developers/addon/submit/"
else
    echo "Submitting extension to Mozilla Add-ons store..."
    if command -v web-ext &> /dev/null; then
        echo "Using web-ext to submit to AMO..."
        if web-ext sign --channel=listed --amo-metadata=../../amo-metadata.json --api-key="$WEB_EXT_API_KEY" --api-secret="$WEB_EXT_API_SECRET"; then
            cd ../..
            echo ""
            echo "Firefox extension successfully submitted to Mozilla Add-ons store!"
            echo "   - Check your email for submission confirmation"
            echo "   - Monitor https://addons.mozilla.org/developers/ for review status"
            echo ""
            echo "Chrome package created:"
            echo "   Chrome: dist/kagi-fastgpt-chrome-v1.0.5.zip"
            echo "   - Upload manually to: https://chrome.google.com/webstore/devconsole/"
        else
            echo "Failed to submit to Mozilla Add-ons store"
            echo "Creating fallback unsigned XPI..."
            zip -r ../kagi-fastgpt-firefox-v1.0.5-unsigned.xpi . > /dev/null
            cd ../..
            echo ""
            echo "Package files created:"
            echo "   Chrome:  dist/kagi-fastgpt-chrome-v1.0.5.zip"
            echo "   Firefox: dist/kagi-fastgpt-firefox-v1.0.5-unsigned.xpi (fallback)"
            echo ""
            echo "Manual submission required for Firefox:"
            echo "   Upload to: https://addons.mozilla.org/developers/addon/submit/"
        fi
    else
        echo "Error: web-ext not found. Install it with: npm install -g web-ext"
        echo "Creating unsigned XPI for manual upload..."
        zip -r ../kagi-fastgpt-firefox-v1.0.5-unsigned.xpi . > /dev/null
        cd ../..
        echo ""
        echo "Package files created:"
        echo "   Chrome:  dist/kagi-fastgpt-chrome-v1.0.5.zip"
        echo "   Firefox: dist/kagi-fastgpt-firefox-v1.0.5-unsigned.xpi (UNSIGNED)"
        echo ""
        echo "Manual submission required:"
        echo "   Chrome:  https://chrome.google.com/webstore/devconsole/"
        echo "   Firefox: https://addons.mozilla.org/developers/addon/submit/"
    fi
fi
echo ""
echo "Development directories:"
echo "   Chrome:  dist/chrome/"
echo "   Firefox: dist/firefox/" 