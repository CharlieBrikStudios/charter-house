"""Pass 10: Charlie's review of the V2 draft (8 Nov 2026).
Team photos and awards, BRIK banner headings, forecast into the long-term view,
duplicate 'how it works' removed, Keep in touch moved below Heritage."""


def apply(s, rep):
    # ---------- developer and architect: completed-scheme photos, awards
    import os, json
    HERE = os.path.dirname(os.path.abspath(__file__))
    site = json.load(open(f"{HERE}/site.json", encoding="utf-8"))
    t0 = s.find('<div class="team2">'); h2 = s.find('<div class="teamhero">', s.find('<div class="teamhero">', t0) + 10)
    end = s.find('</div></section>`;', h2)
    assert 0 < t0 < h2 < end, (t0, h2, end)
    pen = '<svg class="penline" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><polygon points="5,1.6 95,1.6 95,97 50,88 5,97" vector-effect="non-scaling-stroke"/></svg>'
    aw = ('<div class="awards pennants" style="--pbg:var(--' + site.get("awards_bg", "arch1") + ')"><div class="pnhead"><div class="cap">Award-winning team</div>'
          '<h3 class="pnh">' + site.get("awards_h", "Award-winning team.") + '</h3></div><div class="pnrow">'
          + "".join(f'<div class="pennant" style="--i:{k}">{pen}<span class="pnbody">{b}</span><span class="pnstat">{st}</span>'
                    + (f'<span class="pncat">{c}</span>' if c else '') + f'<span class="pnproj">{pr}</span><b class="pnyear">{y}</b></div>'
                    for k, (b, st, c, pr, y) in enumerate(site["awards"]))
          + '</div>' + (f'<p class="pnnote">{site["awards_note"]}</p>' if site.get("awards_note") else '') + '</div>')
    s = s[:end] + aw + s[end:]

    # ---------- BRIK banner: two clear halves
    s = rep(s, '<div class="cap bbsub">Who\'s behind BRIK</div><div class="bbtrack">',
            '<div class="bbhalf"><div class="cap">Who\'s behind BRIK</div><h3 class="bbh">Experienced property investment specialists.</h3></div><div class="bbtrack">', label="brik second half")

    # ---------- The data: forecast moves into the long-term view in Returns
    a = s.find('\n <div class="sec"><div class="cap"><span>Future capital growth</span></div>')
    assert a > 0, "forecast block"
    z = s.find('</table></div></div>', a) + len('</table></div></div>')
    fc = s[a:z]
    s = s[:a] + s[z:]
    fc = (fc.strip()
          .replace('<div class="sec"><div class="cap"><span>Future capital growth</span></div><h3>', '<div class="fcast"><div class="cap">Future capital growth</div><h3 class="big-h">', 1))
    import re
    m = re.search(r'<section class="sec"><div class="cap"><span>The long-term view</span><span>[^<]*</span></div>', s)
    assert m, "long view"
    s = s[:m.start()] + m.group(0).replace('<section class="sec">', '<section class="sec lvsec">', 1) + fc + s[m.end():]

    # ---------- Next steps: the 'how it works' grid repeats the process above; keep the hands-off banner
    a = s.find('function howBlocks(){return `<section class="sec"><div class="cap"><span>How it works</span><span>What you\'re buying</span></div><div class="buy4">')
    assert a > 0, "howBlocks"
    b = s.find('</div>\n <div class="handsoff">', a)
    assert b > a
    s = s[:a] + 'function howBlocks(){return `<section class="sec">' + s[b + len('</div>\n '):]

    # ---------- Keep in touch: below the building's heritage, above the gallery
    s = rep(s, '+nextTab()+howBlocks()+CONTACT};', '+nextTab()+howBlocks()};', label="contact out of next")
    s = rep(s, '<div class="gsec galend" id="t-gallery" data-sec="heritage">',
            '<div class="gsec contactend" id="t-contact" data-sec="heritage">${CONTACT}</div><div class="gsec galend" id="t-gallery" data-sec="heritage">', label="contact after heritage")
    return s
