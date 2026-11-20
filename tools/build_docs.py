"""Builds predare/strategie.docx and predare/jurnal-AI.docx (one A4 page each).

Numbers come from data/facts.json via facts_util.mirror (same logic as the
spreadsheet), never typed by hand.
"""
import re
import sys

from docx import Document
from docx.enum.text import WD_LINE_SPACING
from docx.oxml import OxmlElement
from docx.oxml.ns import qn
from docx.shared import Cm, Pt, RGBColor

from facts_util import OUT_DIR, load_facts, mirror

sys.stdout.reconfigure(encoding="utf-8")

F = load_facts()
FIN, FUN, REF, ASM = F["finance"], F["funnel"], F["reference"], F["assumptions"]
M = mirror(F)
YEAR = FIN["year"]
URL = F["site"]["url"]

ACCENT = RGBColor(0x12, 0x26, 0xAA)
BODY = RGBColor(0x33, 0x33, 0x33)
GREY = RGBColor(0x6B, 0x6B, 0x6B)
HEADER_TEXT = "AI-Powered Business Challenge 2026 · Echipa: [cod echipă]"


def ro(x, dec=0):
    """Romanian number format: 30.000 / 8,6."""
    s = f"{x:,.{dec}f}"
    return s.replace(",", "§").replace(".", ",").replace("§", ".")


def new_doc(size):
    doc = Document()
    sec = doc.sections[0]
    sec.page_width, sec.page_height = Cm(21), Cm(29.7)
    for side in ("left_margin", "right_margin", "top_margin", "bottom_margin"):
        setattr(sec, side, Cm(1.5))
    sec.header_distance = Cm(0.7)
    sec.footer_distance = Cm(0.7)
    st = doc.styles["Normal"]
    st.font.name = "Calibri"
    st.element.rPr.rFonts.set(qn("w:eastAsia"), "Calibri")
    st.font.size = Pt(size)
    st.font.color.rgb = BODY
    pf = st.paragraph_format
    pf.space_before, pf.space_after = Pt(0), Pt(2.5)
    pf.line_spacing_rule = WD_LINE_SPACING.SINGLE
    hp = sec.header.paragraphs[0]
    r = hp.add_run(HEADER_TEXT)
    r.font.size, r.font.color.rgb = Pt(8), GREY
    return doc


def bottom_rule(p):
    ppr = p._p.get_or_add_pPr()
    bdr = OxmlElement("w:pBdr")
    b = OxmlElement("w:bottom")
    for k, v in (("w:val", "single"), ("w:sz", "6"), ("w:space", "1"), ("w:color", "1226AA")):
        b.set(qn(k), v)
    bdr.append(b)
    ppr.append(bdr)


def title(doc, text, sub=None):
    p = doc.add_paragraph()
    r = p.add_run(text)
    r.bold, r.font.size, r.font.color.rgb = True, Pt(14), ACCENT
    if sub:
        r.add_break()
        r2 = p.add_run(sub)
        r2.font.size, r2.font.color.rgb = Pt(8.5), GREY
    p.paragraph_format.space_after = Pt(4)
    bottom_rule(p)


def runs(p, text, size=None):
    """Adds text with **bold** and _italic_ markup."""
    for part in re.split(r"(\*\*.+?\*\*|_.+?_)", text):
        if not part:
            continue
        if part.startswith("**"):
            r = p.add_run(part[2:-2])
            r.bold = True
        elif part.startswith("_") and part.endswith("_") and len(part) > 2:
            r = p.add_run(part[1:-1])
            r.italic = True
        else:
            r = p.add_run(part)
        if size:
            r.font.size = Pt(size)


def para(doc, heading, text, size=None, after=4.5):
    p = doc.add_paragraph()
    if heading:
        h = p.add_run(heading + ". ")
        h.bold, h.font.color.rgb = True, ACCENT
        if size:
            h.font.size = Pt(size)
    runs(p, text, size)
    p.paragraph_format.space_after = Pt(after)
    return p


