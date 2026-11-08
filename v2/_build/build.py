#!/usr/bin/env python3
"""Builds the Charter House investment report V2 (single-scroll, light BRIK theme).

Outputs:
  <repo>/v2/index.html        Charlie Baxter version
  <repo>/v2/andy/index.html   Andy Davies version
All figures in the returns section are computed here from the same model the live report uses.
"""
import os, html, urllib.parse
from PIL import Image

HERE_ = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.dirname(HERE_) if os.path.basename(HERE_) == "_build" else "/home/claude/charter-house/v2"
IMGDIR = f"{OUT}/assets/img"
HERE = os.path.dirname(os.path.abspath(__file__))
REPORT_DATE = "November 2026"

# ------------------------------------------------------------------ model (mirrors the live report's EX / model())
EX = dict(price=189000, rent=1300, sc=83.33, rate=.04, ltv=.75, mgmt=.10, rg=.04, cv=195000, cg=.05,
          legal_ex=1200, legal_comp=700, reserve=3000, deposit=2500, admin=500)

def sdlt_higher(p):
    bands = [(125000, .05), (250000, .07), (925000, .10), (1500000, .15), (10**12, .17)]
    t, prev = 0, 0
    for lim, r in bands:
        if p > prev: t += (min(p, lim) - prev) * r
        prev = lim
    return t

M = {}
M["mort"] = EX["price"] * EX["ltv"] * EX["rate"] / 12
M["fee"] = EX["rent"] * EX["mgmt"]
M["net"] = EX["rent"] - M["mort"] - EX["sc"] - M["fee"]
M["yld"] = EX["rent"] * 12 / EX["price"] * 100
M["dep"] = EX["price"] * .2
M["bal"] = M["dep"] - EX["deposit"]
M["st"] = sdlt_higher(EX["price"])
M["top"] = EX["price"] * .05
M["exch_pay"] = M["bal"] + EX["legal_ex"]
M["comp_pay"] = M["top"] + M["st"] + EX["legal_comp"]
M["cash"] = EX["reserve"] + M["exch_pay"] + M["comp_pay"]
rent_y = lambda y: EX["rent"] * (1 + EX["rg"]) ** (y - 1)
value_y = lambda y: EX["cv"] * (1 + EX["cg"]) ** y
def income_to(n):
    return sum(12 * (rent_y(y) * (1 - EX["mgmt"]) - M["mort"] - EX["sc"]) for y in range(1, n + 1))
ROI = []
for n in (5, 10, 15, 20):
    g = value_y(n) - EX["price"]; inc = income_to(n); tot = (g + inc) / M["cash"] * 100
    ROI.append(dict(n=n, value=value_y(n), gain=g, inc=inc, tot=tot, avg=tot / n))
assert round(M["cash"]) == 60380 and round(M["net"], 2) == 614.17, (M["cash"], M["net"])

gbp = lambda n: "£" + f"{round(n):,}"
gbp2 = lambda n: "£" + f"{n:,.2f}"
e = html.escape

# ------------------------------------------------------------------ agents
AGENTS = {
 "cb": dict(
   name="Charlie Baxter", first="Charlie", role="Co-founder and Sales Director",
   role_long="Co-founder and Sales Director, BRIK Studios and BRIK Capital",
   phone="07353 164480", tel="+447353164480", email="charlie@brik-studios.com", wa="447353164480",
   cal="https://calendly.com/charlie-brik-studios/charter-house-3d-tour-video-call", photo="charlie",
   own_eyebrow="Skin in the game", own_h="I've bought into their last building <em>myself.</em>",
   own_lead="I personally own an apartment at Albion House, Hall &amp; Co's previous Underbanks building. Same developer, same architect. That tells you everything about how I feel about their product.",
   own_cred="<b>BSc (Hons) Investment and Financial Risk Management</b><span>Cass Business School, 15th in Europe, FT 2017</span>",
   contact=[("Charlie Baxter", "Co-founder and Sales Director, BRIK Studios and BRIK Capital"),
            ("BSc (Hons) Investment and Financial Risk Management", "Cass Business School, ranked 15th in Europe by the Financial Times (2017)"),
            ("10 years in property", "with a personal property portfolio in Stockport, including an apartment at Albion House")]),
 "ad": dict(
   name="Andy Davies", first="Andy", role="Senior Consultant", role_long="Senior Consultant, BRIK Studios",
   phone="07760 462489", tel="+447760462489", email="andy@brik-studios.com", wa="447760462489",
   cal="https://calendly.com/andy-brik-studios/charter-house-3d-tour-video-call", photo="andy",
   own_eyebrow="Track record", own_h="I've sold this developer's last <em>buildings.</em>",
   own_lead="I've been heavily involved in Hall &amp; Co's previous Underbanks launches, including St Marys Gate and Albion House, and I've personally sold a significant share of the apartments in every one of their blocks. Same developer, same architect. I also have my own property portfolio in Stockport, so I know this market as an investor, not just as an agent.",
   own_cred="<b>Every previous Hall &amp; Co launch in the Underbanks</b><span>Stockport investor</span>",
   contact=[("Andy Davies", "Senior Consultant, BRIK Studios"),
            ("Sold across every previous block", "Heavily involved in Hall &amp; Co's previous Underbanks launches with the same architect, and personally responsible for a significant share of the sales in each one"),
            ("A Stockport investor himself", "with his own property portfolio in the town")]),
}

ICON = {
 "wa": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1-1.5-2-1-1 1a4 4 0 0 1-2-2l1-1-1-2z"/></svg>',
 "cal": '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="1"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
 "menu": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h10"/></svg>',
 "down": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>',
 "arr": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
 "x": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
 "pdf": '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M12 11v6M9.5 14.5L12 17l2.5-2.5"/></svg>',
}

SECTIONS = [  # id, number, title, short description
 ("glance", "00", "At a glance", "Key figures and why it stacks up"),
 ("opportunity", "01", "The opportunity", "Why it's rare, and the essentials"),
 ("building", "02", "The building", "Design, specification and the team"),
 ("heritage", "03", "Heritage", "The name, the saddler and the scout"),
 ("location", "04", "Location", "The Underbanks, the station, the tenants"),
 ("stockport", "05", "Why Stockport", "Regeneration, transport and jobs"),
 ("data", "06", "The data", "Stockport's market in numbers"),
 ("returns", "07", "Returns", "Cash flow, cash needed and the long view"),
 ("next", "08", "Next steps", "Choose, reserve, completion"),
 ("contact", "09", "Keep in touch", "Questions and a 3D video tour"),
 ("sources", "A", "Sources", "References and important information"),
]

