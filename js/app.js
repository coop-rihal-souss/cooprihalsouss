(function () {
  'use strict';

  const store = window.RihalStore;
  const integrations = window.RihalIntegrations;
  const config = window.RihalConfig;
  const screens = ['accueil', 'boutique', 'produit', 'panier', 'commande', 'confirmation'];
  const cartKey = 'rihal-souss-cart';
  let activeCategory = 'Toutes';
  let lastOrder = null;
  let toastTimer;
  let isSubmitting = false;

  function loadCart() {
    try {
      return store.normalizeCart(JSON.parse(localStorage.getItem(cartKey) || '[]'));
    } catch (error) {
      console.error('Impossible de restaurer le panier.', error);
      return [];
    }
  }

  let cart = loadCart();

  function saveCart() {
    try {
      localStorage.setItem(cartKey, JSON.stringify(cart));
      return true;
    } catch (error) {
      console.error('Impossible d’enregistrer le panier.', error);
      showToast('Le navigateur n’a pas pu enregistrer le panier.');
      return false;
    }
  }

  function formatPrice(amount) {
    return new Intl.NumberFormat('fr-MA', { style: 'currency', currency: 'MAD', maximumFractionDigits: 2 }).format(amount);
  }

  function productById(id) {
    return store.products.find(function (product) { return product.id === id; });
  }

  function getSheetEndpoint() {
    const endpoint = String(config.sheetEndpoint || '').trim();
    if (!endpoint) return '';
    return integrations.isAppsScriptEndpoint(endpoint) ? endpoint : null;
  }

  function configureWhatsApp() {
    const target = integrations.whatsappUrl(config.whatsappNumber);
    const links = [
      document.getElementById('whatsapp-button'),
      document.getElementById('whatsapp-floating')
    ];

    links.forEach(function (link) {
      if (!link || !target) return;
      link.href = target;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.setAttribute('aria-disabled', 'false');
    });

    const navigationLink = links[0];
    if (navigationLink && target) {
      navigationLink.innerHTML = 'WhatsApp <span aria-hidden="true">↗</span>';
    }
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function showToast(message) {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () { toast.classList.remove('is-visible'); }, 2600);
  }

  function updateCartCount() {
    const count = cart.reduce(function (sum, item) { return sum + item.quantity; }, 0);
    document.getElementById('cart-count').textContent = String(count);
  }

  function productArtwork(className) {
    return '<div class="product-art ' + className + '" role="img" aria-label="' + escapeHtml(store.products[0].imageLabel) + '"><div class="product-vessel"></div><span class="illustration-label">Illustration</span></div>';
  }

  function renderProducts() {
    const search = document.getElementById('product-search').value.trim().toLocaleLowerCase('fr');
    const visibleProducts = store.products.filter(function (product) {
      const matchesCategory = activeCategory === 'Toutes' || product.category === activeCategory;
      const matchesSearch = (product.name + ' ' + product.category).toLocaleLowerCase('fr').includes(search);
      return matchesCategory && matchesSearch;
    });
    const grid = document.getElementById('product-grid');
    if (!visibleProducts.length) {
      grid.innerHTML = '<p class="empty-products">Aucun produit renseigné dans cette catégorie pour le moment.<br>Le catalogue sera complété par la coopérative.</p>';
      return;
    }
    grid.innerHTML = visibleProducts.map(function (product) {
      return '<article class="product-card">' +
        productArtwork('') +
        '<div class="product-info"><p class="product-category">' + escapeHtml(product.category) + '</p>' +
        '<h3>' + escapeHtml(product.name) + '</h3>' +
        '<p class="product-desc">Description et conseils d’utilisation à compléter.</p>' +
        '<div class="product-card-footer"><span class="price">' + formatPrice(product.price) + ' <small>/ ' + escapeHtml(product.unit) + '</small></span>' +
        '<a class="text-button" href="#produit" data-product-id="' + escapeHtml(product.id) + '">Découvrir →</a></div></div></article>';
    }).join('');
  }

  function renderProductDetail() {
    const product = store.products[0];
    document.getElementById('product-detail').innerHTML =
      '<div class="detail-art">' + productArtwork('') + '</div>' +
      '<div class="detail-copy"><p class="product-category">' + escapeHtml(product.category) + '</p>' +
      '<h2>' + escapeHtml(product.name) + '</h2><p class="price">' + formatPrice(product.price) + ' <small>/ ' + escapeHtml(product.unit) + '</small></p>' +
      '<p>' + escapeHtml(product.description) + '</p>' +
      '<p class="catalog-disclosure">' + escapeHtml(product.imageLabel) + '</p>' +
      '<button class="button button-dark" type="button" data-add-product="' + escapeHtml(product.id) + '">Ajouter au panier</button></div>';
  }

  function cartRows() {
    return cart.map(function (entry) {
      const product = productById(entry.id);
      if (!product) return '';
      return '<div class="cart-row"><div class="cart-thumb"><div class="product-vessel" aria-hidden="true"></div></div>' +
        '<div class="cart-product"><h3>' + escapeHtml(product.name) + '</h3><p>' + formatPrice(product.price) + ' / ' + escapeHtml(product.unit) + '</p></div>' +
        '<div class="quantity-control" aria-label="Quantité de ' + escapeHtml(product.name) + '">' +
        '<button type="button" data-quantity="-1" data-id="' + escapeHtml(product.id) + '" aria-label="Retirer une unité">−</button>' +
        '<span>' + entry.quantity + '</span>' +
        '<button type="button" data-quantity="1" data-id="' + escapeHtml(product.id) + '" aria-label="Ajouter une unité">+</button></div>' +
        '<button class="remove-button" type="button" data-remove="' + escapeHtml(product.id) + '">Retirer</button>' +
        '<span class="price">' + formatPrice(product.price * entry.quantity) + '</span></div>';
    }).join('');
  }

  function summaryMarkup(includeButton) {
    const total = store.calculateSubtotal(cart);
    const itemCount = cart.reduce(function (sum, item) { return sum + item.quantity; }, 0);
    return '<h3>Récapitulatif</h3>' +
      '<div class="summary-line"><span>Articles (' + itemCount + ')</span><span>' + formatPrice(total) + '</span></div>' +
      '<div class="summary-line"><span>Livraison</span><span>À confirmer</span></div>' +
      '<div class="summary-line summary-total"><span>Total produits</span><span>' + formatPrice(total) + '</span></div>' +
      '<p class="summary-note">Frais de livraison à confirmer avec la coopérative. Paiement à la livraison.</p>' +
      (includeButton ? '<a class="button button-dark" href="#commande">Passer la commande</a>' : '');
  }

  function renderCart() {
    const target = document.getElementById('cart-content');
    if (!cart.length) {
      target.innerHTML = '<div class="empty-cart"><p>Votre panier est vide.</p><a class="button button-dark" href="#boutique">Découvrir la boutique</a></div>';
      return;
    }
    target.innerHTML = '<div class="cart-layout"><div class="cart-list">' + cartRows() + '</div><aside class="order-summary">' + summaryMarkup(true) + '</aside></div>';
  }

  function renderCheckout() {
    document.getElementById('checkout-summary').innerHTML = summaryMarkup(false) +
      cart.map(function (entry) {
        const product = productById(entry.id);
        return '<div class="summary-line"><span>' + escapeHtml(product.name) + ' × ' + entry.quantity + '</span><span>' + formatPrice(product.price * entry.quantity) + '</span></div>';
      }).join('');
    const endpoint = getSheetEndpoint();
    const notice = document.getElementById('checkout-notice');
    if (endpoint === null) {
      notice.textContent = 'L’adresse Google Sheets configurée est invalide. La commande ne peut pas être envoyée.';
    } else if (endpoint) {
      notice.textContent = 'Vos coordonnées seront transmises au Google Sheet privé de la coopérative pour traiter la commande.';
    } else {
      notice.textContent = 'Google Sheets n’est pas encore configuré. La commande ne peut pas être envoyée.';
    }
  }

  function submitOrderToSheet(endpoint, order) {
    return new Promise(function (resolve, reject) {
      const frame = document.getElementById('sheet-submit-frame');
      const timeoutId = window.setTimeout(function () {
        finish(new Error('Le service de commande ne répond pas. Vérifiez le déploiement Google Apps Script.'));
      }, 45000);

      function finish(error, result) {
        window.removeEventListener('message', onMessage);
        window.clearTimeout(timeoutId);
        if (error) reject(error);
        else resolve(result);
      }

      function onMessage(event) {
        if (event.source !== frame.contentWindow || !event.data ||
            event.data.source !== 'rihal-souss-sheet' || event.data.token !== order.requestToken) return;
        if (event.data.ok) finish(null, event.data);
        else finish(new Error(event.data.message || 'La commande n’a pas pu être enregistrée.'));
      }

      window.addEventListener('message', onMessage);
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = endpoint;
      form.target = frame.name;
      form.hidden = true;
      [
        ['payload', JSON.stringify(order)],
        ['website', '']
      ].forEach(function (entry) {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = entry[0];
        input.value = entry[1];
        form.appendChild(input);
      });
      document.body.appendChild(form);
      try {
        form.submit();
      } catch (error) {
        finish(new Error('Impossible d’envoyer la commande au service Google Sheets.'));
      } finally {
        form.remove();
      }
    });
  }

  function finishOrder(order) {
    lastOrder = order;
    cart = [];
    saveCart();
    updateCartCount();
    document.getElementById('confirmation-copy').textContent =
      'Nous avons bien reçu votre commande. Notre équipe vous appellera prochainement au numéro indiqué pour confirmer les détails de la livraison.';
    document.getElementById('confirmation-notice').textContent =
      'Le paiement se fera à la livraison. Gardez votre téléphone à portée pour que la coopérative puisse vous joindre.';
    window.location.hash = 'accueil';
  }

  function showScreen(name) {
    screens.forEach(function (screen) {
      document.getElementById('screen-' + screen).hidden = screen !== name;
    });
  }

  function renderConfirmation(order) {
    document.getElementById('confirmation-name').textContent = order.name;
    const lines = order.items.map(function (entry) {
      const product = productById(entry.id);
      return '<div class="summary-line"><span>' + escapeHtml(product.name) + ' × ' + entry.quantity + '</span><span>' + formatPrice(product.price * entry.quantity) + '</span></div>';
    }).join('');
    document.getElementById('confirmation-summary').innerHTML =
      '<h3>Commande ' + escapeHtml(order.reference) + '</h3>' + lines +
      '<div class="summary-line summary-total"><span>Total produits</span><span>' + formatPrice(order.total) + '</span></div>' +
      '<div class="summary-line"><span>Paiement</span><span>À la livraison</span></div>' +
      '<div class="summary-line"><span>Livraison à</span><span>' + escapeHtml(order.city) + '</span></div>';
  }

  function navigate() {
    const requested = window.location.hash.slice(1) || 'accueil';
    const page = screens.includes(requested) ? requested : 'accueil';
    if (page === 'produit') renderProductDetail();
    if (page === 'panier') renderCart();
    if (page === 'commande') {
      if (!cart.length) {
        window.location.hash = 'panier';
        return;
      }
      renderCheckout();
    }
    if (page === 'confirmation') {
      if (!lastOrder) {
        window.location.hash = 'accueil';
        return;
      }
      renderConfirmation(lastOrder);
    }
    showScreen(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  document.querySelectorAll('[data-category]').forEach(function (button) {
    button.addEventListener('click', function () {
      activeCategory = button.dataset.category;
      document.querySelectorAll('[data-category]').forEach(function (item) {
        const selected = item === button;
        item.classList.toggle('is-active', selected);
        item.setAttribute('aria-pressed', String(selected));
      });
      renderProducts();
    });
  });

  document.getElementById('product-search').addEventListener('input', renderProducts);
  document.getElementById('product-grid').addEventListener('click', function (event) {
    const link = event.target.closest('[data-product-id]');
    if (link) {
      event.preventDefault();
      window.location.hash = 'produit';
    }
  });

  document.addEventListener('click', function (event) {
    const whatsappLink = event.target.closest('#whatsapp-button, #whatsapp-floating');
    if (whatsappLink && whatsappLink.getAttribute('aria-disabled') === 'true') {
      event.preventDefault();
      showToast('Configurez le numéro WhatsApp de la coopérative.');
    }

    const addButton = event.target.closest('[data-add-product]');
    if (addButton) {
      const existing = cart.find(function (item) { return item.id === addButton.dataset.addProduct; });
      if (existing) existing.quantity += 1;
      else cart.push({ id: addButton.dataset.addProduct, quantity: 1 });
      saveCart();
      updateCartCount();
      showToast('Produit ajouté au panier.');
    }

    const quantityButton = event.target.closest('[data-quantity]');
    if (quantityButton) {
      const entry = cart.find(function (item) { return item.id === quantityButton.dataset.id; });
      if (entry) entry.quantity += Number(quantityButton.dataset.quantity);
      cart = cart.filter(function (item) { return item.quantity > 0; });
      saveCart();
      updateCartCount();
      renderCart();
    }

    const removeButton = event.target.closest('[data-remove]');
    if (removeButton) {
      cart = cart.filter(function (item) { return item.id !== removeButton.dataset.remove; });
      saveCart();
      updateCartCount();
      renderCart();
    }
  });

  document.getElementById('checkout-form').addEventListener('submit', function (event) {
    event.preventDefault();
    if (isSubmitting || !cart.length || !event.currentTarget.reportValidity()) return;
    const endpoint = getSheetEndpoint();
    if (endpoint === null) {
      showToast('L’adresse Google Sheets configurée est invalide.');
      return;
    }
    if (!endpoint) {
      showToast('Google Sheets n’est pas encore configuré. La commande ne peut pas être envoyée.');
      return;
    }
    const consent = document.getElementById('order-consent');
    if (!consent.checked) return;
    const formData = new FormData(event.currentTarget);
    const reference = 'RS-' + String(Date.now()) + '-' + Math.floor(Math.random() * 10000);
    const order = {
      reference: reference,
      requestToken: reference,
      name: formData.get('name').trim(),
      phone: formData.get('phone').trim(),
      city: formData.get('city').trim(),
      address: formData.get('address').trim(),
      consent: true,
      items: cart.map(function (item) { return { id: item.id, quantity: item.quantity }; }),
      total: store.calculateSubtotal(cart)
    };
    const submitButton = event.currentTarget.querySelector('[type="submit"]');
    isSubmitting = true;
    submitButton.disabled = true;
    submitOrderToSheet(endpoint, order).then(function () {
      finishOrder(order);
    }).catch(function (error) {
      console.error('Échec de l’envoi vers Google Sheets.', error);
      document.getElementById('checkout-notice').textContent =
        'Votre commande n’a pas pu être transmise. Vos informations restent dans le formulaire. Réessayez ou contactez-nous sur WhatsApp.';
    }).finally(function () {
      isSubmitting = false;
      submitButton.disabled = false;
    });
  });

  window.addEventListener('hashchange', navigate);
  configureWhatsApp();
  renderProducts();
  updateCartCount();
  navigate();
}());
