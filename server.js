/**
 * Express Server for Course Registration Platform
 * Formation Développement Web Mobile + IA
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const XLSX = require('xlsx');
const PDFDocument = require('pdfkit');

const db = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'formation_codex_secret_key_2026_securisee';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));
// Also serve uploads directly for image preview
app.use('/uploads', express.static(path.join(__dirname, 'public', 'uploads')));

// Ensure upload directory exists
const UPLOAD_DIR = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Multer Storage Configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, UPLOAD_DIR);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'preuve-' + uniqueSuffix + ext);
  }
});

// File filter: JPG, JPEG, PNG only
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png'];
  const ext = path.extname(file.originalname).toLowerCase();
  const allowedExts = ['.jpg', '.jpeg', '.png'];

  if (allowedTypes.includes(file.mimetype) || allowedExts.includes(ext)) {
    cb(null, true);
  } else {
    cb(new Error('Format non supporté. Veuillez envoyer une image JPG, JPEG ou PNG.'), false);
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 12 * 1024 * 1024 // 12MB limit
  }
});

// Authentication middleware for admin routes
function requireAdmin(req, res, next) {
  let token = req.cookies.admin_token;
  if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, error: 'Accès non autorisé. Veuillez vous connecter.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Session expirée. Veuillez vous reconnecter.' });
  }
}

// ==========================================
// PUBLIC ROUTES
// ==========================================

/**
 * Public statistics (for social proof & spots remaining)
 */
app.get('/api/stats/public', (req, res) => {
  try {
    const stats = db.getStatistics();
    // Maximum cohort spots = 50
    const maxSpots = 50;
    const remainingSpots = Math.max(0, maxSpots - stats.validated);
    res.json({
      success: true,
      data: {
        totalRegistrations: stats.total,
        validatedRegistrations: stats.validated,
        remainingSpots,
        maxSpots
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Submit candidate registration
 */
app.post('/api/register', (req, res) => {
  upload.single('paymentProof')(req, res, function (err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
          success: false,
          error: 'Le fichier est trop volumineux. La taille maximale autorisée est de 12 Mo.'
        });
      }
      return res.status(400).json({ success: false, error: `Erreur d'upload: ${err.message}` });
    } else if (err) {
      return res.status(400).json({ success: false, error: err.message });
    }

    try {
      const { fullName, gender, phone, city } = req.body;

      // Strict validation of required fields
      if (!fullName || !fullName.trim()) {
        return res.status(400).json({ success: false, error: 'Le champ « Nom et prénom » est obligatoire.' });
      }
      if (!gender || !gender.trim()) {
        return res.status(400).json({ success: false, error: 'Le champ « Sexe » est obligatoire.' });
      }
      if (!phone || !phone.trim()) {
        return res.status(400).json({ success: false, error: 'Le champ « Numéro de téléphone / WhatsApp » est obligatoire.' });
      }
      if (!city || !city.trim()) {
        return res.status(400).json({ success: false, error: 'Le champ « Ville de résidence » est obligatoire.' });
      }
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'La capture d’écran de la transaction Mobile Money est obligatoire.'
        });
      }

      // Create record in database
      const registration = db.createRegistration({
        fullName: fullName.trim(),
        gender: gender.trim(),
        phone: phone.trim(),
        city: city.trim(),
        proofImage: req.file.filename,
        proofOriginalName: req.file.originalname
      });

      // Response matching the exact requirement
      res.status(201).json({
        success: true,
        message: "Félicitations ! Votre demande d'inscription a été reçue avec succès. Votre paiement est en attente de vérification par l'administration. Vous recevrez une confirmation après validation.",
        data: {
          id: registration.id,
          registrationNumber: registration.registration_number,
          fullName: registration.full_name,
          gender: registration.gender,
          phone: registration.phone,
          city: registration.city,
          registrationFee: '5 000 F CFA',
          totalFee: '35 000 F CFA',
          remainingFee: '30 000 F CFA',
          paymentNumber: registration.payment_number,
          status: registration.status,
          createdAt: registration.created_at
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ success: false, error: 'Une erreur serveur est survenue lors de l’enregistrement.' });
    }
  });
});

/**
 * Check registration status by registration number or phone
 */
