const express = require('express');
const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const http = require('http');
const https = require('https');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'CARLOC_SECRET_2026_@#$';
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ─── DATABASE ─────────────────────────────────────────────────────────────────
const db = new Database(path.join(DATA_DIR, 'carloc.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role TEXT DEFAULT 'client',
    company TEXT DEFAULT '',
    phone TEXT DEFAULT '',
    plan TEXT DEFAULT 'month',
    expires_at TEXT,
    status TEXT DEFAULT 'active',
    created_at TEXT DEFAULT (datetime('now')),
    last_login TEXT
  );

  CREATE TABLE IF NOT EXISTS cars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    plate TEXT NOT NULL,
    brand TEXT NOT NULL,
    model TEXT NOT NULL,
    year INTEGER DEFAULT 2020,
    color TEXT DEFAULT '',
    category TEXT DEFAULT 'Economique',
    fuel_type TEXT DEFAULT 'Essence',
    transmission TEXT DEFAULT 'Manuelle',
    seats INTEGER DEFAULT 5,
    km INTEGER DEFAULT 0,
    price_day REAL DEFAULT 0,
    status TEXT DEFAULT 'disponible',
    insurance_exp TEXT,
    vignette_exp TEXT,
    visite_exp TEXT,
    next_maintenance INTEGER DEFAULT 0,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  );

  CREATE TABLE IF NOT EXISTS clients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    cin TEXT,
    passport TEXT,
    phone TEXT,
    email TEXT,
    adresse TEXT,
    ville TEXT,
    nationalite TEXT DEFAULT 'Marocaine',
    permis_num TEXT,
    permis_cat TEXT DEFAULT 'B',
    permis_exp TEXT,
    blacklist INTEGER DEFAULT 0,
    blacklist_reason TEXT,
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  );

  CREATE TABLE IF NOT EXISTS reservations (
    id TEXT PRIMARY KEY,
    account_id INTEGER NOT NULL,
    car_id INTEGER,
    client_id INTEGER,
    date_debut TEXT NOT NULL,
    date_fin TEXT NOT NULL,
    km_depart INTEGER DEFAULT 0,
    km_retour INTEGER DEFAULT 0,
    prix_jour REAL DEFAULT 0,
    total REAL DEFAULT 0,
    caution REAL DEFAULT 0,
    caution_rendue INTEGER DEFAULT 0,
    statut TEXT DEFAULT 'confirmee',
    lieu_prise TEXT DEFAULT '',
    lieu_retour TEXT DEFAULT '',
    carburant_depart TEXT DEFAULT 'plein',
    carburant_retour TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  );

  CREATE TABLE IF NOT EXISTS contrats (
    id TEXT PRIMARY KEY,
    account_id INTEGER NOT NULL,
    reservation_id TEXT,
    car_id INTEGER,
    client_id INTEGER,
    date_debut TEXT,
    date_fin TEXT,
    date_retour_reel TEXT,
    km_depart INTEGER DEFAULT 0,
    km_retour INTEGER DEFAULT 0,
    prix_jour REAL DEFAULT 0,
    jours INTEGER DEFAULT 0,
    sous_total REAL DEFAULT 0,
    extras REAL DEFAULT 0,
    remise REAL DEFAULT 0,
    total REAL DEFAULT 0,
    caution REAL DEFAULT 0,
    caution_rendue INTEGER DEFAULT 0,
    mode_paiement TEXT DEFAULT 'Espèces',
    statut TEXT DEFAULT 'en_cours',
    etat_depart TEXT DEFAULT 'bon',
    etat_retour TEXT DEFAULT '',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  );

  CREATE TABLE IF NOT EXISTS factures (
    id TEXT PRIMARY KEY,
    account_id INTEGER NOT NULL,
    contrat_id TEXT,
    client_id INTEGER,
    montant REAL NOT NULL,
    tva REAL DEFAULT 20,
    montant_ttc REAL,
    statut TEXT DEFAULT 'en_attente',
    date_emission TEXT,
    date_echeance TEXT,
    mode_paiement TEXT DEFAULT 'Espèces',
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  );

  CREATE TABLE IF NOT EXISTS sinistres (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    car_id INTEGER,
    client_id INTEGER,
    contrat_id TEXT,
    date_sinistre TEXT,
    type_sinistre TEXT DEFAULT 'Accident',
    description TEXT,
    lieu TEXT,
    gravite TEXT DEFAULT 'Mineur',
    cout_reparation REAL DEFAULT 0,
    assurance_declaree INTEGER DEFAULT 0,
    assurance_ref TEXT,
    statut TEXT DEFAULT 'ouvert',
    photos TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  );

  CREATE TABLE IF NOT EXISTS maintenances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    car_id INTEGER,
    type TEXT DEFAULT 'Vidange',
    date_prevue TEXT,
    date_reelle TEXT,
    km_prevu INTEGER DEFAULT 0,
    cout REAL DEFAULT 0,
    garage TEXT DEFAULT '',
    description TEXT DEFAULT '',
    statut TEXT DEFAULT 'planifie',
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  );

  CREATE TABLE IF NOT EXISTS depenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    car_id INTEGER,
    type TEXT DEFAULT 'Carburant',
    montant REAL DEFAULT 0,
    date TEXT,
    description TEXT DEFAULT '',
    justif INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  );

  CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    type TEXT DEFAULT 'info',
    title TEXT NOT NULL,
    desc TEXT DEFAULT '',
    read INTEGER DEFAULT 0,
    created_at TEXT DEFAULT (datetime('now')),
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  );

  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_id INTEGER NOT NULL,
    key TEXT NOT NULL,
    value TEXT,
    UNIQUE(account_id, key),
    FOREIGN KEY (account_id) REFERENCES accounts(id)
  );

  CREATE TABLE IF NOT EXISTS trial_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    nom TEXT NOT NULL,
    prenom TEXT NOT NULL,
    phone TEXT NOT NULL,
    email TEXT NOT NULL,
    societe TEXT NOT NULL,
    status TEXT DEFAULT 'en_attente',
    created_at TEXT DEFAULT (datetime('now')),
    treated_at TEXT,
    treated_by INTEGER
  );
