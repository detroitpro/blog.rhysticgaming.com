/**
 * Decklist Display System
 * Two-column layout: card image on left, grouped card list on right
 * Fetches card images from Scryfall API and handles hover/click interactions
 */

(function() {
  'use strict';

  // Cache for card data (stored in localStorage)
  const CACHE_KEY = 'rhystic-gaming-card-cache';
  const CACHE_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

  // Get cache from localStorage
  function getCache() {
    try {
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn('Failed to read card cache:', e);
    }
    return {};
  }

  // Save cache to localStorage
  function saveCache(cache) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
      console.warn('Failed to save card cache:', e);
    }
  }

  // Check if cache entry is expired
  function isExpired(entry) {
    if (!entry || !entry.timestamp) return true;
    return Date.now() - entry.timestamp > CACHE_EXPIRY;
  }

  // Fetch card from Scryfall API
  async function fetchCard(cardName, setCode = null, collectorNumber = null) {
    const cache = getCache();
    const cacheKey = `${cardName.toLowerCase()}-${setCode || ''}-${collectorNumber || ''}`;
    
    // Check cache first
    if (cache[cacheKey] && !isExpired(cache[cacheKey])) {
      return cache[cacheKey].data;
    }

    let url;
    
    // If we have set code and collector number, try exact match first
    if (setCode && collectorNumber) {
      url = `https://api.scryfall.com/cards/${setCode.toLowerCase()}/${collectorNumber}`;
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'RhysticGamingBlog/1.0',
            'Accept': 'application/json'
          }
        });
        if (response.ok) {
          const cardData = await response.json();
          cache[cacheKey] = {
            data: cardData,
            timestamp: Date.now()
          };
          saveCache(cache);
          return cardData;
        }
      } catch (e) {
        // Fall through to name search
      }
    }
    
    // Try exact name match
    const encodedName = encodeURIComponent(cardName);
    url = `https://api.scryfall.com/cards/named?exact=${encodedName}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'RhysticGamingBlog/1.0',
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const cardData = await response.json();
        cache[cacheKey] = {
          data: cardData,
          timestamp: Date.now()
        };
        saveCache(cache);
        return cardData;
      }
    } catch (error) {
      console.error('Error fetching card:', error);
    }

    // Try fuzzy search as fallback
    const fuzzyUrl = `https://api.scryfall.com/cards/search?q=${encodedName}`;
    try {
      const response = await fetch(fuzzyUrl, {
        headers: {
          'User-Agent': 'RhysticGamingBlog/1.0',
          'Accept': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        if (data.data && data.data.length > 0) {
          // Find best match
          const matches = data.data.filter(c => 
            c.name.toLowerCase().includes(cardName.toLowerCase()) ||
            cardName.toLowerCase().includes(c.name.toLowerCase().split(',')[0])
          );
          const cardData = matches.length > 0 ? matches[0] : data.data[0];
          cache[cacheKey] = {
            data: cardData,
            timestamp: Date.now()
          };
          saveCache(cache);
          return cardData;
        }
      }
    } catch (error) {
      console.error('Error in fuzzy search:', error);
    }

    throw new Error(`Card not found: ${cardName}`);
  }

  // Get card image URL
  function getCardImageUrl(cardData) {
    if (cardData.image_uris && cardData.image_uris.normal) {
      return cardData.image_uris.normal;
    }
    if (cardData.card_faces && cardData.card_faces[0] && cardData.card_faces[0].image_uris) {
      return cardData.card_faces[0].image_uris.normal;
    }
    return null;
  }

  // Get card type from Scryfall data
  function getCardType(cardData) {
    return cardData.type_line || 'Unknown';
  }

  // Get card rules text
  function getCardText(cardData) {
    if (cardData.oracle_text) {
      return cardData.oracle_text;
    }
    if (cardData.card_faces && cardData.card_faces[0] && cardData.card_faces[0].oracle_text) {
      return cardData.card_faces[0].oracle_text;
    }
    return '';
  }

  // Categorize card by type
  function categorizeCard(cardData) {
    const typeLine = (cardData.type_line || '').toLowerCase();
    
    if (typeLine.includes('creature')) {
      return 'Creatures';
    } else if (typeLine.includes('land')) {
      return 'Lands';
    } else if (typeLine.includes('instant') || typeLine.includes('sorcery') || 
               typeLine.includes('enchantment') || typeLine.includes('artifact') ||
               typeLine.includes('planeswalker') || typeLine.includes('battle')) {
      return 'Spells';
    }
    return 'Other';
  }

  // Preload an image to ensure it's cached by the browser
  function preloadImage(imageUrl) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = imageUrl;
    });
  }

  // Update the left card display (uses cached data only, no API calls)
  function updateCardDisplay(container, cardData) {
    const imageWrapper = container.querySelector('.decklist-card-image-wrapper');
    const image = container.querySelector('.decklist-card-display-image');
    const loading = container.querySelector('.decklist-card-display-loading');
    const info = container.querySelector('.decklist-card-display-info');
    const typeEl = container.querySelector('.decklist-card-display-type');
    const textEl = container.querySelector('.decklist-card-display-text');
    
    const imageUrl = getCardImageUrl(cardData);
    
    if (imageUrl) {
      // Check if image is already loaded (browser cache)
      if (image.src === imageUrl && image.complete) {
        // Image already loaded, just show it
        loading.style.display = 'none';
        image.style.display = 'block';
      } else {
        // Set src - browser will use cache if available
        image.src = imageUrl;
        image.alt = cardData.name;
        image.style.display = 'block';
        
        // Hide loading once image loads (from cache or network)
        if (image.complete) {
          loading.style.display = 'none';
        } else {
          image.onload = () => {
            loading.style.display = 'none';
          };
          image.onerror = () => {
            loading.textContent = 'Image failed to load';
            loading.style.display = 'block';
          };
        }
      }
      
      // Update type and text
      typeEl.textContent = getCardType(cardData);
      const cardText = getCardText(cardData);
      textEl.textContent = cardText || '(No rules text)';
      info.style.display = 'block';
    } else {
      loading.textContent = 'No image available';
      loading.style.display = 'block';
    }
  }

  // Group and display cards by type
  async function organizeCardsByType(decklist) {
    const groupsContainer = decklist.querySelector('.decklist-groups');
    const cardItems = Array.from(decklist.querySelectorAll('.decklist-card-item'));
    
    // Fetch card data for all cards
    const cardPromises = cardItems.map(async (item, index) => {
      // Delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, index * 100));
      
      const cardName = item.getAttribute('data-card-name');
      const setCode = item.getAttribute('data-set-code') || null;
      const collectorNumber = item.getAttribute('data-collector-number') || null;
      const quantity = parseInt(item.getAttribute('data-quantity'), 10);
      
      try {
        const cardData = await fetchCard(cardName, setCode, collectorNumber);
        item.setAttribute('data-card-data', JSON.stringify(cardData));
        
        // Preload the image to ensure it's cached by the browser
        const imageUrl = getCardImageUrl(cardData);
        if (imageUrl) {
          // Preload in background - don't wait for it, just trigger browser cache
          preloadImage(imageUrl).catch(() => {
            // Silently fail - image will load when needed
          });
        }
        
        return {
          element: item,
          cardData,
          quantity,
          category: categorizeCard(cardData)
        };
      } catch (error) {
        console.error(`Failed to fetch ${cardName}:`, error);
        return {
          element: item,
          cardData: null,
          quantity,
          category: 'Other'
        };
      }
    });
    
    const cards = await Promise.all(cardPromises);
    
    // Group by category
    const groups = {
      'Creatures': [],
      'Lands': [],
      'Spells': [],
      'Other': []
    };
    
    cards.forEach(card => {
      if (groups[card.category]) {
        groups[card.category].push(card);
      } else {
        groups['Other'].push(card);
      }
    });
    
    // Clear and rebuild the groups container
    groupsContainer.innerHTML = '';
    
    // Display groups in order
    ['Creatures', 'Lands', 'Spells', 'Other'].forEach(category => {
      if (groups[category].length === 0) return;
      
      const groupDiv = document.createElement('div');
      groupDiv.className = 'decklist-group';
      
      const header = document.createElement('div');
      header.className = 'decklist-group-header';
      const count = groups[category].reduce((sum, c) => sum + c.quantity, 0);
      header.textContent = `${category} (${count})`;
      groupDiv.appendChild(header);
      
      const list = document.createElement('div');
      list.className = 'decklist-group-list';
      
      groups[category].forEach(card => {
        list.appendChild(card.element);
      });
      
      groupDiv.appendChild(list);
      groupsContainer.appendChild(groupDiv);
    });
  }

  // Initialize decklists when DOM is ready
  function init() {
    const decklists = document.querySelectorAll('.decklist-container');
    
    decklists.forEach(decklist => {
      const imageColumn = decklist.querySelector('.decklist-image-column');
      const cardItems = decklist.querySelectorAll('.decklist-card-item');
      
      // Organize cards by type
      organizeCardsByType(decklist).then(() => {
        // After organizing, set up hover/click handlers
        const updatedItems = decklist.querySelectorAll('.decklist-card-item');
        
        updatedItems.forEach(item => {
          // Hover to update left image (uses cached data only, no API calls)
          item.addEventListener('mouseenter', () => {
            const cardDataStr = item.getAttribute('data-card-data');
            if (cardDataStr) {
              try {
                const cardData = JSON.parse(cardDataStr);
                // This only uses already-fetched data, no API call
                updateCardDisplay(imageColumn, cardData);
              } catch (e) {
                console.error('Error parsing card data:', e);
              }
            }
          });
          
          // Click to show in modal
          item.addEventListener('click', () => {
            const cardDataStr = item.getAttribute('data-card-data');
            if (cardDataStr) {
              try {
                const cardData = JSON.parse(cardDataStr);
                showCardInModal(cardData);
              } catch (e) {
                console.error('Error showing card in modal:', e);
              }
            }
          });
        });
        
        // Set first card as default display
        const firstItem = updatedItems[0];
        if (firstItem) {
          const cardDataStr = firstItem.getAttribute('data-card-data');
          if (cardDataStr) {
            try {
              const cardData = JSON.parse(cardDataStr);
              updateCardDisplay(imageColumn, cardData);
            } catch (e) {
              // Ignore
            }
          }
        }
      });
    });
  }

  // Show card in modal (reuse existing modal system)
  function showCardInModal(cardData) {
    const modal = document.getElementById('card-modal');
    if (!modal) return;
    
    const cardDisplay = modal.querySelector('.card-display');
    const cardLoading = modal.querySelector('.card-loading');
    const cardError = modal.querySelector('.card-error');
    const cardImage = modal.querySelector('.card-image');
    const cardLink = modal.querySelector('.card-scryfall-link');

    cardDisplay.style.display = 'none';
    cardError.style.display = 'none';
    cardLoading.style.display = 'block';

    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    const imageUrl = getCardImageUrl(cardData);
    if (imageUrl) {
      cardImage.src = imageUrl;
      cardImage.alt = cardData.name;
      cardLink.href = cardData.scryfall_uri || cardData.uri;
      cardLink.textContent = `View ${cardData.name} on Scryfall →`;
      
      cardImage.onload = () => {
        cardLoading.style.display = 'none';
        cardDisplay.style.display = 'block';
      };
      
      cardImage.onerror = () => {
        cardLoading.style.display = 'none';
        cardError.style.display = 'block';
      };
    } else {
      cardLoading.style.display = 'none';
      cardError.style.display = 'block';
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
