/**
 * IKSHARA™ (ikshara.co.nz) - MAIN APPLICATION ENGINE
 * Handles: Instant Product Display, WhatsApp Order Flow (+91 8140307529),
 * Multi-Currency Switcher (NZD, AUD, USD, INR, GBP, EUR, AED, CAD), Shopping Bag Drawer, Wishlist, Quick View,
 * and Advanced Filtering like Myntra & Amazon.
 */

class LuxuryStoreApp {
  constructor() {
    this.config = window.STORE_CONFIG;
    this.products = window.PRODUCTS_DATA || [];
    this.currentCurrency = localStorage.getItem('vc_currency') || this.config.defaultCurrency;
    this.cart = this.loadCart();
    this.wishlist = this.loadWishlist();
    
    // Filter State
    this.filters = {
      category: 'all',
      subcategory: 'all',
      fabric: 'all',
      occasion: 'all',
      maxPrice: 25000,
      search: '',
      sort: 'featured',
      readyOnly: false
    };

    this.activeQuickProduct = null;
    this.checkoutMode = 'cart'; // 'cart' or 'single'
    this.checkoutSingleItem = null;

    this.init();
  }

  init() {
    this.setupCurrencySelector();
    this.setupSearch();
    this.setupFilters();
    this.setupCategoryPills();
    this.setupSort();
    this.renderProducts();
    this.updateCartBadges();
    this.updateWishlistBadges();
    this.setupModals();
    this.setupCheckoutForm();
    this.setupMobileMenu();
    this.renderTrustBadges();
    this.renderFaq();
  }

  // ================= STORAGE HELPERS =================
  loadCart() {
    try {
      const saved = localStorage.getItem('vc_cart');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  saveCart() {
    localStorage.setItem('vc_cart', JSON.stringify(this.cart));
    this.updateCartBadges();
    this.renderCartDrawer();
  }

  loadWishlist() {
    try {
      const saved = localStorage.getItem('vc_wishlist');
      return saved ? JSON.parse(saved) : [];
    } catch (e) {
      return [];
    }
  }

  saveWishlist() {
    localStorage.setItem('vc_wishlist', JSON.stringify(this.wishlist));
    this.updateWishlistBadges();
  }

  // ================= CURRENCY ENGINE =================
  formatPrice(inrAmount) {
    const curr = this.config.currencies[this.currentCurrency] || this.config.currencies.INR;
    const converted = inrAmount * curr.rate;
    return curr.format(converted);
  }

  getConvertedAmount(inrAmount) {
    const curr = this.config.currencies[this.currentCurrency] || this.config.currencies.INR;
    return inrAmount * curr.rate;
  }

  setupCurrencySelector() {
    const selector = document.getElementById('currencySelector');
    const mobileSelector = document.getElementById('mobileCurrencySelector');
    if (!selector && !mobileSelector) return;

    const populate = (el) => {
      if (!el) return;
      el.innerHTML = Object.keys(this.config.currencies).map(code => {
        const c = this.config.currencies[code];
        const selected = code === this.currentCurrency ? 'selected' : '';
        return `<option value="${code}" ${selected}>${c.symbol} ${code}</option>`;
      }).join('');

      el.addEventListener('change', (e) => {
        this.currentCurrency = e.target.value;
        localStorage.setItem('vc_currency', this.currentCurrency);
        if (selector) selector.value = this.currentCurrency;
        if (mobileSelector) mobileSelector.value = this.currentCurrency;
        
        // Re-render UI with new currency
        this.renderProducts();
        this.renderCartDrawer();
        if (this.activeQuickProduct) {
          this.renderQuickViewModal(this.activeQuickProduct.id);
        }
        this.showToast(`Currency changed to ${this.currentCurrency}`);
      });
    };

    populate(selector);
    populate(mobileSelector);
  }

  // ================= LIVE SEARCH =================
  setupSearch() {
    const searchInputs = [
      document.getElementById('searchInput'),
      document.getElementById('mobileSearchInput')
    ];
    const resultsContainer = document.getElementById('searchResultsDropdown');

    searchInputs.forEach(input => {
      if (!input) return;
      input.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        this.filters.search = query;
        this.renderProducts();

        if (resultsContainer) {
          if (query.length > 1) {
            const matches = this.products.filter(p => 
              p.title.toLowerCase().includes(query.toLowerCase()) ||
              p.fabric.toLowerCase().includes(query.toLowerCase()) ||
              p.subcategory.toLowerCase().includes(query.toLowerCase())
            ).slice(0, 4);

            if (matches.length > 0) {
              resultsContainer.innerHTML = matches.map(p => `
                <div class="flex items-center gap-3 p-2.5 hover:bg-amber-50/60 cursor-pointer border-b border-stone-100 last:border-none transition-colors" onclick="app.openQuickView('${p.id}')">
                  <img src="${p.images[0]}" class="w-12 h-14 object-cover rounded shadow-sm flex-shrink-0" alt="${p.title}">
                  <div class="flex-1 min-w-0">
                    <p class="text-xs font-serif font-semibold text-stone-900 truncate">${p.title}</p>
                    <p class="text-[11px] text-stone-500">${p.fabric} • ${p.category === 'saree' ? 'Saree' : '3-Piece Suit'}</p>
                    <p class="text-xs font-bold text-amber-900 mt-0.5">${this.formatPrice(p.priceINR)}</p>
                  </div>
                </div>
              `).join('');
              resultsContainer.classList.remove('hidden');
            } else {
              resultsContainer.innerHTML = `<div class="p-3 text-xs text-stone-500 text-center">No styles found for "${query}"</div>`;
              resultsContainer.classList.remove('hidden');
            }
          } else {
            resultsContainer.classList.add('hidden');
          }
        }
      });

      input.addEventListener('focus', () => {
        if (input.value.trim().length > 1 && resultsContainer) {
          resultsContainer.classList.remove('hidden');
        }
      });
    });

    document.addEventListener('click', (e) => {
      if (!e.target.closest('#searchContainer') && resultsContainer) {
        resultsContainer.classList.add('hidden');
      }
    });
  }

  // ================= CATEGORY QUICK PILLS =================
  setupCategoryPills() {
    const pills = document.querySelectorAll('.category-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active', 'bg-stone-900', 'text-white'));
        pills.forEach(p => p.classList.add('bg-stone-100', 'text-stone-800'));
        pill.classList.remove('bg-stone-100', 'text-stone-800');
        pill.classList.add('active', 'bg-stone-900', 'text-white');

        const cat = pill.getAttribute('data-category');
        const subcat = pill.getAttribute('data-subcategory');

        this.filters.category = cat || 'all';
        this.filters.subcategory = subcat || 'all';

        // Update left sidebar checkboxes if present
        const catRadio = document.querySelector(`input[name="categoryFilter"][value="${this.filters.category}"]`);
        if (catRadio) catRadio.checked = true;

        this.renderProducts();

