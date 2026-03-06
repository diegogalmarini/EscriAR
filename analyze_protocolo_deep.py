"""
Deep-dive analysis: identify actual fonts, odd/even page margins, 
tabulaciones, and structure patterns per escritura.
"""
import pdfplumber
import json
from pathlib import Path
from collections import Counter

PDF_DIR = Path(r"C:\Users\diego\NotiAr\protocolo_2026_pdfs")

def deep_analyze(filepath):
    """Detailed per-page analysis for odd/even comparison."""
    result = {"file": filepath.name, "pages": []}
    
    with pdfplumber.open(filepath) as pdf:
        for pi, page in enumerate(pdf.pages):
            page_num = pi + 1
            is_odd = page_num % 2 == 1
            chars = page.chars
            if not chars:
                result["pages"].append({"num": page_num, "empty": True})
                continue
            
            # Get unique font descriptors
            font_set = set()
            for ch in chars:
                fn = ch.get("fontname", "?")
                sz = round(ch.get("size", 0), 1)
                font_set.add(f"{fn}@{sz}")
            
            # Margins
            text_chars = [c for c in chars if c.get("text", "").strip()]
            if not text_chars:
                continue
                
            left = round(min(c["x0"] for c in text_chars), 1)
            right = round(page.width - max(c["x1"] for c in text_chars), 1)
            top = round(min(c["top"] for c in text_chars), 1)
            bottom = round(page.height - max(c["bottom"] for c in text_chars), 1)
            
            # Check for tab stops / indentation patterns
            x0_values = [round(c["x0"], 0) for c in text_chars]
            x0_counter = Counter(x0_values)
            tab_stops = sorted([x for x, cnt in x0_counter.items() if cnt >= 3])
            
            # Lines
            lines = page.extract_text_lines(layout=False)
            first_line = lines[0]["text"].strip() if lines else ""
            
            result["pages"].append({
                "num": page_num,
                "odd": is_odd,
                "dim": f"{round(page.width, 1)}x{round(page.height, 1)}",
                "left_margin": left,
                "right_margin": right,
                "top_margin": top,
                "bottom_margin": bottom,
                "fonts": sorted(font_set),
                "tab_stops": tab_stops[:8],
                "first_line": first_line[:80],
                "line_count": len(lines),
            })
    
    return result


def check_font_metadata(filepath):
    """Try to get actual font names from PDF metadata."""
    import pdfplumber
    result = {}
    with pdfplumber.open(filepath) as pdf:
        # Check PDF metadata
        result["metadata"] = pdf.metadata or {}
        # Check first page font objects
        page = pdf.pages[0]
        if hasattr(page, 'page') and hasattr(page.page, 'Resources'):
            pass  # pdfplumber doesn't easily expose font descriptors
        
        # Unique fonts from chars with their properties
        font_details = {}
        for ch in page.chars[:500]:
            fn = ch.get("fontname", "?")
            if fn not in font_details:
                font_details[fn] = {
                    "size": round(ch.get("size", 0), 1),
                    "sample": "",
                    "adv": round(ch.get("adv", 0), 2) if "adv" in ch else None,
                }
            if len(font_details[fn]["sample"]) < 30:
                font_details[fn]["sample"] += ch.get("text", "")
        result["fonts"] = font_details
    return result


# Analyze 5 representative docs: shortest, longest, one A4, one US Letter, one medium
sample_files = [
    PDF_DIR / "1.pdf",   # First escritura (has header)
    PDF_DIR / "18.pdf",  # Shortest (1 page)
    PDF_DIR / "56.pdf",  # Longest (51 pages)
    PDF_DIR / "10.pdf",  # Medium length
    PDF_DIR / "3.pdf",   # Another long one
]

print("="*70)
print("FONT IDENTIFICATION")
print("="*70)
for f in sample_files[:3]:
    print(f"\n--- {f.name} ---")
    fm = check_font_metadata(f)
    print(f"  PDF metadata: {json.dumps(fm['metadata'], default=str)[:200]}")
    for fn, details in fm["fonts"].items():
        print(f"  Font '{fn}' @ {details['size']}pt: sample='{details['sample'][:40]}'")

print(f"\n{'='*70}")
print("ODD vs EVEN PAGE MARGIN COMPARISON")
print("="*70)

for f in sample_files:
    print(f"\n--- {f.name} ---")
    da = deep_analyze(f)
    
    odd_left = [p["left_margin"] for p in da["pages"] if not p.get("empty") and p.get("odd")]
    even_left = [p["left_margin"] for p in da["pages"] if not p.get("empty") and not p.get("odd")]
    odd_right = [p["right_margin"] for p in da["pages"] if not p.get("empty") and p.get("odd")]
    even_right = [p["right_margin"] for p in da["pages"] if not p.get("empty") and not p.get("odd")]
    
    if odd_left:
        print(f"  Odd pages  - left: {min(odd_left):.1f}-{max(odd_left):.1f}  right: {min(odd_right):.1f}-{max(odd_right):.1f}")
    if even_left:
        print(f"  Even pages - left: {min(even_left):.1f}-{max(even_left):.1f}  right: {min(even_right):.1f}-{max(even_right):.1f}")
    
    # Tab stops
    all_tabs = set()
    for p in da["pages"]:
        if not p.get("empty"):
            all_tabs.update(p.get("tab_stops", []))
    print(f"  Tab stops (x positions): {sorted(all_tabs)[:10]}")
    
    # Per page detail
    for p in da["pages"][:6]:
        if p.get("empty"):
            continue
        oe = "ODD " if p["odd"] else "EVEN"
        print(f"    p{p['num']} ({oe}) L={p['left_margin']:.1f} R={p['right_margin']:.1f} T={p['top_margin']:.1f} B={p['bottom_margin']:.1f} | {p['first_line'][:60]}")
