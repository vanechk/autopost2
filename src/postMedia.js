const POST_IMAGE_URL = 'https://files.catbox.moe/kh2qko.jpg';
const TELEGRAM_CAPTION_LIMIT = 1024;

function getVisibleLength(html) {
    return html
        .replace(/<[^>]+>/g, '')
        .replace(/&(?:#\d+|#x[\da-f]+|[a-z]+);/gi, 'x')
        .length;
}

/**
 * Deliver a weekly post with a native Telegram photo.
 *
 * Telegram accepts at most 1,024 characters in a photo caption. For longer
 * posts, use two consecutive native messages instead of a web-page preview:
 * a real photo first, then the formatted text. This keeps the image from
 * appearing as a link in the post.
 */
export async function sendPostWithPhoto(telegram, chatId, postText) {
    try {
        if (getVisibleLength(postText) <= TELEGRAM_CAPTION_LIMIT) {
            return await telegram.sendPhoto(chatId, POST_IMAGE_URL, {
                caption: postText,
                parse_mode: 'HTML'
            });
        }

        await telegram.sendPhoto(chatId, POST_IMAGE_URL);
        return await telegram.sendMessage(chatId, postText, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });
    } catch (error) {
        console.error('❌ Sending post media failed:', error.message);
        return await telegram.sendMessage(chatId, postText, {
            parse_mode: 'HTML',
            disable_web_page_preview: true
        });
    }
}
