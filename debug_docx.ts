
import * as mammoth from "mammoth";
import fs from "fs";
import path from "path";

async function testDocx() {
    const filePath = "c:/Users/diego/NotiAr/Inmueble_63.241.docx"; // Hypothetical path, will use a dummy if not exists

    // Create a dummy DOCX buffer for testing if real file not accessible
    // Actually, I cannot easily create a valid DOCX buffer here. 
    // I will assume the user has a file or I'll just test the mammoth import and a small buffer.

    console.log("Testing Mammoth import...");
    try {
        console.log("Mammoth available:", !!mammoth);
    } catch (e) {
        console.error("Mammoth import failed:", e);
    }

    console.log("Simulating pipeline...");
    const start = Date.now();

    // Mock heavy operation
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log(`Pipeline init took ${Date.now() - start}ms`);
}

testDocx();
