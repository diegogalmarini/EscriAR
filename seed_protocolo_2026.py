#!/usr/bin/env python3
"""
seed_protocolo_2026.py — Carga masiva del protocolo 2026 a Supabase
===================================================================
Inserta las 58 escrituras + 4 errose del Protocolo 2026 en protocolo_registros.
Sube los 56 PDFs a Supabase Storage bucket "protocolo".

Uso:
  python seed_protocolo_2026.py                # carga todo
  python seed_protocolo_2026.py --dry-run      # simula sin insertar
  python seed_protocolo_2026.py --data-only    # solo datos, sin PDFs
  python seed_protocolo_2026.py --pdf-only     # solo PDFs (requiere datos ya insertados)
"""

import sys
import os
from pathlib import Path
from supabase import create_client

# ─── Config ───
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://qcqrcrpnnvvlitiidrlc.supabase.co")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjcXJjcnBubnZ2bGl0aWlkcmxjIiwi"
    "cm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI5MDk0MSwiZXhwIjoyMDgz"
    "ODY2OTQxfQ.glvDtnzbolcUY5u2hrp2flTuLa3VNRFDNsapp1qOs44"
))

PDF_DIR = Path(r"C:\Users\diego\NotiAr\protocolo_2026_pdfs")
STORAGE_BUCKET = "protocolo"
ANIO = 2026

