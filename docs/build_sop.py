"""Build the Safety Knife Checkout System SOP as a PDF.

Run:  python3 docs/build_sop.py
Output: docs/Safety-Knife-Checkout-SOP.pdf
"""

from pathlib import Path

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import letter
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import inch
from reportlab.platypus import (
    BaseDocTemplate,
    Image,
    Frame,
    KeepTogether,
    ListFlowable,
    ListItem,
    PageBreak,
    PageTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
)

OUT = Path(__file__).resolve().parent / "Safety-Knife-Checkout-SOP.pdf"

# Palette roughly matching the app.
NAVY = colors.HexColor("#0f172a")
SLATE = colors.HexColor("#475569")
LIGHT = colors.HexColor("#f1f5f9")
BORDER = colors.HexColor("#cbd5e1")
BLUE = colors.HexColor("#2563eb")
GREEN = colors.HexColor("#059669")
AMBER = colors.HexColor("#b45309")
RED = colors.HexColor("#b91c1c")

styles = getSampleStyleSheet()
S = {
    "title": ParagraphStyle(
        "title", parent=styles["Title"], fontSize=26, leading=30, textColor=NAVY,
        spaceAfter=6,
    ),
    "subtitle": ParagraphStyle(
        "subtitle", parent=styles["Normal"], fontSize=12.5, leading=17,
        textColor=SLATE, alignment=TA_CENTER, spaceAfter=18,
    ),
    "h1": ParagraphStyle(
        "h1", parent=styles["Heading1"], fontSize=16, leading=20, textColor=NAVY,
        spaceBefore=18, spaceAfter=8,
    ),
    "h2": ParagraphStyle(
        "h2", parent=styles["Heading2"], fontSize=12.5, leading=16, textColor=BLUE,
        spaceBefore=12, spaceAfter=5,
    ),
    "body": ParagraphStyle(
        "body", parent=styles["BodyText"], fontSize=10, leading=14.5, spaceAfter=7,
    ),
    "small": ParagraphStyle(
        "small", parent=styles["BodyText"], fontSize=8.7, leading=12, textColor=SLATE,
    ),
    "cell": ParagraphStyle("cell", parent=styles["BodyText"], fontSize=9, leading=12.5,
                           spaceAfter=0),
    "cellb": ParagraphStyle("cellb", parent=styles["BodyText"], fontSize=9, leading=12.5,
                            spaceAfter=0, fontName="Helvetica-Bold"),
    "cellh": ParagraphStyle("cellh", parent=styles["BodyText"], fontSize=9, leading=12.5,
                            spaceAfter=0, fontName="Helvetica-Bold",
                            textColor=colors.white),
    "caption": ParagraphStyle("caption", parent=styles["BodyText"], fontSize=8.5,
                              leading=11.5, textColor=SLATE, spaceAfter=0),
    "callout": ParagraphStyle("callout", parent=styles["BodyText"], fontSize=9.5,
                              leading=13.5, spaceAfter=0),
}


def P(text, style="body"):
    return Paragraph(text, S[style])


IMG = Path(__file__).resolve().parent / "img"


