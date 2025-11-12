/**
 * Card Modal System
 * Handles clicking on card names ([[Card Name]] syntax) to show card images
 * Fetches from Scryfall API with client-side caching
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
  async function fetchCard(cardName) {
    const encodedName = encodeURIComponent(cardName);
    console.log(encodedName);
    const url = `https://api.scryfall.com/cards/named?exact=${encodedName}`;
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'RhysticGamingBlog/1.0',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        // Try fuzzy search if exact match fails
        const fuzzyUrl = `https://api.scryfall.com/cards/search?q=${encodedName}`;
        const fuzzyResponse = await fetch(fuzzyUrl, {
          headers: {
            'User-Agent': 'RhysticGamingBlog/1.0',
            'Accept': 'application/json'
          }
        });

        if (fuzzyResponse.ok) {
          const fuzzyData = await fuzzyResponse.json();
          if (fuzzyData.data && fuzzyData.data.length > 0) {
            // Find best match
            const matches = fuzzyData.data.filter(c => 
              c.name.toLowerCase().includes(cardName.toLowerCase()) ||
              cardName.toLowerCase().includes(c.name.toLowerCase().split(',')[0])
            );
            return matches.length > 0 ? matches[0] : fuzzyData.data[0];
          }
        }
        throw new Error(`Card not found: ${cardName}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching card:', error);
      throw error;
    }
  }

  // Get card data (from cache or API)
  async function getCardData(cardName) {
    const cache = getCache();
    const cacheKey = cardName.toLowerCase().trim();
    
    // Check cache first
    if (cache[cacheKey] && !isExpired(cache[cacheKey])) {
      return cache[cacheKey].data;
    }

    // Fetch from API
    const cardData = await fetchCard(cardName);
    
    // Cache the result
    cache[cacheKey] = {
      data: cardData,
      timestamp: Date.now()
    };
    saveCache(cache);

    return cardData;
  }

  // Show modal with card
  function showCardModal(cardData) {
    const modal = document.getElementById('card-modal');
    const cardDisplay = modal.querySelector('.card-display');
    const cardLoading = modal.querySelector('.card-loading');
    const cardError = modal.querySelector('.card-error');
    const cardImage = modal.querySelector('.card-image');
    const cardLink = modal.querySelector('.card-scryfall-link');

    // Reset display states
    cardDisplay.style.display = 'none';
    cardError.style.display = 'none';
    cardLoading.style.display = 'block';

    // Show modal
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    // Set card image (use normal size, or image_uris.normal)
    if (cardData.image_uris && cardData.image_uris.normal) {
      cardImage.src = cardData.image_uris.normal;
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

  // Hide modal
  function hideCardModal() {
    const modal = document.getElementById('card-modal');
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }

  // Initialize when DOM is ready
  function init() {
    // Find all card links
    const cardLinks = document.querySelectorAll('.card-link');
    
    cardLinks.forEach(link => {
      link.addEventListener('click', async (e) => {
        e.preventDefault();
        const cardName = link.getAttribute('data-card-name');
        
        try {
          const cardData = await getCardData(cardName);
          showCardModal(cardData);
        } catch (error) {
          const modal = document.getElementById('card-modal');
          const cardLoading = modal.querySelector('.card-loading');
          const cardError = modal.querySelector('.card-error');
          cardLoading.style.display = 'none';
          cardError.style.display = 'block';
          modal.style.display = 'flex';
          document.body.style.overflow = 'hidden';
        }
      });
    });

    // Close modal handlers
    const modal = document.getElementById('card-modal');
    const closeBtn = modal.querySelector('.card-modal-close');
    const overlay = modal.querySelector('.card-modal-overlay');

    closeBtn.addEventListener('click', hideCardModal);
    overlay.addEventListener('click', hideCardModal);

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.style.display === 'flex') {
        hideCardModal();
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