def word_count(doc):
    """Words in the page body (the header line with the team code is not counted)."""
    text = " ".join(p.text for p in doc.paragraphs)
    return len(re.findall(r"\w+(?:[-–'.,]\w+)*", text))


# ====================================================================== strategie
tested5 = ro(REF["testedRate"]["5"], 1)
tested13 = ro(REF["testedRate"]["13"], 1)
tonnes_shift = REF["targetRate"] * 60 * ASM["shiftHours"] * 13 / 1000
SHORT = {"content": "conținut UR20", "web": "pagină + instrument", "google": "Google Search",
         "linkedin": "LinkedIn", "direct": "direct + CRM", "events": "demo/webinare", "video": "YouTube",
         "ai": "AI", "reserve": "rezervă"}
budget_line = " · ".join(f"{SHORT[b['id']]} {ro(b['eur'])}" for b in F["budget"])
hubs = [h["name"] for h in F["hubs"]]
headroom = round(M["headroomOtherCosts"], -2)

doc = new_doc(10.5)
title(doc, "Strategie: celule UR20 de paletizat găleți pentru fabricile alimentare din România",
      f"an de plan {YEAR} · sume în EUR fără TVA")

para(doc, "Problema",
     f"În fabricile alimentare medii, gălețile de 3–15 kg se paletizează manual, în 2–3 schimburi: la "
     f"{REF['targetRate']} găleți/min de 13 kg, un schimb de {ASM['shiftHours']} h înseamnă ≈{ro(tonnes_shift)} t "
     "ridicate de oameni. Posturile sunt greu de ocupat, iar directorul de producție nu află repede dacă "
     "un robot se potrivește liniei lui.")
para(doc, "Segment și decident",
     "Fabrici românești medii care umplu găleți de plastic de 3–15 kg în 2–3 schimburi. Cap de pod: "
     "ingrediente de panificație și patiserie (ca aplicația de referință); apoi lactate, sosuri, creme "
     "tartinabile. Folosește instrumentul: **directorul de producție**; aprobă: **directorul general / "
     "responsabilul de investiții**.")
para(doc, "Soluția",
     "Celula UR20 de paletizare integrată de Tech-Con. "
     f"**Fapte** (aplicația de referință PURATOS, paletizare UR20): {REF['cellsInstalled']} celule, găleți de 5 "
     f"și 13 kg, {REF['perPallet']['5']} / {REF['perPallet']['13']} pe palet, țintă ≥{REF['targetRate']} găleți/min, "
     f"testat {tested5} (5 kg) și {tested13} (13 kg) găleți/min; schimbul paleților și separatoarele rămân manuale; "
     f"livrare ≈{REF['deliveryMonths']} luni. _Rezultatele de test sunt ale aplicației de referință, nu o garanție._ "
     "Funcția web: **Verificare de compatibilitate UR20** pe telefon – 5 întrebări → verdict (compatibil / "
     "posibil cu evaluare tehnică / în afara domeniului testat), minute pe palet, paleți și tone pe schimb, dacă "
     f"robotul limitează linia, hub-ul cel mai apropiat → cerere de evaluare tehnică. {URL}")
para(doc, f"Atragerea clienților ({ro(M['budget'])} EUR)",
     f"{budget_line}. Mesaj: „Aflați în 2 minute dacă linia dvs. de găleți poate fi paletizată de un UR20.” "
     "Îndemn: **„Verifică-ți linia”** → **cerere relevantă** (firmă din segment + nevoie posibilă + "
     "datele liniei) → evaluare tehnică / demonstrație la cel mai apropiat hub. **„Trimite-ne o găleată”**: "
     "hub-ul filmează testul de prindere cu găleata clientului (propunere de confirmat cu Tech-Con). ≈70% din "
     "media plătită în ian–iun; canalul cu cost/cerere relevantă > 2× ținta după 20% din bugetul lui pierde "
     "jumătate în favoarea celui mai bun.")
