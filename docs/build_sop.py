"""Build the Radio & Scanner Checkout SOP as a PDF.

Run:  python3 docs/build_sop.py
Output: docs/Radio-Scanner-Checkout-SOP.pdf
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

OUT = Path(__file__).resolve().parent / "Radio-Scanner-Checkout-SOP.pdf"

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
    canvas.drawString(0.9 * inch, 10.45 * inch, "Radio & Scanner Checkout — Standard Operating Procedure")
    # Footer
    canvas.line(0.9 * inch, 0.72 * inch, 7.6 * inch, 0.72 * inch)
    canvas.drawString(0.9 * inch, 0.55 * inch, "Warehouse radio & scanner tracking — every action is logged for audit")
    canvas.drawRightString(7.6 * inch, 0.55 * inch, f"Page {doc.page}")
    canvas.restoreState()


def build():
    doc = BaseDocTemplate(
        str(OUT), pagesize=letter,
        leftMargin=0.9 * inch, rightMargin=0.9 * inch,
        topMargin=0.95 * inch, bottomMargin=0.9 * inch,
        title="Radio & Scanner Checkout — SOP",
        author="Radio & Scanner Checkout",
        subject="Standard Operating Procedure and Admin Settings Reference",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="body")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=on_page)])

    s = []  # story
    W = doc.width

    # ---------------- Cover ----------------
    s.append(Spacer(1, 1.1 * inch))
    s.append(P("Radio &amp; Scanner Checkout", "title"))
    s.append(P("Standard Operating Procedure<br/>Procedimiento Operativo Estándar", "subtitle"))
    s.append(Spacer(1, 0.15 * inch))
    s.append(table(
        [["Scope", "Checking warehouse two-way radios and handheld scanners out at the start "
                   "of a shift and back in, on the charger, at the end."],
         ["Applies to", "Operators, Supervisors, and Admins."],
         ["Everyday use", "The <b>kiosk</b> on the shared iPad (landscape). No sign-in required."],
         ["Management", "Fleet board, Reports, and Admin panel — <b>supervisors and admins</b>."],
         ["Records", "Every action writes an immutable audit entry (who, what, when)."]],
        [1.25 * inch, W - 1.25 * inch], header=False, zebra=False))
    s.append(Spacer(1, 0.3 * inch))
    s.append(callout(
        "Why this matters",
        "Radios and scanners walk off, go missing between shifts, and come back with dead "
        "batteries. The kiosk records who has every device, flags anything not back by the "
        "end of the shift, and makes sure each one is returned to its charger.", BLUE))
    s.append(Spacer(1, 0.22 * inch))
    s.append(figure("kiosk-board",
                    "The kiosk on the shared iPad — what the floor sees all day.",
                    max_w=6.6 * inch, max_h=3.1 * inch))

    s.append(PageBreak())

    # ---------------- Contents ----------------
    s.append(P("Contents", "h1"))
    s.append(table(
        [["1", "The device lifecycle at a glance"],
         ["2", "Roles and PINs"],
         ["3", "Return policy — end of shift"],
         ["4", "Using the kiosk (everyday floor use)"],
         ["5", "Reading the kiosk board"],
         ["6", "The return checklist"],
         ["7", "Damaged devices — supervisor review"],
         ["8", "Supervisor tasks on the fleet board"],
         ["9", "Reports"],
         ["10", "Admin settings and what they do"],
         ["11", "Troubleshooting"]],
        [0.4 * inch, W - 0.4 * inch], header=False, zebra=False))

    # ---------------- 1. Lifecycle ----------------
    s.append(section("1. The device lifecycle at a glance", P(
        "Each radio and scanner moves through a short, fixed sequence. The system blocks any "
        "step taken out of order.")))
    s.append(table(
        [["Stage", "Who", "What happens"],
         ["<b>Available</b>", "—", "On the charger and ready to use."],
         ["<b>Checked out</b>", "Operator", "In use. The tile shows who has it and when it is due back."],
         ["<b>Available</b> (again)", "Operator returns it", "Placed on the charger, condition Good → ready for the next person."],
         ["<b>Damaged</b>", "Operator reports it", "Held out of use with a reason (and optional photo) until a <b>supervisor</b> reviews it."],
         ["<b>Out of service</b>", "Supervisor retires it", "Removed from rotation (lost, broken, sent for repair)."]],
        [1.35 * inch, 1.35 * inch, W - 2.7 * inch]))
    s.append(Spacer(1, 8))
    s.append(P(
        "<b>Overdue</b> is not a separate stage — any checked-out device past the end of its "
        "shift is flagged overdue automatically, gets a red ring, and appears in the banner at "
        "the top of the kiosk."))

    # ---------------- 2. Roles ----------------
    s.append(section("2. Roles and PINs", P(
        "Every employee has a short PIN (4–8 digits) that identifies them. The PIN "
        "determines what they are allowed to do.")))
    s.append(table(
        [["Role", "Can do"],
         ["Operator", "Check out an available device; check in the device <b>they</b> checked out."],
         ["<b>Supervisor</b>", "Everything an operator does, plus: check in a device someone else left out, return <b>damaged</b> devices to service, retire and restore devices, use the fleet board and reports, and manage devices, shift times, and the kiosk logo in Admin."],
         ["Admin", "Everything, including managing <b>employees</b> and the <b>Teams notification</b> settings."]],
        [1.25 * inch, W - 1.25 * inch]))
    s.append(Spacer(1, 10))
    s.append(callout(
        "Change the default PINs before going live",
        "A new installation ships with sample accounts — Admin <b>0000</b>, Operator "
        "<b>1111</b>, Supervisor <b>2222</b>. Set real PINs in Admin → Workers on day one, "
        "and remove the samples. PINs are stored encrypted and cannot be read back — if one "
        "is forgotten, an admin sets a new one."))

    # ---------------- 3. Return policy ----------------
    s.append(section("3. Return policy — end of shift", P(
        "Every radio and scanner is due back <b>at the end of the shift</b> it was checked "
        "out on, on its charger. The due time is set automatically at checkout.")))
    s.append(table(
        [["Device", "Kiosk color", "Labels", "Must be returned"],
         ["<b>Radio</b>", "Blue tile", "R001–R020", "End of shift, on the charger."],
         ["<b>Scanner</b>", "Amber tile", "S001–S020", "End of shift, on the charger."]],
        [1.1 * inch, 1.1 * inch, 1.0 * inch, W - 3.2 * inch]))
    s.append(Spacer(1, 8))
    s.append(P(
        "Shift end times are set by a supervisor in Admin (default <b>07:00, 15:00, 23:00</b>). "
        "If you check a device out <b>within an hour</b> of a shift end — for example, arriving "
        "early for the next shift — it is due at the <b>following</b> shift end instead. The "
        "confirmation screen always shows the exact due time, and that time then appears on "
        "the device's tile."))

    # ---------------- 4. Using the kiosk ----------------
    s.append(section("4. Using the kiosk (everyday floor use)", P(
        "The kiosk is the shared iPad on the floor. It needs no sign-in — every action "
        "is confirmed with the employee's own PIN, which is what records who did it.")))

    s.append(KeepTogether([P("Checking a device out", "h2"), steps([
        "Take a radio or scanner off the charger and tap its tile. It must have a "
        "<b>green ring</b> (Available).",
        "Enter your PIN and tap <b>Next / Siguiente</b>.",
        "Your name appears. Confirm it is you — tap <b>Yes, that's me / Sí</b>. "
        "(If it is not your name, tap <b>Not me</b> and try again.)",
        "The screen shows when the device is <b>due back</b>. The tile now shows your "
        "name at the top and a white ring.",
    ])]))
    s.append(figure_row([
        ("kiosk-pin", "Step 2 — enter your PIN."),
        ("kiosk-confirm", "Step 3 — confirm your name, and see the due-back time."),
    ]))

    s.append(KeepTogether([P("Checking a device in", "h2"), steps([
        "Put the device <b>on its charger</b>.",
        "Tap its tile (white ring, your name on it).",
        "Enter your PIN, tap <b>Next</b>, confirm your name, and tap "
        "<b>Yes — continue / Sí</b>.",
        "Answer the return checklist (section 6) and tap <b>Submit / Enviar</b>.",
    ])]))
    s.append(Spacer(1, 4))
    s.append(P(
        "<i>Only the person who checked a device out (or a supervisor) can check it back "
        "in.</i> If you find a device someone else left behind, put it on the charger and "
        "tell a supervisor.", "small"))

    # ---------------- 5. Reading the board ----------------
    s.append(section("5. Reading the kiosk board", P(
        "Every device is a tile. The <b>fill color</b> tells you the device type (blue "
        "radio, amber scanner); the <b>ring around the tile</b> tells you its status. "
        "Radios fill the top rows and scanners the rows below.")))
    s.append(table(
        [["Ring color", "Status", "What to do"],
         ["Green", "Available", "On the charger, ready to check out."],
         ["White", "Checked out", "In use — the holder's name is at the top of the tile, with the due-back time."],
         ["Red + “OVERDUE”", "Overdue", "Past the end of its shift. Track it down and return it now."],
         ["Magenta", "Damaged — needs supervisor", "Out of use until a supervisor reviews it."],
         ["Dimmed tile", "Out of service", "Retired from the fleet."]],
        [1.35 * inch, 1.6 * inch, W - 2.95 * inch]))
    s.append(Spacer(1, 10))
    s.append(figure("kiosk-board",
                    "R002, R006, and S003 are checked out (white ring, due at end of shift), R009 is "
                    "overdue, S007 is damaged, and R017 is out of service.",
                    max_w=6.4 * inch, max_h=3.2 * inch))
    s.append(Spacer(1, 8))
    s.append(P(
        "The counts along the top show how many devices are in each state. If anything is "
        "overdue, a red banner lists those labels."))

    # ---------------- 6. Checklist ----------------
    s.append(section("6. The return checklist", P(
        "Every check-in asks a few quick questions, in English and Spanish.")))
    s.append(table(
        [["#", "Question", "Notes"],
         ["1", "<b>Placed on the charger?</b> / ¿Lo puso en el cargador?", "Must be <b>Yes</b>. If No, put it on the charger first."],
         ["2", "<b>Condition</b> / Condición", "Good / Bueno — or — Damaged / Dañado."],
         ["3", "<b>If damaged, what's wrong?</b> / ¿Qué tiene?", "Required when Damaged. A <b>photo</b> can be attached with the iPad camera (optional but recommended)."]],
        [0.3 * inch, 2.3 * inch, W - 2.6 * inch]))
    s.append(Spacer(1, 10))
    s.append(figure_row([
        ("kiosk-checklist", "The return checklist."),
        ("kiosk-checklist-damaged", "Damaged reveals the reason box and photo button."),
    ], max_h=3.7 * inch))
    s.append(Spacer(1, 10))
    s.append(callout(
        "The rule the system enforces",
        "A device cannot be checked in until it is on the charger. A Good device goes "
        "straight back to Available; a Damaged one is held for a supervisor."))

    # ---------------- 7. Damaged ----------------
    s.append(section("7. Damaged devices — supervisor review", P(
        "When a device is returned <b>Damaged</b>, it is immediately held out of use. "
        "It cannot be checked out until a supervisor reviews it.")))
    s.append(bullets([
        "The reported reason (and photo, if taken) is saved to the device.",
        "If Teams alerts are switched on, a message is posted to the channel right away.",
        "A <b>supervisor</b> reviews it on the fleet board: tap the device, read "
        "<b>Reported damage</b>, view the photo, then either "
        "<b>Return to service (supervisor)</b> or <b>Retire (out of service)</b>.",
    ]))
    s.append(figure("board-damaged",
                    "What the supervisor sees: the reported reason, the photo, and the "
                    "decisions available.", max_w=3.4 * inch, max_h=4.2 * inch))

    # ---------------- 8. Supervisor tasks ----------------
    s.append(section("8. Supervisor tasks on the fleet board", P(
        "The fleet board at <b>/</b> is for supervisors and admins. Sign in with your PIN "
        "and tap any device to open its action panel.")))
    s.append(table(
        [["Action", "When it appears"],
         ["Check out / Check in (return)", "Same actions as the kiosk; check-in runs the same checklist. A supervisor can check in a device someone else left out."],
         ["<b>Return to service (supervisor)</b>", "Device is Damaged — clears the damage note and photo."],
         ["Retire (out of service)", "Any device not already retired. Use for lost, broken, or out-for-repair devices."],
         ["Restore to fleet", "Device is out of service."],
         ["View full history", "Opens that device's complete record."]],
        [2.2 * inch, W - 2.2 * inch]))
    s.append(Spacer(1, 10))
    s.append(figure("board-fleet",
                    "The fleet board. Filter chips across the top; tap any device to act on it.",
                    max_w=6.4 * inch, max_h=3.6 * inch))

    # ---------------- 9. Reports ----------------
    s.append(section("9. Reports", P(
        "<b>/reports</b> answers the end-of-shift questions.")))
    s.append(table(
        [["Panel", "What it tells you"],
         ["Still checked out", "How many devices are out right now, and how many are overdue."],
         ["Total checkouts", "Lifetime usage count."],
         ["Avg time out", "Average time from checkout to check-in."],
         ["Damage reports", "How many returns were marked Damaged."],
         ["End-of-shift sweep", "Every device still out — who has it, since when, when it is due, and whether it is overdue. <b>Work this list before shift close.</b>"],
         ["Most-used devices", "Highest-use units — useful for spotting worn batteries."]],
        [1.5 * inch, W - 1.5 * inch]))
    s.append(Spacer(1, 10))
    s.append(figure("reports", "The Reports page, including the end-of-shift sweep.",
                    max_w=6.0 * inch, max_h=4.0 * inch))

    # ---------------- 10. Admin ----------------
    s.append(section("10. Admin settings and what they do", P(
        "The Admin panel is at <b>/admin</b>, open to supervisors and admins. If you are "
        "already signed in on the fleet board, no second PIN is needed.")))
    s.append(callout(
        "What a supervisor sees here",
        "Supervisors manage <b>devices</b>, <b>shift end times</b>, the <b>kiosk logo</b>, "
        "and see the <b>audit log</b>. <b>Workers</b> and <b>Teams notifications</b> are "
        "hidden — those are admin only.", BLUE))

    s.append(P("Radios &amp; scanners", "h2"))
    s.append(table(
        [["Setting", "What it does"],
         ["<b>Add a device</b>", "Pick Radio or Scanner and type a label (R021, S021) or just a number — a bare number gets the type's letter. New devices enter as Available. Labels must be unique."],
         ["<b>Device list</b>", "Every device with its type and current status. Search by label, type, or status."],
         ["<b>Edit</b> (per device)", "Change a device's label or type. Logged to the audit trail."],
         ["<b>Remove</b> (per device)", "<b>Permanently deletes</b> the device and its history. Intended for one added by mistake. To take a real device out of rotation and <b>keep</b> its history, use <b>Retire</b> on the board instead."]],
        [1.45 * inch, W - 1.45 * inch]))
    s.append(Spacer(1, 10))
    s.append(figure("admin-devices", "Admin - Radios &amp; scanners.", max_w=4.2 * inch, max_h=3.6 * inch))

    s.append(P("Workers &mdash; admin only", "h2"))
    s.append(table(
        [["Setting", "What it does"],
         ["<b>Add a worker</b>", "Creates an employee: name, PIN (4–8 digits, must be unique), and role (Operator, Supervisor, Admin)."],
         ["<b>Bulk upload (CSV)</b>", "Adds many employees at once from a CSV with columns <b>name,pin,roles</b>. Rows with a duplicate or invalid PIN are skipped and reported."],
         ["<b>Employees</b> list", "All employees, sorted by role. Edit name, roles, or PIN; <b>Deactivate</b> to revoke access while keeping history; <b>Remove</b> to delete entirely."],
         ["<b>Export employees (CSV)</b>", "Downloads name, roles, and active status. PINs are encrypted and cannot be exported."]],
        [1.45 * inch, W - 1.45 * inch]))
    s.append(Spacer(1, 10))
    s.append(figure("admin-workers", "Admin - Workers.", max_w=4.2 * inch, max_h=3.8 * inch))

    s.append(P("Advanced section (collapsed by default)", "h2"))
    s.append(table(
        [["Setting", "What it does"],
         ["<b>Microsoft Teams notifications</b> (admin only)", "Paste a Teams Workflows webhook URL (channel → “...” → Workflows → “Post to a channel when a webhook request is received”) and choose alerts: damaged returns (on by default), overdue sweep (needs a scheduled job), checkouts and check-ins (off by default). <b>Send test message</b> confirms the connection."],
         ["<b>Shift end times</b>", "The times every checkout is due back by (24-hour clock, comma separated). Changing them affects new checkouts only."],
         ["<b>Kiosk logo</b>", "Upload your company logo for the top-left corner of the kiosk (PNG, JPG, or SVG under 500 KB). <b>Remove logo</b> falls back to the radio icon."],
         ["<b>System</b> (read-only)", "The server timezone and current time. All due times follow this clock — set the <b>TZ</b> environment variable if it is wrong."]],
        [1.7 * inch, W - 1.7 * inch]))
    s.append(Spacer(1, 8))
    s.append(figure("admin-advanced",
                    "Admin - Advanced, expanded.", max_w=6.0 * inch, max_h=4.2 * inch))

    s.append(P("Recent activity (audit log)", "h2"))
    s.append(P(
        "The most recent actions — when, which device, what happened, who did it, and any "
        "note (including the return checklist answers). <b>Export full log (CSV)</b> "
        "downloads the complete history. Records are never edited or deleted."))

    # ---------------- 11. Troubleshooting ----------------
    s.append(P("11. Troubleshooting", "h1"))
    s.append(table(
        [["Symptom", "Cause and fix"],
         ["“PIN not recognized.”", "Wrong PIN, or the employee is deactivated. An admin can set a new PIN in Admin → Workers."],
         ["“…checked out by someone else”", "Only the person holding a device (or a supervisor) can check it in. Put it on the charger and have a supervisor check it in."],
         ["Submit stays gray on check-in", "Answer <b>Yes</b> to “Placed on the charger?” and choose a condition. Damaged also needs a reason."],
         ["A device cannot be checked out", "It is not Available — it is checked out, damaged, or retired. Follow the ring color."],
         ["Due times look wrong", "Check the shift end times and the timezone in Admin → Advanced, and set the <b>TZ</b> environment variable."],
         ["Teams test says HTTP 405", "The URL pasted is not a webhook (usually a link to the channel). Create a Workflows webhook as described in section 10."],
         ["Kiosk shows old information", "The board refreshes itself every few seconds; if it looks stuck, reload the page on the iPad."]],
        [1.9 * inch, W - 1.9 * inch]))

    s.append(Spacer(1, 16))
    s.append(callout(
        "Daily rhythm — the short version",
        "Operators check radios and scanners out at the start of the shift and back in, on "
        "the charger, at the end. Before shift close, a supervisor opens "
        "<b>Reports → End-of-shift sweep</b> and chases down anything still out. Damaged "
        "devices wait for a supervisor.", BLUE))

    doc.build(s)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    build()
