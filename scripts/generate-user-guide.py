"""Build the Spanish end-user PDF from actual UI screenshots.

Requires reportlab and Pillow, plus DejaVu Sans TTF fonts (GUIDE_FONT_DIR can
override the system font directory). No app code or user library is modified.
"""
from pathlib import Path
import os
from html import escape
from PIL import Image as PILImage
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import (
    BaseDocTemplate, Frame, PageTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, Image,
)

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'docs' / 'guide-assets'
OUTPUT = ROOT / 'docs' / 'Guia-de-usuario-VetDose.pdf'
FONT_DIR = Path(os.environ.get('GUIDE_FONT_DIR', '/usr/share/fonts/truetype/dejavu'))
for name, filename in [('Guide', 'DejaVuSans.ttf'), ('GuideBold', 'DejaVuSans-Bold.ttf')]:
    pdfmetrics.registerFont(TTFont(name, str(FONT_DIR / filename)))
pdfmetrics.registerFontFamily('Guide', normal='Guide', bold='GuideBold', italic='Guide', boldItalic='GuideBold')

TEAL = colors.HexColor('#126B5E')
INK = colors.HexColor('#203B40')
MUTED = colors.HexColor('#5D7377')
SOFT = colors.HexColor('#EAF4EF')
BORDER = colors.HexColor('#DCE7E3')
AMBER = colors.HexColor('#7D551D')
AMBER_BG = colors.HexColor('#FFF5E4')
PAGE_W, PAGE_H = A4
WIDTH = PAGE_W - 88
SITE = 'https://julve.github.io/vetdose/'

styles = {
    'body': ParagraphStyle('body', fontName='Guide', fontSize=10.6, leading=15.7, textColor=INK, spaceAfter=8),
    'small': ParagraphStyle('small', fontName='Guide', fontSize=9, leading=13, textColor=MUTED, spaceAfter=6),
    'lead': ParagraphStyle('lead', fontName='Guide', fontSize=12, leading=18, textColor=MUTED, spaceAfter=14),
    'title': ParagraphStyle('title', fontName='GuideBold', fontSize=24, leading=30, textColor=INK, spaceAfter=12),
    'sub': ParagraphStyle('sub', fontName='GuideBold', fontSize=13.2, leading=18, textColor=TEAL, spaceBefore=10, spaceAfter=9),
    'cell': ParagraphStyle('cell', fontName='Guide', fontSize=9.5, leading=13.5, textColor=INK),
    'head': ParagraphStyle('head', fontName='GuideBold', fontSize=9.5, leading=13, textColor=colors.white),
    'cover': ParagraphStyle('cover', fontName='GuideBold', fontSize=42, leading=48, textColor=TEAL, spaceAfter=8),
    'cover_sub': ParagraphStyle('cover_sub', fontName='GuideBold', fontSize=25, leading=32, textColor=INK, spaceAfter=15),
}

def p(text, style='body'):
    return Paragraph(text, styles[style])

def gap(height=8):
    return Spacer(1, height)

def box(text, warning=False, width=WIDTH):
    cell = p(text)
    table = Table([[cell]], colWidths=[width])
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), AMBER_BG if warning else SOFT),
        ('BOX', (0, 0), (-1, -1), .6, BORDER),
        ('LEFTPADDING', (0, 0), (-1, -1), 13), ('RIGHTPADDING', (0, 0), (-1, -1), 13),
        ('TOPPADDING', (0, 0), (-1, -1), 11), ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
    ]))
    return table

def steps(items, width=WIDTH):
    rows = [[p(f'<b>{n:02}</b>'), p(text)] for n, text in enumerate(items, 1)]
    table = Table(rows, colWidths=[29, width - 29])
    table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'), ('TEXTCOLOR', (0, 0), (0, -1), TEAL),
        ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 4), ('BOTTOMPADDING', (0, 0), (-1, -1), 6),
    ]))
    return table