`);

// ─── SUPER ADMIN ──────────────────────────────────────────────────────────────
const superExists = db.prepare("SELECT id FROM accounts WHERE role='super'").get();
if (!superExists) {
  const hash = bcrypt.hashSync('CarLoc2026@Admin', 10);
  db.prepare(`INSERT INTO accounts (name,email,password,role,company,plan,expires_at)
    VALUES (?,?,?,'super','CarLoc Manager','life','2099-12-31')`)
    .run('Super Admin', 'admin@carloc.ma', hash);
  console.log('✅ Super Admin: admin@carloc.ma / CarLoc2026@Admin');
}

// ─── AUTH MIDDLEWARE ──────────────────────────────────────────────────────────
function auth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token manquant' });
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const account = db.prepare('SELECT * FROM accounts WHERE id=?').get(decoded.id);
    if (!account) return res.status(401).json({ error: 'Compte introuvable' });
    if (account.status !== 'active') return res.status(403).json({ error: 'Compte suspendu' });
    if (account.role !== 'super' && account.plan !== 'life') {
      if (account.expires_at && new Date(account.expires_at) < new Date())
        return res.status(403).json({ error: 'Licence expirée', expired: true });
    }
    req.account = account;
    next();
  } catch (e) { res.status(401).json({ error: 'Token invalide' }); }
}

function superOnly(req, res, next) {
  if (req.account.role !== 'super') return res.status(403).json({ error: 'Accès refusé' });
  next();
}

// ─── AUTH ROUTES ──────────────────────────────────────────────────────────────
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email et mot de passe requis' });
  const account = db.prepare('SELECT * FROM accounts WHERE email=?').get(email.toLowerCase().trim());
  if (!account || !bcrypt.compareSync(password, account.password))
    return res.status(401).json({ error: 'Email ou mot de passe incorrect' });
  if (account.status !== 'active') return res.status(403).json({ error: 'Compte suspendu' });
  if (account.role !== 'super' && account.plan !== 'life') {
    if (account.expires_at && new Date(account.expires_at) < new Date())
      return res.status(403).json({ error: 'Licence expirée. Contactez l administrateur.', expired: true });
  }
  db.prepare("UPDATE accounts SET last_login=datetime('now') WHERE id=?").run(account.id);
  const token = jwt.sign({ id: account.id, role: account.role }, JWT_SECRET, { expiresIn: '30d' });
  const { password: _, ...accountData } = account;
  res.json({ token, account: accountData });
});

app.get('/api/me', auth, (req, res) => {
  const { password: _, ...a } = req.account; res.json(a);
});

// ─── STATS ────────────────────────────────────────────────────────────────────
app.get('/api/stats', auth, (req, res) => {
  const aid = req.account.id;
  const cars = db.prepare('SELECT COUNT(*) as c FROM cars WHERE account_id=?').get(aid).c;
  const available = db.prepare("SELECT COUNT(*) as c FROM cars WHERE account_id=? AND status='disponible'").get(aid).c;
  const clients = db.prepare('SELECT COUNT(*) as c FROM clients WHERE account_id=?').get(aid).c;
  const activeContrats = db.prepare("SELECT COUNT(*) as c FROM contrats WHERE account_id=? AND statut='en_cours'").get(aid).c;
  const revenue = db.prepare("SELECT COALESCE(SUM(total),0) as s FROM contrats WHERE account_id=? AND statut='termine'").get(aid).s;
  const pending = db.prepare("SELECT COALESCE(SUM(montant_ttc),0) as s FROM factures WHERE account_id=? AND statut='en_attente'").get(aid).s;
  const sinistres = db.prepare("SELECT COUNT(*) as c FROM sinistres WHERE account_id=? AND statut='ouvert'").get(aid).c;
  const unreadAlerts = db.prepare('SELECT COUNT(*) as c FROM alerts WHERE account_id=? AND read=0').get(aid).c;
  res.json({ cars, available, clients, activeContrats, revenue, pending, sinistres, unreadAlerts });
});

// ─── CARS ─────────────────────────────────────────────────────────────────────
app.get('/api/cars', auth, (req, res) => res.json(db.prepare('SELECT * FROM cars WHERE account_id=? ORDER BY id DESC').all(req.account.id)));
app.post('/api/cars', auth, (req, res) => {
  const { plate,brand,model,year,color,category,fuel_type,transmission,seats,km,price_day,status,insurance_exp,vignette_exp,visite_exp,next_maintenance,notes } = req.body;
  if(!plate||!brand||!model) return res.status(400).json({error:'Plaque, marque et modèle requis'});
  const r = db.prepare(`INSERT INTO cars (account_id,plate,brand,model,year,color,category,fuel_type,transmission,seats,km,price_day,status,insurance_exp,vignette_exp,visite_exp,next_maintenance,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(req.account.id,plate,brand,model,year||2020,color||'',category||'Economique',fuel_type||'Essence',transmission||'Manuelle',seats||5,km||0,price_day||0,status||'disponible',insurance_exp||'',vignette_exp||'',visite_exp||'',next_maintenance||0,notes||'');
  res.json({success:true,id:r.lastInsertRowid});
});
app.put('/api/cars/:id', auth, (req, res) => {
  const { plate,brand,model,year,color,category,fuel_type,transmission,seats,km,price_day,status,insurance_exp,vignette_exp,visite_exp,next_maintenance,notes } = req.body;
  db.prepare(`UPDATE cars SET plate=?,brand=?,model=?,year=?,color=?,category=?,fuel_type=?,transmission=?,seats=?,km=?,price_day=?,status=?,insurance_exp=?,vignette_exp=?,visite_exp=?,next_maintenance=?,notes=? WHERE id=? AND account_id=?`)
    .run(plate,brand,model,year||2020,color||'',category||'Economique',fuel_type||'Essence',transmission||'Manuelle',seats||5,km||0,price_day||0,status||'disponible',insurance_exp||'',vignette_exp||'',visite_exp||'',next_maintenance||0,notes||'',req.params.id,req.account.id);
  res.json({success:true});
});
app.delete('/api/cars/:id', auth, (req, res) => { db.prepare('DELETE FROM cars WHERE id=? AND account_id=?').run(req.params.id,req.account.id); res.json({success:true}); });