def figure(name, caption, max_w=None, max_h=3.9 * inch):
    """A screenshot scaled to fit, with a caption, kept on one page."""
    from reportlab.lib.utils import ImageReader
    path = IMG / f"{name}.png"
    iw, ih = ImageReader(str(path)).getSize()
    max_w = max_w or 6.2 * inch
    scale = min(max_w / iw, max_h / ih)
    img = Image(str(path), width=iw * scale, height=ih * scale)
    img.hAlign = "LEFT"
    cap = Paragraph(f"<i>{caption}</i>", S["caption"])
    box = Table([[img], [cap]], colWidths=[iw * scale], hAlign="LEFT")
    box.setStyle(TableStyle([
        ("BOX", (0, 0), (0, 0), 0.75, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
        ("TOPPADDING", (0, 0), (0, 0), 0),
        ("BOTTOMPADDING", (0, 0), (0, 0), 0),
        ("TOPPADDING", (0, 1), (0, 1), 4),
        ("BOTTOMPADDING", (0, 1), (0, 1), 2),
    ]))
    return KeepTogether([box, Spacer(1, 10)])


def figure_row(items, each_w=2.85 * inch, max_h=3.5 * inch):
    """Two screenshots side by side, each with its own caption."""
    from reportlab.lib.utils import ImageReader
    cells = []
    for name, caption in items:
        path = IMG / f"{name}.png"
        iw, ih = ImageReader(str(path)).getSize()
        scale = min(each_w / iw, max_h / ih)
        img = Image(str(path), width=iw * scale, height=ih * scale)
        img.hAlign = "LEFT"
        inner = Table([[img], [Paragraph(f"<i>{caption}</i>", S["caption"])]],
                      colWidths=[iw * scale], hAlign="LEFT")
        inner.setStyle(TableStyle([
            ("BOX", (0, 0), (0, 0), 0.75, BORDER),
            ("LEFTPADDING", (0, 0), (-1, -1), 0),
            ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ("TOPPADDING", (0, 0), (0, 0), 0),
            ("BOTTOMPADDING", (0, 0), (0, 0), 0),
            ("TOPPADDING", (0, 1), (0, 1), 4),
        ]))
        cells.append(inner)
    row = Table([cells], colWidths=[each_w + 12] * len(cells), hAlign="LEFT")
    row.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (0, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 10),
        ("TOPPADDING", (0, 0), (-1, -1), 0),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 0),
    ]))
    return KeepTogether([row, Spacer(1, 10)])


def section(heading, *flowables):
    """An h1 glued to its opening content so it can't be orphaned."""
    return KeepTogether([P(heading, "h1"), *flowables])


def bullets(items, style="body"):
    return ListFlowable(
        [ListItem(Paragraph(i, S[style]), leftIndent=12) for i in items],
        bulletType="bullet", bulletFontSize=7, leftIndent=14, bulletOffsetY=1,
    )


def steps(items):
    return ListFlowable(
        [ListItem(Paragraph(i, S["body"]), leftIndent=14) for i in items],
        bulletType="1", leftIndent=18,
    )