para(doc, "Scalare națională",
     f"Start în București–Ilfov și Muntenia, din {hubs[0]}; {hubs[2]} acoperă Timiș, Arad, Bihor, Hunedoara, "
     f"Cluj; {hubs[1]} acoperă Moldova; restul țării, la distanță prin instrument și webinare.")
para(doc, "Cifrele",
     f"Contribuție {ro(M['contribution'])} EUR/celulă. Pentru {ro(FIN['targetNetProfit'])} EUR profit net: "
     f"**{M['cellsBeforeTax']} celule** înainte de impozit, **{M['cellsAfterTax']} celule** "
     f"după impozitul de {round(FIN['taxRate'] * 100)}% (ipoteză). Planificăm **{FIN['plannedCells']} celule** – "
     f"rezervă comercială care absoarbe ≈{ro(headroom)} EUR alte costuri; profit net la {FIN['plannedCells']} "
     f"celule, fără alte costuri: {ro(M['net'])} EUR. Pâlnia, calculată invers: **{M['requests']} cereri "
     f"relevante** → {M['meetings']} întâlniri tehnice → {M['offers']} oferte → {M['clients']} clienți → "
     f"{FIN['plannedCells']} celule; cost/cerere relevantă ≈{ro(M['costPerRequest'])} EUR, cost/client câștigat "
     f"≈{ro(M['costPerClient'])} EUR. Ultima comandă livrabilă în {YEAR}: final de august.")
para(doc, "De ce un instrument, nu o pagină",
     "Pe telefon, lângă linie; rezultat în 2 minute, înainte de date de contact; cererea conține deja "
     "datele liniei, deci evaluarea tehnică pornește direct; se instalează pe telefon.")
para(doc, "Trei pași",
     "**1.** Ianuarie: lansarea instrumentului și a campaniei Google/LinkedIn. **2.** T1–T2: demonstrații și "
     "evaluări tehnice la hub-uri. **3.** Lunar: realocare după cost/cerere relevantă; oprirea comenzilor noi "
     f"pentru {YEAR} la final de august.")
p = para(doc, None,
         "Fapte: aplicația de referință și datele organizatorilor. Ipoteze ale echipei (editabile în "
         f"model-financiar.xlsx): ratele pâlniei, {ro(FUN['cellsPerClient'], 1)} celule/client, impozit "
         f"{round(FIN['taxRate'] * 100)}%, alte costuri 0.", size=8.5)
for r in p.runs:
    r.italic, r.font.color.rgb = True, GREY

OUT_DIR.mkdir(exist_ok=True)
out_s = OUT_DIR / "strategie.docx"
doc.save(out_s)
wc_s = word_count(doc)

# ====================================================================== jurnal AI
doc = new_doc(10)
title(doc, "Jurnal AI", "trei prompturi reale, rezultatul, decizia echipei și verificarea")
para(doc, "Instrumente",
     "Claude (Anthropic) în Claude Code – analiză, cercetare web, cod (React, Three.js), calcule, texte; "
     "Python (openpyxl, python-docx) pentru documente.", after=4)

