#!/bin/bash

# Quick Test Script - Fast way to test your new features
# Run with: bash quick-test.sh

echo "🚀 Sideline Coach - Quick Test Setup"
echo "====================================="
echo ""

# Check if build exists
if [ -d "dist" ]; then
    echo "✅ Production build found"
    echo "🎯 Starting preview server (fast!)..."
    echo ""
    npm run preview
else
    echo "📦 No build found. Creating optimized production build..."
    echo "   This will take 10-30 seconds but result in much faster testing."
    echo ""
    npm run build
    
    if [ $? -eq 0 ]; then
        echo ""
        echo "✅ Build complete!"
        echo "🎯 Starting preview server..."
        echo ""
        npm run preview
    else
        echo ""
        echo "❌ Build failed. Falling back to dev server..."
        echo "   (This will be slower)"
        echo ""
        npm run dev
    fi
fi
