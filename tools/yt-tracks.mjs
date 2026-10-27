const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const id = process.argv[2], hl = process.argv[3] || 'ru';
const r = await fetch(`https://www.youtube.com/watch?v=${id}&hl=${hl}&gl=KZ`, { headers: { 'user-agent': UA, 'accept-language': `${hl}-KZ,${hl};q=0.9` } });
const html = await r.text();
const m = html.match(/var ytInitialPlayerResponse = (\{.+?\});(?:var |<\/script>)/s);
if (!m) { console.log('NO playerResponse'); process.exit(1); }
const pr = JSON.parse(m[1]);
const tracks = pr.captions?.playerCaptionsTracklistRenderer?.captionTracks || [];
console.log(`hl=${hl}: ${tracks.map(t => `${t.languageCode}${t.kind ? '(asr)' : ''}`).join(', ') || 'none'}`);
