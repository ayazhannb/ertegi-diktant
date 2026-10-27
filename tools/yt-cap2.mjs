const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const id = process.argv[2];
const r = await fetch(`https://www.youtube.com/watch?v=${id}&hl=tr&gl=TR`, { headers: { 'user-agent': UA, 'accept-language': 'tr;q=0.9' }, redirect: 'follow' });
const html = await r.text();
const m = html.match(/var ytInitialPlayerResponse = (\{.+?\});(?:var |<\/script>)/s);
const pr = JSON.parse(m[1]);
const t = (pr.captions?.playerCaptionsTracklistRenderer?.captionTracks || [])[0];
// Try with cookies + referer
for (const extra of ['', '&fmt=json3']) {
  const cr = await fetch(t.baseUrl + extra, {
    headers: {
      'user-agent': UA,
      'accept': 'text/xml,application/xml',
      'referer': `https://www.youtube.com/watch?v=${id}`,
      'cookie': 'CONSENT=YES+cb.20210328-17-p0.en+FX+419; PREF=tz=Asia.Almaty&hl=tr',
    },
  });
  const txt = await cr.text();
  console.log('variant', extra || 'xml', 'status', cr.status, 'len', txt.length);
  if (txt.length > 100) { console.log(txt.slice(0, 600)); break; }
}
