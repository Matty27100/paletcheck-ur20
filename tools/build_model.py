"""Builds predare/model-financiar.xlsx with live Excel formulas.

All numbers come from data/facts.json. Team estimates that are not in the facts
(channel split of requests, monthly weights, signing calendar) are written as
blue input cells so judges can change them.
"""
import sys

from openpyxl import Workbook
from openpyxl.formatting.rule import CellIsRule
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
from openpyxl.workbook.defined_name import DefinedName
from openpyxl.worksheet.datavalidation import DataValidation

from facts_util import OUT_DIR, budget_eur, load_facts, mirror, split_integer

sys.stdout.reconfigure(encoding="utf-8")

F = load_facts()
FIN, FUN, REF = F["finance"], F["funnel"], F["reference"]
YEAR = FIN["year"]

# ---------------------------------------------------------------- styles
BLUE = "1226AA"
F_TITLE = Font(name="Calibri", size=14, bold=True, color=BLUE)
F_LEGEND = Font(name="Calibri", size=9, italic=True, color="595959")
F_HEAD = Font(name="Calibri", size=10, bold=True, color="FFFFFF")
F_SECTION = Font(name="Calibri", size=11, bold=True, color=BLUE)
F_BODY = Font(name="Calibri", size=10, color="000000")
F_BOLD = Font(name="Calibri", size=10, bold=True, color="000000")
F_INPUT = Font(name="Calibri", size=10, color="0000FF")
F_NOTE = Font(name="Calibri", size=9, italic=True, color="595959")
FILL_HEAD = PatternFill("solid", fgColor=BLUE)
FILL_INPUT = PatternFill("solid", fgColor="FFF9DB")
FILL_SECTION = PatternFill("solid", fgColor="E8EBF8")
FILL_TOTAL = PatternFill("solid", fgColor="F2F2F2")
FILL_OK = PatternFill("solid", fgColor="D9F2D9")
FILL_BAD = PatternFill("solid", fgColor="F8D7D7")
THIN = Side(style="thin", color="BFBFBF")
BOX = Border(left=THIN, right=THIN, top=THIN, bottom=THIN)
WRAP = Alignment(wrap_text=True, vertical="top")
CENTER = Alignment(horizontal="center", vertical="center", wrap_text=True)

EUR = "#,##0"
PCT = "0.0%"
DEC1 = "0.0"

LEGEND = (
    "Legendă: celule cu text albastru pe fond galben = date de intrare editabile · text negru = formule · "
    f"toate sumele în EUR fără TVA · perioada 1 ianuarie – 31 decembrie {YEAR} · "
    "se numără doar celulele vândute ȘI livrate în an."
)
MONTHS = ["Ian", "Feb", "Mar", "Apr", "Mai", "Iun", "Iul", "Aug", "Sep", "Oct", "Noi", "Dec"]
MONTHS_LONG = ["ianuarie", "februarie", "martie", "aprilie", "mai", "iunie", "iulie", "august",
               "septembrie", "octombrie", "noiembrie", "decembrie"]

wb = Workbook()


def add_name(name, sheet, ref):
    wb.defined_names[name] = DefinedName(name, attr_text=f"'{sheet}'!{ref}")


def header(ws, title, widths):
    ws["A1"] = title
    ws["A1"].font = F_TITLE
    ws["A2"] = LEGEND
    ws["A2"].font = F_LEGEND
    for i, w in enumerate(widths, start=1):
        ws.column_dimensions[get_column_letter(i)].width = w
    ws.sheet_view.showGridLines = False
    ws.page_setup.orientation = "landscape"
    ws.page_setup.fitToWidth = 1
    ws.page_setup.fitToHeight = 0
    ws.sheet_properties.pageSetUpPr.fitToPage = True


def cell(ws, ref, value, font=F_BODY, fmt=None, fill=None, align=None, border=True):
    c = ws[ref]
    c.value = value
    c.font = font
    if fmt:
        c.number_format = fmt
    if fill:
        c.fill = fill
    if align:
        c.alignment = align
    if border:
        c.border = BOX
    return c


def inp(ws, ref, value, fmt=EUR):
    return cell(ws, ref, value, font=F_INPUT, fmt=fmt, fill=FILL_INPUT)


def fx(ws, ref, formula, fmt=EUR, bold=False, fill=None):
    return cell(ws, ref, formula, font=F_BOLD if bold else F_BODY, fmt=fmt, fill=fill)


def text(ws, ref, value, font=F_BODY, wrap=True, border=True, fill=None):
    return cell(ws, ref, value, font=font, align=WRAP if wrap else None, border=border, fill=fill)


def head_row(ws, row, labels, start_col=1, height=30):
    for i, lab in enumerate(labels):
        c = ws.cell(row=row, column=start_col + i, value=lab)
        c.font, c.fill, c.alignment, c.border = F_HEAD, FILL_HEAD, CENTER, BOX
    ws.row_dimensions[row].height = height


def section(ws, row, label, span=4):
    for col in range(1, span + 1):
        ws.cell(row=row, column=col).fill = FILL_SECTION
    c = ws.cell(row=row, column=1, value=label)
    c.font = F_SECTION


def status_format(ws, rng):
    ws.conditional_formatting.add(rng, CellIsRule(operator="equal", formula=['"OK"'], fill=FILL_OK))
    ws.conditional_formatting.add(rng, CellIsRule(operator="notEqual", formula=['"OK"'], fill=FILL_BAD))


