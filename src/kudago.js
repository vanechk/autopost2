import axios from 'axios';
import { KUDAGO, FILTERS, HOLIDAYS } from './config.js';
import { cleanTitle, cleanDescription, escapeHTML } from './textUtils.js';

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
 * E.g. if Thursday is a holiday → Thu-Sun; if Monday is a holiday → Fri-Mon
 */
function getWeekendDates() {
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0 = Sunday, 5 = Friday

    // Calculate days until Friday
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

    // Extend start backwards if days before Friday are holidays
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

    // Extend end forwards if days after Sunday are holidays
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

    startDate.setHours(17, 0, 0, 0); // Start from evening of first day
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
 * Parse price from KudaGo format
 */
function parsePrice(priceStr) {
    if (!priceStr || priceStr.toLowerCase().includes('бесплатно') || priceStr.toLowerCase().includes('free')) {
        return 0;
    }

    // Extract numbers from price string
    const numbers = priceStr.match(/\d+/g);
    if (numbers && numbers.length > 0) {
        // Return the minimum price if range is given
        return parseInt(numbers[0], 10);
    }

    return null; // Unknown price
}

/**
 * Calculate event duration in days
 */
function getEventDuration(event) {
    if (!event.dates || event.dates.length === 0) return 0;

    // Find the longest date range among the entries
    let maxDuration = 0;
    event.dates.forEach(d => {
        const duration = (d.end - d.start) / 86400; // duration in days
        if (duration > maxDuration) maxDuration = duration;
    });
    return maxDuration;
}

/**
 * Check if event is recurring (has many date entries, indicating it repeats regularly)
 */
function isRecurringEvent(event) {
    if (!event.dates) return false;
    // Events with 5+ date entries are likely recurring (weekly, etc.)
    return event.dates.length >= 5;
}

/**
 * Filter events based on criteria
 */
function filterEvents(events) {
    return events.filter(event => {
        // Exclude 18+ events by age restriction
        if (event.age_restriction === '18+') return false;

        // Check for excluded keywords in title
        const title = (event.title || '').toLowerCase();
        const shortTitle = (event.short_title || '').toLowerCase();
        const description = (event.description || '').toLowerCase();

        const hasExcludedKeyword = FILTERS.excludeKeywords.some(keyword =>
            title.includes(keyword.toLowerCase()) ||
            shortTitle.includes(keyword.toLowerCase()) ||
            description.includes(keyword.toLowerCase())
        );

        if (hasExcludedKeyword) return false;

        // Check price
        const price = parsePrice(event.price);
        if (price !== null && price > FILTERS.maxPrice) return false;

        // The post is aimed at adult colleagues. Keep family activities out of
        // this general-purpose feed instead of accidentally spending a slot on
        // a children's course when an API category is broad.
        if (/(для детей|детск|дети и их родители|семейн)/i.test(`${event.title || ''} ${event.description || ''}`)) return false;

        // Classes and generic listings are still available in the catalogue,
        // but should not compete with a weekend recommendation.
        if (getEditorialScore(event) < -10) return false;

        return true;
    });
}

function eventText(event) {
    return `${event.title || ''} ${event.short_title || ''} ${event.description || ''}`.toLowerCase();
}

function eventCategory(event) {
    const categories = (event.categories || []).map(category =>
        typeof category === 'string' ? category : category.slug
    );

    if (categories.includes('concert')) return 'concert';
    if (categories.includes('festival')) return 'festival';
    if (categories.includes('entertainment') || categories.includes('party')) return 'entertainment';
    if (categories.includes('theater')) return 'theater';
    if (categories.includes('exhibition')) return 'exhibition';
    if (categories.includes('education')) return 'education';

    // GorodZovet does not provide categories. Classify its titles as well so
    // the same editorial balance applies to all four cities.
    const text = eventText(event);
    if (text.includes('стендап') || text.includes('шоу') || text.includes('вечерин') || text.includes('квиз')) return 'entertainment';
    if (text.includes('концерт') || text.includes('музык')) return 'concert';
    if (text.includes('фестиваль') || text.includes('фест')) return 'festival';
    if (text.includes('спектакл') || text.includes('театр') || text.includes('мюзикл') || text.includes('опера')) return 'theater';
    if (text.includes('выставк') || text.includes('экспозиц')) return 'exhibition';
    if (text.includes('лекци') || text.includes('мастер-класс') || text.includes('курс')) return 'education';
    return 'other';
}

/**
 * Editorial score for a weekend recommendation. It favours events people plan
 * a weekend around and keeps recurring classes and generic listings out of the
 * top of the feed.
 */
export function getEditorialScore(event) {
    const text = eventText(event);
    const category = eventCategory(event);
    let score = {
        concert: 42,
        festival: 38,
        entertainment: 30,
        theater: 20,
        exhibition: 2,
        education: -12,
        other: 0
    }[category];

    const boosts = [
        ['концерт', 18], ['мюзикл', 16], ['шоу', 16], ['стендап', 16],
        ['ледов', 20], ['фестиваль', 18], ['open air', 12], ['опен-эйр', 12],
        ['вечерин', 12], ['диджей', 12], ['dj', 10], ['дискотек', 10],
        ['цирк', 10], ['матч', 10], ['спорт', 8], ['комеди', 8]
    ];
    const penalties = [
        ['экскурси', 35], ['лекци', 30], ['мастер-класс', 25], ['вебинар', 30],
        ['медитац', 22], ['арт-терап', 22], ['рисовани', 18], ['знакомств', 24],
        ['быстрые свидания', 30], ['для детей', 22], ['детск', 18],
        ['орган', 12], ['барокко', 12], ['классическ', 8], ['экспозици', 12]
    ];

    for (const [keyword, value] of boosts) {
        if (text.includes(keyword)) score += value;
    }
    for (const [keyword, value] of penalties) {
        if (text.includes(keyword)) score -= value;
    }

    if (event.images?.length) score += 3;
    if (isRecurringEvent(event)) score -= 20;
    if (getEventDuration(event) > 7) score -= 12;

    return score;
}

function sortEvents(events) {
    return [...events].sort((a, b) => {
        const scoreDifference = getEditorialScore(b) - getEditorialScore(a);
        if (scoreDifference !== 0) return scoreDifference;
        return String(a.title || '').localeCompare(String(b.title || ''), 'ru');
    });
}

/**
 * Fetch events for a single category from KudaGo API
 */
async function fetchCategoryEvents(citySlug, category, dates) {
    for (let attempt = 0; attempt < 2; attempt++) {
        try {
            const response = await axios.get(`${KUDAGO.baseUrl}/events/`, {
                params: {
                    location: citySlug,
                    actual_since: dates.since,
                    actual_until: dates.until,
                    categories: category,
                    page_size: 10,
                    fields: KUDAGO.fields,
                    order_by: '-publication_date'
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
                },
                timeout: 30000
            });
            return response.data.results || [];
        } catch (error) {
            if (attempt === 1 || ![429, 500, 502, 503, 504].includes(error.response?.status)) {
                console.error(`❌ KudaGo Error (${citySlug}/${category}):`, error.message);
                return [];
            }
            await new Promise(resolve => setTimeout(resolve, 800));
        }
    }

    return [];
}

/**
 * Fetch events from KudaGo API — per-category for diversity
 */
export async function fetchEvents(citySlug) {
    const dates = getWeekendDates();
    // KudaGo places stand-up and shows in "entertainment". Include it so a
    // post is not limited to museums, lectures and chamber performances.
    const targetCategories = ['concert', 'theater', 'festival', 'entertainment', 'exhibition', 'education'];

    try {
        // A burst of 12 requests (two cities × six categories) is enough for
        // KudaGo to answer with 503. Pace requests within each city instead.
        const categoryResults = [];
        for (const category of targetCategories) {
            categoryResults.push(await fetchCategoryEvents(citySlug, category, dates));
            await new Promise(resolve => setTimeout(resolve, 250));
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

        // Apply filters
        allEvents = filterEvents(allEvents);

        // Sort by priority with weekly rotation
        allEvents = sortEvents(allEvents);

        console.log(`KudaGo ${citySlug}: fetched ${allEvents.length} events across ${targetCategories.length} categories`);

        // Limit to max events
        return allEvents.slice(0, FILTERS.maxEvents);
    } catch (error) {
        console.error(`❌ KudaGo Error (${citySlug}):`, error.message);
        return [];
    }
}

/**
 * Determine the event type from its categories or title
 * Checks ALL category tags, not just the first one
 * Also detects type from title for sources without category data (GorodZovet)
 */
function getEventType(event) {
    // Target types we want to diversify across
    const targetTypes = ['exhibition', 'concert', 'theater', 'festival', 'education', 'party', 'quest'];

    // Check KudaGo categories array
    if (event.categories && event.categories.length > 0) {
        for (const cat of event.categories) {
            const slug = (typeof cat === 'string') ? cat : (cat.slug || '');
            if (targetTypes.includes(slug)) return slug;
        }
    }

    // Fallback: detect from title/description for GorodZovet or untagged events
    const title = (event.title || event.short_title || '').toLowerCase();
    if (title.includes('выставк') || title.includes('экспозиц')) return 'exhibition';
    if (title.includes('концерт') || title.includes('музык')) return 'concert';
    if (title.includes('спектакл') || title.includes('театр') || title.includes('мюзикл')) return 'theater';
    if (title.includes('фестиваль') || title.includes('фест')) return 'festival';
    if (title.includes('лекци') || title.includes('мастер-класс')) return 'education';
    if (title.includes('вечеринк') || title.includes('party')) return 'party';
    if (title.includes('квест') || title.includes('квиз')) return 'quest';

    return 'other';
}

/**
 * Pick three editorially strong but non-repetitive recommendations. One quiet
 * cultural item may stay in the card; it can no longer dominate the selection.
 */
export function selectDiverseEvents(events, count = 3) {
    const ranked = sortEvents(events);
    const selected = [];
    const selectedCategories = new Set();
    let quietEvents = 0;

    for (const event of ranked) {
        if (selected.length >= count) break;
        const category = eventCategory(event);
        const isQuiet = category === 'exhibition' || category === 'education';
        const hasGoodUnusedCategory = ranked.some(candidate =>
            !selectedCategories.has(eventCategory(candidate)) && getEditorialScore(candidate) >= 0
        );

        if (isQuiet && quietEvents >= 1) continue;
        if (selectedCategories.has(category) && hasGoodUnusedCategory) continue;

        selected.push(event);
        selectedCategories.add(category);
        if (isQuiet) quietEvents++;
    }

    // Regional feeds can be small: complete the card instead of omitting an item.
    for (const event of ranked) {
        if (selected.length >= count) break;
        if (!selected.includes(event)) selected.push(event);
    }

    console.log('✨ Editorial picks:', selected.map(event =>
        `[${eventCategory(event)} ${getEditorialScore(event)}] ${event.title}`
    ).join(' | '));

    return selected;
}

/**
 * Format event for Telegram message (HTML mode)
 */
function formatEvent(event, index) {
    const title = event.short_title || event.title || 'Без названия';
    const cleanedTitle = cleanTitle(title);
    const price = event.price || 'Цена не указана';
    const url = event.site_url || `https://kudago.com/msk/event/${event.id}/`;

    let text = `${index + 1}. <a href="${escapeHTML(url)}">${escapeHTML(cleanedTitle)}</a>\n`;

    // Build blockquote content with description + price + place
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
        'party': 'Яркое событие для отличного настроения',
        'quest': 'Увлекательное интерактивное приключение',
        'other': 'Интересное мероприятие для культурного отдыха'
    };
    return fallbacks[type] || fallbacks['other'];
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
 * Fetch events by specific category with pagination
 * @param {string} citySlug - city slug (msk, spb)
 * @param {string} category - category slug (concert, theater, exhibition, festival, education) or 'all'
 * @param {number} page - page number (0-based)
 * @param {number} perPage - events per page
 * @returns {Object} { events: [], hasMore: boolean }
 */
export async function fetchEventsByCategory(citySlug, category, page = 0, perPage = 5) {
    const dates = getWeekendDates();

    try {
        let allEvents;

        if (category === 'all') {
            // Fetch all categories
            const targetCategories = ['exhibition', 'concert', 'theater', 'festival', 'education'];
            const categoryResults = await Promise.all(
                targetCategories.map(cat => fetchCategoryEvents(citySlug, cat, dates))
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
            // Fetch single category with larger page size for pagination
            const response = await axios.get(`${KUDAGO.baseUrl}/events/`, {
                params: {
                    location: citySlug,
                    actual_since: dates.since,
                    actual_until: dates.until,
                    categories: category,
                    page_size: 40,
                    fields: KUDAGO.fields,
                    order_by: '-publication_date'
                },
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36'
                },
                timeout: 30000
            });
            allEvents = response.data.results || [];
        }

        // Apply filters and sort
        allEvents = filterEvents(allEvents);
        allEvents = sortEvents(allEvents);

        // Paginate
        const start = page * perPage;
        const end = start + perPage;
        const pageEvents = allEvents.slice(start, end);
        const hasMore = end < allEvents.length && page < 5; // max 6 pages (0-5)

        return { events: pageEvents, hasMore };
    } catch (error) {
        console.error(`❌ KudaGo category Error (${citySlug}/${category}):`, error.message);
        return { events: [], hasMore: false };
    }
}

/**
 * Format a page of events for the bot (with blockquote)
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
