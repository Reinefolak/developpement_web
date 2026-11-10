# Plateforme d'Inscription — Formation Développement Web Mobile + IA

> **Intégrateur de Solution** — Site web officiel, moderne, responsive et 100% fonctionnel pour la gestion des inscriptions à la formation intensive de 2 semaines.

---

## 📌 1. Informations Financières & Règles Métier

- **Intitulé officiel :** Inscription à la Formation — Développement Web Mobile + IA
- **Durée :** 2 Semaines intensives
- **Coût total de la formation :** **35 000 F CFA**
- **Frais d'inscription obligatoires :** **5 000 F CFA** (valide et bloque la place)
- **Solde restant à solder :** **30 000 F CFA** (au début des cours)
- **Numéro de dépôt Mobile Money :** `01 67 47 84 48` (avec bouton de copie instantané)
- **Contact assistance :** `01 99 05 91 62`
- **Lieu :** Cotonou, Bénin

---

## 🚀 2. Fonctionnalités Principales

### 🌐 Espace Public & Candidat
- **Design Cyber & Tech Moderne :** Inspiré directement de l'affiche officielle avec thème sombre futuriste, néons bleu cyan, violet et orange ambré.
- **Présentation complète :** 
  - Débouchés : Développement Web, Applications Mobiles, Intelligence Artificielle, Création de sites modernes.
  - Pourquoi nous rejoindre : 100% Pratique & Projets réels, Coaching & Suivi personnalisé, Attestation officielle.
  - Prérequis : Un ordinateur portable.
- **Formulaire d'inscription strict :**
  - Nom et prénom (obligatoire)
  - Sexe : Masculin / Féminin (obligatoire)
  - Numéro de téléphone / WhatsApp (un seul champ obligatoire)
  - Ville de résidence (obligatoire)
- **Paiement & Preuve Obligatoire :**
  - Précision du montant exact : **5 000 F CFA**
  - Copie en 1 clic du numéro `01 67 47 84 48`
  - Upload obligatoire de la capture d'écran de transaction (JPG, JPEG, PNG, max 12 Mo) avec prévisualisation en direct et support de la caméra smartphone.
- **Confirmation Officielle :**
  - Bouton **« VALIDER MON INSCRIPTION »**
  - Message officiel exact affiché après soumission :
    > *« Félicitations ! Votre demande d'inscription a été reçue avec succès. Votre paiement est en attente de vérification par l'administration. Vous recevrez une confirmation après validation. »*
  - Attribution automatique d'un **numéro unique d'inscription** (ex: `CDX-2026-XXXX`).
  - Téléchargement du **Reçu officiel provisoire en PDF** avec QR/dossier.
  - Bouton direct d'assistance WhatsApp avec message pré-rempli.
  - Module de suivi de statut en temps réel pour le candidat.

---

### 🛡️ Espace Administrateur Sécurisé (`/admin`)
- **Authentification sécurisée par JWT & Cookie httpOnly** (identifiants par défaut : `admin` / `admin2026`).
- **Statistiques en direct :**
  - Nombre total de candidats inscrits
  - Nombre et montant total des paiements validés (X × 5 000 FCFA)
  - Inscriptions en attente de vérification
  - Inscriptions refusées
- **Gestion des Candidats :**
  - Recherche instantanée par nom, téléphone, ville ou N° de dossier
  - Filtre rapide par statut (Tous, En attente, Validé, Refusé)
  - Visualisation des captures d'écran de transaction (lightbox avec zoom)
  - Téléchargement direct des preuves de paiement
  - Modification des statuts en 1 clic : **En attente**, **Validé**, **Refusé** avec notes internes
  - Bouton direct **« Contacter sur WhatsApp »** ouvrant une discussion avec message personnalisé pré-rempli
- **Exportations Officielles :**
  - 📊 **Export Excel (.xlsx)** complet et formaté
  - 📄 **Export PDF** mise en page avec en-tête officiel, statistiques et liste des participants
  - 🖨️ Génération de reçu individuel imprimable pour chaque candidat

---

## 🛠️ 3. Architecture Technique

- **Backend :** Node.js 26 + Express 5
- **Base de Données :** SQLite natif haute performance (`node:sqlite`) sans dépendance de compilation C++. Fichier persistant situé dans `data/formation.db`.
- **Upload sécurisé :** `multer` avec stockage dédié dans `public/uploads/` et vérification MIME stricte.
- **Exports :** `xlsx` (SheetJS) pour Excel, `pdfkit` pour la génération dynamique de documents PDF.
- **Frontend :** HTML5, Tailwind CSS, Lucide Icons, Canvas Confetti.

---

## 💻 4. Lancement Local

Pour démarrer le serveur :
```bash
node server.js
```

Accès :
- **Site Public :** [http://localhost:3000](http://localhost:3000)
- **Espace Admin :** [http://localhost:3000/admin](http://localhost:3000/admin)
- **Identifiants Admin :** `admin` / `admin2026`

---

## 🧪 5. Tests Automatisés

Une suite complète de 22 tests end-to-end est intégrée :
```bash
node test_suite.js
```
Résultat : **22 / 22 tests validés avec succès (100%)**.
