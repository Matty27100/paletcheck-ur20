"""Link-preview image (og.jpg) and the LinkedIn promo post (image + text).

Numbers come from data/facts.json; the 3D frame is a real screenshot of the tool.
"""
import json
from pathlib import Path

import qrcode
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FACTS = json.loads((ROOT / 'data' / 'facts.json').read_text(encoding='utf-8'))
SHOT = ROOT / 'assets' / 'shots' / 'stage-desktop.png'
BLUE, DARK, MIST, ORANGE = '#1226AA', '#0A1A87', '#EAF1F9', '#E0602B'
F_BOLD = 'C:/Windows/Fonts/segoeuib.ttf'
F_REG = 'C:/Windows/Fonts/segoeui.ttf'
F_SEMI = 'C:/Windows/Fonts/seguisb.ttf'

URL = FACTS['site']['url']
CAMPAIGN = URL + '?utm_source=linkedin&utm_campaign=lansare-2027'

# The hook figure: a 13 kg line at the reference target rate, one 8-hour shift.
RATE, KG = FACTS['reference']['targetRate'], 13
TONNES = round(RATE * 60 * FACTS['assumptions']['shiftHours'] * KG / 1000)
TESTED_13 = str(FACTS['reference']['testedRate']['13']).replace('.', ',')
TESTED_5 = str(FACTS['reference']['testedRate']['5']).replace('.', ',')


def font(path, size):
    return ImageFont.truetype(path, size)


def cover(img, w, h):
    r = max(w / img.width, h / img.height)
    img = img.resize((round(img.width * r), round(img.height * r)), Image.LANCZOS)
    x, y = (img.width - w) // 2, (img.height - h) // 2
    return img.crop((x, y, x + w, y + h))


def wrap(draw, text, f, width):
    lines, line = [], ''
    for word in text.split():
        test = (line + ' ' + word).strip()
        if draw.textlength(test, font=f) <= width:
            line = test
        else:
            lines.append(line)
            line = word
    lines.append(line)
    return lines


def qr(data, size):
    q = qrcode.QRCode(border=1, box_size=10)
    q.add_data(data)
    q.make(fit=True)
    return q.make_image(fill_color=DARK, back_color='white').convert('RGB').resize((size, size), Image.NEAREST)


def og():
    W, H = 1200, 630
    img = Image.new('RGB', (W, H), MIST)
    shot = cover(Image.open(SHOT).convert('RGB'), 640, H)
    img.paste(shot, (W - 640, 0))
    d = ImageDraw.Draw(img)
    d.rectangle([0, 0, 560, H], fill='white')
    d.text((56, 52), 'Tech-Con', font=font(F_BOLD, 34), fill=BLUE)
    y = 150
    for line in wrap(d, 'Robotul UR20 poate paletiza gălețile tale?', font(F_BOLD, 54), 460):
        d.text((56, y), line, font=font(F_BOLD, 54), fill=DARK)
        y += 66
    d.text((56, y + 18), 'Verifică linia în 2 minute.', font=font(F_REG, 30), fill='#4D5A85')
    d.text((56, y + 58), 'Cinci întrebări, fără cont.', font=font(F_REG, 30), fill='#4D5A85')
    img.save(ROOT / 'web' / 'public' / 'og.jpg', quality=88)


def post():
    W, H = 1080, 1350  # LinkedIn portrait 4:5
    img = Image.new('RGB', (W, H), 'white')
    shot = cover(Image.open(SHOT).convert('RGB'), W, 610)
    img.paste(shot, (0, 0))
    d = ImageDraw.Draw(img)
    # top band over the image, for the logo
    d.rectangle([0, 0, W, 86], fill='white')
    d.text((60, 22), 'Tech-Con', font=font(F_BOLD, 38), fill=BLUE)
    d.text((W - 60 - d.textlength('Paletizare cu UR20', font=font(F_SEMI, 26)), 32),
           'Paletizare cu UR20', font=font(F_SEMI, 26), fill='#4D5A85')

    y = 650
    big = font(F_BOLD, 150)
    num = f'{TONNES} t'
    d.text((60, y - 30), num, font=big, fill=BLUE)
    nx = 60 + d.textlength(num, font=big) + 28
    for i, line in enumerate(wrap(d, 'ridicate manual într-un singur schimb', font(F_SEMI, 38), W - nx - 60)):
        d.text((nx, y + 18 + i * 46), line, font=font(F_SEMI, 38), fill=DARK)
    y += 170
    sub = (f'La {RATE} găleți de {KG} kg pe minut, echipa de paletizare ridică {TONNES} de tone în 8 ore. '
           f'O celulă UR20 preia ridicarea, iar oamenii schimbă paleții.')
    for line in wrap(d, sub, font(F_REG, 32), W - 120):
        d.text((60, y), line, font=font(F_REG, 32), fill='#2A3566')
        y += 44
    y += 14
    d.text((60, y), f'Testat într-o fabrică de ingrediente: {TESTED_13} găleți/min la 13 kg, {TESTED_5} la 5 kg.',
           font=font(F_REG, 25), fill='#4D5A85')
    d.text((60, y + 34), 'Rezultate de test, nu o garanție pentru orice linie.', font=font(F_REG, 25), fill='#4D5A85')

    # call to action band
    band = H - 250
    d.rectangle([0, band, W, H], fill=BLUE)
    d.text((60, band + 46), 'Verifică-ți linia în 2 minute', font=font(F_BOLD, 50), fill='white')
    d.text((60, band + 118), 'Cinci întrebări, rezultat imediat, fără cont.', font=font(F_REG, 30), fill='#D0DEED')
    short = URL.replace('https://', '').rstrip('/')
    d.text((60, band + 160), short, font=font(F_SEMI, 28), fill='white')
    img.paste(qr(CAMPAIGN, 190), (W - 60 - 190, band + 30))
    out = ROOT / 'predare' / 'promovare-linkedin.png'
    img.save(out)

    text = f"""Câte tone ridică echipa ta de mână, într-un schimb?

La {RATE} găleți de {KG} kg pe minut, răspunsul e {TONNES} de tone în 8 ore. Pe două sau trei schimburi, în fiecare zi.

Într-o fabrică de ingrediente pentru panificație, o celulă cu robot colaborativ UR20 preia gălețile de pe transportor și le așază pe palet. La testele de recepție a atins {TESTED_13} găleți/min la 13 kg și {TESTED_5} la 5 kg, peste ținta de {RATE}. Oamenii schimbă paleții și pun separatoarele; ridicarea repetitivă o face robotul.

Se potrivește și liniei tale? Verifică în 2 minute, de pe telefon: 5 întrebări, rezultat imediat, fără cont.
👉 {CAMPAIGN}

Rezultatul îți arată cât durează un palet, câte tone se ridică pe schimb și dacă robotul ține pasul cu umplerea. Dacă vrei, un inginer Tech-Con din Dragomirești-Deal, Iași sau Timișoara îți propune o evaluare tehnică.

Rezultatele sunt de test, ale aplicației de referință, nu o garanție pentru orice fabrică.

#automatizare #industriaalimentara #robotica #UniversalRobots #paletizare
"""
    (ROOT / 'predare' / 'promovare-linkedin-text.txt').write_text(text, encoding='utf-8')
    return out


if __name__ == '__main__':
    og()
    print('og.jpg written;', post(), 'written; hook', TONNES, 't')
