import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function getFullSchema() {
    // We can query custom tables by just looking at some known ones and checking foreign keys if possible, but PGREST hides information_schema. 
    // Wait, let's just grep the local Prisma or SQL files using Node fs.
    import('fs').then(fs => {
        const migrationsDir = './supabase_migrations';
        const files = fs.readdirSync(migrationsDir).sort();
        
        let schema = {};
        
        files.forEach(file => {
            if (!file.endsWith('.sql')) return;
            const content = fs.readFileSync(`${migrationsDir}/${file}`, 'utf8');
            
            // Very naive regex to find CREATE TABLE and ALTER TABLE ADD COLUMN
            const createTableRegex = /CREATE TABLE (?:IF NOT EXISTS )?(?:public\.)?\"?([a-zA-Z0-9_]+)\"?/gi;
            let match;
            while ((match = createTableRegex.exec(content)) !== null) {
                const tableName = match[1].toLowerCase();
                if (!schema[tableName]) schema[tableName] = [];
            }
        });
        
        console.log("Found tables in migrations:", Object.keys(schema));
    });
}
getFullSchema();