def grid(headers, rows, widths):
    data = [[p(escape(str(v)), 'head') for v in headers]]
    data += [[p(v, 'cell') for v in row] for row in rows]
    table = Table(data, colWidths=widths, repeatRows=1, hAlign='LEFT')
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), TEAL), ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, colors.HexColor('#F5F8F6')]),
        ('LINEBELOW', (0, 1), (-1, -1), .4, BORDER),
        ('LEFTPADDING', (0, 0), (-1, -1), 9), ('RIGHTPADDING', (0, 0), (-1, -1), 9),
        ('TOPPADDING', (0, 0), (-1, -1), 8), ('BOTTOMPADDING', (0, 0), (-1, -1), 8),
    ]))
    return table

def screenshot(name, max_w=WIDTH, max_h=390):
    path = ASSETS / name
    with PILImage.open(path) as image:
        w, h = image.size
    scale = min(max_w/w, max_h/h)
    return Image(str(path), width=w*scale, height=h*scale, hAlign='CENTER')

def columns(left, right, left_w=214, gap_w=20):
    table = Table([[left, '', right]], colWidths=[left_w, gap_w, WIDTH-left_w-gap_w])
    table.setStyle(TableStyle([
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 0), ('RIGHTPADDING', (0, 0), (-1, -1), 0),
        ('TOPPADDING', (0, 0), (-1, -1), 0), ('BOTTOMPADDING', (0, 0), (-1, -1), 0),
    ]))
    return table

class SectionTitle(Paragraph):
    def __init__(self, text, key):
        super().__init__(text, styles['title'])
        self.key, self.outline_title = key, text

class GuideDocument(BaseDocTemplate):
    def afterFlowable(self, flowable):
        if isinstance(flowable, SectionTitle):
            self.canv.bookmarkPage(flowable.key)
            self.canv.addOutlineEntry(flowable.outline_title, flowable.key, 0, False)

def page_frame(canvas, doc):
    canvas.saveState()
    canvas.setFillColor(TEAL)
    canvas.roundRect(44, PAGE_H-39, 16, 16, 4, fill=1, stroke=0)
    canvas.setFillColor(colors.white)
    canvas.setFont('GuideBold', 13)
    canvas.drawCentredString(52, PAGE_H-35.8, '+')
    canvas.setFillColor(INK)
    canvas.setFont('GuideBold', 10)
    canvas.drawString(67, PAGE_H-35, 'VetDose')
    canvas.setFont('Guide', 8)
    canvas.setFillColor(MUTED)
    canvas.drawRightString(PAGE_W-44, PAGE_H-35, 'GUÍA PRÁCTICA DE USUARIO')
    canvas.setStrokeColor(BORDER)
    canvas.line(44, 38, PAGE_W-44, 38)
    canvas.setFont('Guide', 8)
    canvas.drawString(44, 24, 'VetDose 1.0 · Ejemplos ficticios · Sin pautas precargadas')
    canvas.drawRightString(PAGE_W-44, 24, f'{doc.page:02} / 10')
    canvas.restoreState()

story = []
def section(number, title, key, intro=None):
    if story:
        story.append(PageBreak())
    story.append(p(f'APRENDE PASO A PASO · {number:02}', 'small'))
    story.append(SectionTitle(title, key))
    if intro:
        story.append(p(intro, 'lead'))

# 1. Cover and interactive contents.
story.extend([gap(16), p('VetDose', 'cover'), p('Guía práctica de uso', 'cover_sub'),
    p('Para profesionales de medicina veterinaria<br/>Caninos y felinos · Computadora y teléfono', 'lead'),
    box('<b>Tú eliges la pauta. La app calcula la cantidad.</b><br/>VetDose no propone medicamentos, dosis ni tratamientos. Empieza con una biblioteca vacía y utiliza únicamente los valores que tú introduces.'), gap(17),
    p('Abre el sitio en tu navegador', 'sub'),
    p(f'<link href="{SITE}" color="#126B5E"><b>{SITE}</b></link>', 'lead'),
    p('El enlace requiere que el responsable haya activado la publicación del sitio. Si no carga o muestra 404, solicita el enlace activo a quien te compartió la app.', 'small'),
    gap(7), p('Encuentra lo que necesitas', 'sub')])
