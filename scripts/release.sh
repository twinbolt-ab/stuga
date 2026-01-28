#!/bin/bash
set -e

# Release script for Stuga
# Usage: ./scripts/release.sh [patch|minor|major]
#
# This script:
# 1. Determines the next version based on bump type
# 2. Uses Claude to generate a human-readable changelog
# 3. Updates package.json version and CHANGELOG.md
# 4. Creates a git tag with changelog in message
# 5. Pushes to GitHub (GHA will create the release)

BUMP_TYPE="${1:-patch}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

cd "$PROJECT_DIR"

# Validate bump type
if [[ ! "$BUMP_TYPE" =~ ^(patch|minor|major)$ ]]; then
  echo -e "${RED}Error: Invalid bump type '$BUMP_TYPE'${NC}"
  echo "Usage: ./scripts/release.sh [patch|minor|major]"
  exit 1
fi

# Check for uncommitted changes
if [[ -n $(git status --porcelain) ]]; then
  echo -e "${RED}Error: Working directory has uncommitted changes${NC}"
  echo "Please commit or stash your changes before releasing."
  exit 1
fi

# Check we're on main branch
CURRENT_BRANCH=$(git branch --show-current)
if [[ "$CURRENT_BRANCH" != "main" ]]; then
  echo -e "${YELLOW}Warning: Not on main branch (currently on '$CURRENT_BRANCH')${NC}"
  read -p "Continue anyway? (y/N) " -n 1 -r
  echo
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    exit 1
  fi
fi

# Get latest successful GitHub release (not just tag)
LATEST_RELEASE=$(gh release list --limit 1 --json tagName -q '.[0].tagName' 2>/dev/null || echo "")
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

if [[ -z "$LATEST_TAG" ]]; then
  echo -e "${YELLOW}No existing tags found. Starting from v1.0.0${NC}"
  CURRENT_VERSION="0.0.0"
else
  echo -e "${CYAN}Latest tag: $LATEST_TAG${NC}"
  if [[ -n "$LATEST_RELEASE" && "$LATEST_RELEASE" != "$LATEST_TAG" ]]; then
    echo -e "${YELLOW}Latest successful release: $LATEST_RELEASE (will use for changelog)${NC}"
  fi
  CURRENT_VERSION="${LATEST_TAG#v}"
fi

# Parse version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT_VERSION"

# Bump version
case "$BUMP_TYPE" in
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    ;;
  minor)
    MINOR=$((MINOR + 1))
    PATCH=0
    ;;
  patch)
    PATCH=$((PATCH + 1))
    ;;
esac

NEW_VERSION="$MAJOR.$MINOR.$PATCH"
NEW_TAG="v$NEW_VERSION"

echo -e "${GREEN}Bumping version: ${CURRENT_VERSION} → ${NEW_VERSION}${NC}"
echo ""

# Get commits since last successful release (not just last tag)
echo -e "${CYAN}Gathering commits...${NC}"
CHANGELOG_BASE="${LATEST_RELEASE:-$LATEST_TAG}"

if [[ -z "$CHANGELOG_BASE" ]]; then
  COMMITS=$(git log --pretty=format:"%s" --no-merges | head -50)
  COMMIT_COUNT=$(git rev-list --count HEAD)
  echo -e "Found ${BOLD}$COMMIT_COUNT${NC} commits (no previous release)"
else
  COMMITS=$(git log "${CHANGELOG_BASE}..HEAD" --pretty=format:"%s" --no-merges)
  COMMIT_COUNT=$(git rev-list --count "${CHANGELOG_BASE}..HEAD")
  echo -e "Found ${BOLD}$COMMIT_COUNT${NC} commits since $CHANGELOG_BASE"
fi

if [[ -z "$COMMITS" || "$COMMIT_COUNT" -eq 0 ]]; then
  echo -e "${RED}Error: No commits since last release${NC}"
  exit 1
fi
echo ""

# Generate announcement with Claude
echo -e "${CYAN}Generating release announcement with Claude...${NC}"

