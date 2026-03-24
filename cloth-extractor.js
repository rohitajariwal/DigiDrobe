// cloth-extractor.js
// Uses BodyPix to create a transparent PNG that contains only the upper-body clothing area (shirt).
// export: extractClothing(dataURL) -> Promise<dataURL-of-transparent-png>

(function(global) {
    'use strict';

    // bodyPixNet singleton
    let net = null;
    async function ensureNet() {
        if (net) return net;
        if (typeof bodyPix === 'undefined') {
            throw new Error('BodyPix not available in the page.');
        }
        net = await bodyPix.load({
            architecture: 'MobileNetV1',
            outputStride: 16,
            multiplier: 0.75,
            quantBytes: 2
        });
        console.log('BodyPix loaded.');
        return net;
    }

    function loadImage(dataURL) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => resolve(img);
            img.onerror = (e) => reject(new Error('Image load failed: ' + (e && e.message)));
            img.src = dataURL;
        });
    }

    function colorDistanceSq(a, b) {
        const dr = a[0] - b[0];
        const dg = a[1] - b[1];
        const db = a[2] - b[2];
        return dr * dr + dg * dg + db * db;
    }

    function sampleBorderColor(px, width, height, step) {
        const samples = [];
        const push = (idx) => {
            const base = idx * 4;
            samples.push([px[base], px[base + 1], px[base + 2]]);
        };
        const rowStep = Math.max(1, Math.floor(width / step));
        const colStep = Math.max(1, Math.floor(height / step));

        for (let x = 0; x < width; x += rowStep) {
            push(x);
            push((height - 1) * width + x);
        }
        for (let y = 0; y < height; y += colStep) {
            push(y * width);
            push(y * width + (width - 1));
        }

        if (!samples.length) return [255, 255, 255];
        const totals = samples.reduce((acc, cur) => {
            acc[0] += cur[0];
            acc[1] += cur[1];
            acc[2] += cur[2];
            return acc;
        }, [0, 0, 0]);
        const len = samples.length || 1;
        return [totals[0] / len, totals[1] / len, totals[2] / len];
    }

    function exportTrimmedCanvas(canvas, maxOutput = 1024) {
        const ctx = canvas.getContext('2d');
        const { width, height } = canvas;
        const imgData = ctx.getImageData(0, 0, width, height);
        const data = imgData.data;

        let minX = width,
            minY = height,
            maxX = 0,
            maxY = 0;
        for (let y = 0; y < height; y++) {
            for (let x = 0; x < width; x++) {
                const base = (y * width + x) * 4;
                const alpha = data[base + 3];
                if (alpha > 12) {
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                }
            }
        }

        if (maxX < minX || maxY < minY) {
            // nothing found — return full canvas as PNG
            return canvas.toDataURL('image/png');
        }

        const cropW = maxX - minX + 1;
        const cropH = maxY - minY + 1;
        const out = document.createElement('canvas');
        const scale = Math.min(1, maxOutput / Math.max(cropW, cropH));
        out.width = Math.max(1, Math.floor(cropW * scale));
        out.height = Math.max(1, Math.floor(cropH * scale));
        const outCtx = out.getContext('2d');
        outCtx.drawImage(canvas, minX, minY, cropW, cropH, 0, 0, out.width, out.height);
        return out.toDataURL('image/png');
    }

    // small morphological alpha smoothing: erode/dilate style for alpha channel
    function morphAlpha(px, width, height, opts = {}) {
        const radius = opts.radius || 3;
        const passes = opts.passes || 2;
        const total = width * height;
        let alpha = new Uint8ClampedArray(total);
        for (let i = 0; i < total; i++) alpha[i] = px[i * 4 + 3];

        // dilate then erode (opening/closing) loop
        const dilate = (src) => {
            const dst = new Uint8ClampedArray(total);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    let hit = 0;
                    for (let dy = -radius; dy <= radius && !hit; dy++) {
                        const ny = y + dy;
                        if (ny < 0 || ny >= height) continue;
                        const row = ny * width;
                        for (let dx = -radius; dx <= radius; dx++) {
                            const nx = x + dx;
                            if (nx < 0 || nx >= width) continue;
                            if (src[row + nx] > 12) { hit = 255; break; }
                        }
                    }
                    dst[y * width + x] = hit;
                }
            }
            return dst;
        };

        const erode = (src) => {
            const dst = new Uint8ClampedArray(total);
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    let keep = 255;
                    for (let dy = -radius; dy <= radius && keep; dy++) {
                        const ny = y + dy;
                        if (ny < 0 || ny >= height) continue;
                        const row = ny * width;
                        for (let dx = -radius; dx <= radius; dx++) {
                            const nx = x + dx;
                            if (nx < 0 || nx >= width) continue;
                            if (src[row + nx] <= 12) { keep = 0; break; }
                        }
                    }
                    dst[y * width + x] = keep;
                }
            }
            return dst;
        };

        let cur = alpha;
        for (let i = 0; i < passes; i++) cur = erode(dilate(cur));
        for (let i = 0; i < total; i++) px[i * 4 + 3] = cur[i];

        if (opts.blur && opts.blur > 0) {
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            const imgData = new ImageData(new Uint8ClampedArray(px), width, height);
            ctx.putImageData(imgData, 0, 0);
            ctx.globalCompositeOperation = 'destination-out';
            ctx.filter = `blur(${opts.blur}px)`;
            ctx.drawImage(canvas, 0, 0);
            ctx.globalCompositeOperation = 'source-over';
            const blurred = ctx.getImageData(0, 0, width, height).data;
            for (let i = 0; i < total; i++) {
                px[i * 4 + 3] = Math.max(px[i * 4 + 3], blurred[i * 4 + 3]);
            }
        }
    }

    function removeFlatBackgroundFromImage(img, opts = {}) {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, img.width, img.height);
        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        const px = imgData.data;

        const threshold = opts.chromaThreshold || 2200; // distance squared (~47^2)
        const borderSampleStep = opts.borderSampleStep || 40;
        const bgColor = sampleBorderColor(px, img.width, img.height, borderSampleStep);

        for (let i = 0; i < px.length; i += 4) {
            const dist = colorDistanceSq([px[i], px[i + 1], px[i + 2]], bgColor);
            if (dist < threshold) px[i + 3] = 0;
        }

        morphAlpha(px, img.width, img.height, {
            radius: opts.morphRadius || 3,
            passes: opts.morphPasses || 2,
            blur: opts.morphBlur || 0.8
        });

        ctx.putImageData(imgData, 0, 0);
        return exportTrimmedCanvas(canvas, opts.maxOutput || 1024);
    }

    // main extractor: returns a dataURL PNG (transparent background) containing the cropped clothing area
    // Accepts EITHER:
    // - a base64 data URL ("data:image/...") OR
    // - a direct image URL ("https://...")
    //
    // For data URLs we send image_file_b64 to remove.bg.
    // For plain URLs we send image_url directly, so we can still remove background
    // even when the browser cannot convert the remote image to a data URL (CORS).
    async function extractClothing(source) {
  const API_KEY = 'FxNhNbY3sSkZCFv5NZb1Bm4D';

  const payload = {};

  if (typeof source === 'string' && source.startsWith('data:')) {
    // data URL: extract base64
    const base64 = source.split(',')[1];
    payload.image_file_b64 = base64;
  } else {
    // treat as remote image URL
    payload.image_url = source;
  }

  const response = await fetch('https://api.remove.bg/v1.0/removebg', {
    method: 'POST',
    headers: {
      'X-Api-Key': API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      ...payload,
      size: 'auto'
    })
  });

  if (!response.ok) {
    throw new Error('Background removal failed');
  }

  const blob = await response.blob();
  return await blobToDataURL(blob);
}

function blobToDataURL(blob) {
  return new Promise(resolve => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.readAsDataURL(blob);
  });
}


    // export
    global.extractClothing = extractClothing;

})(window);