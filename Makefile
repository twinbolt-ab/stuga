# Stuga Makefile
# Quick commands for development and releases

.PHONY: dev build release release-minor release-major ios android help

# Development
dev:
	npm run dev

build:
	npm run build

# iOS
ios:
	npm run build && npx cap sync ios && npx cap open ios

ios-run:
	npm run build && npx cap sync ios && npx cap run ios

# Android
android:
	npm run build && npx cap sync android && npx cap open android

android-run:
	npm run build && npx cap sync android && npx cap run android

android-bundle:
	npm run android:bundle

# Releases (uses Claude to generate changelog)
release:
	./scripts/release.sh patch

release-minor:
	./scripts/release.sh minor

release-major:
	./scripts/release.sh major

# Testing
test:
	npm run test

test-run:
	npm run test:run

# Linting
lint:
	npm run lint

lint-fix:
	npm run lint:fix

format:
	npm run format

# Help
help:
	@echo "Stuga Development Commands"
	@echo ""
	@echo "Development:"
	@echo "  make dev          - Start dev server"
	@echo "  make build        - Build for production"
	@echo ""
	@echo "iOS:"
	@echo "  make ios          - Build and open Xcode"
	@echo "  make ios-run      - Build and run on device/simulator"
	@echo ""
	@echo "Android:"
	@echo "  make android      - Build and open Android Studio"
	@echo "  make android-run  - Build and run on device/emulator"
	@echo "  make android-bundle - Build release AAB"
	@echo ""
	@echo "Releases:"
	@echo "  make release        - Patch release (1.0.0 → 1.0.1)"
	@echo "  make release-minor  - Minor release (1.0.0 → 1.1.0)"
	@echo "  make release-major  - Major release (1.0.0 → 2.0.0)"
	@echo ""
	@echo "Testing:"
	@echo "  make test         - Run tests in watch mode"
	@echo "  make test-run     - Run tests once"
	@echo "  make lint         - Check for lint errors"
	@echo "  make lint-fix     - Fix lint errors"
	@echo "  make format       - Format code with Prettier"