        // Smooth scroll to product grid if needed
        const gridSection = document.getElementById('productsSection');
        if (gridSection) {
          gridSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      });
    });
  }

  // ================= SIDEBAR & FILTERS =================
  setupFilters() {
    // Category radio buttons
    const catRadios = document.querySelectorAll('input[name="categoryFilter"]');
    catRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        this.filters.category = e.target.value;
        this.renderProducts();
      });
    });

    // Subcategory checkboxes
    const subcatBoxes = document.querySelectorAll('.subcat-filter');
    subcatBoxes.forEach(box => {
      box.addEventListener('change', () => {
        const checked = Array.from(subcatBoxes).filter(b => b.checked).map(b => b.value);
        this.filters.subcategory = checked.length === 1 ? checked[0] : (checked.length > 1 ? checked : 'all');
        this.renderProducts();
      });
    });

    // Fabric filter
    const fabricSelect = document.getElementById('fabricFilter');
    if (fabricSelect) {
      fabricSelect.addEventListener('change', (e) => {
        this.filters.fabric = e.target.value;
        this.renderProducts();
      });
    }

    // Occasion filter
    const occasionSelect = document.getElementById('occasionFilter');
    if (occasionSelect) {
      occasionSelect.addEventListener('change', (e) => {
        this.filters.occasion = e.target.value;
        this.renderProducts();
      });
    }

    // Price range slider
    const priceRange = document.getElementById('priceRangeSlider');
    const priceDisplay = document.getElementById('priceRangeDisplay');
    if (priceRange && priceDisplay) {
      priceRange.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        this.filters.maxPrice = val;
        priceDisplay.textContent = this.formatPrice(val);
        this.renderProducts();
      });
    }

    // Ready to ship checkbox
    const readyBox = document.getElementById('readyToShipOnly');
    if (readyBox) {
      readyBox.addEventListener('change', (e) => {
        this.filters.readyOnly = e.target.checked;
        this.renderProducts();
      });
    }

    // Clear filters button
    const clearBtn = document.getElementById('clearFiltersBtn');
    if (clearBtn) {
      clearBtn.addEventListener('click', () => {
        this.resetFilters();
      });
    }

    // Mobile filter drawer toggle
    const mobileFilterOpen = document.getElementById('openMobileFilters');
    const mobileFilterClose = document.getElementById('closeMobileFilters');
    const mobileFilterDrawer = document.getElementById('mobileFilterDrawer');
    if (mobileFilterOpen && mobileFilterDrawer) {
      mobileFilterOpen.addEventListener('click', () => {
        mobileFilterDrawer.classList.remove('hidden');
      });
    }
    if (mobileFilterClose && mobileFilterDrawer) {
      mobileFilterClose.addEventListener('click', () => {
        mobileFilterDrawer.classList.add('hidden');
      });
    }
  }

  resetFilters() {
    this.filters = {
      category: 'all',
      subcategory: 'all',
      fabric: 'all',
      occasion: 'all',
      maxPrice: 25000,
      search: '',
      sort: 'featured',
      readyOnly: false
    };

    // Reset UI inputs
    const catAll = document.querySelector('input[name="categoryFilter"][value="all"]');
    if (catAll) catAll.checked = true;

    document.querySelectorAll('.subcat-filter').forEach(b => b.checked = false);

    const fab = document.getElementById('fabricFilter');
    if (fab) fab.value = 'all';

    const occ = document.getElementById('occasionFilter');
    if (occ) occ.value = 'all';

    const priceRange = document.getElementById('priceRangeSlider');
    const priceDisplay = document.getElementById('priceRangeDisplay');
    if (priceRange && priceDisplay) {
      priceRange.value = 25000;
      priceDisplay.textContent = this.formatPrice(25000);
    }

    const readyBox = document.getElementById('readyToShipOnly');
    if (readyBox) readyBox.checked = false;

    const pills = document.querySelectorAll('.category-pill');
    pills.forEach((p, idx) => {
      if (idx === 0) {
        p.classList.remove('bg-stone-100', 'text-stone-800');
        p.classList.add('active', 'bg-stone-900', 'text-white');
      } else {
        p.classList.remove('active', 'bg-stone-900', 'text-white');
        p.classList.add('bg-stone-100', 'text-stone-800');
      }
    });

    this.renderProducts();
    this.showToast('Filters cleared');
  }

  // ================= SORTING =================
  setupSort() {
    const sortSelect = document.getElementById('sortSelect');
    if (sortSelect) {
      sortSelect.addEventListener('change', (e) => {
        this.filters.sort = e.target.value;
        this.renderProducts();
      });
    }
  }

  getFilteredAndSortedProducts() {
    let list = this.products.filter(p => {
      // Category
      if (this.filters.category !== 'all' && p.category !== this.filters.category) return false;

      // Subcategory
      if (this.filters.subcategory !== 'all') {
        if (Array.isArray(this.filters.subcategory)) {
          if (!this.filters.subcategory.includes(p.subcategory)) return false;
        } else if (p.subcategory !== this.filters.subcategory) {
          return false;
        }
      }

      // Fabric
      if (this.filters.fabric !== 'all') {
        if (!p.fabric.toLowerCase().includes(this.filters.fabric.toLowerCase())) return false;
      }

      // Occasion
      if (this.filters.occasion !== 'all') {
        if (p.occasion !== this.filters.occasion) return false;
      }

      // Max price
      if (p.priceINR > this.filters.maxPrice) return false;

      // Ready only
      if (this.filters.readyOnly && !p.readyToShip) return false;

      // Search
      if (this.filters.search && this.filters.search.trim() !== '') {
        const q = this.filters.search.toLowerCase().trim();
        const str = `${p.title} ${p.fabric} ${p.work} ${p.subcategory} ${p.color} ${p.sku}`.toLowerCase();
        if (!str.includes(q)) return false;
      }

      return true;
    });

    // Sorting
    switch (this.filters.sort) {
      case 'price-low':
        list.sort((a, b) => a.priceINR - b.priceINR);
        break;
      case 'price-high':
        list.sort((a, b) => b.priceINR - a.priceINR);
        break;
      case 'rating':
        list.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        list.reverse();
        break;
      default: // featured
        list.sort((a, b) => b.reviewsCount - a.reviewsCount);
        break;
    }

    return list;
  }

  // ================= MAIN PRODUCT GRID RENDERING =================
  renderProducts() {
    const grid = document.getElementById('productsGrid');
    const counter = document.getElementById('productCountBadge');
    if (!grid) return;

    const list = this.getFilteredAndSortedProducts();

    if (counter) {
      counter.textContent = `${list.length} ${list.length === 1 ? 'Design' : 'Designs'} Available`;
    }

    if (list.length === 0) {
      grid.innerHTML = `
        <div class="col-span-full py-16 text-center bg-stone-50 rounded-2xl border border-dashed border-stone-200 p-8">
          <div class="w-16 h-16 mx-auto mb-4 rounded-full bg-amber-100 flex items-center justify-center text-amber-800 text-2xl">
            🥻
          </div>
          <h3 class="text-lg font-serif font-bold text-stone-800">No matching Sarees or Suits found</h3>
          <p class="text-sm text-stone-500 mt-1 max-w-md mx-auto">Try resetting some of your filters, searching for another fabric or exploring all our ready-to-ship ethnic collections.</p>
          <button onclick="app.resetFilters()" class="mt-4 inline-flex items-center gap-2 px-5 py-2.5 bg-stone-900 text-white text-xs font-semibold uppercase tracking-wider rounded-lg hover:bg-stone-800 transition-colors shadow">
            Clear All Filters
          </button>
        </div>
      `;
      return;
    }

    grid.innerHTML = list.map(product => {
      const isWishlisted = this.wishlist.includes(product.id);
      const discountPercent = Math.round(((product.originalPriceINR - product.priceINR) / product.originalPriceINR) * 100);
      const isSaree = product.category === 'saree';
      const defaultSize = isSaree ? "Unstitched Blouse" : "Stitched M (38\")";

      return `
        <div class="product-card group relative bg-white rounded-xl overflow-hidden border border-stone-100/80 hover:border-amber-200/80 transition-all duration-300 flex flex-col justify-between shadow-sm hover:shadow-xl" data-id="${product.id}">
          
          <!-- IMAGE WRAPPER -->
          <div class="relative aspect-[3/4] w-full overflow-hidden bg-stone-100 cursor-pointer" onclick="app.openQuickView('${product.id}')">
            <!-- Badges -->
            <div class="absolute top-2.5 left-2.5 z-10 flex flex-col gap-1 items-start">
              ${product.badge ? `
                <span class="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-stone-900/90 backdrop-blur-md text-amber-300 rounded shadow">
                  ${product.badge}
                </span>
              ` : ''}
              ${discountPercent > 0 ? `
                <span class="px-1.5 py-0.5 text-[10px] font-bold bg-red-600 text-white rounded shadow">
                  ${discountPercent}% OFF
                </span>
              ` : ''}
              ${product.readyToShip ? `
                <span class="px-1.5 py-0.5 text-[9px] font-semibold bg-emerald-700/90 text-white rounded flex items-center gap-1 shadow">
                  ⚡ Ready to Ship
                </span>
              ` : ''}
            </div>

            <!-- Wishlist Heart Button -->
            <button 
              onclick="event.stopPropagation(); app.toggleWishlist('${product.id}')" 
              class="absolute top-2.5 right-2.5 z-10 w-8 h-8 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center text-stone-700 hover:text-red-600 hover:scale-110 shadow transition-all duration-200"
              title="Save to Wishlist">
              <svg class="w-4 h-4 ${isWishlisted ? 'text-red-500 fill-red-500' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"/>
              </svg>
            </button>

            <!-- Primary Image -->
            <img 
              src="${product.images[0]}" 
              alt="${product.title}" 
              loading="lazy" 
              class="w-full h-full object-cover object-top transition-transform duration-700 group-hover:scale-105"
            />

            <!-- Secondary Image (Hover Effect) -->
            ${product.images[1] ? `
              <img 
                src="${product.images[1]}" 
                alt="${product.title} Detail" 
                loading="lazy" 
                class="absolute inset-0 w-full h-full object-cover object-top opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              />
            ` : ''}

            <!-- Quick View Overlay Pill -->
            <div class="absolute inset-x-0 bottom-3 flex justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 px-3 z-10">
              <button 
                onclick="event.stopPropagation(); app.openQuickView('${product.id}')" 
                class="w-full py-1.5 px-3 bg-white/95 backdrop-blur text-stone-900 text-xs font-semibold rounded-lg shadow-md hover:bg-amber-50 flex items-center justify-center gap-1.5 border border-stone-200">
                <svg class="w-3.5 h-3.5 text-stone-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>
                </svg>
                Quick View & Details
              </button>
            </div>
          </div>

          <!-- PRODUCT DETAILS -->
          <div class="p-3.5 flex flex-col flex-1 justify-between bg-white">
            <div>
              <!-- Category & Rating -->
              <div class="flex items-center justify-between text-[11px] text-stone-500 mb-1">
                <span class="uppercase tracking-wider font-medium text-amber-800/90">${isSaree ? '🥻 Saree' : '👗 3-Piece Suit'}</span>
                <span class="flex items-center gap-0.5 text-amber-600 font-semibold">
                  ★ ${product.rating} <span class="text-stone-400 font-normal">(${product.reviewsCount})</span>
                </span>
              </div>

              <!-- Product Title -->
              <h3 
                class="font-serif font-bold text-sm text-stone-900 line-clamp-2 leading-snug cursor-pointer hover:text-amber-800 transition-colors"
                onclick="app.openQuickView('${product.id}')"
                title="${product.title}">
                ${product.title}
              </h3>

              <!-- Fabric & Craft snippet -->
              <p class="text-[11px] text-stone-500 truncate mt-0.5 font-sans">${product.fabric} • ${product.work}</p>

              <!-- Price Section -->
              <div class="mt-2.5 flex items-baseline gap-2 flex-wrap">
                <span class="text-base font-extrabold text-stone-900 font-sans">
                  ${this.formatPrice(product.priceINR)}
                </span>
                <span class="text-xs text-stone-400 line-through font-sans">
                  ${this.formatPrice(product.originalPriceINR)}
                </span>
                <span class="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                  Save ${discountPercent}%
                </span>
              </div>
            </div>

            <!-- ACTION BUTTONS -->
            <div class="mt-3.5 pt-2.5 border-t border-stone-100 flex flex-col gap-1.5">
              
              <!-- 1-Click WhatsApp Direct Buy (The Core Prompt Requirement!) -->
              <button 
                onclick="app.initiateWhatsAppBuy('${product.id}', '${defaultSize}')" 
                class="w-full py-2 px-3 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-xs font-bold rounded-lg flex items-center justify-center gap-1.5 shadow hover:shadow-md active:scale-98 transition-all"
                title="Order directly to WhatsApp Admin +91 8140307529">
                <svg class="w-4 h-4 fill-current text-white flex-shrink-0" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                </svg>
                <span>⚡ Buy on WhatsApp</span>
              </button>

              <!-- Secondary Add to Bag -->
              <button 
                onclick="app.addToCart('${product.id}', '${defaultSize}')" 
                class="w-full py-1.5 px-3 bg-stone-100 hover:bg-stone-200 text-stone-800 text-[11px] font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors">
                <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/>
                </svg>
                Add to Bag
              </button>

            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  // ================= CART SYSTEM =================
  addToCart(productId, selectedSize = "Standard", customStitching = false) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    // Additional stitching cost if enabled
    const stitchingAddon = customStitching ? 999 : 0;
    const finalPriceINR = product.priceINR + stitchingAddon;

    const existingIndex = this.cart.findIndex(item => item.id === productId && item.size === selectedSize && item.customStitching === customStitching);

    if (existingIndex > -1) {
      this.cart[existingIndex].quantity += 1;
    } else {
      this.cart.push({
        id: product.id,
        sku: product.sku,
        title: product.title,
        category: product.category,
        fabric: product.fabric,
        image: product.images[0],
        priceINR: finalPriceINR,
        basePriceINR: product.priceINR,
        originalPriceINR: product.originalPriceINR,
        size: selectedSize,
        customStitching: customStitching,
        quantity: 1
      });
    }

    this.saveCart();
    this.showToast(`Added "${product.title.substring(0, 24)}..." to Bag`);
    this.openCartDrawer();
  }

  updateQuantity(index, delta) {
    if (!this.cart[index]) return;
    this.cart[index].quantity += delta;
    if (this.cart[index].quantity <= 0) {
      this.cart.splice(index, 1);
    }
    this.saveCart();
  }

  removeFromCart(index) {
    if (!this.cart[index]) return;
    const item = this.cart[index];
    this.cart.splice(index, 1);
    this.saveCart();
    this.showToast(`Removed from Bag`);
  }

  updateCartBadges() {
    const totalCount = this.cart.reduce((sum, item) => sum + item.quantity, 0);
    const badges = [
      document.getElementById('cartBadge'),
      document.getElementById('mobileCartBadge')
    ];
    badges.forEach(b => {
      if (!b) return;
      b.textContent = totalCount;
      if (totalCount > 0) {
        b.classList.remove('hidden');
      } else {
        b.classList.add('hidden');
      }
    });
  }

  renderCartDrawer() {
    const container = document.getElementById('cartItemsList');
    const subtotalEl = document.getElementById('cartSubtotal');
    const freeShippingNotice = document.getElementById('freeShippingProgress');
    const checkoutBtn = document.getElementById('cartWhatsAppCheckoutBtn');
    if (!container) return;

    if (this.cart.length === 0) {
      container.innerHTML = `
        <div class="py-16 text-center text-stone-500">
          <div class="w-16 h-16 mx-auto mb-3 rounded-full bg-stone-100 flex items-center justify-center text-stone-400 text-2xl">
            🛍️
          </div>
          <p class="font-serif font-semibold text-stone-800 text-base">Your shopping bag is empty</p>
          <p class="text-xs text-stone-400 mt-1">Explore our pure silk sarees & designer suits</p>
          <button onclick="app.closeCartDrawer()" class="mt-4 px-4 py-2 bg-stone-900 text-white text-xs font-semibold rounded-lg uppercase tracking-wider">
            Start Shopping
          </button>
        </div>
      `;
      if (subtotalEl) subtotalEl.textContent = this.formatPrice(0);
      if (checkoutBtn) checkoutBtn.disabled = true;
      if (freeShippingNotice) freeShippingNotice.innerHTML = '';
      return;
    }

    let subtotalINR = 0;
    container.innerHTML = this.cart.map((item, index) => {
      const lineTotalINR = item.priceINR * item.quantity;
      subtotalINR += lineTotalINR;

      return `
        <div class="flex gap-3 py-3 border-b border-stone-100 last:border-none">
          <img src="${item.image}" class="w-16 h-20 object-cover object-top rounded-lg border border-stone-200 flex-shrink-0" alt="${item.title}">
          <div class="flex-1 min-w-0">
            <div class="flex justify-between items-start gap-1">
              <h4 class="text-xs font-serif font-bold text-stone-900 line-clamp-2">${item.title}</h4>
              <button onclick="app.removeFromCart(${index})" class="text-stone-400 hover:text-red-600 transition-colors p-0.5">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
                </svg>
              </button>
            </div>
            <p class="text-[10px] text-amber-900 font-medium mt-0.5">Size: ${item.size}</p>
            ${item.customStitching ? `<span class="text-[9px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded border border-amber-200 font-semibold inline-block mt-0.5">🪡 Custom Stitched</span>` : ''}
            
            <div class="flex items-center justify-between mt-2.5">
              <div class="flex items-center border border-stone-200 rounded-md overflow-hidden">
                <button onclick="app.updateQuantity(${index}, -1)" class="w-6 h-6 flex items-center justify-center bg-stone-50 hover:bg-stone-200 text-stone-700 text-xs font-bold">-</button>
                <span class="w-8 text-center text-xs font-semibold text-stone-900">${item.quantity}</span>
                <button onclick="app.updateQuantity(${index}, 1)" class="w-6 h-6 flex items-center justify-center bg-stone-50 hover:bg-stone-200 text-stone-700 text-xs font-bold">+</button>
              </div>
              <span class="text-xs font-bold text-stone-900 font-sans">${this.formatPrice(lineTotalINR)}</span>
            </div>
          </div>
        </div>
      `;
    }).join('');

    if (subtotalEl) {
      subtotalEl.textContent = this.formatPrice(subtotalINR);
    }

    if (checkoutBtn) {
      checkoutBtn.disabled = false;
    }

    // Free shipping threshold
    if (freeShippingNotice) {
      const curr = this.config.currencies[this.currentCurrency] || this.config.currencies.INR;
      const convertedSubtotal = subtotalINR * curr.rate;
      const threshold = curr.freeShippingThreshold;

      if (convertedSubtotal >= threshold) {
        freeShippingNotice.innerHTML = `
          <div class="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg text-emerald-800 text-[11px] font-semibold flex items-center gap-2">
            <span>🎉</span>
            <span>You've unlocked <strong>FREE Worldwide Express Shipping!</strong></span>
          </div>
        `;
      } else {
        const remaining = threshold - convertedSubtotal;
        const percent = Math.min(100, Math.round((convertedSubtotal / threshold) * 100));
        freeShippingNotice.innerHTML = `
          <div class="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-900 text-[11px]">
            <div class="flex justify-between font-semibold mb-1">
              <span>Worldwide Shipping Progress</span>
              <span>Add ${curr.format(remaining)} for FREE</span>
            </div>
            <div class="w-full bg-amber-200/60 rounded-full h-1.5 overflow-hidden">
              <div class="bg-amber-800 h-1.5 rounded-full transition-all duration-300" style="width: ${percent}%"></div>
            </div>
          </div>
        `;
      }
    }
  }

  openCartDrawer() {
    this.renderCartDrawer();
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartDrawerOverlay');
    if (drawer && overlay) {
      drawer.classList.remove('translate-x-full');
      overlay.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
    }
  }

  closeCartDrawer() {
    const drawer = document.getElementById('cartDrawer');
    const overlay = document.getElementById('cartDrawerOverlay');
    if (drawer && overlay) {
      drawer.classList.add('translate-x-full');
      overlay.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }
  }

  // ================= WISHLIST SYSTEM =================
  toggleWishlist(productId) {
    const idx = this.wishlist.indexOf(productId);
    if (idx > -1) {
      this.wishlist.splice(idx, 1);
      this.showToast('Removed from Wishlist');
    } else {
      this.wishlist.push(productId);
      this.showToast('Saved to your Wishlist ❤️');
    }
    this.saveWishlist();
    this.renderProducts();
    this.renderWishlistModal();
  }

  updateWishlistBadges() {
    const count = this.wishlist.length;
    const badges = [
      document.getElementById('wishlistBadge'),
      document.getElementById('mobileWishlistBadge')
    ];
    badges.forEach(b => {
      if (!b) return;
      b.textContent = count;
      if (count > 0) {
        b.classList.remove('hidden');
      } else {
        b.classList.add('hidden');
      }
    });
  }

  renderWishlistModal() {
    const container = document.getElementById('wishlistItemsContainer');
    if (!container) return;

    if (this.wishlist.length === 0) {
      container.innerHTML = `
        <div class="py-12 text-center text-stone-500">
          <div class="text-3xl mb-2">🤍</div>
          <p class="font-serif font-bold text-stone-800">Your Wishlist is empty</p>
          <p class="text-xs text-stone-400 mt-1">Tap the heart icon on any saree or suit to save it for later.</p>
        </div>
      `;
      return;
    }

    const items = this.products.filter(p => this.wishlist.includes(p.id));
    container.innerHTML = `
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[60vh] overflow-y-auto p-1">
        ${items.map(p => `
          <div class="flex gap-3 p-2.5 bg-stone-50 rounded-xl border border-stone-200">
            <img src="${p.images[0]}" class="w-16 h-20 object-cover rounded-lg flex-shrink-0 cursor-pointer" onclick="app.openQuickView('${p.id}')">
            <div class="flex-1 min-w-0 flex flex-col justify-between">
              <div>
                <h4 class="text-xs font-serif font-bold text-stone-900 truncate">${p.title}</h4>
                <p class="text-[11px] text-stone-500">${p.fabric}</p>
                <p class="text-xs font-bold text-stone-900 mt-1">${this.formatPrice(p.priceINR)}</p>
              </div>
              <div class="flex items-center gap-1.5 mt-2">
                <button onclick="app.initiateWhatsAppBuy('${p.id}')" class="px-2.5 py-1 bg-emerald-700 text-white text-[10px] font-bold rounded hover:bg-emerald-800 flex items-center gap-1">
                  ⚡ Buy
                </button>
                <button onclick="app.toggleWishlist('${p.id}')" class="px-2 py-1 bg-stone-200 text-stone-700 text-[10px] rounded hover:bg-red-100 hover:text-red-700">
                  Remove
                </button>
              </div>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  // ================= QUICK VIEW MODAL =================
  openQuickView(productId) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;
    this.activeQuickProduct = product;
    this.renderQuickViewModal(productId);

    const modal = document.getElementById('quickViewModal');
    if (modal) {
      modal.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
    }
  }

  closeQuickView() {
    const modal = document.getElementById('quickViewModal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }
  }

  renderQuickViewModal(productId) {
    const product = this.products.find(p => p.id === productId);
    const content = document.getElementById('quickViewContent');
    if (!product || !content) return;

    const discountPercent = Math.round(((product.originalPriceINR - product.priceINR) / product.originalPriceINR) * 100);
    const isSaree = product.category === 'saree';

    content.innerHTML = `
      <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        <!-- PHOTO GALLERY -->
        <div>
          <div class="relative aspect-[3/4] w-full rounded-xl overflow-hidden bg-stone-100 border border-stone-200 shadow-inner">
            <img id="qvMainImage" src="${product.images[0]}" alt="${product.title}" class="w-full h-full object-cover object-top transition-all duration-300">
            ${product.badge ? `
              <span class="absolute top-3 left-3 px-2.5 py-1 text-xs font-bold uppercase tracking-wider bg-stone-900 text-amber-300 rounded shadow">
                ${product.badge}
              </span>
            ` : ''}
          </div>

          <!-- Thumbnails -->
          <div class="flex gap-2 mt-3 overflow-x-auto pb-1">
            ${product.images.map((img, i) => `
              <button onclick="document.getElementById('qvMainImage').src='${img}'" class="w-16 h-20 rounded-lg overflow-hidden border-2 border-stone-200 hover:border-amber-700 flex-shrink-0 transition-all focus:border-amber-800 focus:scale-105">
                <img src="${img}" class="w-full h-full object-cover object-top" alt="Thumbnail ${i+1}">
              </button>
            `).join('')}
          </div>

          <div class="mt-4 p-3 bg-emerald-50/70 border border-emerald-200/80 rounded-xl text-xs text-emerald-900 flex items-center gap-2">
            <svg class="w-5 h-5 text-emerald-700 flex-shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/></svg>
            <div>
              <p class="font-bold">WhatsApp Live Video Call Inspection Available</p>
              <p class="text-[11px] text-emerald-800">Inspect the fabric, weave and fall live before dispatch.</p>
            </div>
          </div>
        </div>

        <!-- PRODUCT SPECIFICATIONS & ORDER FORM -->
        <div class="flex flex-col justify-between">
          <div>
            <div class="flex items-center gap-2 text-xs text-stone-500 mb-1">
              <span class="font-bold text-amber-900 uppercase tracking-wider">${isSaree ? 'Pure Silk Saree' : 'Designer 3-Piece Suit'}</span>
              <span>•</span>
              <span class="text-stone-400">SKU: ${product.sku}</span>
            </div>

            <h2 class="text-xl md:text-2xl font-serif font-bold text-stone-900 leading-tight">${product.title}</h2>

            <div class="flex items-center gap-3 mt-2">
              <div class="flex items-center text-amber-600 font-bold text-sm">
                ★★★★★ <span class="text-stone-700 ml-1.5 font-sans">${product.rating}</span>
              </div>
              <span class="text-xs text-stone-400">(${product.reviewsCount} Worldwide Client Reviews)</span>
              ${product.readyToShip ? `<span class="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded">In Stock - Ships 24h</span>` : ''}
            </div>

            <!-- Price -->
            <div class="mt-4 p-3 bg-stone-50 rounded-xl border border-stone-200/70 flex items-baseline gap-3">
              <span class="text-2xl font-extrabold text-stone-900 font-sans" id="qvPriceDisplay">
                ${this.formatPrice(product.priceINR)}
              </span>
              <span class="text-sm text-stone-400 line-through font-sans">
                ${this.formatPrice(product.originalPriceINR)}
              </span>
              <span class="px-2 py-0.5 bg-red-100 text-red-700 text-xs font-bold rounded">
                ${discountPercent}% OFF
              </span>
            </div>

            <!-- Copy description -->
            <p class="text-xs text-stone-600 mt-3 leading-relaxed">${product.description}</p>

            <!-- Specs Grid -->
            <div class="mt-4 bg-amber-50/40 rounded-xl p-3 border border-amber-200/60 text-xs space-y-1.5">
              <div class="flex justify-between"><strong class="text-stone-700 font-medium">Fabric:</strong> <span class="text-stone-900 font-semibold">${product.fabric}</span></div>
              <div class="flex justify-between"><strong class="text-stone-700 font-medium">Work / Craft:</strong> <span class="text-stone-900 text-right">${product.work}</span></div>
              <div class="flex justify-between"><strong class="text-stone-700 font-medium">Occasion:</strong> <span class="text-stone-900">${product.occasion}</span></div>
              ${isSaree ? `
                <div class="flex justify-between"><strong class="text-stone-700 font-medium">Saree Length:</strong> <span class="text-stone-900">${product.specifications.sareeLength}</span></div>
                <div class="flex justify-between"><strong class="text-stone-700 font-medium">Blouse Piece:</strong> <span class="text-stone-900">${product.specifications.blousePiece}</span></div>
              ` : `
                <div class="flex justify-between"><strong class="text-stone-700 font-medium">Top / Kurta:</strong> <span class="text-stone-900">${product.specifications.topPiece}</span></div>
                <div class="flex justify-between"><strong class="text-stone-700 font-medium">Bottom / Pants:</strong> <span class="text-stone-900">${product.specifications.bottomPiece}</span></div>
                <div class="flex justify-between"><strong class="text-stone-700 font-medium">Dupatta:</strong> <span class="text-stone-900">${product.specifications.dupatta}</span></div>
              `}
              <div class="flex justify-between"><strong class="text-stone-700 font-medium">Care:</strong> <span class="text-stone-900">${product.specifications.washCare}</span></div>
            </div>

            <!-- Size / Stitching Option Selector -->
            <div class="mt-4">
              <label class="block text-xs font-bold text-stone-900 mb-1.5 uppercase tracking-wider">
                Select Sizing & Stitching Option:
              </label>
              <div class="flex flex-wrap gap-2" id="qvSizeContainer">
                ${product.sizes.map((s, idx) => `
                  <label class="cursor-pointer">
                    <input type="radio" name="qvSizeOption" value="${s}" ${idx === 0 ? 'checked' : ''} class="peer sr-only">
                    <span class="px-3 py-1.5 text-xs font-medium rounded-lg border border-stone-300 peer-checked:bg-stone-900 peer-checked:text-white peer-checked:border-stone-900 hover:bg-stone-100 transition-all inline-block">
                      ${s}
                    </span>
                  </label>
                `).join('')}
              </div>
            </div>

            <!-- Custom Stitching add-on checkbox -->
            <div class="mt-3.5 flex items-start gap-2.5 p-2.5 bg-stone-100 rounded-lg">
              <input type="checkbox" id="qvCustomStitchingCheckbox" class="mt-0.5 rounded text-stone-900 focus:ring-stone-900">
              <label for="qvCustomStitchingCheckbox" class="text-xs text-stone-800 cursor-pointer">
                <span class="font-bold">Add Custom Master Tailoring & Pico</span> (+₹999 / $15 USD)<br>
                <span class="text-[11px] text-stone-500">Provide your measurements on WhatsApp; tailored to perfection by master artisans.</span>
              </label>
            </div>
          </div>

          <!-- CTAs -->
          <div class="mt-5 pt-4 border-t border-stone-200 flex flex-col sm:flex-row gap-2.5">
            <button 
              onclick="app.handleQuickViewWhatsAppBuy('${product.id}')" 
              class="flex-1 py-3 px-4 bg-gradient-to-r from-emerald-600 to-emerald-700 hover:from-emerald-700 hover:to-emerald-800 text-white text-sm font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all">
              <svg class="w-5 h-5 fill-current text-white flex-shrink-0" viewBox="0 0 24 24">
                <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
              </svg>
              <span>Instant WhatsApp Buy</span>
            </button>
            <button 
              onclick="app.handleQuickViewAddToCart('${product.id}')" 
              class="py-3 px-5 bg-stone-900 hover:bg-stone-800 text-white text-sm font-semibold rounded-xl flex items-center justify-center gap-2 shadow">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"/></svg>
              Add to Bag
            </button>
          </div>
        </div>
      </div>
    `;
  }

  handleQuickViewWhatsAppBuy(productId) {
    const selectedSizeEl = document.querySelector('input[name="qvSizeOption"]:checked');
    const selectedSize = selectedSizeEl ? selectedSizeEl.value : "Standard";
    const customStitching = document.getElementById('qvCustomStitchingCheckbox')?.checked || false;

    this.closeQuickView();
    this.initiateWhatsAppBuy(productId, selectedSize, customStitching);
  }

  handleQuickViewAddToCart(productId) {
    const selectedSizeEl = document.querySelector('input[name="qvSizeOption"]:checked');
    const selectedSize = selectedSizeEl ? selectedSizeEl.value : "Standard";
    const customStitching = document.getElementById('qvCustomStitchingCheckbox')?.checked || false;

    this.closeQuickView();
    this.addToCart(productId, selectedSize, customStitching);
  }

  // ================= WHATSAPP ORDER & CHECKOUT ENGINE (+91 8140307529) =================
  /**
   * The core feature: sends complete order details and enquiry to admin WhatsApp 8140307529
   */
  initiateWhatsAppBuy(productId, selectedSize = "Standard", customStitching = false) {
    const product = this.products.find(p => p.id === productId);
    if (!product) return;

    this.checkoutMode = 'single';
    const stitchingAddon = customStitching ? 999 : 0;
    this.checkoutSingleItem = {
      product: product,
      size: selectedSize,
      customStitching: customStitching,
      finalPriceINR: product.priceINR + stitchingAddon,
      quantity: 1
    };

    this.openCheckoutModal();
  }

  initiateCartWhatsAppBuy() {
    if (this.cart.length === 0) {
      this.showToast("Your shopping bag is empty");
      return;
    }
    this.checkoutMode = 'cart';
    this.closeCartDrawer();
    this.openCheckoutModal();
  }

  openCheckoutModal() {
    this.populateCheckoutSummary();
    const modal = document.getElementById('checkoutModal');
    if (modal) {
      modal.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
    }
  }

  closeCheckoutModal() {
    const modal = document.getElementById('checkoutModal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }
  }

  populateCheckoutSummary() {
    const container = document.getElementById('checkoutItemsPreview');
    const totalEl = document.getElementById('checkoutTotalDisplay');
    const adminDisplay = document.getElementById('checkoutAdminNumber');
    if (!container) return;

    if (adminDisplay) {
      adminDisplay.textContent = this.config.whatsapp.displayNumber;
    }

    let itemsToBuy = [];
    let grandTotalINR = 0;

    if (this.checkoutMode === 'single' && this.checkoutSingleItem) {
      const item = this.checkoutSingleItem;
      itemsToBuy = [{
        title: item.product.title,
        sku: item.product.sku,
        image: item.product.images[0],
        priceINR: item.finalPriceINR,
        size: item.size,
        customStitching: item.customStitching,
        quantity: item.quantity
      }];
      grandTotalINR = item.finalPriceINR * item.quantity;
    } else {
      itemsToBuy = this.cart;
      grandTotalINR = this.cart.reduce((sum, item) => sum + (item.priceINR * item.quantity), 0);
    }

    container.innerHTML = itemsToBuy.map(item => `
      <div class="flex items-center gap-3 p-2 bg-stone-50 rounded-lg border border-stone-200">
        <img src="${item.image}" class="w-12 h-14 object-cover object-top rounded flex-shrink-0" alt="${item.title}">
        <div class="flex-1 min-w-0">
          <p class="text-xs font-serif font-bold text-stone-900 truncate">${item.title}</p>
          <p class="text-[11px] text-stone-500">SKU: ${item.sku} • Size: ${item.size}</p>
          <p class="text-xs font-bold text-amber-950 mt-0.5">
            ${item.quantity} × ${this.formatPrice(item.priceINR)}
          </p>
        </div>
      </div>
    `).join('');

    if (totalEl) {
      totalEl.textContent = this.formatPrice(grandTotalINR);
    }
  }

  setupCheckoutForm() {
    // Populate Countries dropdown
    const countrySelect = document.getElementById('checkoutCountry');
    if (countrySelect) {
      countrySelect.innerHTML = this.config.countries.map(c => `
        <option value="${c.name} (${c.flag})" data-dial="${c.dial}" ${c.code === 'US' ? 'selected' : ''}>
          ${c.flag} ${c.name} (${c.dial})
        </option>
      `).join('');
    }

    const form = document.getElementById('checkoutForm');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.submitOrderToWhatsApp();
      });
    }
  }

  submitOrderToWhatsApp() {
    const name = document.getElementById('checkoutName')?.value.trim();
    const phone = document.getElementById('checkoutPhone')?.value.trim();
    const country = document.getElementById('checkoutCountry')?.value;
    const address = document.getElementById('checkoutAddress')?.value.trim();
    const notes = document.getElementById('checkoutNotes')?.value.trim();

    if (!name || !phone || !address) {
      this.showToast("Please fill in your name, WhatsApp number, and delivery address");
      return;
    }

    let items = [];
    let totalINR = 0;

    if (this.checkoutMode === 'single' && this.checkoutSingleItem) {
      const item = this.checkoutSingleItem;
      items = [{
        title: item.product.title,
        sku: item.product.sku,
        size: item.size,
        customStitching: item.customStitching,
        priceINR: item.finalPriceINR,
        quantity: item.quantity
      }];
      totalINR = item.finalPriceINR * item.quantity;
    } else {
      items = this.cart.map(i => ({
        title: i.title,
        sku: i.sku,
        size: i.size,
        customStitching: i.customStitching,
        priceINR: i.priceINR,
        quantity: i.quantity
      }));
      totalINR = this.cart.reduce((s, i) => s + (i.priceINR * i.quantity), 0);
    }

    const curr = this.config.currencies[this.currentCurrency] || this.config.currencies.INR;
    const formattedTotal = this.formatPrice(totalINR);
    const inrDisplay = this.currentCurrency !== 'INR' ? ` (approx. ₹${Math.round(totalINR).toLocaleString('en-IN')})` : '';

    // Build the WhatsApp message
    let message = `✨ *NEW ORDER & ENQUIRY - ${this.config.brandName.toUpperCase()} (${this.config.domain})* ✨\n`;
    message += `═══════════════════════════\n`;
    message += `🛍️ *PURCHASE DETAILS:*\n\n`;

    items.forEach((it, idx) => {
      message += `${idx + 1}. *${it.title}*\n`;
      message += `   • *SKU:* ${it.sku}\n`;
      message += `   • *Size/Option:* ${it.size}\n`;
      if (it.customStitching) {
        message += `   • *Custom Stitching:* Yes (Tailored measurement)\n`;
      }
      message += `   • *Quantity:* ${it.quantity}\n`;
      message += `   • *Price:* ${this.formatPrice(it.priceINR * it.quantity)}\n\n`;
    });

    message += `═══════════════════════════\n`;
    message += `💰 *ORDER TOTAL:* ${formattedTotal}${inrDisplay}\n`;
    message += `✈️ *SHIPPING:* Worldwide Express Door-to-Door\n\n`;
    
    message += `👤 *CUSTOMER INFORMATION:*\n`;
    message += `• *Full Name:* ${name}\n`;
    message += `• *WhatsApp/Phone:* ${phone}\n`;
    message += `• *Destination Country:* ${country}\n`;
    message += `• *Full Delivery Address:* ${address}\n`;

    if (notes) {
      message += `\n📝 *CUSTOM STITCHING / SPECIAL REQUEST:*\n`;
      message += `"${notes}"\n`;
    }

    message += `═══════════════════════════\n`;
    message += `💬 *Hello Admin!* Please confirm availability, share payment options (Card / PayPal / Wise / UPI), and let me know the dispatch timeline. Thank you!`;

    // Target Admin WhatsApp number: 8140307529 (with country code 91)
    const adminPhone = this.config.whatsapp.fullNumber; // "918140307529"
    const encodedMsg = encodeURIComponent(message);
    const whatsappUrl = `https://wa.me/${adminPhone}?text=${encodedMsg}`;

    // Close checkout and show success
    this.closeCheckoutModal();

    // If cart mode, optionally clear cart or keep it
    if (this.checkoutMode === 'cart') {
      // Clear cart
      this.cart = [];
      this.saveCart();
    }

    this.showOrderSuccessModal(whatsappUrl, message);

    // Open WhatsApp in new tab
    window.open(whatsappUrl, '_blank');
  }

  showOrderSuccessModal(whatsappUrl, rawMessage) {
    const modal = document.getElementById('orderSuccessModal');
    const linkBtn = document.getElementById('successWhatsAppBtn');
    const copyBtn = document.getElementById('successCopyBtn');
    if (!modal) return;

    if (linkBtn) {
      linkBtn.href = whatsappUrl;
    }

    if (copyBtn) {
      copyBtn.onclick = () => {
        navigator.clipboard.writeText(rawMessage);
        this.showToast('Order details copied to clipboard!');
      };
    }

    modal.classList.remove('hidden');
    document.body.classList.add('overflow-hidden');
  }

  closeOrderSuccessModal() {
    const modal = document.getElementById('orderSuccessModal');
    if (modal) {
      modal.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    }
  }

  // ================= GENERAL MODALS & DRAWERS =================
  setupModals() {
    // Cart drawer close
    document.getElementById('closeCartDrawer')?.addEventListener('click', () => this.closeCartDrawer());
    document.getElementById('cartDrawerOverlay')?.addEventListener('click', () => this.closeCartDrawer());
    document.getElementById('cartButton')?.addEventListener('click', () => this.openCartDrawer());
    document.getElementById('mobileCartButton')?.addEventListener('click', () => this.openCartDrawer());
    document.getElementById('cartWhatsAppCheckoutBtn')?.addEventListener('click', () => this.initiateCartWhatsAppBuy());

    // Wishlist modal
    const wishlistModal = document.getElementById('wishlistModal');
    const openWishlist = () => {
      this.renderWishlistModal();
      wishlistModal?.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
    };
    const closeWishlist = () => {
      wishlistModal?.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    };
    document.getElementById('wishlistButton')?.addEventListener('click', openWishlist);
    document.getElementById('mobileWishlistButton')?.addEventListener('click', openWishlist);
    document.getElementById('closeWishlistModal')?.addEventListener('click', closeWishlist);
    wishlistModal?.addEventListener('click', (e) => {
      if (e.target === wishlistModal) closeWishlist();
    });

    // Quick view close
    document.getElementById('closeQuickViewModal')?.addEventListener('click', () => this.closeQuickView());
    const qvModal = document.getElementById('quickViewModal');
    qvModal?.addEventListener('click', (e) => {
      if (e.target === qvModal) this.closeQuickView();
    });

    // Checkout modal close
    document.getElementById('closeCheckoutModal')?.addEventListener('click', () => this.closeCheckoutModal());
    const chkModal = document.getElementById('checkoutModal');
    chkModal?.addEventListener('click', (e) => {
      if (e.target === chkModal) this.closeCheckoutModal();
    });

    // Success modal close
    document.getElementById('closeSuccessModal')?.addEventListener('click', () => this.closeOrderSuccessModal());

    // Size guide modal
    const sizeGuideModal = document.getElementById('sizeGuideModal');
    document.getElementById('openSizeGuideBtn')?.addEventListener('click', () => {
      sizeGuideModal?.classList.remove('hidden');
      document.body.classList.add('overflow-hidden');
    });
    document.getElementById('closeSizeGuideModal')?.addEventListener('click', () => {
      sizeGuideModal?.classList.add('hidden');
      document.body.classList.remove('overflow-hidden');
    });
    sizeGuideModal?.addEventListener('click', (e) => {
      if (e.target === sizeGuideModal) {
        sizeGuideModal?.classList.add('hidden');
        document.body.classList.remove('overflow-hidden');
      }
    });

    // Direct WhatsApp float button
    const floatBtn = document.getElementById('floatingWhatsAppBtn');
    if (floatBtn) {
      floatBtn.href = `https://wa.me/${this.config.whatsapp.fullNumber}?text=${encodeURIComponent(this.config.whatsapp.welcomeMessage)}`;
    }
  }

  // ================= MOBILE NAVIGATION =================
  setupMobileMenu() {
    const toggleBtn = document.getElementById('mobileMenuToggle');
    const mobileMenu = document.getElementById('mobileMenu');
    if (toggleBtn && mobileMenu) {
      toggleBtn.addEventListener('click', () => {
        mobileMenu.classList.toggle('hidden');
      });
    }
  }

  // ================= TRUST BADGES & FAQS =================
  renderTrustBadges() {
    const container = document.getElementById('trustBadgesContainer');
    if (!container) return;

    const badges = [
      { icon: "✈️", title: "Worldwide Express", desc: "Fast DHL & FedEx courier delivery to 80+ countries with live tracking." },
      { icon: "🪡", title: "Custom Tailoring", desc: "Expert Indian artisans tailor blouses & suits to your exact measurements." },
      { icon: "💯", title: "Pure Authenticity", desc: "100% genuine handloom silk and premium luxury fabrics certified by weavers." },
      { icon: "📹", title: "Live WhatsApp Video", desc: "Inspect your saree or suit on video call (+91 8140307529) before shipping." }
    ];

    container.innerHTML = badges.map(b => `
      <div class="flex items-start gap-3 p-4 bg-stone-50/70 rounded-2xl border border-stone-200/60 hover:bg-amber-50/40 transition-colors">
        <div class="text-3xl flex-shrink-0">${b.icon}</div>
        <div>
          <h4 class="text-sm font-serif font-bold text-stone-900">${b.title}</h4>
          <p class="text-xs text-stone-500 mt-0.5 leading-relaxed">${b.desc}</p>
        </div>
      </div>
    `).join('');
  }

  renderFaq() {
    const container = document.getElementById('faqContainer');
    if (!container) return;

    const faqs = [
      {
        q: "How does ordering through WhatsApp work?",
        a: "It's instantaneous and personal! When you click 'Buy on WhatsApp' or checkout your bag, your product choices, size, and address are neatly pre-filled into a WhatsApp message directly to our admin number (+91 8140307529). Our stylists confirm stock, share payment options (Cards, PayPal, Wise, UPI), and provide dispatch tracking."
      },
      {
        q: "Do you ship internationally to the USA, UK, Canada, UAE, and Australia?",
        a: "Yes, we ship to over 80 countries worldwide via DHL Express, FedEx, and Aramex. International orders typically reach within 4 to 7 business days with door-to-door tracking."
      },
      {
        q: "Can I get my saree blouse or 3-piece suit stitched to custom measurements?",
        a: "Absolutely! We provide custom master stitching for all sarees (blouse stitching with padding, fall, and pico edging) and three-piece suits. Simply check the 'Custom Tailoring' option or share your bust, waist, and length measurements with our master tailor on WhatsApp."
      },
      {
        q: "Can I inspect the saree or suit on video call before it ships?",
        a: "Yes! Before shipping your order, our store team can conduct a one-on-one WhatsApp video call to show you the saree drape, real daylight colors, embroidery closeup, and blouse piece."
      },
      {
        q: "What international payment methods do you accept?",
        a: "We accept all major International Credit/Debit Cards, PayPal, Wise (TransferWise), Bank Wire Transfers, and Indian UPI / Net Banking."
      }
    ];

    container.innerHTML = faqs.map((faq, i) => `
      <details class="group border border-stone-200 rounded-xl bg-white p-4 transition-all [&_summary::-webkit-details-marker]:hidden">
        <summary class="flex items-center justify-between cursor-pointer font-serif font-bold text-stone-900 text-sm">
          <span>${faq.q}</span>
          <span class="ml-4 flex-shrink-0 text-stone-400 group-open:rotate-180 transition-transform">
            ▼
          </span>
        </summary>
        <p class="mt-2.5 text-xs text-stone-600 leading-relaxed font-sans border-t border-stone-100 pt-2.5">
          ${faq.a}
        </p>
      </details>
    `).join('');
  }

  // ================= TOAST NOTIFICATIONS =================
  showToast(message) {
    const toast = document.getElementById('toastNotification');
    const toastText = document.getElementById('toastMessage');
    if (!toast || !toastText) return;

    toastText.textContent = message;
    toast.classList.remove('opacity-0', 'translate-y-4', 'pointer-events-none');
    toast.classList.add('opacity-100', 'translate-y-0');

    clearTimeout(this._toastTimeout);
    this._toastTimeout = setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-4', 'pointer-events-none');
      toast.classList.remove('opacity-100', 'translate-y-0');
    }, 2800);
  }
}

// Instantiate on DOM load
document.addEventListener('DOMContentLoaded', () => {
  window.app = new LuxuryStoreApp();
});