PROMPTS = [
    ("Prompt 1 – planul proiectului",
     "I want you to brainstorm a comprehensive plan for this task, take into account everything stated in the pdf "
     "attatched. Apart from the standard workflow, think about niche elements to include in the project in order "
     "to stand out",
     "plan complet: segment, verificare de compatibilitate, praguri financiare, limita de livrare din august, "
     "Regulamentul UE 2023/1230 privind mașinile (aplicabil din 20.01.2027).",
     "am folosit planul ca structură; segmentul și funcția le-am ales noi.",
     "limita cumulată de ridicare manuală „10 t / 8 h (ISO 11228-1)” propusă de AI nu s-a confirmat în "
     "sursele publice ale standardului → eliminată. Impozitul de 16% e confirmat doar pentru 2026 "
     "(KPMG tax card) → ipoteză editabilă. Calculul naiv „300.000 / 20.000 = 15 celule” ignoră "
     f"promovarea și impozitul → corectat la {M['cellsBeforeTax']} (după promovare) și {M['cellsAfterTax']} "
     f"(după impozit {round(FIN['taxRate'] * 100)}%), verificat cu teste automate în codul aplicației."),
    ("Prompt 2 – infrastructura existentă",
     "check wether the company uses SAP so we know if we could propose a connection there, or anything that we "
     "can already connect to their existing infrastructure",
     "site-ul Tech-Con are Google Tag Manager, tag LinkedIn și un script Microsoft Dynamics 365 marketing, "
     "fără SAP; clientul de referință folosește SAP (anunțuri de angajare); UR20 comunică nativ "
     f"{', '.join(F['robot']['nativeNetworks'])}.",
     "niciun CRM nou în buget; instrumentul exportă cererile pentru CRM-ul existent; SAP doar ca opțiune "
     "ulterioară, în afara modelului.",
     "AI-ul afirmase „suntem echipa Tech-Con”. Am întrebat: _„where does it say in the pdf with the requirements "
     "that we are tech-con's team?”_ – AI-ul a recunoscut că era o deducție, nu un text din temă → formulare "
     "neutră în toate livrabilele."),
    ("Prompt 3 – designul instrumentului",
     "make sure to check more sources, not only robotiq since that isn't necessarily the best example to follow, "
     "I want you to see which performs best, even if it's another domain, a similar configurator with the best "
     "metrics.",
     "după corectură: meta-analiză a 32 de experimente despre bare de progres, benchmark Zuko, teste A/B "
     "(formular împărțit +53%, chestionar ca prim ecran +34%), studiul HBR despre timpul de răspuns.",
     "prima întrebare pe primul ecran; bară de progres rapidă la început, apoi mai lentă; rezultatul "
     "înainte de orice date de contact; formular de contact în doi pași, telefon opțional.",
     "eroare: AI-ul ancorase designul pe un singur concurent (Robotiq IQ Fit Check, care începe cu ROI – "
     "exclus de temă) → înlocuit cu dovezile de mai sus."),
]
for head, prompt, result, decision, check in PROMPTS:
    p = doc.add_paragraph()
    h = p.add_run(head)
    h.bold, h.font.color.rgb, h.font.size = True, ACCENT, Pt(10)
    p.paragraph_format.space_before = Pt(3)
    p.paragraph_format.space_after = Pt(1)
    p.paragraph_format.keep_with_next = True
    q = doc.add_paragraph()
    rq = q.add_run(f"„{prompt}”")
    rq.italic = True
    q.paragraph_format.left_indent = Cm(0.4)
    q.paragraph_format.space_after = Pt(1.5)
    for label, txt in (("Rezultatul AI relevant: ", result), ("Decizia echipei: ", decision),
                       ("Verificare / corectură: ", check)):
        b = doc.add_paragraph()
        b.paragraph_format.left_indent = Cm(0.4)
        b.paragraph_format.space_after = Pt(1)
        rl = b.add_run(label)
        rl.bold = True
        runs(b, txt)

p = para(doc, "Ce a decis echipa, nu AI-ul",
         "segmentul (fabrici alimentare medii cu găleți de 3–15 kg, cap de pod: ingrediente de panificație), "
         f"împărțirea celor {ro(M['budget'])} EUR pe canale și refuzul oricăror afirmații despre ROI sau economii "
         "salariale pentru client (în afara temei).", after=0)
p.paragraph_format.space_before = Pt(5)

out_j = OUT_DIR / "jurnal-AI.docx"
doc.save(out_j)
wc_j = word_count(doc)

print(f"Salvat: {out_s}  ({wc_s} cuvinte)")
print(f"Salvat: {out_j}  ({wc_j} cuvinte)")
assert wc_s <= 520, f"strategie prea lungă: {wc_s}"
assert wc_j <= 480, f"jurnal prea lung: {wc_j}"
