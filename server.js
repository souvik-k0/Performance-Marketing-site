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
//  DATA LAYER (JSON — swap for Supabase later)
// ══════════════════════════════════
const DATA = {
  resources: path.join(__dirname, 'data', 'resources.json'),
  demos: path.join(__dirname, 'data', 'demos.json'),
  testimonials: path.join(__dirname, 'data', 'testimonials.json'),
};

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch { return []; }
}

function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf-8');
}

// ══════════════════════════════════
//  SSR PAGES
// ══════════════════════════════════

// Home — serve static for now (later: EJS with dynamic testimonials)
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Resources listing — SSR
app.get('/resources', (req, res) => {
  const resources = readJSON(DATA.resources);
  resources.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.render('resources', { resources });
});
app.get('/resources.html', (req, res) => res.redirect(301, '/resources'));

// Single resource page — SSR
app.get('/resources/:slug', (req, res) => {
  const resources = readJSON(DATA.resources);
  const resource = resources.find(r => r.slug === req.params.slug);
  if (!resource) return res.status(404).send('Resource not found');
  const contentHtml = resource.content ? marked.parse(resource.content) : '<p>Content coming soon.</p>';
  res.render('resource-single', { resource, contentHtml });
});

// ══════════════════════════════════
//  RESOURCES API
// ══════════════════════════════════
app.get('/api/resources', (req, res) => {
  const items = readJSON(DATA.resources);
  const { type } = req.query;
  res.json(type && type !== 'all' ? items.filter(r => r.type === type) : items);
});

app.get('/api/resources/:id', (req, res) => {
  const item = readJSON(DATA.resources).find(r => r.id === req.params.id);
  item ? res.json(item) : res.status(404).json({ error: 'Not found' });
});

app.post('/api/resources', upload.single('image'), (req, res) => {
  const items = readJSON(DATA.resources);
  const { type, title, description, link, content } = req.body;
  if (!type || !title || !description) return res.status(400).json({ error: 'type, title, description required' });

  const item = {
    id: uuidv4(), type, title,
    slug: uniqueSlug(title, items),
    description, content: content || '',
    imageUrl: req.file ? `/assets/uploads/${req.file.filename}` : '',
    link: link || '',
    createdAt: new Date().toISOString()
  };
  items.push(item);
  writeJSON(DATA.resources, items);
  res.status(201).json(item);
});

app.put('/api/resources/:id', upload.single('image'), (req, res) => {
  const items = readJSON(DATA.resources);
  const idx = items.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const { type, title, description, link, content } = req.body;
  if (type) items[idx].type = type;
  if (title) {
    items[idx].title = title;
    items[idx].slug = uniqueSlug(title, items, items[idx].id);
  }
  if (description) items[idx].description = description;
  if (content !== undefined) items[idx].content = content;
  if (link !== undefined) items[idx].link = link;
  if (req.file) {
    if (items[idx].imageUrl) { const p = path.join(__dirname, items[idx].imageUrl); if (fs.existsSync(p)) fs.unlinkSync(p); }
    items[idx].imageUrl = `/assets/uploads/${req.file.filename}`;
  }
  writeJSON(DATA.resources, items);
  res.json(items[idx]);
});

app.delete('/api/resources/:id', (req, res) => {
  let items = readJSON(DATA.resources);
  const item = items.find(r => r.id === req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  if (item.imageUrl) { const p = path.join(__dirname, item.imageUrl); if (fs.existsSync(p)) fs.unlinkSync(p); }
  items = items.filter(r => r.id !== req.params.id);
  writeJSON(DATA.resources, items);
  res.json({ message: 'Deleted' });
});

// ══════════════════════════════════
//  DEMO REQUESTS API
// ══════════════════════════════════
app.get('/api/demos', (req, res) => {
  const demos = readJSON(DATA.demos);
  demos.sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
  res.json(demos);
});

// Public form submission
app.post('/api/demos', (req, res) => {
  const demos = readJSON(DATA.demos);
  const { name, email, company, adSpend } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'name and email are required' });

  const demo = {
    id: uuidv4(),
    name, email,
    company: company || '',
    adSpend: adSpend || '',
    status: 'new',  // new → contacted → closed
    notes: '',
    submittedAt: new Date().toISOString()
  };
  demos.push(demo);
  writeJSON(DATA.demos, demos);
  res.status(201).json({ message: 'Demo request submitted! We\'ll be in touch shortly.' });
});

