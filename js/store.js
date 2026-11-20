(function (root, factory) {
  const store = factory();
  if (typeof module === 'object' && module.exports) module.exports = store;
  if (root) root.RihalStore = store;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  const products = Object.freeze([
    Object.freeze({
      id: 'amlou-amandes',
      name: "Amlou d'amandes",
      category: 'Alimentaire',
      price: 140,
      unit: 'kg',
      description: 'Produit inscrit au catalogue disponible. Sa description et ses conseils d’utilisation restent à compléter par la coopérative.',
      imageLabel: 'Illustration décorative, pas une photo du produit.'
    })
  ]);

  function normalizeCart(cart) {
    if (!Array.isArray(cart)) return [];
    return cart.reduce(function (items, entry) {
      const product = products.find(function (item) { return item.id === entry.id; });
      const quantity = Number(entry.quantity);
      if (product && Number.isInteger(quantity) && quantity > 0) {
        items.push({ id: product.id, quantity: quantity });
      }
      return items;
    }, []);
  }

  function calculateSubtotal(cart) {
    return normalizeCart(cart).reduce(function (sum, entry) {
      const product = products.find(function (item) { return item.id === entry.id; });
      return sum + product.price * entry.quantity;
    }, 0);
  }

  return Object.freeze({ products: products, normalizeCart: normalizeCart, calculateSubtotal: calculateSubtotal });
}));
