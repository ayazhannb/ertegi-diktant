const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const id = process.argv[2];
const r = await fetch(`https://www.youtube.com/watch?v=${id}&hl=tr&gl=TR`, { headers: { 'user-agent': UA, 'accept-language': 'tr;q=0.9', 'accept-encoding': 'identity' } });
const html = await r.text();
const m = html.match(/var ytInitialPlayerResponse = (\{.+?\});(?:var |<\/script>)/s);
const pr = JSON.parse(m[1]);
const t = (pr.captions?.playerCaptionsTracklistRenderer?.captionTracks || [])[0];
let base = t.baseUrl;
// try json3 variant
const cr = await fetch(base + '&fmt=json3', { headers: { 'user-agent': UA, 'accept-encoding': 'identity' } });
let txt = await cr.text();
console.log('json3 status', cr.status, 'len', txt.length);
if (txt.length < 50) {
  const cr2 = await fetch(base, { headers: { 'user-agent': UA, 'accept-encoding': 'identity' } });
  txt = await cr2.text();
  console.log('xml status', cr2.status, 'len', txt.length);
}
console.log(txt.slice(0, 1200));
