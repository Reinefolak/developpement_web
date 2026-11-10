/**
 * Automated end-to-end test suite for the registration platform
 */
const fs = require('fs');
const path = require('path');

async function runTests() {
  console.log('--- Démarrage des tests automatisés ---');
  let testsPassed = 0;
  let testsTotal = 0;

  function assert(condition, testName) {
    testsTotal++;
    if (condition) {
      console.log(`✅ [PASS] ${testName}`);
      testsPassed++;
    } else {
      console.error(`❌ [FAIL] ${testName}`);
    }
  }

  const BASE_URL = 'http://localhost:3000';

  // 1. Test Home page
  try {
    const res = await fetch(`${BASE_URL}/`);
    assert(res.status === 200, 'Page d\'accueil accessible (200 OK)');
    const html = await res.text();
    assert(html.includes('INSCRIPTION À LA FORMATION'), 'Présence du titre « INSCRIPTION À LA FORMATION »');
    assert(html.includes('35 000 F CFA'), 'Présence du tarif 35 000 F CFA');
    assert(html.includes('5 000 F CFA'), 'Présence des frais d\'inscription 5 000 F CFA');
    assert(html.includes('01 67 47 84 48'), 'Présence du numéro Mobile Money 01 67 47 84 48');
  } catch (e) {
    console.error('Erreur test 1:', e);
  }

  // 2. Test Public Stats
  try {
    const res = await fetch(`${BASE_URL}/api/stats/public`);
    const json = await res.json();
    assert(json.success === true, 'API Stats publique fonctionnelle');
  } catch (e) {
    console.error('Erreur test 2:', e);
  }

  // 3. Test Registration Submission with a mock image
  let createdRegNumber = '';
  let createdRegId = null;
  try {
    // Create dummy image buffer
    const dummyImageBuffer = fs.readFileSync(path.join(__dirname, 'public', 'images', 'affiche-formation.jpg'));
    const blob = new Blob([dummyImageBuffer], { type: 'image/jpeg' });
    
    const formData = new FormData();
    formData.append('fullName', 'AHLONSOU Marius');
    formData.append('gender', 'Masculin');
    formData.append('phone', '01 67 47 84 48');
    formData.append('city', 'Cotonou');
    formData.append('paymentProof', blob, 'screenshot_test.jpg');

    const res = await fetch(`${BASE_URL}/api/register`, {
      method: 'POST',
      body: formData
    });

    const json = await res.json();
    assert(res.status === 201, 'Soumission inscription réussie (201 Created)');
    assert(json.message.includes('Félicitations ! Votre demande d\'inscription a été reçue avec succès.'), 'Message officiel exact de confirmation retourné');
    assert(json.data.registrationNumber.startsWith('CDX-2026-'), 'Numéro d\'inscription unique auto-généré (CDX-2026-XXXX)');
    assert(json.data.status === 'En attente', 'Statut initial correctement défini à « En attente »');
    
    createdRegNumber = json.data.registrationNumber;
    createdRegId = json.data.id;
  } catch (e) {
    console.error('Erreur test 3:', e);
  }

  // 4. Test Registration Check API
  try {
    const res = await fetch(`${BASE_URL}/api/registration/check?query=${createdRegNumber}`);
    const json = await res.json();
    assert(json.success === true && json.data.fullName === 'AHLONSOU Marius', 'Recherche de statut candidat opérationnelle');
  } catch (e) {
    console.error('Erreur test 4:', e);
  }

  // 5. Test PDF Receipt generation
  try {
    const res = await fetch(`${BASE_URL}/api/registration/${createdRegNumber}/receipt`);
    assert(res.status === 200, 'Génération du reçu officiel PDF (200 OK)');
    assert(res.headers.get('content-type') === 'application/pdf', 'En-tête PDF valide');
  } catch (e) {
    console.error('Erreur test 5:', e);
  }

  // 6. Test Admin Login
  let adminToken = '';
  try {
    // Failed login
    const failRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'wrongpassword' })
    });
    assert(failRes.status === 401, 'Blocage sécurisé des mauvais mots de passe (401)');

    // Successful login
    const successRes = await fetch(`${BASE_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin2026' })
    });
    const loginJson = await successRes.json();
    assert(successRes.status === 200 && loginJson.token, 'Connexion administrateur réussie avec émission de JWT');
    adminToken = loginJson.token;
  } catch (e) {
    console.error('Erreur test 6:', e);
  }

  // 7. Test Admin Registrations retrieval
  try {
    const res = await fetch(`${BASE_URL}/api/admin/registrations`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const json = await res.json();
    assert(res.status === 200 && json.data.length > 0, 'Récupération de la liste des candidats par l\'admin');
  } catch (e) {
    console.error('Erreur test 7:', e);
  }

  // 8. Test Status Update to Validé
  try {
    const res = await fetch(`${BASE_URL}/api/admin/registrations/${createdRegId}/status`, {
      method: 'PATCH',
      headers: { 
        'Authorization': `Bearer ${adminToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'Validé', adminNotes: 'Paiement MTN Momo vérifié avec succès.' })
    });
    const json = await res.json();
    assert(json.success === true && json.data.status === 'Validé', 'Changement du statut à « Validé »');
  } catch (e) {
    console.error('Erreur test 8:', e);
  }

  // 9. Test Admin Stats calculation
  try {
    const res = await fetch(`${BASE_URL}/api/admin/stats`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const json = await res.json();
    assert(json.data.validated >= 1 && json.data.totalCollected >= 5000, 'Calcul exact des statistiques et fonds collectés');
  } catch (e) {
    console.error('Erreur test 9:', e);
  }

  // 10. Test Excel Export (.xlsx)
  try {
    const res = await fetch(`${BASE_URL}/api/admin/export/excel`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(res.status === 200, 'Téléchargement de la liste des inscrits en Excel (.xlsx)');
    assert(res.headers.get('content-type').includes('spreadsheet'), 'Type MIME Excel correct');
  } catch (e) {
    console.error('Erreur test 10:', e);
  }

  // 11. Test PDF Export
  try {
    const res = await fetch(`${BASE_URL}/api/admin/export/pdf`, {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    assert(res.status === 200, 'Téléchargement de la liste des inscrits en PDF');
    assert(res.headers.get('content-type') === 'application/pdf', 'Type MIME PDF correct');
  } catch (e) {
    console.error('Erreur test 11:', e);
  }

  console.log(`\n========================================`);
  console.log(`RÉSULTAT FINAL DES TESTS : ${testsPassed} / ${testsTotal} réussis`);
  console.log(`========================================\n`);

  if (testsPassed === testsTotal) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests();
