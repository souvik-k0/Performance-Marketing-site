const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

// Connect to SQLite database
const dbPath = path.join(__dirname, 'data', 'database.sqlite');
const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// ══════════════════════════════════
//  TABLE INITIALIZATION
// ══════════════════════════════════

db.exec(`
  CREATE TABLE IF NOT EXISTS resources (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    description TEXT,
    content TEXT,
    imageUrl TEXT,
    link TEXT,
    createdAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS demos (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    company TEXT,
    goals TEXT,
    status TEXT NOT NULL,
    submittedAt TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS testimonials (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    role TEXT,
    company TEXT,
    quote TEXT NOT NULL,
    isVisible INTEGER DEFAULT 1,
    createdAt TEXT NOT NULL
  );
`);

// ══════════════════════════════════
//  DATA MIGRATION (JSON -> SQLite)
// ══════════════════════════════════
// If the SQLite tables are empty, try to import from the old JSON files.

const resourcesCount = db.prepare("SELECT COUNT(*) as c FROM resources").get().c;
if (resourcesCount === 0) {
    try {
        const jsonPath = path.join(__dirname, 'data', 'resources.json');
        if (fs.existsSync(jsonPath)) {
            const items = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
            const stmt = db.prepare('INSERT INTO resources (id, type, title, slug, description, content, imageUrl, link, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)');
            const insertMany = db.transaction((rows) => {
                for (const r of rows) stmt.run(r.id, r.type, r.title, r.slug || '', r.description || '', r.content || '', r.imageUrl || '', r.link || '', r.createdAt);
            });
            insertMany(items);
            console.log(`✅ Migrated ${items.length} resources to SQLite.`);
        }
    } catch (err) { console.error("Resource migration error:", err); }
}

const demosCount = db.prepare("SELECT COUNT(*) as c FROM demos").get().c;
if (demosCount === 0) {
    try {
        const jsonPath = path.join(__dirname, 'data', 'demos.json');
        if (fs.existsSync(jsonPath)) {
            const items = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
            const stmt = db.prepare('INSERT INTO demos (id, name, email, company, goals, status, submittedAt) VALUES (?, ?, ?, ?, ?, ?, ?)');
            const insertMany = db.transaction((rows) => {
                for (const d of rows) stmt.run(d.id, d.name, d.email, d.company || '', d.goals || '', d.status, d.submittedAt);
            });
            insertMany(items);
            console.log(`✅ Migrated ${items.length} demos to SQLite.`);
        }
    } catch (err) { console.error("Demo migration error:", err); }
}

const testimonialsCount = db.prepare("SELECT COUNT(*) as c FROM testimonials").get().c;
if (testimonialsCount === 0) {
    try {
        const jsonPath = path.join(__dirname, 'data', 'testimonials.json');
        if (fs.existsSync(jsonPath)) {
            const items = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
            const stmt = db.prepare('INSERT INTO testimonials (id, name, role, company, quote, isVisible, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?)');
            const insertMany = db.transaction((rows) => {
                for (const t of rows) stmt.run(t.id, t.name, t.role || '', t.company || '', t.quote, t.isVisible ? 1 : 0, t.createdAt);
            });
            insertMany(items);
            console.log(`✅ Migrated ${items.length} testimonials to SQLite.`);
        }
    } catch (err) { console.error("Testimonial migration error:", err); }
}

module.exports = db;
