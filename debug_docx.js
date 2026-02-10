
const mammoth = require("mammoth");
const fs = require("fs");
const path = require("path");

async function testDocx() {
    console.log("Testing Mammoth import...");
    try {
        console.log("Mammoth available:", !!mammoth);
        // Create a minimal valid docx buffer if possible, or just skip
        // Without a real file, we just test the import speed
    } catch (e) {
        console.error("Mammoth import failed:", e);
    }
    console.log("Simulating pipeline overhead...");
}

testDocx();
