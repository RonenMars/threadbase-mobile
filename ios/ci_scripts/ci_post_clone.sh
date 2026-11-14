#!/bin/bash
# Xcode Cloud clones the repo without node_modules or Pods; rebuild both the way deploy.yml does.
set -euo pipefail

cd "$CI_PRIMARY_REPOSITORY_PATH"

export HOMEBREW_NO_AUTO_UPDATE=1 HOMEBREW_NO_INSTALL_CLEANUP=1
brew install node@24
export PATH="$(brew --prefix node@24)/bin:$PATH"

npm ci

# Metro inlines EXPO_PUBLIC_* from .env files, not reliably from the shell environment.
{
  [ -n "${EXPO_PUBLIC_SENTRY_DSN:-}" ] && echo "EXPO_PUBLIC_SENTRY_DSN=$EXPO_PUBLIC_SENTRY_DSN"
  [ -n "${EXPO_PUBLIC_SUPPORT_EMAIL:-}" ] && echo "EXPO_PUBLIC_SUPPORT_EMAIL=$EXPO_PUBLIC_SUPPORT_EMAIL"
  [ -n "${EXPO_PUBLIC_FEEDBACK_EMAIL:-}" ] && echo "EXPO_PUBLIC_FEEDBACK_EMAIL=$EXPO_PUBLIC_FEEDBACK_EMAIL"
} > .env.local || true

# The Gemfile pins CocoaPods 1.17.0; a bare pod install would rewrite Podfile.lock.
gem install bundler --user-install
export PATH="$(ruby -e 'print Gem.user_dir')/bin:$PATH"
bundle config set --local path vendor/bundle
bundle install
cd ios && bundle exec pod install
