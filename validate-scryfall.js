#!/usr/bin/env node

/**
 * Validates Scryfall links in markdown files against the Scryfall API
 * Ensures card names match and URLs are correct
 */

const fs = require('fs');
const https = require('https');
const path = require('path');

// Rate limiting: 50-100ms between requests
const DELAY_MS = 75;

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchCard(cardName) {
  return new Promise((resolve, reject) => {
    // Handle special cases
    if (cardName.includes('—') || cardName.includes('Blue Farm')) {
      // Extract card name from deck names like "Blue Farm — Kraum, Ludevic's Opus"
      const parts = cardName.split(/[—–-]/);
      if (parts.length > 1) {
        cardName = parts[parts.length - 1].trim();
      }
    }
    
    const encodedName = encodeURIComponent(cardName);
    const url = `https://api.scryfall.com/cards/named?exact=${encodedName}`;
    
    const options = {
      headers: {
        'User-Agent': 'RhysticGamingBlog/1.0',
        'Accept': 'application/json'
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const card = JSON.parse(data);
            resolve(card);
          } catch (e) {
            reject(new Error(`Failed to parse JSON: ${e.message}`));
          }
        } else if (res.statusCode === 404) {
          // Try fuzzy search
          const fuzzyUrl = `https://api.scryfall.com/cards/search?q=${encodedName}`;
          https.get(fuzzyUrl, options, (fuzzyRes) => {
            let fuzzyData = '';
            fuzzyRes.on('data', (chunk) => { fuzzyData += chunk; });
            fuzzyRes.on('end', () => {
              if (fuzzyRes.statusCode === 200) {
                try {
                  const result = JSON.parse(fuzzyData);
                  if (result.data && result.data.length > 0) {
                    // For short names like "Kefka", try to find the most relevant match
                    const matches = result.data.filter(c => 
                      c.name.toLowerCase().includes(cardName.toLowerCase()) ||
                      cardName.toLowerCase().includes(c.name.toLowerCase().split(',')[0])
                    );
                    resolve(matches.length > 0 ? matches[0] : result.data[0]);
                  } else {
                    reject(new Error(`Card not found: ${cardName}`));
                  }
                } catch (e) {
                  reject(new Error(`Failed to parse fuzzy search: ${e.message}`));
                }
              } else {
                reject(new Error(`Card not found: ${cardName} (${fuzzyRes.statusCode})`));
              }
            });
          }).on('error', reject);
        } else {
          reject(new Error(`API error: ${res.statusCode}`));
        }
      });
    }).on('error', reject);
  });
}

function extractScryfallLinks(content) {
  const linkRegex = /\[([^\]]+)\]\(https:\/\/scryfall\.com\/card\/([^\)]+)\)/g;
  const links = [];
  let match;
  
  while ((match = linkRegex.exec(content)) !== null) {
    links.push({
      fullMatch: match[0],
      cardName: match[1],
      urlPath: match[2],
      index: match.index
    });
  }
  
  return links;
}

function getScryfallUrl(card) {
  // Use the scryfall_uri which is the canonical URL, but remove utm_source parameter
  // Format: https://scryfall.com/card/{set}/{collector_number}/{name-slug}
  if (card.scryfall_uri) {
    return card.scryfall_uri.split('?')[0]; // Remove query parameters
  }
  
  // Fallback: construct from card data
  const set = card.set;
  const collectorNumber = card.collector_number;
  const nameSlug = card.name.toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  
  return `https://scryfall.com/card/${set}/${collectorNumber}/${nameSlug}`;
}