contents = [
    ('Abrir en el teléfono', 'phone', 2), ('Hacer el primer cálculo', 'first', 3),
    ('Entender las unidades', 'units', 4), ('Leer y comprobar el resultado', 'result', 5),
    ('Crear y reutilizar la biblioteca', 'library', 6), ('Elegir la presentación', 'forms', 7),
    ('Respaldar y cambiar de dispositivo', 'backup', 8), ('Resolver problemas frecuentes', 'help', 9),
    ('Lista de comprobación final', 'check', 10),
]
toc = Table([[p(f'<link href="#{key}" color="#126B5E">{name}</link>'), p(str(page))] for name,key,page in contents], colWidths=[WIDTH-38,38])
toc.setStyle(TableStyle([('LEFTPADDING',(0,0),(-1,-1),0),('RIGHTPADDING',(0,0),(-1,-1),0),('TOPPADDING',(0,0),(-1,-1),3),('BOTTOMPADDING',(0,0),(-1,-1),3),('LINEBELOW',(0,0),(-1,-1),.3,BORDER)]))
story.extend([toc, gap(13), p('<b>Los ejemplos de esta guía son ficticios y no deben utilizarse para tratar pacientes.</b> La exactitud matemática de un resultado no garantiza su idoneidad clínica.', 'small')])

# 2. Phone workflow.
section(1, 'Abre la app en el teléfono', 'phone', 'Comparte un enlace web por WhatsApp; no hace falta enviar el archivo HTML.')
phone_text = [
    p('<b>1. Abre el enlace del sitio.</b><br/>Utiliza Safari en iPhone o Chrome en Android.'),
    p('<b>2. Sal del visor de WhatsApp.</b><br/>Si se abre dentro de WhatsApp, busca «Abrir en el navegador». La opción puede cambiar de nombre según el teléfono.'),
    p('<b>3. Usa siempre el mismo navegador.</b><br/>Así encontrarás la biblioteca guardada en ese navegador.'),
    p('<b>4. Opcional: crea un acceso directo.</b><br/>En iPhone: Compartir → Añadir a pantalla de inicio. En Android: menú ⋮ → Añadir a pantalla de inicio, si está disponible.'),
    p('El acceso directo no garantiza recarga sin conexión. Necesitas Internet para abrir o recargar la versión web.', 'small'),
]
story.extend([columns(screenshot('phone-start.png',195,410), phone_text,205), gap(13),
    grid(['Pestaña', 'Para qué sirve'],[
        ['<b>Calculadora</b>','Introducir datos y obtener una cantidad matemática.'],
        ['<b>Biblioteca</b>','Crear medicamentos, pautas y presentaciones propios.'],
        ['<b>Configuración</b>','Cambiar el tema, exportar e importar respaldos JSON.'],
    ],[115,WIDTH-115]), gap(10),
    p('No necesitas una cuenta de VetDose. Cada visitante conserva su propia biblioteca local; no existe una biblioteca compartida ni sincronización automática.', 'small')])

# 3. Main entry.
section(2, 'Haz tu primer cálculo', 'first', 'Puedes calcular manualmente sin guardar un medicamento en la biblioteca.')
story.extend([steps([
    '<b>Paciente:</b> elige Canino o Felino e introduce el peso positivo en kg. El identificador es opcional y no se guarda en la biblioteca.',
    '<b>Origen del medicamento:</b> selecciona «Entrada manual · sin guardar». Escribe el nombre y el principio activo único.',
    '<b>Operación:</b> deja «Cálculo por dosis». Escribe la dosis que tú hayas elegido y selecciona su unidad completa.',
    '<b>Vía y frecuencia:</b> registra la vía y escribe el intervalo en «Administrar cada (horas)». Para una dosis diaria, este intervalo es obligatorio. La duración en días es opcional.',
    '<b>Presentación:</b> selecciona la forma farmacéutica e introduce el contenido, su unidad y los datos que aparezcan. En líquidos debes indicar el volumen de referencia en mL.',
    '<b>Resultado:</b> pulsa «Calcular cantidad». En teléfono, la pantalla se desplaza al resultado o al error que debes corregir.',
]), gap(12), box('<b>Antes de calcular:</b> comprueba el peso, la unidad de dosis y la etiqueta del producto. Un número correcto con una unidad equivocada produce una cantidad equivocada.', True),
    gap(13), p('Cómo escribir números', 'sub'),
    p('Puedes usar punto o coma decimal: <b>2.5</b> y <b>2,5</b> representan lo mismo. No uses separadores de miles ni combines punto y coma en el mismo número.'),
    p('Cambiar cualquier entrada borra el resultado anterior hasta que vuelvas a calcular. Los cambios de esta pantalla son temporales: no modifican automáticamente la biblioteca.', 'small')])