def table(rows, widths, header=True, zebra=True):
    """rows[0] is the header row when header=True. Cells are strings."""
    data = []
    for r_i, row in enumerate(rows):
        style = "cellh" if (header and r_i == 0) else "cell"
        data.append([Paragraph(str(c), S[style]) for c in row])
    t = Table(data, colWidths=widths, repeatRows=1 if header else 0, hAlign="LEFT")
    cmds = [
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("GRID", (0, 0), (-1, -1), 0.5, BORDER),
        ("LEFTPADDING", (0, 0), (-1, -1), 6),
        ("RIGHTPADDING", (0, 0), (-1, -1), 6),
        ("TOPPADDING", (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
    ]
    if header:
        cmds += [("BACKGROUND", (0, 0), (-1, 0), NAVY),
                 ("TEXTCOLOR", (0, 0), (-1, 0), colors.white)]
        if zebra:
            for i in range(2, len(rows), 2):
                cmds.append(("BACKGROUND", (0, i), (-1, i), LIGHT))
    t.setStyle(TableStyle(cmds))
    return t


def callout(title, text, color=AMBER):
    inner = [Paragraph(f"<b>{title}</b>", S["callout"]),
             Paragraph(text, S["callout"])]
    t = Table([[inner]], colWidths=[6.6 * inch], hAlign="LEFT")
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#fffbeb") if color is AMBER
         else colors.HexColor("#eff6ff")),
        ("LINEBEFORE", (0, 0), (0, -1), 3, color),
        ("LEFTPADDING", (0, 0), (-1, -1), 9),
        ("RIGHTPADDING", (0, 0), (-1, -1), 9),
        ("TOPPADDING", (0, 0), (-1, -1), 7),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    return t


def on_page(canvas, doc):
    canvas.saveState()
    # Header rule
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(0.9 * inch, 10.35 * inch, 7.6 * inch, 10.35 * inch)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(SLATE)
    canvas.drawString(0.9 * inch, 10.45 * inch, "Safety Knife Checkout System — Standard Operating Procedure")
    # Footer
    canvas.line(0.9 * inch, 0.72 * inch, 7.6 * inch, 0.72 * inch)
    canvas.drawString(0.9 * inch, 0.55 * inch, "Food-safety knife tracking — every action is logged for audit")
    canvas.drawRightString(7.6 * inch, 0.55 * inch, f"Page {doc.page}")
    canvas.restoreState()


def build():
    doc = BaseDocTemplate(
        str(OUT), pagesize=letter,
        leftMargin=0.9 * inch, rightMargin=0.9 * inch,
        topMargin=0.95 * inch, bottomMargin=0.9 * inch,
        title="Safety Knife Checkout System — SOP",
        author="Production Knife Dashboard",
        subject="Standard Operating Procedure and Admin Settings Reference",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="body")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=on_page)])

    s = []  # story
    W = doc.width

    # ---------------- Cover ----------------
    s.append(Spacer(1, 1.1 * inch))
    s.append(P("Safety Knife Checkout System", "title"))
    s.append(P("Standard Operating Procedure<br/>Procedimiento Operativo Estándar", "subtitle"))
    s.append(Spacer(1, 0.15 * inch))
    s.append(table(
        [["Scope", "Checking out, returning, cleaning, and inspecting numbered "
                   "food-production safety knives."],
         ["Applies to", "Operators, Sanitation, QA, Managers, and Admins."],
         ["Everyday use", "The <b>kiosk</b> on the shared iPad (landscape). No sign-in required."],
         ["Management", "Fleet board, Reports, and Admin panel — <b>admins, QA, and managers</b>."],
         ["Records", "Every action writes an immutable audit entry (who, what, when)."]],
        [1.25 * inch, W - 1.25 * inch], header=False, zebra=False))
    s.append(Spacer(1, 0.3 * inch))
    s.append(callout(
        "Why this matters",
        "A knife must never go back into food production without being cleaned and "
        "inspected. The system enforces that order — it is impossible to check out a "
        "knife that has not been cleaned and passed inspection.", BLUE))
    s.append(Spacer(1, 0.22 * inch))
    s.append(figure("kiosk-board",
                    "The kiosk on the shared iPad — what the floor sees all day.",
                    max_w=6.6 * inch, max_h=3.1 * inch))

    s.append(PageBreak())

    # ---------------- Contents ----------------
    s.append(P("Contents", "h1"))
    s.append(table(
        [["1", "The knife lifecycle at a glance"],
         ["2", "Roles and PINs"],
         ["3", "Return policy — when a knife is due back"],
         ["4", "Using the kiosk (everyday floor use)"],
         ["5", "Reading the kiosk board"],
         ["6", "Sanitation: cleaning and inspection checklist"],
         ["7", "Damaged knives — manager review"],
         ["8", "Manager tasks on the fleet board"],
         ["9", "Reports"],
         ["10", "Advanced: every admin setting and what it does (and what a manager sees)"],
         ["11", "Troubleshooting"]],
        [0.4 * inch, W - 0.4 * inch], header=False, zebra=False))

    # ---------------- 1. Lifecycle ----------------
    s.append(section("1. The knife lifecycle at a glance", P(
        "Each knife moves through a fixed sequence. The system blocks any step taken "
        "out of order.")))
    s.append(table(
        [["Stage", "Who", "What happens"],
         ["<b>Available</b>", "—", "Clean, inspected, and ready to use."],
         ["<b>Checked out</b>", "Operator", "In use. The knife shows who has it and when it is due back."],
         ["<b>Awaiting sanitation</b>", "Operator returns it", "Used knife waiting to be cleaned. It <b>cannot</b> be checked out again in this state."],
         ["<b>Available</b> (again)", "Sanitation", "Cleaned and inspected, condition Good → returns to service."],
         ["<b>Damaged</b>", "Sanitation flags it", "Held out of service with a reason (and optional photo) until a <b>manager</b> reviews it."],
         ["<b>Out of service</b>", "Admin/QA retires it", "Removed from rotation (lost, broken, replaced)."]],
        [1.35 * inch, 1.15 * inch, W - 2.5 * inch]))
    s.append(Spacer(1, 8))
    s.append(P(
        "<b>Overdue</b> is not a separate stage — any checked-out knife past its due "
        "time is flagged overdue automatically, turns red, and appears in the banner at "
        "the top of the kiosk."))

    # ---------------- 2. Roles ----------------
    s.append(section("2. Roles and PINs", P(
        "Every employee has a short PIN (4–8 digits) that identifies them. The PIN "
        "determines what they are allowed to do. One person can hold more than one role.")))
    s.append(table(
        [["Role", "Can do"],
         ["Operator", "Check out an available knife; check in the knife <b>they</b> checked out."],
         ["Sanitation", "Clean and inspect used knives, returning good ones to service or flagging damage."],
         ["QA", "The fleet board, reports, and the admin panel — manages <b>knives</b> and reviews <b>damaged</b> knives, but does not manage employees or Teams settings."],
         ["<b>Manager</b>", "A floor supervisor. Does <b>every</b> operator, sanitation, and QA job, reviews <b>damaged</b> knives, and can <b>view</b> the knife fleet and audit log — but <b>cannot change anything</b> in the admin panel (see section 10)."],
         ["Admin", "Everything, including managing <b>employees</b> and the <b>Teams notification</b> settings."]],
        [1.25 * inch, W - 1.25 * inch]))
    s.append(Spacer(1, 10))
    s.append(callout(
        "Change the default PINs before going live",
        "A new installation ships with sample accounts — Admin <b>0000</b>, Operator "
        "<b>1111</b>, Sanitation <b>2222</b>, QA <b>3333</b>. Set real PINs in "
        "Admin → Workers on day one, and remove the samples you do not need. "
        "PINs are stored encrypted and cannot be read back — if one is forgotten, "
        "a manager sets a new one."))


    # ---------------- 3. Return policy ----------------
    s.append(section("3. Return policy — when a knife is due back", P(
        "The knife's type sets its due date automatically at checkout.")))
    s.append(table(
        [["Knife type", "Kiosk color", "Must be returned"],
         ["<b>Food Contact (FC)</b> — knives #1–#14", "Silver/metal tile", "<b>Same day</b>, by the end of the shift."],
         ["<b>Non-Food Contact (NFC)</b> — knives #51–#78", "Blue tile", "<b>End of the week</b> — due Friday, end of shift."]],
        [1.6 * inch, 1.1 * inch, W - 2.7 * inch]))
    s.append(Spacer(1, 8))
    s.append(P(
        "The policy is printed at the top of the kiosk in English and Spanish. When an "
        "employee checks a knife out, the confirmation screen shows the exact date and "
        "time it is due back, and that time then appears on the knife's tile."))

    # ---------------- 4. Using the kiosk ----------------
    s.append(section("4. Using the kiosk (everyday floor use)", P(
        "The kiosk is the shared iPad on the floor. It needs no sign-in — every action "
        "is confirmed with the employee's own PIN, which is what records who did it.")))

    s.append(KeepTogether([P("Checking a knife out — Operator", "h2"), steps([
        "Tap the knife you want. It must have a <b>green ring</b> (Available).",
        "Enter your PIN and tap <b>Next / Siguiente</b>.",
        "Your name appears. Confirm it is you — tap <b>Yes, that's me / Sí</b>. "
        "(If it is not your name, tap <b>Not me</b> and try again.)",
        "The screen shows when the knife is <b>due back</b>. The tile now shows your "
        "name at the top and a yellow ring.",
    ])]))
    s.append(figure_row([
        ("kiosk-pin", "Step 2 — enter your PIN."),
        ("kiosk-confirm", "Step 3 — confirm your name, and see the due-back time."),
    ]))

    s.append(KeepTogether([P("Checking a knife in — Operator", "h2"), steps([
        "Tap your knife (yellow ring, your name on it).",
        "Enter your PIN, tap <b>Next</b>, and confirm your name.",
        "The knife moves to <b>Awaiting sanitation</b> (orange ring). You are done — "
        "do not put it back into service yourself.",
    ])]))
    s.append(Spacer(1, 4))
    s.append(P(
        "<i>Only the person who checked a knife out (or a manager) can check it back "
        "in.</i> This keeps returns attributed to the right person.", "small"))

    s.append(KeepTogether([P("Cleaning and returning to service — Sanitation", "h2"), steps([
        "Tap a knife with an <b>orange ring</b> (Awaiting sanitation).",
        "Enter your PIN, tap <b>Next</b>, confirm your name, and tap "
        "<b>Yes — continue / Sí</b>.",
        "Answer the four inspection questions (next section).",
        "Tap <b>Submit / Enviar</b>.",
    ])]))


    # ---------------- 5. Reading the board ----------------
    s.append(section("5. Reading the kiosk board", P(
        "Every knife is a tile. The <b>fill color</b> tells you the knife type; the "
        "<b>ring around the tile</b> tells you its status.")))
    s.append(table(
        [["Ring color", "Status", "What to do"],
         ["Green", "Available", "Ready to check out."],
         ["Yellow", "Checked out", "In use — the holder's name is shown at the top of the tile, with the due-back time."],
         ["Orange", "Awaiting sanitation", "Sanitation needs to clean and inspect it."],
         ["Red + “OVERDUE”", "Overdue", "Past its due time. Track it down and return it now."],
         ["Red (rose)", "Damaged — needs manager", "Out of use until a manager reviews it."],
         ["Gray", "Out of service", "Retired from the fleet."]],
        [1.35 * inch, 1.4 * inch, W - 2.75 * inch]))
    s.append(Spacer(1, 10))
    s.append(figure("kiosk-board",
                    "Knife #2 and #6 are checked out (yellow ring, due today), #9 is overdue, "
                    "#4 and #11 await sanitation (orange), and #13 is damaged. #1–#14 are "
                    "Food Contact (silver); #51–#78 are Non-Food Contact (blue).",
                    max_w=6.4 * inch, max_h=3.2 * inch))
    s.append(Spacer(1, 8))
    s.append(P(
        "The counts along the top show how many knives are in each state. If anything "
        "is overdue, a red banner lists those knife numbers. Each tile also shows the "
        "knife number, and the type (FC or NFC) along the bottom."))

    # ---------------- 6. Checklist ----------------
    s.append(section("6. Sanitation: cleaning and inspection checklist", P(
        "Before any used knife can go back into production, sanitation must answer all "
        "four questions. Every prompt is shown in English and Spanish.")))
    s.append(table(
        [["#", "Question", "Notes"],
         ["1", "<b>Cleaned?</b> / ¿Limpiado?", "Yes or No."],
         ["2", "<b>Inspected?</b> / ¿Inspeccionado?", "Yes or No."],
         ["3", "<b>Condition</b> / Condición", "Good / Bueno — or — Damaged / Dañado."],
         ["4", "<b>If damaged, why?</b> / ¿Por qué está dañado?", "Required when Damaged. A <b>photo</b> can be attached with the iPad camera (optional but recommended)."]],
        [0.3 * inch, 2.1 * inch, W - 2.4 * inch]))
    s.append(Spacer(1, 10))
    s.append(figure_row([
        ("kiosk-checklist", "The checklist as sanitation answers it."),
        ("kiosk-checklist-damaged", "Damaged reveals the reason box and photo button."),
    ], max_h=3.7 * inch))
    s.append(Spacer(1, 10))
    s.append(callout(
        "The rule the system enforces",
        "A knife returns to service <b>only</b> if it is marked cleaned <b>and</b> "
        "inspected <b>and</b> its condition is Good. If either answer is No, the "
        "system refuses to return it to service."))

    # ---------------- 7. Damaged ----------------
    s.append(section("7. Damaged knives — manager review", P(
        "When sanitation marks a knife <b>Damaged</b>, the knife is immediately held "
        "out of service. Sanitation cannot return it, and it cannot be checked out.")))
    s.append(bullets([
        "The reported reason (and photo, if taken) is saved to the knife.",
        "If Teams alerts are switched on, a message is posted to the channel right away "
        "so a manager knows.",
        "A <b>manager (Admin)</b> reviews it on the fleet board: tap the knife, read "
        "<b>Reported damage</b>, view the photo, then either "
        "<b>Return to service (manager)</b> or <b>Retire (out of service)</b>.",
    ]))
    s.append(figure("board-damaged",
                    "What the manager sees: the reported reason, the photo, and the two "
                    "decisions available.", max_w=3.4 * inch, max_h=4.2 * inch))


    # ---------------- 8. Manager tasks ----------------
    s.append(section("8. Manager tasks on the fleet board", P(
        "The fleet board at <b>/</b> is for admins and QA. Sign in with your PIN. Tap "
        "any knife to open its action panel.")))
    s.append(table(
        [["Action", "Who", "When it appears"],
         ["Check out / Return (mark used)", "Operator (admins included)", "Same lifecycle actions as the kiosk."],
         ["Clean &amp; return to service", "Sanitation (admins included)", "Knife is awaiting sanitation."],
         ["<b>Return to service (manager)</b>", "QA, Manager, or Admin", "Knife is Damaged — clears the damage note and photo."],
         ["Retire (out of service)", "Admin / QA", "Any knife not already retired. Use for lost or broken knives."],
         ["Restore to fleet", "Admin / QA", "Knife is out of service."],
         ["Change knife type (FC / NFC)", "Admin / QA", "Always — changes future due dates. Logged. <i>Not available to managers.</i>"],
         ["View full history", "Admin / QA", "Opens that knife's complete lifecycle record."]],
        [2.0 * inch, 1.45 * inch, W - 3.45 * inch]))
    s.append(Spacer(1, 10))
    s.append(figure("board-fleet",
                    "The fleet board. Filter chips across the top; tap any knife to act on it.",
                    max_w=6.4 * inch, max_h=3.3 * inch))
    s.append(Spacer(1, 8))
    s.append(P(
        "Use the filter chips above the grid to show only one status. When viewing "
        "<b>Awaiting sanitation</b>, sanitation staff and admins get a "
        "<b>Select multiple</b> button to clean several knives at once."))

    # ---------------- 9. Reports ----------------
    s.append(section("9. Reports", P(
        "<b>/reports</b> (admins and QA) answers the end-of-shift questions.")))
    s.append(table(
        [["Panel", "What it tells you"],
         ["Still checked out", "How many knives are out right now, and how many are overdue."],
         ["Total checkouts", "Lifetime usage count."],
         ["Avg turnaround", "Average time from a knife being returned to it being cleaned and back in service."],
         ["Cleanings", "Total number of cleaning cycles recorded."],
         ["End-of-day sweep", "A table of every knife still out — who has it, since when, when it is due, and whether it is overdue. <b>Work this list before shift close.</b>"],
         ["Most-used knives", "Highest-use blades — useful for spotting wear."]],
        [1.5 * inch, W - 1.5 * inch]))
    s.append(Spacer(1, 10))
    s.append(figure("reports", "The Reports page, including the end-of-day sweep.",
                    max_w=6.0 * inch, max_h=4.0 * inch))


    # ---------------- 10. Advanced ----------------
    s.append(section("10. Advanced: every admin setting and what it does", P(
        "The Admin panel is at <b>/admin</b>, open to admins, QA, and managers. If you are "
        "already signed in on the fleet board, no second PIN is needed. The header has a "
        "<b>light/dark mode</b> toggle and a link back to the fleet.")))
    s.append(callout(
        "What a manager sees here",
        "A manager opens the same page but in <b>view-only</b> mode: the <b>Knife fleet</b> "
        "list and the <b>audit log</b> (with its CSV export). Add a knife, Workers, and "
        "Advanced are hidden, and knives have no Edit or Remove buttons. Everything below in "
        "this section is therefore <b>admin/QA only</b>. Managers still perform every floor "
        "action from the fleet board and the kiosk.", BLUE))
    s.append(Spacer(1, 8))
    s.append(callout(
        "What QA sees here",
        "QA manages <b>knives</b> (add, edit, remove, change type), the <b>kiosk logo</b>, and "
        "the <b>audit log</b>, and can return damaged knives to service. <b>Workers</b> and the "
        "<b>Teams notification</b> settings are hidden — those are admin only.", BLUE))
    s.append(Spacer(1, 10))
    s.append(figure("admin-manager",
                    "The admin page as a manager sees it: the knife fleet (view-only) and the "
                    "audit log — no Add a knife, Workers, or Advanced.",
                    max_w=6.2 * inch, max_h=3.6 * inch))

    s.append(P("Knives", "h2"))
    s.append(table(
        [["Setting", "What it does"],
         ["<b>Add a knife</b>", "Adds a new knife to the fleet by number, with its type (Food Contact or Non-Food Contact). It enters as Available. Numbers must be unique."],
         ["<b>Knife fleet</b> list", "Every knife with its type and current status."],
         ["Search (knives)", "Filters the list by number, type (FC/NFC or full name), or status (e.g. “awaiting sanitation”)."],
         ["<b>Edit</b> (per knife)", "Change a knife's number or type. Logged to the audit trail."],
         ["<b>Remove</b> (per knife)", "<b>Permanently deletes</b> the knife and its history. Intended for a knife added by mistake. Blocked while the knife is checked out. To take a real knife out of rotation and <b>keep</b> its history, use <b>Retire</b> on the board instead."]],
        [1.45 * inch, W - 1.45 * inch]))
    s.append(Spacer(1, 10))
    s.append(figure("admin-knives", "Admin - Knives.", max_w=4.2 * inch, max_h=3.6 * inch))

    s.append(P("Workers &mdash; admin only", "h2"))
    s.append(table(
        [["Setting", "What it does"],
         ["<b>Add a worker</b>", "Creates an employee: name, PIN (4–8 digits, must be unique), and one or more roles."],
         ["<b>Bulk upload (CSV)</b>", "Adds many employees at once from a CSV with columns <b>name,pin,roles</b> (roles separated by <b>;</b> — e.g. OPERATOR;SANITATION). Rows with a duplicate or invalid PIN are skipped and reported."],
         ["<b>Download sample CSV</b>", "A correctly formatted example file to fill in."],
         ["<b>Employees</b> list", "All employees, sorted by role: Admin, QA, Operator, Sanitation."],
         ["Search (employees)", "Filters the list by name or role."],
         ["<b>Export employees (CSV)</b>", "Downloads name, roles, and active status. PINs are encrypted and cannot be exported."],
         ["<b>Edit</b> (per employee)", "Change their name, roles, or set a new PIN (leave PIN blank to keep the current one)."],
         ["<b>Deactivate</b> / Reactivate", "Revokes or restores access <b>while keeping</b> the person's history. Use this when someone leaves."],
         ["<b>Remove</b> (per employee)", "Deletes the employee record entirely. Prefer Deactivate to preserve the audit trail."]],
        [1.45 * inch, W - 1.45 * inch]))
    s.append(Spacer(1, 10))
    s.append(figure("admin-workers", "Admin - Workers.", max_w=4.2 * inch, max_h=3.8 * inch))

    s.append(P("Advanced section (collapsed by default)", "h2"))
    s.append(P(
        "Click <b>Advanced</b> to expand. These are setup settings — you should rarely "
        "need to change them day to day."))
    s.append(P("<b>Microsoft Teams notifications</b> &mdash; admin only", "body"))
    s.append(table(
        [["Setting", "What it does"],
         ["<b>Webhook URL</b>", "Where alerts are posted. Create it in Teams: channel &gt; <b>“...” menu</b> &gt; <b>Workflows</b> → “Post to a channel when a webhook request is received”, then paste the URL it generates (it contains <i>logic.azure.com</i>). Older “Incoming Webhook” connector URLs also work."],
         ["<b>Enable Teams notifications</b>", "Master on/off switch. Nothing is sent while this is off."],
         ["Notify: <b>knife flagged damaged</b>", "Posts the moment sanitation reports damage, so a manager can review. <i>On by default.</i>"],
         ["Notify: <b>knife goes overdue</b>", "Intended for the end-of-day overdue sweep. Requires a scheduled job to run the sweep; the preference is stored and ready."],
         ["Notify: <b>knife checked out</b>", "Posts each checkout, including the due-back time. <i>Off by default.</i>"],
         ["Notify: <b>knife checked in</b>", "Posts each check-in. <i>Off by default.</i>"],
         ["Notify: <b>cleaned &amp; returned to service</b>", "Posts each completed cleaning. <i>Off by default.</i>"],
         ["<b>Save</b>", "Stores the settings. If notifications are enabled, a valid https URL and at least one alert type are required."],
         ["<b>Send test message</b>", "Posts a test line to the channel so you can confirm the connection before relying on it. Errors report exactly what Teams returned."]],
        [1.7 * inch, W - 1.7 * inch]))
    s.append(Spacer(1, 8))
    s.append(figure("admin-advanced",
                    "Admin - Advanced, expanded: Teams notifications, kiosk logo, and system "
                    "timezone.", max_w=6.0 * inch, max_h=4.2 * inch))
    s.append(Spacer(1, 6))
    s.append(P(
        "<i>Per-action alerts (checkout / check-in / cleaned) get chatty on a busy "
        "floor — that is why they start switched off.</i>", "small"))

    s.append(Spacer(1, 10))
    s.append(P("<b>Kiosk logo</b>", "body"))
    s.append(table(
        [["Setting", "What it does"],
         ["<b>Choose File</b>", "Uploads your company logo, shown in the top-left corner of the kiosk board. PNG, JPG, or SVG under 500 KB."],
         ["<b>Remove logo</b>", "Clears it; the kiosk falls back to the knife icon."]],
        [1.7 * inch, W - 1.7 * inch]))

    s.append(Spacer(1, 10))
    s.append(P("<b>System</b> (read-only)", "body"))
    s.append(table(
        [["Reading", "What it means"],
         ["<b>Timezone</b>", "The timezone all due dates are calculated in — “end of day” and “end of Friday” follow this clock. Set by the <b>TZ</b> environment variable on the server (e.g. America/New_York). If this is wrong, due times will be wrong."],
         ["<b>Server time now</b>", "The system's current time in that timezone. Compare it against a clock on the wall to confirm the setting is right."]],
        [1.7 * inch, W - 1.7 * inch]))
    s.append(Spacer(1, 6))
    s.append(P(
        "<i>Due times are displayed in the timezone of the device you are looking at. Keep "
        "the kiosk iPad set to the plant's timezone so what the floor sees matches what the "
        "server recorded.</i>", "small"))

    s.append(Spacer(1, 10))
    s.append(P("<b>Recent activity (audit log)</b>", "body"))
    s.append(table(
        [["Setting", "What it does"],
         ["Activity table", "The most recent actions: when, which knife, what happened, who did it, and any note (including the sanitation answers)."],
         ["<b>Export full log (CSV)</b>", "Downloads the <b>complete</b> audit history for food-safety audits or a recall investigation. Records are never edited or deleted."]],
        [1.7 * inch, W - 1.7 * inch]))


    # ---------------- 11. Troubleshooting ----------------
    s.append(P("11. Troubleshooting", "h1"))
    s.append(table(
        [["Symptom", "Cause and fix"],
         ["“PIN not recognized.”", "Wrong PIN, or the employee is deactivated. A manager can set a new PIN in Admin → Workers."],
         ["“This action requires the SANITATION role.”", "The PIN entered does not hold the role that action needs — e.g. an operator trying to clean. Use the right person's PIN, or have a manager add the role."],
         ["Knife was checked out by someone else", "Only the person holding a knife (or a manager) can check it in. A manager can return it on the fleet board."],
         ["A knife cannot be checked out", "It is not Available — it is awaiting sanitation, damaged, or retired. Follow the ring color."],
         ["Due dates look wrong by hours", "The server timezone is off. Check Admin → Advanced → System and set the <b>TZ</b> environment variable."],
         ["Teams test says HTTP 405", "The URL pasted is not a webhook (usually a link to the channel). Create a Workflows webhook as described in section 10."],
         ["Teams says nothing posted", "Check <b>Enable Teams notifications</b> is on and at least one alert type is ticked, then use <b>Send test message</b>."],
         ["Kiosk shows old information", "The board refreshes itself every few seconds; if it looks stuck, reload the page on the iPad."]],
        [1.9 * inch, W - 1.9 * inch]))

    s.append(Spacer(1, 16))
    s.append(callout(
        "Daily rhythm — the short version",
        "Operators check knives out and back in at the kiosk. Sanitation cleans and "
        "inspects everything orange. Before shift close, a manager opens "
        "<b>Reports → End-of-day sweep</b> and chases down anything still out. "
        "Damaged knives wait for a manager.", BLUE))

    doc.build(s)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    build()
