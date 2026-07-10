import axios from 'axios';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { YANDEX_AFISHA, FILTERS, HOLIDAYS } from './config.js';
import { getEditorialScore } from './kudago.js';
import { cleanTitle, cleanDescription, escapeHTML } from './textUtils.js';

const execFileAsync = promisify(execFile);
const __dirname = dirname(fileURLToPath(import.meta.url));
const FETCH_SCRIPT = join(__dirname, '..', 'scripts', 'fetch_yandex_afisha.py');
const VENV_PYTHON = join(__dirname, '..', '.venv', 'bin', 'python3');

/**
 * Yandex Afisha city slug mapping
 */
const CITY_SLUGS = {
    msk: 'moscow',
    spb: 'saint-petersburg',
    smr: 'samara',
    sim: 'simferopol'
};

// Afisha city pages sometimes include destination festivals and other events
// outside the intended coverage. Moscow and St Petersburg stay city-only;
// the regional audiences deliberately get a practical nearby-area radius.
const REGIONAL_AFISHA_SLUGS = {
    smr: ['samara', 'togliatti', 'syzran', 'novokuybyshevsk', 'zhigulevsk'],
    sim: ['simferopol', 'yalta', 'alushta', 'bakhchisaray', 'evpatoriya', 'saki', 'sevastopol', 'sudak']
};

// Query neighbouring city pages only when the main city cannot fill the card
// with three strong listings. This widens coverage without slowing every run.
const REGIONAL_BACKFILL_SLUGS = {
    smr: ['togliatti'],
    sim: ['yalta', 'alushta', 'sevastopol']
};
const REGIONAL_BACKFILL_CATEGORIES = ['concert', 'show', 'festival', 'theater', 'standup'];

const OUT_OF_CITY_VENUE_MARKERS = {
    msk: /(?:калужск|тульск|тверск|владимирск|ярославск|рязанск|смоленск)(?:ая|ой)?\s+(?:обл\.?|область)|московск(?:ая|ой)?\s+(?:обл\.?|область)|подмосков/i,
    spb: /ленинградск(?:ая|ой)?\s+(?:обл\.?|область)|выборг|гатчин|сосновый\s+бор/i,
    // Samara Oblast is in scope. For Crimea, retain only cities beyond the
    // requested ~100 km radius from Simferopol as exclusions.
    sim: /керч|феодоси|черноморск|щ[её]лкин|красноперекопск/i
};

/**
 * Category URL paths on Yandex Afisha
 */
const CATEGORY_PATHS = {
    concert: 'concert',
    theater: 'theatre',
    exhibition: 'art',
    festival: 'festival',
    education: 'masterclass',
    show: 'show',
    standup: 'standup',
    cinema: 'cinema'
};

/**
 * Check if a date is a public holiday
 */
function isHoliday(date) {
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return HOLIDAYS.includes(`${mm}-${dd}`);
}

/**
 * Get upcoming weekend dates, extended with adjacent holidays
 */
function getWeekendDates() {
    const now = new Date();
    const dayOfWeek = now.getDay();

    let daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    if (daysUntilFriday === 0 && now.getHours() >= 18) {
        daysUntilFriday = 0;
    } else if (dayOfWeek === 6) {
        daysUntilFriday = -1;
    } else if (dayOfWeek === 0) {
        daysUntilFriday = -2;
    }

    const friday = new Date(now);
    friday.setDate(now.getDate() + daysUntilFriday);
    friday.setHours(0, 0, 0, 0);

    const sunday = new Date(friday);
    sunday.setDate(friday.getDate() + 2);

    let startDate = new Date(friday);
    for (let i = 1; i <= 5; i++) {
        const prevDay = new Date(friday);
        prevDay.setDate(friday.getDate() - i);
        if (isHoliday(prevDay)) {
            startDate = prevDay;
        } else {
            break;
        }
    }

    let endDate = new Date(sunday);
    for (let i = 1; i <= 5; i++) {
        const nextDay = new Date(sunday);
        nextDay.setDate(sunday.getDate() + i);
        if (isHoliday(nextDay)) {
            endDate = nextDay;
        } else {
            break;
        }
    }

    startDate.setHours(17, 0, 0, 0);
    endDate.setHours(23, 59, 59, 999);

    console.log(`📅 Event range: ${startDate.toLocaleDateString('ru-RU')} — ${endDate.toLocaleDateString('ru-RU')}`);

    return {
        since: Math.floor(startDate.getTime() / 1000),
        until: Math.floor(endDate.getTime() / 1000),
        startDate,
        endDate
    };
}