# 4. Units and daily example.
section(3, 'Entiende las unidades de dosis', 'units', 'Lee la unidad completa: «por dosis» y «por día» tienen significados diferentes.')
story.extend([grid(['Unidad', 'Qué significa'],[
    ['mg/kg/dosis','Miligramos por kg en <b>cada administración</b>.'],
    ['µg/kg/dosis','Microgramos por kg en <b>cada administración</b>.'],
    ['mg/kg/día','Total de miligramos por kg en <b>24 horas</b>; se reparte según el intervalo.'],
    ['µg/kg/día','Total de microgramos por kg en <b>24 horas</b>; se reparte según el intervalo.'],
    ['mg/dosis · µg/dosis','Cantidad fija por administración; no se multiplica por el peso.'],
    ['UI/kg/dosis','Unidades internacionales por kg en cada administración.'],
    ['UI/dosis','Cantidad fija de unidades internacionales por administración.'],
],[125,WIDTH-125]), gap(12), box('<b>«Administrar cada (horas)» es el intervalo.</b><br/>Escribe las horas entre administraciones, no el número de administraciones al día. La app obtiene el promedio de administraciones diarias como 24 ÷ intervalo.'),
    gap(9), p('Ejercicio ficticio: una dosis diaria', 'sub'),
    p('Solo para aprender el cálculo: peso <b>3 kg</b>, dosis <b>24 mg/kg/día</b>, intervalo <b>8 h</b> y concentración <b>12 mg/mL</b>.'),
    grid(['Paso', 'Resultado esperado'],[
        ['3 × 24','72 mg al día'], ['24 ÷ 8','3 administraciones al día'],
        ['72 ÷ 3','24 mg por administración'], ['24 ÷ 12','2 mL por administración'],
    ],[WIDTH/2,WIDTH/2]), gap(10),
    p('<b>1 mg = 1000 µg.</b> Las UI son actividad biológica: la app no convierte UI a masa ni masa a UI. Estos valores no constituyen una pauta terapéutica.', 'small')])

# 5. Result with real screenshot.
section(4, 'Lee y comprueba el resultado', 'result', 'El número destacado es una cantidad matemática; revisa también los detalles y las advertencias.')
result_notes = [
    p('<b>Ejemplo de la captura</b>', 'sub'),
    p('Sustancia ficticia X: peso 4 kg, dosis 6 mg/kg/dosis, solución de 12 mg por 1 mL, cada 8 h durante 2 días.'),
    p('<b>Por administración:</b><br/>4 × 6 = 24 mg.<br/>24 ÷ 12 = <b>2 mL</b>.'),
    p('<b>Cantidad diaria:</b><br/>3 administraciones × 24 mg = <b>72 mg/día</b>.'),
    p('<b>Total del tratamiento:</b><br/>6 administraciones × 2 mL = <b>12 mL</b>.'),
    p('Comprueba especie, peso, principio activo, dosis, vía, presentación, frecuencia y duración. Lee el procedimiento para detectar errores de entrada.'),
    p('«Imprimir resultado» abre la impresión del navegador. Si este lo permite, puedes guardar el informe como PDF. El identificador del paciente puede aparecer en ese informe.', 'small'),
]
story.extend([columns(screenshot('result.png',212,450),result_notes,226),gap(10),
    box('<b>Sobre el total:</b> la app cuenta una administración al inicio y excluye el instante final del tratamiento. Confirma que esa convención coincide con el calendario real.'),gap(9),
    p('No se redondea a una cantidad administrable. Una fracción de tableta, cápsula, sobre o gota no demuestra que el producto pueda dividirse ni medirse así. La pantalla muestra hasta 12 cifras significativas.', 'small')])

