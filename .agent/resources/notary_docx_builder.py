import sys
import json
from docxtpl import DocxTemplate
import os

def render_deed(template_path, output_path, json_data_str):
    """
    Toma una plantilla Word (con tags Jinja2 como {{variable}}),
    inyecta un JSON de contexto y devuelve un nuevo archivo Word.
    """
    try:
        # Cargar los datos del contexto
        context = json.loads(json_data_str)
        
        # Cargar la plantilla DOCX
        doc = DocxTemplate(template_path)
        
        # Renderizar la plantilla con los datos
        doc.render(context)
        
        # Asegurarse que el directorio de salida existe
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        
        # Guardar el nuevo documento
        doc.save(output_path)
        print(f"SUCCESS: Documento generado correctamente en '{output_path}'")
        
    except Exception as e:
        print(f"ERROR: No se pudo generar el documento. Detalle: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print("Uso: python notary_docx_builder.py <ruta_plantilla.docx> <ruta_salida.docx> '<json_datos>'")
        sys.exit(1)
        
    template_file = sys.argv[1]
    output_file = sys.argv[2]
    json_data = sys.argv[3]
    
    render_deed(template_file, output_file, json_data)
