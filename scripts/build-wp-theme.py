"""Convert the final HTML mockups into the LFAR WordPress block theme.

Run from the repo root:  python3 scripts/build-wp-theme.py
Needs: pip install beautifulsoup4 tinycss2

Writes into theme/lfar/:
  patterns/page-*.php   one block pattern per mockup page (core blocks where possible)
  patterns/header.php, footer.php, newsletter.php
  assets/css/<page>.css  the mockup's CSS, with fonts/colors pointed at theme.json presets
  assets/js/<page>.js    the mockup's JS
  assets/images/*        images pulled out of the base64 data URIs
"""
import re, os, json, hashlib, base64
import tinycss2
from bs4 import BeautifulSoup, NavigableString, Tag, Comment

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(REPO, 'design', 'final-mockups')
THEME = os.path.join(REPO, 'theme', 'lfar')
PAGES = {'home': 'LFAR Home.html', 'about': 'LFAR About.html', 'adopt': 'LFAR Adopt.html',
         'get-involved': 'LFAR Get Involved.html', 'contact': 'LFAR Contact.html', 'donate': 'LFAR Donate.html'}
TITLES = {'home': 'Home', 'about': 'About', 'adopt': 'Adopt', 'get-involved': 'Get Involved',
          'contact': 'Contact', 'donate': 'Donate'}
LINKS = {'Home': '/', 'About': '/about/', 'Adopt': '/adopt/', 'Get%20Involved': '/get-involved/',
         'Contact': '/contact/', 'Donate': '/donate/'}
for d in ['patterns', 'assets/css', 'assets/js', 'assets/images']:
    os.makedirs(os.path.join(THEME, d), exist_ok=True)

# ---------- images ----------
images = {}
used = set()
EXT = {'jpeg': 'jpg', 'png': 'png', 'webp': 'webp'}
RENAME = {'home-image.png': 'lfar-paw-icon.png', 'los-feliz-animal-rescue.png': 'lfar-wordmark.png',
          'los-feliz-animal-rescue-2.png': 'lfar-logo-footer.png'}


def slugify(s):
    s = re.sub(r'[^a-z0-9]+', '-', s.lower()).strip('-')
    return s[:48].strip('-') or 'image'


def save_image(mime, b64, hint):
    data = base64.b64decode(re.sub(r'\s', '', b64))
    h = hashlib.sha1(data).hexdigest()
    if h in images:
        return images[h]
    base = slugify(hint)
    name = f'{base}.{EXT[mime]}'
    i = 2
    while name in used:
        name = f'{base}-{i}.{EXT[mime]}'
        i += 1
    used.add(name)
    name = RENAME.get(name, name)
    images[h] = name
    path = os.path.join(THEME, 'assets/images', name)
    if not os.path.exists(path) or open(path, 'rb').read() != data:
        open(path, 'wb').write(data)
    return name


DATA_RE = re.compile(r'data:image/(jpeg|png|webp);base64,([A-Za-z0-9+/=\s]+)')


def prep(html):
    for k, v in LINKS.items():
        html = re.sub(r'LFAR%20' + k + r'\.html', v, html)
    html = html.replace('[XX-XXXXXXX]', '87-4677140')
    html = re.sub(r'\s*<p style="opacity:\.85;font-weight:400">Design mockup[^<]*</p>', '', html)
    return html


def tokenize_html(html, page):
    def img_sub(m):
        tag = m.group(0)
        alt = re.search(r'alt="([^"]*)"', tag)
        hint = alt.group(1) if alt and alt.group(1) else page + '-image'
        return DATA_RE.sub(lambda d: '__IMG__' + save_image(d.group(1), d.group(2), hint) + '__', tag)
    html = re.sub(r'<img\b[^>]*>', img_sub, html)
    return DATA_RE.sub(lambda d: '__IMG__' + save_image(d.group(1), d.group(2), page + '-inline') + '__', html)


def tokenize_css(css, page):
    out, pos = [], 0
    for m in DATA_RE.finditer(css):
        before = css[:m.start()]
        ob = before.rfind('{')
        cb = before.rfind('}', 0, ob)
        sel = before[cb + 1:ob].strip().split(',')[0]
        name = save_image(m.group(1), m.group(2), page + '-' + sel)
        out += [css[pos:m.start()], '__IMG__' + name + '__']
        pos = m.end()
    out.append(css[pos:])
    return ''.join(out)


