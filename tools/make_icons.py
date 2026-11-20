"""App icons for the installable web tool: Tech-Con blue tile, UR20 label, a pail."""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / 'web' / 'public' / 'icons'
FONT = 'C:/Windows/Fonts/segoeuib.ttf'


def icon(size: int, pad: int, name: str, radius: int) -> None:
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([0, 0, size - 1, size - 1], radius=radius, fill='#1226AA')
    inner = size - 2 * pad
    f = ImageFont.truetype(FONT, int(inner * 0.34))
    text = 'UR20'
    w = d.textlength(text, font=f)
    d.text(((size - w) / 2, size * 0.24), text, font=f, fill='white')
    cx, top, bw = size / 2, size * 0.6, inner * 0.3
    d.rounded_rectangle(
        [cx - bw / 2 - inner * 0.02, top, cx + bw / 2 + inner * 0.02, top + inner * 0.05],
        radius=inner * 0.02,
        fill='#E0602B',
    )
    d.polygon(
        [(cx - bw / 2, top + inner * 0.05), (cx + bw / 2, top + inner * 0.05),
         (cx + bw * 0.4, top + inner * 0.25), (cx - bw * 0.4, top + inner * 0.25)],
        fill='white',
    )
    img.save(OUT / name)


if __name__ == '__main__':
    OUT.mkdir(parents=True, exist_ok=True)
    icon(192, 16, 'icon-192.png', 40)
    icon(512, 40, 'icon-512.png', 104)
    icon(512, 96, 'maskable-512.png', 0)
    print('icons written to', OUT)
