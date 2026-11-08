"""Pass 10: Charlie's review of the V2 draft (8 Nov 2026).
Team photos and awards, BRIK banner headings, forecast into the long-term view,
duplicate 'how it works' removed, Keep in touch moved below Heritage."""


def apply(s, rep):
    # ---------- developer and architect: completed-scheme photos, awards
    s = rep(s, '<li>St Marys Gate next door: 50 apartments, completed 2025, sold out off-plan and fully let</li></ul></div>',
            '<li>St Marys Gate next door: 50 apartments, completed 2025, sold out off-plan and fully let</li></ul></div>', label="hall keys")
    s = rep(s, '<p class="thcap">An Ollier Smurthwaite scheme</p></div></div></section>`;',
            '<p class="thcap">An Ollier Smurthwaite scheme</p></div>'
            '<div class="awards"><div class="cap">Awards and recognition</div><ul>'
            '<li><b>Housing Design Awards</b><span>Project Winner, Climate Innovation District. Ollier Smurthwaite</span></li>'
            '<li><b>RIBA Regional Award</b><span>and Small Project Award, Devonshire Road. Ollier Smurthwaite</span></li>'
            '<li><b>House Builder Awards</b><span>Winner, Roof Gardens. Ollier Smurthwaite</span></li>'
            '<li><b>Manchester Society of Architects</b><span>Award winner 2023, The George, Stockport. Ollier Smurthwaite</span></li>'
            '<li><b>Award-winning restoration</b><span>Grade II-listed Bank Chambers, now ProFolk. Hall &amp; Co</span></li>'
            '</ul></div>'
            '</div></section>`;', label="awards strip")

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
    lv = '<section class="sec"><div class="cap"><span>The long-term view</span><span>Worked example from our ROI breakdown: one bed at £189,000</span></div>'
    s = rep(s, lv, '<section class="sec lvsec"><div class="cap"><span>The long-term view</span><span>Worked example from our ROI breakdown: one bed at £189,000</span></div>' + fc, label="forecast into long view")

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