def build(agent_key, prefix):
    A = AGENTS[agent_key]
    P = prefix + "assets/img/"
    F = prefix + "assets/fonts/"

    def dims(name):
        with Image.open(f"{IMGDIR}/{name}.webp") as im:
            return im.size

    def img(name, alt, sizes="100vw", cls="", eager=False, zoom=False, pos=None):
        w, h = dims(name)
        has_small = os.path.exists(f"{IMGDIR}/{name}-800.webp")
        src = f"{P}{name}-800.webp" if has_small else f"{P}{name}.webp"
        srcset = f' srcset="{P}{name}-800.webp 800w, {P}{name}.webp {w}w" sizes="{sizes}"' if has_small else ""
        load = ' fetchpriority="high"' if eager else ' loading="lazy"'
        z = f' data-full="{P}{name}.webp"' if zoom else ""
        c = " ".join(x for x in [cls, "zoom" if zoom else ""] if x)
        st = f' style="object-position:{pos}"' if pos else ""
        return f'<img src="{src}"{srcset} width="{w}" height="{h}" alt="{e(alt)}"{load} decoding="async"{z}{f" class=\"{c}\"" if c else ""}{st}>'

    def fig(name, alt, cap_l="", cap_r="", sizes="100vw", cls="fig", zoom=True, ar=None, pos=None):
        style = f' style="--ar:{ar}"' if ar else ""
        cap = f'<figcaption><span>{cap_l}</span><span>{cap_r}</span></figcaption>' if (cap_l or cap_r) else ""
        return f'<figure class="{cls}"{style}>{img(name, alt, sizes, zoom=zoom, pos=pos)}{cap}</figure>'

    wa = lambda msg: f"https://wa.me/{A['wa']}?text=" + urllib.parse.quote(msg)
    WA_Q = wa(f"Hi {A['first']}, I've been looking at Charter House and have a question.")
    WA_CALL = wa(f"Hi {A['first']}, I've been looking at Charter House. Could we book a call to talk it through?")
    WA_MORE = wa(f"Hi {A['first']}, I've been looking at Charter House. Could you also show me:")
    BOOK = f'<a class="btn fill" href="{A["cal"]}" target="_blank" rel="noopener">{ICON["cal"]}Book a 3D video tour</a>'
    WAB = f'<a class="btn" href="{WA_Q}" target="_blank" rel="noopener">{ICON["wa"]}WhatsApp {A["first"]}</a>'

    def runhead(num, title):
        return f'<div class="runhead"><span><b>{num}</b> &mdash; {title}</span><span>Charter House &middot; Investment report</span></div>'

    def subhead(l, r=""):
        return f'<div class="subhead"><span>{l}</span><span>{r}</span></div>'

    def kpi(num, label, cls=""):
        return f'<div class="kpi {cls}"><span class="num">{num}</span><p>{label}</p></div>'

    # ---------------------------------------------------------------- charts
    def evidence():
        groups = [("1 bed", 900, (1100, 1250), 1300), ("2 bed", 1100, (1300, 1400), 1600)]
        mx = 2000; pc = lambda v: f"{v / mx * 100:.1f}%"
        out = []
        for lab, f, (lo, hi), c in groups:
            up = f"+{round((lo / f - 1) * 100)}&ndash;{round((hi / f - 1) * 100)}% on forecast"
            out.append(f'''<div class="evg"><p class="eyebrow">{lab}, rent per calendar month</p>
 <div class="evr"><span>St Marys Gate, forecast 2023</span><div class="evb" style="--w:{pc(f)};--end:{pc(f)}"><i></i><b>{gbp(f)}</b></div></div>
 <div class="evr"><span>St Marys Gate, achieved 2025<small>{up}</small></span><div class="evb" style="--w:{pc(lo)};--a:{pc(lo)};--b:{(hi - lo) / mx * 100:.1f}%;--end:{pc(hi)}"><i></i><em></em><b>{gbp(lo)}&ndash;{gbp(hi)[1:]}</b></div></div>
 <div class="evr"><span><strong>Charter House, forecast</strong></span><div class="evb ch" style="--w:{pc(c)};--end:{pc(c)}"><i></i><b>{gbp(c)}</b></div></div></div>''')
        return '<div class="ev">' + "".join(out) + "</div>"

    def rent_growth():
        bars, labs = [], []
        for y in range(1, 6):
            r = rent_y(y); yl = r * 12 / EX["price"] * 100
            bars.append(f'<div><b>{gbp(r)}</b><i style="--h:{r / 1600 * 100:.1f}%"></i></div>')
            labs.append(f'<span><b>Year {y}</b>{yl:.1f}% yield</span>')
        return f'<div class="rg" role="img" aria-label="Rent by year: {", ".join(gbp(rent_y(y)) for y in range(1, 6))}">{"".join(bars)}</div><div class="rgl">{"".join(labs)}</div>'

    def cap_chart():
        W, H, n = 600, 230, 20
        vals = [EX["price"]] + [value_y(y) for y in range(1, n + 1)]
        mn, mx = 150000, 560000
        X = lambda i: i / n * W
        Y = lambda v: H - (v - mn) / (mx - mn) * H
        pts = " ".join(f"{X(i):.1f},{Y(v):.1f}" for i, v in enumerate(vals))
        grid = "".join(f'<line x1="0" x2="{W}" y1="{Y(v):.1f}" y2="{Y(v):.1f}" stroke="#d5cbc4" stroke-width="1"/>' for v in (200000, 300000, 400000, 500000))
        dots = "".join(f'<circle cx="{X(i):.1f}" cy="{Y(vals[i]):.1f}" r="4.5" fill="#211f1e"/>' for i in (5, 10, 15, 20))
        labs = "".join(f'<span class="lab{" last" if i == 20 else ""}" style="left:{i / n * 100:.1f}%;top:{Y(vals[i]) / H * 100:.1f}%">{gbp(vals[i])}<small>Year {i}</small></span>' for i in (5, 10, 15, 20))
        svg = (f'<svg viewBox="0 0 {W} {H}" preserveAspectRatio="none" role="img" aria-label="Value rising from {gbp(EX["price"])} to {gbp(vals[-1])} by year 20">'
               f'{grid}<polygon points="0,{H} {pts} {W},{H}" fill="#a24e2d" opacity=".09"/>'
               f'<line x1="0" x2="{W}" y1="{Y(EX["price"]):.1f}" y2="{Y(EX["price"]):.1f}" stroke="#6c645e" stroke-dasharray="3 5"/>'
               f'<polyline points="{pts}" fill="none" stroke="#211f1e" stroke-width="2"/>{dots}'
               f'<line x1="0" x2="{W}" y1="{H}" y2="{H}" stroke="#211f1e"/></svg>')
        return (f'<div class="cap-chart">{svg}{labs}</div><div class="cap-x"><span>Completion</span><span>Purchase price {gbp(EX["price"])} (dashed)</span><span>Year 20</span></div>')

    def roi_table():
        head = "".join(f'<th class="n" scope="col">Year {r["n"]}</th>' for r in ROI)
        row = lambda lab, key, fmt, cls="": f'<tr class="{cls}"><th scope="row">{lab}</th>' + "".join(f'<td class="n">{fmt(r[key])}</td>' for r in ROI) + "</tr>"
        cash = "".join(f'<td class="n">{gbp(M["cash"])}</td>' for _ in ROI)
        return f'''<div class="tscroll roi"><table class="tbl"><caption>Overall return on investment, example one bed</caption>
<thead><tr><th scope="col">Hold period</th>{head}</tr></thead><tbody>
<tr><th scope="row">Cash deployed</th>{cash}</tr>
{row("Apartment value", "value", gbp)}
{row("Capital gain", "gain", gbp)}
{row("Net rental income, cumulative", "inc", gbp)}
{row("Total return on cash deployed", "tot", lambda v: f"{round(v)}%", "tot")}
{row("Average annual return", "avg", lambda v: f"{round(v)}%", "avg")}
</tbody></table></div>'''

    def roi_cards():
        out = []
        for r in ROI:
            out.append(f'<div><p class="eyebrow">{r["n"]}-year hold</p><span class="num">{round(r["tot"])}%</span>'
                       f'<p class="small">total return on {gbp(M["cash"])}, <b>{round(r["avg"])}% a year</b> on average</p>'
                       f'<ul><li><span>Value</span><span>{gbp(r["value"])}</span></li><li><span>Capital gain</span><span>{gbp(r["gain"])}</span></li>'
                       f'<li><span>Net rent</span><span>{gbp(r["inc"])}</span></li></ul></div>')
        return '<div class="roicards">' + "".join(out) + "</div>"

    # ---------------------------------------------------------------- data
    EMP = [("Stockport Council", "Council services", 6000, "6,000+"), ("Stockport NHS Foundation Trust", "Healthcare", 2790, "2,790+"),
           ("Lex Autolease", "Cheadle Heath", 850, "850"), ("Robinsons Brewery", "Stockport's own brewery", 830, "830"),
           ("Vitality Health", "Health insurance, 1,000 jobs added", 800, "800"), ("Together Trust", "Social care, Cheadle", 800, "800"),
           ("Nexperia", "Electronics, Hazel Grove", 780, "780"), ("Totally Local Company", "Cheadle Heath", 750, "750"),
           ("Stockport Homes", "Housing association", 720, "720"), ("The AA", "Cheadle", 650, "650")]
    emp = "".join(f'<li><span>{a}<small>{b}</small></span><i style="--w:{c / 6000 * 100:.1f}%"></i><b>{d}</b></li>' for a, b, c, d in EMP)

    SAV = [("North West", ["0.0%", "3.5%", "6.5%", "6.5%", "6.5%"], "25.0%", True),
           ("UK", ["&minus;2.0%", "2.5%", "5.0%", "6.0%", "6.0%"], "18.5%", False),
           ("London", ["&minus;4.0%", "1.0%", "3.5%", "5.0%", "5.0%"], "10.6%", False)]
    sav_rows = "".join(f'<tr class="{"hl" if hl else ""}"><th scope="row">{r}</th>' + "".join(f'<td class="n">{v}</td>' for v in vals) + f'<td class="n"><b>{t}</b></td></tr>' for r, vals, t, hl in SAV)
    tot5 = "".join(f'<div class="{"hl" if hl else ""}"><span>{r}</span><i style="--w:{float(t[:-1]) / 25 * 100:.0f}%"></i><b>{t}</b></div>' for r, vals, t, hl in SAV)

    PRESS = [("Stockport, Greater Manchester, named best place to live in the northwest of England", "The Sunday Times, Best Places to Live 2024"),
             ("Stockport offers Britain's towns a blueprint for revival", "Financial Times"),
             ("How Britain's latest foodie destination emerged from Pizza Hut and retail parks", "The Telegraph"),
             ("This is Stockport's Northern Quarter: people are moving here from Manchester", "Manchester Evening News"),
             ("State-of-the-art Stockport Interchange wins prestigious national transport award", "Transport for Greater Manchester"),
             ("Best places in UK to live in 2026 revealed", "The Independent, Stockport on the list")]
    press = "".join(f"<li><q>{q}</q><cite>{c}</cite></li>" for q, c in PRESS)

    REFS = [("Stockport 8 Consultation", "Stockport MDC and European Cities Fund, 2024"), ("Stockport Business Framework 2023–2028", "Stockport MDC, 2023"),
            ("Central Stockport Infrastructure Delivery Plan", "Stockport Council, 2020"), ("Stockport Station Growth Prospectus", "Stockport Council and Stockport MDC, 2023"),
            ("Stockport Strategic Business Plan 2024–2029", "Stockport MDC, 2024"), ("Stockport Strategic Regeneration Framework", "Stockport Council, 2019"),
            ("Stockport Town Centre Living: Development Framework", "CBRE, 2018"), ("The Value of a Tram Station on Local House Prices", "City University of Birmingham, 2019"),
            ("Unstoppable Stockport", "Stockport MDC, spring 2025"), ("Stockport Exchange: Commercial District Brochure", "Muse and CBRE, 2020"),
            ("Stockport, Change Here", "Stockport Council, 2023"), ("Five-year house price forecast, revised", "Savills Research, June 2026"),
            ("House price index, Stockport", "Office for National Statistics, to April 2026")]
    refs = "".join(f"<li>{a}<span>{b}</span></li>" for a, b in REFS)

    toc = "".join(f'<li><a href="#{i}"><i>{n}</i><b>{t}</b><span>{d}</span></a></li>' for i, n, t, d in SECTIONS)
    toc_compact = "".join(f'<li><a href="#{i}"><i>{n}</i><b>{t}</b><span>{d}</span></a></li>' for i, n, t, d in SECTIONS[1:])
    rail = "".join(f'<li><a href="#{i}"><i>{n}</i>{t}</a></li>' for i, n, t, d in SECTIONS)

    css = open(f"{HERE}/styles.css").read().replace("{{F}}", F)
    js = open(f"{HERE}/app.js").read()

    proc = [("done", "&#10003;", "", "Appraise", "You've reviewed the development and the numbers.", "Our research and reporting help you decide whether Charter House suits your investment goals."),
            ("here", "2", "You are here", "Choose your apartment", f"On a 3D video tour with {A['first']}.", "A 30-minute Teams call: we go round the 3D model of the finished building, look at the plots still available and you choose the one that suits you."),
            ("", "3", "Next", "Reserve", "£3,000 takes it off the market.", "£2,500 counts towards your 20% deposit and £500 is BRIK Studios' admin fee, part of which goes to charity. Pay by card or bank transfer."),
            ("", "4", "", "Legal process", "Jawaad and our panel solicitor guide you through.", "AML checks, then an introduction to our panel solicitor and, if you need one, our mortgage broker."),
            ("", "5", "", "Exchange", "20% deposit, within 28 days.", "Contracts are exchanged and the apartment is legally yours to complete on."),
            ("", "6", "", "Completion", "Early 2028.", "Pay the balance, collect your keys. We can help with mortgages, furniture and letting.")]
    proc_html = "".join(f'<li class="{c}"><span class="dot">{d}</span><span class="tag">{t}</span><h3>{h}</h3><b>{b}</b><p>{p}</p></li>' for c, d, t, h, b, p in proc)

    contact_facts = "".join(f"<li><b>{a}</b><span>{b}</span></li>" for a, b in A["contact"])

    # ---------------------------------------------------------------- page
    page = f'''<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<title>Charter House &middot; Investment report &middot; BRIK Studios</title>
<meta name="description" content="Charter House, Stockport: BRIK Studios investment report. Private pre-launch.">
<meta name="theme-color" content="#efe7e1">
<meta property="og:title" content="Charter House &middot; Investment report">
<meta property="og:description" content="A very limited number of buy-to-let apartments in the Underbanks, Stockport. Private pre-launch.">
<link rel="icon" href="{P}logo6.webp">
<link rel="preload" href="{F}bodoni-moda-opsz.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="{F}figtree-300.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" as="image" href="{P}front-800.webp" imagesrcset="{P}front-800.webp 800w, {P}front.webp 1600w" imagesizes="(min-width:861px) 52vw, 100vw">
<style>{css}</style>
</head>
<body>
<a class="sr" href="#glance">Skip to the report</a>

<header class="bar"><div class="in">
  <a class="brand" href="#cover" aria-label="BRIK Studios, back to the top"><img src="{P}logo.webp" width="400" height="149" alt="BRIK Studios"><span class="doc"><b>Charter House</b> &middot; Investment report</span></a>
  <span class="now" aria-live="polite"></span>
  <div class="acts">
    <a class="btn sm ico hide-m" href="{WA_Q}" target="_blank" rel="noopener" aria-label="WhatsApp {A['first']}">{ICON["wa"]}</a>
    <a class="btn sm fill hide-m" href="{A['cal']}" target="_blank" rel="noopener">Book a 3D video tour</a>
    <button class="btn sm" data-contents aria-haspopup="dialog">{ICON["menu"]}Contents</button>
  </div>
  <i class="prog" aria-hidden="true"></i>
</div></header>

<nav class="rail" aria-label="Report sections"><ol>{rail}</ol></nav>

<main>
<!-- ============================== COVER -->
<section class="cover" id="cover" aria-label="Cover">
  <div class="ct">
    <div class="runhead"><span>Investment report</span><span>{REPORT_DATE}</span></div>
    <img class="mark" src="{P}logo3.webp" width="1100" height="719" alt="Charter House, 50&ndash;72 Churchgate, Stockport">
    <span class="pl"><i></i>Private pre-launch</span>
    <h1 class="h1" style="margin-top:18px">A very limited number of buy&#8209;to&#8209;let apartments <em>in the Underbanks.</em></h1>
    <p class="stand">Secure one of a very limited number of buy-to-let apartments in the Underbanks, Stockport's historic conservation area, where strict planning means new homes almost never get built. You're seeing it at private pre-launch, before it goes public.</p>
    <div class="row ctas"><a class="btn fill" href="#glance">Read the report{ICON["down"]}</a><a class="tlink" href="#returns">Go straight to the numbers{ICON["arr"]}</a></div>
    <div class="by">{img(A["photo"], A["name"], "46px")}<div><b>Prepared for you by {A["name"]}</b>{A["role"]}, BRIK Studios<br><a href="tel:{A['tel']}">{A["phone"]}</a> &nbsp;&middot;&nbsp; <a href="mailto:{A['email']}">{A["email"]}</a></div></div>
  </div>
  <figure class="ci">{img("front", "Charter House on the corner of Harvey Street and Churchgate, CGI", "(min-width:861px) 52vw, 100vw", eager=True)}<figcaption><span>Charter House, Churchgate</span><span>CGI</span></figcaption></figure>
</section>

<!-- ============================== AT A GLANCE -->
<section class="sec" id="glance" data-title="00 &middot; At a glance"><div class="wrap">
  {runhead("00", "At a glance")}
  <h2 class="h2">The investment <em>at a glance.</em></h2>
  <p class="stand">The headline numbers on the example one bed, worked through in full in section 07.</p>
  <div class="kpis mt3">
    {kpi(gbp(EX["price"]), "Example price, one bed apartment")}
    {kpi(f'{gbp(EX["rent"])}<small>pcm</small>', "Rent forecast on completion")}
    {kpi(f'{M["yld"]:.1f}%', f'Gross yield on {gbp(EX["rent"])} pcm')}
    {kpi(f'{gbp(M["net"])}<small>pcm</small>', "Net cash flow a month, after the mortgage, service charge and management", "hl")}
    {kpi(gbp(M["cash"]), "Total cash needed, with a 75% buy-to-let mortgage")}
    {kpi(f'{round(ROI[0]["avg"])}%', f'Average annual return on cash deployed, 5-year hold ({round(ROI[0]["tot"])}% in total)')}
  </div>
  <div class="g2 l mt4 ai-s">
    <div>
      <p class="eyebrow">Why it stacks up</p>
      <ol class="takeaways">
        <li><div><b>Supply is capped.</b><span>The Underbanks is a conservation area full of listed buildings, and nothing over four storeys can be built, so new homes almost never get built here.</span></div></li>
        <li><div><b>Proven next door.</b><span>Hall &amp; Co's St Marys Gate, same developer and same architect, sold out off-plan and let at 22&ndash;39% above its forecast rents.</span></div></li>
        <li><div><b>A town on the rise.</b><span>The UK's largest town-centre regeneration, £1bn today and £2bn by 2040, with Manchester eight minutes away by train.</span></div></li>
        <li><div><b>Completely hands off.</b><span>999-year lease, nil ground rent and a 10-year warranty. We find the tenant and manage it for 10% of the rent, already in every number here.</span></div></li>
      </ol>
    </div>
    <div>
      <p class="eyebrow">Contents</p>
      <ol class="toc">{"".join(f'<li><a href="#{i}"><i>{n}</i><b>{t}</b><span>{d}</span></a></li>' for i, n, t, d in SECTIONS[1:])}</ol>
    </div>
  </div>
</div></section>

<!-- ============================== 01 OPPORTUNITY -->
<section class="sec" id="opportunity" data-title="01 &middot; The opportunity"><div class="wrap">
  {runhead("01", "The opportunity")}
  <div class="g2 ai-s">
    <div>
      <h2 class="h2">Almost nothing new gets <em>built here.</em></h2>
      <p class="stand">The Underbanks is a conservation area full of listed buildings, and nothing over four storeys can be built. That puts a hard cap on new homes, in the part of Stockport everyone wants to live.</p>
      <p>Charter House is launching exclusively through BRIK Studios, and you're seeing it at private pre-launch, before it goes public.</p>
    </div>
    <table class="tbl ess"><caption>The essentials</caption><tbody>
      <tr><th scope="row">Lease</th><td>999 years</td></tr>
      <tr><th scope="row">Ground rent</th><td>Nil</td></tr>
      <tr><th scope="row">Service charge</th><td>Est. £2.50 per sq ft per year, about £86 a month for an average 1 bed and £137 for an average 2 bed</td></tr>
      <tr><th scope="row">Build warranty</th><td>10 years</td></tr>
      <tr><th scope="row">Reservation</th><td>£3,000</td></tr>
      <tr><th scope="row">Exchange</th><td>20% within 28 days</td></tr>
      <tr><th scope="row">Completion</th><td>Early 2028</td></tr>
      <tr><th scope="row">Extras</th><td>A secure bike store for every apartment</td></tr>
      <tr><th scope="row">Developer</th><td>Hall &amp; Co</td></tr>
      <tr><th scope="row">Architect</th><td>Ollier Smurthwaite</td></tr>
    </tbody></table>
  </div>
  <div class="bleed">{fig("rear", "Charter House, the corner, CGI", "Charter House, the corner of Harvey Street and Churchgate", "CGI", "(min-width:1240px) 1100px, 100vw", ar="1800/921")}</div>

  <div class="sub g2 r ai-c">
    <div>
      {subhead("Exclusive to BRIK Studios")}
      <h3 class="h3">We've gone deep on <em>one neighbourhood.</em></h3>
      <p class="mt2">Charter House is launching exclusively through BRIK Studios. Our relationship with Hall &amp; Co goes back several years.</p>
      <p>We don't dabble across the North West chasing whichever site is loudest. We've learned the Underbanks street by street, and built the network of developers, investors and tenants that comes with that focus. When clients want to know what's actually happening in the Underbanks, this is where they come.</p>
    </div>
    {fig("under", "The Underbanks, a minute away", "The Underbanks, a minute away", "", "(min-width:861px) 40vw, 100vw", cls="fig crop", ar="4/5")}
  </div>

  <div class="sub">
    {subhead(A["own_eyebrow"], "Same developer &middot; same architect")}
    <div class="own">
      {img(A["photo"], A["name"] + ", " + A["role"], "(min-width:861px) 30vw, 100vw")}
      <div>
        <h3 class="h3">{A["own_h"]}</h3>
        <p class="lead mt1">{A["own_lead"]}</p>
        <ul class="pts">
          <li><b>Same developer</b><span>Hall &amp; Co: family-run since 1998, with 13 completed residential schemes.</span></li>
          <li><b>Same architect</b><span>Ollier Smurthwaite, chosen by Stockport Council to lead the Underbanks' regeneration.</span></li>
          <li><b>Supply is capped</b><span>Nothing over four storeys can be built in the conservation area, so new homes here stay rare.</span></li>
        </ul>
        <p class="cred"><b>{A["name"]}</b><span>{A["role"]}</span>{A["own_cred"]}</p>
      </div>
    </div>
  </div>
</div></section>

<!-- ============================== 02 BUILDING -->
<section class="sec" id="building" data-title="02 &middot; The building"><div class="wrap">
  {runhead("02", "The building")}
  <h2 class="h2">Built to outlast trends, <em>not follow them.</em></h2>
  <p class="stand">Conservation-led design, period brick detailing and a planted residents' courtyard.</p>

  <div class="sub g2 r ai-c" style="margin-top:56px">
    <div>
      <p class="eyebrow">The BRIK-down</p>
      <blockquote class="quote">&ldquo;With the previous Hall &amp; Co scheme next door, St Marys Gate, selling out and fully tenanting at rents 25 to 40% above forecast, the case for the Underbanks is no longer theoretical. Charter House is the chance to act on it.&rdquo;</blockquote>
      <p class="mt2">&ldquo;What we love about this site is how unapologetically it leans into the heritage. Conservation-led design, period brick detailing, the kind of craftsmanship that gets harder to find every year. Charter House is being built to outlast trends, not follow them.&rdquo;</p>
      <div class="attr">{img("james", "James Dempsey", "54px")}<div><b>James Dempsey</b>CEO, BRIK Studios</div></div>
    </div>
    {fig("side", "The gable end, CGI", "The gable end", "CGI", "(min-width:861px) 40vw, 100vw", cls="fig crop", ar="4/5")}
  </div>

  <div class="sub">
    {subhead("The specification", "Ready to let")}
    <div class="g2">
      <div class="room">{fig("garden", "The residents' courtyard, CGI", "", "", "(min-width:861px) 45vw, 100vw", cls="fig crop", ar="3/2")}<h3>The courtyard</h3><ul class="ticks"><li>A planted residents' courtyard at the heart of the building</li><li>Front doors on gallery walkways overlooking it</li><li>A secure bike store for every apartment</li></ul></div>
      <div class="room">{fig("kitchen", "Kitchen and living, CGI", "", "", "(min-width:861px) 45vw, 100vw", cls="fig crop", ar="3/2")}<h3>Kitchen and living</h3><ul class="ticks"><li>Fully fitted kitchen with integrated dishwasher</li><li>Built-in electric oven, ceramic hob and extractor fan</li><li>Marble-effect quartz worktop and tiled splashback</li><li>LED lighting behind the cabinets</li><li>Premium LVT flooring</li><li>Washer dryer plinth, plumbed and wired, in the service cupboard</li></ul></div>
      <div class="room">{fig("bed", "Bedroom, CGI", "", "", "(min-width:861px) 45vw, 100vw", cls="fig crop", ar="3/2")}<h3>Bedroom</h3><ul class="ticks"><li>LVT flooring</li><li>Matt sockets and fixtures</li><li>Wooden doors</li><li>Architraves and skirting in dark heritage colours</li></ul></div>
      <div class="room">{fig("bath", "Bathroom, CGI", "", "", "(min-width:861px) 45vw, 100vw", cls="fig crop", ar="3/2", pos="50% 60%")}<h3>Bathroom</h3><ul class="ticks"><li>Fully fitted, with a glass shower screen</li><li>Matt black fixtures and fittings</li><li>Wall-hung toilet and basin</li><li>Ceramic and porcelain tiles</li><li>Mirrored cabinets, mounted and backlit</li></ul></div>
    </div>
    <p class="fine mt2">Images are computer-generated and indicative.</p>
  </div>

  <div class="sub team">
    {subhead("The team", "Developer &middot; architect")}
    <div class="g2">
      <div>
        <img class="logo" src="{P}hallco.webp" width="500" height="124" alt="Hall &amp; Co Property" loading="lazy">
        <p class="eyebrow">Meet the developer</p>
        <h3 class="h3">Hall &amp; Co</h3>
        <p class="mt1">Founded in 1998 by Roy and Jo Hall, starting with a coastal building in Anglesey. Now led by the next generation of the family from Alderley Edge, with a reputation for thoughtful restoration and long-term partnerships with councils.</p>
        <ul class="facts"><li><b>25+</b><span>years, and 13 completed residential schemes across the North West, Cheshire and North Wales</span></li><li><b>50</b><span>apartments at St Marys Gate next door, completed 2025, sold out off-plan and fully let</span></li></ul>
        <div class="g2 mt2" style="gap:12px">{fig("stmarys", "St Marys Gate, Stockport", "St Marys Gate", "Completed", "(min-width:861px) 22vw, 50vw", cls="fig crop", ar="4/3")}{fig("arch3", "A Hall &amp; Co scheme", "", "", "(min-width:861px) 22vw, 50vw", cls="fig crop", ar="4/3")}</div>
      </div>
      <div>
        <img class="logo" src="{P}riba.webp" width="500" height="228" alt="RIBA Chartered Practice" loading="lazy">
        <p class="eyebrow">Meet the architect</p>
        <h3 class="h3">Ollier Smurthwaite</h3>
        <p class="mt1">The multi-award-winning practice Stockport Council appointed to bring its vision for the Underbanks to life, where attention to detail and retaining heritage are core principles.</p>
        <ul class="facts"><li><b>18</b><span>years in business, and 24 awards</span></li><li><b>£200m+</b><span>of mixed-use projects</span></li><li><b>Chosen</b><span>to lead the regeneration of the Underbanks</span></li></ul>
        <div class="g2 mt2" style="gap:12px">{fig("arch1", "Ollier Smurthwaite project", "", "", "(min-width:861px) 22vw, 50vw", cls="fig crop", ar="4/3")}{fig("arch2", "Ollier Smurthwaite project, interior", "", "", "(min-width:861px) 22vw, 50vw", cls="fig crop", ar="4/3")}</div>
      </div>
    </div>
  </div>
</div></section>

<!-- ============================== 03 HERITAGE -->
<section class="sec" id="heritage" data-title="03 &middot; Heritage"><div class="wrap">
  {runhead("03", "Heritage")}
  <div class="g2 r ai-e">
    <div>
      <h2 class="h2">The building's <em>heritage.</em></h2>
      <p class="stand">Charter House is named for its neighbour, Stockport's Market Hall, right next door. Harvey Street is named after William Harvey, a prize-medal saddler, harness maker and leather goods merchant.</p>
    </div>
    <div>
      <p>Harvey's shop on Heaton Lane sold brief bags, Gladstone bags, travelling rugs and driving aprons. As RV's Saddlery Stores, it also kitted out Stockport's Boy Scouts with bell tents, axes and canteens.</p>
      <p>Charter House borrows its identity from those adverts. The scout on the keyring, tote and cap comes straight from them.</p>
    </div>
  </div>
  <div class="bleed">{fig("h_shop", "W. Harvey, prize medal saddler, archive photograph", "W. Harvey, prize medal saddler", "Archive", "(min-width:1240px) 1100px, 100vw", cls="fig crop", ar="1182/700")}</div>
  <div class="archive mt2">
    {fig("h_town", "The Townmakers, No. 39: Mr William Harvey", "The Townmakers, No. 39", "", "(min-width:861px) 20vw, 50vw")}
    {fig("h_advert", "W. Harvey, saddler, 102 Heaton Lane", "102 Heaton Lane", "", "(min-width:861px) 20vw, 50vw")}
    {fig("h_scout", "R U A Scout? RV can fit you out", "R U A Scout?", "", "(min-width:861px) 20vw, 50vw")}
    {fig("h_camp", "RV's Saddlery Stores, Boy Scouts' camp equipment", "RV's Saddlery Stores", "", "(min-width:861px) 20vw, 50vw")}
    {fig("h_hq", "Official suppliers to Boy Scouts' Headquarters", "Boy Scouts' Headquarters", "", "(min-width:861px) 20vw, 50vw")}
  </div>
  <div class="sub">
    {subhead("The identity", "The scout, from Harvey's adverts")}
    <div class="merch">
      {fig("idboard", "The Charter House identity", "", "", "(min-width:861px) 40vw, 100vw")}
      {fig("tote", "The Charter House tote", "The tote", "", "20vw")}
      {fig("cap", "The Charter House cap", "The cap", "", "20vw")}
      {fig("keyring", "The Charter House keyring", "The keyring", "", "20vw")}
      {fig("mug", "The Charter House camp mug", "The camp mug", "", "20vw")}
    </div>
  </div>
</div></section>

<!-- ============================== 04 LOCATION -->
<section class="sec" id="location" data-title="04 &middot; Location"><div class="wrap">
  {runhead("04", "Location")}
  <h2 class="h2">A minute from the Underbanks, <em>ten from the station.</em></h2>
  <p class="stand">On the corner of Harvey Street and Churchgate, Stockport SK1.</p>
  <figure class="fig map mt3">{img("map", "Map of Stockport town centre showing Charter House", "(min-width:1240px) 1100px, 100vw", zoom=True)}<span class="pin"><i></i><span>Charter House</span></span><figcaption><span>Charter House, 50&ndash;72 Churchgate, SK1 1YG</span><span>Tap to enlarge</span></figcaption></figure>
  <div class="g2 mt3 ai-s">
    <div>
      <p class="eyebrow">On foot</p>
      <ul class="walk">
        <li>The Underbanks<b>under 1 min</b><i style="--w:4%"></i></li>
        <li>BRIK Studios HQ, The Print House<b>2 min</b><i style="--w:12%"></i></li>
        <li>Merseyway Shopping Centre<b>3 min</b><i style="--w:19%"></i></li>
        <li>Asda Superstore<b>4 min</b><i style="--w:25%"></i></li>
        <li>St Joseph's Church and Primary School<b>4 min</b><i style="--w:25%"></i></li>
        <li>Bus interchange and park<b>10 min</b><i style="--w:62%"></i></li>
        <li>Stockport station<b>10 min</b><i style="--w:62%"></i></li>
      </ul>
    </div>
    <div>
      <p class="eyebrow">Connections</p>
      <div class="kpis k2">
        {kpi("8 min", "To Manchester by train, 11 trains an hour")}
        {kpi("1 hr 58", "To London, 3 trains an hour")}
        {kpi("2025", "Stockport Metrolink extension announced, June 2025")}
        {kpi("£550m", "Stockport station redevelopment")}
      </div>
    </div>
  </div>

  <div class="sub">
    {subhead("Why the Underbanks", "Conservation area since 1974")}
    <div class="g2 r ai-s">
      <div><h3 class="h3">Huge demand, <em>tiny supply.</em></h3>
        <p class="mt2">A conservation area since 1974, recently awarded a £1.8m National Lottery heritage grant, and fast becoming the place to be, full of independents, restaurants, cafés and bars.</p>
        <p>The real win is supply. Listed buildings and strict planning mean nothing over four storeys can be built in the conservation area, so future supply has a hard cap: a tiny fraction of places like Salford Quays.</p></div>
      {fig("skunderbanks", "The Underbanks", "The Underbanks", "BRIK photography", "(min-width:861px) 40vw, 100vw", cls="fig crop", ar="4/3")}
    </div>
    <div class="g2 mt2" style="gap:14px">{fig("market", "Stockport Market", "Stockport Market", "", "(min-width:861px) 45vw, 100vw", cls="fig crop", ar="3/2")}{fig("resto", "An Underbanks restaurant", "An Underbanks restaurant", "", "(min-width:861px) 45vw, 100vw", cls="fig crop", ar="3/2")}</div>
  </div>

  <div class="sub">
    {subhead("Current tenant profile")}
    <div class="g2 l ai-c">
      {fig("tenant", "Underbanks street party", "Underbanks street party", "", "(min-width:861px) 40vw, 100vw", cls="fig crop", ar="4/5")}
      <div><h3 class="h3">Young <em>professionals.</em></h3>
        <ul class="ticks mt2"><li>SK1 has the lowest average age in Stockport, at 36.8</li><li>It's the only Stockport postcode where the average age has fallen over the last 20 years</li><li>Live events and the link to Manchester city centre draw a younger crowd</li><li>Typical tenancy: 12 months</li><li>Demand has proven extremely high</li></ul></div>
    </div>
  </div>

  <div class="sub">
    {subhead("BRIK in the Underbanks", "What we've built on these streets")}
    <div class="g4 cards brands">
      <div class="card">{fig("b_incu", "INCU", "", "", "(min-width:1100px) 25vw, 50vw", cls="fig crop", ar="4/3", zoom=False)}<div class="cb"><img class="blogo" src="{P}incu.webp" width="500" height="182" alt="INCU" loading="lazy"><p>Short for incubator: a commercial lettings arm on the Underbanks, giving independent brands space to test concepts in store.</p></div></div>
      <div class="card">{fig("b_miru", "Miru Mill", "", "", "(min-width:1100px) 25vw, 50vw", cls="fig crop", ar="4/3", zoom=False)}<div class="cb"><img class="blogo" src="{P}miru.webp" width="500" height="389" alt="Miru Mill" loading="lazy"><p>A creative space in the town centre for workshops, studio space, event hire and dinner parties.</p></div></div>
      <div class="card">{fig("b_convene", "Convene", "", "", "(min-width:1100px) 25vw, 50vw", cls="fig crop", ar="4/3", zoom=False)}<div class="cb"><img class="blogo" src="{P}convene.webp" width="500" height="90" alt="Convene" loading="lazy" style="height:22px;margin:6px 0 16px"><p>A neighbourhood café focused on seasonal cooking.</p></div></div>
      <div class="card">{fig("b_dilly", "Dilly Deli", "", "", "(min-width:1100px) 25vw, 50vw", cls="fig crop", ar="4/3", zoom=False)}<div class="cb"><img class="blogo" src="{P}dilly.webp" width="500" height="307" alt="Dilly Deli" loading="lazy"><p>Your neighbourhood favourite on Little Underbank.</p></div></div>
    </div>
  </div>
</div></section>

<!-- ============================== 05 STOCKPORT -->
<section class="sec" id="stockport" data-title="05 &middot; Why Stockport"><div class="wrap">
  {runhead("05", "Why Stockport")}
  <h2 class="h2">The UK's largest town-centre <em>regeneration.</em></h2>
  <p class="stand">The commuter hub of choice for young professionals priced out of central Manchester.</p>
  <div class="bigstat mt3">
    <span class="num">£2bn</span>
    <div>
      <div class="tracklab"><span>£1bn programme today</span><span>£2bn by 2040</span></div>
      <div class="track" aria-hidden="true"><i></i><em></em></div>
      <p class="mt1">Stockport's £1bn town-centre regeneration is forecast to reach £2bn by 2040, with its Mayoral Development Corporation now covering the whole town centre, a UK first.</p>
      <p class="src">Source: Stockport MDC and Stockport Council, 2025.</p>
    </div>
  </div>

  <div class="sub">
    {subhead("The North West's new transport hub")}
    <div class="g3 cards">
      <div class="card">{fig("t_station", "Stockport station masterplan", "", "", "(min-width:861px) 33vw, 100vw", cls="fig crop", ar="16/10")}<div class="cb"><span class="num">£550m</span><h3>Stockport train station</h3><p>Redevelopment linking into the interchange, Stockport Exchange and the new Metrolink. Manchester in 8 minutes, 11 times an hour; London in 1 hr 58 min, 3 times an hour.</p></div></div>
      <div class="card">{fig("t_inter", "Stockport Interchange", "", "", "(min-width:861px) 33vw, 100vw", cls="fig crop", ar="16/10")}<div class="cb"><span class="num">£160m</span><h3>New transport interchange</h3><p>Completed March 2024: 164 departures an hour across Greater Manchester. Winner, Project of the Year, National Transport Awards 2024.</p></div></div>
      <div class="card">{fig("t_tram", "Metrolink tram", "", "", "(min-width:861px) 33vw, 100vw", cls="fig crop", ar="16/10")}<div class="cb"><span class="num">£2.5bn</span><h3>Stockport Metrolink</h3><p>Announced by Andy Burnham in June 2025: an extension from the East Didsbury line into the new station and interchange.</p></div></div>
    </div>
  </div>

  <div class="sub">
    {subhead("Retail, office and leisure")}
    <div class="g4 cards">
      <div class="card">{fig("r_sk8", "Stockport 8", "", "", "(min-width:1100px) 25vw, 50vw", cls="fig crop", ar="16/10")}<div class="cb"><span class="num">£250m</span><h3>Stockport 8</h3><p>Pension-fund-led: 1,300 homes, started late 2024, with commercial space, green space and a park.</p></div></div>
      <div class="card">{fig("r_exch", "Stockport Exchange", "", "", "(min-width:1100px) 25vw, 50vw", cls="fig crop", ar="16/10")}<div class="cb"><span class="num">£145m</span><h3>Stockport Exchange</h3><p>The North West's most accessible business hub: 375,000 sq ft of Grade A offices and a 115-bed hotel.</p></div></div>
      <div class="card">{fig("r_county", "Stockport County", "", "", "(min-width:1100px) 25vw, 50vw", cls="fig crop", ar="16/10")}<div class="cb"><span class="num">League One</span><h3>Stockport County</h3><p>Back-to-back promotions, sold-out season tickets and wealthy owners.</p></div></div>
      <div class="card">{fig("r_merse", "Merseyway", "", "", "(min-width:1100px) 25vw, 50vw", cls="fig crop", ar="16/10")}<div class="cb"><span class="num">£30m</span><h3>Merseyway</h3><p>Bought by Stockport Council in 2016, with public investment now under way.</p></div></div>
    </div>
  </div>

  <div class="sub">
    {subhead("In the press")}
    <ul class="press">{press}</ul>
  </div>

  <div class="sub">
    {subhead("Employment in Stockport", "Tenants on the doorstep")}
    <div class="g2 l ai-s">
      <div><h3 class="h3">Big employers, <em>a short commute away.</em></h3><p class="mt2 muted">Approximate headcount at Stockport's ten largest employers.</p></div>
      <ul class="hbars" aria-label="Employees by employer">{emp}</ul>
    </div>
  </div>

  <div class="sub">
    {subhead("Stockport, through our lens", "Our own photography")}
    <div class="strip">
      {fig("skbridge", "Underbank bridge", "Underbank bridge", "", "280px")}
      {fig("skmarket", "Stockport Market", "Stockport Market", "", "280px")}
      {fig("skviaduct", "The viaduct", "The viaduct", "", "280px")}
      {fig("skhat", "Hat Works", "Hat Works", "", "280px")}
      {fig("skarch", "Under the arches", "Under the arches", "", "280px")}
      {fig("skroofs", "Old Town rooftops", "Old Town rooftops", "", "280px")}
      {fig("skpyramid", "The Pyramid", "The Pyramid", "", "280px")}
    </div>
  </div>
</div></section>

<!-- ============================== 06 DATA -->
<section class="sec" id="data" data-title="06 &middot; The data"><div class="wrap">
  {runhead("06", "The data")}
  <h2 class="h2">Stockport's property market, <em>in numbers.</em></h2>
  <p class="stand">The underlying numbers on Stockport's property market.</p>
  <div class="g4 cards datacards mt3">
    <div class="card">{fig("d_sell", "Average time to sell by area", "", "", "(min-width:1100px) 25vw, 50vw", cls="fig crop", ar="4/3")}<div class="cb"><p class="eyebrow">Time to sell</p><span class="num">22 days</span><p>Stockport has the second-fastest average time to sell in the country, per 2025 data reported by The Telegraph.</p></div></div>
    <div class="card">{fig("d_price", "Average price by Stockport district", "", "", "(min-width:1100px) 25vw, 50vw", cls="fig crop", ar="4/3")}<div class="cb"><p class="eyebrow">Upside potential</p><span class="num">Under £200k</span><p>SK1 has the lowest average value of any Stockport district, 2.5x lower than SK9 at over £500,000.</p></div></div>
    <div class="card">{fig("d_supply", "Transaction volumes by postcode", "", "", "(min-width:1100px) 25vw, 50vw", cls="fig crop", ar="4/3")}<div class="cb"><p class="eyebrow">Tiny supply</p><span class="num">48 sales</span><p>Transaction volumes in the town centre are a fraction of the surrounding postcodes, which helps protect values.</p></div></div>
    <div class="card">{fig("d_new", "New-build share of sales", "", "", "(min-width:1100px) 25vw, 50vw", cls="fig crop", ar="4/3")}<div class="cb"><p class="eyebrow">No new builds</p><span class="num">Near zero</span><p>New-build sales are a tiny share of transactions: there's been little to no new residential development.</p></div></div>
  </div>

  <div class="sub">
    {subhead("Young professional tenant demographic")}
    <div class="g3 cards datacards">
      <div class="card">{fig("d_head", "Headcount change by area", "", "", "(min-width:861px) 33vw, 100vw", cls="fig crop", ar="4/3")}<div class="cb"><p class="eyebrow">Influx of demand</p><span class="num">+31.7%</span><p>SK1 had by far the largest increase in headcount of any Stockport area over 20 years.</p></div></div>
      <div class="card">{fig("d_age", "Change in average age by area", "", "", "(min-width:861px) 33vw, 100vw", cls="fig crop", ar="4/3")}<div class="cb"><p class="eyebrow">Specifically young people</p><span class="num">&minus;2.7 years</span><p>The only postcode where the average age fell, despite a nationally ageing population.</p></div></div>
      <div class="card">{fig("d_avg", "Average age by area", "", "", "(min-width:861px) 33vw, 100vw", cls="fig crop", ar="4/3")}<div class="cb"><p class="eyebrow">A young professional base</p><span class="num">36.8</span><p>The lowest average age in the area, as young professionals move out from Manchester.</p></div></div>
    </div>
  </div>

  <div class="sub">
    {subhead("The growth of Stockport", "Average prices")}
    <div class="g2 ai-c">
      <div>
        <div class="kpis k2">{kpi("+4.9%", "Average prices, 12 months to April 2026")}{kpi("+17%", "Average prices, last five years")}</div>
        <p class="mt2">Short-term momentum and long-term stability, ideal for both capital growth and rental yield.</p>
        <p class="src">Source: Office for National Statistics, house price index.</p>
      </div>
      {fig("d_graph", "Average price by property type, Stockport", "Average price by property type, Stockport", "ONS", "(min-width:861px) 45vw, 100vw")}
    </div>
  </div>

  <div class="sub fc">
    {subhead("Future capital growth", "Savills five-year forecast")}
    <div class="g2 r ai-s">
      <div>
        <h3 class="h3">The North West is forecast to <em>lead the UK.</em></h3>
        <p class="mt2">After Manchester's rise, renters and homeowners are being priced out, and the North West is primed for commuter-hub growth, just as Greater London saw.</p>
        <div class="tscroll mt2"><table class="tbl"><caption>House price growth forecast, mainstream market</caption>
          <thead><tr><th scope="col">Region</th><th class="n" scope="col">2026</th><th class="n" scope="col">2027</th><th class="n" scope="col">2028</th><th class="n" scope="col">2029</th><th class="n" scope="col">2030</th><th class="n" scope="col">5 yrs</th></tr></thead>
          <tbody>{sav_rows}</tbody></table></div>
        <p class="src">Source: Savills Research, five-year forecast revised June 2026. Forecasts are not a reliable indicator of future performance.</p>
      </div>
      <div><p class="eyebrow">Five years to 2030</p><div class="tot5">{tot5}</div></div>
    </div>
  </div>
</div></section>

<!-- ============================== 07 RETURNS -->
<section class="sec" id="returns" data-title="07 &middot; Returns"><div class="wrap">
  {runhead("07", "Returns")}
  <h2 class="h2">The numbers, <em>worked through.</em></h2>
  <p class="stand">Worked through on the example one bed at {gbp(EX["price"])}, with a 75% buy-to-let mortgage.</p>
  <div class="kpis k4 mt3">
    {kpi(f'{gbp(EX["rent"])}<small>pcm</small>', "Rent forecast on completion")}
    {kpi(f'{M["yld"]:.1f}%', "Gross yield")}
    {kpi(f'{gbp(M["net"])}<small>pcm</small>', "Net monthly cash flow", "hl")}
    {kpi(gbp(M["net"] * 12), "Net per year")}
  </div>
  <div class="g2 mt4 ai-s">
    <table class="tbl"><caption>Monthly cash flow</caption><tbody>
      <tr><th scope="row">Rent</th><td class="n">{gbp(EX["rent"])}</td></tr>
      <tr><th scope="row">Mortgage, 75% at 4% interest only (5-year fix)</th><td class="n">&minus;{gbp2(M["mort"])}</td></tr>
      <tr><th scope="row">Service charge, est.</th><td class="n">&minus;{gbp(EX["sc"])}</td></tr>
      <tr><th scope="row">Ground rent</th><td class="n">£0</td></tr>
      <tr><th scope="row">Letting management, 10%</th><td class="n">&minus;{gbp(M["fee"])}</td></tr>
      <tr class="tot hl"><th scope="row">Net monthly cash flow</th><td class="n">{gbp2(M["net"])}</td></tr>
    </tbody></table>
    <table class="tbl"><caption>Cash needed</caption><tbody>
      <tr><th scope="row">20% deposit</th><td class="n">{gbp(M["dep"])}</td></tr>
      <tr><th scope="row">Admin fee</th><td class="n">{gbp(EX["admin"])}</td></tr>
      <tr><th scope="row">Stamp duty*</th><td class="n">{gbp(M["st"])}</td></tr>
      <tr><th scope="row">Legal fees</th><td class="n">{gbp(EX["legal_ex"] + EX["legal_comp"])}</td></tr>
      <tr><th scope="row">5% top-up for a 75% mortgage</th><td class="n">{gbp(M["top"])}</td></tr>
      <tr class="tot"><th scope="row">Total cash deployed</th><td class="n">{gbp(M["cash"])}</td></tr>
    </tbody></table>
  </div>

  <div class="sub">
    {subhead("Payment timeline", f'Example one bed, {gbp(EX["price"])}')}
    <div class="pay">
      <div><span class="when">Today</span><h3>To reserve</h3><span class="num">{gbp(EX["reserve"])}</span>
        <ul><li><span>Reservation deposit, counts towards your 20%</span><span>{gbp(EX["deposit"])}</span></li><li><span>Admin fee to BRIK Studios, part donated to charity</span><span>{gbp(EX["admin"])}</span></li></ul>
        <p class="cum">Takes your chosen apartment off the market straight away. Paid in so far: <b>{gbp(EX["reserve"])}</b></p></div>
      <div><span class="when">Within 28 days</span><h3>On exchange</h3><span class="num">{gbp(M["exch_pay"])}</span>
        <ul><li><span>Rest of your 20% deposit</span><span>{gbp(M["bal"])}</span></li><li><span>Legal fees</span><span>{gbp(EX["legal_ex"])}</span></li></ul>
        <p class="cum">Your solicitor handles the paperwork; Jawaad keeps it moving. Paid in so far: <b>{gbp(EX["reserve"] + M["exch_pay"])}</b></p></div>
      <div><span class="when">Early 2028</span><h3>On completion</h3><span class="num">{gbp(M["comp_pay"])}</span>
        <ul><li><span>5% top-up, with a 75% mortgage</span><span>{gbp(M["top"])}</span></li><li><span>Stamp duty*</span><span>{gbp(M["st"])}</span></li><li><span>Legal fees</span><span>{gbp(EX["legal_comp"])}</span></li></ul>
        <p class="cum">Your mortgage covers the remaining 75%. Paid in, in total: <b>{gbp(M["cash"])}</b></p></div>
    </div>
    <p class="fine mt2">*Stamp duty at the higher rate for an additional property; lower if this will be your only home. Legal fees are from our panel solicitor. Please take your own tax and legal advice.</p>
  </div>

  <div class="sub">
    {subhead("Rental evidence", "St Marys Gate, Stockport. Completed")}
    <div class="g2 l ai-c">
      {fig("stmarys", "St Marys Gate, Stockport", "St Marys Gate, next door", "Hall &amp; Co, completed 2025", "(min-width:861px) 40vw, 100vw", cls="fig crop", ar="4/3")}
      <div>
        <h3 class="h3">Next door, St Marys Gate <em>beat its forecast.</em></h3>
        <p class="mt2">Hall &amp; Co's St Marys Gate sold in Q1 2023 with a 1-bed rent forecast of £900 pcm. By May 2025, 1 beds were letting for £1,100 to £1,250 pcm. The Charter House forecast is £1,300 pcm.</p>
        <div class="mt3">{evidence()}</div>
      </div>
    </div>
    <p class="mt2">Good rental stock in the Underbanks is scarce, and renters pay a premium for it. The supply cap from the conservation area helps protect values.</p>
  </div>

  <div class="sub">
    {subhead("The long-term view", f'Worked example from our ROI breakdown: one bed at {gbp(EX["price"])}')}
    <div class="g2 ai-s">
      <div><p class="eyebrow">Rental growth, forecast at 4% a year</p>{rent_growth()}<p class="src">Gross yield on {gbp(EX["price"])} rises from {rent_y(1) * 12 / EX["price"] * 100:.1f}% in year 1 to {rent_y(5) * 12 / EX["price"] * 100:.1f}% in year 5.</p></div>
      <div><p class="eyebrow">Capital growth, 5% a year from completion</p>{cap_chart()}</div>
    </div>
    <div class="mt4">{roi_table()}{roi_cards()}</div>
    <p class="fine mt2">Capital growth assumes the apartment is worth {gbp(EX["cv"])} on completion and then rises 5% a year, as in our return on investment breakdown. Rental income assumes 4% rent growth, 10% management, a 75% interest-only mortgage at 4% and the service charge. Total return is capital gain plus net rental income, divided by the cash deployed. Average annual return is the total return divided by the years held; it is not compounded. Figures are before tax, voids and selling costs.</p>
    <p class="fine">Forecasts are BRIK Studios' estimates, not guarantees. Rent is forecast for a 1-bed at completion. Mortgage figures assume a 75% interest-only buy-to-let mortgage at 4%. Take your own financial, tax and legal advice.</p>
    <div class="ask mt3"><span class="serif">Happy with the numbers?</span><div class="row">{BOOK}</div></div>
  </div>
</div></section>

<!-- ============================== 08 NEXT STEPS -->
<section class="sec" id="next" data-title="08 &middot; Next steps"><div class="wrap">
  {runhead("08", "Next steps")}
  <h2 class="h2">Choose your apartment <em>on a 3D video tour.</em></h2>
  <p class="stand">Live on a video call, on our 3D model of the finished building.</p>
  <div class="note mt3"><p class="eyebrow" style="color:var(--brick);margin-bottom:8px">Private pre-launch</p><p style="margin:0">These prime top-floor apartments are only available to you because you're early. They're the best in the building, and they can sell at any time. Top-floor apartments from £193,000. Book a video call to see which are still available.</p></div>

  <div class="sub">
    {subhead("3D video tour", "30 minutes on Teams")}
    <h3 class="h3">Let's choose your apartment <em>together.</em></h3>
    <p class="mt2" style="max-width:40em">Rather than send you a list of plots, I'll take you round our 3D model of the finished building on a short video call. We'll go inside the apartments, look at the plots still available, and you can choose the one that suits you.</p>
    <ol class="steps mt3">
      <li><i>1</i><b>Tour the 3D model</b><span>Every floor and aspect of the finished building, and exactly where each apartment sits.</span></li>
      <li><i>2</i><b>Look inside</b><span>Walk through the apartments and their layouts, room by room.</span></li>
      <li><i>3</i><b>See what's still available</b><span>The plots still available, with prices, on the day we speak.</span></li>
      <li><i>4</i><b>Choose yours</b><span>Pick the apartment that suits you, with my honest take on each. Then £3,000 reserves it.</span></li>
    </ol>
    <div class="row mt3">{BOOK}<a class="btn" href="{WA_CALL}" target="_blank" rel="noopener">{ICON["wa"]}WhatsApp me</a></div>
    <p class="fine mt1">30 minutes on Microsoft Teams, at a time that suits you. No obligation.</p>
  </div>

  <div class="sub g2 r ai-c">
    <div>
      {subhead("Reserve your apartment")}
      <h3 class="h3">£3,000 takes it <em>off the market.</em></h3>
      <p class="mt2">First, we choose your apartment together on a short 3D video tour. Then £3,000 takes it off the market: £2,500 is your reservation deposit and counts towards your 20% deposit, and £500 is BRIK Studios' admin fee, part of which goes to charity.</p>
    </div>
    {fig("keyring", "The Charter House keyring", "Your keys, early 2028", "", "(min-width:861px) 30vw, 100vw", cls="fig crop", ar="4/5")}
  </div>

  <div class="sub">
    {subhead("The process", "Step 2 of 6")}
    <ol class="proc">{proc_html}</ol>
  </div>

  <div class="sub">
    {subhead("After you reserve")}
    <div class="g2 l ai-c">
      <div>
        <blockquote class="quote">&ldquo;It's my job to make the process as seamless as possible, and I'll be on hand to assist with every step.&rdquo;</blockquote>
        <div class="attr">{img("jawaad", "Jawaad Alam", "54px")}<div><b>Jawaad Alam</b>Aftersales Manager, BRIK Studios</div></div>
      </div>
      <ol class="steps" style="grid-template-columns:1fr">
        <li style="padding-left:0;border-left:0"><i>1</i><b>A call to walk you through it</b><span>Once your £3,000 is received, Jawaad calls to run through exactly what happens next.</span></li>
        <li style="padding-left:0;border-left:0;border-top:1px solid var(--rule)"><i>2</i><b>Solicitor and broker, sorted</b><span>After basic AML checks, he introduces you to our panel solicitor and, if you need one, our mortgage broker.</span></li>
        <li style="padding-left:0;border-left:0;border-top:1px solid var(--rule)"><i>3</i><b>With you to completion</b><span>He stays with you through exchange and completion, then we help with furniture and letting so it earns from day one.</span></li>
      </ol>
    </div>
  </div>

  <div class="sub">
    {subhead("How it works", "What you're buying")}
    <ol class="steps">
      <li><i>1</i><b>You buy an apartment off-plan</b><span>A new top-floor apartment at Charter House, secured now at pre-launch prices, before the building completes.</span></li>
      <li><i>2</i><b>999-year lease, nil ground rent</b><span>With a 10-year build warranty. Completion is expected early 2028.</span></li>
      <li><i>3</i><b>Pay in stages</b><span>£3,000 today, the rest of your 20% deposit at exchange, then the balance on completion, usually with a 75% buy-to-let mortgage.</span></li>
      <li><i>4</i><b>Completely hands off after</b><span>We find the tenant and manage the letting for 10% of the rent, which is already in every number in this report.</span></li>
    </ol>
    <div class="dark mt3 g2 ai-c" style="gap:24px">
      <div><p class="eyebrow">After completion</p><h3 class="h3">We take care <em>of it all.</em></h3></div>
      <p style="margin:0">Tenant find, referencing, rent collection and day-to-day management, for 10% of the rent. You don't need to live nearby or lift a finger. And we're two minutes away at The Print House.</p>
    </div>
  </div>
</div></section>

<!-- ============================== 09 CONTACT -->
<section class="sec" id="contact" data-title="09 &middot; Keep in touch"><div class="wrap">
  {runhead("09", "Keep in touch")}
  <div class="ask"><div><span class="serif">What else do you need to make a decision?</span><p class="muted" style="margin:8px 0 0;max-width:36em">Tell me what's missing or what you'd change, and I'll update this proposal. You'll see it at this same link.</p></div><a class="btn" href="{WA_MORE}" target="_blank" rel="noopener">{ICON["wa"]}Ask {A["first"]} on WhatsApp</a></div>
  <div class="contact mt4">
    {img(A["photo"], A["name"], "(min-width:861px) 26vw, 260px")}
    <div>
      <h2 class="h2">Have questions? <em>I'll be glad to help.</em></h2>
      <ul class="cf">{contact_facts}</ul>
      <div class="row"><a class="btn fill" href="{WA_Q}" target="_blank" rel="noopener">{ICON["wa"]}WhatsApp me</a><a class="btn" href="tel:{A['tel']}">{A["phone"]}</a><a class="btn" href="mailto:{A['email']}">Email</a></div>
      <p class="mt2"><a class="tlink" href="{A['cal']}" target="_blank" rel="noopener">Or book a 3D video tour at a time that suits you{ICON["arr"]}</a></p>
    </div>
  </div>
</div></section>

<!-- ============================== SOURCES -->
<section class="sec" id="sources" data-title="A &middot; Sources"><div class="wrap">
  {runhead("A", "Sources and important information")}
  <div class="g2 r ai-s">
    <div><p class="eyebrow">References and sources</p><ul class="refs">{refs}</ul></div>
    <div><p class="eyebrow">Important information</p>
      <p class="fine">Details are for guidance only and don't form part of any offer or contract. Service charges are estimates. Images are computer-generated and indicative.</p>
      <p class="fine">Returns and rents are BRIK Studios' estimates, not guarantees, and are shown before tax, voids and selling costs. Property values can go down as well as up. Third-party forecasts are the views of their authors. Please take your own financial, tax and legal advice before buying.</p>
      <p class="fine">Charter House, 50&ndash;72 Churchgate, Stockport SK1 1YG. Exclusive to BRIK Studios. Investment report, {REPORT_DATE}.</p>
    </div>
  </div>
  <footer class="foot"><div class="fl"><img class="ch" src="{P}logo2.webp" width="799" height="614" alt="Charter House, Churchgate, Stockport" loading="lazy"><img src="{P}logo.webp" width="400" height="149" alt="BRIK Studios" loading="lazy"><img src="{P}brikcap.webp" width="500" height="191" alt="BRIK Capital" loading="lazy"></div></footer>
</div></section>
</main>

<div class="mbar" aria-label="Contact {A['first']}"><a class="btn" href="{WA_Q}" target="_blank" rel="noopener">{ICON["wa"]}WhatsApp</a><a class="btn fill" href="{A['cal']}" target="_blank" rel="noopener">{ICON["cal"]}Book a 3D tour</a></div>

<dialog id="contents" aria-label="Contents"><div class="sheet"><div class="sh-in">
  <div class="sh-top"><img src="{P}logo3.webp" width="1100" height="719" alt="Charter House" style="width:150px"><button class="x" data-close aria-label="Close contents">{ICON["x"]}</button></div>
  <ol>{toc}</ol>
  <div class="sh-foot">{BOOK}<a class="btn" href="{WA_Q}" target="_blank" rel="noopener">{ICON["wa"]}WhatsApp {A["first"]}</a></div>
</div></div></dialog>

<dialog id="lb" class="lb" aria-label="Image viewer"><div class="lbin"><button class="x" aria-label="Close">{ICON["x"]}</button><img alt=""><p></p></div></dialog>

<script>{js}</script>
</body>
</html>'''
    return page

if __name__ == "__main__":
    os.makedirs(f"{OUT}/andy", exist_ok=True)
    open(f"{OUT}/index.html", "w").write(build("cb", ""))
    open(f"{OUT}/andy/index.html", "w").write(build("ad", "../"))
    for f in (f"{OUT}/index.html", f"{OUT}/andy/index.html"):
        print(f, os.path.getsize(f) // 1024, "KB")
    print("cash", gbp(M["cash"]), "net", gbp2(M["net"]), [(r["n"], round(r["tot"]), round(r["avg"]), gbp(r["inc"])) for r in ROI])
