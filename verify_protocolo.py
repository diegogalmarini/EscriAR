from supabase import create_client
sb = create_client(
    'https://qcqrcrpnnvvlitiidrlc.supabase.co',
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjcXJjcnBubnZ2bGl0aWlkcmxjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI5MDk0MSwiZXhwIjoyMDgzODY2OTQxfQ.glvDtnzbolcUY5u2hrp2flTuLa3VNRFDNsapp1qOs44'
)
r = sb.table("protocolo_registros").select("id, nro_escritura, folios, tipo_acto, es_errose, pdf_storage_path").eq("anio", 2026).order("folios").execute()
total = len(r.data)
with_pdf = sum(1 for x in r.data if x.get("pdf_storage_path"))
errose = sum(1 for x in r.data if x.get("es_errose"))
escrituras = total - errose
print(f"Total registros: {total}")
print(f"Escrituras: {escrituras}")
print(f"Errose: {errose}")
print(f"Con PDF: {with_pdf}")
print(f"Sin PDF: {total - with_pdf}")
print()
for x in r.data[:3]:
    nro = x.get("nro_escritura", "-")
    fol = x["folios"]
    acto = x["tipo_acto"]
    has_pdf = bool(x.get("pdf_storage_path"))
    print(f"  Esc.{nro} | {fol} | {acto} | pdf={has_pdf}")
print("  ...")
for x in r.data[-3:]:
    nro = x.get("nro_escritura", "-")
    fol = x["folios"]
    acto = x["tipo_acto"]
    has_pdf = bool(x.get("pdf_storage_path"))
    print(f"  Esc.{nro} | {fol} | {acto} | pdf={has_pdf}")
