# VestiFlow — Installation chez un client (Windows)

**Version pilote seulement.** Ne pas utiliser avec de vraies ventes avant les tests de sauvegarde/restauration, d'imprimante, de retours et de mises à jour.

## Architecture

Un ordinateur Windows 10/11 64 bits par boutique, une base SQLite dans les données locales de l'utilisateur Windows. La clé USB sert à distribuer l'installateur, pas à stocker la base. Aucun Node, Rust, Docker, PostgreSQL ni Internet nécessaire sur le poste client.

## Créer le programme d'installation sur le PC développeur

Conditions : Node, Rust MSVC, Microsoft Build Tools C++, SDK Windows et connexion pour télécharger les dépendances de compilation.

~~~powershell
cd "$HOME\vente"
git switch main
git pull --ff-only origin main
npm install
npm run tauri icon public/brand.svg
npm run build
npm run test
cargo check --manifest-path src-tauri/Cargo.toml
npm run tauri build
Get-ChildItem "src-tauri\target\release\bundle\nsis" -Filter "*setup.exe"
~~~

Le fichier généré dans src-tauri/target/release/bundle/nsis est un installateur NSIS. Le mode WebView2 offlineInstaller est configuré pour l'installation sans Internet.

Calculer l'empreinte et contrôler la signature du fichier exact avant copie sur la clé :

~~~powershell
Get-FileHash "CHEMIN_DU_SETUP.exe" -Algorithm SHA256
Get-AuthenticodeSignature "CHEMIN_DU_SETUP.exe"
~~~

L'installateur n'est **pas encore signé automatiquement**. Un certificat de signature de code doit être prévu pour une distribution commerciale ; ne demandez jamais à un client de désactiver SmartScreen, Smart App Control ou l'antivirus.

## Installer et vérifier sur un PC de démonstration

1. Vérifier Windows 10/11 64 bits, compte Windows protégé, disque et imprimante cible.
2. Installer depuis la clé USB sur un poste de **test**, sans connexion Internet.
3. Ouvrir le raccourci VestiFlow. Créer un administrateur avec un mot de passe fort.
4. Paramètres : renseigner boutique, téléphone, adresse, logo, en-tête et pied de reçu.
5. Ajouter un maillot (M/L/XL) et une chaussure (41/42/43).
6. Tester la recherche instantanée, le stock de chaque variante, les ventes, les marges et le reçu 80 mm/A4.
7. Fermer/réouvrir, se reconnecter, vérifier les données et la configuration.
8. Tester une mise à jour avec une copie de données, jamais sur la seule base réelle.

## Sécurité et limites

- Mots de passe hachés avec Argon2 ; délai temporaire après plusieurs échecs de connexion.
- SQLite **n'est pas chiffré au repos** : protéger l'ordinateur et le compte Windows, et envisager le chiffrement du disque.
- La sauvegarde actuelle reste sur le **même disque** ; une copie externe et une restauration vérifiée sont impératives avant la vente de ce logiciel.
- Pas encore de récupération du mot de passe administrateur.
- Pas de synchronisation multi-postes ; un seul PC par boutique.
- Les tickets doivent être testés sur les imprimantes réelles ; la compilation automatique ne remplace pas cette recette.

Documentation de recette : voir RECETTE_SECURITE.md.

Guides officiels :
- https://v2.tauri.app/distribute/windows-installer/
- https://v2.tauri.app/distribute/sign/windows/

## Transition de l'ancien ModeStock Local (0.1.0) vers VestiFlow (0.2.2)

**Ne désinstallez pas l'ancien logiciel avant d'avoir testé VestiFlow.** Cette transition renomme le produit Windows et peut créer une deuxième entrée dans Applications installées. Les deux applications utilisent le **même dossier de données** si lancées depuis le **même compte utilisateur Windows** : `%LOCALAPPDATA%\\ml.modestock.local\\modestock.db`.

Pour une première mise à jour, utiliser le protocole de [test de conservation des données](MISE_A_JOUR_VESTIFLOW.md). Par la suite, les mises à jour 0.2.x → 0.3.x conserveront le nom Windows VestiFlow. Ne jamais installer simultanément une version ancienne et nouvelle en cours d'exécution.
