import fs from 'fs';
import path from 'path';

/**
 * CLI Script to seed system skills from .agent/skills/ directory.
 * Run with: npx tsx scripts/seed-skills.ts
 */

// 1. Manually load .env.local before any other imports
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    console.log(`[SEEDER] 📝 Loading environment from ${envPath}`);
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
        const trimmedLine = line.trim();
        if (!trimmedLine || trimmedLine.startsWith('#')) return;

        const [key, ...valueParts] = trimmedLine.split('=');
        if (key) {
            const value = valueParts.join('=').trim();
            // Remove quotes if present
            process.env[key.trim()] = value.replace(/^["']|["']$/g, '');
        }
    });
}

const SKILLS_DIR = path.join(process.cwd(), '.agent/skills');

async function seedSkills() {
    // 2. Dynamic import to ensure process.env is populated
    const { supabaseAdmin } = await import('../src/lib/supabaseAdmin');

    console.log("------------------------------------------");
    console.log("🚀 EscriAR Skill Registry Seeder");
    console.log("------------------------------------------");

    if (!fs.existsSync(SKILLS_DIR)) {
        console.error(`[SEEDER] ❌ Skills directory not found: ${SKILLS_DIR}`);
        return;
    }

    const skillFolders = fs.readdirSync(SKILLS_DIR);
    console.log(`[SEEDER] 📂 Found ${skillFolders.length} folders in /.agent/skills`);

    for (const folder of skillFolders) {
        const skillPath = path.join(SKILLS_DIR, folder, 'SKILL.md');

        if (fs.existsSync(skillPath)) {
            const content = fs.readFileSync(skillPath, 'utf8');

            // Frontmatter extraction (improved)
            const nameMatch = content.match(/^name:\s*(.*)/m);
            const descMatch = content.match(/^description:\s*(.*)/m);

            const skillData = {
                slug: folder,
                name: nameMatch ? nameMatch[1].trim() : folder,
                description: descMatch ? descMatch[1].trim() : '',
                content_md: content,
                version: '1.0.0',
                is_active: true,
                updated_at: new Date().toISOString()
            };

            console.log(`[SEEDER] ⏳ Upserting skill: ${skillData.slug}...`);

            const { error } = await supabaseAdmin
                .from('system_skills')
                .upsert(skillData, { onConflict: 'slug' });

            if (error) {
                console.error(`[SEEDER] ❌ Error upserting ${folder}:`, error.message);
            } else {
                console.log(`[SEEDER] ✅ Successfully seeded ${folder}`);
            }
        }
    }

    console.log("------------------------------------------");
    console.log("✅ Seeding Complete.");
    console.log("------------------------------------------");
}

seedSkills().catch(error => {
    console.error("[SEEDER] 🛑 Fatal Error:", error);
    process.exit(1);
});
