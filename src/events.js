import { fetchEvents as fetchYandexAfishaEvents, formatEventsMessage as formatYandexAfisha, fetchEventsByCategory as fetchYandexAfishaByCategory, formatEventsPage as formatYandexAfishaPage } from './yandexAfisha.js';
import { CITIES } from './config.js';

/**
 * Unified events service. Yandex Afisha is the only source for the public
 * catalogue and the weekly post, so popular ticketed events are not lost when
 * a secondary city-guide service does not list them.
 */

/**
 * Fetch events for any supported city
 */
export async function fetchEvents(citySlug) {
    if (!CITIES[citySlug]) {
        console.error(`Unknown city slug: ${citySlug}`);
        return [];
    }
    return await fetchYandexAfishaEvents(citySlug);
}

/**
 * Format events message for any supported city
 */
export function formatEventsMessage(events, citySlug) {
    const city = CITIES[citySlug];
    const cityName = city ? city.name : 'Неизвестный город';

    return formatYandexAfisha(events, cityName);
}

/**
 * Fetch events by category with pagination
 */
export async function fetchEventsByCategory(citySlug, category, page = 0) {
    if (!CITIES[citySlug]) return { events: [], hasMore: false };
    return await fetchYandexAfishaByCategory(citySlug, category, page);
}

/**
 * Format a page of events
 */
export function formatEventsPage(events, citySlug, category, page, hasMore) {
    const city = CITIES[citySlug];
    const cityName = city ? city.name : 'Неизвестный город';

    return formatYandexAfishaPage(events, cityName, category, page, hasMore);
}
