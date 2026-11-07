# Lexique C1 — mise en route

## 1. Firebase (forfait Spark, gratuit)
1. console.firebase.google.com > Ajouter un projet (désactive Google Analytics).
2. (Aucune authentification.)
3. **Firestore Database** > Créer (mode production, région europe-west).
4. Onglet **Règles** : colle le contenu de `firestore.rules` > Publier.
5. Paramètres du projet > Tes applications > Web (`</>`) : note `apiKey`, `appId` et `projectId`. Tu les saisis dans l'app au premier lancement (rien dans le dépôt). À refaire sur chaque appareil.

## 2. Test local
`python3 -m http.server 8000` puis http://localhost:8000 (localhost est autorisé par défaut) ; colle la config Firebase quand l'app la demande.

## 3. GitHub Pages
Dépôt GitHub > pousse tous les fichiers > Settings > Pages > Branch `main`, dossier `/ (root)`.

## 4. IA
Paramètres > fournisseur, clé, nom exact du modèle > Tester. La clé reste dans le navigateur.
