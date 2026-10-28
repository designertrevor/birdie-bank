# Contact sheets and INDEX.md for the design audit shots (scripts/audit-shots.mjs).
#   python3 scripts/audit-sheets.py [overnight/audit-shots] [--index] [--area home]
# Writes <area>/_sheet-light.jpg and _sheet-dark.jpg (every shot of that theme, in shooting order,
# labelled), and with --index the INDEX.md from each area's _manifest-<theme>.json.
import json, os, sys
from PIL import Image, ImageDraw, ImageFont

args = sys.argv[1:]
root = next((a for a in args if not a.startswith('--') and os.path.isdir(a)), 'overnight/audit-shots')
only = args[args.index('--area') + 1].split(',') if '--area' in args else None
TW, TH, COLS, LABEL = 260, 563, 6, 44
try:
    font = ImageFont.truetype('/System/Library/Fonts/SFNS.ttf', 15)
    big = ImageFont.truetype('/System/Library/Fonts/SFNS.ttf', 30)
except Exception:
    font = big = ImageFont.load_default()

def manifest(area, theme):
    f = os.path.join(root, area, f'_manifest-{theme}.json')
    try:
        return json.load(open(f))
    except Exception:
        return {'shots': [], 'notes': []}

def files_for(area, theme):
    m = manifest(area, theme)
    listed = [s['file'] for s in m['shots'] if os.path.exists(os.path.join(root, area, s['file']))]
    rest = sorted(f for f in os.listdir(os.path.join(root, area)) if f.endswith(f'-{theme}.png') and f not in listed)
    return listed + rest

def wrap(d, text, width):
    words, lines, cur = text.split(), [], ''
    for w in words:
        t = (cur + ' ' + w).strip()
        if d.textlength(t, font=font) > width and cur:
            lines.append(cur); cur = w
        else:
            cur = t
    if cur: lines.append(cur)
    return lines[:2]

def sheet(area, theme):
    files = files_for(area, theme)
    if not files: return 0
    rows = (len(files) + COLS - 1) // COLS
    W, H = COLS * (TW + 12) + 12, 60 + rows * (TH + LABEL + 12)
    bg = (245, 242, 235) if theme == 'light' else (28, 28, 30)
    fg = (20, 20, 20) if theme == 'light' else (235, 235, 235)
    im = Image.new('RGB', (W, H), bg)
    d = ImageDraw.Draw(im)
    d.text((12, 12), f'{area} · {theme} · {len(files)} shots', fill=fg, font=big)
    for i, f in enumerate(files):
        x, y = 12 + (i % COLS) * (TW + 12), 60 + (i // COLS) * (TH + LABEL + 12)
        t = Image.open(os.path.join(root, area, f)).convert('RGB').resize((TW, TH), Image.LANCZOS)
        im.paste(t, (x, y))
        d.rectangle([x - 1, y - 1, x + TW, y + TH], outline=(150, 150, 150))
        for k, line in enumerate(wrap(d, f.replace(f'-{theme}.png', ''), TW)):
            d.text((x, y + TH + 4 + k * 18), line, fill=fg, font=font)
    im.save(os.path.join(root, area, f'_sheet-{theme}.jpg'), quality=82)
    return len(files)

areas = sorted(a for a in os.listdir(root) if os.path.isdir(os.path.join(root, a)) and not a.startswith('_'))
if only: areas = [a for a in areas if a in only]
for a in areas:
    print(a, sheet(a, 'light'), sheet(a, 'dark'))

if '--index' in args:
    out = ['# Design audit shots', '',
           'Every screen and state of Birdie Bank on `overhaul/next`, at 390 by 844 CSS px (2x), light and dark,',
           'from `node scripts/audit-shots.mjs` (shot list in `scripts/audit-list.mjs`) on the review seed and its',
           'fixed clock (Mon 26 Oct 2026, 5:40 pm, Denver). Motion is on; each shot waits for fonts, images and',
           'about 1.2 s. Files ending `-mid` are about 150 ms into a step\'s entrance; `-scrolled` is one viewport',
           'down and `-bottom` the end of a screen taller than the phone. Each area has `_sheet-light.jpg` and',
           '`_sheet-dark.jpg` contact sheets. `_failed/` holds the frame where a journey stopped, if any.',
           'The Add to Home Screen card is put away (localStorage bb-install) except in `home/upnext-install-card`.', '']
    total = 0
    for a in areas:
        ml, md = manifest(a, 'light'), manifest(a, 'dark')
        what = {}
        for s in ml['shots'] + md['shots']:
            what.setdefault(s['file'].rsplit('-', 1)[0], s['what'])
        names = sorted({f.rsplit('-', 1)[0] for f in os.listdir(os.path.join(root, a)) if f.endswith('.png')}, key=lambda n: list(what).index(n) if n in what else 9999)
        count = len([f for f in os.listdir(os.path.join(root, a)) if f.endswith('.png')])
        total += count
        out += [f'## {a} ({count} files)', '']
        for n in names:
            themes = [t for t in ('light', 'dark') if os.path.exists(os.path.join(root, a, f'{n}-{t}.png'))]
            out.append(f'- `{a}/{n}-{"|".join(themes)}.png`: {what.get(n, "")}')
        notes = sorted(set(ml['notes'] + md['notes']))
        if notes:
            out += ['', 'Not reached or failed:', ''] + [f'- {n}' for n in notes]
        out.append('')
    out.insert(9, f'{total} PNG files in all.')
    out.insert(10, '')
    extra = os.path.join(root, '_unreached.md')
    if os.path.exists(extra):
        out += open(extra).read().splitlines()
    open(os.path.join(root, 'INDEX.md'), 'w').write('\n'.join(out) + '\n')
    print('INDEX.md', total)
