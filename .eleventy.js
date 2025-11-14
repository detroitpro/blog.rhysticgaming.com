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

  // Shortcode for embedding Moxfield deck lists
  // Usage: {% moxfield "deck-id" %} or {% moxfield "deck-id" "sortBy=manaCost&hideTotal=true" %}
  eleventyConfig.addShortcode("moxfield", function(deckId, params = "") {
    // Generate unique ID for this iframe instance
    const frameId = `moxfield-frame-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Build the embed URL
    let embedUrl = `https://moxfield.com/embed/${deckId}`;
    if (params) {
      embedUrl += `?${params}`;
    }
    
    // Return the iframe HTML with auto-sizing support
    return `<div class="moxfield-deck-embed">
      <iframe 
        src="${embedUrl}" 
        id="${frameId}" 
        frameBorder="0" 
        width="100%" 
        class="moxfield-iframe"
        onload="moxfieldOnLoad(event)"
        loading="lazy"
        allow="clipboard-read; clipboard-write"
        title="Moxfield Deck List">
      </iframe>
    </div>`;
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

