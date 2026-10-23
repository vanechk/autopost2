import { CURATION } from './config.js';

/**
 * Editorial curation for the weekly post.
 *
 * The audience is a team of colleagues, so a pick has to be (1) safe for a
 * broad adult audience, (2) something people actually plan a weekend around —
 * a named artist on tour, a hit show, a popular comedian — and (3) new: a
 * listing that ran in one of the last posts for the same city does not come
 * back. Afisha tags carry most of the signal, so scoring leans on them rather
 * than on keywords in the description.
 */

function tagsOf(event) {
    return (event.tagCodes || []).map(code => String(code).toLowerCase());
}

function textOf(event) {
    return `${event.title || ''} ${event.description || ''}`.toLowerCase();
}

/**
 * Normalised listing key used to recognise a repeat across weeks: the same
 * Afisha card gets a new id per season, and "Моцарт при свечах. Ночь в
 * Зальцбурге" should match regardless of punctuation or quotes.
 */
export function normalizeTitle(title) {
    return String(title || '')
        .toLowerCase()
        .replace(/ё/g, 'е')
        .replace(/&amp;/g, '&')
        .replace(/[«»"'“”„.,:;!?()—–\-…]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Hard stop for content that does not belong in a team post: prison chanson,
 * deliberately provocative acts and spiritual music. Returns the reason or null.
 */
export function getBlockReason(event) {
    const tags = tagsOf(event);
    const blockedTag = CURATION.blockedTags.find(tag => tags.includes(tag));
    if (blockedTag) return `tag:${blockedTag}`;

    const text = textOf(event);
    const blockedWord = CURATION.blockedKeywords.find(word => text.includes(word));
    if (blockedWord) return `keyword:${blockedWord}`;

    const title = normalizeTitle(event.title);
    const blockedArtist = CURATION.blockedArtists.find(artist => {
        const name = normalizeTitle(artist);
        // Whole-word match: "Ленинград" must not hit "Ленинградская симфония".
        return new RegExp(`(^|\\s)${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}($|\\s)`).test(title);
    });
    if (blockedArtist) return `artist:${blockedArtist}`;

    return null;
}

/**
 * A "generic programme": candlelight concerts, orchestras playing film scores
 * or someone else's hits, tribute nights. Afisha sells plenty of these every
 * weekend, and they kept crowding out actual artists.
 */
function isGenericProgramme(event) {
    const tags = tagsOf(event);
    if (tags.some(tag => CURATION.genericTags.includes(tag))) return true;
    return CURATION.genericTitlePattern.test(event.title || '');
}

function isFolkEnsemble(event) {
    return CURATION.folkEnsemblePattern.test(event.title || '');
}

/** Days between the first and the last listed date. */
function getRunLengthDays(event) {
    const dates = (event.dates || []).filter(date => typeof date === 'string').sort();
    if (dates.length < 2) return 0;
    return (new Date(dates[dates.length - 1]) - new Date(dates[0])) / 86400000;
}

/**
 * Score an Afisha listing. Roughly: a named touring artist from Afisha's
 * popular list ≈ 90–110, an ordinary club gig ≈ 45, a candlelight or film-score
 * programme ≈ 10.
 */
export function scoreAfishaEvent(event) {
    const tags = tagsOf(event);
    const category = event.categories?.[0] || 'other';
    let score = CURATION.categoryBase[category] ?? 0;

    for (const [tag, value] of Object.entries(CURATION.tagWeights)) {
        if (tags.includes(tag)) score += value;
    }

    // Position in Afisha's own popularity-ranked rubric list (0 = top).
    if (Number.isInteger(event.popularityRank) && event.popularityRank >= 0) {
        score += Math.max(0, 25 - event.popularityRank / 8);
    }

    if (isGenericProgramme(event)) score -= 35;
    if (isFolkEnsemble(event)) score -= 30;
    if (tags.includes('classical_music') && !tags.includes('artist-tour') && !tags.includes('top-persons')) score -= 10;

    // Concerts and shows that run for months (a planetarium show, a weekly
    // comedy night) say nothing about this particular weekend. Exhibitions and
    // repertory theatre run for months by nature, so they are exempt.
    const isLongRunByNature = category === 'exhibition' || category === 'theater';
    if (!isLongRunByNature && (getRunLengthDays(event) > 45 || (event.dates || []).length >= 8)) score -= 12;

    // Zoo tickets, aquariums and a museum's permanent collection are listed
    // as exhibitions but are not news for the weekend.
    if (CURATION.notAnExhibitionPattern.test(event.title || '')) score -= 30;

    if (event.images?.length) score += 2;

    return Math.round(score);
}

/**
 * Mark repeats from recent posts. `recent` is a Set of normalised titles
 * already posted for this city in the last CURATION.repeatWindowWeeks weeks.
 */
export function isRecentRepeat(event, recent) {
    if (!recent || recent.size === 0) return false;
    const title = normalizeTitle(event.short_title || event.title);
    if (recent.has(title)) return true;
    // "Моцарт при свечах. Ночь в Зальцбурге" vs "Моцарт при свечах" — match
    // on the part before the first full stop as well.
    const head = normalizeTitle(String(event.short_title || event.title || '').split('.')[0]);
    return [...recent].some(prev =>
        (head.length >= 6 && (prev === head || prev.startsWith(`${head} `)))
        // Long titles were stored cut at 72 chars with "…".
        || (prev.length >= 30 && title.startsWith(prev))
    );
}

/**
 * The post card is a mix: one concert, one thing on stage (theatre, show,
 * stand-up) and one outing in the city (exhibition, festival, fair).
 */
const SLOTS = ['concert', 'stage', 'outing'];

function slotType(event) {
    const categories = (event.categories || []).map(category => typeof category === 'string' ? category : category.slug);
    if (categories.includes('concert')) return 'concert';
    if (categories.some(category => ['theater', 'show', 'standup', 'entertainment'].includes(category))) return 'stage';
    return 'outing';
}

/**
 * Pick `count` events for a city card: block unsuitable content, drop recent
 * repeats, then take the best fresh listing for each slot (concert, stage,
 * outing). A slot the city cannot fill goes to the best remaining listing.
 */
export function curateEvents(events, { count = 3, recentTitles = new Set(), scoreFn = scoreAfishaEvent, label = '' } = {}) {
    const seenTitles = new Set();
    const pool = [];

    for (const event of events) {
        const reason = getBlockReason(event);
        if (reason) {
            console.log(`🚫 Blocked (${reason}): ${event.title}`);
            continue;
        }
        const key = normalizeTitle(event.short_title || event.title);
        if (seenTitles.has(key)) continue;
        seenTitles.add(key);

        const repeat = isRecentRepeat(event, recentTitles);
        pool.push({ event, score: scoreFn(event), repeat });
    }

    // Fresh listings first; repeats only if the city has nothing else.
    pool.sort((a, b) => (a.repeat - b.repeat) || (b.score - a.score));

    const fresh = pool.filter(item => !item.repeat && item.score >= CURATION.minScore);
    const selected = [];

    for (const slot of SLOTS.slice(0, count)) {
        const best = fresh.find(item => slotType(item.event) === slot);
        if (best) selected.push(best);
    }
    for (const item of fresh) {
        if (selected.length >= count) break;
        if (!selected.includes(item)) selected.push(item);
    }

    // Small regional feeds: fill with whatever is left, repeats last.
    for (const item of pool) {
        if (selected.length >= count) break;
        if (!selected.includes(item) && !item.repeat) selected.push(item);
    }
    // A city card is never left empty just because its only listing ran before.
    if (selected.length === 0 && pool.length > 0) selected.push(pool[0]);

    // Concert first, then stage, then outing — the card reads as a mix.
    selected.sort((a, b) => SLOTS.indexOf(slotType(a.event)) - SLOTS.indexOf(slotType(b.event)) || b.score - a.score);
    console.log(`✨ Picks${label ? ` ${label}` : ''}:`, selected.map(item => `[${slotType(item.event)} ${item.score}] ${item.event.title}`).join(' | '));
    return selected.map(item => item.event);
}