# ---------- CSS rewriting ----------
def split_top(s, ch=','):
    parts, depth, cur = [], 0, ''
    for c in s:
        if c in '([':
            depth += 1
        elif c in ')]':
            depth -= 1
        if c == ch and depth == 0:
            parts.append(cur)
            cur = ''
        else:
            cur += c
    parts.append(cur)
    return parts


def last_compound(sel):
    depth = 0
    for i in range(len(sel) - 1, -1, -1):
        c = sel[i]
        if c in ')]':
            depth += 1
        elif c in '([':
            depth -= 1
        elif depth == 0 and c in ' >+~':
            return sel[:i + 1], sel[i + 1:]
    return '', sel


def rewrite_selector(sel, imgonly):
    """Image blocks wrap <img> in <figure class="...">, so classes that were on the
    <img> now sit on the figure. Point those rules at the img inside the figure too."""
    sel = sel.strip()
    sel = re.sub(r'\s*>\s*img\b', ' img', sel)
    pre, last = last_compound(sel)
    for cls in imgonly:
        m = re.match(r'^(img)?(\.[\w-]+)*\.' + re.escape(cls) + r'(?![\w-])', last)
        if m and (m.group(1) or not re.match(r'^[a-z]', last)):
            base = last if last.startswith('img') else 'img' + last
            return [pre + base, pre + 'figure' + base[3:] + ' > img']
    return [sel]


def rewrite_rules(nodes, imgonly):
    out = []
    for r in nodes:
        if r.type == 'qualified-rule':
            sels = []
            for s in split_top(tinycss2.serialize(r.prelude)):
                sels += rewrite_selector(s, imgonly)
            out.append(', '.join(sels) + '{' + tinycss2.serialize(r.content) + '}')
        elif r.type == 'at-rule':
            pre = '@' + r.at_keyword + tinycss2.serialize(r.prelude)
            if r.content is None:
                out.append(pre + ';')
            elif r.lower_at_keyword in ('media', 'supports', 'layer', 'container'):
                inner = tinycss2.parse_rule_list(r.content, skip_whitespace=True, skip_comments=True)
                out.append(pre + '{\n' + '\n'.join(rewrite_rules(inner, imgonly)) + '\n}')
            else:
                out.append(pre + '{' + tinycss2.serialize(r.content) + '}')
    return out


PALETTE = {'--nav': 'nav', '--accent': 'accent', '--accent-soft': 'accent-soft', '--head': 'head',
           '--h3': 'h3', '--ink': 'ink', '--light': 'light', '--band': 'band'}


def finish_css(css, imgonly):
    css = re.sub(r'"Comfortaa"(\s*,\s*("[^"]+"|[A-Za-z-]+))*', 'var(--wp--preset--font-family--body)', css)
    css = re.sub(r'"Quicksand"(\s*,\s*("[^"]+"|[A-Za-z-]+))*', 'var(--wp--preset--font-family--heading)', css)
    for v, slug in PALETTE.items():
        css = re.sub(r'(' + re.escape(v) + r'\s*:\s*)#[0-9A-Fa-f]{3,8}', r'\1var(--wp--preset--color--' + slug + ')', css)
    rules = tinycss2.parse_stylesheet(css, skip_whitespace=True, skip_comments=True)
    css = '\n'.join(rewrite_rules(rules, imgonly))
    return re.sub(r'__IMG__(.+?)__', r'../images/\1', css)


# ---------- HTML -> block markup ----------
INLINE = {'a', 'strong', 'em', 'b', 'i', 'span', 'br', 'small', 'sup', 'sub', 'code', 'mark', 'abbr',
          'time', 'u', 's', 'q', 'cite', 'del', 'ins'}
CONTAINERS = {'div', 'section', 'article', 'header', 'aside', 'figure', 'blockquote'}


def esc_attr(s):
    return s.replace('&', '&amp;').replace('"', '&quot;').replace('<', '&lt;').replace('>', '&gt;')


def jattr(d):
    s = json.dumps(d, separators=(',', ':'), ensure_ascii=False)
    return s.replace('--', '\\u002d\\u002d').replace('<', '\\u003c').replace('>', '\\u003e').replace('&', '\\u0026')


def blk(name, attrs, inner):
    a = (' ' + jattr(attrs)) if attrs else ''
    return f'<!-- wp:{name}{a} -->\n{inner}\n<!-- /wp:{name} -->'


def html_blk(tag):
    return blk('html', None, str(tag))


def inline_only(tag):
    return all(t.name in INLINE for t in tag.find_all(True))


def attrs_sub(tag, allowed):
    return set(tag.attrs) <= allowed