/**
 * Format weekend dates as human-readable string
 */
function getWeekendDatesFormatted() {
    const { startDate, endDate } = getWeekendDates();
    const pad = n => String(n).padStart(2, '0');
    const startStr = `${pad(startDate.getDate())}.${pad(startDate.getMonth() + 1)}`;
    const endStr = `${pad(endDate.getDate())}.${pad(endDate.getMonth() + 1)}`;
    return `с ${startStr} - ${endStr}`;
}

/** Get local YYYY-MM-DD keys for the current weekend/adjacent holidays. */
function getWeekendDateKeys() {
    const { startDate, endDate } = getWeekendDates();
    const dates = new Set();
    const current = new Date(startDate);
    current.setHours(0, 0, 0, 0);

    while (current <= endDate) {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, '0');
        const day = String(current.getDate()).padStart(2, '0');
        dates.add(`${year}-${month}-${day}`);
        current.setDate(current.getDate() + 1);
    }

    return dates;
}

/** Keep only listings that have at least one date in the target weekend. */
function filterWeekendEvents(events) {
    const weekendDates = getWeekendDateKeys();
    return events.filter(event => event.dates?.some(date => weekendDates.has(date)));
}

/** Reject listings whose venue explicitly belongs outside the requested city. */
function filterCityVenue(events, citySlug) {
    const outsideMarker = OUT_OF_CITY_VENUE_MARKERS[citySlug];
    const afishaCity = CITY_SLUGS[citySlug] || citySlug;
    const allowedSlugs = REGIONAL_AFISHA_SLUGS[citySlug] || [afishaCity];

    return events.filter(event => {
        // Apollo includes recommendation cards from other cities in the same
        // cache. The event URL is the authoritative city signal for those.
        if (event.site_url && !allowedSlugs.some(slug => event.site_url.includes(`/${slug}/`))) {
            console.log(`📍 Skipping foreign-city event for ${citySlug}: ${event.title}`);
            return false;
        }

        if (!outsideMarker) return true;
        const venue = `${event.place?.title || ''} ${event.place?.address || ''}`;
        if (!outsideMarker.test(venue)) return true;

        console.log(`📍 Skipping out-of-city event for ${citySlug}: ${event.title}`);
        return false;
    });
}

/**
 * Extract a balanced JS object starting from position `start` in the string
 * Handles strings (single and double quoted) to avoid counting braces inside them
 */
function extractBalancedObject(str, start) {
    let depth = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let escaped = false;

    for (let i = start; i < str.length; i++) {
        const ch = str[i];

        if (escaped) {
            escaped = false;
            continue;
        }

        if (ch === '\\') {
            escaped = true;
            continue;
        }

        if (ch === "'" && !inDoubleQuote) {
            inSingleQuote = !inSingleQuote;
            continue;
        }

        if (ch === '"' && !inSingleQuote) {
            inDoubleQuote = !inDoubleQuote;
            continue;
        }

        if (inSingleQuote || inDoubleQuote) continue;

        if (ch === '{') depth++;
        if (ch === '}') {
            depth--;
            if (depth === 0) {
                return str.substring(start, i + 1);
            }
        }
    }

    return null;
}

/**
 * Fetch an Afisha page via curl_cffi. Plain server-side HTTP requests trigger
 * SmartCaptcha; curl_cffi uses a browser-compatible TLS fingerprint and gives
 * us the same server-rendered Apollo cache a visitor receives.
 */
