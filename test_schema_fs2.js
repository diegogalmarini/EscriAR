import * as fs from 'fs';
import * as path from 'path';

function findTableSchema(tableName) {
    const migrationsDir = './supabase_migrations';
    const files = fs.readdirSync(migrationsDir).sort();
    
    // Reverse sort to get the latest schema definition/alterations
    files.reverse().forEach(file => {
        if (!file.endsWith('.sql')) return;
        const content = fs.readFileSync(path.join(migrationsDir, file), 'utf8');
        
        if (content.match(new RegExp(`CREATE TABLE(?: IF NOT EXISTS)? (?:public\\.)?\\"?${tableName}\\"?`, 'i'))) {
            console.log(`--- File: ${file} ---`);
            const lines = content.split('\\n');
            let inTable = false;
            for (let line of lines) {
                if (line.match(new RegExp(`CREATE TABLE(?: IF NOT EXISTS)? (?:public\\.)?\\"?${tableName}\\"?`, 'i'))) {
                    inTable = true;
                }
                if (inTable) {
                    console.log(line);
                    if (line.trim() === ');' || line.trim() === ')') break;
                }
            }
        }
    });
}

findTableSchema('inmuebles');
findTableSchema('operaciones');
findTableSchema('inmuebles_operacion');
