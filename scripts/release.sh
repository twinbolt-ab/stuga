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

# Get latest tag
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")

if [[ -z "$LATEST_TAG" ]]; then
  echo -e "${YELLOW}No existing tags found. Starting from v1.0.0${NC}"
  CURRENT_VERSION="0.0.0"
else
  echo -e "${CYAN}Latest tag: $LATEST_TAG${NC}"
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

# Get commits since last tag
echo -e "${CYAN}Gathering commits...${NC}"
if [[ -z "$LATEST_TAG" ]]; then
  COMMITS=$(git log --pretty=format:"%s" --no-merges | head -50)
  COMMIT_COUNT=$(git rev-list --count HEAD)
else
  COMMITS=$(git log "${LATEST_TAG}..HEAD" --pretty=format:"%s" --no-merges)
  COMMIT_COUNT=$(git rev-list --count "${LATEST_TAG}..HEAD")
fi

if [[ -z "$COMMITS" || "$COMMIT_COUNT" -eq 0 ]]; then
  echo -e "${RED}Error: No commits since last tag${NC}"
  exit 1
fi

echo -e "Found ${BOLD}$COMMIT_COUNT${NC} commits since $LATEST_TAG"
echo ""

# Generate changelog with Claude
echo -e "${CYAN}Generating changelog with Claude...${NC}"

CHANGELOG=$(claude -p "You are writing release notes for a mobile app (iOS/Android) called Stuga - a Home Assistant dashboard.

Given these git commit messages since the last release, write a concise, user-friendly changelog.

Rules:
- Group related changes under categories if appropriate (e.g., 'Improvements', 'Bug Fixes')
- Use simple language that end users can understand
- Focus on what changed from the user's perspective, not technical details
- Keep it brief - one line per change
- Use bullet points (-)
- Don't include commit hashes or technical jargon
- If a commit is clearly internal/refactoring with no user impact, skip it

Commits:
$COMMITS

Write ONLY the changelog content, no headers or intro text:")

echo ""
echo -e "${BOLD}Generated Changelog:${NC}"
echo "─────────────────────────────────────"
echo "$CHANGELOG"
echo "─────────────────────────────────────"
echo ""

# Confirm release
echo -e "${YELLOW}This will:${NC}"
echo "  1. Update package.json version to $NEW_VERSION"
echo "  2. Commit with changelog in message"
echo "  3. Create git tag $NEW_TAG"
echo "  4. Push to GitHub (GHA will create release)"
echo ""
read -p "Proceed? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 1
fi

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
git add package.json CHANGELOG.md
if git diff --cached --quiet; then
  echo -e "${YELLOW}No changes to commit (version files may already be updated)${NC}"
  echo "Proceeding with tag creation..."
else
  git commit -m "Release $NEW_TAG" -m "CHANGELOG_START" -m "$CHANGELOG" -m "CHANGELOG_END"
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

# Push to GitHub
echo -e "${GREEN}Pushing to GitHub...${NC}"
git push origin "$CURRENT_BRANCH"
git push origin "$NEW_TAG" --force

echo ""
echo -e "${GREEN}✓ Pushed $NEW_TAG${NC}"
echo ""
echo "GitHub Actions will now create the release automatically."
echo "Watch progress: https://github.com/$(git remote get-url origin | sed -E 's/.*[:/]([^/]+\/[^/]+)(\.git)?$/\1/')/actions"
