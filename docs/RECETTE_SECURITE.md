# VestiFlow — Recette sécurité et validation client

La version ne sera commercialisable qu'après exécution de cette liste sur un PC Windows de démonstration, avec une vraie imprimante.

## Interface et authentification

- [ ] Login compact, centré, avec logo VestiFlow ou logo du commerçant en haut.
- [ ] Création du compte administrateur puis reconnexion après fermeture et réouverture.
- [ ] Mot de passe incorrect rejeté, blocage temporaire après cinq échecs.
- [ ] Déconnexion bloque les commandes métier SQLite.
- [ ] Retour navigue normalement et les boutons de caisse sont clairs.
- [ ] Aucun accès aux prix d'achat ou bénéfices sans rôle approprié.

## Recherche et vente

- [ ] Recherche immédiate de maillots, t-shirts, jeans et chaussures.
- [ ] Recherche par référence, catégorie, taille, couleur et pointure, sans accent.
- [ ] Rechercher « chaussure 42 noir » et « basket ».
- [ ] Choisir un vêtement en L ou une chaussure en 42 retire uniquement le stock correspondant.
- [ ] Interdire le stock négatif.
- [ ] Deux clics rapides sur Valider ne créent qu'une vente.
- [ ] Vérifier les remises, les coûts d'achat, la marge brute et les dépenses.
- [ ] Retours et annulations traçables (à livrer avant commercialisation).

## Documents et données

- [ ] Logo, nom, adresse, téléphone, en-tête et pied de ticket conservés après fermeture.
- [ ] Ticket avec référence, date, lignes vendues et total correct.
- [ ] Ticket imprimé sur vraie imprimante thermique 80 mm.
- [ ] Reçu A4 imprimé sans coupe ni mise en page cassée.
- [ ] Le document imprimé n'expose jamais prix d'achat et marges.
- [ ] SQLite reste intact après mise à jour.
- [ ] Sauvegarde externe sur clé USB chiffrée et restauration testée sur un autre PC (à livrer avant commercialisation).
- [ ] Vérification d'intégrité SQLite sur une base restaurée (à livrer).
- [ ] Procédure sûre de récupération de compte (à livrer).

## Installateur client

- [ ] Construire le fichier NSIS setup.exe sur Windows.
- [ ] Installation hors ligne sur Windows 10 et Windows 11 64 bits.
- [ ] Aucun compilateur Rust/Node ni serveur à installer chez le commerçant.
- [ ] Signature de code valide avant diffusion commerciale.
- [ ] Calcul et conservation de la somme SHA-256 de chaque version.

**Ne fusionner la version de développement qu'après la recette locale, les tests CI et validation explicite.** La fusion du code ne signifie pas que la version est prête pour de vraies ventes.


## E. Clients, ventes partielles et dettes — bloc obligatoire de recette

- [ ] Créer un client avec nom, téléphone, adresse et notes puis retrouver sa fiche.
- [ ] Modifier le client sans changer l'historique de ses ventes.
- [ ] Ajouter une chaussure et ouvrir la fiche détaillée de produit.
- [ ] Modifier nom, catégorie, prix d'achat et prix de vente et préserver la quantité actuelle.
- [ ] Ajouter une nouvelle variante et vérifier son stock initial et son identifiant unique.
- [ ] Une ancienne vente conserve ses prix d'achat et de vente historiques après modification du produit.
- [ ] Vente comptant de 10 000 FCFA, paiement total de 10 000 FCFA : reste = 0.
- [ ] Vente partielle de 10 000 FCFA, acompte de 2 000 FCFA : reste = 8 000 FCFA.
- [ ] Vente à crédit de 10 000 FCFA, acompte de 0 FCFA : reste = 10 000 FCFA.
- [ ] Interdire la vente à crédit sans client sélectionné.
- [ ] Encaisser ensuite 3 000 FCFA : reste = 5 000 FCFA.
- [ ] Encaisser 5 000 FCFA : vente « Soldée », solde client = 0.
- [ ] Interdire un règlement supérieur au reste et un paiement sur une vente déjà soldée.
- [ ] Double validation d'un règlement : un seul paiement enregistré.
- [ ] Le ticket montre total, payé, reste à payer et nom du client.
- [ ] La fiche client affiche TOUTES ses ventes, même si l'historique global dépasse 1 000 ventes.
- [ ] Conserver créances et paiements après redémarrage de VestiFlow et mise à jour de la base.
- [ ] Anciennes ventes antérieures aux créances migrées **une seule fois** comme intégralement payées.
- [ ] Rapport « ventes du jour » distinct des « encaissements du jour » : les règlements de dettes anciens sont comptés dans l'encaissement, pas comme une nouvelle vente.

## F. VestiFlow 0.2.3 — ProBook, fenêtre et migration

