const test = require('node:test');
const assert = require('node:assert/strict');
const store = require('../js/store.js');

test('catalogue uses the recorded product name and price', () => {
  assert.equal(store.products.length, 1);
  assert.equal(store.products[0].name, "Amlou d'amandes");
  assert.equal(store.products[0].price, 140);
  assert.equal(store.products[0].unit, 'kg');
});

test('cart normalization drops unknown products and invalid quantities', () => {
  assert.deepEqual(store.normalizeCart([
    { id: 'amlou-amandes', quantity: 2 },
    { id: 'unknown', quantity: 1 },
    { id: 'amlou-amandes', quantity: 0 },
    { id: 'amlou-amandes', quantity: 1.5 }
  ]), [{ id: 'amlou-amandes', quantity: 2 }]);
});

test('subtotal multiplies the listed price by valid quantities only', () => {
  assert.equal(store.calculateSubtotal([{ id: 'amlou-amandes', quantity: 3 }]), 420);
  assert.equal(store.calculateSubtotal([{ id: 'unknown', quantity: 3 }]), 0);
});
