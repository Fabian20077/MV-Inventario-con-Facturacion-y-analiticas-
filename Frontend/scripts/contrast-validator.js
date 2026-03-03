/* ============================================
   VALIDADOR DE CONTRASTE WCAG AA
   Pegar en la consola del navegador (F12)
   
   Muestra elementos con contraste < 4.5:1
   ============================================ */

(function() {
    function getLuminance(rgb) {
        const [r, g, b] = rgb.map(c => {
            c = c / 255;
            return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    function parseColor(c) {
        if (!c || c === 'transparent' || c === 'rgba(0, 0, 0, 0)') return null;
        if (c.startsWith('#')) {
            const hex = c.length === 4 ? c.split('').map((x, i) => i ? x + x : '').join('') : c.slice(1);
            return [parseInt(hex.substr(0, 2), 16), parseInt(hex.substr(2, 2), 16), parseInt(hex.substr(4, 2), 16)];
        }
        if (c.startsWith('rgb')) {
            const m = c.match(/\d+/g);
            return m ? [parseInt(m[0]), parseInt(m[1]), parseInt(m[2])] : null;
        }
        return null;
    }

    function getBg(el) {
        let bg = window.getComputedStyle(el).backgroundColor;
        while ((!bg || bg === 'rgba(0, 0, 0, 0)' || bg === 'transparent') && el.parentElement && el.parentElement !== document.body) {
            el = el.parentElement;
            bg = window.getComputedStyle(el).backgroundColor;
        }
        return bg;
    }

    const elements = document.querySelectorAll('*');
    const issues = [];
    const checked = new Set();

    elements.forEach(el => {
        if (checked.has(el) || el.children.length > 10) return;
        checked.add(el);

        const fg = parseColor(window.getComputedStyle(el).color);
        const bg = parseColor(getBg(el));

        if (!fg || !bg) return;

        try {
            const l1 = getLuminance(fg);
            const l2 = getLuminance(bg);
            const lighter = Math.max(l1, l2);
            const darker = Math.min(l1, l2);
            const ratio = (lighter + 0.05) / (darker + 0.05);

            if (ratio < 4.5 && el.textContent.trim().length > 0) {
                issues.push({
                    el: el,
                    ratio: ratio.toFixed(2),
                    fg: fg,
                    bg: bg,
                    tag: el.tagName.toLowerCase(),
                    cls: el.className ? el.className.split(' ')[0] : '(sin clase)',
                    txt: el.textContent.trim().substring(0, 30)
                });
            }
        } catch (e) {}
    });

    console.clear();
    console.log('%c🔍 VALIDADOR CONTRASTE WCAG AA', 'font-size: 16px; font-weight: bold; color: #2563eb;');
    console.log('%cMínimo: 4.5:1 | Encontrados: ' + issues.length, 'color: #64748b;');

    if (issues.length === 0) {
        console.log('%c✅ Sin problemas de contraste', 'color: #059669; font-size: 14px;');
    } else {
        issues.sort((a, b) => parseFloat(a.ratio) - parseFloat(b.ratio)).slice(0, 20).forEach((x, i) => {
            console.log('%c' + (i + 1) + '. [' + x.tag + '.' + x.cls + '] "' + x.txt + '..."', 'font-weight: bold; color: #dc2626;');
            console.log('   Ratio: ' + x.ratio + ':1 | FG: rgb(' + x.fg + ') | BG: rgb(' + x.bg + ')');
        });
        if (issues.length > 20) console.log('... y ' + (issues.length - 20) + ' más');
    }

    console.log('%c\n✓ Aplicación en modo oscuro permanente', 'color: #10b981; font-style: italic;');
})();
