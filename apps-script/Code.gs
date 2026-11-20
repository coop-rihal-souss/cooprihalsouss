const SPREADSHEET_ID = '137FcpMM0i0u28eNmjA7hy6lzY3G86LzG9Z3VGJPZnoI';
const SHEET_NAME = 'Commandes';

const PRODUCTS = Object.freeze({
  'amlou-amandes': Object.freeze({ name: "Amlou d'amandes", price: 140 })
});

function doPost(e) {
  const params = e && e.parameter ? e.parameter : {};
  let token = '';

  try {
    if (String(params.website || '').trim()) {
      throw new Error('Requête invalide.');
    }

    const order = JSON.parse(String(params.payload || '{}'));
    token = typeof order.requestToken === 'string' ? order.requestToken : '';
    const validated = validateOrder_(order);
    const sheet = getOrdersSheet_();
    const lock = LockService.getScriptLock();
    lock.waitLock(10000);

    try {
      if (sheet.getLastRow() === 0) {
        sheet.appendRow([
          'Date', 'Référence', 'Nom', 'Téléphone', 'Ville',
          'Adresse', 'Produits', 'Total (MAD)', 'Statut'
        ]);
      }

      const lastRow = sheet.getLastRow();
      const existingOrder = lastRow > 1
        ? sheet.getRange(2, 2, lastRow - 1, 1)
          .createTextFinder(validated.reference)
          .matchEntireCell(true)
          .findNext()
        : null;

      if (!existingOrder) {
        sheet.appendRow([
          new Date(),
          validated.reference,
          validated.name,
          validated.phone,
          validated.city,
          validated.address,
          validated.items,
          validated.total,
          'Nouvelle'
        ]);
      }
    } finally {
      lock.releaseLock();
    }

    return response_(token, true);
  } catch (error) {
    console.error(error);
    return response_(token, false);
  }
}

function validateOrder_(order) {
  const reference = String(order.reference || '');
  if (!/^RS-\d+-\d+$/.test(reference) ||
      order.requestToken !== reference ||
      order.consent !== true) {
    throw new Error('Commande invalide.');
  }

  if (!Array.isArray(order.items) || order.items.length === 0) {
    throw new Error('Panier invalide.');
  }

  let total = 0;
  const items = order.items.map(function (item) {
    const id = String(item.id || '');
    if (!Object.prototype.hasOwnProperty.call(PRODUCTS, id)) {
      throw new Error('Produit invalide.');
    }

    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      throw new Error('Quantité invalide.');
    }

    const product = PRODUCTS[id];
    total += product.price * quantity;
    return product.name + ' x ' + quantity;
  });

  return {
    reference: reference,
    name: textCell_(order.name, 120),
    phone: textCell_(order.phone, 40),
    city: textCell_(order.city, 120),
    address: textCell_(order.address, 500),
    items: items.join(', '),
    total: total
  };
}

function textCell_(value, maxLength) {
  const text = String(value || '').trim();
  if (!text || text.length > maxLength) {
    throw new Error('Coordonnées invalides.');
  }
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}

function getOrdersSheet_() {
  if (SPREADSHEET_ID === 'REMPLACER_PAR_ID_DU_GOOGLE_SHEET') {
    throw new Error('Configurez l’identifiant du Google Sheet.');
  }

  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  return spreadsheet.getSheetByName(SHEET_NAME) || spreadsheet.insertSheet(SHEET_NAME);
}

function response_(token, ok) {
  const message = JSON.stringify({
    source: 'rihal-souss-sheet',
    token: token,
    ok: ok
  }).replace(/</g, '\\u003c');
  const html = '<!doctype html><html><body><script>' +
    'window.parent.postMessage(' + message + ', "*");' +
    '</script></body></html>';

  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}