CHANGELOG=$(claude -p "You are writing a release announcement for Stuga, a Home Assistant dashboard app for iOS and Android.

Given these git commit messages since the last release, write a friendly release announcement for app store users.

Format:
1. Start with a brief, conversational intro sentence summarizing what's in this release
2. Then list the changes using bullet points (-)

Rules:
- Use simple language that end users can understand
- Focus on what changed from the user's perspective, not technical details
- Keep it brief - one line per change
- Don't include commit hashes or technical jargon
- If a commit is clearly internal/refactoring with no user impact, skip it
- Group related changes under categories if appropriate (e.g., '**Improvements**', '**Bug Fixes**')

Commits:
$COMMITS

Write ONLY the announcement text:")

echo ""
echo -e "${BOLD}Generated Announcement:${NC}"
echo "─────────────────────────────────────"
echo "$CHANGELOG"
echo "─────────────────────────────────────"
echo ""

# Changelog options
SKIP_PUSH=false
SILENT_RELEASE=false

while true; do
  echo -e "${YELLOW}Options:${NC}"
  echo "  [y] Proceed with this changelog"
  echo "  [e] Edit changelog in \$EDITOR"
  echo "  [r] Regenerate changelog"
  echo "  [p] Use previous release's changelog"
  echo "  [c] Commit only (no push - for manual edits)"
  echo "  [s] Silent release (no GitHub Discussion announcement)"
  echo "  [n] Abort"
  echo ""
  read -p "Choice: " -n 1 -r
  echo

  case $REPLY in
    y|Y)
      break
      ;;
    e|E)
      # Save to temp file for editing
      TEMP_CHANGELOG=$(mktemp).md
      echo "$CHANGELOG" > "$TEMP_CHANGELOG"
      # Try editors in order of preference
      if command -v code &> /dev/null; then
        echo -e "${CYAN}Opening in VS Code - close the tab (Cmd+W) when done${NC}"
        code --wait "$TEMP_CHANGELOG"
      elif command -v nano &> /dev/null; then
        nano "$TEMP_CHANGELOG"
      elif command -v vim &> /dev/null; then
        vim "$TEMP_CHANGELOG"
      else
        echo -e "${RED}No editor found. Install VS Code, nano or vim${NC}"
        rm "$TEMP_CHANGELOG"
        continue
      fi
      CHANGELOG=$(cat "$TEMP_CHANGELOG")
      rm "$TEMP_CHANGELOG"
      echo ""
      echo -e "${BOLD}Updated Changelog:${NC}"
      echo "─────────────────────────────────────"
      echo "$CHANGELOG"
      echo "─────────────────────────────────────"
      echo ""
      ;;
    r|R)
      echo -e "${CYAN}Regenerating announcement...${NC}"
      CHANGELOG=$(claude -p "You are writing a release announcement for Stuga, a Home Assistant dashboard app for iOS and Android.

Given these git commit messages since the last release, write a friendly release announcement for app store users.

Format:
1. Start with a brief, conversational intro sentence summarizing what's in this release
2. Then list the changes using bullet points (-)

Rules:
- Use simple language that end users can understand
- Focus on what changed from the user's perspective, not technical details
- Keep it brief - one line per change
- Don't include commit hashes or technical jargon
- If a commit is clearly internal/refactoring with no user impact, skip it
- Group related changes under categories if appropriate (e.g., '**Improvements**', '**Bug Fixes**')

Commits:
$COMMITS

Write ONLY the announcement text:")
      echo ""
      echo -e "${BOLD}Regenerated Announcement:${NC}"
      echo "─────────────────────────────────────"
      echo "$CHANGELOG"
      echo "─────────────────────────────────────"
      echo ""
      ;;
    p|P)
      # Get changelog from previous release (skip header, remove footer)
      PREV_CHANGELOG=$(gh release view "$LATEST_RELEASE" --json body -q .body 2>/dev/null | sed '1,/^$/d' | sed '/^\*\*Full Changelog/,$d' | sed '/^[[:space:]]*$/d')
      if [[ -n "$PREV_CHANGELOG" ]]; then
        CHANGELOG="$PREV_CHANGELOG"
        echo ""
        echo -e "${BOLD}Previous Release Changelog:${NC}"
        echo "─────────────────────────────────────"
        echo "$CHANGELOG"
        echo "─────────────────────────────────────"
        echo ""
      else
        echo -e "${RED}Could not fetch previous changelog${NC}"
      fi
      ;;
    c|C)
      SKIP_PUSH=true
      echo -e "${YELLOW}Will commit and tag but NOT push. You can push manually after review.${NC}"
      break
      ;;
    s|S)
      SILENT_RELEASE=true
      echo -e "${YELLOW}Silent release - no Discussion announcement will be created.${NC}"
      break
      ;;
    n|N)
      echo "Aborted."
      exit 1
      ;;
    *)
      echo "Invalid option"
      ;;
  esac
