(function (root, factory) {
  const integrations = factory();
  if (typeof module === 'object' && module.exports) module.exports = integrations;
  if (root) root.RihalIntegrations = integrations;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function whatsappUrl(value) {
    const number = String(value || '').trim();
    if (!/^\+?[0-9 ()-]+$/.test(number)) return '';
    const digits = number.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) return '';
    return 'https://wa.me/' + digits;
  }

  function isAppsScriptEndpoint(value) {
    try {
      const url = new URL(String(value || ''));
      return url.protocol === 'https:' &&
        url.hostname === 'script.google.com' &&
        /^\/macros\/s\/[A-Za-z0-9_-]+\/exec\/?$/.test(url.pathname);
    } catch (error) {
      return false;
    }
  }

  return Object.freeze({ whatsappUrl: whatsappUrl, isAppsScriptEndpoint: isAppsScriptEndpoint });
}));
