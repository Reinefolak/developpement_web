/**
 * Database module using native Node.js SQLite (DatabaseSync)
 * Provides robust, fast, zero-dependency persistence for registrations & admin auth.
 */

const { DatabaseSync } = require('node:sqlite');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

// Database file path
const DB_PATH = path.join(__dirname, 'data', 'formation.db');

// Ensure data directory exists
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const db = new DatabaseSync(DB_PATH);

// Enable WAL mode for high concurrency
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA foreign_keys = ON;');

/**
 * Initialize schema
 */
function initSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS registrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      registration_number TEXT UNIQUE NOT NULL,
      full_name TEXT NOT NULL,
      gender TEXT NOT NULL,
      phone TEXT NOT NULL,
      city TEXT NOT NULL,
      proof_image TEXT NOT NULL,
      proof_original_name TEXT,
      registration_fee INTEGER DEFAULT 5000,
      total_fee INTEGER DEFAULT 35000,
      remaining_fee INTEGER DEFAULT 30000,
      payment_number TEXT DEFAULT '01 67 47 84 48',
      status TEXT DEFAULT 'En attente',
      admin_notes TEXT DEFAULT '',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS admins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_registrations_status ON registrations(status);
    CREATE INDEX IF NOT EXISTS idx_registrations_phone ON registrations(phone);
    CREATE INDEX IF NOT EXISTS idx_registrations_number ON registrations(registration_number);
  `);

  // Seed default admin if none exists
  const countAdminsStmt = db.prepare('SELECT COUNT(*) as count FROM admins');
  const countAdmins = countAdminsStmt.get().count;
  
  if (countAdmins === 0) {
    const salt = bcrypt.genSaltSync(10);
    const hash = bcrypt.hashSync('admin2026', salt);
    const insertAdmin = db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)');
    insertAdmin.run('admin', hash);
    console.log('[DB] Compte administrateur initial créé : admin / admin2026');
  }
}

initSchema();

/**
 * Generate a unique registration code (e.g. CDX-2026-8492)
 */
function generateRegistrationNumber() {
  const year = new Date().getFullYear();
  const randomDigits = Math.floor(1000 + Math.random() * 9000);
  return `CDX-${year}-${randomDigits}`;
}

/**
 * Create a new registration
 */
function createRegistration({ fullName, gender, phone, city, proofImage, proofOriginalName }) {
  let registrationNumber = generateRegistrationNumber();
  
  // Ensure uniqueness
  const checkStmt = db.prepare('SELECT id FROM registrations WHERE registration_number = ?');
  let exists = checkStmt.get(registrationNumber);
  while (exists) {
    registrationNumber = generateRegistrationNumber();
    exists = checkStmt.get(registrationNumber);
  }

  const insertStmt = db.prepare(`
    INSERT INTO registrations (
      registration_number,
      full_name,
      gender,
      phone,
      city,
      proof_image,
      proof_original_name,
      registration_fee,
      total_fee,
      remaining_fee,
      payment_number,
      status
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 5000, 35000, 30000, '01 67 47 84 48', 'En attente')
  `);

  const info = insertStmt.run(
    registrationNumber,
    fullName.trim(),
    gender.trim(),
    phone.trim(),
    city.trim(),
    proofImage,
    proofOriginalName || proofImage
  );

  return getRegistrationById(info.lastInsertRowid);
}

/**
 * Get registration by ID
 */
function getRegistrationById(id) {
  const stmt = db.prepare('SELECT * FROM registrations WHERE id = ?');
  return stmt.get(id);
}

/**
 * Get registration by Registration Number
 */
function getRegistrationByNumber(regNumber) {
  const stmt = db.prepare('SELECT * FROM registrations WHERE registration_number = ?');
  return stmt.get(regNumber);
}

/**
 * Get all registrations with optional search and status filter
 */
function getAllRegistrations({ search = '', status = 'all' } = {}) {
  let query = 'SELECT * FROM registrations WHERE 1=1';
  const params = [];

  if (status && status !== 'all') {
    query += ' AND status = ?';
    params.push(status);
  }

  if (search && search.trim() !== '') {
    query += ' AND (full_name LIKE ? OR phone LIKE ? OR city LIKE ? OR registration_number LIKE ?)';
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  query += ' ORDER BY id DESC';

  const stmt = db.prepare(query);
  return stmt.all(...params);
}

/**
 * Update registration status
 */
function updateRegistrationStatus(id, newStatus, adminNotes = '') {
  const validStatuses = ['En attente', 'Validé', 'Refusé'];
  if (!validStatuses.includes(newStatus)) {
    throw new Error('Statut invalide. Valeurs acceptées: ' + validStatuses.join(', '));
  }

  const stmt = db.prepare(`
    UPDATE registrations 
    SET status = ?, admin_notes = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `);

  stmt.run(newStatus, adminNotes, id);
  return getRegistrationById(id);
}

/**
 * Delete a registration
 */
function deleteRegistration(id) {
  const reg = getRegistrationById(id);
  if (!reg) return false;

  const stmt = db.prepare('DELETE FROM registrations WHERE id = ?');
  stmt.run(id);
  return reg;
}

/**
 * Get system statistics
 */
function getStatistics() {
  const total = db.prepare('SELECT COUNT(*) as count FROM registrations').get().count;
  const pending = db.prepare("SELECT COUNT(*) as count FROM registrations WHERE status = 'En attente'").get().count;
  const validated = db.prepare("SELECT COUNT(*) as count FROM registrations WHERE status = 'Validé'").get().count;
  const rejected = db.prepare("SELECT COUNT(*) as count FROM registrations WHERE status = 'Refusé'").get().count;

  // Total collected = validated registrations * 5000 FCFA
  const totalCollected = validated * 5000;
  const totalPending = pending * 5000;
  const totalRemaining = validated * 30000;

  return {
    total,
    pending,
    validated,
    rejected,
    totalCollected,
    totalPending,
    totalRemaining
  };
}

/**
 * Verify admin credentials
 */
function verifyAdmin(username, password) {
  const stmt = db.prepare('SELECT * FROM admins WHERE username = ?');
  const admin = stmt.get(username);
  if (!admin) return null;

  const isValid = bcrypt.compareSync(password, admin.password_hash);
  if (!isValid) return null;

  return {
    id: admin.id,
    username: admin.username
  };
}

/**
 * Update admin password
 */
function updateAdminPassword(username, newPassword) {
  const salt = bcrypt.genSaltSync(10);
  const hash = bcrypt.hashSync(newPassword, salt);
  const stmt = db.prepare('UPDATE admins SET password_hash = ? WHERE username = ?');
  stmt.run(hash, username);
  return true;
}

module.exports = {
  db,
  createRegistration,
  getRegistrationById,
  getRegistrationByNumber,
  getAllRegistrations,
  updateRegistrationStatus,
  deleteRegistration,
  getStatistics,
  verifyAdmin,
  updateAdminPassword
};
