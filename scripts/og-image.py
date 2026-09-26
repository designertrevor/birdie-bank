# Draws public/og-image.png, the 1200x630 link preview card for shared links.
# Run: python3 scripts/og-image.py  (needs Pillow and the Bricolage Grotesque fonts installed)
# Colors come from the top of src/styles.css.
import os
from PIL import Image, ImageDraw, ImageFont

W, H, S = 1200, 630, 2  # draw at 2x, then scale down for smooth edges
CANVAS, INK, BODY, MUTE = '#fffaf0', '#0a0a0a', '#3a3a3a', '#6a6a6a'
TEAL, PINK, OCHRE, MINT, LAV, CORAL, PEACH, DIMPLE = '#1a3a3a', '#ff4d8b', '#e8b94a', '#a4d4c5', '#b8a4ed', '#ff6b5a', '#ffb084', '#e1d9c3'

FONTS = os.path.expanduser('~/Library/Fonts')


def font(weight, size):
    return ImageFont.truetype(os.path.join(FONTS, f'BricolageGrotesque_36pt-{weight}.ttf'), size * S)


def s(*v):
    return [x * S for x in v]


img = Image.new('RGB', (W * S, H * S), CANVAS)
d = ImageDraw.Draw(img)

# Right: the app icon, big, with a few pastel coins around it
cx, cy, size = 905, 300, 360
x0, y0 = cx - size / 2, cy - size / 2
u = size / 100
d.rounded_rectangle(s(x0, y0, x0 + size, y0 + size), radius=0.22 * size * S, fill=TEAL)
d.polygon(s(x0 + 41 * u, y0 + 66 * u, x0 + 50 * u, y0 + 86 * u, x0 + 59 * u, y0 + 66 * u), fill=CORAL)
d.ellipse(s(x0 + 25 * u, y0 + 19 * u, x0 + 75 * u, y0 + 69 * u), fill=CANVAS)
for dx, dy in [(40, 34), (54, 29), (63, 41), (37, 50), (60, 54), (48, 46)]:
    r = 2.2 * u
    d.ellipse(s(x0 + dx * u - r, y0 + dy * u - r, x0 + dx * u + r, y0 + dy * u + r), fill=DIMPLE)
for (px, py, r, c) in [(700, 110, 26, PINK), (1115, 95, 34, OCHRE), (1130, 520, 22, LAV), (720, 520, 30, MINT), (1165, 300, 14, PEACH)]:
    d.ellipse(s(px - r, py - r, px + r, py + r), fill=c)

# Left: name, pitch, a few game chips, and the address
left = 80
d.text(s(left, 150), 'Birdie Bank', font=font('ExtraBold', 96), fill=INK)
d.text(s(left, 275), 'Play any game,', font=font('Medium', 46), fill=BODY)
d.text(s(left, 330), 'settle every bet.', font=font('Medium', 46), fill=BODY)
x = left
chip = font('Bold', 24)
for label, c in [('Nassau', PINK), ('Skins', OCHRE), ('Wolf', MINT), ('Banker', LAV)]:
    tw = d.textlength(label, font=chip) / S
    d.rounded_rectangle(s(x, 420, x + tw + 40, 472), radius=26 * S, fill=c)
    d.text(s(x + 20, 446), label, font=chip, fill=INK, anchor='lm')
    x += tw + 52
d.text(s(left, 530), 'birdie-bank.vercel.app', font=font('Medium', 24), fill=MUTE)

out = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'public', 'og-image.png')
img.resize((W, H), Image.LANCZOS).save(out, optimize=True)
print('wrote', os.path.normpath(out))
