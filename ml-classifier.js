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
                // Timeout after 5 seconds
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

            // 5. Log prediction results
            console.log('[TM] Prediction result:', {
                className: best.className,
                probability: best.probability.toFixed(3),
                allPredictions: predictions.map(p => ({ class: p.className, prob: p.probability.toFixed(3) }))
            });

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
