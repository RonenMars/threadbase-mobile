#!/usr/bin/env bash
# Kill Metro bundler processes regardless of which port they're running on

pkill -f 'metro' 2>/dev/null || true
pkill -f 'react-native/cli' 2>/dev/null || true

# Also clear common Metro/Expo ports as a safety net
lsof -ti :8081,:8082,:8083,:19000,:19001 | xargs kill -9 2>/dev/null || true

echo "Metro processes killed"
