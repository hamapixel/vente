# ModeStock Local — Recette sécurité et validation client

La version ne sera commercialisable qu'après exécution de cette liste sur un PC Windows de démonstration, avec une vraie imprimante.

## Interface et authentification

- [ ] Login compact, centré, avec logo ModeStock ou logo du commerçant en haut.
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
- [ ] Conserver créances et paiements après redémarrage de ModeStock et mise à jour de la base.
- [ ] Anciennes ventes antérieures aux créances migrées **une seule fois** comme intégralement payées.
- [ ] Rapport « ventes du jour » distinct des « encaissements du jour » : les règlements de dettes anciens sont comptés dans l'encaissement, pas comme une nouvelle vente.
