import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fetchEvents } from './events.js';
import { selectDiverseEvents } from './kudago.js';
import { CITIES, MOVIES, RECIPES } from './config.js';
import { cleanTitle, escapeHTML } from './textUtils.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const POST_IMAGE_PATH = join(__dirname, '..', 'Post', 'telegram-cloud-photo-size-2-5192667404658479432-y.jpg');

// Admin ID from environment
const ADMIN_ID = process.env.ADMIN_ID ? parseInt(process.env.ADMIN_ID) : null;

/**
 * Check if user is admin
 */
export function isAdmin(userId) {
    return ADMIN_ID && userId === ADMIN_ID;
}

/**
 * Get post image path
 */
export function getPostImagePath() {
    return POST_IMAGE_PATH;
}

/**
 * Get custom emoji matching the event type
 */
function getEventEmoji(event) {
    // Check KudaGo categories
    const cats = (event.categories || []).map(c => typeof c === 'string' ? c : (c.slug || ''));

    function ce(id, fallback) {
        return `<tg-emoji emoji-id="${id}">${fallback}</tg-emoji>`;
    }

    // Match by category
    if (cats.includes('exhibition')) return ce('5375074927252621134', '🖼️');
    if (cats.includes('concert')) return ce('5467398680959023683', '🎹');
    if (cats.includes('theater')) return ce('5359441070201513074', '🎭');
    if (cats.includes('festival')) return ce('5193018401810822951', '🎉');
    if (cats.includes('show')) return ce('5193018401810822951', '🎪');
    if (cats.includes('standup')) return ce('5193018401810822951', '🎤');
    if (cats.includes('education')) return ce('5373098009640836781', '📚');
    if (cats.includes('party')) return ce('5193018401810822951', '🎉');
    if (cats.includes('quest')) return ce('5213306719215577669', '🧩');

    // Fallback: detect from title for GorodZovet events
    const title = (event.title || event.short_title || '').toLowerCase();
    if (title.includes('выставк') || title.includes('экспозиц')) return ce('5375074927252621134', '🖼️');
    if (title.includes('концерт') || title.includes('музык')) return ce('5467398680959023683', '🎹');
    if (title.includes('спектакл') || title.includes('театр') || title.includes('мюзикл')) return ce('5359441070201513074', '🎭');
    if (title.includes('фестиваль') || title.includes('фест')) return ce('5193018401810822951', '🎉');
    if (title.includes('лекци') || title.includes('мастер-класс')) return ce('5373098009640836781', '📚');
    if (title.includes('вечеринк')) return ce('5193018401810822951', '🎉');
    if (title.includes('квест') || title.includes('квиз')) return ce('5213306719215577669', '🧩');

    return ce('5193018401810822951', '🎉');
}

/**
 * Simple HTML entity decoder
 */
function decodeHTMLEntities(text) {
    if (!text) return '';
    return text
        .replace(/&quot;/g, '"')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&#39;/g, "'")
        .replace(/&nbsp;/g, ' ');
}

/**
 * Escape HTML special characters
 */

/**
 * Generate full post with events from all cities
 */
export async function generatePost() {
    const weekIndex = Math.floor(Date.now() / (7 * 24 * 60 * 60 * 1000));
    const movie = MOVIES[weekIndex % MOVIES.length];
    const recipe = RECIPES[weekIndex % RECIPES.length];
    const maxTitleLength = 72;

    let post = `Дорогие коллеги 👋 самое время подумать о выходных!
Подобрали для вас интересные мероприятия 🗺️

`;

    const cityResults = await Promise.all(Object.entries(CITIES).map(async ([slug, city]) => {
        let cityPost = `📍 <a href="${escapeHTML(city.yandexAfishaUrl)}"><b>${escapeHTML(city.name)}</b></a>\n`;
        let events = [];

        try {
            events = await fetchEvents(slug);
        } catch (error) {
            console.error(`Error fetching events for ${slug}:`, error.message);
        }

        const topEvents = selectDiverseEvents(events, 3);
        if (topEvents.length === 0) {
            cityPost += `Мероприятия уточняются.\n\n`;
        } else {
            topEvents.forEach(event => {
                const emoji = getEventEmoji(event);
                const title = event.short_title || event.title || 'Мероприятие';
                const url = event.site_url || event.url || '';
                const cleanedTitle = cleanTitle(title);
                const shortTitle = cleanedTitle.length > maxTitleLength
                    ? `${cleanedTitle.slice(0, maxTitleLength - 1).trim()}…`
                    : cleanedTitle;
                const formattedTitle = url ? `<a href="${escapeHTML(url)}">${escapeHTML(shortTitle)}</a>` : escapeHTML(shortTitle);
                const price = event.price && event.price !== 'Цена не указана'
                    ? ` (${escapeHTML(cleanTitle(event.price))})`
                    : '';

                cityPost += `${emoji} ${formattedTitle}${price}\n`;
            });
            cityPost += '\n';
        }
        return cityPost;
    }));

    post += cityResults.join('');

    const cleanedMovieTitle = cleanTitle(movie.title.replace(/[«»]/g, ''));
    const movieLink = `<a href="${escapeHTML(movie.url)}">${escapeHTML(cleanedMovieTitle)}</a>`;
    const recipeLink = `<a href="${escapeHTML(recipe.url)}">рецепт</a>`;

    post += `🏠 <b>Если не хотите выходить из дома:</b>
🎬 Посмотреть фильм «${movieLink}»
🍰 ${escapeHTML(cleanTitle(recipe.title))} — ${recipeLink}

Больше идей — в нашем <a href="https://t.me/kudagoduiobot?start=weekend">боте</a> ✨`;

    if (post.length > 3500) {
        throw new Error(`Compact post is too long: ${post.length} characters`);
    }

    return post;
}
