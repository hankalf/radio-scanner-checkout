"""Genera el SOP de Radio & Scanner Checkout en PDF — versión en español.

Ejecutar:  python3 docs/build_sop_es.py
Salida: docs/Radio-Scanner-Checkout-SOP-ES.pdf

Los nombres de botones y menús en pantalla se citan en inglés (tal como
aparecen en la aplicación), con su explicación en español.
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

OUT = Path(__file__).resolve().parent / "Radio-Scanner-Checkout-SOP-ES.pdf"

# Paleta que aproxima la de la aplicación.
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
    """Una captura de pantalla escalada, con su leyenda, en una sola página."""
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
    """Dos capturas lado a lado, cada una con su leyenda."""
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
    """Un h1 unido a su primer contenido para que no quede huérfano."""
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
    """rows[0] es la fila de encabezado cuando header=True. Las celdas son cadenas."""
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
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(0.9 * inch, 10.35 * inch, 7.6 * inch, 10.35 * inch)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(SLATE)
    canvas.drawString(0.9 * inch, 10.45 * inch, "Radio & Scanner Checkout — Procedimiento Operativo Estándar")
    canvas.line(0.9 * inch, 0.72 * inch, 7.6 * inch, 0.72 * inch)
    canvas.drawString(0.9 * inch, 0.55 * inch, "Control de radios y escáneres del almacén — cada acción queda registrada")
    canvas.drawRightString(7.6 * inch, 0.55 * inch, f"Página {doc.page}")
    canvas.restoreState()


def build():
    doc = BaseDocTemplate(
        str(OUT), pagesize=letter,
        leftMargin=0.9 * inch, rightMargin=0.9 * inch,
        topMargin=0.95 * inch, bottomMargin=0.9 * inch,
        title="Radio & Scanner Checkout — Procedimiento Operativo Estándar",
        author="Radio & Scanner Checkout",
        subject="Procedimiento Operativo Estándar y referencia de configuración",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="body")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=on_page)])

    s = []
    W = doc.width

    # ---------------- Portada ----------------
    s.append(Spacer(1, 1.1 * inch))
    s.append(P("Radio &amp; Scanner Checkout", "title"))
    s.append(P("Procedimiento Operativo Estándar<br/>Standard Operating Procedure", "subtitle"))
    s.append(Spacer(1, 0.15 * inch))
    s.append(table(
        [["Alcance", "Sacar los radios y escáneres del almacén al inicio del turno y "
                     "devolverlos, en su cargador, al final."],
         ["Aplica a", "Operadores, Supervisores y Administradores."],
         ["Uso diario", "El <b>kiosco</b> en el iPad compartido (horizontal). No requiere iniciar sesión."],
         ["Gestión", "Tablero de equipos, Reportes y panel de Admin — <b>supervisores y administradores</b>."],
         ["Registros", "Cada acción crea un registro de auditoría que no se puede modificar (quién, qué, cuándo)."]],
        [1.25 * inch, W - 1.25 * inch], header=False, zebra=False))
    s.append(Spacer(1, 0.3 * inch))
    s.append(callout(
        "Por qué es importante",
        "Los radios y escáneres se pierden entre turnos y regresan con la batería "
        "descargada. El kiosco registra quién tiene cada equipo, marca lo que no regresa "
        "al final del turno y asegura que cada uno vuelva a su cargador.", BLUE))
    s.append(Spacer(1, 0.22 * inch))
    s.append(figure("kiosk-board",
                    "El kiosco en el iPad compartido — lo que ve el piso todo el día.",
                    max_w=6.6 * inch, max_h=3.1 * inch))

    s.append(PageBreak())

    # ---------------- Contenido ----------------
    s.append(P("Contenido", "h1"))
    s.append(table(
        [["1", "El ciclo del equipo de un vistazo"],
         ["2", "Roles y PIN"],
         ["3", "Política de devolución — fin del turno"],
         ["4", "Uso del kiosco (uso diario en el piso)"],
         ["5", "Cómo leer el tablero del kiosco"],
         ["6", "La lista de devolución"],
         ["7", "Equipos dañados — revisión del supervisor"],
         ["8", "Tareas del supervisor en el tablero"],
         ["9", "Reportes"],
         ["10", "Configuración de Admin y qué hace cada opción"],
         ["11", "Solución de problemas"]],
        [0.4 * inch, W - 0.4 * inch], header=False, zebra=False))

    # ---------------- 1 ----------------
    s.append(section("1. El ciclo del equipo de un vistazo", P(
        "Cada radio y escáner sigue una secuencia corta y fija. El sistema bloquea cualquier "
        "paso fuera de orden.")))
    s.append(table(
        [["Etapa", "Quién", "Qué pasa"],
         ["<b>Available</b> (Disponible)", "—", "En el cargador y listo para usar."],
         ["<b>Checked out</b> (Prestado)", "Operador", "En uso. El cuadro muestra quién lo tiene y cuándo se debe devolver."],
         ["<b>Available</b> (otra vez)", "El operador lo devuelve", "En el cargador, condición Buena → listo para la siguiente persona."],
         ["<b>Damaged</b> (Dañado)", "El operador lo reporta", "Fuera de uso con un motivo (y foto opcional) hasta que un <b>supervisor</b> lo revise."],
         ["<b>Out of service</b> (Fuera de servicio)", "El supervisor lo retira", "Fuera de la rotación (perdido, roto, en reparación)."]],
        [1.5 * inch, 1.35 * inch, W - 2.85 * inch]))
    s.append(Spacer(1, 8))
    s.append(P(
        "<b>Overdue</b> (Vencido) no es una etapa aparte — cualquier equipo prestado después "
        "del fin de su turno se marca como vencido automáticamente, con un borde rojo, y aparece "
        "en el aviso en la parte superior del kiosco."))

    # ---------------- 2 ----------------
    s.append(section("2. Roles y PIN", P(
        "Cada empleado tiene un PIN corto (4–8 dígitos) que lo identifica. El PIN determina "
        "lo que puede hacer.")))
    s.append(table(
        [["Rol", "Puede"],
         ["Operator (Operador)", "Sacar un equipo disponible; devolver el equipo que <b>él mismo</b> sacó."],
         ["<b>Supervisor</b>", "Todo lo que hace un operador, y además: devolver un equipo que otra persona dejó, regresar equipos <b>dañados</b> al servicio, retirar y restaurar equipos, usar el tablero y los reportes, y administrar equipos, horarios de turno y el logo del kiosco en Admin."],
         ["Admin (Administrador)", "Todo, incluso administrar <b>empleados</b> y las <b>notificaciones de Teams</b>."]],
        [1.5 * inch, W - 1.5 * inch]))
    s.append(Spacer(1, 10))
    s.append(callout(
        "Cambie los PIN predeterminados antes de empezar",
        "Una instalación nueva trae cuentas de ejemplo — Admin <b>0000</b>, Operador "
        "<b>1111</b>, Supervisor <b>2222</b>. Configure PIN reales en Admin → Workers el "
        "primer día y elimine los de ejemplo. Los PIN se guardan cifrados y no se pueden "
        "consultar — si alguien olvida el suyo, un administrador le asigna uno nuevo."))

    # ---------------- 3 ----------------
    s.append(section("3. Política de devolución — fin del turno", P(
        "Cada radio y escáner se debe devolver <b>al final del turno</b> en que se sacó, en "
        "su cargador. La hora de devolución se asigna automáticamente al sacarlo.")))
    s.append(table(
        [["Equipo", "Color en el kiosco", "Etiquetas", "Se debe devolver"],
         ["<b>Radio</b>", "Cuadro azul", "R1–R20", "Al final del turno, en el cargador."],
         ["<b>Escáner</b> (Scanner)", "Cuadro ámbar", "S1–S20", "Al final del turno, en el cargador."]],
        [1.25 * inch, 1.25 * inch, 0.9 * inch, W - 3.4 * inch]))
    s.append(Spacer(1, 8))
    s.append(P(
        "Un supervisor define las horas de fin de turno en Admin (predeterminado "
        "<b>07:00, 15:00, 23:00</b>). Si saca un equipo <b>dentro de una hora</b> antes del fin "
        "de un turno — por ejemplo, al llegar temprano al siguiente turno — se debe devolver "
        "al fin del turno <b>siguiente</b>. La pantalla de confirmación siempre muestra la hora "
        "exacta, y esa hora aparece en el cuadro del equipo."))

    # ---------------- 4 ----------------
    s.append(section("4. Uso del kiosco (uso diario en el piso)", P(
        "El kiosco es el iPad compartido en el piso. No requiere iniciar sesión — cada "
        "acción se confirma con el PIN del empleado, que es lo que registra quién la hizo.")))

    s.append(KeepTogether([P("Sacar un equipo", "h2"), steps([
        "Tome un radio o escáner del cargador y toque su cuadro. Debe tener un "
        "<b>borde verde</b> (Available).",
        "Ingrese su PIN y toque <b>Next / Siguiente</b>.",
        "Aparece su nombre. Confirme que es usted — toque <b>Yes, that's me / Sí</b>. "
        "(Si no es su nombre, toque <b>Not me</b> e intente de nuevo.)",
        "La pantalla muestra cuándo se debe <b>devolver</b>. El cuadro ahora muestra su "
        "nombre arriba y un borde blanco.",
    ])]))
    s.append(figure_row([
        ("kiosk-pin", "Paso 2 — ingrese su PIN."),
        ("kiosk-confirm", "Paso 3 — confirme su nombre y vea la hora de devolución."),
    ]))

    s.append(KeepTogether([P("Devolver un equipo", "h2"), steps([
        "Ponga el equipo <b>en su cargador</b>.",
        "Toque su cuadro (borde blanco, con su nombre).",
        "Ingrese su PIN, toque <b>Next</b>, confirme su nombre y toque "
        "<b>Yes — continue / Sí</b>.",
        "Conteste la lista de devolución (sección 6) y toque <b>Submit / Enviar</b>.",
    ])]))
    s.append(Spacer(1, 4))
    s.append(P(
        "<i>Solo la persona que sacó el equipo (o un supervisor) puede devolverlo.</i> Si "
        "encuentra un equipo que otra persona dejó, póngalo en el cargador y avise a un "
        "supervisor.", "small"))

    # ---------------- 5 ----------------
    s.append(section("5. Cómo leer el tablero del kiosco", P(
        "Cada equipo es un cuadro. El <b>color de relleno</b> indica el tipo (azul radio, "
        "ámbar escáner); el <b>borde</b> indica su estado. Los radios ocupan las filas de "
        "arriba y los escáneres las de abajo.")))
    s.append(table(
        [["Color del borde", "Estado", "Qué hacer"],
         ["Verde", "Available (Disponible)", "En el cargador, listo para sacar."],
         ["Blanco", "Checked out (Prestado)", "En uso — el nombre de quien lo tiene aparece arriba del cuadro, con la hora de devolución."],
         ["Rojo + “OVERDUE”", "Overdue (Vencido)", "Pasó el fin de su turno. Búsquelo y devuélvalo ya."],
         ["Magenta", "Damaged (Dañado)", "Fuera de uso hasta que un supervisor lo revise."],
         ["Cuadro atenuado", "Out of service", "Retirado de la flota."]],
        [1.35 * inch, 1.6 * inch, W - 2.95 * inch]))
    s.append(Spacer(1, 10))
    s.append(figure("kiosk-board",
                    "R2, R6 y S3 están prestados (borde blanco, vencen al fin del turno), R9 "
                    "está vencido, S7 está dañado y R17 está fuera de servicio.",
                    max_w=6.4 * inch, max_h=3.2 * inch))
    s.append(Spacer(1, 8))
    s.append(P(
        "Los conteos en la parte superior muestran cuántos equipos hay en cada estado. Si "
        "hay alguno vencido, un aviso rojo muestra sus etiquetas."))

    # ---------------- 6 ----------------
    s.append(section("6. La lista de devolución", P(
        "Cada devolución hace unas preguntas rápidas, en inglés y en español.")))
    s.append(table(
        [["#", "Pregunta", "Notas"],
         ["1", "<b>¿Lo puso en el cargador?</b> / Placed on the charger?", "Debe ser <b>Sí</b>. Si es No, póngalo en el cargador primero."],
         ["2", "<b>Condición</b> / Condition", "Bueno / Good — o — Dañado / Damaged."],
         ["3", "<b>Si está dañado, ¿qué tiene?</b>", "Obligatorio si está Dañado. Se puede agregar una <b>foto</b> con la cámara del iPad (opcional pero recomendado)."]],
        [0.3 * inch, 2.3 * inch, W - 2.6 * inch]))
    s.append(Spacer(1, 10))
    s.append(figure_row([
        ("kiosk-checklist", "La lista de devolución."),
        ("kiosk-checklist-damaged", "Dañado muestra el cuadro de motivo y el botón de foto."),
    ], max_h=3.7 * inch))
    s.append(Spacer(1, 10))
    s.append(callout(
        "La regla que aplica el sistema",
        "No se puede devolver un equipo hasta que esté en el cargador. Un equipo en buen "
        "estado vuelve directo a Disponible; uno dañado queda en espera de un supervisor."))

    # ---------------- 7 ----------------
    s.append(section("7. Equipos dañados — revisión del supervisor", P(
        "Cuando un equipo se devuelve como <b>Dañado</b>, queda fuera de uso de inmediato. "
        "No se puede sacar hasta que un supervisor lo revise.")))
    s.append(bullets([
        "El motivo reportado (y la foto, si se tomó) se guarda con el equipo.",
        "Si las alertas de Teams están activas, se publica un mensaje en el canal al instante.",
        "Un <b>supervisor</b> lo revisa en el tablero: toca el equipo, lee "
        "<b>Reported damage</b>, ve la foto y elige "
        "<b>Return to service (supervisor)</b> o <b>Retire (out of service)</b>.",
    ]))
    s.append(figure("board-damaged",
                    "Lo que ve el supervisor: el motivo reportado, la foto y las decisiones "
                    "disponibles.", max_w=3.4 * inch, max_h=4.2 * inch))

    # ---------------- 8 ----------------
    s.append(section("8. Tareas del supervisor en el tablero", P(
        "El tablero en <b>/</b> es para supervisores y administradores. Inicie sesión con su "
        "PIN y toque cualquier equipo para ver sus acciones.")))
    s.append(table(
        [["Acción", "Cuándo aparece"],
         ["Check out / Check in (return)", "Las mismas acciones del kiosco; la devolución usa la misma lista. Un supervisor puede devolver un equipo que otra persona dejó."],
         ["<b>Return to service (supervisor)</b>", "El equipo está Dañado — borra la nota y la foto del daño."],
         ["Retire (out of service)", "Cualquier equipo no retirado. Para equipos perdidos, rotos o en reparación."],
         ["Restore to fleet", "El equipo está fuera de servicio."],
         ["View full history", "Abre el historial completo del equipo."]],
        [2.2 * inch, W - 2.2 * inch]))
    s.append(Spacer(1, 10))
    s.append(figure("board-fleet",
                    "El tablero. Filtros arriba; toque cualquier equipo para actuar.",
                    max_w=6.4 * inch, max_h=3.6 * inch))

    # ---------------- 9 ----------------
    s.append(section("9. Reportes", P(
        "<b>/reports</b> responde las preguntas del fin de turno.")))
    s.append(table(
        [["Panel", "Qué indica"],
         ["Still checked out", "Cuántos equipos están prestados ahora y cuántos están vencidos."],
         ["Total checkouts", "Total de préstamos registrados."],
         ["Avg time out", "Tiempo promedio entre sacar y devolver un equipo."],
         ["Damage reports", "Cuántas devoluciones se marcaron como Dañado."],
         ["End-of-shift sweep", "Cada equipo que sigue afuera — quién lo tiene, desde cuándo, cuándo vence y si está vencido. <b>Revise esta lista antes del cierre del turno.</b>"],
         ["Most-used devices", "Los equipos más usados — útil para detectar baterías desgastadas."]],
        [1.5 * inch, W - 1.5 * inch]))
    s.append(Spacer(1, 10))
    s.append(figure("reports", "La página de Reportes, con la revisión de fin de turno.",
                    max_w=6.0 * inch, max_h=4.0 * inch))

    # ---------------- 10 ----------------
    s.append(section("10. Configuración de Admin y qué hace cada opción", P(
        "El panel de Admin está en <b>/admin</b>, abierto a supervisores y administradores. "
        "Si ya inició sesión en el tablero, no necesita otro PIN.")))
    s.append(callout(
        "Lo que ve un supervisor aquí",
        "Los supervisores administran <b>equipos</b>, <b>horarios de fin de turno</b>, el "
        "<b>logo del kiosco</b> y ven el <b>registro de auditoría</b>. <b>Workers</b> y las "
        "<b>notificaciones de Teams</b> están ocultos — son solo para administradores.", BLUE))

    s.append(P("Radios &amp; scanners", "h2"))
    s.append(table(
        [["Opción", "Qué hace"],
         ["<b>Add a device</b>", "Elija Radio o Scanner y escriba una etiqueta (R21, S21) o solo un número — un número solo recibe la letra del tipo. Los equipos nuevos entran como Disponibles. Las etiquetas deben ser únicas."],
         ["<b>Device list</b>", "Cada equipo con su tipo y estado actual. Busque por etiqueta, tipo o estado."],
         ["<b>Edit</b>", "Cambia la etiqueta o el tipo de un equipo. Queda en el registro."],
         ["<b>Remove</b>", "<b>Borra permanentemente</b> el equipo y su historial. Para equipos agregados por error. Para sacar de rotación un equipo real y <b>conservar</b> su historial, use <b>Retire</b> en el tablero."]],
        [1.45 * inch, W - 1.45 * inch]))
    s.append(Spacer(1, 10))
    s.append(figure("admin-devices", "Admin - Radios &amp; scanners.", max_w=4.2 * inch, max_h=3.6 * inch))

    s.append(P("Workers &mdash; solo administradores", "h2"))
    s.append(table(
        [["Opción", "Qué hace"],
         ["<b>Add a worker</b>", "Crea un empleado: nombre, PIN (4–8 dígitos, único) y rol (Operator, Supervisor, Admin)."],
         ["<b>Bulk upload (CSV)</b>", "Agrega muchos empleados a la vez desde un CSV con columnas <b>name,pin,roles</b>. Las filas con PIN repetido o inválido se omiten y se reportan."],
         ["<b>Employees</b>", "Todos los empleados, ordenados por rol. Edite nombre, roles o PIN; <b>Deactivate</b> quita el acceso pero conserva el historial; <b>Remove</b> lo borra por completo."],
         ["<b>Export employees (CSV)</b>", "Descarga nombre, roles y estado. Los PIN están cifrados y no se exportan."]],
        [1.45 * inch, W - 1.45 * inch]))
    s.append(Spacer(1, 10))
    s.append(figure("admin-workers", "Admin - Workers.", max_w=4.2 * inch, max_h=3.8 * inch))

    s.append(P("Sección Advanced (cerrada por defecto)", "h2"))
    s.append(table(
        [["Opción", "Qué hace"],
         ["<b>Microsoft Teams notifications</b> (solo admin)", "Pegue la URL de un webhook de Workflows de Teams (canal → “...” → Workflows → “Post to a channel when a webhook request is received”) y elija las alertas: devoluciones dañadas (activa por defecto), revisión de vencidos (requiere una tarea programada), préstamos y devoluciones (apagadas por defecto). <b>Send test message</b> confirma la conexión."],
         ["<b>Shift end times</b>", "Las horas en que vence cada préstamo (formato de 24 horas, separadas por comas). Los cambios aplican solo a préstamos nuevos."],
         ["<b>Kiosk logo</b>", "Suba el logo de su empresa para la esquina superior izquierda del kiosco (PNG, JPG o SVG de menos de 500 KB). <b>Remove logo</b> vuelve al ícono de radio."],
         ["<b>System</b> (solo lectura)", "La zona horaria y la hora del servidor. Todas las horas de devolución siguen este reloj — configure la variable <b>TZ</b> si está mal."]],
        [1.7 * inch, W - 1.7 * inch]))
    s.append(Spacer(1, 8))
    s.append(figure("admin-advanced", "Admin - Advanced, abierto.", max_w=6.0 * inch, max_h=4.2 * inch))

    s.append(P("Recent activity (registro de auditoría)", "h2"))
    s.append(P(
        "Las acciones más recientes — cuándo, qué equipo, qué pasó, quién lo hizo y cualquier "
        "nota (incluidas las respuestas de la lista de devolución). <b>Export full log (CSV)</b> "
        "descarga el historial completo. Los registros nunca se editan ni se borran."))

    # ---------------- 11 ----------------
    s.append(P("11. Solución de problemas", "h1"))
    s.append(table(
        [["Síntoma", "Causa y solución"],
         ["“PIN not recognized.”", "PIN incorrecto, o el empleado está desactivado. Un administrador puede asignar un PIN nuevo en Admin → Workers."],
         ["“…checked out by someone else”", "Solo quien tiene el equipo (o un supervisor) puede devolverlo. Póngalo en el cargador y pida a un supervisor que lo devuelva."],
         ["Submit sigue gris al devolver", "Conteste <b>Sí</b> a “¿Lo puso en el cargador?” y elija una condición. Dañado también requiere un motivo."],
         ["No se puede sacar un equipo", "No está Disponible — está prestado, dañado o retirado. Fíjese en el color del borde."],
         ["Las horas de devolución están mal", "Revise los horarios de fin de turno y la zona horaria en Admin → Advanced, y la variable <b>TZ</b>."],
         ["La prueba de Teams dice HTTP 405", "La URL no es un webhook (normalmente es un enlace al canal). Cree un webhook de Workflows como se explica en la sección 10."],
         ["El kiosco muestra información vieja", "El tablero se actualiza solo cada pocos segundos; si parece detenido, recargue la página en el iPad."]],
        [1.9 * inch, W - 1.9 * inch]))

    s.append(Spacer(1, 16))
    s.append(callout(
        "Rutina diaria — la versión corta",
        "Los operadores sacan radios y escáneres al inicio del turno y los devuelven, en el "
        "cargador, al final. Antes del cierre del turno, un supervisor abre "
        "<b>Reports → End-of-shift sweep</b> y busca lo que sigue afuera. Los equipos dañados "
        "esperan a un supervisor.", BLUE))

    doc.build(s)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    build()
