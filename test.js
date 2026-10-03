// node test.js — run after `node build.js`, before every deploy.
const fs = require('fs'), path = require('path'), vm = require('vm');
let fail = 0;
function assert(c, m) { if (!c) { console.error('FAIL: ' + m); fail++; } else console.log('PASS: ' + m); }

const pr = JSON.parse(fs.readFileSync('prices.json', 'utf8'));
assert(pr.petrol > 100 && pr.diesel > 100 && pr.hOctane > 100, 'prices.json has plausible petrol/diesel/hOctane values');
const V = JSON.parse(fs.readFileSync('vehicles.json', 'utf8'));
assert(V.every(r => r.length === 6 && r[3] > 0 && r[3] < 200 && ['p', 'd'].includes(r[4]) && ['car', 'bike'].includes(r[5])), 'every vehicle row is well-formed');

assert(fs.existsSync('dist/index.html'), 'dist/index.html exists (run node build.js first)');
if (fs.existsSync('dist/index.html')) {
  const files = [];
  (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : files.push(p); } })('dist');
  const html = files.filter(f => f.endsWith('.html'));
  assert(html.length >= V.length, 'generated at least one page per vehicle, plus brand/hub/utility pages (' + html.length + ' html files total)');

  let ldOk = 0, ldMissing = [], brokenLinks = [], inlineScriptErrors = [];
  for (const f of html) {
    const s = fs.readFileSync(f, 'utf8');
    const blocks = [...s.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
    if (!blocks.length) ldMissing.push(f);
    for (const m of blocks) { JSON.parse(m[1]); ldOk++; }
    for (const m of s.matchAll(/<script(?! type="application\/ld\+json")[^>]*>([\s\S]*?)<\/script>/g)) {
      if (!m[1].trim()) continue;
      try { new vm.Script(m[1], { filename: f }); } catch (e) { inlineScriptErrors.push([f, e.message]); }
    }
    // strip all <script>...</script> content before scanning for real href="" links,
    // since inline JS can contain the literal text href="...' which isn't a real link
    const sNoScript = s.replace(/<script[^>]*>[\s\S]*?<\/script>/g, '');
    for (const m of sNoScript.matchAll(/href="([^"#]+)"/g)) {
      const h = m[1]; if (h.startsWith('http') || h.startsWith('mailto')) continue;
      let p = h.startsWith('/') ? path.join('dist', h.slice(1)) : path.join(path.dirname(f), h);
      p = path.normalize(p); if (fs.existsSync(p) && fs.statSync(p).isDirectory()) p = path.join(p, 'index.html');
      if (!fs.existsSync(p)) brokenLinks.push([f, h]);
    }
  }
  // privacy.html and contact.html intentionally carry no structured data (plain informational pages)
  const unexpectedMissing = ldMissing.filter(f => !f.endsWith('privacy.html') && !f.endsWith('contact.html'));
  assert(unexpectedMissing.length === 0, 'every indexable page has valid JSON-LD (' + ldOk + ' blocks; only privacy/contact are exempt)' + (unexpectedMissing.length ? ': missing on ' + JSON.stringify(unexpectedMissing) : ''));
  assert(inlineScriptErrors.length === 0, 'every generated inline script parses (' + (html.length - inlineScriptErrors.length) + '/' + html.length + ' pages)' + (inlineScriptErrors.length ? ': ' + JSON.stringify(inlineScriptErrors.slice(0, 5)) : ''));
  assert(brokenLinks.length === 0, 'no broken internal links (' + brokenLinks.length + ' found)' + (brokenLinks.length ? ': ' + JSON.stringify(brokenLinks.slice(0, 5)) : ''));

  assert(!fs.readFileSync('dist/index.html', 'utf8').includes('<table>'), 'home page has no big vehicle table (stays minimal)');
  assert(fs.existsSync('dist/tools.html'), 'fuel and vehicle tools page exists');
  const tools = fs.existsSync('dist/tools.html') ? fs.readFileSync('dist/tools.html', 'utf8') : '';
  assert(['id="trip-form"', 'id="compare-form"', 'id="ev-form"', 'id="garage-form"'].every(id => tools.includes(id)), 'tools page includes trip, vehicle comparison, EV, and garage forms');
  assert(tools.includes('52/12') && tools.includes('kWh per 100 km') && tools.includes('localStorage.setItem("garage"'), 'tools page uses monthly average, EV tariff inputs, and local-only garage storage');
  const home = fs.readFileSync('dist/index.html', 'utf8');
  assert(home.includes('/tools.html#trip') && home.includes('/tools.html#compare') && home.includes('/tools.html#ev') && home.includes('/tools.html#garage'), 'home page links to every new fuel tool');
  assert(fs.readFileSync('dist/add.html', 'utf8').includes('id="f"'), 'add.html has its own add-vehicle form');
  assert(fs.readFileSync('dist/cars/suzuki.html', 'utf8').includes('Suzuki Alto'), 'a sample brand page (Suzuki) contains its models');

  const sm = fs.readFileSync('dist/sitemap.xml', 'utf8');
  const smCount = (sm.match(/<loc>/g) || []).length;
  assert(smCount === html.length, 'sitemap lists exactly one URL per generated page (' + smCount + ' vs ' + html.length + ' html files)');
}

const posts = JSON.parse(fs.readFileSync('blog.json', 'utf8'));
assert(posts.length >= 5, 'blog.json has at least 5 posts (' + posts.length + ')');
assert(posts.every(p => p.slug && p.title && p.excerpt && p.body && p.date && p.keywords), 'every blog post has slug/title/excerpt/body/date/keywords');
if (fs.existsSync('dist/blog')) {
  assert(fs.existsSync('dist/blog/index.html'), 'blog hub page exists');
  for (const p of posts) assert(fs.existsSync(`dist/blog/${p.slug}.html`), `blog post page exists: ${p.slug}`);
  const homeHtml = fs.readFileSync('dist/index.html', 'utf8');
  assert(homeHtml.includes('/blog/'), 'home page links to the blog');
}

if (fs.existsSync('dist/privacy.html')) {
  const priv = fs.readFileSync('dist/privacy.html', 'utf8').toLowerCase();
  assert(priv.includes('cookie') && priv.includes('google') && (priv.includes('adsense') || priv.includes('advertis')), 'privacy policy mentions cookies and Google advertising');
  assert(priv.includes('adssettings.google.com'), 'privacy policy links to Google Ads Settings opt-out');
  assert(fs.existsSync('dist/about.html'), 'about.html exists');
  assert(fs.existsSync('dist/contact.html'), 'contact.html exists');
  const hist = fs.readFileSync('dist/price-history.html', 'utf8');
  assert(hist.includes('Change</th>'), 'price history page shows a day-over-day change column');
}

if (fs.existsSync('dist/index.html')) {
  const allHtml = [];
  (function walk(d) { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); fs.statSync(p).isDirectory() ? walk(p) : (f.endsWith('.html') && allHtml.push(p)); } })('dist');
  const noKeywords = allHtml.filter(f => !fs.readFileSync(f, 'utf8').includes('name="keywords"'));
  const noTwitterFull = allHtml.filter(f => { const s = fs.readFileSync(f, 'utf8'); return !s.includes('twitter:title') || !s.includes('twitter:description') || !s.includes('twitter:image'); });
  const noSharedLayout = allHtml.filter(f => {
    const s = fs.readFileSync(f, 'utf8');
    return !s.includes('class="nav-links"') || !s.includes('href="/" aria-label="Home page"') || !s.includes('href="#i-home"') || !s.includes('href="/tools.html"') || !s.includes('class="footer-inner"') || !s.includes('id="peto-fab"') ||
      !s.includes('#peto-panel{position:fixed') || !s.includes('width:min(360px,calc(100vw - 32px))') ||
      !s.includes('height:min(520px,calc(100dvh - 104px))');
  });
  const noPetoTools = allHtml.filter(f => {
    const s = fs.readFileSync(f, 'utf8');
    return !s.includes('action:trip') || !s.includes('action:monthly') || !s.includes('action:compare') ||
      !s.includes('action:ev') || !s.includes('action:garage');
  });
  assert(noKeywords.length === 0, `every page has a meta keywords tag (${allHtml.length - noKeywords.length}/${allHtml.length})` + (noKeywords.length ? ': missing on ' + JSON.stringify(noKeywords.slice(0, 5)) : ''));
  assert(noTwitterFull.length === 0, `every page has full Twitter card tags (title/description/image) (${allHtml.length - noTwitterFull.length}/${allHtml.length})`);
  assert(noSharedLayout.length === 0, `every page has the responsive shared header/footer and bounded Peto widget (${allHtml.length - noSharedLayout.length}/${allHtml.length})` + (noSharedLayout.length ? ': missing on ' + JSON.stringify(noSharedLayout.slice(0, 5)) : ''));
  assert(noPetoTools.length === 0, `Peto offers the new calculation and garage flows on every page (${allHtml.length - noPetoTools.length}/${allHtml.length})`);
  const home = fs.readFileSync('dist/index.html', 'utf8');
  assert(!home.includes('setTimeout(function(){if(!panel.classList.contains("open"))open()}'), 'Peto does not open automatically on the home page');
}

const { execSync } = require('child_process');
const nodeBin = JSON.stringify(process.execPath);
execSync(`${nodeBin} --check build.js && ${nodeBin} --check fetch-prices.js`);
console.log('PASS: build.js and fetch-prices.js have no syntax errors');

console.log(fail ? ('\n' + fail + ' TEST(S) FAILED') : '\nALL TESTS PASSED');
process.exit(fail ? 1 : 0);
