# VestiFlow — grands catalogues et accès téléphone

## Ce qui est implémenté en 0.3.0 (pilote Windows)
- **Correction de vente :** recherche immédiate des articles par nom, catégorie, SKU, taille et couleur, résultat limité aux 30 premières variantes pour rester lisible. Pas de sélecteur natif géant.
- **Clients :** choix rapide par nom, téléphone ou adresse dans la caisse et les corrections.
- **Caisse :** lorsqu'un produit possède plus de 30 variantes, choix par recherche au lieu d'un défilement de centaines de boutons.
- **Catalogue, stock, caisse :** rendu progressif de 80 entrées à la fois. Le filtrage conserve la recherche dans toute la liste chargée.
- **Marchandises diverses :** catégories préconfigurées (vêtements, baskets, ceintures, sacs, montres, bijoux, parfums, divers, etc.) et **catégorie libre**. Articles sans taille : « Unique » ; sans couleur : « Standard ».
- **Petites fenêtres :** correction compacte et barre de navigation en bas pour les formats très étroits. Ces règles CSS préparent l'interface du futur client mobile.

## Attention : interface mobile ≠ accès mobile opérationnel

**La version actuelle est une application Windows Tauri avec SQLite locale.** Le frontend React invoque les fonctions Rust via l'IPC Tauri. Ouvrir la page Vite dans un navigateur Android/iPhone ne permet pas de lire ou d'écrire la base SQLite du PC. Aucun serveur d'accès distant ni application Android/iPhone installable n'est livré par cette PR.

Tauri 2 possède des capacités Android/iOS, mais installer une app mobile indépendante ferait une **base séparée** sans mécanisme de synchronisation. Il ne faut pas prétendre qu'une simple conversion du site synchronise les ventes, stocks ou dettes.

### Architecture proposée pour un vrai accès depuis le téléphone
1. Maintenir la **base locale Windows comme source fiable des opérations en magasin** dans un premier temps et ne jamais exposer les fichiers `.db` directement par Internet.
2. Ajouter un **service API authentifié** avec permissions administrateur/vendeur et journal d'audit, tests métier identiques aux commandes Rust (stock, ventes, paiements, remboursements).
3. Fournir une **PWA mobile** capable de consulter le stock, l'encaissement du jour et les créances via HTTPS. Ajouter les commandes d'écriture seulement après la gestion des conflits et des doublons.
4. Pour le fonctionnement **hors boutique, PC éteint ou en panne**, prévoir un backend hébergé sécurisé avec synchronisation bidirectionnelle, identifiants uniques d'opération, ordre des écritures, stratégie de conflit et sauvegardes indépendantes. Ne pas commencer par exposer SQLite du PC sur un port public.
5. Protéger les données clients et financières : HTTPS, sessions expirantes, autorisations, chiffrement et rotation des secrets, sauvegardes vérifiées, authentification forte si l'accès est distant.

### Cas de recette avant de vendre VestiFlow Windows
- Sur un catalogue de plusieurs milliers de variantes, saisir « ceinture cuir noir », « basket 42 » ou un SKU ; vérifier le résultat puis l'ajout en caisse et dans une correction.
- Rechercher un client par nom et par chiffres de téléphone, sélectionner puis revenir au client de passage uniquement si aucun crédit ne reste.
- Corriger une vente payée / partielle / impayée ; vérifier stock, historique, paiements nets et remboursement explicite sans double encaissement.
- Vérifier les catégories personnalisées « Quincaillerie » et « Ceintures » ; créer des articles « Unique / Standard » et des chaussures à pointures multiples.
- Examiner la mise en page aux tailles 360×740, 390×844, 520×360, 800×600, 1024×600, 1366×768 et avec une mise à l'échelle Windows 125/150 %. **Les tailles téléphone sont des tests de mise en page uniquement.**
- Sauvegarder sur clé USB, restaurer sur PC de test isolé, reconnecter l'administrateur restauré et comparer articles, mouvements, crédits, règlements.
- Tester physiquement les impressions thermiques 80 mm et A4, ainsi que les gestes de pavé tactile sur ProBook.
- Signer et distribuer l'installateur seulement après la recette. La SQLite et les sauvegardes `.db` sont actuellement non chiffrées.

## Développement Windows

Ouvrir le **dossier pilote** puis générer les icônes Windows si elles manquent :

```powershell
cd "C:\Users\HP USER\vestiflow-pilote"
git pull
npm install
npm run tauri icon public/brand.svg
npm run build
npm run test
npm run tauri dev
```

**Important :** les deux dossiers `vente` et `vestiflow-pilote` conservent le même identifiant Tauri `ml.modestock.local`. Sous le même compte Windows, ils peuvent ouvrir **la même** base `modestock.db`. Ne pas les lancer simultanément, et ne jamais tester les corrections financières sur l'unique base réelle d'un commerçant. Préférer un compte Windows de test distinct.