def fit_height(ws, row, texts_widths, base=15):
    lines = 1
    for t, w in texts_widths:
        if t:
            lines = max(lines, -(-len(str(t)) // max(1, int(w * 1.1))))
    ws.row_dimensions[row].height = max(base, 13 * lines + 2)


# ====================================================================== Ipoteze
ws = wb.active
ws.title = "Ipoteze"
header(ws, f"Ipoteze și date comune – model financiar celule UR20, anul {YEAR}", [46, 16, 14, 30, 62])
head_row(ws, 4, ["Parametru", "Valoare", "Unitate", "Tip", "Sursă / notă"])
ws.freeze_panes = "A5"

row = 5
section(ws, row, "Date comune (organizatori)", 5)
common = [
    ("Buget anual de promovare (plafon)", FIN["promoBudget"], "EUR/an", "Buget_promo",
     "Plafon pentru toate direcțiile de promovare, an calendaristic."),
    ("Preț de vânzare al unei celule", FIN["price"], "EUR/celulă", "Pret",
     "Celula UR20 integrată, instalare și instruire."),
    ("Cost direct al unei celule", FIN["directCost"], "EUR/celulă", "Cost_direct",
     "Echipamente, realizare, instalare, instruire; nu se adaugă de două ori."),
    ("Țintă profit net acționari", FIN["targetNetProfit"], "EUR/an", "Tinta_profit",
     "După toate costurile și impozitul; doar celule vândute și livrate în an."),
]
for label, val, unit, name, note in common:
    row += 1
    text(ws, f"A{row}", label, wrap=False)
    inp(ws, f"B{row}", val)
    text(ws, f"C{row}", unit, wrap=False)
    text(ws, f"D{row}", "Date comune (organizatori)", wrap=False)
    text(ws, f"E{row}", note)
    add_name(name, "Ipoteze", f"$B${row}")
row += 1
text(ws, f"A{row}", "Perioadă și monedă", wrap=False)
cell(ws, f"B{row}", f"1 ian – 31 dec {YEAR}", font=F_BODY)
text(ws, f"C{row}", "EUR fără TVA", wrap=False)
text(ws, f"D{row}", "Date comune (organizatori)", wrap=False)
text(ws, f"E{row}", "Aceeași monedă și perioadă în toate foile.")

row += 2
section(ws, row, "Ipoteze echipă (editabile)", 5)
team = [
    ("Cota impozitului pe profit", FIN["taxRate"], PCT, "%", "Cota_impozit",
     "Cota 2026, de confirmat pentru 2027 (nu este dată în temă)."),
    ("Alte costuri anuale (regie, salarii neincluse etc.)", 0, EUR, "EUR/an", "Alte_costuri",
     "Nefurnizate de organizatori – valoare implicită 0; vezi foaia „Informații necesare”."),
    ("Rată cerere relevantă → întâlnire tehnică", FUN["requestToMeeting"], PCT, "%", "Rata_cerere_intalnire",
     "De la etapa „cerere relevantă” la etapa „întâlnire tehnică / evaluare”."),
    ("Rată întâlnire tehnică → ofertă", FUN["meetingToOffer"], PCT, "%", "Rata_intalnire_oferta",
     "De la etapa „întâlnire tehnică” la etapa „ofertă trimisă”."),
    ("Rată ofertă → comandă", FUN["offerToOrder"], PCT, "%", "Rata_oferta_comanda",
     "De la etapa „ofertă trimisă” la etapa „comandă semnată (client câștigat)”."),
    ("Celule per client", FUN["cellsPerClient"], DEC1, "celule/client", "Celule_per_client",
     f"Aplicația de referință: {REF['cellsInstalled']} celule la un client; folosim o medie prudentă."),
    ("Ultima lună de comandă livrabilă în an", FUN["lastOrderMonth"], "0", "luna (1–12)", "Luna_ultima_comanda",
     "Comenzile semnate după august nu se livrează în " + str(YEAR) + "."),
    ("Termen de livrare", REF["deliveryMonths"], "0", "luni", "Luni_livrare",
     "Fapt la aplicația de referință (≈ 4 luni), folosit ca ipoteză pentru toate celulele."),
    ("Celule planificate (vândute și livrate)", FIN["plannedCells"], "0", "celule", "Celule_planificate",
     "Rezervă comercială peste pragul după impozit (vezi foaia „Prag”)."),
]
for label, val, fmt, unit, name, note in team:
    row += 1
    text(ws, f"A{row}", label, wrap=False)
    inp(ws, f"B{row}", val, fmt)
    text(ws, f"C{row}", unit, wrap=False)
    text(ws, f"D{row}", "Ipoteză echipă", wrap=False)
    text(ws, f"E{row}", note)
    add_name(name, "Ipoteze", f"$B${row}")
    if fmt == PCT:
        dv = DataValidation(type="decimal", operator="between", formula1="0", formula2="1",
                            error="Introduceți o valoare între 0% și 100%.", showErrorMessage=True)
        ws.add_data_validation(dv)
        dv.add(f"B{row}")

row += 2
section(ws, row, "Fapte aplicația de referință (doar paletizare UR20; informativ, nu intră în calcule)", 5)
facts_rows = [
    ("Ritm țintă cerut", f"≥ {REF['targetRate']} găleți/min"),
    ("Ritm testat, găleți 5 kg", f"{REF['testedRate']['5']} găleți/min".replace(".", ",")),
    ("Ritm testat, găleți 13 kg", f"{REF['testedRate']['13']} găleți/min".replace(".", ",")),
    ("Găleți pe palet (5 kg / 13 kg)", f"{REF['perPallet']['5']} / {REF['perPallet']['13']}"),
    ("Celule instalate", f"{REF['cellsInstalled']} celule UR20"),
    ("Rămân manuale", "schimbul paleților și separatoarele"),
]
for label, val in facts_rows:
    row += 1
    text(ws, f"A{row}", label, wrap=False)
    cell(ws, f"B{row}", val)
    ws.merge_cells(f"B{row}:C{row}")
    text(ws, f"D{row}", "Fapt (aplicația de referință)", wrap=False)
    text(ws, f"E{row}", "Rezultat de test, nu o garanție pentru alte linii.")

# ====================================================================== Buget
wb.create_sheet("Buget")
ws = wb["Buget"]
header(ws, f"Bugetul de promovare {YEAR} – alocare anuală și lunară (front-loaded)",
       [4, 34, 12, 8, 58, 30, 8] + [8] * 12 + [11, 14])
cols_m = [get_column_letter(8 + i) for i in range(12)]  # H..S
head_row(ws, 4, ["Nr", "Direcție", "Sumă anuală (EUR)", "% din buget",
                 "Ce finanțează · public · unde ajunge persoana", "Metrică principală", "Profil lunar"]
         + MONTHS + ["Total lunar", "Verificare"], height=32)
ws.freeze_panes = "C5"

DETAILS = {
    "content": ("Studiu de caz UR20 (aplicația de referință), video 60–90 s cu celula în lucru, foto. "
                "Public: directori de producție. Ajunge în: pagina instrumentului, LinkedIn, e-mailuri.",
                "Vizionări complete; folosire în oferte", 2),
    "web": ("Pagină + Verificare de compatibilitate UR20 pe telefon, SEO și vizibilitate în asistenții AI, "
            "măsurare (conversii). Public: toți vizitatorii din campanii. Ajunge în: verdict + cerere de evaluare.",
            "Verificări finalizate → cereri relevante", 2),
    "google": ("Căutări cu intenție („paletizare găleți”, „robot paletizare”, „cobot paletizare”). "
               "Public: ingineri / directori de producție care caută activ. Ajunge în: verificarea de compatibilitate.",
               "Cost / cerere relevantă", 1),
    "linkedin": ("Anunțuri țintite pe funcție (director producție, director general) în industria alimentară din România. "
                 "Public: decidenți. Ajunge în: verificare + invitație la webinar.",
                 "Cost / cerere relevantă", 1),
    "direct": ("Listă de fabrici din segment, mesaje personalizate, follow-up în 24 h, export cereri în CRM-ul existent. "
               "Public: director producție. Ajunge în: verificare / programare demonstrație.",
               "Întâlniri tehnice programate", 3),
    "events": ("Demonstrații la hub-urile Dragomirești-Deal, Iași, Timișoara; webinare; parteneriate cu asociații "
               "din industria alimentară. Public: echipe tehnice + decidenți. Ajunge în: evaluare tehnică.",
               "Evaluări tehnice / demonstrații", 3),
    "video": ("Clipuri scurte YouTube + teste sociale; „Trimite-ne o găleată”: hub-ul filmează testul de prindere "
              "(propunere de confirmat cu Tech-Con). Public: ingineri. Ajunge în: verificare.",
              "Cereri relevante din video", 1),
    "ai": ("Abonamente AI declarate (analiză, cod, texte), menționate în jurnalul AI. Public: intern.",
           "— (cost declarat)", 4),
    "reserve": ("Rezervă nealocată; se mută lunar spre canalul cu cel mai mic cost / cerere relevantă "
                "(regula de oprire / scalare din foaia „Pâlnie”).",
                "Cost / cerere relevantă al canalului câștigător", 0),
}
lines = [b for b in F["budget"] if b["id"] != "reserve"]
reserve = next(b for b in F["budget"] if b["id"] == "reserve")
first = 5
last_line = first + len(lines) - 1          # rows of the 8 allocated lines
res_row = last_line + 1                     # reserve row
tot_row = res_row + 1
prof_first = tot_row + 6                    # weights table
prof_last = prof_first + 3
budget_rows = {}

for i, b in enumerate(lines + [reserve]):
    r = first + i
    budget_rows[b["id"]] = r
    what, metric, profile = DETAILS[b["id"]]
    cell(ws, f"A{r}", i + 1, align=CENTER)
    text(ws, f"B{r}", b["name"])
    inp(ws, f"C{r}", b["eur"])
    fx(ws, f"D{r}", f"=C{r}/$C${tot_row}", PCT)
    text(ws, f"E{r}", what, font=Font(name="Calibri", size=9))
    text(ws, f"F{r}", metric, font=Font(name="Calibri", size=9))
    fit_height(ws, r, [(what, 58 * 1.1), (b["name"], 34)])
    if b["id"] == "reserve":
        cell(ws, f"G{r}", "—", align=CENTER)
        for col in cols_m:
            inp(ws, f"{col}{r}", 0)
        fx(ws, f"T{r}", f"=SUM(H{r}:S{r})")
        fx(ws, f"U{r}", f'=IF(C{r}-T{r}=0,"OK","NEALOCAT")', fmt="General")
    else:
        inp(ws, f"G{r}", profile, "0")
        ws[f"G{r}"].alignment = CENTER
        for col in cols_m:
            fx(ws, f"{col}{r}", f"=$C{r}*INDEX({col}${prof_first}:{col}${prof_last},$G{r})")
        fx(ws, f"T{r}", f"=SUM(H{r}:S{r})")
        fx(ws, f"U{r}", f'=IF(ABS(T{r}-C{r})<0.5,"OK","EROARE")', fmt="General")

dv = DataValidation(type="whole", operator="between", formula1="1", formula2="4",
                    error="Profilul trebuie să fie 1, 2, 3 sau 4.", showErrorMessage=True)
ws.add_data_validation(dv)
dv.add(f"G{first}:G{last_line}")

text(ws, f"B{tot_row}", "TOTAL PROMOVARE", font=F_BOLD, fill=FILL_TOTAL)
fx(ws, f"C{tot_row}", f"=SUM(C{first}:C{res_row})", bold=True, fill=FILL_TOTAL)
fx(ws, f"D{tot_row}", f"=SUM(D{first}:D{res_row})", PCT, bold=True, fill=FILL_TOTAL)
for col in cols_m + ["T"]:
    fx(ws, f"{col}{tot_row}", f"=SUM({col}{first}:{col}{res_row})", bold=True, fill=FILL_TOTAL)
add_name("Total_promovare", "Buget", f"$C${tot_row}")

r = tot_row + 1
text(ws, f"B{r}", "Verificare: total = buget anual (Ipoteze)", font=F_BOLD)
fx(ws, f"C{r}", '=IF(C{0}=Buget_promo,"OK","EROARE")'.format(tot_row), fmt="General", bold=True)
status_format(ws, f"C{r}")
status_format(ws, f"U{first}:U{last_line}")
r += 1
text(ws, f"B{r}", "Media plătită (Google, LinkedIn, YouTube) cheltuită în ian–iun", font=F_BOLD)
paid = [budget_rows["google"], budget_rows["linkedin"], budget_rows["video"]]
num = "+".join(f"SUM(H{p}:M{p})" for p in paid)
den = "+".join(f"C{p}" for p in paid)
fx(ws, f"C{r}", f"=({num})/({den})", PCT, bold=True)
text(ws, f"E{r}", "Țintă ≈ 70%: comenzile semnate după august nu se mai livrează în an, deci cererile "
                  "trebuie generate devreme.", font=F_NOTE)
r += 1
text(ws, f"B{r}", "Buget cheltuit până la 31 august (cumulat)", font=F_BOLD)
fx(ws, f"C{r}", f"=SUM(H{tot_row}:O{tot_row})/C{tot_row}", PCT, bold=True)

# weights table
r = prof_first - 1
head_row(ws, r, ["", "Profil lunar (ponderi editabile)", "", "", "Pentru ce linii", "", "Nr profil"]
         + MONTHS + ["Total", "Verificare"], height=30)
profiles = [
    ("Media plătită – front-loaded", "Google, LinkedIn, YouTube",
     [0.14, 0.13, 0.12, 0.11, 0.10, 0.10, 0.07, 0.06, 0.05, 0.05, 0.04, 0.03]),
    ("Conținut + web – investiție la început", "Conținut, pagină + instrument",
     [0.30, 0.20, 0.10, 0.08, 0.06, 0.06, 0.04, 0.04, 0.03, 0.03, 0.03, 0.03]),
    ("Direct + demonstrații – vârf T1–T2", "Marketing direct, demonstrații/webinare",
     [0.08, 0.12, 0.14, 0.14, 0.12, 0.10, 0.06, 0.06, 0.06, 0.06, 0.04, 0.02]),
    ("Abonamente – egal lunar", "Abonamente AI", [1 / 12] * 12),
]
for k, (pname, used, weights) in enumerate(profiles):
    rr = prof_first + k
    text(ws, f"B{rr}", pname)
    text(ws, f"E{rr}", used, font=Font(name="Calibri", size=9))
    cell(ws, f"G{rr}", k + 1, align=CENTER)
    for col, w in zip(cols_m, weights):
        inp(ws, f"{col}{rr}", w, PCT)
    fx(ws, f"T{rr}", f"=SUM(H{rr}:S{rr})", PCT)
    fx(ws, f"U{rr}", f'=IF(ABS(T{rr}-1)<0.0001,"OK","EROARE")', fmt="General")
status_format(ws, f"U{prof_first}:U{prof_last}")
rr = prof_last + 1
text(ws, f"B{rr}", "Ponderile fiecărui profil trebuie să însumeze 100%. Rezerva rămâne nealocată (rândul "
                   f"{res_row}) până la realocare: se introduce suma în luna mutării, pe linia canalului câștigător "
                   "se crește suma anuală, iar pe rezervă se scade.", font=F_NOTE, border=False)
ws.merge_cells(f"B{rr}:S{rr}")
ws.row_dimensions[rr].height = 28

# ====================================================================== Pâlnie
wb.create_sheet("Pâlnie")
ws = wb["Pâlnie"]
header(ws, "Pâlnia de vânzare: de la cereri relevante la celule livrate", [44, 16, 16, 14, 16, 16, 46])
ws.freeze_panes = "A5"

r = 4
section(ws, r, "A. Necesar calculat invers din celulele planificate (ROUNDUP la fiecare etapă)", 7)
r += 1
head_row(ws, r, ["Etapa", "Număr necesar", "Rată folosită", "", "", "", "De la etapa X la etapa Y"])
steps = [
    ("Celule planificate (vândute și livrate)", "=Celule_planificate", None, "Ipoteze → celule planificate"),
    ("Clienți câștigați necesari", "=ROUNDUP(B{p}/Celule_per_client,0)", "=Celule_per_client",
     "De la etapa „client câștigat” la etapa „celule”: celule per client (nu %)"),
    ("Oferte necesare", "=ROUNDUP(B{p}/Rata_oferta_comanda,0)", "=Rata_oferta_comanda",
     "De la etapa „ofertă” la etapa „comandă / client câștigat”"),
    ("Întâlniri tehnice / evaluări necesare", "=ROUNDUP(B{p}/Rata_intalnire_oferta,0)", "=Rata_intalnire_oferta",
     "De la etapa „întâlnire tehnică” la etapa „ofertă”"),
    ("Cereri relevante necesare", "=ROUNDUP(B{p}/Rata_cerere_intalnire,0)", "=Rata_cerere_intalnire",
     "De la etapa „cerere relevantă” la etapa „întâlnire tehnică”"),
]
need = {}
for k, (label, f, rate, note) in enumerate(steps):
    r += 1
    text(ws, f"A{r}", label, font=F_BOLD if k == 4 else F_BODY, wrap=False)
    fx(ws, f"B{r}", f.format(p=r - 1), "0", bold=(k == 4))
    if rate:
        fx(ws, f"C{r}", rate, DEC1 if "Celule" in rate else PCT)
    text(ws, f"G{r}", note, font=Font(name="Calibri", size=9))
    need[k] = r
add_name("Necesar_clienti", "Pâlnie", f"$B${need[1]}")
add_name("Necesar_oferte", "Pâlnie", f"$B${need[2]}")
add_name("Necesar_intalniri", "Pâlnie", f"$B${need[3]}")
add_name("Necesar_cereri", "Pâlnie", f"$B${need[4]}")

r += 2
section(ws, r, "B. Cereri relevante estimate pe canal (estimare echipă) și cost pe canal", 7)
r += 1
head_row(ws, r, ["Canal", "Buget canal (EUR)", "Cereri relevante estimate", "Pondere cereri",
                 "Cost / cerere relevantă (canal)", "Prag oprire = 2× ținta canalului", "Ce linii de buget intră"],
         height=42)
B = budget_rows
channels = [
    ("Google Search", f"=Buget!$C${B['google']}", 0.28, "Google Search"),
    ("LinkedIn (plătit)", f"=Buget!$C${B['linkedin']}", 0.20, "LinkedIn"),
    ("Marketing direct + CRM", f"=Buget!$C${B['direct']}", 0.24, "Marketing direct și CRM"),
    ("Demonstrații / webinare / parteneriate", f"=Buget!$C${B['events']}", 0.16, "Demonstrații, webinare"),
    ("Conținut + web organic (incl. YouTube)",
     f"=Buget!$C${B['content']}+Buget!$C${B['web']}+Buget!$C${B['video']}", 0.12,
     "Conținut UR20 + pagină/instrument + YouTube (susțin și celelalte canale)"),
]
m0 = mirror(F)
estimates = split_integer(m0["requests"], [c[2] for c in channels])
ch_first = r + 1
for (label, f, _, used), est in zip(channels, estimates):
    r += 1
    text(ws, f"A{r}", label, wrap=False)
    fx(ws, f"B{r}", f)
    inp(ws, f"C{r}", est, "0")
    fx(ws, f"D{r}", f"=C{r}/$C${ch_first + len(channels)}", PCT)
    fx(ws, f"E{r}", f'=IF(C{r}=0,"—",B{r}/C{r})')
    fx(ws, f"F{r}", f'=IF(C{r}=0,"—",2*E{r})')
    text(ws, f"G{r}", used, font=Font(name="Calibri", size=9))
ch_last = r
r += 1
ch_tot = r
text(ws, f"A{r}", "Total canale", font=F_BOLD, fill=FILL_TOTAL)
fx(ws, f"B{r}", f"=SUM(B{ch_first}:B{ch_last})", bold=True, fill=FILL_TOTAL)
fx(ws, f"C{r}", f"=SUM(C{ch_first}:C{ch_last})", "0", bold=True, fill=FILL_TOTAL)
fx(ws, f"D{r}", f"=SUM(D{ch_first}:D{ch_last})", PCT, bold=True, fill=FILL_TOTAL)
fx(ws, f"E{r}", f"=B{r}/C{r}", bold=True, fill=FILL_TOTAL)
add_name("Cereri_estimate", "Pâlnie", f"$C${ch_tot}")
r += 1
text(ws, f"A{r}", "Neatribuit pe canal (abonamente AI + rezervă)", wrap=False)
fx(ws, f"B{r}", f"=Buget!$C${B['ai']}+Buget!$C${B['reserve']}")
text(ws, f"G{r}", "Rezerva se mută spre canalul cu cel mai mic cost / cerere relevantă.",
     font=Font(name="Calibri", size=9))
r += 1
text(ws, f"A{r}", "Total buget promovare", font=F_BOLD)
fx(ws, f"B{r}", f"=B{ch_tot}+B{r - 1}", bold=True)
fx(ws, f"C{r}", f'=IF(B{r}=Total_promovare,"OK","EROARE")', fmt="General")
status_format(ws, f"C{r}")
r += 1
text(ws, f"A{r}", "Verificare: cereri estimate ≥ cereri necesare", font=F_BOLD)
fx(ws, f"C{r}", f'=IF(C{ch_tot}>=Necesar_cereri,"OK","INSUFICIENT")', fmt="General", bold=True)
status_format(ws, f"C{r}")

r += 2
section(ws, r, "C. Calcul direct din cererile estimate (fără rotunjire)", 7)
r += 1
head_row(ws, r, ["Etapa", "Număr estimat", "Rată folosită", "", "", "", "De la etapa X la etapa Y"])
fwd = [
    ("Cereri relevante (total estimat)", f"=C{ch_tot}", None, "Din tabelul B; un client = o singură cerere"),
    ("Întâlniri tehnice / evaluări", "=B{p}*Rata_cerere_intalnire", "=Rata_cerere_intalnire",
     "De la etapa „cerere relevantă” la etapa „întâlnire tehnică”"),
    ("Oferte", "=B{p}*Rata_intalnire_oferta", "=Rata_intalnire_oferta",
     "De la etapa „întâlnire tehnică” la etapa „ofertă”"),
    ("Clienți câștigați", "=B{p}*Rata_oferta_comanda", "=Rata_oferta_comanda",
     "De la etapa „ofertă” la etapa „comandă / client câștigat”"),
    ("Celule comandate", "=B{p}*Celule_per_client", "=Celule_per_client",
     "De la etapa „client câștigat” la etapa „celule” (celule per client)"),
]
for k, (label, f, rate, note) in enumerate(fwd):
    r += 1
    text(ws, f"A{r}", label, wrap=False)
    fx(ws, f"B{r}", f.format(p=r - 1), DEC1)
    if rate:
        fx(ws, f"C{r}", rate, DEC1 if "Celule" in rate else PCT)
    text(ws, f"G{r}", note, font=Font(name="Calibri", size=9))

r += 2
section(ws, r, "D. Indicatori de cost (promovare)", 7)
r += 1
head_row(ws, r, ["Indicator", "EUR", "Bază de calcul", "", "", "", "Explicație"])
kpis = [
    ("Cost / cerere relevantă (tot bugetul)", "=Total_promovare/Necesar_cereri",
     "Tot bugetul de promovare ÷ cererile relevante necesare (include conținut, web, AI și rezervă)."),
    ("Cost / client câștigat", "=Total_promovare/Necesar_clienti",
     "Tot bugetul ÷ clienții câștigați necesari. Cerere, întâlnire și comandă sunt etape diferite."),
    ("Cost de promovare / celulă livrată", "=Total_promovare/Celule_planificate",
     "Tot bugetul ÷ celulele planificate (vândute și livrate)."),
    ("Cost / întâlnire tehnică", "=Total_promovare/Necesar_intalniri", "Tot bugetul ÷ întâlnirile necesare."),
]
for label, f, note in kpis:
    r += 1
    text(ws, f"A{r}", label, wrap=False, font=F_BOLD)
    fx(ws, f"B{r}", f, bold=True)
    text(ws, f"G{r}", note, font=Font(name="Calibri", size=9))
    fit_height(ws, r, [(note, 46)])
r += 2
for note in [
    "Regulă de numărare: un client venit din mai multe canale se numără o singură dată "
    "(prima cerere relevantă; canalul se notează în CRM).",
    "Regulă de oprire / scalare: un canal cu cost/cerere relevantă > 2× ținta după 20% din bugetul lui "
    "pierde jumătate din sumă în favoarea celui mai bun canal (ținta = coloana E, pragul = coloana F).",
    "Cerere relevantă = firmă din segment + nevoie posibilă de paletizare + date de linie suficiente "
    "pentru o discuție tehnică (trimise din instrumentul de verificare). Un click nu este o cerere.",
]:
    text(ws, f"A{r}", note, font=F_NOTE, border=False)
    ws.merge_cells(f"A{r}:G{r}")
    ws.row_dimensions[r].height = 26
    r += 1

# ====================================================================== Rezultat
wb.create_sheet("Rezultat")
ws = wb["Rezultat"]
header(ws, f"Rezultatul scenariului de bază {YEAR}", [58, 18, 70])
head_row(ws, 4, ["Element", "EUR", "Formulă / notă"])
ws.freeze_panes = "A5"
rows = [
    ("Celule vândute și livrate în an", "INPUT", "0", "Intrare editabilă (implicit = celulele planificate)."),
    ("Contribuție pe celulă", "=Pret-Cost_direct", EUR, "Preț − cost direct."),
    ("Venit anual", "=B5*Pret", EUR, "Celule × preț."),
    ("Cost direct anual", "=B5*Cost_direct", EUR, "Celule × cost direct."),
    ("Contribuție totală", "=B7-B8", EUR, "Venit − cost direct."),
    ("Cost total de promovare", "=Total_promovare", EUR, "Suma alocărilor din foaia „Buget” (max. 30.000)."),
    ("Rezultat după promovare (înainte de alte costuri și impozit)", "=B9-B10", EUR, "Contribuție totală − promovare."),
    ("Alte costuri anuale", "=Alte_costuri", EUR, "Din Ipoteze; nefurnizate – de cerut acționarilor."),
    ("Rezultat înainte de impozit", "=B11-B12", EUR, ""),
    ("Impozit pe profit", "=MAX(0,B13)*Cota_impozit", EUR, "Cota din Ipoteze (16%, de confirmat pentru 2027)."),
    ("PROFIT NET", "=B13-B14", EUR, ""),
    ("Țintă profit net acționari", "=Tinta_profit", EUR, ""),
    ("Diferență față de țintă", "=B15-B16", EUR, "Pozitiv = peste țintă."),
    ("Status", '=IF(B15>=B16,"OK","SUB ȚINTĂ")', "General", ""),
    ("Cost de promovare / celulă", "=B10/B5", EUR, ""),
    ("Marjă netă (profit net / venit)", "=B15/B7", PCT, ""),
]
for k, (label, f, fmt, note) in enumerate(rows):
    rr = 5 + k
    bold = label in ("PROFIT NET", "Status", "Rezultat după promovare (înainte de alte costuri și impozit)")
    text(ws, f"A{rr}", label, font=F_BOLD if bold else F_BODY, wrap=False)
    if f == "INPUT":
        inp(ws, f"B{rr}", FIN["plannedCells"], fmt)
    else:
        fx(ws, f"B{rr}", f, fmt, bold=bold, fill=FILL_TOTAL if label == "PROFIT NET" else None)
    text(ws, f"C{rr}", note, font=Font(name="Calibri", size=9))
add_name("Celule_livrate", "Rezultat", "$B$5")
add_name("Contributie", "Rezultat", "$B$6")
status_format(ws, "B18")

# ====================================================================== Prag
wb.create_sheet("Prag")
ws = wb["Prag"]
header(ws, "Pragul: câte celule livrate ating ținta de profit net", [58, 18, 18, 18, 18, 46])
head_row(ws, 4, ["Element", "Valoare", "", "", "", "Formulă / notă"])
ws.freeze_panes = "A5"
prag = [
    ("Contribuție pe celulă (EUR)", "=Contributie", EUR, "Preț − cost direct."),
    ("Necesar înainte de impozit (EUR)", "=Tinta_profit+Total_promovare+Alte_costuri", EUR,
     "Țintă + promovare + alte costuri."),
    ("Celule necesare – înainte de impozit", "=ROUNDUP(B6/B5,0)", "0", "ROUNDUP(necesar / contribuție)."),
    ("Necesar după impozit (EUR)", "=Tinta_profit/(1-Cota_impozit)+Total_promovare+Alte_costuri", EUR,
     "Țintă ÷ (1 − cota) + promovare + alte costuri."),
    ("Celule necesare – după impozit", "=ROUNDUP(B8/B5,0)", "0", "Pragul real cerut de acționari."),
    ("Celule planificate", "=Celule_planificate", "0", ""),
    ("Rezervă comercială (celule peste prag)", "=B10-B9", "0", "Planificate − necesare după impozit."),
    ("Alte costuri pe care le pot absorbi celulele planificate (EUR)",
     "=Celule_planificate*Contributie-Total_promovare-Tinta_profit/(1-Cota_impozit)", EUR,
     "Marja de siguranță: până la această sumă de alte costuri ținta netă rămâne atinsă."),
]
for k, (label, f, fmt, note) in enumerate(prag):
    rr = 5 + k
    bold = "Celule necesare" in label or "absorbi" in label
    text(ws, f"A{rr}", label, font=F_BOLD if bold else F_BODY, wrap=False)
    fx(ws, f"B{rr}", f, fmt, bold=bold)
    text(ws, f"F{rr}", note, font=Font(name="Calibri", size=9))
add_name("Celule_inainte_impozit", "Prag", "$B$7")
add_name("Celule_dupa_impozit", "Prag", "$B$9")

r = 15
section(ws, r, "Sensibilitate la alte costuri (nefurnizate de organizatori)", 6)
r += 1
head_row(ws, r, ["Alte costuri anuale (EUR) – intrare", "Celule înainte de impozit", "Celule după impozit",
                 "Profit net cu celulele planificate", "Status țintă", "Notă"], height=32)
sens_first = r + 1
for v in [0, 50000, 100000, 200000]:
    r += 1
    inp(ws, f"A{r}", v)
    fx(ws, f"B{r}", f"=ROUNDUP((Tinta_profit+Total_promovare+A{r})/Contributie,0)", "0")
    fx(ws, f"C{r}", f"=ROUNDUP((Tinta_profit/(1-Cota_impozit)+Total_promovare+A{r})/Contributie,0)", "0", bold=True)
    fx(ws, f"D{r}", f"=(Celule_planificate*Contributie-Total_promovare-A{r})"
                    f"-MAX(0,Celule_planificate*Contributie-Total_promovare-A{r})*Cota_impozit")
    fx(ws, f"E{r}", f'=IF(D{r}>=Tinta_profit,"OK","SUB ȚINTĂ")', fmt="General")
status_format(ws, f"E{sens_first}:E{r}")
r += 1
text(ws, f"A{r}", "Exemplu de lectură: dacă acționarii confirmă 100.000 EUR alte costuri, pragul după impozit urcă "
                  "la 25 de celule, iar planul de 22 nu mai ajunge.", font=F_NOTE, border=False)
ws.merge_cells(f"A{r}:F{r}")

# ====================================================================== Capacitate
wb.create_sheet("Capacitate")
ws = wb["Capacitate"]
header(ws, f"Capacitate și calendar: semnare → livrare în {YEAR}", [9, 13, 15, 16, 15, 15, 15, 16, 20])
head_row(ws, 4, ["Luna (nr)", "Luna", "Celule semnate (intrare)", "Luna livrării (>12 = anul următor)",
                 "Celule livrate în lună", "Livrate cumulat", "Semnate cumulat", "În lucru simultan",
                 "Evaluări / demonstrații necesare (cu o lună înainte)"], height=56)
ws.freeze_panes = "C5"
sign_w = [0, 1, 3, 4, 4, 4, 3, 3]  # team calendar, Jan-Aug, scaled to planned cells
signed = split_integer(FIN["plannedCells"], sign_w) + [0] * (12 - len(sign_w))
c1, c12 = 5, 16
for m in range(12):
    rr = c1 + m
    cell(ws, f"A{rr}", m + 1, align=CENTER)
    text(ws, f"B{rr}", MONTHS_LONG[m], wrap=False)
    inp(ws, f"C{rr}", signed[m], "0")
    fx(ws, f"D{rr}", f'=IF(A{rr}+Luni_livrare>12,"anul următor",A{rr}+Luni_livrare)', "0")
    ws[f"D{rr}"].alignment = CENTER
    fx(ws, f"E{rr}", f"=SUMPRODUCT(($A${c1}:$A${c12}+Luni_livrare=A{rr})*$C${c1}:$C${c12})", "0")
    fx(ws, f"F{rr}", f"=SUM($E${c1}:E{rr})", "0")
    fx(ws, f"G{rr}", f"=SUM($C${c1}:C{rr})", "0")
    fx(ws, f"H{rr}", f"=G{rr}-F{rr}", "0")
    fx(ws, f"I{rr}", f"=IF(SUM($C${c1}:$C${c12})=0,0,Necesar_intalniri*"
                     f"SUMPRODUCT(($A${c1}:$A${c12}=A{rr}+1)*$C${c1}:$C${c12})/SUM($C${c1}:$C${c12}))", DEC1)
    if m + 1 > FUN["lastOrderMonth"]:
        for col in "ABCDEFGHI":
            ws[f"{col}{rr}"].font = Font(name="Calibri", size=10, color="7F7F7F") if col != "C" else F_INPUT
rr = c12 + 1
text(ws, f"B{rr}", "Total", font=F_BOLD, fill=FILL_TOTAL)
fx(ws, f"C{rr}", f"=SUM(C{c1}:C{c12})", "0", bold=True, fill=FILL_TOTAL)
fx(ws, f"E{rr}", f"=SUM(E{c1}:E{c12})", "0", bold=True, fill=FILL_TOTAL)
fx(ws, f"I{rr}", f"=SUM(I{c1}:I{c12})", DEC1, bold=True, fill=FILL_TOTAL)

rr += 2
summary = [
    (f"Celule livrate până la 31 decembrie {YEAR}", f"=F{c12}", "0"),
    ("Celule necesare după impozit (Prag)", "=Celule_dupa_impozit", "0"),
    ("Status livrări vs prag", f'=IF(F{c12}>=Celule_dupa_impozit,"OK","SUB PRAG")', "General"),
    ("Celule semnate = celule planificate?", f'=IF(C{c12 + 1}=Celule_planificate,"OK","DIFERENȚĂ")', "General"),
    ("Celule semnate după ultima lună livrabilă (nu intră în an)",
     f"=SUMPRODUCT(($A${c1}:$A${c12}>Luna_ultima_comanda)*$C${c1}:$C${c12})", "0"),
    ("Maximum celule în lucru simultan (proiectare, montaj, punere în funcțiune)", f"=MAX(H{c1}:H{c12})", "0"),
    ("Maximum evaluări / demonstrații într-o lună", f"=MAX(I{c1}:I{c12})", DEC1),
    ("Evaluări / demonstrații pe hub (3 hub-uri), luna de vârf", f"=MAX(I{c1}:I{c12})/3", DEC1),
]
stat_cells = []
for label, f, fmt in summary:
    text(ws, f"A{rr}", label, font=F_BOLD, wrap=False)
    ws.merge_cells(f"A{rr}:F{rr}")
    fx(ws, f"G{rr}", f, fmt, bold=True)
    if fmt == "General":
        stat_cells.append(f"G{rr}")
    rr += 1
for sc in stat_cells:
    status_format(ws, sc)
rr += 1
for note in [
    f"Comenzile după august nu se livrează în {YEAR} (livrare ≈ {REF['deliveryMonths']} luni, fapt la aplicația "
    "de referință). Ele contează pentru anul următor.",
    "Evaluările necesare = întâlnirile tehnice din foaia „Pâlnie”, repartizate proporțional cu celulele semnate "
    "în luna următoare. Se susțin la hub-urile Tech-Con (Dragomirești-Deal, Iași, Timișoara) sau la client.",
    "Calendarul semnărilor este o estimare a echipei: zero în ianuarie (campania abia pornește), "
    "majoritatea în februarie–iunie.",
]:
    text(ws, f"A{rr}", note, font=F_NOTE, border=False)
    ws.merge_cells(f"A{rr}:I{rr}")
    ws.row_dimensions[rr].height = 26
    rr += 1

# ====================================================================== Scenarii
wb.create_sheet("Scenarii")
ws = wb["Scenarii"]
header(ws, "Scenarii: pesimist / de bază / optimist", [52, 16, 16, 16, 50])
head_row(ws, 4, ["Element", "Pesimist", "De bază", "Optimist", "Notă"])
ws.freeze_panes = "B5"
scen = [
    ("Celule vândute și livrate", ("IN", 16), ("FX", "=Celule_planificate"), ("IN", 26), "0",
     "Baza = celulele planificate; pesimist / optimist = intrări."),
    ("Multiplicator rate pâlnie", ("IN", 0.9), ("IN", 1.0), ("IN", 1.1), PCT, "Se aplică fiecărei rate de conversie."),
    ("Rată cerere → întâlnire", "=MIN(1,Rata_cerere_intalnire*{c}6)", None, None, PCT, "De la etapa cerere la întâlnire."),
    ("Rată întâlnire → ofertă", "=MIN(1,Rata_intalnire_oferta*{c}6)", None, None, PCT, "De la etapa întâlnire la ofertă."),
    ("Rată ofertă → comandă", "=MIN(1,Rata_oferta_comanda*{c}6)", None, None, PCT, "De la etapa ofertă la comandă."),
    ("Clienți necesari", "=ROUNDUP({c}5/Celule_per_client,0)", None, None, "0", ""),
    ("Oferte necesare", "=ROUNDUP({c}10/{c}9,0)", None, None, "0", ""),
    ("Întâlniri tehnice necesare", "=ROUNDUP({c}11/{c}8,0)", None, None, "0", ""),
    ("Cereri relevante necesare", "=ROUNDUP({c}12/{c}7,0)", None, None, "0", ""),
    ("Cost / cerere relevantă (tot bugetul)", "=Total_promovare/{c}13", None, None, EUR, ""),
    ("Venit anual", "={c}5*Pret", None, None, EUR, ""),
    ("Rezultat după promovare", "={c}5*Contributie-Total_promovare", None, None, EUR, "Înainte de alte costuri și impozit."),
    ("Rezultat înainte de impozit", "={c}16-Alte_costuri", None, None, EUR, ""),
    ("Impozit pe profit", "=MAX(0,{c}17)*Cota_impozit", None, None, EUR, ""),
    ("PROFIT NET", "={c}17-{c}18", None, None, EUR, ""),
    ("Diferență față de țintă", "={c}19-Tinta_profit", None, None, EUR, ""),
    ("Status", '=IF({c}19>=Tinta_profit,"OK","SUB ȚINTĂ")', None, None, "General", ""),
]
for k, row_def in enumerate(scen):
    rr = 5 + k
    label, a, b_, c_, fmt, note = row_def
    bold = label in ("PROFIT NET", "Status", "Cereri relevante necesare")
    text(ws, f"A{rr}", label, font=F_BOLD if bold else F_BODY, wrap=False)
    if isinstance(a, tuple):
        for col, spec in zip("BCD", (a, b_, c_)):
            if spec[0] == "IN":
                inp(ws, f"{col}{rr}", spec[1], fmt)
            else:
                fx(ws, f"{col}{rr}", spec[1], fmt)
    else:
        for col in "BCD":
            fx(ws, f"{col}{rr}", a.format(c=col), fmt, bold=bold,
               fill=FILL_TOTAL if label == "PROFIT NET" else None)
    text(ws, f"E{rr}", note, font=Font(name="Calibri", size=9))
status_format(ws, "B21:D21")
text(ws, "A23", "Toate scenariile folosesc același buget (30.000 EUR), aceleași alte costuri și aceeași cotă de "
                "impozit din Ipoteze.", font=F_NOTE, border=False)
ws.merge_cells("A23:E23")

# ====================================================================== Informații necesare
wb.create_sheet("Informații necesare")
ws = wb["Informații necesare"]
header(ws, "Informații financiare suplimentare necesare de la acționari", [5, 42, 62, 34])
head_row(ws, 4, ["Nr", "Informație", "De ce contează pentru profitul net", "Unde intră în model"])
ws.freeze_panes = "A5"
info = [
    ("Costuri generale (regie) alocate liniei UR20", "Chirii, administrație, IT, management – nu sunt în costul direct.",
     "Ipoteze → Alte costuri"),
    ("Salarii neincluse în costul direct", "Vânzări, ingineri de aplicații pentru demonstrații și evaluări, "
     "suport – timp consumat înainte de comandă.", "Ipoteze → Alte costuri"),
    ("Provizioane pentru garanție și service", "Intervenții în garanție, piese, deplasări la clienți "
     "din afara zonelor hub-urilor.", "Ipoteze → Alte costuri"),
    ("Termene de plată și capital de lucru", "Avans / tranșe la comandă, livrare, recepție; finanțarea "
     "echipamentelor cumpărate înainte de încasare.", "Informativ (flux de numerar, nu profit)"),
    ("Expunere valutară", "Prețul și costul sunt în EUR; o parte din costuri (manoperă, instalare) pot fi în RON.",
     "Ipoteze → Cost direct / Alte costuri"),
    (f"Cota impozitului pe profit în {YEAR}", "Modelul folosește 16% (cota 2026), de confirmat.",
     "Ipoteze → Cota impozitului"),
    (f"Comenzi în portofoliu la 1 ianuarie {YEAR}", "Comenzile semnate în 2026 și livrate în 2027 reduc numărul "
     "de celule de vândut prin campanie.", "Capacitate → celule semnate (adăugare)"),
    ("Capacitate de livrare și instalare simultană", "Câte celule pot fi realizate și puse în funcțiune în "
     "paralel fără întârzieri.", "Capacitate → în lucru simultan"),
]
for k, (a, b_, c_) in enumerate(info):
    rr = 5 + k
    cell(ws, f"A{rr}", k + 1, align=CENTER)
    text(ws, f"B{rr}", a, font=F_BOLD)
    text(ws, f"C{rr}", b_)
    text(ws, f"D{rr}", c_, font=Font(name="Calibri", size=9))
    fit_height(ws, rr, [(b_, 62), (a, 42)])

# ---------------------------------------------------------------- save
OUT_DIR.mkdir(exist_ok=True)
out = OUT_DIR / "model-financiar.xlsx"
wb.save(out)
print(f"Salvat: {out}")

# ================================================================ self-check
D = F["derived"]
checks = []


def cmp(label, mine, ref):
    ok = abs(mine - ref) < 1e-6
    checks.append(ok)
    print(f"  {'OK ' if ok else 'ERR'} {label:<38} python={mine:>14,.2f}  facts.derived={ref:>14,.2f}")


print("\nVerificare oglindă Python vs facts.json → derived:")
cmp("contribuție pe celulă", m0["contribution"], D["contributionPerCell"])
cmp("celule înainte de impozit", m0["cellsBeforeTax"], D["cellsBeforeTax"])
cmp("celule după impozit", m0["cellsAfterTax"], D["cellsAfterTax"])
for key in ("at17", "at20", "at22"):
    ref = D[key]
    mm = mirror(F, cells=ref["cells"])
    for fld in ("revenue", "directCost", "resultAfterPromo", "net", "promoPerCell", "headroomOtherCosts"):
        cmp(f"{key}.{fld}", mm[fld], ref[fld])
sens = {v: mirror(F, other_costs=v)["cellsAfterTax"] for v in (0, 50000, 100000, 200000)}
print("  Sensibilitate (alte costuri → celule după impozit):", sens)
assert sens == {0: 20, 50000: 22, 100000: 25, 200000: 30}, sens
assert mirror(F, other_costs=0)["cellsBeforeTax"] == 17
assert m0["budget"] == FIN["promoBudget"], "bugetul pe linii nu însumează plafonul"
assert sum(estimates) == m0["requests"]
assert sum(signed) == FIN["plannedCells"]
assert all(checks), "nepotrivire cu facts.json"
print("\nPâlnie (calcul invers, ROUNDUP):",
      f"{m0['cells']} celule → {m0['clients']} clienți → {m0['offers']} oferte → "
      f"{m0['meetings']} întâlniri → {m0['requests']} cereri relevante")
print(f"Cereri pe canal (estimare): {dict(zip([c[0] for c in channels], estimates))}")
print(f"Cost/cerere relevantă: {m0['costPerRequest']:,.1f} EUR · cost/client: {m0['costPerClient']:,.1f} EUR · "
      f"promovare/celulă: {m0['promoPerCell']:,.1f} EUR")
for name, c, mult in (("pesimist", 16, 0.9), ("bază", FIN["plannedCells"], 1.0), ("optimist", 26, 1.1)):
    s = mirror(F, cells=c, rate_mult=mult)
    print(f"Scenariu {name}: {c} celule, cereri necesare {s['requests']}, profit net {s['net']:,.0f} EUR")
print("Calendar semnări ian–dec:", signed)
print("Toate verificările au trecut.")
