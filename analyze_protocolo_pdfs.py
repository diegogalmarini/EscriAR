"""
Analyze protocolo PDFs for formatting, typography, pagination style.
Extracts: fonts, sizes, margins, line spacing, page dimensions, structure patterns.
"""
import pdfplumber
import os
import json
from collections import Counter, defaultdict
from pathlib import Path

PDF_DIR = Path(r"C:\Users\diego\NotiAr\protocolo_2026_pdfs")

def analyze_pdf(filepath):
    """Extract formatting metadata from a single PDF."""
    result = {
        "file": filepath.name,
        "pages": 0,
        "page_dims": [],
        "fonts": Counter(),
        "font_sizes": Counter(),
        "font_combos": Counter(),  # font+size combos
        "line_count": 0,
        "chars_sample": [],
        "first_lines": [],
        "last_lines": [],
        "margins": {"left": [], "right": [], "top": [], "bottom": []},
        "line_spacings": [],
        "has_header": False,
        "has_footer": False,
        "has_page_numbers": False,
    }
    
    try:
        with pdfplumber.open(filepath) as pdf:
            result["pages"] = len(pdf.pages)
            
            for pi, page in enumerate(pdf.pages):
                w, h = round(page.width, 1), round(page.height, 1)
                result["page_dims"].append(f"{w}x{h}")
                
                chars = page.chars
                if not chars:
                    continue
                
                # Font analysis
                for ch in chars:
                    fname = ch.get("fontname", "unknown")
                    fsize = round(ch.get("size", 0), 1)
                    result["fonts"][fname] += 1
                    result["font_sizes"][fsize] += 1
                    result["font_combos"][f"{fname}@{fsize}"] += 1
                
                # Extract lines with positions
                lines = page.extract_text_lines(layout=False)
                if not lines:
                    continue
                    
                result["line_count"] += len(lines)
                
                # Margins from character positions  
                x_positions = [ch["x0"] for ch in chars if ch.get("text", "").strip()]
                x_right = [ch["x1"] for ch in chars if ch.get("text", "").strip()]
                y_positions = [ch["top"] for ch in chars if ch.get("text", "").strip()]
                y_bottom = [ch["bottom"] for ch in chars if ch.get("text", "").strip()]
                
                if x_positions:
                    result["margins"]["left"].append(round(min(x_positions), 1))
                    result["margins"]["right"].append(round(w - max(x_right), 1))
                if y_positions:
                    result["margins"]["top"].append(round(min(y_positions), 1))
                if y_bottom:
                    result["margins"]["bottom"].append(round(h - max(y_bottom), 1))
                
                # Line spacing (vertical gaps between consecutive lines)
                if len(lines) >= 2:
                    for i in range(1, min(len(lines), 20)):
                        gap = round(lines[i]["top"] - lines[i-1]["bottom"], 1)
                        result["line_spacings"].append(gap)
                
                # First page: capture first lines for structure analysis
                if pi == 0:
                    for line in lines[:8]:
                        result["first_lines"].append(line["text"].strip())
                
                # Last page: capture last lines
                if pi == len(pdf.pages) - 1:
                    for line in lines[-5:]:
                        result["last_lines"].append(line["text"].strip())
                
                # Check for page numbers (bottom of page, small centered number)
                if lines:
                    last_line = lines[-1]["text"].strip()
                    if last_line.isdigit() and int(last_line) <= 20:
                        result["has_page_numbers"] = True
                        
    except Exception as e:
        result["error"] = str(e)
    
    return result