function expandAliases(content) {
  // Define aliases for common deck/commander pairs
  const aliases = [
    // Rog/Si = Rograkh, Son of Rohgahh / Silas Renn, Seeker Adept
    {
      pattern: /\bRog\/Si\b/g,
      replacement: '[Rograkh, Son of Rohgahh](https://scryfall.com/card/cmr/197/rograkh-son-of-rohgahh) / [Silas Renn, Seeker Adept](https://scryfall.com/card/c16/43/silas-renn-seeker-adept)',
      name: 'Rog/Si'
    },
    
    // BlueFarm, Blue Farm, BF, TnK = Tymna the Weaver / Kraum, Ludevic's Opus
    {
      pattern: /\bBlueFarm\b/g,
      replacement: '[Tymna the Weaver](https://scryfall.com/card/c16/48/tymna-the-weaver) / [Kraum, Ludevic\'s Opus](https://scryfall.com/card/c16/34/kraum-ludevics-opus)',
      name: 'BlueFarm'
    },
    {
      pattern: /\bBlue Farm\b/g,
      replacement: '[Tymna the Weaver](https://scryfall.com/card/c16/48/tymna-the-weaver) / [Kraum, Ludevic\'s Opus](https://scryfall.com/card/c16/34/kraum-ludevics-opus)',
      name: 'Blue Farm'
    },
    {
      // BF but only as a standalone word, not inside other words
      // Use negative lookbehind and lookahead to ensure it's not part of a word
      pattern: /(?<![A-Za-z])\bBF\b(?![A-Za-z])/g,
      replacement: '[Tymna the Weaver](https://scryfall.com/card/c16/48/tymna-the-weaver) / [Kraum, Ludevic\'s Opus](https://scryfall.com/card/c16/34/kraum-ludevics-opus)',
      name: 'BF'
    },
    {
      pattern: /\bTnK\b/g,
      replacement: '[Tymna the Weaver](https://scryfall.com/card/c16/48/tymna-the-weaver) / [Kraum, Ludevic\'s Opus](https://scryfall.com/card/c16/34/kraum-ludevics-opus)',
      name: 'TnK'
    },
  ];
  
  let expandedContent = content;
  let expandedCount = 0;
  
  // Replace aliases that appear as standalone words (not already in links)
  // Check if the match is not inside a markdown link
  for (const alias of aliases) {
    // Create a new regex for each iteration to avoid state issues
    const pattern = new RegExp(alias.pattern.source, alias.pattern.flags);
    const matches = [];
    let match;
    
    // Find all matches in original content
    while ((match = pattern.exec(content)) !== null) {
      const start = match.index;
      
      // Check if this match is inside a markdown link [text](url)
      // Look for the pattern [ ... ]( ... ) around this position
      const beforeMatch = content.substring(0, start);
      const afterMatch = content.substring(start + match[0].length);
      
      // Find the nearest brackets and parens
      const lastOpenBracket = beforeMatch.lastIndexOf('[');
      const lastCloseBracket = beforeMatch.lastIndexOf(']');
      const nextCloseBracket = afterMatch.indexOf(']');
      const lastOpenParen = beforeMatch.lastIndexOf('(');
      const lastCloseParen = beforeMatch.lastIndexOf(')');
      const nextCloseParen = afterMatch.indexOf(')');
      
      // We're in a link if:
      // 1. We're between [ and ] (link text)
      // 2. We're between ( and ) that comes after a ] (link URL)
      const isInLinkText = lastOpenBracket > lastCloseBracket;
      const isInLinkUrl = lastCloseBracket > lastOpenBracket && 
                         lastOpenParen > lastCloseBracket && 
                         (lastCloseParen < start || (nextCloseParen >= 0 && lastOpenParen < start));
      
      const isInLink = isInLinkText || isInLinkUrl;
      
      if (!isInLink) {
        matches.push({ index: start, length: match[0].length });
      }
    }
    
    if (matches.length > 0) {
      // Replace matches in reverse order to preserve indices
      for (let i = matches.length - 1; i >= 0; i--) {
        const m = matches[i];
        expandedContent = expandedContent.substring(0, m.index) + 
                          alias.replacement + 
                          expandedContent.substring(m.index + m.length);
      }
      expandedCount += matches.length;
      console.log(`  Expanded ${matches.length} instance(s) of "${alias.name}"`);
    }
  }
  
  if (expandedCount > 0) {
    console.log(`  ✓ Expanded ${expandedCount} alias(es) total`);
  }
  
  return { content: expandedContent, count: expandedCount };
}

async function validateFile(filePath) {
  console.log(`\nValidating: ${filePath}`);
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Expand aliases first
  console.log('  Expanding aliases...');
  const aliasResult = expandAliases(content);
  content = aliasResult.content;
  const expandedCount = aliasResult.count;
  
  const links = extractScryfallLinks(content);
  
  if (links.length === 0) {
    console.log('  No Scryfall links found');
    return { file: filePath, fixed: 0, errors: [] };
  }
  
  console.log(`  Found ${links.length} Scryfall link(s)`);
  
  let newContent = content;
  let fixed = 0;
  const errors = [];
  
  // Process links in reverse order to preserve indices
  for (let i = links.length - 1; i >= 0; i--) {
    const link = links[i];
    await delay(DELAY_MS);
    
    try {
      console.log(`  Checking: "${link.cardName}"...`);
      const card = await fetchCard(link.cardName);
      const correctUrl = getScryfallUrl(card);
      const correctPath = correctUrl.replace('https://scryfall.com/card/', '');
      
      // Check if URL matches
      if (link.urlPath !== correctPath) {
        const newLink = `[${link.cardName}](${correctUrl})`;
        newContent = newContent.substring(0, link.index) + 
                    newLink + 
                    newContent.substring(link.index + link.fullMatch.length);
        console.log(`    ✓ Fixed: ${link.urlPath} → ${correctPath}`);
        fixed++;
      } else {
        console.log(`    ✓ Correct: ${link.cardName}`);
      }
    } catch (error) {
      console.log(`    ✗ Error: ${error.message}`);
      errors.push({ card: link.cardName, error: error.message });
    }
  }
  
  // Write back the content (with aliases expanded and links fixed)
  // Always write if aliases were expanded, or if links were fixed
  if (expandedCount > 0 || fixed > 0) {
    fs.writeFileSync(filePath, newContent, 'utf8');
    if (expandedCount > 0) {
      console.log(`  ✓ File updated with ${expandedCount} alias expansion(s)`);
    }
    if (fixed > 0) {
      console.log(`  ✓ File updated with ${fixed} link fix(es)`);
    }
  }
  
  return { file: filePath, fixed, errors, aliasesExpanded: expandedCount };
}

async function main() {
  const args = process.argv.slice(2);
  const files = args.length > 0 ? args : ['src/posts/report-1.md'];
  
  console.log('Scryfall Link Validator');
  console.log('======================');
  
  const results = [];
  for (const file of files) {
    if (fs.existsSync(file)) {
      const result = await validateFile(file);
      results.push(result);
    } else {
      console.log(`\nFile not found: ${file}`);
    }
  }
  
  console.log('\n\nSummary:');
  console.log('========');
  let totalFixed = 0;
  let totalErrors = 0;
  
  results.forEach(result => {
    console.log(`${result.file}: ${result.fixed} fixed, ${result.errors.length} errors`);
    totalFixed += result.fixed;
    totalErrors += result.errors.length;
    
    if (result.errors.length > 0) {
      result.errors.forEach(err => {
        console.log(`  - ${err.card}: ${err.error}`);
      });
    }
  });
  
  console.log(`\nTotal: ${totalFixed} link(s) fixed, ${totalErrors} error(s)`);
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = { validateFile, extractScryfallLinks, fetchCard };

