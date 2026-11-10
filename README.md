# VestiFlow

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

## Première connexion et personnalisation

Au premier lancement, VestiFlow demande de **créer un compte administrateur local** avec un mot de passe de 8 caractères minimum. Les secrets sont hachés avec Argon2 dans SQLite ; ils ne sont pas envoyés sur Internet. Il n'existe pas encore de récupération automatique de mot de passe : prévoir une procédure de secours vérifiée avant distribution.

Dans **Paramètres → Profil et documents**, saisir le nom, l'adresse, le téléphone, importer un logo PNG/JPG/WebP (450 Ko maximum), définir l'en-tête et le pied de ticket et sélectionner un format Ticket 80 mm ou A4. Pour visualiser une vente déjà effectuée, utiliser le bouton **Ticket** dans l'historique. L'impression utilise la boîte de dialogue Windows (`window.print()`) et doit être testée avec les imprimantes effectivement utilisées.

Les paramètres sont conservés dans une nouvelle table SQLite (`shop_branding`) sans recréer les ventes préexistantes.

## Fonctionnalités du premier socle
- Catalogue avec variantes de taille et de couleur.
- Ajustement de stock historisé.
- Caisse multi-articles, contrôle anti-survente, paiement enregistré localement.
- Chiffre d'affaires, bénéfice brut et dépenses par jour.
- Rapports et liste des ventes.
- Paramètres de boutique.
- Sauvegarde locale SQLite à la demande via VACUUM INTO.

## Important avant commercialisation
Cette branche constitue une première version de développement, **pas un logiciel validé en production**. Restent notamment à finaliser : validation sur imprimantes thermiques et documents A4, retours et annulations, comptes vendeur et gestion complète des permissions, export externe et restauration testée, vérification des calculs et tests sur de vrais ordinateurs Windows. La sauvegarde locale ne protège pas contre la panne totale du disque : exporter les copies sur un support séparé est indispensable.

Données propres à chaque installation. Aucune télémétrie ni requête réseau prévue dans l'application.

## Installer VestiFlow chez un commerçant

- [Guide installation USB et risques de sécurité](docs/INSTALLATION_CLIENT.md)
- [Recette de validation fonctionnelle et sécurité](docs/RECETTE_SECURITE.md)
- Pour construire l'installateur sur **votre poste de développement** : exécuter le script PowerShell scripts/build-installer.ps1 après validation du projet.

La dernière version du code n'est **pas encore approuvée pour les ventes de clients réels**. La base SQLite n'est pas chiffrée au repos et l'export/restauration hors disque reste à finaliser.

## Clients, crédits et modification des produits (branche de développement)

- **Catalogue → Détails / Modifier** : consulter tailles, couleurs, prix, stock et mouvements ; modifier les prix, la catégorie, le nom, les tailles/couleurs et ajouter une variante. Les stocks existants se corrigent exclusivement dans Gestion du stock.
- **Clients & dettes → Ajouter un client** : nom, téléphone, adresse, note, achats, paiements et solde dû.
- **Caisse → Client** : sélectionner un client (obligatoire si la vente n'est pas payée entièrement).
- **Caisse → Paiement total / Acompte-Crédit** : indiquer le montant versé aujourd'hui, y compris 0 FCFA si la vente est entièrement à crédit.
- **Historique / Clients → Régler** : enregistrer ensuite chaque versement jusqu'à ce que le reste soit 0 FCFA.

Les sommes sont distinguées : **montant de vente** (la valeur des articles vendus) et **encaissements** (argent réellement reçu). Les nouveaux versements sont des règlements et ne créent pas de ventes supplémentaires. Les tables SQLite ajoutées sont customers, sale_customers et sale_payments.

**Migration** : au premier lancement de cette version, les anciennes ventes sauvegardées comme payées comptant reçoivent un règlement historique complet. La migration est enregistrée pour ne pas transformer de nouvelles ventes à crédit en ventes payées lors du redémarrage. Aucun ancien produit ou client n'est volontairement supprimé.

**Important** : l'interface et les fonctionnalités restent en phase de validation. Les retours et annulations, la restauration externe vérifiée, la signature de l'installateur et la recette sur de vraies imprimantes sont encore nécessaires avant de vendre le logiciel.

## Passage de ModeStock Local à VestiFlow 0.2.3

Le **nom commercial** et l'installateur sont maintenant « VestiFlow » (sans « Local »). L'identifiant technique **ml.modestock.local** et le fichier **modestock.db** sont préservés : une installation sous **le même compte Windows** peut retrouver les données déjà présentes. En raison du changement de `productName`, la version 0.2 peut s'installer à côté de ModeStock Local 0.1.0 ; **ne désinstallez pas l'ancienne version avant vérification**. Ne pas utiliser les deux applications simultanément. Le guide de migration est dans [docs/MISE_A_JOUR_VESTIFLOW.md](docs/MISE_A_JOUR_VESTIFLOW.md).

L'interface est adaptative pour les ordinateurs portables de petite taille et le login a été compacté. Les panneaux de navigation restent fixes ; les tableaux peuvent défiler dans leur propre cadre sans imposer un défilement horizontal à toute la fenêtre.

## Barre latérale fixe — VestiFlow 0.2.3

À la suite du test vidéo sur ProBook, le sidebar n'est **plus une zone de défilement** : la molette ne déplace jamais le logo ni les menus. Les liens sont plus compacts selon la hauteur de l'écran ; sous 560 px de haut, des éléments secondaires du pied de menu sont masqués pour conserver les huit modules et Déconnexion visibles. Le contenu de la page continue à défiler indépendamment.

## Caisse à défilement indépendant — VestiFlow 0.2.3

La page **Caisse & ventes** est organisée en deux panneaux : la liste des produits défile uniquement à gauche, tandis que le panier entier (articles, client, remise, type de règlement, validation) défile uniquement à droite. Les barres de défilement de ces deux zones sont masquées, mais la molette, le clavier et le pavé tactile fonctionnent. La recherche de produits, le titre du panier, l'en-tête général et le menu principal ne bougent pas. Sur les écrans très étroits, les panneaux passent l'un au-dessus de l'autre avec des zones de défilement indépendantes.
