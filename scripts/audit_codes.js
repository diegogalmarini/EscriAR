const fs = require('fs');
const pdf = require('pdf-parse');

async function audit() {
    console.log("Reading PDF...");
    const dataBuffer = fs.readFileSync('c:\\Users\\diego\\NotiAr\\.agent\\skills\\notary-act-coder\\source\\2026_01_07_Tabla_de_Actos_Notariales_General_Ext_Jur_01012026.pdf');

    try {
        const data = await pdf(dataBuffer);
        const text = data.text;

        // Find all acts codes: \d{3}-\d{2}
        const regex = /\b\d{3}-\d{2}\b/g;
        const matches = [...text.matchAll(regex)].map(m => m[0]);

        // Unique PDF codes
        const pdfCodes = [...new Set(matches)];
        console.log(`Found ${pdfCodes.length} unique codes in PDF.`);

        // Read JSON
        const taxonomy = JSON.parse(fs.readFileSync('c:\\Users\\diego\\NotiAr\\src\\data\\acts_taxonomy_2026.json', 'utf8'));
        const jsonCodes = Object.keys(taxonomy);
        console.log(`Found ${jsonCodes.length} codes in JSON.`);

        // Compare
        const missingInJson = pdfCodes.filter(c => !jsonCodes.includes(c));
        const extraInJson = jsonCodes.filter(c => !pdfCodes.includes(c)); // These are likely hallucinated!

        console.log("\n--- AUDIT RESULTS ---");
        console.log(`Missing in JSON (Present in PDF but not in our DB): ${missingInJson.length}`);
        if (missingInJson.length > 0) console.log(missingInJson.join(", "));

        console.log(`\nExtra in JSON (Hallucinated/Invalid codes not in PDF): ${extraInJson.length}`);
        if (extraInJson.length > 0) console.log(extraInJson.join(", "));

    } catch (err) {
        console.error("Error reading PDF:", err);
    }
}

audit();
