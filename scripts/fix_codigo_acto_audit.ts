/**
 * Fix specific codigo_acto values found during audit.
 * Usage: npx tsx scripts/fix_codigo_acto_audit.ts
 */
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const FIXES: { nro_escritura: number; old: string; new_code: string; reason: string }[] = [
    { nro_escritura: 21, old: '702-00', new_code: '702-20', reason: 'ESCRITURA COMPLEMENTARIA → 702-20 (702-00 not in taxonomy)' },
    { nro_escritura: 36, old: '702-00', new_code: '702-20', reason: 'ESCRITURA COMPLEMENTARIA → 702-20 (702-00 not in taxonomy)' },
    { nro_escritura: 48, old: '702-00', new_code: '702-20', reason: 'ESCRITURA COMPLEMENTARIA → 702-20 (702-00 not in taxonomy)' },
    { nro_escritura: 29, old: '501-30', new_code: '501-32', reason: 'DESAFECTACIÓN DE VIVIENDA → 501-32 (501-30 not in taxonomy)' },
    { nro_escritura: 18, old: '300-00', new_code: '100-00', reason: 'tipo_acto is COMPRAVENTA but was coded as HIPOTECA (300-00)' },
];

async function main() {
    console.log('Fixing codigo_acto values from audit...\n');

    for (const fix of FIXES) {
        const { error } = await supabase
            .from('protocolo_registros')
            .update({ codigo_acto: fix.new_code })
            .eq('nro_escritura', fix.nro_escritura)
            .eq('codigo_acto', fix.old);

        if (error) {
            console.error(`  ✗ Esc ${fix.nro_escritura}: ${error.message}`);
        } else {
            console.log(`  ✓ Esc ${fix.nro_escritura}: "${fix.old}" → "${fix.new_code}" (${fix.reason})`);
        }
    }

    console.log('\nDone.');
}

main().catch(console.error);