done

# Update package.json version
echo -e "${GREEN}Updating package.json...${NC}"
node -e "
const fs = require('fs');
const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
pkg.version = '$NEW_VERSION';
fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2) + '\n');
"

# Update CHANGELOG.md
echo -e "${GREEN}Updating CHANGELOG.md...${NC}"
CHANGELOG_FILE="CHANGELOG.md"
RELEASE_DATE=$(date +%Y-%m-%d)
NEW_ENTRY="## [$NEW_VERSION] - $RELEASE_DATE

$CHANGELOG
"

if [[ -f "$CHANGELOG_FILE" ]]; then
  # Prepend new entry after the header (first line)
  HEADER=$(head -1 "$CHANGELOG_FILE")
  EXISTING=$(tail -n +2 "$CHANGELOG_FILE")
  echo "$HEADER" > "$CHANGELOG_FILE"
  echo "" >> "$CHANGELOG_FILE"
  echo "$NEW_ENTRY" >> "$CHANGELOG_FILE"
  echo "$EXISTING" >> "$CHANGELOG_FILE"
else
  # Create new changelog file
  cat > "$CHANGELOG_FILE" << EOF
# Changelog

$NEW_ENTRY
EOF
fi

# Generate SEO-optimized web changelog JSON
echo -e "${GREEN}Generating SEO-optimized web changelog...${NC}"
"$SCRIPT_DIR/generate-seo-changelog.sh"

# Update Android version (not tracked in git, but updated locally for native builds)
echo -e "${GREEN}Updating Android version...${NC}"
ANDROID_BUILD_GRADLE="android/app/build.gradle"
if [[ -f "$ANDROID_BUILD_GRADLE" ]]; then
  # Extract current versionCode and increment it
  CURRENT_VERSION_CODE=$(grep -o 'versionCode [0-9]*' "$ANDROID_BUILD_GRADLE" | grep -o '[0-9]*')
  NEW_VERSION_CODE=$((CURRENT_VERSION_CODE + 1))

  # Update versionCode and versionName
  sed -i '' "s/versionCode $CURRENT_VERSION_CODE/versionCode $NEW_VERSION_CODE/" "$ANDROID_BUILD_GRADLE"
  sed -i '' "s/versionName \"[^\"]*\"/versionName \"$NEW_VERSION\"/" "$ANDROID_BUILD_GRADLE"
  echo "  Android: versionCode $NEW_VERSION_CODE, versionName $NEW_VERSION"
else
  echo "  Android: build.gradle not found, skipping"
fi

# Create fastlane changelog for Play Store (uses versionCode as filename)
echo -e "${GREEN}Creating Play Store changelog...${NC}"
FASTLANE_CHANGELOG_DIR="android-overrides/fastlane/metadata/android/en-US/changelogs"
mkdir -p "$FASTLANE_CHANGELOG_DIR"

