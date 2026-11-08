#!/usr/bin/env python3
"""Build the Charter House investment report V2 from the live report.

Takes the live pages (/index.html and /andy/index.html at the repo root), and:
  - moves every embedded base64 image out to v2/assets/img/*.webp (the page drops from ~11.6MB to ~0.3MB)
  - forces the light theme (the live page goes dark when a phone is in dark mode)
  - turns the three tab groups into one continuous scroll, with the tab bar as a scroll-spy nav
  - fixes the rent-growth yield labels (showed 0.1%), updates the Savills forecast to June 2026,
    and labels the simple-average return as such
  - adds the V2 visual skin (skin.css) and its small script (skin.js)
Run from anywhere: python3 v2/_build/build.py
"""
import os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__))
V2 = os.path.dirname(HERE) if os.path.basename(HERE) == "_build" else "/home/claude/charter-house/v2"
REPO = os.path.dirname(V2)

def rep(s, old, new, count=1, label=""):
    n = s.count(old)
    if n < 1:
        sys.exit(f"PATCH NOT FOUND: {label or old[:80]}")
    return s.replace(old, new) if count == 0 else s.replace(old, new, count)

def build(src, dst, prefix):
    s = open(src, encoding="utf-8").read()
    P = prefix + "assets/img/"
    F = prefix + "assets/fonts/"
    # 1. images out of the page
    def sub(m):
        name = m.group(1)
        if not os.path.exists(f"{V2}/assets/img/{name}.webp"):
            sys.exit("missing image " + name)
        return f'--{name}:url("{P}{name}.webp")'
    s, n = re.subn(r'--([a-zA-Z0-9_]+):url\((?:"|\')?data:image/[a-z+\-]+;base64,[A-Za-z0-9+/=]+(?:"|\')?\)', sub, s)
    assert n >= 90, n
    s = re.sub(r'<link rel="icon" href="data:[^"]+">', f'<link rel="icon" href="{P}logo6.webp">', s)
    # 2. light theme always
    s = rep(s, '<html lang="en">', '<html lang="en" data-theme="light">', label="html tag")
    # 2b. remove dark mode entirely: the claude.ai preview and some browsers drop or ignore data-theme,
    #     which let the original dark-mode colours (light text, light logos) apply on the light skin
    js_start = s.find("<script")
    head, tail = s[:js_start], s[js_start:]
    n1 = head.count("(prefers-color-scheme:dark)")
    head = head.replace("(prefers-color-scheme:dark)", "(prefers-color-scheme:dark) and (max-width:0px)")
    n2 = head.count('[data-theme="dark"]')
    head = head.replace('[data-theme="dark"]', '[data-theme="dark-off"]')
    assert n1 >= 7 and n2 >= 5, (n1, n2)
    head = head.replace('<meta charset="utf-8">', '<meta charset="utf-8">\n<meta name="color-scheme" content="light only">', 1)
    s = head + tail
    # 3. fonts: self-hosted Bodoni Moda + Figtree, Archivo + Besley from Google
    s = re.sub(r'<link href="https://fonts.googleapis.com/css2\?[^"]+" rel="stylesheet">',
               '<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@125,500;125,600&family=Besley:ital,wght@0,500;0,600;1,500&display=swap" rel="stylesheet">'
               f'\n<link rel="preload" href="{F}bodoni-moda-opsz.woff2" as="font" type="font/woff2" crossorigin>'
               f'\n<link rel="preload" href="{F}figtree-400.woff2" as="font" type="font/woff2" crossorigin>', s)
    # 4. one continuous scroll
    i = s.find('function renderMain(){if(!TABS[S.tab])')
    j = s.find('markNav(S.tab)}', i) + len('markNav(S.tab)}')
    assert i > 0 and j > i
    s = s[:i] + ('function renderMain(){if(!TABS[S.tab])S.tab="overview";S.group=groupOf(S.tab)[0];\n'
                 '  $("#view").innerHTML=GROUPS.map(g=>`<div class="ggroup" data-g="${g[0]}">`+g[2].map(id=>`<div class="gsec" id="t-${id}" data-sec="${id}">${T[id]()}${id==="overview"?JUMP:""}</div>`).join("")+`</div>`).join("");\n'
                 '  $("#chg").style.display="";markNav(S.tab);if(window.__v2skin)window.__v2skin()}\n'
                 'function rerender(id){const el=$("#t-"+id);if(!el){renderMain();return}el.innerHTML=T[id]()+(id==="overview"?JUMP:"");if(window.__v2skin)window.__v2skin()}') + s[j:]
    s = rep(s, 'function goTab(id){const g=groupOf(id),same=g[0]===S.group&&$("#t-"+id);S.tab=id;if(!same)renderMain();else markNav(id);\n  const el=g[2][0]===id?$("#view"):$("#t-"+id);const y=el.getBoundingClientRect().top+scrollY-navOff()-6;\n  spyLock=Date.now()+(same&&!RM?4000:300);scrollTo({top:Math.max(0,y),behavior:same&&!RM?"smooth":"auto"});',
            'function goTab(id){const g=groupOf(id);S.tab=id;S.group=g[0];markNav(id);\n  const el=$("#t-"+id)||$("#view");const y=el.getBoundingClientRect().top+scrollY-navOff()-6;\n  spyLock=Date.now()+(!RM?4000:300);scrollTo({top:Math.max(0,y),behavior:!RM?"smooth":"auto"});', label="goTab")
    s = rep(s, 'if(cur!==S.tab){S.tab=cur;markNav(cur);', 'if(cur!==S.tab){S.tab=cur;S.group=groupOf(cur)[0];markNav(cur);', label="spy")
    s = rep(s, 'if(d.mapmode){S.mapOld=d.mapmode==="old";renderMain();return}', 'if(d.mapmode){S.mapOld=d.mapmode==="old";rerender("location");return}', label="mapmode")
    s = rep(s, 'if(d.yr){S.yr=+d.yr;renderMain();return}', 'if(d.yr){S.yr=+d.yr;rerender("returns");return}', label="yr")
    s = rep(s, 'if(d.beds){S.beds=+d.beds;renderMain();return}', 'if(d.beds){S.beds=+d.beds;rerender("returns");return}', label="beds")
    s = rep(s, 'if(d.pstep!==undefined){S.payStep=+d.pstep;renderMain();return}', 'if(d.pstep!==undefined){S.payStep=+d.pstep;rerender("next");return}', label="pstep")
    # 5. data fixes
    s = rep(s, '${pct(v*12/EX.price)}</text>', '${pct(v*12/EX.price*100)}</text>', label="rent yield bug")
    s = rep(s, '<th>Price growth forecast</th><th>2025</th><th>2026</th><th>2027</th><th>2028</th><th>2029</th><th>5 years to 2029</th>',
            '<th>Price growth forecast</th><th>2026</th><th>2027</th><th>2028</th><th>2029</th><th>2030</th><th>5 years to 2030</th>', label="savills head")
    s = rep(s, '<tr class="hi"><td>North West</td><td>5.0%</td><td>7.0%</td><td>6.5%</td><td>4.5%</td><td>3.5%</td><td>29.4%</td></tr><tr><td>London</td><td>3.0%</td><td>4.0%</td><td>3.5%</td><td>3.0%</td><td>2.5%</td><td>17.1%</td></tr><tr><td>UK</td><td>4.0%</td><td>5.5%</td><td>5.0%</td><td>4.0%</td><td>3.0%</td><td>23.4%</td></tr>',
            '<tr class="hi"><td>North West</td><td>0.0%</td><td>3.5%</td><td>6.5%</td><td>6.5%</td><td>6.5%</td><td>25.0%</td></tr><tr><td>UK</td><td>&minus;2.0%</td><td>2.5%</td><td>5.0%</td><td>6.0%</td><td>6.0%</td><td>18.5%</td></tr><tr><td>London</td><td>&minus;4.0%</td><td>1.0%</td><td>3.5%</td><td>5.0%</td><td>5.0%</td><td>10.6%</td></tr>', label="savills rows")
    s = rep(s, 'https://www.savills.co.uk/research_articles/229130/376732-0" target="_blank" rel="noopener">Savills</a>',
            'https://www.savills.co.uk/insight-and-opinion/savills-news/391268/savills-revises-uk-house-price-forecast-as-higher-mortgage-costs-hit-affordability" target="_blank" rel="noopener">Savills, five-year forecast revised June 2026</a>', label="savills link")
    s = rep(s, '<div class="cap">Annualised return</div>', '<div class="cap">Average annual return</div>', label="annualised stat")
    s = rep(s, '<small>on capital deployed, 5-year exit</small>', '<small>on capital deployed, 5-year hold</small>', label="5yr exit")
    s = rep(s, '<div class="cap">Annualised</div>', '<div class="cap">Average a year</div>', label="roi annualised")
    s = rep(s, 'Annualised return is the total return divided by the years held.', 'Average annual return is the total return divided by the years held; it is not compounded.', count=0, label="annualised note")
    # 6. skin
    css = open(f"{HERE}/skin.css", encoding="utf-8").read().replace("{{F}}", F).replace("{{P}}", P)
    js = open(f"{HERE}/skin.js", encoding="utf-8").read()
    k = s.rfind("</style>")
    s = s[:k] + "\n/* ================= V2 SKIN ================= */\n" + css + "\n" + s[k:]
    k = s.rfind("</body>")
    s = s[:k] + "<script>" + js + "</script>\n" + s[k:]
    os.makedirs(os.path.dirname(dst), exist_ok=True)
    open(dst, "w", encoding="utf-8").write(s)
    print(dst, round(os.path.getsize(dst) / 1024), "KB")

build(f"{REPO}/index.html", f"{V2}/index.html", "")
build(f"{REPO}/andy/index.html", f"{V2}/andy/index.html", "../")
