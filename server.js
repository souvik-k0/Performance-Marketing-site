require('dotenv').config({ path: '.env.local' });
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { marked } = require('marked');

// ── Slug helper ──
function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
function uniqueSlug(title, items, currentId) {
  let slug = slugify(title);
  let counter = 2;
  while (items.some(r => r.slug === slug && r.id !== currentId)) {
    slug = slugify(title) + '-' + counter++;
  }
  return slug;
}

const app = express();
const PORT = process.env.PORT || 3000;

// ── View Engine ──
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Middleware ──
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use(express.static(path.join(__dirname), { index: false }));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

// ── Image Upload ──
const uploadsDir = path.join(__dirname, 'assets', 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadsDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e4)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp|svg/;
    cb(null, allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype));
  }
});

// ══════════════════════════════════
//  DATABASE LAYER (SQLite via db.js)
// ══════════════════════════════════
const db = require('./db');

// ══════════════════════════════════
//  SSR PAGES
// ══════════════════════════════════

// Home — serve static for now (later: EJS with dynamic testimonials)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Resources listing — SSR
app.get('/resources', (req, res) => {
  const resources = db.prepare('SELECT * FROM resources ORDER BY createdAt DESC').all();
  res.render('resources', { resources });
});
app.get('/resources.html', (req, res) => res.redirect(301, '/resources'));

// Single resource page — SSR
app.get('/resources/:slug', (req, res) => {
  const resource = db.prepare('SELECT * FROM resources WHERE slug = ?').get(req.params.slug);
  if (!resource) return res.status(404).send('Resource not found');
  const contentHtml = resource.content ? marked.parse(resource.content) : '<p>Content coming soon.</p>';
  res.render('resource-single', { resource, contentHtml });
});

// ══════════════════════════════════
//  RESOURCES API
// ══════════════════════════════════
app.get('/api/resources', (req, res) => {
  const { type } = req.query;
  const items = type && type !== 'all'
    ? db.prepare('SELECT * FROM resources WHERE type = ? ORDER BY createdAt DESC').all(type)
    : db.prepare('SELECT * FROM resources ORDER BY createdAt DESC').all();
  res.json(items);
});

app.get('/api/resources/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM resources WHERE id = ?').get(req.params.id);
  item ? res.json(item) : res.status(404).json({ error: 'Not found' });
});

app.post('/api/resources', upload.single('image'), (req, res) => {
  const { type, title, description, link, content } = req.body;
  if (!type || !title || !description) return res.status(400).json({ error: 'type, title, description required' });

  // Generate unique slug using SQL
  let slug = slugify(title);
  let counter = 2;
  while (db.prepare('SELECT id FROM resources WHERE slug = ?').get(slug)) {
    slug = slugify(title) + '-' + counter++;
  }

  const item = {
    id: uuidv4(), type, title, slug,
    description, content: content || '',
    imageUrl: req.file ? `/assets/uploads/${req.file.filename}` : '',
    link: link || '',
    createdAt: new Date().toISOString()
  };

  db.prepare('INSERT INTO resources (id, type, title, slug, description, content, imageUrl, link, createdAt) VALUES (@id, @type, @title, @slug, @description, @content, @imageUrl, @link, @createdAt)').run(item);
  res.status(201).json(item);
});

app.put('/api/resources/:id', upload.single('image'), (req, res) => {
  const item = db.prepare('SELECT * FROM resources WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  const { type, title, description, link, content } = req.body;
  let updates = { ...item };

  if (type) updates.type = type;
  if (title) {
    updates.title = title;
    let newSlug = slugify(title);
    let counter = 2;
    while (db.prepare('SELECT id FROM resources WHERE slug = ? AND id != ?').get(newSlug, req.params.id)) {
      newSlug = slugify(title) + '-' + counter++;
    }
    updates.slug = newSlug;
  }
  if (description) updates.description = description;
  if (content !== undefined) updates.content = content;
  if (link !== undefined) updates.link = link;
  if (req.file) {
    if (item.imageUrl) { const p = path.join(__dirname, item.imageUrl); if (fs.existsSync(p)) fs.unlinkSync(p); }
    updates.imageUrl = `/assets/uploads/${req.file.filename}`;
  }

  db.prepare(`
    UPDATE resources SET 
    type = @type, title = @title, slug = @slug, description = @description, 
    content = @content, imageUrl = @imageUrl, link = @link 
    WHERE id = @id
  `).run(updates);

  res.json(updates);
});

app.delete('/api/resources/:id', (req, res) => {
  const item = db.prepare('SELECT imageUrl FROM resources WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  if (item.imageUrl) { const p = path.join(__dirname, item.imageUrl); if (fs.existsSync(p)) fs.unlinkSync(p); }
  db.prepare('DELETE FROM resources WHERE id = ?').run(req.params.id);
  res.json({ message: 'Deleted' });
});

// ══════════════════════════════════
//  DEMO REQUESTS API
// ══════════════════════════════════
app.get('/api/demos', (req, res) => {
  const demos = db.prepare('SELECT * FROM demos ORDER BY submittedAt DESC').all();
  res.json(demos);
});

app.post('/api/demos', (req, res) => {
  const { name, email, company, adSpend } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' });

  const demo = {
    id: uuidv4(), name, email,
    company: company || '', goals: adSpend || '',
    status: 'new',
    submittedAt: new Date().toISOString()
  };

  db.prepare('INSERT INTO demos (id, name, email, company, goals, status, submittedAt) VALUES (@id, @name, @email, @company, @goals, @status, @submittedAt)').run(demo);
  res.status(201).json({ message: 'Demo request submitted! We\'ll be in touch shortly.' });
});

app.put('/api/demos/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM demos WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  const { status, notes } = req.body;
  let newStatus = status || item.status;
  let newGoals = notes !== undefined ? notes : item.goals; // We used 'goals' for 'notes' in the DB originally

  db.prepare('UPDATE demos SET status = ?, goals = ? WHERE id = ?').run(newStatus, newGoals, req.params.id);
  item.status = newStatus;
  item.goals = newGoals;
  res.json(item);
});

app.delete('/api/demos/:id', (req, res) => {
  const info = db.prepare('DELETE FROM demos WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Deleted' });
});

