/**
 * Lead Scoring Service
 * Scores leads based on data quality and business metrics
 */

/**
 * Default scoring configuration
 * Users can customize these weights in settings
 */
const DEFAULT_SCORING_CONFIG = {
    hasPhone: { points: 20, condition: 'Phone number exists' },
    hasWebsite: { points: 20, condition: 'Website URL exists' },
    hasEmail: { points: 15, condition: 'Business email found' },
    emailVerified: { points: 5, condition: 'Email passes verification' },
    ratingExcellent: { points: 15, condition: 'Rating >= 4.5 stars' },
    ratingGood: { points: 10, condition: 'Rating >= 4.0 stars' },
    reviewsHigh: { points: 10, condition: 'Reviews >= 100' },
    reviewsMedium: { points: 5, condition: 'Reviews >= 50' },
    whatsappAvailable: { points: 5, condition: 'WhatsApp available' },
    hasAddress: { points: 5, condition: 'Address exists' },
    hasCategory: { points: 5, condition: 'Category exists' }
};

/**
 * Calculate lead score for a business
 * @param {Object} business - Business data object
 * @param {Object} config - Optional custom scoring config
 * @returns {{score: number, breakdown: Object, grade: string}}
 */
function calculateScore(business, config = DEFAULT_SCORING_CONFIG) {
    let score = 0;
    const breakdown = {};

    // Has Phone (+20)
    if (business.phone) {
        score += config.hasPhone.points;
        breakdown.hasPhone = config.hasPhone.points;
    }

    // Has Website (+20)
    if (business.website) {
        score += config.hasWebsite.points;
        breakdown.hasWebsite = config.hasWebsite.points;
    }

    // Has Email (+15)
    if (business.business_email || business.email) {
        score += config.hasEmail.points;
        breakdown.hasEmail = config.hasEmail.points;
    }

    // Email Verified (+5)
    if (business.email_verified === true || business.emailVerified === true) {
        score += config.emailVerified.points;
        breakdown.emailVerified = config.emailVerified.points;
    }

    // Rating scoring (mutually exclusive)
    const rating = parseFloat(business.rating) || 0;
    if (rating >= 4.5) {
        score += config.ratingExcellent.points;
        breakdown.ratingExcellent = config.ratingExcellent.points;
    } else if (rating >= 4.0) {
        score += config.ratingGood.points;
        breakdown.ratingGood = config.ratingGood.points;
    }

    // Review count scoring (mutually exclusive)
    const reviewCount = parseInt(business.review_count || business.reviewCount) || 0;
    if (reviewCount >= 100) {
        score += config.reviewsHigh.points;
        breakdown.reviewsHigh = config.reviewsHigh.points;
    } else if (reviewCount >= 50) {
        score += config.reviewsMedium.points;
        breakdown.reviewsMedium = config.reviewsMedium.points;
    }

    // WhatsApp available (+5)
    if (business.whatsapp_available === true || business.whatsappAvailable === true) {
        score += config.whatsappAvailable.points;
        breakdown.whatsappAvailable = config.whatsappAvailable.points;
    }

    // Has Address (+5)
    if (business.address && business.address.length > 5) {
        score += config.hasAddress.points;
        breakdown.hasAddress = config.hasAddress.points;
    }

    // Has Category (+5)
    if (business.category) {
        score += config.hasCategory.points;
        breakdown.hasCategory = config.hasCategory.points;
    }

    // Calculate grade
    const grade = getGrade(score);

    return {
        score,
        breakdown,
        grade
    };
}

/**
 * Get letter grade based on score
 * @param {number} score - Numeric score
 * @returns {string} Letter grade (A, B, C, D, F)
 */
function getGrade(score) {
    if (score >= 80) return 'A';
    if (score >= 70) return 'B';
    if (score >= 50) return 'C';
    if (score >= 30) return 'D';
    return 'F';
}

/**
 * Get color for score display
 * @param {number} score - Numeric score
 * @returns {string} CSS color class or hex color
 */
function getScoreColor(score) {
    if (score >= 70) return '#22c55e'; // Green
    if (score >= 40) return '#f59e0b'; // Yellow/Orange
    return '#ef4444'; // Red
}

/**
 * Bulk calculate scores for multiple businesses
 * @param {Array<Object>} businesses - Array of business objects
 * @param {Object} config - Optional custom scoring config
 * @returns {Array<Object>} Businesses with score data added
 */
function bulkCalculateScores(businesses, config = DEFAULT_SCORING_CONFIG) {
    return businesses.map(business => {
        const scoreData = calculateScore(business, config);
        return {
            ...business,
            lead_score: scoreData.score,
            lead_score_breakdown: JSON.stringify(scoreData.breakdown),
            lead_grade: scoreData.grade
        };
    });
}

/**
 * Sort businesses by lead score
 * @param {Array<Object>} businesses - Array of business objects
 * @param {string} order - 'asc' or 'desc'
 * @returns {Array<Object>} Sorted array
 */
function sortByScore(businesses, order = 'desc') {
    return [...businesses].sort((a, b) => {
        const scoreA = a.lead_score || 0;
        const scoreB = b.lead_score || 0;
        return order === 'desc' ? scoreB - scoreA : scoreA - scoreB;
    });
}

/**
 * Filter businesses by minimum score
 * @param {Array<Object>} businesses - Array of business objects
 * @param {number} minScore - Minimum score threshold
 * @returns {Array<Object>} Filtered array
 */
function filterByMinScore(businesses, minScore) {
    return businesses.filter(b => (b.lead_score || 0) >= minScore);
}

/**
 * Get score statistics for a set of businesses
 * @param {Array<Object>} businesses - Array of business objects
 * @returns {Object} Statistics object
 */
function getScoreStats(businesses) {
    const scores = businesses.map(b => b.lead_score || 0);

    if (scores.length === 0) {
        return { avg: 0, min: 0, max: 0, count: 0, gradeDistribution: {} };
    }

    const sum = scores.reduce((a, b) => a + b, 0);
    const gradeDistribution = {
        A: businesses.filter(b => getGrade(b.lead_score || 0) === 'A').length,
        B: businesses.filter(b => getGrade(b.lead_score || 0) === 'B').length,
        C: businesses.filter(b => getGrade(b.lead_score || 0) === 'C').length,
        D: businesses.filter(b => getGrade(b.lead_score || 0) === 'D').length,
        F: businesses.filter(b => getGrade(b.lead_score || 0) === 'F').length
    };

    return {
        avg: Math.round(sum / scores.length),
        min: Math.min(...scores),
        max: Math.max(...scores),
        count: scores.length,
        gradeDistribution
    };
}

module.exports = {
    DEFAULT_SCORING_CONFIG,
    calculateScore,
    getGrade,
    getScoreColor,
    bulkCalculateScores,
    sortByScore,
    filterByMinScore,
    getScoreStats
};
