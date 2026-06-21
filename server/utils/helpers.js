// Church coordinates: PIWC Dansoman
// 5.5539° N, 0.2974° W
export const CHURCH_LOCATION = {
    latitude: 5.5539,
    longitude: -0.2974, // West is negative
    radiusMeters: 100 // 100 meter radius
};

/**
 * Calculate distance between two points using Haversine formula
 * @param {number} lat1 - Latitude of first point
 * @param {number} lon1 - Longitude of first point
 * @param {number} lat2 - Latitude of second point
 * @param {number} lon2 - Longitude of second point
 * @returns {number} Distance in meters
 */
export function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

/**
 * Check if coordinates are within church geofence
 * @param {number} latitude - User's latitude
 * @param {number} longitude - User's longitude
 * @returns {Object} { isWithin: boolean, distance: number }
 */
export function isWithinChurchGeofence(latitude, longitude) {
    const distance = calculateDistance(
        latitude,
        longitude,
        CHURCH_LOCATION.latitude,
        CHURCH_LOCATION.longitude
    );

    return {
        isWithin: distance <= CHURCH_LOCATION.radiusMeters,
        distance: Math.round(distance)
    };
}

/**
 * Get current day of week
 * @returns {string} Day name (e.g., "Sunday")
 */
export function getCurrentDayOfWeek() {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    return days[new Date().getDay()];
}

/**
 * Check if current time is within session time
 * @param {string} startTime - Session start time (HH:MM)
 * @param {string} endTime - Session end time (HH:MM)
 * @returns {boolean}
 */
export function isWithinSessionTime(startTime, endTime) {
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);

    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * Format phone number to Ghana format
 * @param {string} phone - Phone number
 * @returns {string} Formatted phone number
 */
export function formatPhoneNumber(phone) {
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '');

    // If starts with 0, replace with +233
    if (cleaned.startsWith('0')) {
        cleaned = '233' + cleaned.slice(1);
    }

    // Add + if not present
    if (!cleaned.startsWith('+')) {
        cleaned = '+' + cleaned;
    }

    return cleaned;
}

/**
 * Get start of today (midnight)
 * @returns {Date}
 */
export function getStartOfDay(date = new Date()) {
    const start = new Date(date);
    start.setHours(0, 0, 0, 0);
    return start;
}

/**
 * Get start of week (Sunday)
 * @returns {Date}
 */
export function getStartOfWeek(date = new Date()) {
    const start = new Date(date);
    const day = start.getDay();
    start.setDate(start.getDate() - day);
    start.setHours(0, 0, 0, 0);
    return start;
}

/**
 * Get start of month
 * @returns {Date}
 */
export function getStartOfMonth(date = new Date()) {
    const start = new Date(date);
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
    return start;
}
