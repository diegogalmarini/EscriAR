import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function test() {
    const { data: inmuebles, error: errInm } = await supabase
        .from('inmuebles')
        .select('*')
        .ilike('nomenclatura', '%Manzana 99, Parcela 4%');
        
    if (errInm || !inmuebles || inmuebles.length === 0) {
        console.error("No se encontró el inmueble", errInm);
        return;
    }
    
    const inmueble = inmuebles[0];
    console.log("INMUEBLE ENCONTRADO:", inmueble.nomenclatura);
    
    const parts = inmueble.nomenclatura ? inmueble.nomenclatura.split(/[;,]/).map((p: string) => p.trim().toUpperCase()) : [];
        
    // Find the most identifying parts (usually the ones with numbers: Manzana 99, Parcela 4, UF 16)
    const identifyingParts = parts.filter((p: string) => /\d/.test(p));
    // If no numbers, just use the first two
    const searchParts = identifyingParts.length > 0 ? identifyingParts : parts.slice(0, 2);
    
    console.log("IDENTIFYING PARTS:", searchParts);
    
    const { data: rawEscrituras, error: errEsc } = await supabase
        .from("escrituras")
        .select("id, carpeta_id, source, analysis_metadata")
        .order("fecha_escritura", { ascending: false });
        
    if (errEsc) {
        console.error("ERROR FETCHING ESCRITURAS:", errEsc);
    }
    
    console.log("TOTAL ESCRITURAS FETCHED:", rawEscrituras?.length);
    
    const ingestasMatched = (rawEscrituras || []).filter((esc: any) => {
        if (!esc.analysis_metadata) return false;
        const rawText = JSON.stringify(esc.analysis_metadata).toUpperCase();
        
        const removeAccents = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
        const rawTextNoAccents = removeAccents(rawText);
        
        let matchesCount = 0;
        for (const part of searchParts) {
            const partNoA = removeAccents(part);
            if (partNoA.length > 3 && rawTextNoAccents.includes(partNoA)) {
                matchesCount++;
            }
        }
        
        const requiredMatches = searchParts.length >= 2 ? 2 : 1;
        
        const matched = matchesCount >= requiredMatches;
        if (matched) {
            console.log(">> MATCH ENCONTRADO EN ESCRITURA:", esc.id);
            console.log("  Matches Count:", matchesCount);
        }
        
        return matched;
    });
    
    console.log("TOTAL MATCHES:", ingestasMatched.length);
}

test();