# 6. Library.
section(5, 'Crea y reutiliza tu biblioteca', 'library', 'Un medicamento puede tener varias pautas y varias presentaciones, sin duplicar su registro.')
story.extend([screenshot('library.png',WIDTH,120),gap(8),p('Captura con un registro ficticio. No es un medicamento ni una pauta para uso clínico.', 'small'),
    steps([
        'Abre <b>Biblioteca → Nuevo medicamento</b>. Escribe nombre y principio activo único. Puedes añadir observaciones, precauciones, referencia y fecha de revisión.',
        'Pulsa <b>Agregar pauta</b>. Registra indicación, especie, dosis y unidad, vía e intervalo. La duración es opcional. Puedes agregar otras pautas para otra indicación o especie.',
        'Pulsa <b>Agregar presentación</b>. Escribe un nombre que la identifique, selecciona su forma y registra el contenido y las unidades de la etiqueta. Puedes agregar más presentaciones.',
        'Pulsa <b>Guardar medicamento</b>. Para editarlo después, vuelve a Biblioteca y pulsa Editar.',
        'Para calcular, pulsa <b>Usar</b>. En Calculadora selecciona expresamente la <b>Pauta registrada</b> y la <b>Presentación registrada</b>; revisa los datos del paciente y calcula.',
    ]),gap(7),box('<b>Si registraste un intervalo de dosis:</b> al cargar la pauta, la dosis queda vacía. Debes elegir expresamente un valor dentro de los límites; la app no elige un punto medio.'),gap(9),
    p('<b>Buscar y filtrar:</b> busca por nombre o principio activo y filtra por especie. <b>Duplicar:</b> crea una copia editable que debes guardar. <b>Eliminar:</b> pide confirmación y elimina sus pautas y presentaciones.', 'small'),
    p('Una pauta de otra especie se deshabilita y no puede calcularse con ese paciente. Editar un dato en Calculadora no actualiza el medicamento guardado.', 'small')])

# 7. Presentations.
section(6, 'Elige la presentación correcta', 'forms', 'Copia los datos de la etiqueta y comprueba que cada número corresponda al campo adecuado.')
story.extend([grid(['Presentación', 'Qué introducir / qué se obtiene'],[
    ['<b>Tableta</b>','Contenido en mg o µg por tableta. Resultado: número matemático de tabletas. Marca solo las fracciones autorizadas que tú hayas confirmado.'],
    ['<b>Cápsula o sobre</b>','Contenido por unidad. El resultado puede ser decimal; la app no asume que pueda abrirse o dividirse.'],
    ['<b>Solución / suspensión</b>','Cantidad de activo y volumen de referencia. Si la etiqueta dice mg/5 mL, el volumen de referencia es <b>5</b>. Resultado en mL.'],
    ['<b>Inyectable</b>','Cantidad en mg, µg o UI y volumen de referencia en mL. Resultado en mL.'],
    ['<b>Vial reconstituido</b>','Contenido total y <b>volumen FINAL</b> en mL. El diluyente añadido es un dato distinto y no sustituye al volumen final.'],
    ['<b>Polvo / granulado</b>','Contenido en mg/g o µg/g. Resultado en gramos de preparación.'],
    ['<b>Porcentaje p/v</b>','Gramos de activo por 100 mL de preparación. Permite obtener concentración de masa por volumen.'],
    ['<b>Porcentaje p/p</b>','Gramos de activo por 100 g de preparación. Permite obtener concentración de masa por masa.'],
    ['<b>Porcentaje v/v</b>','mL de activo por 100 mL. Solo contenido en volumen medido; no se convierte a masa sin datos suficientes.'],
    ['<b>Gotas</b>','Concentración por volumen. Solo muestra equivalencia en gotas si introduces el factor gotas/mL del producto y dispositivo.'],
    ['<b>Crema / ungüento</b>','Usa «Contenido en cantidad medida». Introduce concentración y gramos medidos. El resultado es contenido de activo, no una dosis sistémica.'],
],[128,WIDTH-128]),gap(11),
    box('<b>No se inventan parámetros.</b> Sin volumen final, factor de gotas u otros datos necesarios, no debes completar el cálculo con suposiciones.',True),gap(7),
    p('Para un tópico porcentual, elige «Preparación porcentual» y «Contenido en cantidad medida». No utilices el contenido obtenido como una pauta terapéutica sistémica.', 'small')])