async function fetchAfishaHtml(url) {
    const python = process.env.YANDEX_AFISHA_PYTHON || (existsSync(VENV_PYTHON) ? VENV_PYTHON : 'python3');
    const { stdout } = await execFileAsync(python, [FETCH_SCRIPT, url], {
        maxBuffer: 2 * 1024 * 1024,
        timeout: 45000
    });
    return stdout;
}

/**
 * Extract __APOLLO_STATE__ embedded in an Afisha event listing page.
 */
async function fetchApolloState(url, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            if (attempt > 0) {
                await new Promise(r => setTimeout(r, 2000 * attempt));
                console.log(`🔄 Retry #${attempt} for ${url}`);
            }

            const html = await fetchAfishaHtml(url);

            // Find the start of __APOLLO_STATE__ assignment
            const markers = ["window['__APOLLO_STATE__'] = ", 'window["__APOLLO_STATE__"] = ', '__APOLLO_STATE__ = '];

            for (const marker of markers) {
                const idx = html.indexOf(marker);
                if (idx === -1) continue;

                const objStart = idx + marker.length;
                const braceIdx = html.indexOf('{', objStart);
                if (braceIdx === -1 || braceIdx - objStart > 5) continue;

                const objStr = extractBalancedObject(html, braceIdx);
                if (objStr) {
                    try {
                        return new Function('return ' + objStr)();
                    } catch (e) {
                        console.error('Apollo eval error:', e.message);
                    }
                }
            }

            throw new Error('__APOLLO_STATE__ not found');
        } catch (error) {
            if (attempt >= retries) {
                console.error(`❌ Yandex Afisha fetch error (${url}):`, error.message);
                return null;
            }
        }
    }
    return null;
}

// ─── Data Parsing ──────────────────────────────────────────────────

/**
 * Parse events from Apollo state cache
 * Resolves references between EventPreview, Ticket, PlacePreview, and Featured
 */
