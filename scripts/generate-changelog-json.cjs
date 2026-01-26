#!/usr/bin/env node
/**
 * Parses CHANGELOG.md and generates web/src/content/changelog.json
 * Used by release.sh to keep the web changelog in sync
 */

const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const changelogPath = path.join(projectRoot, 'CHANGELOG.md');
const outputPath = path.join(projectRoot, 'web/src/content/changelog.json');

function parseChangelog(content) {
  const releases = [];

  // Split by version headers
  const versionPattern = /## \[(\d+\.\d+\.\d+)\] - (\d{4}-\d{2}-\d{2})/g;
  const sections = content.split(versionPattern);

  // sections[0] is the header before first version
  // Then it alternates: version, date, content, version, date, content...
  for (let i = 1; i < sections.length; i += 3) {
    const version = sections[i];
    const date = sections[i + 1];
    const body = sections[i + 2] || '';

    const release = parseReleaseBody(version, date, body.trim());
    if (release) {
      releases.push(release);
    }
  }

  return releases;
}

function parseReleaseBody(version, date, body) {
  const lines = body.split('\n').map(l => l.trim()).filter(Boolean);

  let summary = '';
  const sections = [];
  let currentSection = null;

  for (const line of lines) {
    // Section header (e.g., **Improvements**)
    const sectionMatch = line.match(/^\*\*(.+?)\*\*$/);
    if (sectionMatch) {
      if (currentSection && currentSection.items.length > 0) {
        sections.push(currentSection);
      }
      currentSection = { title: sectionMatch[1], items: [] };
      continue;
    }

    // Bullet point
    if (line.startsWith('- ')) {
      const item = line.slice(2).trim();
      if (currentSection) {
        currentSection.items.push(item);
      } else if (!summary) {
        // First bullet without a section - treat as summary
        summary = item;
      }
      continue;
    }

    // Plain text (likely summary)
    if (!summary && !line.startsWith('*')) {
      summary = line;
    }
  }

  // Add last section
  if (currentSection && currentSection.items.length > 0) {
    sections.push(currentSection);
  }

  // If no summary but we have sections, create one from first items
  if (!summary && sections.length > 0) {
    const firstItems = sections.flatMap(s => s.items).slice(0, 2);
    summary = firstItems.join('. ');
    if (summary.length > 100) {
      summary = summary.slice(0, 97) + '...';
    }
  }

  const finalSummary = summary || `Version ${version} release`;

  // Generate SEO-enhanced summary
  const seoSummary = generateSeoSummary(finalSummary, sections);

  return {
    version,
    date,
    summary: finalSummary,
    seoSummary,
    sections
  };
}

/**
 * Generates an SEO-enhanced summary by adding keywords if missing
 */
function generateSeoSummary(summary, sections) {
  const lowerSummary = summary.toLowerCase();
  const allItems = sections.flatMap(s => s.items).join(' ').toLowerCase();
  const allText = lowerSummary + ' ' + allItems;

  // Check which keywords are already present
  const hasHomeAssistant = allText.includes('home assistant');
  const hasSmartHome = allText.includes('smart home');
  const hasDashboard = allText.includes('dashboard');
  const hasApp = allText.includes('app');

  // Detect feature keywords from content
  const featureKeywords = [];
  if (allText.includes('light') || allText.includes('lamp')) featureKeywords.push('lights');
  if (allText.includes('temperature') || allText.includes('climate') || allText.includes('thermostat')) featureKeywords.push('climate');
  if (allText.includes('sensor') || allText.includes('humidity')) featureKeywords.push('sensors');
  if (allText.includes('switch')) featureKeywords.push('switches');
  if (allText.includes('room') || allText.includes('floor') || allText.includes('area')) featureKeywords.push('rooms');
  if (allText.includes('android')) featureKeywords.push('Android');
  if (allText.includes('ios') || allText.includes('iphone')) featureKeywords.push('iOS');

  // Build SEO prefix if needed
  let seoPrefix = '';
  if (!hasHomeAssistant && !hasSmartHome) {
    seoPrefix = 'Home Assistant dashboard update: ';
  } else if (!hasDashboard && !hasApp) {
    // Already mentions HA/smart home but not dashboard/app
    seoPrefix = '';
  }

  // Build SEO suffix with detected features
  let seoSuffix = '';
  if (featureKeywords.length > 0 && !lowerSummary.includes(featureKeywords[0])) {
    // Only add if the summary doesn't already mention the feature
    const uniqueFeatures = [...new Set(featureKeywords)].slice(0, 2);
    if (uniqueFeatures.length > 0 && summary.length < 120) {
      // Don't add suffix if summary is already long
    }
  }

  return seoPrefix + summary + seoSuffix;
}

// Main
try {
  const content = fs.readFileSync(changelogPath, 'utf8');
  const releases = parseChangelog(content);

  // Ensure output directory exists
  const outputDir = path.dirname(outputPath);
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  fs.writeFileSync(outputPath, JSON.stringify({ releases }, null, 2));
  console.log(`Generated ${outputPath} with ${releases.length} releases`);
} catch (err) {
  console.error('Error generating changelog JSON:', err.message);
  process.exit(1);
}
