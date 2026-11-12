# VestiFlow 0.3.0 — Recette commerciale, crédits, annulations et restauration

**Version pilote / démonstration.** Tester sur une copie de la boutique, pas sur les seules données d'un client réel. Les corrections de ventes et remboursements sont des opérations financières sensibles, accessibles uniquement à l'administrateur.

## 1. Filtrer les journées

Depuis **Vue d'ensemble**, sélectionner une journée. Vérifier :
- **Ventes facturées** = total des ventes actives de cette journée, y compris crédits ;
- **Encaissements réels** = argent effectivement reçu CE jour, incluant les remboursements d'anciennes dettes et déduisant les remboursements versés ;
- **Crédits créés ce jour** = reste dû au départ sur les ventes du jour (la valeur peut changer si les articles sont ultérieurement corrigés) ;
- **Bénéfice brut sur ventes** = total facturé moins coût des articles, sans compter les dépenses ;
- **Marge sur encaissements** = estimation proportionnelle à l'argent reçu, pas un bénéfice fiscal certifié ;
- **Créances clients actuelles** = solde restant de toutes les ventes actives, sans doublon.
Depuis **Rapports**, choisir les dates de début/fin pour afficher les montants par journée.

## 2. Crédit et paiement partiel — ne pas encaisser deux fois

Exemple avec une robe facturée **10 000 FCFA**, coût d'achat **6 000 FCFA**, client Awa :
1. Encaisser seulement **2 000 FCFA** et valider.
2. Contrôler : total vendu 10 000 ; encaissé réel 2 000 ; dette 8 000 ; marge commerciale théorique 4 000 ; pas 10 000 d'encaissement.
3. Enregistrer un paiement de **3 000 FCFA** : le solde passe à **5 000 FCFA**.
4. Refaire un paiement de **5 000 FCFA** : le solde devient 0.
5. Vérifier que le registre contient trois encaissements : 2 000 + 3 000 + 5 000, jamais un duplicata automatique de 10 000.

## 3. Corriger une vente payée, à crédit ou sans aucun paiement

Historique des ventes → **Corriger / annuler** (administrateur). Corriger quantité, produit, remise et éventuellement client.
- Une vente de 10 000 FCFA avec **2 000 déjà payés** passe à 15 000 FCFA : le paiement reste 2 000 ; le solde passe à 13 000, sauf si un nouvel acompte est explicitement encaissé.
- Une vente payée 10 000 FCFA passe à 15 000 FCFA : le montant déjà encaissé reste 10 000 ; le supplément de 5 000 peut être encaissé une seule fois, ou attribué comme dette à un client.
- Une vente payée 10 000 FCFA réduite à 6 000 FCFA exige la **restitution physique de 4 000 FCFA**. Ne confirmez le remboursement qu'après avoir rendu cet argent.
- Diminuer une quantité restitue les unités au stock. Augmenter une quantité retire les unités du stock et est refusé si le stock est insuffisant.
- Les corrections consignent les anciens et nouveaux articles, l'utilisateur et la justification. Les anciens paiements ne sont jamais effacés.

## 4. Annuler une vente

Depuis la même fenêtre, **Annuler** :
- justifier l'annulation ;
- si rien n'a été encaissé, annulation et remise en stock sans remboursement ;
- si de l'argent a été encaissé, confirmer le remboursement réel de son montant intégral ;
- la vente reste visible avec le statut ANNULÉE, sans créance ni vente active ; plus de règlements possibles.
- Les remboursements figurent en négatif dans l'historique client.

## 5. Sauvegarde directe sur clé USB

En tant qu'administrateur, aller dans **Paramètres → Sauvegarde et restauration professionnelles**.
- Brancher la clé USB et cliquer **Sauvegarder sur clé USB…** ;
- choisir le lecteur USB et un nouveau fichier `.db` ;
- l'application réalise une copie cohérente et vérifie `integrity_check`, les clés étrangères, les tables VestiFlow et la présence d'un compte administrateur ;
- elle refuse d'écraser une sauvegarde existante : choisir un autre nom.

Ne jamais utiliser une seule sauvegarde : conserver deux copies indépendantes.

## 6. Restaurer sur un autre PC

1. Installer VestiFlow 0.3.0 sur le PC de remplacement (Windows x64 et WebView2). Ouvrir l'application et créer si nécessaire un administrateur temporaire, qui sera remplacé lors de la restauration.
2. Ouvrir **Paramètres → Restaurer un fichier .db…**, choisir la sauvegarde USB.
3. Lire l'avertissement : la restauration **remplace** la boutique de cet ordinateur, elle ne fusionne pas deux bases.
4. Confirmer la case et saisir **RESTAURER**. Le logiciel vérifie le fichier et crée automatiquement un fichier `avant-restauration-*.db` dans son dossier de sauvegardes locales avant de remplacer la base.
5. Après réussite, se reconnecter avec le compte administrateur de la boutique restaurée.
6. Vérifier produits, stocks, anciennes ventes, clients, dettes, tickets et paiements.

Si le fichier est corrompu ou étranger à VestiFlow, la restauration est refusée. En cas d'échec pendant le remplacement, le programme tente de remettre l'ancienne base via sa copie de secours. Conserver toutes les copies et ne pas interrompre Windows pendant la restauration.

## 7. Avant commercialisation

- Tester au moins une installation 0.2.4 → 0.3.0 avec données de démonstration, puis une restauration USB sur **un troisième ordinateur ou une base de test isolée**.
- Vérifier les tickets 80 mm et factures A4 sur de vraies imprimantes.
- Tester les opérations avec un administrateur et un compte vendeur ; seul l'administrateur doit pouvoir corriger ou annuler une vente.
- Finaliser la signature Windows du programme avant la distribution commerciale.
- Conserver l'identifiant technique `ml.modestock.local` et le nom SQLite `modestock.db` pour préserver les installations et mises à jour.
