(function (global) {
  'use strict';

  function mapToWardrobeCategory(text) {
    const t = (text || '').toLowerCase();
    if (!t) return 'Uncategorized';
    if (t.includes('dress') || t.includes('jumpsuit') || t.includes('romper')) return 'Dress';
    if (t.includes('skirt')) return 'Skirt';
    if (t.includes('jean')) return 'Jeans';
    if (t.includes('trouser') || t.includes('pant') || t.includes('bottom')) return 'Pants';
    if (t.includes('jacket') || t.includes('coat') || t.includes('hoodie') || t.includes('blazer')) return 'Jacket';
    if (t.includes('t-shirt') || t.includes('tshirt') || t.includes('tee')) return 'T-shirt';
    if (t.includes('top') || t.includes('shirt') || t.includes('blouse') || t.includes('tank') || t.includes('crop')) return 'Top';
    return 'Uncategorized';
  }

  async function fetchProductMeta(url) {
    const cleanUrl = (url || '').trim();

    // Block Google Images search/result pages explicitly – user must copy the direct image URL instead.
    if (/google\.com\/imgres|google\.com\/search/i.test(cleanUrl)) {
      throw new Error(
        'Google Images page links are not supported.\n\n' +
        'Please right-click the image → Open image in new tab → Copy image address.'
      );
    }

    if (!cleanUrl) {
      throw new Error('Please paste an image URL.');
    }

    // Basic sanity checks without making network requests (avoids CORS issues).
    const lower = cleanUrl.toLowerCase();
    if (!lower.startsWith('http://') && !lower.startsWith('https://')) {
      throw new Error('Please paste a valid image URL that starts with http:// or https://');
    }

    // Heuristic: look at the path extension before any query string.
    const withoutQuery = cleanUrl.split('?')[0];
    const ext = (withoutQuery.split('.').pop() || '').toLowerCase();
    const imageExts = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp', 'avif', 'svg'];

    if (!imageExts.includes(ext)) {
      throw new Error(
        'This URL may not be a direct image link.\n\n' +
        'Tip: Right-click the product image → Open image in new tab → Copy image address'
      );
    }

    // At this point we trust the URL as an image; the actual download
    // + CORS handling happens later in imageUrlToDataUrlBestEffort.
    return {
      name: 'Imported',
      imageUrls: [cleanUrl],
      categoryHint: '',
      provider: 'image-url',
      raw: { url: cleanUrl }
    };
  }

  global.ProductImporter = {
    fetchProductMeta,
    mapToWardrobeCategory
  };
})(window);
