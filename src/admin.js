import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { fetchEvents } from './events.js';
import { selectDiverseEvents } from './kudago.js';
import { CITIES, MOVIES, RECIPES } from './config.js';
import { cleanDescription, cleanTitle, escapeHTML } from './textUtils.js';

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
 * Get plain emoji matching the event type
 */
function getEventEmoji(event) {
    // Check KudaGo categories
    const cats = (event.categories || []).map(c => typeof c === 'string' ? c : (c.slug || ''));

    // Match by category
    if (cats.includes('exhibition')) return '🖼️';
    if (cats.includes('concert')) return '🎹';
    if (cats.includes('theater')) return '🎭';
    if (cats.includes('festival')) return '🎉';
    if (cats.includes('show')) return '🎪';
    if (cats.includes('standup')) return '🎤';
    if (cats.includes('education')) return '📚';
    if (cats.includes('party')) return '🎉';
    if (cats.includes('quest')) return '🧩';

    // Fallback: detect from title for GorodZovet events
    const title = (event.title || event.short_title || '').toLowerCase();
    if (title.includes('выставк') || title.includes('экспозиц')) return '🖼️';
    if (title.includes('стендап')) return '🎤';
    if (title.includes('концерт') || title.includes('музык')) return '🎹';
    if (title.includes('спектакл') || title.includes('театр') || title.includes('мюзикл')) return '🎭';
    if (title.includes('фестиваль') || title.includes('фест')) return '🎉';
    if (title.includes('лекци') || title.includes('мастер-класс')) return '📚';
    if (title.includes('вечеринк')) return '🎉';
    if (title.includes('квест') || title.includes('квиз')) return '🧩';

    return '✨';
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

/** Link to the official Kinopoisk search for a recommended film. */
function getKinopoiskUrl(title) {
    return `https://www.kinopoisk.ru/s/?query=${encodeURIComponent(title)}`;
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
        let cityPost = `📍 <b>${escapeHTML(city.name)}</b>\n`;
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
    const movieLink = `<a href="${getKinopoiskUrl(cleanedMovieTitle)}">${escapeHTML(cleanedMovieTitle)}</a>`;
    const movieDesc = cleanDescription(movie.desc, 100) || movie.desc.replace(/\.+$/, '.');
    const recipeLink = `<a href="${escapeHTML(recipe.url)}">${escapeHTML(cleanTitle(recipe.title))}</a>`;

    post += `🏠 <b>Если не хотите выходить из дома:</b>
🎬 Посмотреть фильм «${movieLink}» — ${escapeHTML(movieDesc)}
🍰 ${recipeLink} — рецепт

<a href="https://t.me/kudagoduiobot?start=weekend">Больше ✨ ✨</a>`;

    if (post.length > 3500) {
        throw new Error(`Compact post is too long: ${post.length} characters`);
    }

    return post;
}