def summarize_results(analyses):
    """Create a comprehensive summary across all PDFs."""
    summary = {
        "total_files": len(analyses),
        "total_pages": sum(a["pages"] for a in analyses),
        "page_dimensions": Counter(),
        "global_fonts": Counter(),
        "global_font_sizes": Counter(),
        "global_font_combos": Counter(),
        "avg_pages_per_doc": 0,
        "margin_stats": {},
        "line_spacing_stats": {},
        "structure_patterns": [],
        "files_with_page_numbers": 0,
    }
    
    all_left = []
    all_right = []
    all_top = []
    all_bottom = []
    all_spacings = []
    
    for a in analyses:
        for dim in a["page_dims"]:
            summary["page_dimensions"][dim] += 1
        summary["global_fonts"].update(a["fonts"])
        summary["global_font_sizes"].update(a["font_sizes"])
        summary["global_font_combos"].update(a["font_combos"])
        all_left.extend(a["margins"]["left"])
        all_right.extend(a["margins"]["right"])
        all_top.extend(a["margins"]["top"])
        all_bottom.extend(a["margins"]["bottom"])
        all_spacings.extend(a["line_spacings"])
        if a["has_page_numbers"]:
            summary["files_with_page_numbers"] += 1
    
    summary["avg_pages_per_doc"] = round(summary["total_pages"] / max(len(analyses), 1), 1)
    
    def stats(vals):
        if not vals:
            return {}
        sv = sorted(vals)
        return {
            "min": sv[0],
            "max": sv[-1],
            "median": sv[len(sv)//2],
            "mean": round(sum(sv)/len(sv), 1),
            "mode": Counter(sv).most_common(1)[0][0] if sv else None,
        }
    
    summary["margin_stats"] = {
        "left_pt": stats(all_left),
        "right_pt": stats(all_right),
        "top_pt": stats(all_top),
        "bottom_pt": stats(all_bottom),
    }
    summary["line_spacing_stats"] = stats(all_spacings)
    
    # Convert Counters to sorted lists for JSON
    summary["page_dimensions"] = summary["page_dimensions"].most_common()
    summary["global_fonts"] = summary["global_fonts"].most_common(15)
    summary["global_font_sizes"] = summary["global_font_sizes"].most_common(10)
    summary["global_font_combos"] = summary["global_font_combos"].most_common(20)
    
    return summary


def main():
    pdfs = sorted(PDF_DIR.glob("*.pdf"), key=lambda p: int(p.stem) if p.stem.isdigit() else 999)
    print(f"Found {len(pdfs)} PDFs to analyze\n")
    
    analyses = []
    for pdf_path in pdfs:
        print(f"  Analyzing {pdf_path.name}...", end="")
        a = analyze_pdf(pdf_path)
        analyses.append(a)
        print(f" {a['pages']} pages, {a['line_count']} lines")
    
    summary = summarize_results(analyses)
    
    print("\n" + "="*70)
    print("RESUMEN DE FORMATO DEL PROTOCOLO 2026")
    print("="*70)
    
    print(f"\nDocumentos: {summary['total_files']}")
    print(f"Páginas totales: {summary['total_pages']}")
    print(f"Promedio pág/escritura: {summary['avg_pages_per_doc']}")
    
    print(f"\nDimensiones de página:")
    for dim, count in summary["page_dimensions"]:
        # Convert points to mm
        w, h = dim.split("x")
        w_mm = round(float(w) * 0.3528, 1)
        h_mm = round(float(h) * 0.3528, 1)
        print(f"  {dim} pt ({w_mm}x{h_mm} mm) - {count} páginas")
    
    print(f"\nFuentes más usadas:")
    for font, count in summary["global_fonts"]:
        print(f"  {font}: {count:,} chars")
    
    print(f"\nTamaños de fuente (pt):")
    for size, count in summary["global_font_sizes"]:
        print(f"  {size}pt: {count:,} chars")
    
    print(f"\nCombinaciones fuente+tamaño principales:")
    for combo, count in summary["global_font_combos"][:12]:
        print(f"  {combo}: {count:,}")
    
    print(f"\nMárgenes (puntos):")
    for side, st in summary["margin_stats"].items():
        if st:
            print(f"  {side}: min={st['min']}, max={st['max']}, median={st['median']}, mode={st['mode']}")
    
    print(f"\nInterlineado:")
    ls = summary["line_spacing_stats"]
    if ls:
        print(f"  min={ls['min']}, max={ls['max']}, median={ls['median']}, mode={ls['mode']}")
    
    print(f"\nCon numeración de página: {summary['files_with_page_numbers']}/{summary['total_files']}")
    
    # Show first few lines of 3 sample docs for structure
    print(f"\n{'='*70}")
    print("MUESTRAS DE ESTRUCTURA (primeras líneas)")
    print("="*70)
    for a in [analyses[0], analyses[len(analyses)//2], analyses[-1]]:
        print(f"\n--- {a['file']} ({a['pages']} pág) ---")
        for line in a["first_lines"][:6]:
            print(f"  {line[:100]}")
    
    # Save full analysis
    output = {
        "summary": summary,
        "per_file": [{
            "file": a["file"],
            "pages": a["pages"],
            "line_count": a["line_count"],
            "has_page_numbers": a["has_page_numbers"],
            "first_lines": a["first_lines"],
            "last_lines": a["last_lines"],
            "fonts": a["fonts"].most_common(5),
            "font_sizes": a["font_sizes"].most_common(5),
        } for a in analyses]
    }
    
    out_path = Path(r"C:\Users\diego\NotiAr\protocolo_2026_pdfs\analysis_result.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\nAnálisis completo guardado en: {out_path}")


if __name__ == "__main__":
    main()
