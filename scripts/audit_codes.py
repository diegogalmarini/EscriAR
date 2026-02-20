import sys
import json
import re

try:
    import fitz  # PyMuPDF
except ImportError:
    print("PyMuPDF (fitz) is not installed. Please run: pip install PyMuPDF")
    sys.exit(1)

PDF_PATH = r"c:\Users\diego\NotiAr\.agent\skills\notary-act-coder\source\2026_01_07_Tabla_de_Actos_Notariales_General_Ext_Jur_01012026.pdf"
JSON_PATH = r"c:\Users\diego\NotiAr\src\data\acts_taxonomy_2026.json"

def main():
    print("Reading PDF...")
    try:
        doc = fitz.open(PDF_PATH)
        text = ""
        for page in doc:
            text += page.get_text("text") + "\n"
    except Exception as e:
        print(f"Error reading PDF: {e}")
        return

    # Extract all pattern: exactly 3 digits, a dash, and 2 digits.
    # We use regex to find all codes.
    regex = r"\b\d{3}-\d{2}\b"
    matches = re.findall(regex, text)
    
    pdf_codes = set(matches)
    print(f"Found {len(pdf_codes)} unique codes in PDF.")

    print("Reading JSON...")
    try:
        with open(JSON_PATH, "r", encoding="utf-8") as f:
            taxonomy = json.load(f)
    except Exception as e:
        print(f"Error reading JSON: {e}")
        return

    json_codes = set(taxonomy.keys())
    print(f"Found {len(json_codes)} codes in JSON.")

    missing_in_json = sorted(list(pdf_codes - json_codes))
    extra_in_json = sorted(list(json_codes - pdf_codes))

    print("\n--- AUDIT RESULTS ---")
    print(f"Missing in JSON (Present in PDF but not in our DB): {len(missing_in_json)}")
    if missing_in_json:
        print(", ".join(missing_in_json))

    print(f"\nExtra in JSON (Hallucinated/Invalid codes not in PDF): {len(extra_in_json)}")
    if extra_in_json:
        print(", ".join(extra_in_json))

if __name__ == "__main__":
    main()
