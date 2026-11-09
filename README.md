# ModeStock Local

Logiciel Windows de caisse et de suivi de stock pour les boutiques de vêtements au Mali. Application locale, sans Internet ni serveur.

## Architecture
- React + TypeScript + Vite : interface.
- Tauri 2 + Rust : application Windows et opérations métier.
- SQLite : données locales, stockées dans le dossier de l'application de l'utilisateur Windows.
- NSIS + WebView2 offlineInstaller : installation sans connexion.

## Démarrage (Windows)
Prérequis de développement : Node.js, Rust, Visual Studio C++ Build Tools, WebView2.

1. npm install
2. npm run tauri icon public/brand.svg
3. npm run tauri dev
4. npm run build
5. npm run tauri build

Le programme d'installation NSIS est créé dans src-tauri/target/release/bundle/nsis/ après compilation. La création de cet installateur exige un poste Windows configuré pour compiler Tauri.

## Fonctionnalités du premier socle
- Catalogue avec variantes de taille et de couleur.
- Ajustement de stock historisé.
- Caisse multi-articles, contrôle anti-survente, paiement enregistré localement.
- Chiffre d'affaires, bénéfice brut et dépenses par jour.
- Rapports et liste des ventes.
- Paramètres de boutique.
- Sauvegarde locale SQLite à la demande via VACUUM INTO.

## Important avant commercialisation
Cette branche constitue une première version de développement, **pas un logiciel validé en production**. Restent notamment à finaliser : impression de reçus, retours et annulations, gestion des comptes et permissions, export externe et restauration testée, vérification des calculs et tests sur de vrais ordinateurs Windows. La sauvegarde locale ne protège pas contre la panne totale du disque : exporter les copies sur un support séparé est indispensable.

Données propres à chaque installation. Aucune télémétrie ni requête réseau prévue dans l'application.
