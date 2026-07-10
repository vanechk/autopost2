import { fetchEvents as fetchYandexAfishaEvents, formatEventsMessage as formatYandexAfisha, fetchEventsByCategory as fetchYandexAfishaByCategory, formatEventsPage as formatYandexAfishaPage } from './yandexAfisha.js';
import { fetchEvents as fetchKudaGoEvents, fetchEventsByCategory as fetchKudaGoByCategory } from './kudago.js';
import { fetchGorodZovetEvents, fetchGZEventsByCategory } from './gorodzovet.js';
import { CITIES } from './config.js';

/**
 * Unified events service. Yandex Afisha is the only source for the public
 * catalogue and the weekly post. The former sources stay as an emergency
 * fallback when Afisha does not return any events for a city.
 */

const KUDAGO_CITIES = ['msk', 'spb'];
const GORODZOVET_SLUGS = {
    smr: 'samara',
    sim: 'simferopol'
};

async function fetchFallbackEvents(citySlug) {
    if (KUDAGO_CITIES.includes(citySlug)) return fetchKudaGoEvents(citySlug);

    const gorodzovetCity = GORODZOVET_SLUGS[citySlug];
    if (gorodzovetCity) return fetchGorodZovetEvents(gorodzovetCity);

    return [];
}

async function fetchFallbackCategory(citySlug, category, page) {
    if (KUDAGO_CITIES.includes(citySlug)) return fetchKudaGoByCategory(citySlug, category, page);

    const gorodzovetCity = GORODZOVET_SLUGS[citySlug];
    if (gorodzovetCity) return fetchGZEventsByCategory(gorodzovetCity, category, page);

    return { events: [], hasMore: false };
}

/**
 * Fetch events for any supported city
 */
export async function fetchEvents(citySlug) {
    if (!CITIES[citySlug]) {
        console.error(`Unknown city slug: ${citySlug}`);
        return [];
    }
    const afishaEvents = await fetchYandexAfishaEvents(citySlug);
    if (afishaEvents.length > 0) return afishaEvents;

    console.warn(`⚠️ Afisha returned no events for ${citySlug}; using fallback source`);
    return fetchFallbackEvents(citySlug);
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
    const afishaResult = await fetchYandexAfishaByCategory(citySlug, category, page);
    if (afishaResult.events.length > 0) return afishaResult;

    console.warn(`⚠️ Afisha returned no ${category} events for ${citySlug}; using fallback source`);
    return fetchFallbackCategory(citySlug, category, page);
}

/**
 * Format a page of events
 */
export function formatEventsPage(events, citySlug, category, page, hasMore) {
    const city = CITIES[citySlug];
    const cityName = city ? city.name : 'Неизвестный город';

    return formatYandexAfishaPage(events, cityName, category, page, hasMore);
}