# 8. Backups.
section(7, 'Respalda y cambia de dispositivo', 'backup', 'Tu biblioteca pertenece a ese navegador. Exportar JSON es la forma de conservarla y trasladarla.')
story.extend([screenshot('backup.png',WIDTH,95),gap(8),p('Para crear un respaldo', 'sub'),
    steps([
        'Abre <b>Configuración → Exportar biblioteca JSON</b>.',
        'Localiza el archivo descargado en Descargas o Archivos. Según el dispositivo, debes elegir dónde guardarlo. Conserva una copia fuera del navegador.',
        'Para cambiar de dispositivo, transfiere ese <b>archivo JSON</b> al otro teléfono o computadora. El PDF de esta guía y el archivo HTML no contienen tu biblioteca.',
    ]),p('Para recuperar o importar una biblioteca', 'sub'),
    steps([
        'En el otro dispositivo, abre la app en tu navegador habitual y ve a <b>Configuración</b>.',
        'En <b>Archivo de respaldo JSON</b>, selecciona el archivo. Elige el modo de importación.',
        '<b>Fusionar:</b> conserva lo actual e incorpora registros nuevos; omite copias idénticas. Si detecta un conflicto, bloquea la importación para que lo revises.',
        '<b>Reemplazar:</b> sustituye toda la biblioteca y pide confirmación. Exporta primero lo que ya tengas guardado.',
        'Pulsa <b>Validar e importar</b>. Lee el mensaje de confirmación y revisa los medicamentos en Biblioteca.',
    ]),gap(8),box('<b>Haz copias periódicas y antes de borrar datos del navegador.</b><br/>No existe sincronización automática entre dispositivos. El respaldo incluye medicamentos, pautas y presentaciones; no incluye cálculos ni identificadores de pacientes.'),
    gap(7),p('El archivo debe ser un respaldo JSON válido de VetDose y no superar 5 MB. No basta con cambiar la extensión de otro archivo a .json.', 'small')])

# 9. Troubleshooting.
section(8, 'Resuelve problemas frecuentes', 'help', 'Primero revisa el mensaje de la app. No cambies unidades ni valores solo para hacer desaparecer un error.')
story.extend([grid(['Qué ocurre', 'Qué hacer'],[
    ['El enlace no abre o muestra 404.','Comprueba Internet y el enlace. Pide al responsable que confirme que GitHub Pages está publicado. No necesitas descargar el código fuente para usar el sitio.'],
    ['El HTML recibido por WhatsApp no funciona.','Abre el <b>enlace web</b> en Safari o Chrome. El visor de archivos de WhatsApp no equivale a un navegador completo.'],
    ['La dosis diaria no calcula.','Introduce el intervalo en «Administrar cada (horas)». No escribas ahí el número de administraciones diarias.'],
    ['La app dice «unidades incompatibles».','Compara la unidad de la dosis con la presentación. No conviertas UI a mg ni un porcentaje v/v a masa. Verifica la etiqueta y la pauta original.'],
    ['La pauta es de otra especie.','Selecciona el paciente correcto o una pauta registrada para esa especie. No modifiques la especie para forzar un cálculo.'],
    ['El resultado desapareció.','Es normal después de cambiar una entrada: vuelve a revisar los datos y pulsa «Calcular cantidad».'],
    ['La biblioteca parece vacía.','Comprueba navegador, perfil y dirección del sitio. Cada origen y navegador tiene sus propios datos. Si tienes un respaldo, impórtalo.'],
    ['No se guarda o indica falta de almacenamiento.','Exporta lo que esté disponible antes de cerrar. Usa un navegador habitual sin modo privado. No borres datos de la app sin respaldo.'],
    ['Hay conflicto al fusionar.','Puede haber cambios con el mismo identificador o posibles duplicados. Revisa las copias. No uses Reemplazar sin respaldar lo actual.'],
    ['Indica datos corruptos o cambios de otra pestaña.','En caso de corrupción, descarga los originales para recuperación desde Configuración. Si cambió otra pestaña, exporta tu copia y recarga. Usa una sola pestaña para editar.'],
],[145,WIDTH-145]),gap(10),
    p('Una entrada inválida o un archivo JSON inválido no deben resolverse inventando concentraciones, densidades o pautas. Si persiste el problema, conserva el respaldo y anota el mensaje exacto para pedir ayuda.', 'small')])