# ─── Data from the XLSX spreadsheet ───
PROTOCOLO_DATA = [
    # (nro_escritura, folios, dia, mes, tipo_acto, es_errose, vendedor_acreedor, comprador_deudor, codigo_acto)
    (1, "001/005", 5, 1, "venta", False, "ROTH, Veronica Patricia", "LAVAYEN, Walter y BROGGI, Marina", "100-00"),
    (2, "006/010", 6, 1, "venta - ext. Usuf", False, "JUAN, Ana y otro", "CASTILLO MARACAY, Ramses", "100-00 / 401-30"),
    (None, "011/030", None, None, "errose", True, None, None, None),
    (3, "031/050", 6, 1, "cont.cred. c/hip", False, "BANCO NACION Centro", "CASTILLO MARACAY, Ramses", "300-22"),
    (4, "051/052", 6, 1, "ces der her.s/inm.oner.", False, "QUEVEDO, Anahi Ayelen", "QUEVEDO Fabiana y otros", "720-00"),
    (5, "053/055", 6, 1, "ces der her.s/inm.oner.", False, "SCHNEIDER, Silvia y otros", "QUEVEDO, Anahi Ayelen", "720-00"),
    (6, "056/075", 7, 1, "cont de cred c/hip", False, "BANCO NACION Centro", "DAMIANI, Victoria", "300-22"),
    (7, "076/079", 7, 1, "venta", False, "HERNANDEZ, Laura A", "MARTINEZ, Soraya", "100-00"),
    (8, "080/099", 8, 1, "cont de cred c/hip", False, "BANCO NACION Centro", "ARRUIZ, Aitor y MACIEL, Gabriela", "300-22"),
    (9, "100/103", 8, 1, "poder escrit", False, "MARTINEZ - BARONIO", "SEBASTIN, Fernando y MAHON, G", "800-32"),
    (10, "104/109", 8, 1, "venta - t.a.", False, "LOPEZ, Oscar", "AMBROGI, Adrian y otros", "100-00 / 713-00"),
    (11, "110/114", 8, 1, "transf a benef", False, "DUBAI Sociedad Anonima Fid.Ares", "DFE LUCA, Rocio Aylen", "121-51"),
    (12, "115/117", 8, 1, "poder escrit", False, "PALLOTTA, Emidio", "PALLOTTA, Yannina y otro", "800-32"),
    (13, "118/123", 9, 1, "transf a benef - rectif", False, "SOMAJOFA Sociedad Anonma", "MASELLI, Elsa L", "121-00"),
    (14, "124/126", 9, 1, "poder recp venta", False, "MOSCARDI, Juan y otros", None, "800-32"),
    (15, "127/128", 12, 1, "acta", False, "STICKAR, Francisco M", None, "800-32"),
    (16, "129/135", 12, 1, "constitucion sociedad", False, "QUATTRO INGENIERIA Y CONSTRUCCIONES S.A.", None, "800-32"),
    (None, "136/138", None, None, "errose", True, None, None, None),
    (17, "139/142", 27, 1, "venta", False, "MELNIC, Sonia", "TROBIANI MAURIZI, Alejandro y o", "100-00"),
    (18, "143/162", 27, 1, "cont de cred c/hip", False, "BANCO NACION Don Bosco", "TROBIANI MAURIZI, Alejandro y o", "300-00"),
    (19, "163/164", 30, 1, "renuncia usufructo", False, "ROBIOLIO, Maria Pia", None, "414-30"),
    (20, "165/168", 2, 2, "venta", False, "MOSCARDI, Juan y otros", "JALIL, Guillermo y Otra", "100-00"),
    (21, "169", 2, 2, "complementaria", False, "Compl E.560 - 2025 Cancel. Agro", None, None),
    (22, "170/173", 9, 2, "venta", False, "NANTES, Esteban y RODRIGUEZ, M", "VALERO, Joaquin y DELIEUTRAZ, G", None),
    (23, "174/179", 9, 2, "venta t.a.", False, "MELONI, Osvaldo y otro", "HINDING, Raul A", None),
    (24, "180/181", 9, 2, "Acta", False, "FRIGORIFICO ANSELMO S.A.", None, None),
    (25, "182/184", 10, 2, "venta", False, "DON FERNANDO SA", "AZPIROZ, Martin", None),
    (26, "185/187", 10, 2, "bonificacion", False, "DON FERNANDO SA", "AZPIROZ, Martin", None),
    (27, "188/192", 10, 2, "venta t.a.", False, "HAAG, Carmelo y otros", "ROSSETTI, Fausto", None),
    (28, "193/197", 12, 2, "pod gral adm y disp", False, "BATISTA, Lucas", "ROMERO, Viviana", None),
    (29, "198/201", 13, 2, "desaf, vivienda", False, "GULLINI, Omar y otros", None, None),
    (30, "202/208", 13, 2, "venta t.a.", False, "GULLINI, Omar y otros", "CALDUBEHERE, Juan Pedro y o", None),
    (31, "207/210", 13, 2, "venta pte ind", False, "PEREZ, Alberto Ceferino", "PEREZ, Maria Asuncion", None),
    (32, "211/217", 13, 2, "pod gral amplio", False, "FINCA OCHO CERROS SA", "RUEDA, Manuel A", None),
    (33, "218/220", 13, 2, "venta", False, "HIRSCHMAN, Ingrid", "BICCICONTI, Sebastian y otro", None),
    (None, "221/222", None, None, "errose", True, None, None, None),
    (34, "223/225", 18, 2, "cancel. Hipot.", False, "GARANTIZAR SGR", "BLACKER, Alejandro", None),
    (35, "226/229", 18, 2, "venta - lev. Inembarg", False, "CAMPOS, Miguel A y ZALBA, Marta", "ARDITI, Eugenia", None),
    (36, "230/231", 18, 2, "complementaria", False, "SOMESUR SA", None, None),
    (37, "232/234", 24, 2, "venta", False, "VOGEL, Daniel y DONNARI, Marisa", "TRELLINI, Maria belen", None),
    (38, "235/240", 24, 2, "acta desvinc", False, "TELECOM ARGENTINA SA", "DE CUNTO, Sergio", None),
    (39, "241/246", 25, 2, "acta desvinc", False, "TELECOM ARGENTINA SA", "STREITENBERGER, Claudia", None),
    (40, "247/248", 25, 2, "acta 2 folios reservados", False, "IACA", None, None),
    (41, "249/253", 26, 2, "protocol ad por disol", False, "GENCO, Cecilia Andrea", None, None),
    (42, "254/255", 26, 2, "cancel. Hipot.", False, "BANCO DE LA PCIA DE BSAS", "BUDASSI, Nadia", None),
    (43, "256/258", 26, 2, "venta", False, "CABRERA, Nilda", "GIMENEZ, Natalia y MANZOTTI, Silvio", None),
    (44, "259/264", 27, 2, "acta acuerdo 241", False, "PBB", "RUANO, Agustin", None),
    (45, "265/270", 27, 2, "venta t.a.", False, "URANGA, Fernando J", "FERMANI, Adriana", None),
    (46, "271/273", 27, 2, "desembolso", False, "BENUSSI, Pablo y GARCIA, V.", "BCO. NACION (Centro)", None),
    (47, "274/275", 27, 2, "poder NO PASO", False, "*******", None, None),
    (48, "276/277", 27, 2, "complementaria", False, "Espacio Villa Mitre CODESUR", None, None),
    (49, "278/283", 27, 2, "adj x disol soc cony", False, "MOLINARI, Luis Danilo", "WELSH, Analia", None),
    (50, "284/286", 27, 2, "donac", False, "BUDASSI, Nadia", "GHERZI BUDASSI, Uriel y otros", None),
    (51, "287/295", 2, 3, "venta t.a.", False, "VILLANUEVA, Adelma y otras", "JIMENEZ, Macarena S", None),
    (52, "296/314", 2, 3, "cont cred c/hipot", False, "BCO. NACION (Centro)", "JIMENEZ, Macarena S", None),
    (53, "315/318", 2, 3, "venta", False, "GARCIA, Rodolfo y otra", "BOU, Ileana y otro", None),
    (None, "319/320", None, None, "errose", True, None, None, None),
    (54, "321", 2, 3, "poder NO PASO", False, "LA ROCCA, Bruno H", "ROSENDO LLORENTE MARTIN", None),
    (55, "322/324", 3, 3, "venta", False, "HOULMANN, Ana M", "FERNANDEZ, Juan Jose y PIGNOTTI, A", None),
    (56, "325/350", 3, 3, "cont cred c/hipot", False, "BANCO NACION (WHITE)", "FERNANDEZ, Juan Jose y PIGNOTTI, A", None),
    (57, "351/354", 3, 3, "venta", False, "HERNANDEZ, Laura", "MENDIETA, Leandro y COLLADO, J", None),
    (58, "355/356", 3, 3, "poder gral", False, "LA ROCCA, Bruno y otros", "ROSENDO LLORENTE MARTIN", None),
]

