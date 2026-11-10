"""Genera el SOP del Safety Knife Checkout System en PDF — versión en español.

Ejecutar:  python3 docs/build_sop_es.py
Salida: docs/Safety-Knife-Checkout-SOP-ES.pdf

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

OUT = Path(__file__).resolve().parent / "Safety-Knife-Checkout-SOP-ES.pdf"

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
    # Regla del encabezado
    canvas.setStrokeColor(BORDER)
    canvas.setLineWidth(0.5)
    canvas.line(0.9 * inch, 10.35 * inch, 7.6 * inch, 10.35 * inch)
    canvas.setFont("Helvetica", 8)
    canvas.setFillColor(SLATE)
    canvas.drawString(0.9 * inch, 10.45 * inch,
                      "Safety Knife Checkout System — Procedimiento Operativo Estándar")
    # Pie de página
    canvas.line(0.9 * inch, 0.72 * inch, 7.6 * inch, 0.72 * inch)
    canvas.drawString(0.9 * inch, 0.55 * inch,
                      "Control de cuchillos para seguridad alimentaria — cada acción queda registrada para auditoría")
    canvas.drawRightString(7.6 * inch, 0.55 * inch, f"Página {doc.page}")
    canvas.restoreState()


def build():
    doc = BaseDocTemplate(
        str(OUT), pagesize=letter,
        leftMargin=0.9 * inch, rightMargin=0.9 * inch,
        topMargin=0.95 * inch, bottomMargin=0.9 * inch,
        title="Safety Knife Checkout System — POE (Español)",
        author="Production Knife Dashboard",
        subject="Procedimiento Operativo Estándar y referencia de configuración de administración",
    )
    frame = Frame(doc.leftMargin, doc.bottomMargin, doc.width, doc.height, id="body")
    doc.addPageTemplates([PageTemplate(id="main", frames=[frame], onPage=on_page)])

    s = []  # contenido
    W = doc.width

    # ---------------- Portada ----------------
    s.append(Spacer(1, 1.1 * inch))
    s.append(P("Safety Knife Checkout System", "title"))
    s.append(P("Procedimiento Operativo Estándar<br/>Standard Operating Procedure", "subtitle"))
    s.append(Spacer(1, 0.15 * inch))
    s.append(table(
        [["Alcance", "Retiro, devolución, limpieza e inspección de los cuchillos de "
                     "seguridad numerados de producción de alimentos."],
         ["Aplica a", "Operadores, Saneamiento, Control de Calidad (QA), Gerentes y Administradores."],
         ["Uso diario", "El <b>quiosco</b> en el iPad compartido (horizontal). No requiere iniciar sesión."],
         ["Gestión", "Tablero de la flota, Reportes y panel de Administración — <b>administradores, QA y gerentes</b>."],
         ["Registros", "Cada acción escribe una entrada de auditoría inalterable (quién, qué, cuándo)."]],
        [1.25 * inch, W - 1.25 * inch], header=False, zebra=False))
    s.append(Spacer(1, 0.3 * inch))
    s.append(callout(
        "Por qué es importante",
        "Un cuchillo nunca debe volver a la producción de alimentos sin haber sido "
        "limpiado e inspeccionado. El sistema hace cumplir ese orden — es imposible "
        "retirar un cuchillo que no haya sido limpiado y aprobado en la inspección.", BLUE))
    s.append(Spacer(1, 0.22 * inch))
    s.append(figure("kiosk-board",
                    "El quiosco en el iPad compartido — lo que el piso de producción ve todo el día.",
                    max_w=6.6 * inch, max_h=3.1 * inch))

    s.append(PageBreak())

    # ---------------- Contenido ----------------
    s.append(P("Contenido", "h1"))
    s.append(table(
        [["1", "El ciclo de vida del cuchillo de un vistazo"],
         ["2", "Roles y PINs"],
         ["3", "Política de devolución — cuándo debe regresar un cuchillo"],
         ["4", "Uso del quiosco (uso diario en el piso)"],
         ["5", "Cómo leer el tablero del quiosco"],
         ["6", "Saneamiento: lista de verificación de limpieza e inspección"],
         ["7", "Cuchillos dañados — revisión del gerente"],
         ["8", "Tareas del gerente en el tablero de la flota"],
         ["9", "Reportes"],
         ["10", "Avanzado: cada configuración de administración y qué hace (y qué ve un gerente)"],
         ["11", "Solución de problemas"]],
        [0.4 * inch, W - 0.4 * inch], header=False, zebra=False))

    # ---------------- 1. Ciclo de vida ----------------
    s.append(section("1. El ciclo de vida del cuchillo de un vistazo", P(
        "Cada cuchillo pasa por una secuencia fija. El sistema bloquea cualquier paso "
        "que se intente fuera de orden.")))
    s.append(table(
        [["Etapa", "Quién", "Qué sucede"],
         ["<b>Disponible</b> (Available)", "—", "Limpio, inspeccionado y listo para usar."],
         ["<b>Retirado</b> (Checked out)", "Operador", "En uso. El cuchillo muestra quién lo tiene y cuándo debe regresar."],
         ["<b>Esperando saneamiento</b> (Awaiting sanitation)", "El operador lo devuelve", "Cuchillo usado esperando limpieza. <b>No puede</b> retirarse de nuevo en este estado."],
         ["<b>Disponible</b> (de nuevo)", "Saneamiento", "Limpiado e inspeccionado, condición Buena → vuelve al servicio."],
         ["<b>Dañado</b> (Damaged)", "Saneamiento lo reporta", "Retenido fuera de servicio con un motivo (y foto opcional) hasta que un <b>gerente</b> lo revise."],
         ["<b>Fuera de servicio</b> (Out of service)", "Admin/QA lo retira", "Eliminado de la rotación (perdido, roto, reemplazado)."]],
        [1.6 * inch, 1.25 * inch, W - 2.85 * inch]))
    s.append(Spacer(1, 8))
    s.append(P(
        "<b>Vencido</b> (Overdue) no es una etapa aparte — cualquier cuchillo retirado "
        "que pase de su hora límite se marca automáticamente como vencido, se pone en "
        "rojo y aparece en el aviso en la parte superior del quiosco."))

    # ---------------- 2. Roles ----------------
    s.append(section("2. Roles y PINs", P(
        "Cada empleado tiene un PIN corto (4–8 dígitos) que lo identifica. El PIN "
        "determina qué puede hacer. Una persona puede tener más de un rol.")))
    s.append(table(
        [["Rol", "Puede hacer"],
         ["Operador", "Retirar un cuchillo disponible; devolver el cuchillo que <b>él mismo</b> retiró."],
         ["Saneamiento", "Limpiar e inspeccionar los cuchillos usados, devolviendo al servicio los que están en buen estado o reportando daños."],
         ["QA", "El tablero de la flota, los reportes y el panel de administración — gestiona los <b>cuchillos</b> y revisa los cuchillos <b>dañados</b>, pero no gestiona empleados ni la configuración de Teams."],
         ["<b>Gerente</b> (Manager)", "Un supervisor de piso. Hace <b>todas</b> las funciones de operador, saneamiento y QA, revisa los cuchillos <b>dañados</b> y puede <b>ver</b> la flota de cuchillos y el registro de auditoría — pero <b>no puede cambiar nada</b> en el panel de administración (vea la sección 10)."],
         ["Administrador (Admin)", "Todo, incluida la gestión de <b>empleados</b> y la configuración de <b>notificaciones de Teams</b>."]],
        [1.5 * inch, W - 1.5 * inch]))
    s.append(Spacer(1, 10))
    s.append(callout(
        "Cambie los PINs predeterminados antes de comenzar a usar el sistema",
        "Una instalación nueva incluye cuentas de ejemplo — Admin <b>0000</b>, Operador "
        "<b>1111</b>, Saneamiento <b>2222</b>, QA <b>3333</b>. Configure PINs reales en "
        "Admin → Workers desde el primer día y elimine las cuentas de ejemplo que no "
        "necesite. Los PINs se guardan cifrados y no pueden leerse — si alguien olvida "
        "el suyo, un gerente le asigna uno nuevo."))

    # ---------------- 3. Política de devolución ----------------
    s.append(section("3. Política de devolución — cuándo debe regresar un cuchillo", P(
        "El tipo de cuchillo fija su fecha de devolución automáticamente al retirarlo.")))
    s.append(table(
        [["Tipo de cuchillo", "Color en el quiosco", "Debe devolverse"],
         ["<b>Contacto con alimentos (FC)</b> — cuchillos #1–#14", "Ficha plateada/metálica", "<b>El mismo día</b>, al final del turno."],
         ["<b>Sin contacto con alimentos (NFC)</b> — cuchillos #51–#78", "Ficha azul", "<b>Al final de la semana</b> — vence el viernes, al final del turno."]],
        [1.9 * inch, 1.3 * inch, W - 3.2 * inch]))
    s.append(Spacer(1, 8))
    s.append(P(
        "La política aparece impresa en la parte superior del quiosco en inglés y "
        "español. Cuando un empleado retira un cuchillo, la pantalla de confirmación "
        "muestra la fecha y hora exactas de devolución, y esa hora aparece después en "
        "la ficha del cuchillo."))

    # ---------------- 4. Uso del quiosco ----------------
    s.append(section("4. Uso del quiosco (uso diario en el piso)", P(
        "El quiosco es el iPad compartido en el piso. No requiere iniciar sesión — cada "
        "acción se confirma con el PIN del propio empleado, que es lo que registra "
        "quién la hizo.")))

    s.append(KeepTogether([P("Retirar un cuchillo — Operador", "h2"), steps([
        "Toque el cuchillo que quiere. Debe tener un <b>anillo verde</b> (Disponible).",
        "Ingrese su PIN y toque <b>Next / Siguiente</b>.",
        "Aparece su nombre. Confirme que es usted — toque <b>Yes, that's me / Sí</b>. "
        "(Si no es su nombre, toque <b>Not me</b> e intente de nuevo.)",
        "La pantalla muestra cuándo debe <b>regresar</b> el cuchillo. La ficha ahora "
        "muestra su nombre arriba y un anillo amarillo.",
    ])]))
    s.append(figure_row([
        ("kiosk-pin", "Paso 2 — ingrese su PIN."),
        ("kiosk-confirm", "Paso 3 — confirme su nombre y vea la hora de devolución."),
    ]))

    s.append(KeepTogether([P("Devolver un cuchillo — Operador", "h2"), steps([
        "Toque su cuchillo (anillo amarillo, con su nombre).",
        "Ingrese su PIN, toque <b>Next</b> y confirme su nombre.",
        "El cuchillo pasa a <b>Esperando saneamiento</b> (anillo naranja). Con eso "
        "termina — no lo devuelva usted mismo al servicio.",
    ])]))
    s.append(Spacer(1, 4))
    s.append(P(
        "<i>Solo la persona que retiró un cuchillo (o un gerente) puede devolverlo.</i> "
        "Así cada devolución queda atribuida a la persona correcta.", "small"))

    s.append(KeepTogether([P("Limpiar y devolver al servicio — Saneamiento", "h2"), steps([
        "Toque un cuchillo con <b>anillo naranja</b> (Esperando saneamiento).",
        "Ingrese su PIN, toque <b>Next</b>, confirme su nombre y toque "
        "<b>Yes — continue / Sí</b>.",
        "Responda las cuatro preguntas de inspección (sección siguiente).",
        "Toque <b>Submit / Enviar</b>.",
    ])]))

    # ---------------- 5. Cómo leer el tablero ----------------
    s.append(section("5. Cómo leer el tablero del quiosco", P(
        "Cada cuchillo es una ficha. El <b>color de relleno</b> indica el tipo de "
        "cuchillo; el <b>anillo alrededor de la ficha</b> indica su estado.")))
    s.append(table(
        [["Color del anillo", "Estado", "Qué hacer"],
         ["Verde", "Disponible", "Listo para retirar."],
         ["Amarillo", "Retirado", "En uso — el nombre de quien lo tiene aparece arriba en la ficha, con la hora de devolución."],
         ["Naranja", "Esperando saneamiento", "Saneamiento debe limpiarlo e inspeccionarlo."],
         ["Rojo + “OVERDUE”", "Vencido", "Pasó su hora límite. Localícelo y devuélvalo ahora."],
         ["Rojo (rosa)", "Dañado — requiere gerente", "Fuera de uso hasta que un gerente lo revise."],
         ["Gris", "Fuera de servicio", "Retirado de la flota."]],
        [1.5 * inch, 1.55 * inch, W - 3.05 * inch]))
    s.append(Spacer(1, 10))
    s.append(figure("kiosk-board",
                    "Los cuchillos #2 y #6 están retirados (anillo amarillo, vencen hoy), el #9 "
                    "está vencido, el #4 y el #11 esperan saneamiento (naranja) y el #13 está "
                    "dañado. Los #1–#14 son de contacto con alimentos (plateados); los #51–#78 "
                    "son sin contacto con alimentos (azules).",
                    max_w=6.4 * inch, max_h=3.2 * inch))
    s.append(Spacer(1, 8))
    s.append(P(
        "Los contadores en la parte superior muestran cuántos cuchillos hay en cada "
        "estado. Si algo está vencido, un aviso rojo lista esos números de cuchillo. "
        "Cada ficha muestra además el número del cuchillo y el tipo (FC o NFC) en la "
        "parte inferior."))

    # ---------------- 6. Lista de verificación ----------------
    s.append(section("6. Saneamiento: lista de verificación de limpieza e inspección", P(
        "Antes de que un cuchillo usado pueda volver a producción, saneamiento debe "
        "responder las cuatro preguntas. Cada pregunta aparece en inglés y en español.")))
    s.append(table(
        [["#", "Pregunta", "Notas"],
         ["1", "<b>Cleaned?</b> / ¿Limpiado?", "Sí o No."],
         ["2", "<b>Inspected?</b> / ¿Inspeccionado?", "Sí o No."],
         ["3", "<b>Condition</b> / Condición", "Good / Bueno — o — Damaged / Dañado."],
         ["4", "<b>If damaged, why?</b> / ¿Por qué está dañado?", "Obligatoria cuando está Dañado. Se puede adjuntar una <b>foto</b> con la cámara del iPad (opcional pero recomendado)."]],
        [0.3 * inch, 2.1 * inch, W - 2.4 * inch]))
    s.append(Spacer(1, 10))
    s.append(figure_row([
        ("kiosk-checklist", "La lista de verificación mientras saneamiento la responde."),
        ("kiosk-checklist-damaged", "Al marcar Dañado aparecen el cuadro del motivo y el botón de foto."),
    ], max_h=3.7 * inch))
    s.append(Spacer(1, 10))
    s.append(callout(
        "La regla que el sistema hace cumplir",
        "Un cuchillo vuelve al servicio <b>solo</b> si se marca como limpiado <b>y</b> "
        "inspeccionado <b>y</b> su condición es Buena. Si alguna respuesta es No, el "
        "sistema se niega a devolverlo al servicio."))

    # ---------------- 7. Dañados ----------------
    s.append(section("7. Cuchillos dañados — revisión del gerente", P(
        "Cuando saneamiento marca un cuchillo como <b>Dañado</b>, el cuchillo queda "
        "retenido fuera de servicio de inmediato. Saneamiento no puede devolverlo y "
        "nadie puede retirarlo.")))
    s.append(bullets([
        "El motivo reportado (y la foto, si se tomó) se guarda con el cuchillo.",
        "Si las alertas de Teams están activadas, se publica un mensaje en el canal de "
        "inmediato para que un gerente se entere.",
        "Un <b>gerente (Admin)</b> lo revisa en el tablero de la flota: toque el "
        "cuchillo, lea <b>Reported damage</b> (daño reportado), vea la foto y elija "
        "<b>Return to service (manager)</b> (devolver al servicio) o "
        "<b>Retire (out of service)</b> (retirar del servicio).",
    ]))
    s.append(figure("board-damaged",
                    "Lo que ve el gerente: el motivo reportado, la foto y las dos decisiones "
                    "disponibles.", max_w=3.4 * inch, max_h=4.2 * inch))

    # ---------------- 8. Tareas del gerente ----------------
    s.append(section("8. Tareas del gerente en el tablero de la flota", P(
        "El tablero de la flota en <b>/</b> es para administradores y QA. Inicie sesión "
        "con su PIN. Toque cualquier cuchillo para abrir su panel de acciones.")))
    s.append(table(
        [["Acción", "Quién", "Cuándo aparece"],
         ["Check out / Return (retirar / marcar usado)", "Operador (incluye administradores)", "Las mismas acciones del ciclo de vida que en el quiosco."],
         ["Clean &amp; return to service (limpiar y devolver al servicio)", "Saneamiento (incluye administradores)", "El cuchillo espera saneamiento."],
         ["<b>Return to service (manager)</b>", "QA, Gerente o Admin", "El cuchillo está Dañado — borra la nota de daño y la foto."],
         ["Retire (out of service) (retirar del servicio)", "Admin / QA", "Cualquier cuchillo no retirado aún. Para cuchillos perdidos o rotos."],
         ["Restore to fleet (restaurar a la flota)", "Admin / QA", "El cuchillo está fuera de servicio."],
         ["Change knife type (cambiar tipo FC / NFC)", "Admin / QA", "Siempre — cambia las fechas de devolución futuras. Queda registrado. <i>No disponible para gerentes.</i>"],
         ["View full history (ver historial completo)", "Admin / QA", "Abre el registro completo del ciclo de vida de ese cuchillo."]],
        [2.2 * inch, 1.45 * inch, W - 3.65 * inch]))
    s.append(Spacer(1, 10))
    s.append(figure("board-fleet",
                    "El tablero de la flota. Filtros en la parte superior; toque cualquier "
                    "cuchillo para actuar sobre él.",
                    max_w=6.4 * inch, max_h=3.3 * inch))
    s.append(Spacer(1, 8))
    s.append(P(
        "Use los filtros sobre la cuadrícula para mostrar un solo estado. Al ver "
        "<b>Awaiting sanitation</b> (esperando saneamiento), el personal de saneamiento "
        "y los administradores tienen un botón <b>Select multiple</b> para limpiar "
        "varios cuchillos a la vez."))

    # ---------------- 9. Reportes ----------------
    s.append(section("9. Reportes", P(
        "<b>/reports</b> (administradores y QA) responde las preguntas del fin del turno.")))
    s.append(table(
        [["Panel", "Qué le dice"],
         ["Still checked out (aún retirados)", "Cuántos cuchillos están fuera ahora mismo y cuántos están vencidos."],
         ["Total checkouts (retiros totales)", "Conteo de uso acumulado."],
         ["Avg turnaround (tiempo promedio)", "Tiempo promedio desde que un cuchillo se devuelve hasta que queda limpio y de vuelta en servicio."],
         ["Cleanings (limpiezas)", "Número total de ciclos de limpieza registrados."],
         ["End-of-day sweep (barrido de fin de día)", "Una tabla con cada cuchillo aún fuera — quién lo tiene, desde cuándo, cuándo vence y si está vencido. <b>Revise esta lista antes del cierre del turno.</b>"],
         ["Most-used knives (cuchillos más usados)", "Las hojas de mayor uso — útil para detectar desgaste."]],
        [1.9 * inch, W - 1.9 * inch]))
    s.append(Spacer(1, 10))
    s.append(figure("reports", "La página de Reportes, incluido el barrido de fin de día.",
                    max_w=6.0 * inch, max_h=4.0 * inch))

    # ---------------- 10. Avanzado ----------------
    s.append(section("10. Avanzado: cada configuración de administración y qué hace", P(
        "El panel de Administración está en <b>/admin</b>, abierto a administradores, QA y "
        "gerentes. Si ya inició sesión en el tablero de la flota, no se pide un segundo "
        "PIN. El encabezado tiene un interruptor de <b>modo claro/oscuro</b> y un enlace "
        "de regreso a la flota.")))
    s.append(callout(
        "Qué ve un gerente aquí",
        "Un gerente abre la misma página pero en modo de <b>solo lectura</b>: la lista "
        "de la <b>flota de cuchillos</b> (Knife fleet) y el <b>registro de auditoría</b> "
        "(con su exportación a CSV). Add a knife, Workers y Advanced están ocultos, y "
        "los cuchillos no tienen botones Edit ni Remove. Todo lo que sigue en esta "
        "sección es, por lo tanto, <b>solo para admin/QA</b>. Los gerentes siguen "
        "haciendo todas las acciones de piso desde el tablero de la flota y el quiosco.", BLUE))
    s.append(Spacer(1, 8))
    s.append(callout(
        "Qué ve QA aquí",
        "QA gestiona los <b>cuchillos</b> (agregar, editar, eliminar, cambiar el tipo), el "
        "<b>logotipo del quiosco</b> y el <b>registro de auditoría</b>, y puede devolver "
        "cuchillos dañados al servicio. <b>Workers</b> y la configuración de "
        "<b>notificaciones de Teams</b> están ocultos — son solo para administradores.", BLUE))
    s.append(Spacer(1, 10))
    s.append(figure("admin-manager",
                    "La página de administración como la ve un gerente: la flota de cuchillos "
                    "(solo lectura) y el registro de auditoría — sin Add a knife, Workers ni "
                    "Advanced.",
                    max_w=6.2 * inch, max_h=3.6 * inch))

    s.append(P("Knives (cuchillos)", "h2"))
    s.append(table(
        [["Configuración", "Qué hace"],
         ["<b>Add a knife</b> (agregar cuchillo)", "Agrega un cuchillo nuevo a la flota por número, con su tipo (contacto con alimentos o sin contacto). Entra como Disponible. Los números deben ser únicos."],
         ["Lista <b>Knife fleet</b> (flota)", "Cada cuchillo con su tipo y estado actual."],
         ["Búsqueda (cuchillos)", "Filtra la lista por número, tipo (FC/NFC o el nombre completo) o estado (p. ej. “awaiting sanitation”)."],
         ["<b>Edit</b> (por cuchillo)", "Cambia el número o el tipo de un cuchillo. Queda registrado en la auditoría."],
         ["<b>Remove</b> (por cuchillo)", "<b>Elimina permanentemente</b> el cuchillo y su historial. Pensado para un cuchillo agregado por error. Bloqueado mientras el cuchillo esté retirado. Para sacar un cuchillo real de la rotación <b>conservando</b> su historial, use <b>Retire</b> en el tablero."]],
        [1.85 * inch, W - 1.85 * inch]))
    s.append(Spacer(1, 10))
    s.append(figure("admin-knives", "Admin - Knives (cuchillos).", max_w=4.2 * inch, max_h=3.6 * inch))

    s.append(P("Workers (empleados) &mdash; solo admin", "h2"))
    s.append(table(
        [["Configuración", "Qué hace"],
         ["<b>Add a worker</b> (agregar empleado)", "Crea un empleado: nombre, PIN (4–8 dígitos, debe ser único) y uno o más roles."],
         ["<b>Bulk upload (CSV)</b> (carga masiva)", "Agrega muchos empleados a la vez desde un CSV con columnas <b>name,pin,roles</b> (roles separados por <b>;</b> — p. ej. OPERATOR;SANITATION). Las filas con PIN duplicado o inválido se omiten y se reportan."],
         ["<b>Download sample CSV</b>", "Un archivo de ejemplo con el formato correcto para completar."],
         ["Lista <b>Employees</b> (empleados)", "Todos los empleados, ordenados por rol: Admin, QA, Operador, Saneamiento."],
         ["Búsqueda (empleados)", "Filtra la lista por nombre o rol."],
         ["<b>Export employees (CSV)</b>", "Descarga nombre, roles y estado activo. Los PINs están cifrados y no pueden exportarse."],
         ["<b>Edit</b> (por empleado)", "Cambia su nombre, sus roles o asigna un PIN nuevo (deje el PIN en blanco para conservar el actual)."],
         ["<b>Deactivate</b> / Reactivate", "Revoca o restaura el acceso <b>conservando</b> el historial de la persona. Úselo cuando alguien se va."],
         ["<b>Remove</b> (por empleado)", "Elimina el registro del empleado por completo. Prefiera Deactivate para conservar la auditoría."]],
        [1.85 * inch, W - 1.85 * inch]))
    s.append(Spacer(1, 10))
    s.append(figure("admin-workers", "Admin - Workers (empleados).", max_w=4.2 * inch, max_h=3.8 * inch))

    s.append(P("Sección Advanced (contraída de forma predeterminada)", "h2"))
    s.append(P(
        "Haga clic en <b>Advanced</b> para expandirla. Son configuraciones de "
        "instalación — rara vez necesitará cambiarlas en el día a día."))
    s.append(P("<b>Notificaciones de Microsoft Teams</b> &mdash; solo admin", "body"))
    s.append(table(
        [["Configuración", "Qué hace"],
         ["<b>Webhook URL</b>", "Adónde se publican las alertas. Créela en Teams: canal &gt; <b>menú “...”</b> &gt; <b>Workflows</b> → “Post to a channel when a webhook request is received”, y pegue la URL que genera (contiene <i>logic.azure.com</i>). Las URLs del conector antiguo “Incoming Webhook” también funcionan."],
         ["<b>Enable Teams notifications</b>", "Interruptor general. No se envía nada mientras esté apagado."],
         ["Notificar: <b>cuchillo marcado como dañado</b>", "Publica en el momento en que saneamiento reporta un daño, para que un gerente pueda revisarlo. <i>Activado de forma predeterminada.</i>"],
         ["Notificar: <b>cuchillo vencido</b>", "Pensado para el barrido de vencidos al final del día. Requiere una tarea programada que ejecute el barrido; la preferencia queda guardada y lista."],
         ["Notificar: <b>cuchillo retirado</b>", "Publica cada retiro, con la hora de devolución. <i>Desactivado de forma predeterminada.</i>"],
         ["Notificar: <b>cuchillo devuelto</b>", "Publica cada devolución. <i>Desactivado de forma predeterminada.</i>"],
         ["Notificar: <b>limpiado y devuelto al servicio</b>", "Publica cada limpieza completada. <i>Desactivado de forma predeterminada.</i>"],
         ["<b>Save</b> (guardar)", "Guarda la configuración. Si las notificaciones están activadas, se requiere una URL https válida y al menos un tipo de alerta."],
         ["<b>Send test message</b> (enviar prueba)", "Publica una línea de prueba en el canal para confirmar la conexión antes de depender de ella. Los errores informan exactamente lo que Teams respondió."]],
        [1.85 * inch, W - 1.85 * inch]))
    s.append(Spacer(1, 8))
    s.append(figure("admin-advanced",
                    "Admin - Advanced, expandido: notificaciones de Teams, logotipo del quiosco "
                    "y zona horaria del sistema.", max_w=6.0 * inch, max_h=4.2 * inch))
    s.append(Spacer(1, 6))
    s.append(P(
        "<i>Las alertas por acción (retiro / devolución / limpieza) generan mucho ruido "
        "en un piso ocupado — por eso comienzan desactivadas.</i>", "small"))

    s.append(Spacer(1, 10))
    s.append(P("<b>Kiosk logo (logotipo del quiosco)</b>", "body"))
    s.append(table(
        [["Configuración", "Qué hace"],
         ["<b>Choose File</b> (elegir archivo)", "Sube el logotipo de su empresa, que se muestra en la esquina superior izquierda del tablero del quiosco. PNG, JPG o SVG de menos de 500 KB."],
         ["<b>Remove logo</b> (quitar logotipo)", "Lo elimina; el quiosco vuelve a mostrar el ícono del cuchillo."]],
        [1.85 * inch, W - 1.85 * inch]))

    s.append(Spacer(1, 10))
    s.append(P("<b>System (sistema)</b> (solo lectura)", "body"))
    s.append(table(
        [["Lectura", "Qué significa"],
         ["<b>Timezone</b> (zona horaria)", "La zona horaria en la que se calculan todas las fechas de devolución — “fin del día” y “fin del viernes” siguen este reloj. Se define con la variable de entorno <b>TZ</b> en el servidor (p. ej. America/New_York). Si está mal, las horas de devolución estarán mal."],
         ["<b>Server time now</b> (hora del servidor)", "La hora actual del sistema en esa zona horaria. Compárela con un reloj en la pared para confirmar que la configuración es correcta."]],
        [1.85 * inch, W - 1.85 * inch]))
    s.append(Spacer(1, 6))
    s.append(P(
        "<i>Las horas de devolución se muestran en la zona horaria del dispositivo desde "
        "el que mira. Mantenga el iPad del quiosco en la zona horaria de la planta para "
        "que lo que ve el piso coincida con lo que registró el servidor.</i>", "small"))

    s.append(Spacer(1, 10))
    s.append(P("<b>Recent activity (registro de auditoría)</b>", "body"))
    s.append(table(
        [["Configuración", "Qué hace"],
         ["Tabla de actividad", "Las acciones más recientes: cuándo, qué cuchillo, qué pasó, quién lo hizo y cualquier nota (incluidas las respuestas de saneamiento)."],
         ["<b>Export full log (CSV)</b>", "Descarga el historial de auditoría <b>completo</b> para auditorías de seguridad alimentaria o una investigación de retiro de producto. Los registros nunca se editan ni se eliminan."]],
        [1.85 * inch, W - 1.85 * inch]))

    # ---------------- 11. Solución de problemas ----------------
    s.append(P("11. Solución de problemas", "h1"))
    s.append(table(
        [["Síntoma", "Causa y solución"],
         ["“PIN not recognized.” (PIN no reconocido)", "PIN incorrecto, o el empleado está desactivado. Un gerente puede asignar un PIN nuevo en Admin → Workers."],
         ["“This action requires the SANITATION role.”", "El PIN ingresado no tiene el rol que esa acción necesita — p. ej. un operador intentando limpiar. Use el PIN de la persona correcta, o pida a un gerente que agregue el rol."],
         ["El cuchillo fue retirado por otra persona", "Solo la persona que tiene un cuchillo (o un gerente) puede devolverlo. Un gerente puede devolverlo desde el tablero de la flota."],
         ["Un cuchillo no se puede retirar", "No está Disponible — está esperando saneamiento, dañado o retirado. Guíese por el color del anillo."],
         ["Las fechas de devolución están corridas por horas", "La zona horaria del servidor está mal. Revise Admin → Advanced → System y configure la variable de entorno <b>TZ</b>."],
         ["La prueba de Teams dice HTTP 405", "La URL pegada no es un webhook (suele ser un enlace al canal). Cree un webhook de Workflows como se describe en la sección 10."],
         ["Teams no publica nada", "Verifique que <b>Enable Teams notifications</b> esté activado y que haya al menos un tipo de alerta marcado; luego use <b>Send test message</b>."],
         ["El quiosco muestra información vieja", "El tablero se actualiza solo cada pocos segundos; si parece congelado, recargue la página en el iPad."]],
        [2.1 * inch, W - 2.1 * inch]))

    s.append(Spacer(1, 16))
    s.append(callout(
        "El ritmo diario — la versión corta",
        "Los operadores retiran y devuelven cuchillos en el quiosco. Saneamiento limpia "
        "e inspecciona todo lo naranja. Antes del cierre del turno, un gerente abre "
        "<b>Reports → End-of-day sweep</b> y persigue todo lo que siga fuera. Los "
        "cuchillos dañados esperan a un gerente.", BLUE))

    doc.build(s)
    print(f"wrote {OUT}")


if __name__ == "__main__":
    build()