def has_text(tag):
    return any(isinstance(c, NavigableString) and not isinstance(c, Comment) and c.strip() for c in tag.children)


def clsof(tag):
    return ' '.join(tag.get('class', []))


def open_attrs(classes, id_=None):
    s = f' class="{esc_attr(classes.strip())}"' if classes.strip() else ''
    if id_:
        s += f' id="{esc_attr(id_)}"'
    return s


extra_css, imgclasses, otherclasses = [], set(), set()


def convert_list(tag):
    items = []
    for c in tag.children:
        if isinstance(c, NavigableString):
            if c.strip():
                return None
            continue
        if c.name != 'li' or not attrs_sub(c, {'class'}):
            return None
        nested = None
        kids = [k for k in c.children if not (isinstance(k, NavigableString) and not k.strip())]
        if kids and isinstance(kids[-1], Tag) and kids[-1].name in ('ul', 'ol'):
            nested = convert_list(kids[-1])
            if nested is None:
                return None
            kids = kids[:-1]
        for k in kids:
            if isinstance(k, Tag) and (k.name not in INLINE or not inline_only(k)):
                return None
        inner = ''.join(str(k) for k in kids).strip()
        a = {'className': clsof(c)} if clsof(c) else None
        items.append(blk('list-item', a, f'<li{open_attrs(clsof(c))}>{inner}{nested or ""}</li>'))
    a = {}
    if tag.name == 'ol':
        a['ordered'] = True
    if clsof(tag):
        a['className'] = clsof(tag)
    return blk('list', a or None,
               f'<{tag.name}{open_attrs("wp-block-list " + clsof(tag), tag.get("id"))}>' + '\n\n'.join(items) + f'</{tag.name}>')


def convert(node):
    if isinstance(node, Comment):
        return []
    if isinstance(node, NavigableString):
        return [] if not node.strip() else None
    t, c, i = node.name, clsof(node), node.get('id')
    if t in ('h1', 'h2', 'h3', 'h4', 'h5', 'h6') and attrs_sub(node, {'class', 'id'}) and inline_only(node):
        lvl, a = int(t[1]), {}
        if lvl != 2:
            a['level'] = lvl
        if c:
            a['className'] = c
        return [blk('heading', a or None, f'<{t}{open_attrs("wp-block-heading " + c, i)}>{node.decode_contents()}</{t}>')]
    if t == 'p' and attrs_sub(node, {'class', 'id'}) and inline_only(node):
        return [blk('paragraph', {'className': c} if c else None, f'<p{open_attrs(c, i)}>{node.decode_contents()}</p>')]
    if t in ('ul', 'ol') and attrs_sub(node, {'class', 'id'}):
        r = convert_list(node)
        if r:
            return [r]
    if t == 'img' and attrs_sub(node, {'src', 'alt', 'class', 'loading', 'decoding', 'width', 'height'}):
        for k in node.get('class', []):
            imgclasses.add(k)
        return [blk('image', {'className': c} if c else None,
                    f'<figure{open_attrs("wp-block-image " + c)}><img src="{node["src"]}" alt="{esc_attr(node.get("alt", ""))}"/></figure>')]
    for k in node.get('class', []):
        otherclasses.add(k)
    for d in node.find_all(True):
        for k in d.get('class', []):
            if d.name != 'img':
                otherclasses.add(k)
    if t == 'a' and inline_only(node) and attrs_sub(node, {'href', 'class', 'target', 'rel', 'aria-label'}):
        return [blk('paragraph', {'className': 'lfar-a'}, f'<p class="lfar-a">{str(node)}</p>')]
    if (t in CONTAINERS and attrs_sub(node, {'class', 'id', 'data-anim', 'aria-label', 'aria-labelledby', 'style'})
            and node.find(True) and not has_text(node)):
        if node.get('style'):
            if not i:
                return [html_blk(node)]
            extra_css.append(f'#{i}{{{node["style"]}}}')
        kids = []
        for ch in node.children:
            r = convert(ch)
            if r is None:
                return [html_blk(node)]
            kids += r
        if all(k.startswith('<!-- wp:html') for k in kids):
            return [html_blk(node)]
        a = {}
        if t != 'div':
            a['tagName'] = t
        if c:
            a['className'] = c
        return [blk('group', a or None, f'<{t}{open_attrs("wp-block-group " + c, i)}>' + '\n\n'.join(kids) + f'</{t}>')]
    return [html_blk(node)]


def php_out(s):
    return re.sub(r'__IMG__(.+?)__', r"<?php echo esc_url( get_theme_file_uri( 'assets/images/\1' ) ); ?>", s)


