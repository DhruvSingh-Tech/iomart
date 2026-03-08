/* ===================================
   I/OMart — Application Logic
   =================================== */

(() => {
    'use strict';

    // --- Configuration ---
    const IS_LOCAL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    const API_URL = IS_LOCAL ? 'https://www.jiomart.com/trex/autoSearch' : '/jioapi/trex/autoSearch';
    const PAGE_SIZE = 50;
    const DEBOUNCE_MS = 500;

    // --- Request body template ---
    const BASE_REQUEST = {
        pageSize: PAGE_SIZE,
        visitorId: 'anonymous-12345678-aaaa-bbbb-cccc-123456789abc',
        filter: 'attributes.status:ANY("active") AND (attributes.mart_availability:ANY("JIO", "JIO_WA")) AND (attributes.available_regions:ANY("PANINDIABOOKS", "PANINDIACRAFT", "PANINDIADIGITAL", "PANINDIAFASHION", "PANINDIAFURNITURE", "TW11", "PANINDIAGROCERIES", "PANINDIAHOMEANDKITCHEN", "PANINDIAHOMEIMPROVEMENT", "PANINDIAJEWEL", "PANINDIALOCALSHOPS", "PANINDIASTL")) AND ((attributes.inv_stores_1p:ANY("ALL", "TL6U", "SAB6", "SANR", "SANS", "SURR", "SANQ", "S4LI", "S535", "R300", "SLI1", "S2CP", "TG1K", "S2CN", "S2CO", "SLE4", "S3IR", "T4QF", "S0XN", "SZBL", "Y524", "SJ14", "V012", "R975", "S402", "V017", "S2DT", "SB41", "SLTP", "SL7Q", "SH09", "V027", "S3KG", "SAQO", "254", "500", "60", "270", "490", "TL5B", "R810", "S4OS", "SZ9U", "R696", "SE40", "R406", "SC28", "SK1M", "TD2S", "SJ93", "R396", "S3TP", "SLKO") OR attributes.inv_stores_3p:ANY("ALL", "3PYX5B9UFC02", "3P38SR7XFC154", "3PDOLSLBFC15", "3PR4EV1NFC06", "groceries_zone_non-essential_services", "general_zone", "groceries_zone_essential_services", "fashion_zone", "electronics_zone"))) AND ( NOT attributes.vertical_code:ANY("ALCOHOL"))',
        canonicalFilter: 'attributes.status:ANY("active") AND (attributes.mart_availability:ANY("JIO", "JIO_WA")) AND (attributes.available_regions:ANY("PANINDIABOOKS", "PANINDIACRAFT", "PANINDIADIGITAL", "PANINDIAFASHION", "PANINDIAFURNITURE", "TW11", "PANINDIAGROCERIES", "PANINDIAHOMEANDKITCHEN", "PANINDIAHOMEIMPROVEMENT", "PANINDIAJEWEL", "PANINDIALOCALSHOPS", "PANINDIASTL")) AND ((attributes.inv_stores_1p:ANY("ALL", "TL6U", "SAB6", "SANR", "SANS", "SURR", "SANQ", "S4LI", "S535", "R300", "SLI1", "S2CP", "TG1K", "S2CN", "S2CO", "SLE4", "S3IR", "T4QF", "S0XN", "SZBL", "Y524", "SJ14", "V012", "R975", "S402", "V017", "S2DT", "SB41", "SLTP", "SL7Q", "SH09", "V027", "S3KG", "SAQO", "254", "500", "60", "270", "490", "TL5B", "R810", "S4OS", "SZ9U", "R696", "SE40", "R406", "SC28", "SK1M", "TD2S", "SJ93", "R396", "S3TP", "SLKO") OR attributes.inv_stores_3p:ANY("ALL", "3PYX5B9UFC02", "3P38SR7XFC154", "3PDOLSLBFC15", "3PR4EV1NFC06", "groceries_zone_non-essential_services", "general_zone", "groceries_zone_essential_services", "fashion_zone", "electronics_zone"))) AND ( NOT attributes.vertical_code:ANY("ALCOHOL"))',
        searchMode: 'PRODUCT_SEARCH_ONLY',
        branch: 'projects/sr-project-jiomart-jfront-prod/locations/global/catalogs/default_catalog/branches/0',
        userInfo: {
            userId: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
        },
        spellCorrectionSpec: { mode: 'AUTO' },
        queryExpansionSpec: { condition: 'AUTO', pinUnexpandedResults: true }
    };

    // --- DOM References ---
    const dom = {
        searchHero: document.getElementById('search-hero'),
        searchInput: document.getElementById('search-input'),
        searchBtn: document.getElementById('search-btn'),
        clearBtn: document.getElementById('clear-btn'),
        quickTags: document.getElementById('quick-tags'),
        resultsInfo: document.getElementById('results-info'),
        resultsCountText: document.getElementById('results-count-text'),
        sortSelect: document.getElementById('sort-select'),
        resultsGrid: document.getElementById('results-grid'),
        loadingState: document.getElementById('loading-state'),
        emptyState: document.getElementById('empty-state'),
        errorState: document.getElementById('error-state'),
        errorMessage: document.getElementById('error-message'),
        retryBtn: document.getElementById('retry-btn'),
    };

    // --- State ---
    let currentProducts = [];
    let currentQuery = '';
    let debounceTimer = null;

    // --- Utility: Parse price from buybox_mrp ---
    function parseBuyboxPrice(buyboxMrpList) {
        if (!buyboxMrpList || !buyboxMrpList.length) return null;

        // Try to find QC (pan-india) price first, else first entry
        let entry = buyboxMrpList.find(e => e.startsWith('QC')) || buyboxMrpList[0];
        const parts = entry.split('|');
        // Format: store|seller_id|seller_name||MRP|selling_price||discount_amount|discount_pct||...
        if (parts.length >= 9) {
            return {
                seller: parts[2] || 'Seller',
                mrp: parseFloat(parts[4]) || 0,
                sellingPrice: parseFloat(parts[5]) || 0,
                discountAmount: parseFloat(parts[7]) || 0,
                discountPct: parseInt(parts[8]) || 0,
            };
        }
        return null;
    }

    // --- Utility: Extract single variant data ---
    function extractVariant(variant) {
        const attrs = variant.attributes || {};
        const priceInfo = parseBuyboxPrice(attrs.buybox_mrp?.text);
        const foodType = attrs.food_type?.text?.[0] || '';
        const size = variant.sizes?.[0] || '';

        return {
            id: variant.id,
            title: variant.title || '',
            brand: variant.brands?.[0] || '',
            image: variant.images?.[0]?.uri || '',
            url: variant.uri || '#',
            size: size,
            foodType: foodType,
            seller: priceInfo?.seller || attrs.seller_names?.text?.[0] || '',
            mrp: priceInfo?.mrp || 0,
            sellingPrice: priceInfo?.sellingPrice || 0,
            discountPct: priceInfo?.discountPct || 0,
            discountAmount: priceInfo?.discountAmount || 0,
        };
    }

    // --- Utility: Extract product data (with all variants) ---
    function extractProduct(result) {
        const product = result.product;
        const variants = product.variants;
        if (!variants || !variants.length) return null;

        const categories = product.categories?.[0] || '';
        const cleanCategory = categories.replace(/^Category\s*>\s*/, '');

        // Extract all variants
        const allVariants = variants.map(extractVariant).filter(Boolean);
        if (!allVariants.length) return null;

        // Use the first variant as the default display
        const primary = allVariants[0];

        return {
            id: primary.id,
            title: primary.title || product.title,
            brand: primary.brand,
            category: cleanCategory,
            image: primary.image,
            url: primary.url,
            foodType: primary.foodType,
            seller: primary.seller,
            mrp: primary.mrp,
            sellingPrice: primary.sellingPrice,
            discountPct: primary.discountPct,
            discountAmount: primary.discountAmount,
            // Variant data
            variants: allVariants,
            hasMultipleVariants: allVariants.length > 1,
        };
    }

    // --- UI Helpers ---
    function show(el) { el.classList.remove('hidden'); }
    function hide(el) { el.classList.add('hidden'); }

    function setUIState(state) {
        // states: idle, loading, results, empty, error
        hide(dom.loadingState);
        hide(dom.emptyState);
        hide(dom.errorState);
        hide(dom.resultsInfo);
        dom.resultsGrid.innerHTML = '';

        switch (state) {
            case 'loading':
                show(dom.loadingState);
                break;
            case 'results':
                show(dom.resultsInfo);
                break;
            case 'empty':
                show(dom.emptyState);
                break;
            case 'error':
                show(dom.errorState);
                break;
        }
    }

    // --- Helper: Build badges HTML ---
    function buildBadgesHTML(discountPct, foodType) {
        let html = '';
        if (discountPct > 0) {
            html += `<span class="discount-badge">${discountPct}% OFF</span>`;
        }
        if (foodType) {
            const isVeg = foodType.toLowerCase().includes('green');
            html += `<span class="food-badge ${isVeg ? 'veg' : 'non-veg'}" title="${isVeg ? 'Vegetarian' : 'Non-Vegetarian'}"></span>`;
        }
        return html;
    }

    // --- Helper: Build pricing HTML ---
    function buildPricingHTML(sellingPrice, mrp) {
        if (sellingPrice <= 0) return '';
        let html = `<span class="price-current">₹${sellingPrice.toLocaleString('en-IN')}</span>`;
        if (mrp > sellingPrice) {
            html += `<span class="price-original">₹${mrp.toLocaleString('en-IN')}</span>`;
        }
        return html;
    }

    // --- Render Product Card ---
    function createProductCard(product, index) {
        const card = document.createElement('a');
        card.className = 'product-card';
        card.href = product.url;
        card.target = '_blank';
        card.rel = 'noopener noreferrer';
        card.style.animationDelay = `${Math.min(index * 0.04, 0.8)}s`;
        card.id = `product-${product.id}`;

        const badgesHTML = buildBadgesHTML(product.discountPct, product.foodType);
        const pricingHTML = buildPricingHTML(product.sellingPrice, product.mrp);

        // Variant size pills (only if multiple variants exist)
        let variantsHTML = '';
        if (product.hasMultipleVariants) {
            const pills = product.variants.map((v, i) => {
                const label = v.size || v.title;
                return `<button class="variant-pill${i === 0 ? ' active' : ''}" data-variant-index="${i}" title="${v.title}">${label}</button>`;
            }).join('');
            variantsHTML = `<div class="variant-selector">${pills}</div>`;
        }

        card.innerHTML = `
            <div class="card-badges-wrap">${badgesHTML}</div>
            <div class="card-image-wrap">
                <img 
                    class="card-image" 
                    src="${product.image}" 
                    alt="${product.title}"
                    loading="lazy"
                    onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%2250%%22 x=%2250%%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 font-size=%2240%22>📦</text></svg>'"
                >
            </div>
            <div class="card-body">
                ${product.brand ? `<span class="card-brand">${product.brand}</span>` : ''}
                <h3 class="card-title">${product.title}</h3>
                ${product.category ? `<span class="card-category">${product.category}</span>` : ''}
                ${variantsHTML}
                <div class="card-pricing">${pricingHTML}</div>
                ${product.seller ? `<span class="card-seller">Sold by ${product.seller}</span>` : ''}
            </div>
        `;

        // Attach variant switching logic
        if (product.hasMultipleVariants) {
            card.addEventListener('click', (e) => {
                const pill = e.target.closest('.variant-pill');
                if (!pill) return; // let default <a> click through
                e.preventDefault();
                e.stopPropagation();

                const idx = parseInt(pill.dataset.variantIndex);
                const v = product.variants[idx];
                if (!v) return;

                // Update active pill
                card.querySelectorAll('.variant-pill').forEach(p => p.classList.remove('active'));
                pill.classList.add('active');

                // Update card content
                card.href = v.url;
                const img = card.querySelector('.card-image');
                if (img && v.image) { img.src = v.image; img.alt = v.title; }

                const titleEl = card.querySelector('.card-title');
                if (titleEl) titleEl.textContent = v.title;

                const pricingEl = card.querySelector('.card-pricing');
                if (pricingEl) pricingEl.innerHTML = buildPricingHTML(v.sellingPrice, v.mrp);

                const badgesWrap = card.querySelector('.card-badges-wrap');
                if (badgesWrap) badgesWrap.innerHTML = buildBadgesHTML(v.discountPct, v.foodType);

                const sellerEl = card.querySelector('.card-seller');
                if (sellerEl && v.seller) sellerEl.textContent = `Sold by ${v.seller}`;
            });
        }

        return card;
    }

    // --- Render Results ---
    function renderResults(products, totalSize) {
        if (!products.length) {
            setUIState('empty');
            return;
        }

        setUIState('results');
        dom.resultsCountText.innerHTML = `<strong>${totalSize.toLocaleString('en-IN')}</strong> products found for "<strong>${currentQuery}</strong>"`;

        products.forEach((product, i) => {
            const card = createProductCard(product, i);
            dom.resultsGrid.appendChild(card);
        });
    }

    // --- Sort Products ---
    function sortProducts(products, sortBy) {
        const sorted = [...products];
        switch (sortBy) {
            case 'price-low':
                sorted.sort((a, b) => (a.sellingPrice || Infinity) - (b.sellingPrice || Infinity));
                break;
            case 'price-high':
                sorted.sort((a, b) => (b.sellingPrice || 0) - (a.sellingPrice || 0));
                break;
            case 'discount':
                sorted.sort((a, b) => (b.discountPct || 0) - (a.discountPct || 0));
                break;
            default:
                break; // relevance = API order
        }
        return sorted;
    }

    // --- API Call ---
    async function searchProducts(query) {
        if (!query.trim()) return;

        currentQuery = query.trim();
        setUIState('loading');
        dom.searchHero.classList.add('compact');

        try {
            const body = {
                ...BASE_REQUEST,
                query: currentQuery,
            };

            const res = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Referer': `https://www.jiomart.com/search?q=${encodeURIComponent(currentQuery)}&sort=all_products`,
                    'Origin': 'https://www.jiomart.com',
                },
                body: JSON.stringify(body),
            });

            if (!res.ok) throw new Error(`API returned ${res.status}`);

            const data = await res.json();
            const results = data.results || [];
            const totalSize = data.totalSize || results.length;

            currentProducts = results.map(extractProduct).filter(Boolean);

            const sorted = sortProducts(currentProducts, dom.sortSelect.value);
            renderResults(sorted, totalSize);

        } catch (err) {
            console.error('Search failed:', err);
            dom.errorMessage.textContent = err.message || 'Could not reach the server. Please try again.';
            setUIState('error');
        }
    }

    // --- Event Listeners ---

    // Search input
    dom.searchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        if (val.length > 0) {
            show(dom.clearBtn);
        } else {
            hide(dom.clearBtn);
        }

        clearTimeout(debounceTimer);
        if (val.trim().length >= 2) {
            debounceTimer = setTimeout(() => searchProducts(val), DEBOUNCE_MS);
        }
    });

    // Enter to search
    dom.searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            clearTimeout(debounceTimer);
            const val = dom.searchInput.value.trim();
            if (val) searchProducts(val);
        }
    });

    // Search button
    dom.searchBtn.addEventListener('click', () => {
        clearTimeout(debounceTimer);
        const val = dom.searchInput.value.trim();
        if (val) searchProducts(val);
    });

    // Clear button
    dom.clearBtn.addEventListener('click', () => {
        dom.searchInput.value = '';
        hide(dom.clearBtn);
        dom.searchInput.focus();
        dom.searchHero.classList.remove('compact');
        setUIState('idle');
        currentProducts = [];
        currentQuery = '';
    });

    // Quick tags
    dom.quickTags.addEventListener('click', (e) => {
        const tag = e.target.closest('.tag');
        if (!tag) return;
        const query = tag.dataset.query;
        dom.searchInput.value = query;
        show(dom.clearBtn);
        searchProducts(query);
    });

    // Sort change
    dom.sortSelect.addEventListener('change', () => {
        if (!currentProducts.length) return;
        const sorted = sortProducts(currentProducts, dom.sortSelect.value);
        dom.resultsGrid.innerHTML = '';
        sorted.forEach((product, i) => {
            const card = createProductCard(product, i);
            dom.resultsGrid.appendChild(card);
        });
    });

    // Retry button
    dom.retryBtn.addEventListener('click', () => {
        if (currentQuery) searchProducts(currentQuery);
    });

    // --- Keyboard shortcut: Ctrl+K / Cmd+K to focus search ---
    document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
            e.preventDefault();
            dom.searchInput.focus();
            dom.searchInput.select();
        }
    });

})();
