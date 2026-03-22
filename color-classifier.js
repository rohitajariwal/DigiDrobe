// color-classifier.js
// Lightweight dominant color detection for uploaded clothing images (dataURL/base64).
// Exposes: window.ColorClassifier.getDominantColorFromDataURL(dataURL) -> Promise<{ name, hex }>
(function (global) {
  'use strict';

  function clamp01(x) {
    return Math.max(0, Math.min(1, x));
  }

  function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h *= 60;
    }
    return { h, s, l };
  }

  function toHex(r, g, b) {
    const hex = (v) => v.toString(16).padStart(2, '0');
    return `#${hex(r)}${hex(g)}${hex(b)}`;
  }

  function hueToName(h) {
    // Wrap hue into [0,360)
    const hue = ((h % 360) + 360) % 360;
    // Improved hue ranges for better color accuracy
    if (hue >= 350 || hue < 10) return 'Red';
    if (hue >= 10 && hue < 30) return 'Orange';
    if (hue >= 30 && hue < 60) return 'Yellow';
    if (hue >= 60 && hue < 150) return 'Green';
    if (hue >= 150 && hue < 180) return 'Cyan';
    if (hue >= 180 && hue < 240) return 'Blue';
    if (hue >= 240 && hue < 280) return 'Purple';
    if (hue >= 280 && hue < 350) return 'Pink';
    return 'Red'; // fallback
  }

  async function getDominantColorFromDataURL(dataURL) {
    return new Promise((resolve) => {
      if (!dataURL || typeof dataURL !== 'string') {
        console.warn('ColorClassifier: Invalid dataURL provided');
        return resolve({ name: 'Unknown', hex: '#808080' });
      }
      
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          if (!ctx) {
            console.warn('ColorClassifier: Could not get canvas context');
            return resolve({ name: 'Unknown', hex: '#808080' });
          }

          // Use larger sample size for better color accuracy
          // Increased from 48x48 to 96x96 for better color detection
          const W = 96, H = 96;
          canvas.width = W;
          canvas.height = H;
          ctx.drawImage(img, 0, 0, W, H);
          const { data } = ctx.getImageData(0, 0, W, H);

          // We score buckets by "colorfulness" so vivid garment colors beat neutral backgrounds.
          // This fixes common cases like red clothes on gray/white backgrounds.
          const scoreByBucket = Object.create(null);
          const sumByBucket = Object.create(null);

          const bump = (bucket, r, g, b, w) => {
            const ww = Math.max(0, w || 0);
            scoreByBucket[bucket] = (scoreByBucket[bucket] || 0) + ww;
            if (!sumByBucket[bucket]) sumByBucket[bucket] = { r: 0, g: 0, b: 0, w: 0 };
            sumByBucket[bucket].r += r * ww;
            sumByBucket[bucket].g += g * ww;
            sumByBucket[bucket].b += b * ww;
            sumByBucket[bucket].w += ww;
          };

          let kept = 0;
          // Reduced border exclusion for better coverage (was 12%, now 8%)
          // This helps capture more of the clothing item
          const x0 = Math.floor(W * 0.08);
          const x1 = Math.ceil(W * 0.92);
          const y0 = Math.floor(H * 0.08);
          const y1 = Math.ceil(H * 0.92);

          for (let y = y0; y < y1; y++) {
            for (let x = x0; x < x1; x++) {
              const i = (y * W + x) * 4;
              const r = data[i], g = data[i + 1], b = data[i + 2];
              const a = data[i + 3];
              if (a !== undefined && a < 8) continue;
              const { h, s, l } = rgbToHsl(r, g, b);

              // More lenient thresholds - only ignore very pure white/black backgrounds
              // This helps detect pastel and light colors better
              // Made more strict to only filter out truly pure backgrounds
              if (l >= 0.995 && s < 0.02) continue;     // very pure white background only
              if (l <= 0.005 && s < 0.02) continue;     // very pure black background only

              // Improved chroma calculation - better detection of subtle colors
              // Use saturation directly for better color detection
              const chroma = clamp01(s);
              
              // Center weighting (more emphasis in the middle of the image)
              const dx = Math.abs((x + 0.5) / W - 0.5);
              const dy = Math.abs((y + 0.5) / H - 0.5);
              const centerW = clamp01(1 - Math.max(dx, dy) / 0.5); // 1 at center, 0 at edges

              // Improved weighting: prefer colorful pixels, but don't completely ignore low-saturation colors
              // This helps with pastel colors and muted tones
              const saturationWeight = Math.pow(chroma, 0.8); // Less aggressive - allow more colors
              const lightnessWeight = 1 - Math.abs(l - 0.5) * 0.8; // More lenient - allow light and dark colors
              const colorW = saturationWeight * Math.max(0.3, lightnessWeight) * (0.5 + 0.5 * centerW);

              // Lower chroma threshold to better detect subtle colors
              // Only classify as grayscale if saturation is very low
              if (chroma < 0.05) {
                // True grayscale (very low saturation)
                const grayW = 0.1 * (0.4 + 0.6 * centerW); // Slightly higher weight for grays
                if (l > 0.85) bump('White', r, g, b, grayW);
                else if (l < 0.15) bump('Black', r, g, b, grayW);
                else bump('Gray', r, g, b, grayW);
                kept++;
                continue;
              }

              // For colors with any saturation, use hue-based classification
              const name = hueToName(h);
              bump(name, r, g, b, colorW);
              kept++;
          }
          }

          if (!kept) {
            console.warn('ColorClassifier: No pixels kept after filtering');
            return resolve({ name: 'Unknown', hex: '#808080' });
          }

          // Pick max bucket by weighted score
          let best = null;
          let bestScore = -1;
          Object.keys(scoreByBucket).forEach((k) => {
            if (scoreByBucket[k] > bestScore) {
              bestScore = scoreByBucket[k];
              best = k;
            }
          });

          // If no color was detected with sufficient confidence, return Unknown
          // Lowered threshold significantly to catch more colors
          if (!best || bestScore < 0.0001) {
            console.warn('ColorClassifier: No color detected with sufficient confidence. Best:', best, 'Score:', bestScore, 'Buckets:', Object.keys(scoreByBucket));
            return resolve({ name: 'Unknown', hex: '#808080' });
          }
          
          console.log('ColorClassifier: Detected color', best, 'with score', bestScore, 'from', Object.keys(scoreByBucket).length, 'buckets');

          const s = sumByBucket[best];
          if (!s || !s.w) return resolve({ name: best, hex: '#808080' });

          const rr = Math.round(Math.max(0, Math.min(255, s.r / s.w)));
          const gg = Math.round(Math.max(0, Math.min(255, s.g / s.w)));
          const bb = Math.round(Math.max(0, Math.min(255, s.b / s.w)));
          resolve({ name: best, hex: toHex(rr, gg, bb) });
        } catch (e) {
          resolve({ name: 'Unknown', hex: '#808080' });
        }
      };
      img.onerror = (err) => {
        console.warn('ColorClassifier: Image load error', err);
        resolve({ name: 'Unknown', hex: '#808080' });
      };
      img.src = dataURL;
    });
  }

  global.ColorClassifier = {
    getDominantColorFromDataURL,
  };
})(window);


