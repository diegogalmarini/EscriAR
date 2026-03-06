"""
Classify PDFs by font family: Courier New (monospaced) vs proportional.
Also extract the actual font names from the embedded metadata.
"""
import pdfplumber
from pathlib import Path
from collections import Counter

PDF_DIR = Path(r"C:\Users\diego\NotiAr\protocolo_2026_pdfs")

courier_files = []
proportional_files = []

for pdf_path in sorted(PDF_DIR.glob("*.pdf"), key=lambda p: int(p.stem) if p.stem.isdigit() else 999):
    with pdfplumber.open(pdf_path) as pdf:
        font_counter = Counter()
        total_chars = 0
        for page in pdf.pages:
            for ch in page.chars:
                fn = ch.get("fontname", "")
                total_chars += 1
                if "Courier" in fn:
                    font_counter["courier"] += 1
                elif "CIDFont" in fn:
                    font_counter["cidfont"] += 1
                else:
                    font_counter["other"] += 1
        
        courier_pct = font_counter["courier"] / max(total_chars, 1) * 100
        is_courier = courier_pct > 50
        
        info = {
            "file": pdf_path.name,
            "pages": len(pdf.pages),
            "courier_pct": round(courier_pct, 1),
            "title": (pdf.metadata or {}).get("Title", "?"),
        }
        
        if is_courier:
            courier_files.append(info)
        else:
            proportional_files.append(info)

print(f"FUENTE PROPORCIONAL (CIDFont / Arial/Calibri): {len(proportional_files)} escrituras")
print("-" * 70)
for f in proportional_files:
    print(f"  {f['file']:8s} ({f['pages']:2d} pág) courier={f['courier_pct']:4.1f}%  {f['title'][:60]}")

print(f"\nFUENTE MONOESPACIADA (Courier New): {len(courier_files)} escrituras")
print("-" * 70)
for f in courier_files:
    print(f"  {f['file']:8s} ({f['pages']:2d} pág) courier={f['courier_pct']:4.1f}%  {f['title'][:60]}")

# Now try to identify the actual proportional font by checking char widths
print(f"\n{'='*70}")
print("IDENTIFICACIÓN DE FUENTE PROPORCIONAL")
print("="*70)
# Use 1.pdf as reference
with pdfplumber.open(PDF_DIR / "1.pdf") as pdf:
    page = pdf.pages[0]
    # Get char widths for CIDFont+F2 (body text)
    widths = {}
    for ch in page.chars:
        if ch["fontname"] == "CIDFont+F2" and ch["text"].strip():
            letter = ch["text"]
            w = round(ch["x1"] - ch["x0"], 2)
            if letter not in widths:
                widths[letter] = w
    
    print("Anchos de caracteres para CIDFont+F2 (body text):")
    for letter in sorted(widths.keys())[:30]:
        print(f"  '{letter}': {widths[letter]:.2f}pt", end="")
    print()
    
    # Key diagnostic: if 'i' and 'm' have different widths, it's proportional
    if 'i' in widths and 'm' in widths:
        print(f"\n  'i' width: {widths['i']:.2f}pt")
        print(f"  'm' width: {widths['m']:.2f}pt")
        print(f"  'W' width: {widths.get('W', 'N/A')}")
        if abs(widths['i'] - widths['m']) > 1:
            print("  → PROPORCIONAL (variable-width) confirmado")
        else:
            print("  → MONOESPACIADA")
    
    # Arial vs Calibri: Arial 'a' is typically 6.23pt at 11pt, Calibri 'a' is ~5.3pt
    if 'a' in widths:
        a_width = widths['a']
        size = 11.3
        ratio = a_width / size
        print(f"\n  'a' width: {a_width:.2f}pt (ratio: {ratio:.3f})")
        print(f"  'e' width: {widths.get('e', 'N/A')}")
        print(f"  'o' width: {widths.get('o', 'N/A')}")
        # Arial 'a' at 11pt ≈ 6.2pt; Calibri 'a' at 11pt ≈ 5.3pt; Times 'a' at 11pt ≈ 4.9pt
        if ratio > 0.5:
            print("  → Probablemente ARIAL (sans-serif)")
        elif ratio > 0.45:
            print("  → Probablemente CALIBRI o similar")
        else:
            print("  → Probablemente TIMES NEW ROMAN (serif)")