// ─── CLIENTS ──────────────────────────────────────────────────────────────────
app.get('/api/clients', auth, (req, res) => res.json(db.prepare('SELECT * FROM clients WHERE account_id=? ORDER BY id DESC').all(req.account.id)));
app.post('/api/clients', auth, (req, res) => {
  const { nom,prenom,cin,passport,phone,email,adresse,ville,nationalite,permis_num,permis_cat,permis_exp,notes } = req.body;
  if(!nom||!prenom) return res.status(400).json({error:'Nom et prénom requis'});
  const r = db.prepare(`INSERT INTO clients (account_id,nom,prenom,cin,passport,phone,email,adresse,ville,nationalite,permis_num,permis_cat,permis_exp,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(req.account.id,nom,prenom,cin||'',passport||'',phone||'',email||'',adresse||'',ville||'',nationalite||'Marocaine',permis_num||'',permis_cat||'B',permis_exp||'',notes||'');
  res.json({success:true,id:r.lastInsertRowid});
});
app.put('/api/clients/:id', auth, (req, res) => {
  const { nom,prenom,cin,passport,phone,email,adresse,ville,nationalite,permis_num,permis_cat,permis_exp,blacklist,blacklist_reason,notes } = req.body;
  db.prepare(`UPDATE clients SET nom=?,prenom=?,cin=?,passport=?,phone=?,email=?,adresse=?,ville=?,nationalite=?,permis_num=?,permis_cat=?,permis_exp=?,blacklist=?,blacklist_reason=?,notes=? WHERE id=? AND account_id=?`)
    .run(nom,prenom,cin||'',passport||'',phone||'',email||'',adresse||'',ville||'',nationalite||'Marocaine',permis_num||'',permis_cat||'B',permis_exp||'',blacklist?1:0,blacklist_reason||'',notes||'',req.params.id,req.account.id);
  res.json({success:true});
});
app.delete('/api/clients/:id', auth, (req, res) => { db.prepare('DELETE FROM clients WHERE id=? AND account_id=?').run(req.params.id,req.account.id); res.json({success:true}); });

// ─── RESERVATIONS ─────────────────────────────────────────────────────────────
app.get('/api/reservations', auth, (req, res) => res.json(db.prepare('SELECT * FROM reservations WHERE account_id=? ORDER BY date_debut DESC').all(req.account.id)));
app.post('/api/reservations', auth, (req, res) => {
  const { car_id,client_id,date_debut,date_fin,prix_jour,total,caution,lieu_prise,lieu_retour,notes } = req.body;
  if(!date_debut||!date_fin) return res.status(400).json({error:'Dates obligatoires'});
  const id = 'RES-'+Date.now().toString(36).toUpperCase();
  db.prepare(`INSERT INTO reservations (id,account_id,car_id,client_id,date_debut,date_fin,prix_jour,total,caution,lieu_prise,lieu_retour,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id,req.account.id,car_id||null,client_id||null,date_debut,date_fin,prix_jour||0,total||0,caution||0,lieu_prise||'',lieu_retour||'',notes||'');
  res.json({success:true,id});
});
app.put('/api/reservations/:id', auth, (req, res) => {
  const { car_id,client_id,date_debut,date_fin,prix_jour,total,caution,statut,notes } = req.body;
  db.prepare(`UPDATE reservations SET car_id=?,client_id=?,date_debut=?,date_fin=?,prix_jour=?,total=?,caution=?,statut=?,notes=? WHERE id=? AND account_id=?`)
    .run(car_id||null,client_id||null,date_debut,date_fin,prix_jour||0,total||0,caution||0,statut||'confirmee',notes||'',req.params.id,req.account.id);
  res.json({success:true});
});
app.delete('/api/reservations/:id', auth, (req, res) => { db.prepare('DELETE FROM reservations WHERE id=? AND account_id=?').run(req.params.id,req.account.id); res.json({success:true}); });

// ─── CONTRATS ─────────────────────────────────────────────────────────────────
app.get('/api/contrats', auth, (req, res) => res.json(db.prepare('SELECT * FROM contrats WHERE account_id=? ORDER BY created_at DESC').all(req.account.id)));
app.post('/api/contrats', auth, (req, res) => {
  const { car_id,client_id,reservation_id,date_debut,date_fin,km_depart,prix_jour,jours,sous_total,extras,remise,total,caution,mode_paiement,etat_depart,notes } = req.body;
  if(!car_id||!client_id) return res.status(400).json({error:'Voiture et client requis'});
  const id = 'CTR-'+Date.now().toString(36).toUpperCase();
  db.prepare(`INSERT INTO contrats (id,account_id,car_id,client_id,reservation_id,date_debut,date_fin,km_depart,prix_jour,jours,sous_total,extras,remise,total,caution,mode_paiement,etat_depart,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id,req.account.id,car_id,client_id,reservation_id||null,date_debut,date_fin,km_depart||0,prix_jour||0,jours||0,sous_total||0,extras||0,remise||0,total||0,caution||0,mode_paiement||'Espèces',etat_depart||'bon',notes||'');
  // Update car status
  db.prepare("UPDATE cars SET status='loue' WHERE id=? AND account_id=?").run(car_id,req.account.id);
  res.json({success:true,id});
});
app.put('/api/contrats/:id', auth, (req, res) => {
  const { km_retour,date_retour_reel,etat_retour,extras,remise,total,caution_rendue,statut,mode_paiement,notes } = req.body;
  db.prepare(`UPDATE contrats SET km_retour=?,date_retour_reel=?,etat_retour=?,extras=?,remise=?,total=?,caution_rendue=?,statut=?,mode_paiement=?,notes=? WHERE id=? AND account_id=?`)
    .run(km_retour||0,date_retour_reel||'',etat_retour||'',extras||0,remise||0,total||0,caution_rendue?1:0,statut||'en_cours',mode_paiement||'Espèces',notes||'',req.params.id,req.account.id);
  // If terminated, free the car
  if(statut==='termine') {
    const c = db.prepare('SELECT car_id FROM contrats WHERE id=?').get(req.params.id);
    if(c) db.prepare("UPDATE cars SET status='disponible' WHERE id=? AND account_id=?").run(c.car_id,req.account.id);
  }
  res.json({success:true});
});
app.delete('/api/contrats/:id', auth, (req, res) => { db.prepare('DELETE FROM contrats WHERE id=? AND account_id=?').run(req.params.id,req.account.id); res.json({success:true}); });

// ─── FACTURES ─────────────────────────────────────────────────────────────────
app.get('/api/factures', auth, (req, res) => res.json(db.prepare('SELECT * FROM factures WHERE account_id=? ORDER BY created_at DESC').all(req.account.id)));
app.post('/api/factures', auth, (req, res) => {
  const { contrat_id,client_id,montant,tva,statut,date_emission,date_echeance,mode_paiement,notes } = req.body;
  if(!montant) return res.status(400).json({error:'Montant requis'});
  const id = 'FAC-'+Date.now().toString(36).toUpperCase();
  const tvaRate = tva||20;
  const ttc = Math.round(montant*(1+tvaRate/100)*100)/100;
  db.prepare(`INSERT INTO factures (id,account_id,contrat_id,client_id,montant,tva,montant_ttc,statut,date_emission,date_echeance,mode_paiement,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(id,req.account.id,contrat_id||null,client_id||null,montant,tvaRate,ttc,statut||'en_attente',date_emission||new Date().toISOString().split('T')[0],date_echeance||'',mode_paiement||'Espèces',notes||'');
  res.json({success:true,id});
});
app.put('/api/factures/:id', auth, (req, res) => {
  const { statut,mode_paiement,notes } = req.body;
  db.prepare('UPDATE factures SET statut=?,mode_paiement=?,notes=? WHERE id=? AND account_id=?')
    .run(statut||'en_attente',mode_paiement||'Espèces',notes||'',req.params.id,req.account.id);
  res.json({success:true});
});
app.delete('/api/factures/:id', auth, (req, res) => { db.prepare('DELETE FROM factures WHERE id=? AND account_id=?').run(req.params.id,req.account.id); res.json({success:true}); });

// ─── SINISTRES ────────────────────────────────────────────────────────────────
app.get('/api/sinistres', auth, (req, res) => res.json(db.prepare('SELECT * FROM sinistres WHERE account_id=? ORDER BY id DESC').all(req.account.id)));
app.post('/api/sinistres', auth, (req, res) => {
  const { car_id,client_id,contrat_id,date_sinistre,type_sinistre,description,lieu,gravite,cout_reparation,assurance_declaree,assurance_ref } = req.body;
  const r = db.prepare(`INSERT INTO sinistres (account_id,car_id,client_id,contrat_id,date_sinistre,type_sinistre,description,lieu,gravite,cout_reparation,assurance_declaree,assurance_ref) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(req.account.id,car_id||null,client_id||null,contrat_id||null,date_sinistre||'',type_sinistre||'Accident',description||'',lieu||'',gravite||'Mineur',cout_reparation||0,assurance_declaree?1:0,assurance_ref||'');
  res.json({success:true,id:r.lastInsertRowid});
});
app.put('/api/sinistres/:id', auth, (req, res) => {
  const { statut,cout_reparation,assurance_declaree,assurance_ref,notes } = req.body;
  db.prepare('UPDATE sinistres SET statut=?,cout_reparation=?,assurance_declaree=?,assurance_ref=?,description=? WHERE id=? AND account_id=?')
    .run(statut||'ouvert',cout_reparation||0,assurance_declaree?1:0,assurance_ref||'',notes||'',req.params.id,req.account.id);
  res.json({success:true});
});
app.delete('/api/sinistres/:id', auth, (req, res) => { db.prepare('DELETE FROM sinistres WHERE id=? AND account_id=?').run(req.params.id,req.account.id); res.json({success:true}); });

// ─── MAINTENANCES ─────────────────────────────────────────────────────────────
app.get('/api/maintenances', auth, (req, res) => res.json(db.prepare('SELECT * FROM maintenances WHERE account_id=? ORDER BY id DESC').all(req.account.id)));
app.post('/api/maintenances', auth, (req, res) => {
  const { car_id,type,date_prevue,km_prevu,cout,garage,description } = req.body;
  const r = db.prepare(`INSERT INTO maintenances (account_id,car_id,type,date_prevue,km_prevu,cout,garage,description) VALUES (?,?,?,?,?,?,?,?)`)
    .run(req.account.id,car_id||null,type||'Vidange',date_prevue||'',km_prevu||0,cout||0,garage||'',description||'');
  res.json({success:true,id:r.lastInsertRowid});
});
app.put('/api/maintenances/:id', auth, (req, res) => {
  const { statut,date_reelle,cout,garage,description } = req.body;
  db.prepare('UPDATE maintenances SET statut=?,date_reelle=?,cout=?,garage=?,description=? WHERE id=? AND account_id=?')
    .run(statut||'planifie',date_reelle||'',cout||0,garage||'',description||'',req.params.id,req.account.id);
  res.json({success:true});
});
app.delete('/api/maintenances/:id', auth, (req, res) => { db.prepare('DELETE FROM maintenances WHERE id=? AND account_id=?').run(req.params.id,req.account.id); res.json({success:true}); });

// ─── DEPENSES ─────────────────────────────────────────────────────────────────
app.get('/api/depenses', auth, (req, res) => res.json(db.prepare('SELECT * FROM depenses WHERE account_id=? ORDER BY id DESC').all(req.account.id)));
app.post('/api/depenses', auth, (req, res) => {
  const { car_id,type,montant,date,description,justif } = req.body;
  const r = db.prepare('INSERT INTO depenses (account_id,car_id,type,montant,date,description,justif) VALUES (?,?,?,?,?,?,?)')
    .run(req.account.id,car_id||null,type||'Carburant',montant||0,date||new Date().toISOString().split('T')[0],description||'',justif?1:0);
  res.json({success:true,id:r.lastInsertRowid});
});
app.delete('/api/depenses/:id', auth, (req, res) => { db.prepare('DELETE FROM depenses WHERE id=? AND account_id=?').run(req.params.id,req.account.id); res.json({success:true}); });

// ─── ALERTS ───────────────────────────────────────────────────────────────────
app.get('/api/alerts', auth, (req, res) => res.json(db.prepare('SELECT * FROM alerts WHERE account_id=? ORDER BY id DESC').all(req.account.id)));
app.post('/api/alerts', auth, (req, res) => {
  const { type,title,desc } = req.body;
  const r = db.prepare('INSERT INTO alerts (account_id,type,title,desc) VALUES (?,?,?,?)').run(req.account.id,type||'info',title,desc||'');
  res.json({success:true,id:r.lastInsertRowid});
});
app.put('/api/alerts/:id', auth, (req, res) => { db.prepare('UPDATE alerts SET read=1 WHERE id=? AND account_id=?').run(req.params.id,req.account.id); res.json({success:true}); });
app.put('/api/alerts', auth, (req, res) => { db.prepare('UPDATE alerts SET read=1 WHERE account_id=?').run(req.account.id); res.json({success:true}); });
app.delete('/api/alerts/:id', auth, (req, res) => { db.prepare('DELETE FROM alerts WHERE id=? AND account_id=?').run(req.params.id,req.account.id); res.json({success:true}); });

// ─── SETTINGS ─────────────────────────────────────────────────────────────────
app.get('/api/settings/:key', auth, (req, res) => {
  const row = db.prepare('SELECT value FROM settings WHERE account_id=? AND key=?').get(req.account.id,req.params.key);
  res.json({value:row?row.value:null});
});
app.post('/api/settings/:key', auth, (req, res) => {
  const { value } = req.body;
  db.prepare('INSERT INTO settings (account_id,key,value) VALUES (?,?,?) ON CONFLICT(account_id,key) DO UPDATE SET value=excluded.value')
    .run(req.account.id,req.params.key,value);
  res.json({success:true});
});

// ─── SUPER ADMIN ──────────────────────────────────────────────────────────────
app.get('/api/admin/accounts', auth, superOnly, (req, res) => {
  res.json(db.prepare("SELECT id,name,email,role,company,phone,plan,expires_at,status,created_at,last_login FROM accounts ORDER BY created_at DESC").all());
});
app.post('/api/admin/accounts', auth, superOnly, (req, res) => {
  const { name,email,password,company,phone,plan } = req.body;
  if(!name||!email||!password) return res.status(400).json({error:'Nom, email et mot de passe requis'});
  if(db.prepare('SELECT id FROM accounts WHERE email=?').get(email.toLowerCase())) return res.status(400).json({error:'Email déjà utilisé'});
  const hash = bcrypt.hashSync(password,10);
  const days = plan==='life'?36500:plan==='year'?365:plan==='month'?30:2;
  const expiry = new Date(); expiry.setDate(expiry.getDate()+days);
  const r = db.prepare(`INSERT INTO accounts (name,email,password,role,company,phone,plan,expires_at) VALUES (?,?,?,'client',?,?,?,?)`)
    .run(name,email.toLowerCase(),hash,company||'',phone||'',plan||'month',expiry.toISOString().split('T')[0]);
  db.prepare('INSERT INTO alerts (account_id,type,title,desc) VALUES (?,?,?,?)').run(r.lastInsertRowid,'info','Bienvenue sur CarLoc Manager','Votre compte est actif. Commencez par ajouter vos véhicules.');
  res.json({success:true,id:r.lastInsertRowid});
});
app.put('/api/admin/accounts/:id', auth, superOnly, (req, res) => {
  const { name,email,company,phone,plan,status,newPassword } = req.body;
  const acc = db.prepare('SELECT * FROM accounts WHERE id=?').get(req.params.id);
  if(!acc) return res.status(404).json({error:'Compte introuvable'});
  let expires_at = acc.expires_at;
  if(plan && plan!==acc.plan) {
    const days = plan==='life'?36500:plan==='year'?365:plan==='month'?30:2;
    const d = new Date(); d.setDate(d.getDate()+days); expires_at = d.toISOString().split('T')[0];
  }
  let pwd = acc.password;
  if(newPassword) pwd = bcrypt.hashSync(newPassword,10);
  db.prepare('UPDATE accounts SET name=?,email=?,company=?,phone=?,plan=?,expires_at=?,status=?,password=? WHERE id=?')
    .run(name||acc.name,email||acc.email,company||acc.company,phone||acc.phone,plan||acc.plan,expires_at,status||acc.status,pwd,req.params.id);
  res.json({success:true});
});
app.delete('/api/admin/accounts/:id', auth, superOnly, (req, res) => {
  if(req.account.id==req.params.id) return res.status(400).json({error:'Impossible de supprimer votre propre compte'});
  ['cars','clients','reservations','contrats','factures','sinistres','maintenances','depenses','alerts','settings']
    .forEach(t=>db.prepare(`DELETE FROM ${t} WHERE account_id=?`).run(req.params.id));
  db.prepare('DELETE FROM accounts WHERE id=?').run(req.params.id);
  res.json({success:true});
});
app.post('/api/admin/accounts/:id/extend', auth, superOnly, (req, res) => {
  const { days } = req.body;
  const acc = db.prepare('SELECT * FROM accounts WHERE id=?').get(req.params.id);
  if(!acc) return res.status(404).json({error:'Compte introuvable'});
  const base = acc.expires_at&&new Date(acc.expires_at)>new Date()?new Date(acc.expires_at):new Date();
  base.setDate(base.getDate()+(parseInt(days)||30));
  db.prepare('UPDATE accounts SET expires_at=? WHERE id=?').run(base.toISOString().split('T')[0],req.params.id);
  res.json({success:true});
});
app.get('/api/admin/stats', auth, superOnly, (req, res) => {
  const total = db.prepare("SELECT COUNT(*) as c FROM accounts WHERE role='client'").get().c;
  const active = db.prepare("SELECT COUNT(*) as c FROM accounts WHERE role='client' AND status='active'").get().c;
  const expired = db.prepare("SELECT COUNT(*) as c FROM accounts WHERE role='client' AND expires_at < datetime('now')").get().c;
  const r30 = db.prepare("SELECT COUNT(*) as c FROM accounts WHERE role='client' AND plan='month'").get().c;
  const rYear = db.prepare("SELECT COUNT(*) as c FROM accounts WHERE role='client' AND plan='year'").get().c;
  const rLife = db.prepare("SELECT COUNT(*) as c FROM accounts WHERE role='client' AND plan='life'").get().c;
  res.json({total,active,expired,revenue30:r30,revenueYear:rYear,revenueLife:rLife,totalRevenue:r30*499+rYear*3490+rLife*14900});
});

// ─── TRIAL REQUESTS ───────────────────────────────────────────────────────────
app.post('/api/trial-request', (req, res) => {
  const { nom,prenom,phone,email,societe } = req.body;
  if(!nom||!prenom||!phone||!email||!societe) return res.status(400).json({error:'Tous les champs sont obligatoires'});
  if(db.prepare('SELECT id FROM trial_requests WHERE email=?').get(email.toLowerCase())) return res.status(400).json({error:'Une demande existe déjà pour cet email'});
  const r = db.prepare('INSERT INTO trial_requests (nom,prenom,phone,email,societe) VALUES (?,?,?,?,?)').run(nom,prenom,phone,email.toLowerCase(),societe);
  res.json({success:true,id:r.lastInsertRowid});
});
app.get('/api/admin/trial-requests', auth, superOnly, (req, res) => res.json(db.prepare('SELECT * FROM trial_requests ORDER BY created_at DESC').all()));
app.post('/api/admin/trial-requests/:id/approve', auth, superOnly, (req, res) => {
  const req2 = db.prepare('SELECT * FROM trial_requests WHERE id=?').get(req.params.id);
  if(!req2) return res.status(404).json({error:'Demande introuvable'});
  const { plan,password } = req.body;
  const hash = bcrypt.hashSync(password||'CarLoc2026!',10);
  const days = plan==='life'?36500:plan==='year'?365:plan==='month'?30:2;
  const expiry = new Date(); expiry.setDate(expiry.getDate()+days);
  const result = db.prepare(`INSERT INTO accounts (name,email,password,role,company,phone,plan,expires_at) VALUES (?,?,?,'client',?,?,?,?)`)
    .run(req2.prenom+' '+req2.nom,req2.email,hash,req2.societe,req2.phone,plan||'trial',expiry.toISOString().split('T')[0]);
  db.prepare('INSERT INTO alerts (account_id,type,title,desc) VALUES (?,?,?,?)').run(result.lastInsertRowid,'info','Bienvenue sur CarLoc Manager','Votre compte a été activé.');
  db.prepare("UPDATE trial_requests SET status='approuve',treated_at=datetime('now'),treated_by=? WHERE id=?").run(req.account.id,req.params.id);
  res.json({success:true,email:req2.email,password:password||'CarLoc2026!'});
});
app.post('/api/admin/trial-requests/:id/reject', auth, superOnly, (req, res) => {
  db.prepare("UPDATE trial_requests SET status='refuse',treated_at=datetime('now'),treated_by=? WHERE id=?").run(req.account.id,req.params.id);
  res.json({success:true});
});

// ─── TRACCAR PROXY ────────────────────────────────────────────────────────────
async function traccarRequest(baseUrl, user, pass, path) {
  return new Promise((resolve, reject) => {
    const base = baseUrl.replace(/\/$/, '');
    const sessionUrl = new URL('/api/session', base);
    const postData = `email=${encodeURIComponent(user)}&password=${encodeURIComponent(pass)}`;
    const client = sessionUrl.protocol === 'https:' ? https : http;
    const sessionReq = client.request({
      hostname: sessionUrl.hostname,
      port: sessionUrl.port||(sessionUrl.protocol==='https:'?443:80),
      path: '/api/session', method: 'POST',
      headers: {'Content-Type':'application/x-www-form-urlencoded','Content-Length':Buffer.byteLength(postData),'Accept':'application/json'},
      timeout: 8000
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if(res.statusCode===401) return reject({status:401,error:'Email ou mot de passe Traccar incorrect'});
        if(res.statusCode>=400) return reject({status:res.statusCode,error:'Erreur Traccar login: '+res.statusCode});
        const cookie = res.headers['set-cookie']?.map(c=>c.split(';')[0]).join('; ')||'';
        if(!cookie) return reject({status:401,error:'Session Traccar invalide'});
        const dataUrl = new URL(path, base);
        const dataReq = client.request({
          hostname: dataUrl.hostname,
          port: dataUrl.port||(dataUrl.protocol==='https:'?443:80),
          path: dataUrl.pathname, method: 'GET',
          headers: {'Cookie':cookie,'Accept':'application/json'},
          timeout: 8000
        }, (res2) => {
          let d2 = '';
          res2.on('data', c => d2 += c);
          res2.on('end', () => {
            try { resolve(JSON.parse(d2)); }
            catch(e) { reject({status:500,error:'Réponse Traccar invalide'}); }
          });
        });
        dataReq.on('error', e => reject({status:502,error:e.message}));
        dataReq.end();
      });
    });
    sessionReq.on('timeout', () => { sessionReq.destroy(); reject({status:504,error:'Traccar inaccessible'}); });
    sessionReq.on('error', e => reject({status:502,error:'Impossible de joindre Traccar: '+e.message}));
    sessionReq.write(postData);
    sessionReq.end();
  });
}
async function traccarProxy(path, req, res) {
  const { traccar_url,traccar_user,traccar_pass } = req.query;
  if(!traccar_url) return res.status(400).json({error:'traccar_url requis'});
  try { res.json(await traccarRequest(traccar_url,traccar_user||'',traccar_pass||'',path)); }
  catch(e) { res.status(e.status||500).json({error:e.error||e.message}); }
}
app.get('/api/traccar/test', auth, (req,res) => traccarProxy('/api/server',req,res));
app.get('/api/traccar/devices', auth, (req,res) => traccarProxy('/api/devices',req,res));
app.get('/api/traccar/positions', auth, (req,res) => traccarProxy('/api/positions',req,res));

// ─── SPA FALLBACK ─────────────────────────────────────────────────────────────
app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));

app.listen(PORT, '0.0.0.0', () => console.log(`✅ CarLoc Manager running on port ${PORT}`));
