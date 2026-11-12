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

La version 0.3.0 est **un pilote non approuvé pour la vente à des clients réels**. L'export et la restauration USB sont implémentés, mais doivent être testés sur de vrais PC. La base SQLite et les fichiers `.db` exportés ne sont **pas chiffrés** : protéger physiquement les clés USB et ne pas partager les sauvegardes.

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

## Stabilité d'affichage sur ProBook et pavé tactile

VestiFlow bloque désormais les gestes horizontaux dominants et le zoom WebView2 déclenché par pincement du pavé tactile / raccourcis Ctrl+molette ou Ctrl+Plus/Moins. Les gestes verticaux restent actifs sur les panneaux qui doivent défiler. Les cartes et boutons ne se déplacent plus au survol. Les tableaux se limitent à leur zone et les désignations longues passent à la ligne sans déplacer le document. Dans le formulaire **Ajouter un produit** et la prévisualisation **Ticket/Facture**, l'en-tête et les actions restent stables tandis que seul le contenu central peut défiler. Les tickets imprimés utilisent des colonnes proportionnelles et répartissent les noms longs sur plusieurs lignes.


## VestiFlow 0.2.4 — aperçu du ticket corrigé sur les petits PC

Le ticket de caisse pouvait apparaître sous forme d'une **bande horizontale écrasée** sur certains PC ProBook (hauteur de fenêtre réduite ou mise à l'échelle Windows importante). La modale ne définissait qu'une hauteur maximale, et la zone centrale flex pouvait se retrouver sans hauteur utile. Le correctif affecte une **hauteur réelle calculée selon la WebView** à la fenêtre Ticket/Facture ; seuls les éléments du document défilent, les boutons Retour et Imprimer restent accessibles. Le format thermique et A4 restent disponibles. Un test de géométrie du navigateur Edge est exécuté en CI sur cinq tailles de fenêtre.

Le correctif n'affecte pas la base de données, les ventes, les stocks ou les dettes et conserve l'identifiant technique `ml.modestock.local` et le fichier `modestock.db`.


## VestiFlow 0.3.0 — corrections financières et récupération USB (branche pilote)

Cette version introduit la modification contrôlée d'une vente (articles, quantités, remise, client), l'annulation avec retour du stock, les remboursements traçables et le tableau de bord filtré par journée. **Les paiements déjà reçus ne sont jamais enregistrés une seconde fois** : le calcul des dettes utilise les encaissements diminués des remboursements. Toute correction impose une justification et laisse une trace. Seul l'administrateur peut corriger ou annuler une vente.

Dans **Paramètres → Sauvegarde et restauration professionnelles**, exporter une base SQLite vérifiée vers une clé USB, puis la restaurer sur un PC de remplacement. La restauration exige une confirmation explicite, vérifie l'intégrité du fichier et crée une copie de secours avant remplacement. **Elle remplace les données du PC cible et ne fusionne pas deux boutiques.**

Pour la recette, voir [le guide 0.3.0](docs/RECETTE_VESTIFLOW_0_3.md) et la [PR de développement #7](https://github.com/hamapixel/vente/pull/7). Un installateur **pilote non signé** est conservé quelques jours dans les artefacts du workflow GitHub Actions Windows. Ne pas le distribuer aux commerçants avant les tests réels (restauration USB, ProBook, imprimantes 80 mm/A4) et la signature Windows.