function parseEvents(apollo) {
    if (!apollo) return [];

    const keys = Object.keys(apollo);
    const events = [];

    // Collect EventPreview entries
    const eventKeys = keys.filter(k => k.startsWith('EventPreview:'));

    // Build Featured map for schedule info and place refs
    const featuredMap = {};
    keys.filter(k => k.startsWith('Featured:')).forEach(k => {
        const featured = apollo[k];
        if (featured?.object?.event?.__ref) {
            const eventRef = featured.object.event.__ref;
            featuredMap[eventRef] = featured;
        }
    });

    // City pages do not all use Featured cards. In smaller cities Afisha often
    // embeds an ActualEvent directly in another cache entry, so collect those
    // schedules too instead of silently treating the listing as empty.
    const scheduleInfoMap = {};
    const visited = new WeakSet();
    const collectSchedules = value => {
        if (!value || typeof value !== 'object' || visited.has(value)) return;
        visited.add(value);

        const eventRef = value.event?.__ref || value.object?.event?.__ref;
        const scheduleInfo = value.scheduleInfo || value.object?.scheduleInfo;
        if (eventRef?.startsWith('EventPreview:') && Array.isArray(scheduleInfo?.dates)) {
            const current = scheduleInfoMap[eventRef];
            if (!current || scheduleInfo.dates.length > current.dates.length) {
                scheduleInfoMap[eventRef] = scheduleInfo;
            }
        }

        for (const nested of Object.values(value)) collectSchedules(nested);
    };
    collectSchedules(apollo);

    for (const key of eventKeys) {
        const ep = apollo[key];
        if (!ep) continue;

        // Resolve ticket price
        let priceStr = 'Цена не указана';
        if (ep.tickets && ep.tickets.length > 0) {
            const ticketRef = ep.tickets[0].__ref;
            const ticket = apollo[ticketRef];
            if (ticket?.price) {
                const minRub = Math.round(ticket.price.min / 100);
                const maxRub = Math.round(ticket.price.max / 100);
                if (minRub === 0) {
                    priceStr = 'Бесплатно';
                } else if (minRub === maxRub) {
                    priceStr = `${minRub.toLocaleString('ru-RU')} ₽`;
                } else {
                    priceStr = `от ${minRub.toLocaleString('ru-RU')} ₽`;
                }
            }
        }

        const featured = featuredMap[key];
        const scheduleInfo = featured?.object?.scheduleInfo || scheduleInfoMap[key] || null;

        // Resolve place from Featured entry or an ActualEvent schedule
        let place = null;
        const placeRef = featured?.object?.place?.__ref
            || scheduleInfo?.onlyPlace?.__ref
            || scheduleInfo?.oneOfPlaces?.__ref;
        if (placeRef && apollo[placeRef]) {
            const pp = apollo[placeRef];
            place = {
                title: pp.title || '',
                address: pp.address || ''
            };
        }

        // Fallback: try to find PlacePreview linked to this event anywhere in apollo
        if (!place) {
            // Look through all Featured entries for this event
            for (const fk of Object.keys(apollo)) {
                if (!fk.startsWith('Featured:')) continue;
                const f = apollo[fk];
                if (f?.object?.event?.__ref === key) {
                    // Check for place inside scheduleInfo
                    const si = f.object.scheduleInfo;
                    if (si) {
                        // Some Featured entries have place refs in nested structures
                        for (const siKey of Object.keys(si)) {
                            const val = si[siKey];
                            if (val && typeof val === 'object' && val.__ref && val.__ref.startsWith('PlacePreview:')) {
                                const pp = apollo[val.__ref];
                                if (pp) {
                                    place = { title: pp.title || '', address: pp.address || '' };
                                    break;
                                }
                            }
                        }
                    }
                    break;
                }
            }
        }

        // Extract schedule dates from Featured
        let dates = [];
        if (scheduleInfo) dates = scheduleInfo.dates || [];

        // Determine event type from tags
        let category = 'other';
        let tagCodes = [];
        const tagsKey = Object.keys(ep).find(k => k.startsWith('tags(') && k.includes('approved') && k.includes('reviewed'));
        if (tagsKey && Array.isArray(ep[tagsKey])) {
            tagCodes = ep[tagsKey].map(t => t.code).filter(Boolean);
            if (tagCodes.includes('concert')) category = 'concert';
            else if (tagCodes.includes('theatre') || tagCodes.includes('theater')) category = 'theater';
            else if (tagCodes.includes('exhibition')) category = 'exhibition';
            else if (tagCodes.includes('festival')) category = 'festival';
            else if (tagCodes.includes('cinema')) category = 'cinema';
            else if (tagCodes.includes('standup')) category = 'standup';
            else if (tagCodes.includes('show')) category = 'show';
            else if (tagCodes.includes('master-class') || tagCodes.includes('masterclass') || tagCodes.includes('education')) category = 'education';
        }

        // Fallback: detect category from URL path
        if (category === 'other' && ep.url) {
            const urlPath = ep.url.toLowerCase();
            if (urlPath.includes('/concert/')) category = 'concert';
            else if (urlPath.includes('/theatre/') || urlPath.includes('/theater/')) category = 'theater';
            else if (urlPath.includes('/art/') || urlPath.includes('/exhibition/') || urlPath.includes('/museum/')) category = 'exhibition';
            else if (urlPath.includes('/festival/')) category = 'festival';
            else if (urlPath.includes('/standup/')) category = 'standup';
            else if (urlPath.includes('/show/')) category = 'show';
            else if (urlPath.includes('/masterclass/') || urlPath.includes('/education/')) category = 'education';
            else if (urlPath.includes('/cinema/')) category = 'cinema';
        }

        // Build URL
        const eventUrl = ep.url
            ? `${YANDEX_AFISHA.baseUrl}${ep.url}`
            : `${YANDEX_AFISHA.baseUrl}/moscow/event/${ep.id}`;

        // Build image URL (pick a medium-sized one)
        let imageUrl = null;
        if (ep.image) {
            const imgKey = Object.keys(ep.image).find(k => k.includes('s380x220'));
            if (imgKey && ep.image[imgKey]?.url) {
                imageUrl = ep.image[imgKey].url;
            }
        }

        // Build description: use argument, or generate fallback based on category
        let description = ep.argument || '';
        if (!description) {
            const fallbacks = {
                'concert': 'Живое музыкальное выступление для ценителей хорошего звука',
                'theater': 'Театральная постановка для яркого культурного вечера',
                'exhibition': 'Выставка с интересными экспонатами и уникальными работами',
                'festival': 'Фестиваль с разнообразной программой и активностями',
                'education': 'Познавательное мероприятие для расширения кругозора',
                'other': 'Интересное мероприятие для культурного отдыха'
            };
            description = fallbacks[category] || fallbacks['other'];
        }

        events.push({
            id: ep.id,
            title: ep.title || 'Без названия',
            short_title: ep.title,
            description: description,
            price: priceStr,
            site_url: eventUrl,
            place: place,
            categories: [category],
            tagCodes: tagCodes,
            age_restriction: ep.contentRating || null,
            images: imageUrl ? [{ image: imageUrl }] : [],
            dates: dates,
            source: 'yandex_afisha'
        });
    }

    return events;
}

