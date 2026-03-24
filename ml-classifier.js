// ml-classifier.js
// Teachable Machine Image Classifier (SAFE + VERBOSE)

(function(global) {
    'use strict';

    // 1. Load model from "./model/model.json" and "./model/metadata.json"
    const MODEL_URL = './model/model.json';
    const METADATA_URL = './model/metadata.json';

    let model = null;
    let maxPredictions = 0;
    let isLoaded = false;

    async function loadModel() {
        try {
            console.log('[TM] Loading model from:', MODEL_URL, 'and', METADATA_URL);

            // 2. Ensure tf.min.js and teachablemachine-image.min.js compatibility
            if (typeof tmImage === 'undefined') {
                throw new Error('tmImage not found. Ensure teachablemachine-image.min.js is loaded before this script.');
            }
            if (typeof tf === 'undefined') {
                throw new Error('TensorFlow.js not loaded. Ensure tf.min.js is loaded before this script.');
            }

            console.log('[TM] TensorFlow.js version:', tf.version);
            console.log('[TM] tmImage available:', typeof tmImage !== 'undefined');

            // Load model using tmImage.load
            model = await tmImage.load(MODEL_URL, METADATA_URL);
            maxPredictions = model.getTotalClasses();
            isLoaded = true;

            // 5. Log successful load
            console.log('[TM] Model loaded successfully.');
            console.log('[TM] Total classes:', maxPredictions);
            console.log('[TM] Class labels:', model.getClassLabels());

            updateStatusUI(true);
        } catch (err) {
            console.error('[TM] Model load failed:', err);
            isLoaded = false;
            updateStatusUI(false);
        }
    }

    function updateStatusUI(ok) {
        const el = document.getElementById('modelStatus');
        if (!el) return;

        if (ok) {
            el.textContent = 'Model: ready';
            el.style.color = '#9BE7A1';
        } else {
            el.textContent = 'Model: failed';
            el.style.color = '#FF6B6B';
        }
    }

    // Minimum confidence: below this the model is guessing, so use aspect-ratio heuristic
    const MIN_CONFIDENCE = 0.55;

    // Use image aspect ratio to help disambiguate dresses vs tops/skirts
    // Dresses are tall (full-body); shirts/tops are wider/shorter; skirts are short
    function aspectHeuristic(img, predictions) {
        const ratio = img.naturalHeight / (img.naturalWidth || 1);
        // Sort predictions by probability descending
        const sorted = predictions.slice().sort((a, b) => b.probability - a.probability);
        const top1 = sorted[0];
        const top2 = sorted.length > 1 ? sorted[1] : null;

        // If the top two are close (within 15%) and one is Dress, use aspect ratio to decide
        if (top2 && Math.abs(top1.probability - top2.probability) < 0.15) {
            const candidates = [top1.className, top2.className];
            // Tall items (ratio > 1.3) are more likely dresses than skirts or shirts
            if (candidates.includes('Dress') && ratio > 1.3) {
                console.log('[TM] Aspect heuristic: tall image (' + ratio.toFixed(2) + ') → Dress');
                return 'Dress';
            }
            // Wide/short items are unlikely to be dresses
            if (candidates.includes('Dress') && ratio < 0.9) {
                const other = candidates.find(c => c !== 'Dress') || top1.className;
                console.log('[TM] Aspect heuristic: wide image (' + ratio.toFixed(2) + ') → ' + other);
                return other;
            }
        }

        // If confidence is very low, use aspect ratio as primary signal
        if (top1.probability < MIN_CONFIDENCE) {
            if (ratio > 1.4) {
                // Tall garment: likely Dress or Trouser/Jeans
                const dressProb = sorted.find(p => p.className === 'Dress');
                const trouserProb = sorted.find(p => p.className === 'Trouser/Jeans');
                if (dressProb && trouserProb && dressProb.probability > trouserProb.probability) {
                    console.log('[TM] Low confidence + tall → Dress');
                    return 'Dress';
                }
            }
        }

        return null; // no override
    }

    async function classifyBase64(dataURL) {
        if (!isLoaded || !model) {
            console.warn('[TM] classifyBase64 called before model ready.');
            return 'Uncategorized';
        }

        if (!dataURL || typeof dataURL !== 'string') {
            console.warn('[TM] classifyBase64: Invalid dataURL provided');
            return 'Uncategorized';
        }

        try {
            const img = new Image();
            img.src = dataURL;

            await new Promise((resolve, reject) => {
                img.onload = resolve;
                img.onerror = () => reject(new Error('Failed to load image from dataURL'));
                setTimeout(() => reject(new Error('Image load timeout')), 5000);
            });

            const predictions = await model.predict(img, false);

            if (!predictions || predictions.length === 0) {
                console.warn('[TM] No predictions returned from model');
                return 'Uncategorized';
            }

            let best = predictions[0];
            for (const p of predictions) {
                if (p.probability > best.probability) best = p;
            }

            // Log all predictions for debugging
            console.log('[TM] Prediction result:', {
                className: best.className,
                probability: best.probability.toFixed(3),
                allPredictions: predictions.map(p => ({ class: p.className, prob: p.probability.toFixed(3) })),
                aspectRatio: (img.naturalHeight / (img.naturalWidth || 1)).toFixed(2)
            });

            // If confidence is low or top candidates are close, use aspect-ratio heuristic
            // This is the key fix for dresses being misclassified as skirts/shirts
            if (best.probability < 0.75) {
                const override = aspectHeuristic(img, predictions);
                if (override) {
                    console.log('[TM] Heuristic override:', best.className, '→', override,
                        '(confidence was', best.probability.toFixed(3) + ')');
                    return override;
                }
            }

            // If confidence is very low, return Uncategorized so user can manually select
            if (best.probability < 0.35) {
                console.warn('[TM] Very low confidence (' + best.probability.toFixed(3) + '), marking as Uncategorized');
                return 'Uncategorized';
            }

            return best.className;
        } catch (err) {
            console.error('[TM] Classification error:', err);
            return 'Uncategorized';
        }
    }

    // 3. Expose a global object: window.Classifier with methods: load(), classifyBase64(dataURL), isReady()
    global.Classifier = {
        load: loadModel,
        classifyBase64: classifyBase64,
        isReady: () => isLoaded
    };

    // 4. Automatically load model on DOMContentLoaded
    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', loadModel);
        } else {
            // DOMContentLoaded already fired, load immediately
            loadModel();
        }
    }

    // Start initialization
    init();

})(window);
