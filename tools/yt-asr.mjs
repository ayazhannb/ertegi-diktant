// Dump ASR transcript (whatever language is exposed) with timestamps — used as timing/content guide.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const id = process.argv[2];
const r = await fetch(`https://www.youtube.com/watch?v=${id}&hl=tr&gl=TR`, { headers: { 'user-agent': UA, 'accept-language': 'tr;q=0.9' } });
const html = await r.text();
const m = html.match(/var ytInitialPlayerResponse = (\{.+?\});(?:var |<\/script>)/s);
const pr = JSON.parse(m[1]);
const vd = pr.videoDetails || {};
const tracks = pr.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
const t = tracks[0];
console.log(`# ${vd.title} | duration=${vd.lengthSeconds}s | track=${t?.languageCode}`);
const cr = await fetch(t.baseUrl, { headers: { 'user-agent': UA } });
const xml = await cr.text();
const lines = [...xml.matchAll(/<text start="([\d.]+)" dur="([\d.]+)">(.*?)<\/text>/gs)];
for (const [, s, d, raw] of lines) {
  const text = raw.replace(/<[^>]+>/g, '').replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();
  console.log(`${(+s).toFixed(1)}|${(+(+s + +d)).toFixed(1)}|${text}`);
}
