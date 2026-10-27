// Verify a YouTube video is embeddable; print title, author, duration, status.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const ids = process.argv.slice(2);
for (const id of ids) {
  let line = `${id} | `;
  // oEmbed metadata
  try {
    const om = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent('https://www.youtube.com/watch?v=' + id)}&format=json`, { headers: { 'user-agent': UA } });
    const oj = om.ok ? await om.json() : {};
    line += `title="${oj.title ?? 'N/A'}" author="${oj.author_name ?? 'N/A'}" | `;
    globalThis.__thumb = oj.thumbnail_url;
  } catch { line += 'oEmbed FAIL | '; }
  // embed page
  try {
    const r = await fetch(`https://www.youtube.com/embed/${id}`, { headers: { 'user-agent': UA, 'accept-language': 'ru-KZ,ru;q=0.9' } });
    const html = await r.text();
    const dur = html.match(/"lengthSeconds":"(\d+)"/) || html.match(/lengthSeconds["\s:]+(\d+)/);
    const status =
      /Video unavailable/i.test(html) ? 'UNAVAILABLE'
      : /Embedding (disabled|is disabled)/i.test(html) || /embedding-disabled/i.test(html) ? 'EMBED_DISABLED'
      : /Sign in to confirm/i.test(html) ? 'BOT_CHECK'
      : 'OK';
    line += `status=${status} duration=${dur ? dur[1] + 's' : 'N/A'}`;
  } catch (e) { line += `embed FETCH FAIL: ${e.message}`; }
  console.log(line);
}