// Update status / notes
app.put('/api/demos/:id', (req, res) => {
  const demos = readJSON(DATA.demos);
  const idx = demos.findIndex(d => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const { status, notes } = req.body;
  if (status) demos[idx].status = status;
  if (notes !== undefined) demos[idx].notes = notes;
  writeJSON(DATA.demos, demos);
  res.json(demos[idx]);
});

app.delete('/api/demos/:id', (req, res) => {
  let demos = readJSON(DATA.demos);
  if (!demos.find(d => d.id === req.params.id)) return res.status(404).json({ error: 'Not found' });
  demos = demos.filter(d => d.id !== req.params.id);
  writeJSON(DATA.demos, demos);
  res.json({ message: 'Deleted' });
});

// ══════════════════════════════════
//  TESTIMONIALS API
// ══════════════════════════════════
app.get('/api/testimonials', (req, res) => {
  const items = readJSON(DATA.testimonials);
  const { visible } = req.query;
  if (visible === 'true') return res.json(items.filter(t => t.visible));
  res.json(items);
});

app.post('/api/testimonials', (req, res) => {
  const items = readJSON(DATA.testimonials);
  const { quote, name, role, initials, rating, visible } = req.body;
  if (!quote || !name) return res.status(400).json({ error: 'quote and name are required' });

  const item = {
    id: uuidv4(), quote, name,
    role: role || '', initials: initials || name.split(' ').map(w => w[0]).join('').toUpperCase(),
    rating: parseInt(rating) || 5,
    visible: visible !== false,
    createdAt: new Date().toISOString()
  };
  items.push(item);
  writeJSON(DATA.testimonials, items);
  res.status(201).json(item);
});

app.put('/api/testimonials/:id', (req, res) => {
  const items = readJSON(DATA.testimonials);
  const idx = items.findIndex(t => t.id === req.params.id);
  if (idx === -1) return res.status(404).json({ error: 'Not found' });

  const { quote, name, role, initials, rating, visible } = req.body;
  if (quote) items[idx].quote = quote;
  if (name) items[idx].name = name;
  if (role !== undefined) items[idx].role = role;
  if (initials) items[idx].initials = initials;
  if (rating) items[idx].rating = parseInt(rating);
  if (visible !== undefined) items[idx].visible = visible;
  writeJSON(DATA.testimonials, items);
  res.json(items[idx]);
});

app.delete('/api/testimonials/:id', (req, res) => {
  let items = readJSON(DATA.testimonials);
  if (!items.find(t => t.id === req.params.id)) return res.status(404).json({ error: 'Not found' });
  items = items.filter(t => t.id !== req.params.id);
  writeJSON(DATA.testimonials, items);
  res.json({ message: 'Deleted' });
});

// ══════════════════════════════════
//  ANALYTICS API (aggregate stats)
// ══════════════════════════════════
app.get('/api/stats', (req, res) => {
  const resources = readJSON(DATA.resources);
  const demos = readJSON(DATA.demos);
  const testimonials = readJSON(DATA.testimonials);

  res.json({
    resources: {
      total: resources.length,
      caseStudies: resources.filter(r => r.type === 'case-study').length,
      blogs: resources.filter(r => r.type === 'blog').length
    },
    demos: {
      total: demos.length,
      new: demos.filter(d => d.status === 'new').length,
      contacted: demos.filter(d => d.status === 'contacted').length,
      closed: demos.filter(d => d.status === 'closed').length
    },
    testimonials: {
      total: testimonials.length,
      visible: testimonials.filter(t => t.visible).length
    }
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
