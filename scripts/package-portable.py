"""Package the current app and its PDF manual, using only Python's standard library."""
from pathlib import Path
from zipfile import ZipFile, ZIP_DEFLATED
import json

root = Path(__file__).resolve().parents[1]
version = json.loads((root / 'package.json').read_text())['version']
target = root / 'dist' / f'VetDose-{version}.zip'
files = {
    'VetDose.html': root / 'dist' / 'VetDose.html',
    'Guia-de-usuario-VetDose.pdf': root / 'docs' / 'Guia-de-usuario-VetDose.pdf',
    'USER-GUIDE.md': root / 'README.md',
    'docs/HOSTING.md': root / 'docs' / 'HOSTING.md',
    'docs/VALIDACION.md': root / 'docs' / 'VALIDACION.md',
}
for path in files.values():
    if not path.is_file():
        raise SystemExit(f'Falta un archivo de distribución: {path}')
if files['VetDose.html'].read_bytes() != (root / 'docs' / 'index.html').read_bytes():
    raise SystemExit('Regenera el HTML portable y el sitio antes de empaquetar.')
with ZipFile(target, 'w', ZIP_DEFLATED) as archive:
    for name, path in files.items():
        archive.write(path, name)
    archive.writestr('LEEME.txt', f'''VetDose {version}

Extrae todo el ZIP y abre VetDose.html en un navegador de computadora.
La guía PDF debe estar junto al HTML para abrirla desde Configuración.
En un teléfono, utiliza el sitio web publicado y comparte su enlace por WhatsApp.

* indica los datos obligatorios para la operación actual.
Los ejemplos bajo los campos son ficticios, sin valor clínico; no vienen precargados.
Guarda y traslada tu biblioteca con Exportar/Importar JSON.
Tu biblioteca no está dentro del HTML ni del PDF y no se comparte con otros visitantes.
''')
with ZipFile(target) as archive:
    assert archive.testzip() is None
    for name, path in files.items():
        assert archive.read(name) == path.read_bytes()
print(f'Paquete portable verificado: {target.name} ({target.stat().st_size:,} bytes)')
