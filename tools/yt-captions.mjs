// Fetch video metadata + auto-caption transcript from YouTube (no API key).
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const id = process.argv[2];
const r = await fetch(`https://www.youtube.com/watch?v=${id}&hl=kk`, { headers: { 'user-agent': UA, 'accept-language': 'kk,ru;q=0.9' } });
const html = await r.text();
const m = html.match(/var ytInitialPlayerResponse = (\{.+?\});(?:var |<\/script>)/s);
if (!m) { console.log('NO playerResponse'); process.exit(1); }
const pr = JSON.parse(m[1]);
const vd = pr.videoDetails || {};
const status = pr.playabilityStatus || {};
console.log(`status=${status.status} reason=${status.reason || ''}`);
console.log(`duration=${vd.lengthSeconds}s title="${vd.title}"`);
const tracks = pr.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
console.log(`tracks: ${tracks.map(t => `${t.languageCode}${t.kind ? '(asr)' : ''}`).join(', ') || 'none'}`);
const track = tracks.find(t => t.languageCode.startsWith('kk')) || tracks[0];
if (!track) { console.log('NO TRACK'); process.exit(0); }
const cr = await fetch(track.baseUrl, { headers: { 'user-agent': UA } });
const xml = await cr.text();
const lines = [...xml.matchAll(/<text start="([\d.]+)" dur="([\d.]+)">(.*?)<\/text>/gs)];
for (const [,, , s, d, raw] of lines) {
  const text = raw.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
  console.log(`${(+s).toFixed(1)}+${(+d).toFixed(1)} ${text}`);
}
