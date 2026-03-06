"""
Auto-link protocolo_registros ↔ carpetas via escrituras.nro_protocolo.
Match: escrituras.nro_protocolo == protocolo_registros.nro_escritura
       AND escrituras.fecha_escritura year == protocolo_registros.anio.

Usage:
  python link_carpetas_protocolo.py          # dry run
  python link_carpetas_protocolo.py --apply  # apply changes
"""

import sys
from supabase import create_client

SUPABASE_URL = "https://qcqrcrpnnvvlitiidrlc.supabase.co"
SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFjcXJjcnBubnZ2bGl0aWlkcmxjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2ODI5MDk0MSwiZXhwIjoyMDgzODY2OTQxfQ.glvDtnzbolcUY5u2hrp2flTuLa3VNRFDNsapp1qOs44"

sb = create_client(SUPABASE_URL, SUPABASE_KEY)
apply = "--apply" in sys.argv

# 1. Get all escrituras that have nro_protocolo set
escs = sb.table("escrituras").select(
    "id, carpeta_id, nro_protocolo, fecha_escritura"
).not_.is_("nro_protocolo", "null").execute().data

# 2. Get all protocolo entries without carpeta_id
protos = sb.table("protocolo_registros").select(
    "id, nro_escritura, anio, vendedor_acreedor, tipo_acto"
).is_("carpeta_id", "null").execute().data

# Build lookup: (nro, year) → proto
proto_by_key = {}
for p in protos:
    if p["nro_escritura"] is not None:
        key = (p["nro_escritura"], p["anio"])
        proto_by_key[key] = p

# Match
matches = []
for e in escs:
    yr = int(e["fecha_escritura"][:4]) if e.get("fecha_escritura") else None
    nro = e["nro_protocolo"]
    if yr and (nro, yr) in proto_by_key:
        p = proto_by_key[(nro, yr)]
        matches.append({
            "proto_id": p["id"],
            "nro_escritura": nro,
            "anio": yr,
            "carpeta_id": e["carpeta_id"],
            "vendedor": (p.get("vendedor_acreedor") or "")[:40],
            "tipo_acto": p.get("tipo_acto") or "",
        })

print(f"Escrituras con nro_protocolo: {len(escs)}")
print(f"Protocolo sin carpeta_id: {len(protos)}")
print(f"Matches encontrados: {len(matches)}")

if not matches:
    print("\nNo hay matches para vincular.")
    sys.exit(0)

for m in matches:
    print(f"  Esc {m['nro_escritura']}/{m['anio']} → carpeta {m['carpeta_id'][:8]}... | {m['tipo_acto']} | {m['vendedor']}")

if apply:
    updated = 0
    for m in matches:
        res = sb.table("protocolo_registros").update(
            {"carpeta_id": m["carpeta_id"]}
        ).eq("id", m["proto_id"]).execute()
        if res.data:
            updated += 1
    print(f"\n✅ {updated}/{len(matches)} registros vinculados.")
else:
    print(f"\n(Dry run — use --apply para vincular)")