// ══════════════════════════════════
//  TESTIMONIALS API
// ══════════════════════════════════
app.get('/api/testimonials', (req, res) => {
  const { visible } = req.query;
  const items = visible === 'true'
    ? db.prepare('SELECT * FROM testimonials WHERE isVisible = 1 ORDER BY createdAt DESC').all()
    : db.prepare('SELECT * FROM testimonials ORDER BY createdAt DESC').all();

  // Map SQLite 1/0 back to boolean for the frontend
  items.forEach(i => i.visible = i.isVisible === 1);
  res.json(items);
});

app.post('/api/testimonials', (req, res) => {
  const { quote, name, role, initials, rating, visible } = req.body;
  if (!quote || !name) return res.status(400).json({ error: 'quote and name are required' });

  // Note: We don't store initials or rating in DB right now based on schema, but they aren't strictly needed for the old static cards
  const item = {
    id: uuidv4(), quote, name,
    role: role || '', company: '',
    isVisible: visible !== false ? 1 : 0,
    createdAt: new Date().toISOString()
  };

  db.prepare('INSERT INTO testimonials (id, name, role, company, quote, isVisible, createdAt) VALUES (@id, @name, @role, @company, @quote, @isVisible, @createdAt)').run(item);
  item.visible = item.isVisible === 1;
  res.status(201).json(item);
});

app.put('/api/testimonials/:id', (req, res) => {
  const item = db.prepare('SELECT * FROM testimonials WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });

  const { quote, name, role, visible } = req.body;
  let updates = { ...item };
  if (quote) updates.quote = quote;
  if (name) updates.name = name;
  if (role !== undefined) updates.role = role;
  if (visible !== undefined) updates.isVisible = visible ? 1 : 0;

  db.prepare('UPDATE testimonials SET quote = @quote, name = @name, role = @role, isVisible = @isVisible WHERE id = @id').run(updates);
  updates.visible = updates.isVisible === 1;
  res.json(updates);
});

app.delete('/api/testimonials/:id', (req, res) => {
  const info = db.prepare('DELETE FROM testimonials WHERE id = ?').run(req.params.id);
  if (info.changes === 0) return res.status(404).json({ error: 'Not found' });
  res.json({ message: 'Deleted' });
});

// ══════════════════════════════════
//  ANALYTICS API (aggregate stats)
// ══════════════════════════════════
app.get('/api/stats', (req, res) => {
  const resourcesTotal = db.prepare('SELECT COUNT(*) as c FROM resources').get().c;
  const caseStudies = db.prepare("SELECT COUNT(*) as c FROM resources WHERE type = 'case-study'").get().c;
  const blogs = db.prepare("SELECT COUNT(*) as c FROM resources WHERE type = 'blog'").get().c;

  const demosTotal = db.prepare('SELECT COUNT(*) as c FROM demos').get().c;
  const demosNew = db.prepare("SELECT COUNT(*) as c FROM demos WHERE status = 'new'").get().c;
  const demosContacted = db.prepare("SELECT COUNT(*) as c FROM demos WHERE status = 'contacted'").get().c;
  const demosClosed = db.prepare("SELECT COUNT(*) as c FROM demos WHERE status = 'closed'").get().c;

  const testimonialsTotal = db.prepare('SELECT COUNT(*) as c FROM testimonials').get().c;
  const testimonialsVisible = db.prepare('SELECT COUNT(*) as c FROM testimonials WHERE isVisible = 1').get().c;

  res.json({
    resources: { total: resourcesTotal, caseStudies, blogs },
    demos: { total: demosTotal, new: demosNew, contacted: demosContacted, closed: demosClosed },
    testimonials: { total: testimonialsTotal, visible: testimonialsVisible }
  });
});

// Upload endpoint
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No image' });
  res.json({ url: `/assets/uploads/${req.file.filename}` });
});

// ══════════════════════════════════
//  ADMIN AUTH
// ══════════════════════════════════
app.post('/api/admin/login', (req, res) => {
  const { password } = req.body;
  const adminPw = process.env.ADMIN_PASSWORD || 'admin';
  if (password === adminPw) {
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, error: 'Incorrect password' });
  }
});

// ── Start ──
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  🚀 BrandBiography server → http://0.0.0.0:${PORT}`);
  console.log(`  📊 Admin dashboard → http://0.0.0.0:${PORT}/admin`);
  console.log(`  📄 Resources (SSR) → http://0.0.0.0:${PORT}/resources\n`);
});
