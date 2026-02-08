import pdfplumber
import json
import re

pdf_path = ".agent/skills/notary-act-coder/source/2026_01_07_Tabla_de_Actos_Notariales_General_Ext_Jur_01012026.pdf"

acts_taxonomy = {}

with pdfplumber.open(pdf_path) as pdf:
    for page_num, page in enumerate(pdf.pages):
        tables = page.extract_tables()
        for table in tables:
            for row in table:
                if not row or not any(cell for cell in row if cell):
                    continue
                
                # Clean row
                clean_row = [str(c).strip() if c else "" for c in row]
                
                # Look for act codes (format: XXX-YY)
                for i, cell in enumerate(clean_row):
                    code_match = re.match(r'^(\d{3}-\d{2})$', cell)
                    if code_match:
                        code = code_match.group(1)
                        
                        # Get description (usually next cell or from remaining cells)
                        description = ""
                        remaining = clean_row[i+1:] if i+1 < len(clean_row) else []
                        
                        for val in remaining:
                            if val and not re.match(r'^[\d\$%,.\s]+$', val) and val not in ['', 'None', '***', 'SUMA FIJA', 'EXENTA']:
                                if not description:
                                    description = val
                                break
                        
                        # Try to extract monetary values
                        fees = []
                        for val in remaining:
                            if val and '$' in val:
                                fees.append(val)
                        
                        # Determine category (REGISTRABLE if code starts with 1XX or 2XX usually)
                        category = "REGISTRABLE" if code.startswith(('1', '2', '3')) else "NON_REGISTRABLE"
                        
                        # Check for suspended rate (subcodes -52, etc.)
                        suspended = code.endswith('-52') or 'EXENTA' in ' '.join(clean_row).upper()
                        
                        acts_taxonomy[code] = {
                            "description": description if description else f"Acto código {code}",
                            "category": category,
                            "tax_variables": {
                                "stamp_duty_rate": 0.02,  # Default 2%
                                "min_fee_ars": 0,
                                "fees_extracted": fees
                            },
                            "flags": [],
                            "suspended_rate_2026": suspended,
                            "raw_row": clean_row
                        }

# Save to JSON
output_path = ".agent/skills/notary-act-coder/data/acts_taxonomy_2026.json"
import os
os.makedirs(os.path.dirname(output_path), exist_ok=True)

with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(acts_taxonomy, f, ensure_ascii=False, indent=2)

print(f"Extracted {len(acts_taxonomy)} acts to {output_path}")
print("\nSample acts:")
for i, (code, data) in enumerate(list(acts_taxonomy.items())[:10]):
    print(f"  {code}: {data['description'][:60]}...")
