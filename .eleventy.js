module.exports = function(eleventyConfig) {
  // Copy static assets
  eleventyConfig.addPassthroughCopy("src/css");
  eleventyConfig.addPassthroughCopy("src/images");
  eleventyConfig.addPassthroughCopy("src/js");
  eleventyConfig.addPassthroughCopy("src/CNAME");

  // Add a filter for date formatting (display)
  eleventyConfig.addFilter("dateDisplay", (date) => {
    return new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric"
    });
  });

  // Add a filter for date formatting (ISO)
  eleventyConfig.addFilter("date", (date, format) => {
    const d = new Date(date);
    if (format === '%Y-%m-%d') {
      return d.toISOString().split('T')[0];
    }
    return d.toISOString();
  });

  // Add a filter to limit array length
  eleventyConfig.addFilter("limit", (array, limit) => {
    return array.slice(0, limit);
  });

  // Filter out draft posts from collections
  eleventyConfig.addCollection("publishedPosts", function(collectionApi) {
    return collectionApi.getFilteredByTag("posts").filter(function(item) {
      // Exclude posts with draft: true
      return !item.data.draft;
    });
  });

  // Shortcode for displaying decklists from export format
  // Usage: {% decklist "Title|Description|tag1, tag2" %}
  // 1 City of Brass (MB2) 240
  // 1 Dark Ritual (SUM) 99
  // {% enddecklist %}
  // Or: {% decklist %}
  // Title: Vintage Control
  // Description: A classic control deck
  // Tags: Vintage, Control
  // ---
  // 1 City of Brass (MB2) 240
  // {% enddecklist %}
  eleventyConfig.addPairedShortcode("decklist", function(content, metadata = "") {
    let title = "";
    let description = "";
    let tags = "";
    
    // Parse metadata if provided as pipe-separated string
    if (metadata) {
      const parts = metadata.split('|');
      title = parts[0]?.trim() || "";
      description = parts[1]?.trim() || "";
      tags = parts[2]?.trim() || "";
    }
    
    // Check if content starts with metadata (Title:, Description:, Tags:)
    const contentLines = content.trim().split('\n');
    const decklistStart = contentLines.findIndex(line => /^\d+\s+/.test(line.trim()));
    
    if (decklistStart > 0) {
      const metadataLines = contentLines.slice(0, decklistStart);
      metadataLines.forEach(line => {
        const trimmed = line.trim();
        if (trimmed.startsWith('Title:')) {
          title = trimmed.substring(6).trim();
        } else if (trimmed.startsWith('Description:')) {
          description = trimmed.substring(12).trim();
        } else if (trimmed.startsWith('Tags:')) {
          tags = trimmed.substring(5).trim();
        }
      });
      content = contentLines.slice(decklistStart).join('\n');
    }
    // Parse decklist lines
    const lines = content.trim().split('\n').filter(line => line.trim());
    const deckId = `decklist-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Parse each line: "Quantity Card Name (Set Code) Collector Number"
    const cards = lines.map((line, index) => {
      const trimmed = line.trim();
      // Match: quantity, card name, optional (set code) collector number
      const match = trimmed.match(/^(\d+)\s+(.+?)(?:\s+\(([^)]+)\)\s+(\d+))?$/);
      
      if (match) {
        const quantity = parseInt(match[1], 10);
        const cardName = match[2].trim();
        const setCode = match[3] || null;
        const collectorNumber = match[4] || null;
        
        return {
          quantity,
          cardName,
          setCode,
          collectorNumber,
          line: trimmed,
          id: `${deckId}-card-${index}`
        };
      }
      
      // Fallback: try to parse without set info
      const simpleMatch = trimmed.match(/^(\d+)\s+(.+)$/);
      if (simpleMatch) {
        return {
          quantity: parseInt(simpleMatch[1], 10),
          cardName: simpleMatch[2].trim(),
          setCode: null,
          collectorNumber: null,
          line: trimmed,
          id: `${deckId}-card-${index}`
        };
      }
      
      return null;
    }).filter(card => card !== null);
    
    // Group cards by name for display
    const groupedCards = {};
    cards.forEach(card => {
      if (!groupedCards[card.cardName]) {
        groupedCards[card.cardName] = {
          ...card,
          totalQuantity: 0
        };
      }
      groupedCards[card.cardName].totalQuantity += card.quantity;
    });
    
    const cardList = Object.values(groupedCards);
    
    // Parse tags
    const tagList = tags ? tags.split(',').map(t => t.trim()).filter(t => t) : [];
    
    // Generate HTML
    let html = `<div class="decklist-container" data-decklist-id="${deckId}">`;
    
    // Deck header (title, description, tags)
    if (title || description || tagList.length > 0) {
      html += '<div class="decklist-header">';
      if (title) {
        html += `<h3 class="decklist-title">${title}</h3>`;
      }
      if (description) {
        html += `<p class="decklist-description">${description}</p>`;
      }
      if (tagList.length > 0) {
        html += '<div class="decklist-tags">';
        tagList.forEach(tag => {
          html += `<span class="decklist-tag">${tag}</span>`;
        });
        html += '</div>';
      }
      html += '</div>';
    }
    
    // Two-column layout
    html += '<div class="decklist-layout">';
    
    // Left column: Single card image
    html += '<div class="decklist-image-column">';
    html += '<div class="decklist-card-display">';
    html += '<div class="decklist-card-image-wrapper">';
    html += '<img class="decklist-card-display-image" src="" alt="Select a card" />';
    html += '<div class="decklist-card-display-loading">Select a card to view</div>';
    html += '</div>';
    html += '<div class="decklist-card-display-info" style="display: none;">';
    html += '<div class="decklist-card-display-type"></div>';
    html += '<div class="decklist-card-display-text"></div>';
    html += '</div>';
    html += '</div>';
    html += '</div>';
    
    // Right column: Card list grouped by type
    html += '<div class="decklist-list-column">';
    html += `<div class="decklist-groups" data-decklist-id="${deckId}">`;
    
    // We'll group by type in JavaScript after fetching card data
    // For now, create a single list that will be organized by type
    cardList.forEach(card => {
      html += `<div class="decklist-card-item" data-card-name="${card.cardName.replace(/"/g, '&quot;')}" data-set-code="${card.setCode || ''}" data-collector-number="${card.collectorNumber || ''}" data-quantity="${card.totalQuantity}">`;
      html += `<span class="decklist-card-item-quantity">${card.totalQuantity}</span>`;
      html += `<span class="decklist-card-item-name">${card.cardName}</span>`;
      html += `</div>`;
    });
    
    html += '</div></div></div></div>';
    
    return html;
  });

  // Transform to convert [[Card Name]] syntax to clickable card links
  eleventyConfig.addTransform("cardLinks", function(content, outputPath) {
    // Only process HTML files (posts)
    if (outputPath && outputPath.endsWith(".html")) {
      // Match [[Card Name]] but not if it's already inside a link or code block
      // This regex finds [[Card Name]] that's not inside <a>, <code>, or <pre> tags
      const cardLinkRegex = /\[\[([^\]]+)\]\]/g;
      
      return content.replace(cardLinkRegex, (match, cardName) => {
        // Check if we're inside a link, code block, or pre block
        const beforeMatch = content.substring(0, content.indexOf(match));
        const afterMatch = content.substring(content.indexOf(match) + match.length);
        
        // Simple check: if there's an unclosed <a> tag before, we're in a link
        const lastOpenLink = beforeMatch.lastIndexOf('<a ');
        const lastCloseLink = beforeMatch.lastIndexOf('</a>');
        const isInLink = lastOpenLink > lastCloseLink;
        
        // Check if in code/pre block
        const lastOpenCode = Math.max(
          beforeMatch.lastIndexOf('<code'),
          beforeMatch.lastIndexOf('<pre')
        );
        const lastCloseCode = Math.max(
          beforeMatch.lastIndexOf('</code>'),
          beforeMatch.lastIndexOf('</pre>')
        );
        const isInCode = lastOpenCode > lastCloseCode;
        
        if (isInLink || isInCode) {
          return match; // Don't transform if inside link or code
        }
        
        // Create clickable card link
        return `<span class="card-link" data-card-name="${cardName.trim().replace(/"/g, '&quot;')}">${cardName.trim()}</span>`;
      });
    }
    return content;
  });

  // Use pathPrefix only if not using custom domain (GitHub Pages subdirectory)
  // With custom domain (CNAME), use root path
  const useSubdirectory = process.env.USE_SUBDIRECTORY === "true";
  const pathPrefix = useSubdirectory ? "/blog.rhysticgaming.com/" : "/";

  return {
    pathPrefix: pathPrefix,
    dir: {
      input: "src",
      output: "_site",
      includes: "_includes",
      layouts: "_includes/layouts",
      data: "_data"
    },
    templateFormats: ["md", "njk", "html"],
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk"
  };
};

