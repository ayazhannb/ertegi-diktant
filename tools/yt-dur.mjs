const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
for (const id of process.argv.slice(2)) {
  const r = await fetch(`https://www.youtube.com/watch?v=${id}`, { headers: { 'user-agent': UA, 'accept-language': 'tr;q=0.9' } });
  const html = await r.text();
  const m = html.match(/var ytInitialPlayerResponse = (\{.+?\});(?:var |<\/script>)/s);
  const pr = JSON.parse(m[1]);
  console.log(`${id} | ${pr.videoDetails.lengthSeconds}s | ${pr.videoDetails.title.slice(0, 60)}`);
}