def pattern_file(slug, title, content, cats='lfar-pages', inserter='yes', extra=''):
    head = (f"<?php\n/**\n * Title: {title}\n * Slug: lfar/{slug}\n * Categories: {cats}\n"
            f" * Inserter: {inserter}\n{extra} */\n?>\n")
    open(os.path.join(THEME, 'patterns', slug + '.php'), 'w', encoding='utf-8').write(head + php_out(content) + '\n')


# Marks the current page in the nav (the header is shared, so the mockups' hard-coded "active" is gone).
NAV_ACTIVE = ("(function(){var p=location.pathname.replace(/\\/?$/,'/');[].forEach.call(document.querySelectorAll('#menu a'),"
              "function(a){var h;try{h=new URL(a.href).pathname.replace(/\\/?$/,'/')}catch(e){return}"
              "if(h===p){a.setAttribute('aria-current','page');if(!a.parentNode.classList.contains('nav-donate'))a.classList.add('active');}});})();\n")

report = []
for key, fn in PAGES.items():
    raw = prep(open(os.path.join(SRC, fn), encoding='utf-8').read())
    styles = re.findall(r'<style[^>]*>(.*?)</style>', raw, re.S)
    scripts = re.findall(r'<script([^>]*)>(.*?)</script>', raw, re.S)
    css = tokenize_css('\n'.join(styles), key)
    body = re.sub(r'<script.*?</script>|<style.*?</style>|<link[^>]*>', '', raw, flags=re.S)
    body = tokenize_html(body, key)
    soup = BeautifulSoup(body, 'html.parser')
    main = soup.find('main')
    extra_css.clear(); imgclasses.clear(); otherclasses.clear()
    blocks, nl = [], None
    for ch in main.children:
        if isinstance(ch, Tag) and ch.get('id') == 'newsletter':
            nl = ch
            continue
        r = convert(ch)
        blocks += r if r is not None else [blk('html', None, str(ch))]
    outside = []
    root = soup.find('body') or soup
    for ch in list(root.children):
        if not isinstance(ch, Tag) or ch.name in ('main', 'footer', 'nav', 'html', 'head', 'title', 'meta'):
            continue
        if 'topbar' in ch.get('class', []) or 'back-to-top' in ch.get('class', []):
            continue
        outside.append(ch)
    blocks += [html_blk(o) for o in outside]
    pattern_file('page-' + key, TITLES[key] + ' page', '\n\n'.join(blocks), extra=" * Post Types: page\n")
    imgonly = imgclasses - otherclasses
    open(os.path.join(THEME, 'assets/css', key + '.css'), 'w', encoding='utf-8').write(
        finish_css(css, imgonly) + '\n' + '\n'.join(extra_css) + '\n')
    js = NAV_ACTIVE + '\n'.join(s for a, s in scripts if 'ld+json' not in a)
    open(os.path.join(THEME, 'assets/js', key + '.js'), 'w', encoding='utf-8').write(js)
    allb = '\n'.join(blocks)
    report.append((key, 'html', allb.count('<!-- wp:html'), 'group', allb.count('<!-- wp:group'), 'heading', allb.count('<!-- wp:heading'),
                   'para', allb.count('<!-- wp:paragraph'), 'img', allb.count('<!-- wp:image'), 'list', allb.count('<!-- wp:list '),
                   'outside', [o.name + '.' + clsof(o) for o in outside], 'scripts', [a for a, s in scripts], 'imgonly', sorted(imgonly)))
    if key == 'donate':  # site chrome comes from the Donate mockup (real EIN, full Explore footer)
        top = re.search(r'<div class="topbar">.*?</nav>', body, re.S).group(0).replace(' aria-current="page"', '')
        topbar, navbar = re.split(r'(?=<nav class="navbar")', top)
        pattern_file('header', 'Site header', blk('html', None, topbar.strip()) + '\n\n' + blk('html', None, navbar.strip()),
                     cats='lfar-chrome', inserter='no')
        foot = re.search(r'<footer>.*?</footer>\s*<a class="back-to-top".*?</a>', body, re.S).group(0)
        f1, f2 = re.split(r'(?=<a class="back-to-top")', foot)
        pattern_file('footer', 'Site footer', blk('html', None, f1.strip()) + '\n\n' + blk('html', None, f2.strip()),
                     cats='lfar-chrome', inserter='no')
        pattern_file('newsletter', 'Newsletter sign-up', '\n\n'.join(convert(nl)), cats='lfar-chrome')
for r in report:
    print(r)
print('images', len(images))