# 10. Final quick checklist.
section(9, 'Comprueba antes de utilizar el resultado', 'check', 'Una revisión breve de los datos evita confundir una cuenta correcta con una decisión terapéutica válida.')
checks = [
    ('Paciente','Especie y peso actual en kg; no se arrastraron datos de otro paciente.'),
    ('Pauta','Dosis elegida por el profesional, unidad completa y diferencia entre día y administración.'),
    ('Producto','Principio activo único, presentación y concentración de la etiqueta correctos.'),
    ('Frecuencia','Horas entre administraciones y duración, si corresponde; calendario real confirmado.'),
    ('Cantidad','Se distingue la cantidad de principio activo de los mL, tabletas, cápsulas, sobres o gramos.'),
    ('Medición','La cantidad puede medirse o fraccionarse según el producto y el dispositivo; no se redondeó por intuición.'),
    ('Advertencias','Se leyó el procedimiento y todas las advertencias. No se interpreta el resultado como validación clínica.'),
    ('Respaldo','La biblioteca tiene una copia JSON fuera del navegador y se sabe dónde está guardada.'),
]
story.extend([grid(['Revisión', 'Confirma'],[[f'<b>{a}</b>',b] for a,b in checks],[110,WIDTH-110]),gap(13),
    box('<b>Qué no hace VetDose 1.0</b><br/>No elige tratamientos ni dosis. No calcula ajustes renales o hepáticos, límites terapéuticos, toxicidad, infusiones continuas ni combinaciones de principios activos. No convierte UI a masa y no garantiza almacenamiento indefinido.',True),gap(13),
    p('Guarda y comparte esta guía', 'sub'),
    p('Puedes enviar este PDF por WhatsApp o correo. Para usar la app, comparte el enlace del sitio. Para trasladar una biblioteca, comparte únicamente su respaldo JSON por el medio que decidas.'),
    p(f'<link href="{SITE}" color="#126B5E"><b>Abrir el sitio de VetDose</b></link> · Disponible cuando el responsable active su publicación.', 'small'),
    p('Guía de VetDose 1.0 con capturas de un navegador de pruebas y datos ficticios. Los menús del teléfono pueden variar. Sin validación física en iPhone o Android.', 'small')])

doc = GuideDocument(str(OUTPUT), pagesize=A4, leftMargin=44, rightMargin=44, topMargin=57, bottomMargin=49,
                    title='VetDose 1.0 — Guía práctica de usuario', author='VetDose',
                    subject='Uso de la calculadora, biblioteca y respaldos. Ejemplos ficticios.',
                    pageCompression=1, allowSplitting=1)
doc.addPageTemplates(PageTemplate(id='guide', frames=[Frame(44,49,WIDTH,PAGE_H-106,leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)], onPage=page_frame))
doc.build(story)
if doc.page != 10:
    raise SystemExit(f'Revisar paginación: se esperaban 10 páginas y se generaron {doc.page}.')
print(f'PDF generado: {OUTPUT} ({OUTPUT.stat().st_size:,} bytes)')
