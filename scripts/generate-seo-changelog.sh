#!/bin/bash
# Generates SEO-optimized changelog summaries for the web using the SEO visibility expert agent
# Usage: ./scripts/generate-seo-changelog.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
CHANGELOG_FILE="$PROJECT_DIR/CHANGELOG.md"
OUTPUT_FILE="$PROJECT_DIR/web/src/content/changelog.json"

# Colors
GREEN='\033[0;32m'
CYAN='\033[0;36m'
NC='\033[0m'

cd "$PROJECT_DIR"

echo -e "${CYAN}Reading CHANGELOG.md...${NC}"

# Read the changelog
CHANGELOG_CONTENT=$(cat "$CHANGELOG_FILE")

echo -e "${CYAN}Generating SEO-optimized changelog with SEO visibility expert...${NC}"

# Use Claude with the SEO agent context to generate optimized JSON
SEO_PROMPT="You are the SEO visibility expert for Stuga, a Home Assistant dashboard app.

## Your Task
Convert this CHANGELOG.md into a JSON format optimized for web SEO. Each release needs:
1. \`summary\` - The original user-friendly summary (keep as-is from the markdown)
2. \`seoSummary\` - An SEO-optimized version that naturally includes keywords

## SEO Keywords to Include (where relevant)
- \"Home Assistant\" - MUST appear in most seoSummary entries
- \"dashboard\", \"smart home\", \"mobile app\"
- Device types: lights, sensors, switches, climate, temperature, humidity
- Platforms: iOS, Android
- Actions: control, manage, organize, customize

## Stuga's Differentiators (emphasize when relevant)
- Mobile-first design
- No YAML configuration needed
- Real-time updates
- Touch-friendly interface
- Scandinavian minimal aesthetic

## Output Format
Return ONLY valid JSON (no markdown, no explanation):
{
  \"releases\": [
    {
      \"version\": \"X.X.X\",
      \"date\": \"YYYY-MM-DD\",
      \"summary\": \"original summary from changelog\",
      \"seoSummary\": \"SEO-optimized version with keywords\",
      \"sections\": [
        { \"title\": \"Category\", \"items\": [\"item1\", \"item2\"] }
      ]
    }
  ]
}

## Rules for seoSummary
- Keep it natural and readable - no keyword stuffing
- 1-2 sentences max
- Start with action words when possible
- Include \"Home Assistant\" in at least 80% of entries
- Mention specific device types when the release relates to them

## CHANGELOG.md Content:
$CHANGELOG_CONTENT

Generate the JSON now:"

# Generate with Claude
RAW_OUTPUT=$(claude -p "$SEO_PROMPT")

# Strip markdown code fences if present
JSON_OUTPUT=$(echo "$RAW_OUTPUT" | sed '/^```/d')

# Validate JSON and write
if echo "$JSON_OUTPUT" | python3 -m json.tool > /dev/null 2>&1; then
  echo "$JSON_OUTPUT" > "$OUTPUT_FILE"
  echo -e "${GREEN}Generated $OUTPUT_FILE${NC}"

  # Count releases
  RELEASE_COUNT=$(echo "$JSON_OUTPUT" | python3 -c "import json,sys; print(len(json.load(sys.stdin)['releases']))")
  echo -e "${GREEN}Contains $RELEASE_COUNT releases with SEO-optimized summaries${NC}"
else
  echo "Error: Claude output is not valid JSON"
  echo "Output was:"
  echo "$JSON_OUTPUT"
  exit 1
fi
