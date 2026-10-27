// Search YouTube for Kazakh fairy tales; prints videoId, title, channel, duration.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const query = process.argv[2];
const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(query);
const res = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'ru-KZ,ru;q=0.9,kk;q=0.8' } });
const html = await res.text();
const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
if (!m) { console.log('NO ytInitialData'); process.exit(1); }
const data = JSON.parse(m[1]);
const out = [];
function walk(o) {
  if (!o || typeof o !== 'object') return;
  if (o.videoRenderer) {
    const v = o.videoRenderer;
    out.push({
      id: v.videoId,
      title: (v.title?.runs || []).map(r => r.text).join(''),
      channel: (v.ownerText?.runs || []).map(r => r.text).join(''),
      length: v.lengthText?.simpleText || '',
      views: v.viewCountText?.simpleText || '',
    });
  }
  for (const k of Object.keys(o)) walk(o[k]);
}
walk(data);
const seen = new Set();
for (const v of out) {
  if (seen.has(v.id)) continue; seen.add(v.id);
  console.log(`${v.id} | ${v.length} | ${v.views} | ${v.channel} | ${v.title}`);
  if (seen.size >= 10) break;
}