// ─── Filtering & Sorting ──────────────────────────────────────────

/**
 * Filter events based on criteria
 */
function filterEvents(events) {
    return events.filter(event => {
        const title = (event.title || '').toLowerCase();
        const description = (event.description || '').toLowerCase();
        const tagCodes = (event.tagCodes || []).map(code => String(code).toLowerCase());

        const hasExcludedKeyword = FILTERS.excludeKeywords.some(keyword =>
            title.includes(keyword.toLowerCase()) ||
            description.includes(keyword.toLowerCase())
        );

        if (hasExcludedKeyword) return false;
        if (/(для детей|детск|семейн)/i.test(`${title} ${description}`)) return false;
        if (/(экскурси|обзорн(?:ая|ый)|прогулк[аи]\s+(?:по|с))/i.test(`${title} ${description}`)
            || event.site_url?.includes('/excursions/')) return false;
        if (tagCodes.some(code => code === 'kids' || code === 'children' || code === 'childrens')) return false;

        // A regular cinema session is not an editorial weekend recommendation.
        // Keep film listings only for premieres, preview screenings and special
        // programmes explicitly marked by Afisha.
        if (event.categories?.includes('cinema')) {
            const isPremiere = tagCodes.some(code => /premier|special-screening|pre-release/.test(code))
                || /премьер|предпремьер|спецпоказ|премьерный показ/i.test(`${title} ${description}`);
            if (!isPremiere) return false;
        }

        // Ticket bundles and subscriptions duplicate the event card rather than
        // describing a separate thing to do this weekend.
        if (/(комплексн(?:ый|ого)? билет|абонемент|подарочн(?:ый|ого)? билет)/i.test(`${title} ${description}`)) return false;

        // If Afisha cannot classify a card as an event format we trust, do not
        // use it merely to fill the weekly post.
        if (event.categories?.includes('other')) return false;

        // Check price (parse number from price string)
        const priceNumbers = event.price.match(/\d[\d\s]*/);
        if (priceNumbers) {
            const price = parseInt(priceNumbers[0].replace(/\s/g, ''), 10);
            if (price > FILTERS.maxPrice) return false;
        }

        return true;
    });
}

/**
 * Simple seeded random number generator for consistent weekly shuffling
 */
function seededRandom(seed) {
    let s = seed;
    return function () {
        s = (s * 1103515245 + 12345) & 0x7fffffff;
        return s / 0x7fffffff;
    };
}

/**
 * Get current week number for seeding
 */
function getWeekSeed() {
    return Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
}

/**
 * Sort events with weekly rotation
 */
