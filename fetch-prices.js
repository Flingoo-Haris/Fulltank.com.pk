// Runs daily via GitHub Actions at 12:00 AM PKT (19:00 UTC).
// Reads a few public price pages, takes the majority value per fuel, and
// keeps the previous prices.json untouched if nothing valid is found.
const fs = require('fs');
const SRC = ['https://shareide.com/petrol-price-pakistan', 'https://petrolratetoday.pk/', 'https://www.pakwheels.com/petroleum-prices-in-pakistan'];
const num = (t, re) => { const m = t.match(re); const v = m && parseFloat(m[1]); return v > 100 && v < 1000 ? v : null; };
const vote = a => { const c = {}; a.filter(Boolean).forEach(v => c[v] = (c[v] || 0) + 1); const k = Object.keys(c).sort((x, y) => c[y] - c[x])[0]; return k ? parseFloat(k) : null; };
(async () => {
  const P = [], D = [], H = [];
  for (const u of SRC) {
    try {
      const r = await fetch(u, { headers: { 'user-agent': 'Mozilla/5.0 fuel-calculator' } });
      const t = (await r.text()).replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<[^>]+>/g, ' ').replace(/\s+/g, ' ');
      P.push(num(t, /(?:petrol|super)[^\d]{0,60}?(?:rs\.?|pkr)?\s*(\d{3}\.\d{1,2})/i));
      D.push(num(t, /(?:high[- ]speed diesel|hsd)[^\d]{0,60}?(?:rs\.?|pkr)?\s*(\d{3}\.\d{1,2})/i));
      H.push(num(t, /(?:hobc|high octane)[^\d]{0,60}?(?:rs\.?|pkr)?\s*(\d{3}\.\d{1,2})/i));
    } catch (e) { console.warn('source failed', u, e.message); }
  }
  const old = JSON.parse(fs.readFileSync('prices.json', 'utf8'));
  const petrol = vote(P) || old.petrol, diesel = vote(D) || old.diesel, hOctane = vote(H) || old.hOctane;
  if (!vote(P) || !vote(D)) { console.warn('No valid petrol/diesel price found from any source — keeping previous prices.json'); return; }
  const date = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Karachi' });
  fs.writeFileSync('prices.json', JSON.stringify({ petrol, hOctane, diesel, date }));
  let hist = []; try { hist = JSON.parse(fs.readFileSync('history.json')); } catch (e) {}
  const iso = new Date(Date.now() + 5 * 3600e3).toISOString().slice(0, 10);
  hist = hist.filter(x => x.iso !== iso); hist.push({ iso, date, petrol, hOctane, diesel }); hist.sort((a, b) => a.iso < b.iso ? -1 : 1);
  fs.writeFileSync('history.json', JSON.stringify(hist.slice(-400)));
  console.log('updated prices.json:', { petrol, hOctane, diesel, date });
})();