# Map nro_escritura → PDF filename
def pdf_filename(nro):
    """Returns the PDF path if the file exists."""
    if nro is None:
        return None
    path = PDF_DIR / f"{nro}.pdf"
    return path if path.exists() else None


def main():
    dry_run = "--dry-run" in sys.argv
    data_only = "--data-only" in sys.argv
    pdf_only = "--pdf-only" in sys.argv

    sb = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    if dry_run:
        print("=== DRY RUN — no se insertará/subirá nada ===\n")

    # ─── Phase 1: Insert/upsert data rows ───
    if not pdf_only:
        print(f"Insertando {len(PROTOCOLO_DATA)} registros en protocolo_registros...")

        # First, check existing records
        existing = sb.table("protocolo_registros").select("id, nro_escritura, folios").eq("anio", ANIO).execute()
        existing_map = {}
        for r in existing.data:
            key = r["nro_escritura"] if r["nro_escritura"] else f"errose_{r['folios']}"
            existing_map[key] = r["id"]

        inserted = 0
        updated = 0
        skipped = 0

        for row in PROTOCOLO_DATA:
            nro, folios, dia, mes, tipo_acto, es_errose, vendedor, comprador, codigo = row

            payload = {
                "nro_escritura": nro,
                "folios": folios,
                "dia": dia,
                "mes": mes,
                "anio": ANIO,
                "tipo_acto": tipo_acto,
                "es_errose": es_errose,
                "vendedor_acreedor": vendedor,
                "comprador_deudor": comprador,
                "codigo_acto": codigo,
            }

            # Build lookup key
            key = nro if nro else f"errose_{folios}"

            if dry_run:
                label = f"Esc. {nro}" if nro else f"Errose {folios}"
                status = "UPDATE" if key in existing_map else "INSERT"
                print(f"  [{status}] {label}: {tipo_acto} — {vendedor or ''}")
                if key in existing_map:
                    updated += 1
                else:
                    inserted += 1
                continue

            if key in existing_map:
                # Update existing
                result = sb.table("protocolo_registros").update(payload).eq("id", existing_map[key]).execute()
                if result.data:
                    updated += 1
                else:
                    print(f"  ⚠ Error updating Esc. {nro}: {getattr(result, 'error', 'unknown')}")
            else:
                # Insert new
                result = sb.table("protocolo_registros").insert(payload).execute()
                if result.data:
                    inserted += 1
                    # Track the new ID for PDF upload
                    existing_map[key] = result.data[0]["id"]
                else:
                    print(f"  ⚠ Error inserting Esc. {nro}: {getattr(result, 'error', 'unknown')}")

        print(f"\n  Insertados: {inserted}")
        print(f"  Actualizados: {updated}")
        print(f"  Total: {inserted + updated}/{len(PROTOCOLO_DATA)}")

    # ─── Phase 2: Upload PDFs to Storage ───
    if not data_only:
        print(f"\nSubiendo PDFs desde {PDF_DIR}...")

        # Re-fetch all records to get IDs
        all_records = sb.table("protocolo_registros").select("id, nro_escritura, folios, pdf_storage_path").eq("anio", ANIO).execute()

        uploaded = 0
        already = 0
        no_pdf = 0

        for rec in all_records.data:
            nro = rec["nro_escritura"]
            if nro is None:
                no_pdf += 1
                continue

            # Skip if already has PDF
            if rec.get("pdf_storage_path"):
                already += 1
                continue

            pdf_path = pdf_filename(nro)
            if not pdf_path:
                no_pdf += 1
                continue

            storage_path = f"protocolo_2026/{nro}.pdf"

            if dry_run:
                print(f"  [UPLOAD] {pdf_path.name} → {storage_path}")
                uploaded += 1
                continue

            # Upload to Storage
            with open(pdf_path, "rb") as f:
                pdf_bytes = f.read()

            try:
                sb.storage.from_(STORAGE_BUCKET).upload(
                    storage_path,
                    pdf_bytes,
                    {"content-type": "application/pdf"}
                )
            except Exception as e:
                if "already exists" in str(e).lower() or "Duplicate" in str(e):
                    pass  # Already uploaded, just update the path
                else:
                    print(f"  ⚠ Error uploading {nro}.pdf: {e}")
                    continue

            # Update record with storage path
            sb.table("protocolo_registros").update(
                {"pdf_storage_path": storage_path}
            ).eq("id", rec["id"]).execute()

            uploaded += 1
            print(f"  ✓ {nro}.pdf → {storage_path}")

        print(f"\n  Subidos: {uploaded}")
        print(f"  Ya existían: {already}")
        print(f"  Sin PDF: {no_pdf}")

    print("\n✅ Carga masiva completada.")


if __name__ == "__main__":
    main()