app.get('/api/registration/check', (req, res) => {
  const { query } = req.query;
  if (!query) {
    return res.status(400).json({ success: false, error: 'Veuillez renseigner un numéro d’inscription ou de téléphone.' });
  }

  try {
    const list = db.getAllRegistrations({ search: query.trim() });
    if (!list || list.length === 0) {
      return res.status(404).json({ success: false, error: 'Aucune inscription trouvée pour cette recherche.' });
    }
    const item = list[0];
    res.json({
      success: true,
      data: {
        registrationNumber: item.registration_number,
        fullName: item.full_name,
        gender: item.gender,
        phone: item.phone,
        city: item.city,
        status: item.status,
        createdAt: item.created_at
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==========================================
// ADMIN AUTHENTICATION
// ==========================================

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Identifiant et mot de passe requis.' });
  }

  const admin = db.verifyAdmin(username.trim(), password);
  if (!admin) {
    return res.status(401).json({ success: false, error: 'Identifiants incorrects.' });
  }

  const token = jwt.sign(
    { id: admin.id, username: admin.username },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.cookie('admin_token', token, {
    httpOnly: true,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  });

  res.json({
    success: true,
    message: 'Connexion réussie',
    token,
    user: { id: admin.id, username: admin.username }
  });
});

app.post('/api/admin/logout', (req, res) => {
  res.clearCookie('admin_token');
  res.json({ success: true, message: 'Déconnexion réussie.' });
});

app.get('/api/admin/me', requireAdmin, (req, res) => {
  res.json({
    success: true,
    user: req.admin
  });
});

// ==========================================
// ADMIN MANAGEMENT ROUTES
// ==========================================

/**
 * Get all registrations with filtering and search
 */
app.get('/api/admin/registrations', requireAdmin, (req, res) => {
  try {
    const { search, status } = req.query;
    const registrations = db.getAllRegistrations({ search, status });
    res.json({ success: true, data: registrations });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Get dashboard full statistics
 */
app.get('/api/admin/stats', requireAdmin, (req, res) => {
  try {
    const stats = db.getStatistics();
    res.json({ success: true, data: stats });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Update registration status (En attente, Validé, Refusé)
 */
app.patch('/api/admin/registrations/:id/status', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminNotes } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, error: 'Le champ statut est obligatoire.' });
    }

    const updated = db.updateRegistrationStatus(id, status, adminNotes || '');
    res.json({
      success: true,
      message: `Statut mis à jour : ${status}`,
      data: updated
    });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

/**
 * Delete a registration
 */
app.delete('/api/admin/registrations/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    const deleted = db.deleteRegistration(id);
    if (!deleted) {
      return res.status(404).json({ success: false, error: 'Inscription non trouvée.' });
    }

    // Attempt to delete proof file
    if (deleted.proof_image) {
      const filePath = path.join(UPLOAD_DIR, deleted.proof_image);
      if (fs.existsSync(filePath)) {
        try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
      }
    }

    res.json({ success: true, message: 'Inscription supprimée avec succès.' });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Download proof image
 */
app.get('/api/admin/download-proof/:filename', requireAdmin, (req, res) => {
  const { filename } = req.params;
  const safeFilename = path.basename(filename);
  const filePath = path.join(UPLOAD_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    return res.status(404).send('Fichier introuvable');
  }

  res.download(filePath, `Preuve-${safeFilename}`);
});

// ==========================================
// EXPORTS: EXCEL & PDF
// ==========================================

/**
 * Export registrations list to Excel (.xlsx)
 */
app.get('/api/admin/export/excel', requireAdmin, (req, res) => {
  try {
    const { search, status } = req.query;
    const list = db.getAllRegistrations({ search, status });

    const rows = list.map((reg, index) => ({
      'N°': index + 1,
      'Code Inscription': reg.registration_number,
      'Nom et Prénom': reg.full_name,
      'Sexe': reg.gender,
      'Téléphone / WhatsApp': reg.phone,
      'Ville de Résidence': reg.city,
      'Frais Inscription (FCFA)': reg.registration_fee,
      'Total Formation (FCFA)': reg.total_fee,
      'Reste à Payer (FCFA)': reg.remaining_fee,
      'Statut': reg.status,
      'Date d\'Inscription': new Date(reg.created_at).toLocaleString('fr-FR'),
      'Notes Admin': reg.admin_notes || ''
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    // Set column widths
    worksheet['!cols'] = [
      { wch: 5 },
      { wch: 18 },
      { wch: 26 },
      { wch: 10 },
      { wch: 22 },
      { wch: 18 },
      { wch: 22 },
      { wch: 22 },
      { wch: 20 },
      { wch: 14 },
      { wch: 20 },
      { wch: 25 }
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Inscriptions');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    const filename = `Inscriptions_Formation_Integrateur_Solution_${new Date().toISOString().slice(0, 10)}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (error) {
    console.error('Excel Export error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Export registrations list to PDF
 */
app.get('/api/admin/export/pdf', requireAdmin, (req, res) => {
  try {
    const { search, status } = req.query;
    const list = db.getAllRegistrations({ search, status });
    const stats = db.getStatistics();

    const doc = new PDFDocument({ margin: 35, size: 'A4', layout: 'landscape' });
    const filename = `Liste_Inscriptions_Integrateur_Solution_${new Date().toISOString().slice(0, 10)}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    doc.pipe(res);

    // Header styling
    doc.rect(35, 30, 772, 60).fill('#0B132B');
    doc.fillColor('#00D2FF').fontSize(18).font('Helvetica-Bold')
      .text('INTÉGRATEUR DE SOLUTIONS — FORMATION DÉVELOPPEMENT WEB MOBILE + IA', 50, 42);
    
    doc.fillColor('#FFFFFF').fontSize(11).font('Helvetica')
      .text(`Rapport Officiel des Inscriptions | Date d'édition: ${new Date().toLocaleDateString('fr-FR')}`, 50, 66);

    // Summary Badges
    let y = 105;
    doc.fillColor('#1E293B').fontSize(11).font('Helvetica-Bold')
      .text(`Total Inscrits: ${stats.total}  |  Validés: ${stats.validated} (${(stats.validated * 5000).toLocaleString('fr-FR')} FCFA)  |  En attente: ${stats.pending}  |  Refusés: ${stats.rejected}`, 35, y);

    y += 25;

    // Table Header
    doc.rect(35, y, 772, 22).fill('#2563EB');
    doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');
    
    doc.text('N° Dossier', 42, y + 6, { width: 90 });
    doc.text('Nom & Prénom', 135, y + 6, { width: 170 });
    doc.text('Sexe', 310, y + 6, { width: 45 });
    doc.text('Téléphone / WhatsApp', 360, y + 6, { width: 120 });
    doc.text('Ville', 485, y + 6, { width: 85 });
    doc.text('Frais Payés', 575, y + 6, { width: 75 });
    doc.text('Statut', 655, y + 6, { width: 65 });
    doc.text('Date', 725, y + 6, { width: 75 });

    y += 24;

    // Table rows
    list.forEach((item, index) => {
      // Check page overflow
      if (y > 520) {
        doc.addPage({ margin: 35, size: 'A4', layout: 'landscape' });
        y = 40;
        // Repeat table header
        doc.rect(35, y, 772, 22).fill('#2563EB');
        doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');
        doc.text('N° Dossier', 42, y + 6, { width: 90 });
        doc.text('Nom & Prénom', 135, y + 6, { width: 170 });
        doc.text('Sexe', 310, y + 6, { width: 45 });
        doc.text('Téléphone / WhatsApp', 360, y + 6, { width: 120 });
        doc.text('Ville', 485, y + 6, { width: 85 });
        doc.text('Frais Payés', 575, y + 6, { width: 75 });
        doc.text('Statut', 655, y + 6, { width: 65 });
        doc.text('Date', 725, y + 6, { width: 75 });
        y += 24;
      }

      // Zebra striping
      if (index % 2 === 0) {
        doc.rect(35, y, 772, 20).fill('#F8FAFC');
      }

      // Status color
      let statusColor = '#EAB308'; // Pending
      if (item.status === 'Validé') statusColor = '#16A34A';
      if (item.status === 'Refusé') statusColor = '#DC2626';

      doc.fillColor('#0F172A').fontSize(8.5).font('Helvetica');
      doc.text(item.registration_number, 42, y + 5, { width: 90 });
      doc.text(item.full_name, 135, y + 5, { width: 170 });
      doc.text(item.gender, 310, y + 5, { width: 45 });
      doc.text(item.phone, 360, y + 5, { width: 120 });
      doc.text(item.city, 485, y + 5, { width: 85 });
      doc.text('5 000 FCFA', 575, y + 5, { width: 75 });
      
      doc.fillColor(statusColor).font('Helvetica-Bold');
      doc.text(item.status, 655, y + 5, { width: 65 });

      doc.fillColor('#64748B').font('Helvetica');
      doc.text(new Date(item.created_at).toLocaleDateString('fr-FR'), 725, y + 5, { width: 75 });

      y += 20;
    });

    // Footer
    doc.fillColor('#94A3B8').fontSize(8).font('Helvetica')
      .text('Document confidentiel édité par la plateforme Intégrateur de Solution. Tél: 01 99 05 91 62 / 01 67 47 84 48 — Cotonou, Bénin.', 35, 560, { align: 'center', width: 772 });

    doc.end();
  } catch (error) {
    console.error('PDF Export error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * Individual Student Printable Receipt PDF
 */
app.get('/api/registration/:regNumber/receipt', (req, res) => {
  try {
    const { regNumber } = req.params;
    const item = db.getRegistrationByNumber(regNumber);

    if (!item) {
      return res.status(404).send('Inscription non trouvée.');
    }

    const doc = new PDFDocument({ margin: 40, size: 'A5', layout: 'portrait' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="Recu_${regNumber}.pdf"`);

    doc.pipe(res);

    // Top Card
    doc.rect(30, 30, 360, 70).fill('#0B132B');
    doc.fillColor('#00D2FF').fontSize(14).font('Helvetica-Bold')
      .text('INTÉGRATEUR DE SOLUTIONS', 45, 45);
    doc.fillColor('#FFFFFF').fontSize(10).font('Helvetica')
      .text('FORMATION DEVELOPPEMENT WEB MOBILE + IA', 45, 63);
    doc.fillColor('#F59E0B').fontSize(8).font('Helvetica-Bold')
      .text('REÇU PROVISOIRE D\'INSCRIPTION', 45, 78);

    let y = 120;
    doc.fillColor('#0F172A').fontSize(11).font('Helvetica-Bold')
      .text('N° de Dossier :', 45, y);
    doc.fillColor('#2563EB').fontSize(12).font('Helvetica-Bold')
      .text(item.registration_number, 170, y);

    y += 25;
    doc.fillColor('#64748B').fontSize(9).font('Helvetica')
      .text('Date de soumission :', 45, y);
    doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold')
      .text(new Date(item.created_at).toLocaleString('fr-FR'), 170, y);

    y += 22;
    doc.fillColor('#64748B').fontSize(9).font('Helvetica')
      .text('Nom & Prénom :', 45, y);
    doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold')
      .text(item.full_name, 170, y);

    y += 22;
    doc.fillColor('#64748B').fontSize(9).font('Helvetica')
      .text('Sexe :', 45, y);
    doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold')
      .text(item.gender, 170, y);

    y += 22;
    doc.fillColor('#64748B').fontSize(9).font('Helvetica')
      .text('Téléphone / WhatsApp :', 45, y);
    doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold')
      .text(item.phone, 170, y);

    y += 22;
    doc.fillColor('#64748B').fontSize(9).font('Helvetica')
      .text('Ville de résidence :', 45, y);
    doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold')
      .text(item.city, 170, y);

    y += 30;
    // Box for finances
    doc.rect(40, y, 340, 95).fill('#F1F5F9');
    
    doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold')
      .text('Frais d\'inscription versés :', 55, y + 12);
    doc.fillColor('#16A34A').fontSize(10).font('Helvetica-Bold')
      .text('5 000 F CFA', 260, y + 12);

    doc.fillColor('#0F172A').fontSize(9).font('Helvetica')
      .text('Coût total de la formation :', 55, y + 32);
    doc.fillColor('#0F172A').fontSize(9).font('Helvetica-Bold')
      .text('35 000 F CFA', 260, y + 32);

    doc.fillColor('#0F172A').fontSize(9).font('Helvetica')
      .text('Reste à solder :', 55, y + 52);
    doc.fillColor('#DC2626').fontSize(10).font('Helvetica-Bold')
      .text('30 000 F CFA', 260, y + 52);

    doc.fillColor('#64748B').fontSize(8).font('Helvetica')
      .text('Numéro de dépôt :', 55, y + 74);
    doc.fillColor('#0F172A').fontSize(8.5).font('Helvetica-Bold')
      .text('01 67 47 84 48', 260, y + 74);

    y += 115;
    doc.fillColor('#64748B').fontSize(8.5).font('Helvetica')
      .text('Statut du dossier :', 45, y);
    let sColor = '#EAB308';
    if (item.status === 'Validé') sColor = '#16A34A';
    if (item.status === 'Refusé') sColor = '#DC2626';
    doc.fillColor(sColor).fontSize(10).font('Helvetica-Bold')
      .text(item.status.toUpperCase(), 170, y);

    y += 35;
    doc.fillColor('#94A3B8').fontSize(7.5).font('Helvetica')
      .text('Conservez précieusement ce reçu. Il servira de justificatif pour l\'accès aux cours.\nContact / Support : 01 99 05 91 62 / 01 67 47 84 48 — Cotonou, Bénin.', 45, y, { align: 'center', width: 330 });

    doc.end();
  } catch (error) {
    res.status(500).send('Erreur génération reçu: ' + error.message);
  }
});

// Fallback to HTML pages
app.use((req, res) => {
  if (req.path.startsWith('/admin')) {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
  } else if (req.path.startsWith('/login')) {
    res.sendFile(path.join(__dirname, 'public', 'login.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`🚀 Serveur Formation Web Mobile + IA démarré avec succès !`);
  console.log(`🌐 Accès Public : http://localhost:${PORT}`);
  console.log(`🛡️  Espace Admin : http://localhost:${PORT}/admin`);
  console.log(`🔑 Identifiants Admin par défaut : admin / admin2026`);
  console.log(`=======================================================`);
});