function sortEvents(events) {
    const weekSeed = getWeekSeed();
    const rng = seededRandom(weekSeed);

    const scored = events.map(event => {
        let score = getEditorialScore(event);
        const tagCodes = (event.tagCodes || []).map(code => String(code).toLowerCase());

        // Afisha-specific signals for events people actively plan around.
        if (tagCodes.includes('artist-tour')) score += 10;
        if (tagCodes.includes('hot')) score += 8;
        if (tagCodes.includes('festival-concert')) score += 6;

        // Keep only a small deterministic rotation for equally strong cards.
        score += rng() * 3;

        return { event, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.map(s => s.event);
}

// ─── Event Type Detection ──────────────────────────────────────────

/**
 * Determine the event type from its categories or title
 */
function getEventType(event) {
    if (event.categories && event.categories.length > 0 && event.categories[0] !== 'other') {
        return event.categories[0];
    }

    const title = (event.title || '').toLowerCase();
    if (title.includes('выставк') || title.includes('экспозиц')) return 'exhibition';
    if (title.includes('концерт') || title.includes('музык')) return 'concert';
    if (title.includes('спектакл') || title.includes('театр') || title.includes('мюзикл')) return 'theater';
    if (title.includes('фестиваль') || title.includes('фест')) return 'festival';
    if (title.includes('лекци') || title.includes('мастер-класс')) return 'education';

    return 'other';
}

// ─── Diverse Selection ─────────────────────────────────────────────

/**
 * Select diverse events ensuring different categories are represented
 */
export function selectDiverseEvents(events, count = 3) {
    if (events.length <= count) return events;

    const allTypes = ['exhibition', 'concert', 'theater', 'festival', 'education'];
    const weekSeed = getWeekSeed();
    const startIdx = weekSeed % allTypes.length;
    const rotatedTypes = [
        ...allTypes.slice(startIdx),
        ...allTypes.slice(0, startIdx)
    ];

    const byType = {};
    for (const event of events) {
        const type = getEventType(event);
        if (!byType[type]) byType[type] = [];
        byType[type].push(event);
    }

    console.log('📊 Event type distribution:', Object.keys(byType).map(k => `${k}: ${byType[k].length}`).join(', '));

    const selected = [];
    const usedIds = new Set();

    for (const type of rotatedTypes) {
        if (selected.length >= count) break;
        if (byType[type] && byType[type].length > 0) {
            const event = byType[type].shift();
            if (!usedIds.has(event.id)) {
                selected.push(event);
                usedIds.add(event.id);
                console.log(`  ✅ Picked [${type}]: ${event.title}`);
            }
        }
    }

    // Fill remaining slots
    const usedTypes = new Set(selected.map(e => getEventType(e)));
    if (selected.length < count) {
        for (const event of events) {
            if (selected.length >= count) break;
            const type = getEventType(event);
            if (!usedIds.has(event.id) && !usedTypes.has(type)) {
                selected.push(event);
                usedIds.add(event.id);
                usedTypes.add(type);
            }
        }
    }

    if (selected.length < count) {
        for (const event of events) {
            if (selected.length >= count) break;
            if (!usedIds.has(event.id)) {
                selected.push(event);
                usedIds.add(event.id);
            }
        }
    }

    return selected;
}

// ─── Fetching ──────────────────────────────────────────────────────

/**
 * Fetch events for a single category from Yandex Afisha
 */
async function fetchCategoryPage(citySlug, category) {
    const afishaCity = CITY_SLUGS[citySlug] || citySlug;
    const categoryPath = CATEGORY_PATHS[category] || category;
    const url = `${YANDEX_AFISHA.baseUrl}/${afishaCity}/${categoryPath}`;

    console.log(`📡 Fetching: ${url}`);
    const apollo = await fetchApolloState(url);
    if (!apollo) return [];

    return parseEvents(apollo);
}

/**
 * Fetch events from Yandex Afisha — per-category for diversity
 * Sequential fetching with delays to avoid rate limiting
 */
export async function fetchEvents(citySlug) {
    // The post is deliberately focused on the part of Afisha users asked for:
    // headline concerts, shows, festivals, theatre and stand-up.
    const targetCategories = ['concert', 'show', 'festival', 'theater', 'standup', 'exhibition', 'cinema'];

    try {
        // Fetch each category sequentially with delay
        const categoryResults = [];
        for (const cat of targetCategories) {
            const events = await fetchCategoryPage(citySlug, cat);
            categoryResults.push(events);
            await new Promise(r => setTimeout(r, 350));
        }

        // Merge and deduplicate
        const seenIds = new Set();
        let allEvents = [];
        for (const events of categoryResults) {
            for (const event of events) {
                if (!seenIds.has(event.id)) {
                    seenIds.add(event.id);
                    allEvents.push(event);
                }
            }
        }

        // Only events that are actually happening this weekend may reach the
        // editorial ranking. Category pages otherwise include announcements
        // several months ahead.
        allEvents = filterWeekendEvents(allEvents);
        allEvents = filterCityVenue(allEvents, citySlug);
        allEvents = filterEvents(allEvents);

        // If the city page has fewer than three useful cards, supplement it
        // with the configured nearby area. We deliberately skip cinema here:
        // primary-city premieres are still allowed, but regional expansion is
        // for real events people would travel for.
        if (allEvents.length < 3 && REGIONAL_BACKFILL_SLUGS[citySlug]) {
            const seenIds = new Set(allEvents.map(event => event.id));
            for (const nearbyCity of REGIONAL_BACKFILL_SLUGS[citySlug]) {
                const nearbyResults = await Promise.all(
                    REGIONAL_BACKFILL_CATEGORIES.map(category => fetchCategoryPage(nearbyCity, category))
                );
                const nearbyEvents = nearbyResults.flat();

                const qualifiedNearbyEvents = filterEvents(
                    filterCityVenue(filterWeekendEvents(nearbyEvents), citySlug)
                );
                for (const event of qualifiedNearbyEvents) {
                    if (!seenIds.has(event.id)) {
                        seenIds.add(event.id);
                        allEvents.push(event);
                    }
                }

                if (allEvents.length >= 3) break;
            }
        }

        // Sort by priority with weekly rotation
        allEvents = sortEvents(allEvents);

        console.log(`Yandex Afisha ${citySlug}: fetched ${allEvents.length} events across ${targetCategories.length} categories`);

        return allEvents.slice(0, FILTERS.maxEvents);
    } catch (error) {
        console.error(`❌ Yandex Afisha Error (${citySlug}):`, error.message);
        return [];
    }
}

/**
 * Fetch events by specific category with pagination
 */
export async function fetchEventsByCategory(citySlug, category, page = 0, perPage = 5) {
    try {
        let allEvents;

        if (category === 'all') {
            const targetCategories = Object.keys(CATEGORY_PATHS);
            const categoryResults = await Promise.all(
                targetCategories.map(cat => fetchCategoryPage(citySlug, cat))
            );
            const seenIds = new Set();
            allEvents = [];
            for (const events of categoryResults) {
                for (const event of events) {
                    if (!seenIds.has(event.id)) {
                        seenIds.add(event.id);
                        allEvents.push(event);
                    }
                }
            }
        } else {
            allEvents = await fetchCategoryPage(citySlug, category);
        }

        // Apply the same weekend boundary in the interactive catalogue.
        allEvents = filterWeekendEvents(allEvents);
        allEvents = filterCityVenue(allEvents, citySlug);
        allEvents = filterEvents(allEvents);
        allEvents = sortEvents(allEvents);

        // Paginate
        const start = page * perPage;
        const end = start + perPage;
        const pageEvents = allEvents.slice(start, end);
        const hasMore = end < allEvents.length && page < 5;

        return { events: pageEvents, hasMore };
    } catch (error) {
        console.error(`❌ Yandex Afisha category Error (${citySlug}/${category}):`, error.message);
        return { events: [], hasMore: false };
    }
}

// ─── Formatting ────────────────────────────────────────────────────

/**
 * Generate a fallback description based on event type
 */
function getFallbackDescription(event) {
    const type = getEventType(event);
    const fallbacks = {
        'exhibition': 'Выставка с интересными экспонатами и уникальными работами',
        'concert': 'Живое музыкальное выступление для ценителей хорошего звука',
        'theater': 'Театральная постановка для яркого культурного вечера',
        'festival': 'Фестиваль с разнообразной программой и активностями',
        'education': 'Познавательное мероприятие для расширения кругозора',
        'other': 'Интересное мероприятие для культурного отдыха'
    };
    return fallbacks[type] || fallbacks['other'];
}

/**
 * Format event for Telegram message (HTML mode)
 */
function formatEvent(event, index) {
    const title = event.title || 'Без названия';
    const cleanedTitle = cleanTitle(title);
    const price = event.price || 'Цена не указана';
    const url = event.site_url || event.url || `${YANDEX_AFISHA.baseUrl}/moscow`;

    let text = `${index + 1}. <a href="${escapeHTML(url)}">${escapeHTML(cleanedTitle)}</a>\n`;

    let details = [];

    let desc = '';
    if (event.description) {
        desc = cleanDescription(event.description, 120);
    }
    if (!desc) {
        desc = getFallbackDescription(event);
    }
    if (desc) details.push(escapeHTML(desc));

    details.push(`💰 ${escapeHTML(price)}`);

    if (event.place && event.place.title) {
        details.push(`📍 ${escapeHTML(event.place.title)}`);
    }

    text += `<blockquote expandable>${details.join('\n')}</blockquote>`;

    return text;
}

/**
 * Format events list for Telegram
 */
export function formatEventsMessage(events, cityName) {
    if (events.length === 0) {
        return `😔 К сожалению, не нашлось подходящих мероприятий в городе ${cityName} на эти выходные.`;
    }

    const dates = getWeekendDatesFormatted();
    let message = `🎉 <b>Мероприятия ${dates} в городе ${escapeHTML(cityName)}:</b>\n\n`;

    events.forEach((event, index) => {
        message += formatEvent(event, index) + '\n\n';
    });

    message += `<i>Всего найдено: ${events.length} событий</i>`;

    return message;
}

/**
 * Format a page of events for the bot
 */
export function formatEventsPage(events, cityName, category, page, hasMore) {
    const categoryNames = {
        'exhibition': '🖼️ Выставки',
        'concert': '🎵 Концерты',
        'theater': '🎭 Театр',
        'festival': '🎪 Фестивали',
        'education': '📚 Образование',
        'all': '📋 Все мероприятия'
    };

    const dates = getWeekendDatesFormatted();
    const catName = categoryNames[category] || '📋 Мероприятия';

    if (events.length === 0) {
        return `😔 Не нашлось мероприятий в категории "${catName}" в городе ${cityName} на эти выходные.`;
    }

    let message = `${catName}\n📍 <b>${escapeHTML(cityName)}</b> (${dates})\n\n`;

    events.forEach((event, index) => {
        message += formatEvent(event, page * 5 + index) + '\n\n';
    });

    message += `<i>Страница ${page + 1}</i>`;

    return message;
}

// ─── Full Description Fetching ─────────────────────────────────────

/**
 * Fetch full description from a Yandex Afisha event page
 * Extracts from embedded JSON data on the page
 */
export async function fetchFullDescription(url) {
    try {
        const res = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Accept': 'text/html',
                'Accept-Language': 'ru-RU,ru;q=0.9'
            },
            timeout: 15000
        });

        const html = res.data;

        // Try to find description in embedded JSON data
        const descMatch = html.match(/"description"\s*:\s*"((?:[^"\\]|\\.)*)"/);
        if (descMatch && descMatch[1].length > 15) {
            // Unescape JSON string
            let desc = descMatch[1]
                .replace(/\\n/g, '. ')
                .replace(/\\t/g, ' ')
                .replace(/\\"/g, '"')
                .replace(/\\\\/g, '\\')
                .replace(/<[^>]+>/g, '')
                .replace(/\s+/g, ' ')
                .replace(/\.{2,}/g, '.')
                .replace(/\.\s+\./g, '.')
                .trim();

            // Trim to reasonable length
            if (desc.length > 250) {
                desc = desc.substring(0, 247).replace(/\s+\S*$/, '') + '...';
            }

            return desc;
        }

        return '';
    } catch (error) {
        console.error(`Error fetching description from ${url}:`, error.message);
        return '';
    }
}