- [ ] Sur 1366×768 à 100 % et 125 %, aucun défilement horizontal de la fenêtre entière.
- [ ] Sur 1024×600, le menu vertical et le bandeau supérieur restent visibles.
- [ ] Sur 800×600, les panneaux se réorganisent sans couper les boutons principaux.
- [ ] Sur ProBook avec mise à l'échelle 150 %, le login reste entièrement accessible ou défile verticalement sans sortir de la fenêtre.
- [ ] Les tableaux riches défilent uniquement dans leur propre zone.
- [ ] Ancien ModeStock Local sur deuxième PC : sauvegarde externe réussie, données contrôlées avant installation.
- [ ] Après installation de VestiFlow 0.2.3 : même utilisateur Windows, même compte de connexion applicatif, même profil, mêmes produits, ventes et créances.
- [ ] Aucune nouvelle première configuration administrateur si un compte existait dans l'ancienne base.
- [ ] Ne désinstaller l'ancienne application qu'après essais concluants et second backup externe.

## VestiFlow 0.2.3 — barre latérale absolument fixe

- [ ] Sur PC ProBook et 1366×768, déplacer la souris sur le sidebar puis utiliser la molette : le logo, les huit modules et la déconnexion ne se déplacent pas.
- [ ] Faire glisser sur la zone latérale : aucun défilement ni saut du sidebar.
- [ ] Survoler le contenu central et utiliser la molette : la page défile seule ; barre supérieure et menu immobiles.
- [ ] Sur une fenêtre de faible hauteur (560 px et 430 px), les huit liens de navigation restent accessibles sans défilement du sidebar ; certains éléments secondaires du pied de menu peuvent être masqués.
- [ ] Après installation sur le deuxième PC, vérifier anciennes ventes, stocks, créances, identifiant et boutique avant d'effacer l'ancien installateur ou d'autres fichiers.

## VestiFlow 0.2.3 — Caisse à deux zones indépendantes

- [ ] Sur PC 1366×768 et ProBook : survoler la liste de produits, tourner la molette : **seuls les produits défilent**. Panier, recherche, sidebar et en-tête restent immobiles.
- [ ] Survoler le panier et tourner la molette : **seuls les articles et champs de règlement défilent**. Grille de produits et menu immobiles.
- [ ] Vérifier que les deux zones défilent sans barre visible, mais restent pilotables au pavé tactile et au clavier Tab + flèches.
- [ ] Avec plus de 10 produits et 6 lignes dans le panier, vérifier que les derniers articles et le bouton Valider la vente sont accessibles.
- [ ] Vérifier le paiement total, acompte/crédit, recherche client instantanée et ticket.
- [ ] Sur petite fenêtre < 780px de largeur, les deux zones restent accessibles en colonne sans défilement horizontal de toute la fenêtre.
- [ ] Réouvrir l’application : stocks, ventes et dettes inchangés après mise à jour 0.2.2 → 0.2.3.

## Stabilité universelle — pavé tactile, formulaires, tickets

- [ ] Sur le ProBook : glisser horizontalement sur pavé tactile dans Catalogue, Stock, Ventes, Rapports, Paramètres, Clients : le contenu de toute la fenêtre ne se déplace jamais latéralement.
- [ ] Geste vertical sur les listes : le contenu normal défile, mais menu latéral et en-tête restent immobiles.
- [ ] Tester pincement de deux doigts et Ctrl+molette : la WebView ne change pas de zoom involontairement ; Ctrl+C/Ctrl+V restent disponibles.
- [ ] Vérifier que les boutons et cartes ne sautent plus lorsqu'on passe la souris dessus.
- [ ] Créer un produit d'essai avec un nom de plus de 100 caractères, plusieurs variantes, couleurs longues et prix ; aucune zone ne doit déborder horizontalement.
- [ ] Dans Ajouter un produit, défiler les variantes : titre et boutons Annuler/Enregistrer restent visibles.
- [ ] Imprimer une vente avec un nom d'article très long sur ticket thermique 80 mm et A4 : aucune ligne n'est coupée ni projetée hors de la largeur du document ; titre et bouton Imprimer accessibles dans la fenêtre.
- [ ] À 1366×768, 1024×600 et zoom Windows 125/150 %, inspecter la caisse, le catalogue et les modales.
- [ ] Confirmer après mise à jour : identifiant Windows, données SQLite, stocks, ventes, dettes et paramètres sauvegardés.


## VestiFlow 0.2.4 — affichage ticket et impression (tous formats d'écran)

- [ ] Sur le PC ProBook photographié : Historique des ventes → icône Ticket : l'aperçu est **entier**, et non une mince bande horizontale.
- [ ] Sur une fenêtre Windows 520×360, 800×600, 1024×600, 1366×768 et 1920×1080 : l'aperçu conserve une zone verticale et les boutons Retour/Imprimer sont visibles.
- [ ] Avec mise à l'échelle Windows 100 %, 125 % et 150 %, vérifier l'ouverture du même ticket.
- [ ] Un ticket long (plus de 20 lignes) défile **dans l'aperçu seulement** ; en-tête et boutons ne bougent pas.
- [ ] Tester la navigation au clavier (Tab vers l'aperçu, flèches/Page suivante).
- [ ] Vérifier un ticket thermique (format de document 80 mm) et une facture A4 avant d'imprimer réellement sur les deux types d'imprimantes.
- [ ] Ne pas confondre la mise à l'échelle de l'aperçu à l'écran et les paramètres du pilote d'impression : sélectionner la bonne largeur papier dans Windows.
- [ ] Avant installation sur le deuxième PC, sauvegarder SQLite sur un support externe et vérifier après mise à jour les anciennes ventes, produits et dettes.
