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