# Generate a simpler, plain-text changelog for Play Store (no markdown headers, 500 char limit)
PLAY_STORE_CHANGELOG=$(claude -p "Convert this changelog to a simple plain-text format for Google Play Store.

Rules:
- NO headers or categories (remove 'Improvements', 'Bug Fixes', etc.)
- Just a simple bullet list using • character
- Keep it under 500 characters total
- Focus on the most important user-facing changes
- Simple, friendly language

Input:
$CHANGELOG

Output only the plain-text changelog:")

echo "$PLAY_STORE_CHANGELOG" > "$FASTLANE_CHANGELOG_DIR/$NEW_VERSION_CODE.txt"
echo "  Play Store changelog: changelogs/$NEW_VERSION_CODE.txt"

# Create iOS release notes (App Store uses release_notes.txt, not versioned files)
echo -e "${GREEN}Creating App Store release notes...${NC}"
IOS_METADATA_DIR="ios-overrides/App/fastlane/metadata/en-US"
if [[ -d "$IOS_METADATA_DIR" ]]; then
  echo "$PLAY_STORE_CHANGELOG" > "$IOS_METADATA_DIR/release_notes.txt"
  echo "  App Store release notes: metadata/en-US/release_notes.txt"
fi

# Update iOS version (not tracked in git, but updated locally for native builds)
echo -e "${GREEN}Updating iOS version...${NC}"
IOS_PROJECT="ios/App/App.xcodeproj/project.pbxproj"
if [[ -f "$IOS_PROJECT" ]]; then
  # Extract current CURRENT_PROJECT_VERSION and increment it
  CURRENT_BUILD=$(grep -o 'CURRENT_PROJECT_VERSION = [0-9]*' "$IOS_PROJECT" | head -1 | grep -o '[0-9]*')
  NEW_BUILD=$((CURRENT_BUILD + 1))

  # Update CURRENT_PROJECT_VERSION and MARKETING_VERSION
  sed -i '' "s/CURRENT_PROJECT_VERSION = $CURRENT_BUILD;/CURRENT_PROJECT_VERSION = $NEW_BUILD;/g" "$IOS_PROJECT"
  sed -i '' "s/MARKETING_VERSION = [^;]*;/MARKETING_VERSION = $NEW_VERSION;/g" "$IOS_PROJECT"
  echo "  iOS: CURRENT_PROJECT_VERSION $NEW_BUILD, MARKETING_VERSION $NEW_VERSION"
else
  echo "  iOS: project.pbxproj not found, skipping"
fi

# Commit with changelog in message body
# Using a special format that GHA can parse
git add package.json CHANGELOG.md web/src/content/changelog.json android-overrides/fastlane/metadata/android/en-US/changelogs/ ios-overrides/App/fastlane/metadata/en-US/release_notes.txt
if git diff --cached --quiet; then
  echo -e "${YELLOW}No changes to commit (version files may already be updated)${NC}"
  echo "Proceeding with tag creation..."
else
  git commit -m "Release $NEW_TAG" -m "$CHANGELOG"
fi

# Create annotated tag (or update if it exists on current commit)
echo -e "${GREEN}Creating tag $NEW_TAG...${NC}"
if git rev-parse "$NEW_TAG" >/dev/null 2>&1; then
  EXISTING_TAG_COMMIT=$(git rev-list -n 1 "$NEW_TAG")
  CURRENT_COMMIT=$(git rev-parse HEAD)
  if [[ "$EXISTING_TAG_COMMIT" == "$CURRENT_COMMIT" ]]; then
    echo -e "${YELLOW}Tag $NEW_TAG already exists on current commit, skipping tag creation${NC}"
  else
    echo -e "${YELLOW}Tag $NEW_TAG exists on different commit, deleting and recreating...${NC}"
    git tag -d "$NEW_TAG"
    git tag -a "$NEW_TAG" -m "Release $NEW_TAG" -m "" -m "$CHANGELOG"
  fi
else
  git tag -a "$NEW_TAG" -m "Release $NEW_TAG" -m "" -m "$CHANGELOG"
fi

# Push to GitHub (unless skipped)
if [[ "$SKIP_PUSH" == "true" ]]; then
  echo ""
  echo -e "${GREEN}✓ Created commit and tag $NEW_TAG locally${NC}"
  echo ""
  echo "To complete the release, run:"
  echo "  git push origin $CURRENT_BRANCH && git push origin $NEW_TAG --force"
else
  echo -e "${GREEN}Pushing to GitHub...${NC}"

  # For silent releases, add a marker to the tag message
  if [[ "$SILENT_RELEASE" == "true" ]]; then
    git tag -d "$NEW_TAG" 2>/dev/null
    git tag -a "$NEW_TAG" -m "Release $NEW_TAG" -m "SILENT_RELEASE" -m "$CHANGELOG"
  fi

  git push origin "$CURRENT_BRANCH"
  git push origin "$NEW_TAG" --force

  echo ""
  echo -e "${GREEN}✓ Pushed $NEW_TAG${NC}"
  echo ""
  if [[ "$SILENT_RELEASE" == "true" ]]; then
    echo "Silent release - no Discussion announcement will be created."
  fi
  echo "GitHub Actions will now create the release automatically."
  REPO_URL=$(gh repo view --json url -q .url 2>/dev/null || git remote get-url origin | sed -E 's/.*[:/]([^/]+\/[^/]+)(\.git)?$/https:\/\/github.com\/\1/')
  echo "Watch progress: ${REPO_URL}/actions"
fi
