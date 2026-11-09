# VestiFlow 0.2.2 — Tester une mise à niveau sans perte de données

Ce protocole concerne uniquement un PC de démonstration. Ne pas utiliser une unique base de ventes réelles pour essayer une mise à niveau.

## Données conservées

- Nouveau nom affiché et installateur : **VestiFlow**, version **0.2.2**.
- Identifiant Tauri INCHANGÉ : ml.modestock.local.
- Fichier SQLite INCHANGÉ : %LOCALAPPDATA%\ml.modestock.local\modestock.db.
- Données existantes conservées : produits, variantes, stocks, ventes, fiches clients, dettes, paiements, compte administrateur, logo et paramètres.
- Le changement de nom du produit Windows peut créer une seconde application à côté de ModeStock Local 0.1.0, plutôt qu'une mise à jour en place. NE désinstallez pas l'ancien logiciel avant les contrôles. Ne lancez jamais les deux versions simultanément.

## 1. Relever AVANT la mise à jour

Sur le deuxième PC, ouvrir ModeStock Local 0.1.0 et noter les données d'essai : nom de boutique, référence de deux ventes, stock d'une pointure, nom d'un client, montant restant de sa dette et identifiant administrateur (pas son mot de passe).

Dans Paramètres → Sauvegardes locales, cliquer sur Créer une sauvegarde locale. Cette fonction utilise SQLite VACUUM INTO, qui produit une copie cohérente même lorsque la base principale utilise le mode WAL. Fermer totalement l'application après cette sauvegarde.

Sous le MÊME compte utilisateur Windows, ouvrir PowerShell :

~~~powershell
$dir = Join-Path $env:LOCALAPPDATA "ml.modestock.local"
$db = Join-Path $dir "modestock.db"
Test-Path $db
Get-Item $db | Select-Object FullName,Length,LastWriteTime
Get-ChildItem (Join-Path $dir "backups") -Filter "modestock-*.db" | Sort-Object LastWriteTime -Descending | Select-Object -First 3 FullName,Length,LastWriteTime
~~~

STOP si Test-Path retourne False. Copier la sauvegarde la plus récente sur clé USB (adapter E: à la lettre de votre clé) :

~~~powershell
$latest = Get-ChildItem (Join-Path $env:LOCALAPPDATA "ml.modestock.local\backups") -Filter "modestock-*.db" | Sort-Object LastWriteTime -Descending | Select-Object -First 1
if (-not $latest) { throw "Aucune sauvegarde disponible. Interrompre." }
Copy-Item $latest.FullName "E:\" -ErrorAction Stop
Get-FileHash (Join-Path "E:\" $latest.Name) -Algorithm SHA256
~~~

Conserver une deuxième copie indépendante en lieu sûr. Ne pas copier le fichier actif de base pendant que l'application tourne.

## 2. Construire VestiFlow sur le PC développeur

~~~powershell
cd "$HOME\vente"
git switch main
git pull --ff-only origin main
npm install
npm audit
npm run test
npm run build
cargo test --manifest-path src-tauri/Cargo.toml --lib
npm run tauri build
Get-ChildItem ".\src-tauri\target\release\bundle\nsis" -Filter "VestiFlow*setup.exe"
~~~

Copier VestiFlow_0.2.2_x64-setup.exe sur clé USB. Ne pas confondre avec l'ancien installateur ModeStock Local_0.1.0.

## 3. Installer sur le deuxième PC

1. Se connecter au MÊME compte Windows que l'ancien logiciel.
2. Vérifier que ModeStock Local est totalement fermé.
3. NE PAS désinstaller ModeStock Local pour l'instant.
4. Lancer l'installateur VestiFlow 0.2.2. Il peut afficher une seconde entrée dans Applications installées car le nom commercial Windows change.
5. Ne pas demander à un client de désactiver la sécurité Windows pour passer les avertissements d'un installateur non signé.

## 4. Vérifier APRÈS la mise à jour

1. VestiFlow doit demander la CONNEXION avec l'ancien compte administrateur. Si le programme demande de CRÉER un nouvel administrateur, STOP sans créer de compte : la base attendue n'est pas détectée.
2. Vérifier le même nom de boutique, logo, références des ventes, produits, stock, fiches clients et dettes notées à l'étape 1.
3. Tester l'affichage à 1024×600 et à 1366×768, y compris une mise à l'échelle Windows de 125 % et 150 %. Aucun glissement horizontal de toute la fenêtre, navigation fixe, login accessible.
4. Faire une vente de démonstration, fermer, rouvrir, vérifier la conservation.
5. Créer une deuxième sauvegarde externe.

Ne retirer l'ancienne application qu'après toutes ces vérifications et deux sauvegardes externes disponibles.

## 5. Si les données ont disparu

NE PAS créer de nouveaux comptes, NE PAS réinitialiser SQLite, NE PAS désinstaller l'ancien logiciel. Fermer VestiFlow, contrôler le même compte utilisateur Windows et le fichier :

~~~powershell
Get-Item (Join-Path $env:LOCALAPPDATA "ml.modestock.local\modestock.db") | Select-Object FullName,Length,LastWriteTime
~~~

Conserver les deux installateurs, les sauvegardes et les références notées avant/après. Ne pas remplacer les fichiers d'une base SQLite active en mode WAL.

## Mises à jour ultérieures

Une fois VestiFlow 0.2 installé, conserver le nom du produit Windows VestiFlow et l'identifiant technique ml.modestock.local. Les futures migrations doivent être non destructives. L'export externe et la restauration automatisée restent à finaliser avant la distribution commerciale.

## Régression 0.2.2 sur le ProBook

Survoler le menu avec la souris et tourner la molette : **rien ne doit bouger dans la barre latérale**. Le logo et les 8 rubriques restent à la même position. Ensuite survoler le contenu et faire défiler : seule cette partie doit bouger, l'en-tête restant fixe. Vérifier les produits, clients, stocks, ventes et dettes avant et après la mise à jour.
