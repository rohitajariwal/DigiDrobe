// measurement-config.js
// Standard size mappings and adult validation ranges

(function(global) {
    'use strict';

    // Standard adult clothing size mappings (in inches)
    // These represent typical adult measurements for each size
    const STANDARD_SIZES = {
        XS: {
            bust: { min: 32, max: 33 },
            waist: { min: 24, max: 25 },
            hips: { min: 34, max: 35 },
            height: { min: 60, max: 64 }
        },
        S: {
            bust: { min: 34, max: 35 },
            waist: { min: 26, max: 27 },
            hips: { min: 36, max: 37 },
            height: { min: 62, max: 66 }
        },
        M: {
            bust: { min: 36, max: 37 },
            waist: { min: 28, max: 29 },
            hips: { min: 38, max: 39 },
            height: { min: 64, max: 68 }
        },
        L: {
            bust: { min: 38, max: 40 },
            waist: { min: 30, max: 32 },
            hips: { min: 40, max: 42 },
            height: { min: 66, max: 70 }
        },
        XL: {
            bust: { min: 41, max: 43 },
            waist: { min: 33, max: 35 },
            hips: { min: 43, max: 45 },
            height: { min: 66, max: 72 }
        },
        '2XL': {
            bust: { min: 44, max: 46 },
            waist: { min: 36, max: 38 },
            hips: { min: 46, max: 48 },
            height: { min: 66, max: 74 }
        }
    };

    // Adult-only measurement validation ranges (in inches)
    // Values outside these ranges are considered invalid (child or unrealistic)
    const ADULT_VALIDATION_RANGES = {
        bust: { min: 32, max: 50 },
        waist: { min: 24, max: 45 },
        hips: { min: 34, max: 55 },
        height: { min: 58, max: 78 }
    };

    // Convert inches to cm
    const INCH_TO_CM = 2.54;

    /**
     * Get measurements for a standard size
     * Returns average values for the size range in the specified unit
     * @param {string} size - Standard size (XS, S, M, L, XL, 2XL)
     * @param {string} unit - 'in' or 'cm'
     * @returns {Object|null} Measurements object with bust, waist, hips, height
     */
    function getStandardSizeMeasurements(size, unit = 'in') {
        if (!STANDARD_SIZES[size]) {
            return null;
        }

        const sizeData = STANDARD_SIZES[size];
        const measurements = {
            bust: (sizeData.bust.min + sizeData.bust.max) / 2,
            waist: (sizeData.waist.min + sizeData.waist.max) / 2,
            hips: (sizeData.hips.min + sizeData.hips.max) / 2,
            height: (sizeData.height.min + sizeData.height.max) / 2
        };

        // Convert to cm if needed
        if (unit === 'cm') {
            measurements.bust *= INCH_TO_CM;
            measurements.waist *= INCH_TO_CM;
            measurements.hips *= INCH_TO_CM;
            measurements.height *= INCH_TO_CM;
        }

        return measurements;
    }

    /**
     * Validate measurements against adult-only ranges
     * @param {Object} measurements - Object with bust, waist, hips, height
     * @param {string} unit - 'in' or 'cm' (measurements should already be in this unit)
     * @returns {Object} Validation result with isValid, errors array, and invalidFields
     */
    function validateAdultMeasurements(measurements, unit = 'in') {
        const errors = [];
        const invalidFields = [];
        
        // Convert validation ranges to the same unit as measurements
        const ranges = { ...ADULT_VALIDATION_RANGES };
        if (unit === 'cm') {
            Object.keys(ranges).forEach(key => {
                ranges[key] = {
                    min: ranges[key].min * INCH_TO_CM,
                    max: ranges[key].max * INCH_TO_CM
                };
            });
        }

        // Validate each measurement
        if (measurements.bust !== undefined && measurements.bust !== null && !isNaN(measurements.bust)) {
            const bust = parseFloat(measurements.bust);
            if (bust < ranges.bust.min || bust > ranges.bust.max) {
                errors.push(`Bust measurement (${bust.toFixed(1)} ${unit}) is outside adult range (${ranges.bust.min.toFixed(1)}-${ranges.bust.max.toFixed(1)} ${unit})`);
                invalidFields.push('bust');
            }
        }

        if (measurements.waist !== undefined && measurements.waist !== null && !isNaN(measurements.waist)) {
            const waist = parseFloat(measurements.waist);
            if (waist < ranges.waist.min || waist > ranges.waist.max) {
                errors.push(`Waist measurement (${waist.toFixed(1)} ${unit}) is outside adult range (${ranges.waist.min.toFixed(1)}-${ranges.waist.max.toFixed(1)} ${unit})`);
                invalidFields.push('waist');
            }
        }

        if (measurements.hips !== undefined && measurements.hips !== null && !isNaN(measurements.hips)) {
            const hips = parseFloat(measurements.hips);
            if (hips < ranges.hips.min || hips > ranges.hips.max) {
                errors.push(`Hips measurement (${hips.toFixed(1)} ${unit}) is outside adult range (${ranges.hips.min.toFixed(1)}-${ranges.hips.max.toFixed(1)} ${unit})`);
                invalidFields.push('hips');
            }
        }

        if (measurements.height !== undefined && measurements.height !== null && !isNaN(measurements.height)) {
            const height = parseFloat(measurements.height);
            if (height < ranges.height.min || height > ranges.height.max) {
                errors.push(`Height measurement (${height.toFixed(1)} ${unit}) is outside adult range (${ranges.height.min.toFixed(1)}-${ranges.height.max.toFixed(1)} ${unit})`);
                invalidFields.push('height');
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors,
            invalidFields: invalidFields
        };
    }

    /**
     * Get all available standard sizes
     * @returns {Array<string>} Array of size names
     */
    function getAvailableSizes() {
        return Object.keys(STANDARD_SIZES);
    }

    // Export to global scope
    if (typeof global.MeasurementConfig === 'undefined') {
        global.MeasurementConfig = {
            getStandardSizeMeasurements: getStandardSizeMeasurements,
            validateAdultMeasurements: validateAdultMeasurements,
            getAvailableSizes: getAvailableSizes,
            STANDARD_SIZES: STANDARD_SIZES,
            ADULT_VALIDATION_RANGES: ADULT_VALIDATION_RANGES
        };
    }

})(typeof window !== 'undefined' ? window : this);

