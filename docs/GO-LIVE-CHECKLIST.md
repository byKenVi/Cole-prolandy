# Checklist de mise en production — Landy's Pro

À suivre dans l'ordre, après avoir récupéré la branche `prod-readiness`. Chaque étape indique comment vérifier qu'elle a marché.

---

## 1. Récupérer le code sur Replit

```bash
git fetch origin
git checkout prod-readiness   # ou merger la PR dans main puis git pull
pnpm install
```

Vérification : `git log --oneline -1` montre le dernier commit de la branche.

## 2. Base de données (à faire AVANT de publier)

Le build ne lance aucune migration, et Replit Publish copie le **schéma** de la base de dev vers la prod, pas les données. La migration `20261113120000_production_readiness` est **uniquement additive** : nouvelles colonnes avec valeur par défaut, une nouvelle table `NotificationMessage` et une nouvelle valeur d'enum `PAY_FEE`.

Dans le Shell Replit (environnement de dev) :

```bash
cd artifacts/landys-pro
pnpm exec prisma migrate deploy
```

- Si la commande échoue avec `P3005` (base sans historique de migrations), utiliser `pnpm exec prisma db push`. Elle doit annoncer uniquement des ajouts. **S'arrêter si elle parle de perte de données.**
- Ensuite, **Publish**. Le diff de schéma proposé pour la prod ne doit contenir que des ajouts.

Les données de référence (réglages, paliers de fee, catégories, types de travaux, types de terrain) sont créées **automatiquement au démarrage** si elles manquent. Elles n'écrasent jamais une valeur modifiée par l'admin.

Vérification : après le déploiement, les logs contiennent `[bootstrap] reference data inserted` au premier démarrage, et rien ensuite.

## 3. Secrets Replit (production)

| Secret | Valeur | État |
|---|---|---|
| `CRON_SECRET` | 40 caractères aléatoires (`openssl rand -hex 20`) | **à créer** |
| `WIX_ESTIMATE_API_SECRET` | déjà partagé avec landys.co | ok |
| `WIX_SITE_ID`, `WIX_API_AUTHORIZATION` | déjà présents | ok |
| `WIX_CONTRACTOR_COLLECTION_ID` | seulement si la collection ne s'appelle pas `AllContractors` | à vérifier |
| `RESEND_FROM` | `Landy's Pro <pros@mail.landys.co>`, une fois le domaine vérifié (étape 5) | **à créer** |
| `ONLINE_PAYMENTS_ENABLED` | `false` tant que le compte Stripe du client n'est pas connecté (plan B : l'admin enregistre les paiements) ; à supprimer ensuite | selon Stripe |
| `TWILIO_MESSAGING_SERVICE_SID` | `MG…`, une fois l'A2P validé (étape 6) | **à créer** |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` | compte de production (pas d'essai) | à vérifier |
| Stripe | connecteur Replit en mode **live** pour la production | à vérifier |

Déjà corrigé dans `.replit` : `STRIPE_MOCK="false"`, `RESEND_MOCK="false"`, `PUBLIC_ESTIMATE_FORM_ENABLED="false"`.

Si un domaine personnalisé est utilisé (ex. `pro.landys.co`), il faut mettre à jour `NEXT_PUBLIC_APP_URL` **et** `CLERK_PROXY_URL` dans `.replit`, puis déclarer le domaine dans Clerk.

Vérification : le tableau de bord admin affiche un bandeau « Action needed » tant qu'un réglage critique manque.

## 4. Tâches planifiées (cron-job.org)

1. Créer un compte gratuit sur <https://cron-job.org>.
2. Créer un cron :
   - URL : `https://<domaine>/api/cron/run`
   - toutes les **10 minutes**, méthode **POST** ;
   - en-tête : `Authorization: Bearer <CRON_SECRET>` ;
   - activer les **notifications d'échec** par email.
3. Lancer une exécution test depuis cron-job.org : la réponse doit être `{"ok":true,...}`.

Ce cron gère : l'expiration des leads, les relances « Avez-vous eu le job ? » et « Avez-vous été payé ? », les rappels de fee, l'email « Avez-vous embauché ? » au propriétaire, les invitations programmées, la synchro landys.co (toutes les 6 h) et la file d'envoi des SMS et emails.

Vérification : admin → **Messages** affiche « Scheduler last ran: … » mis à jour toutes les 10 minutes.

Ajouter un second job cron-job.org en **surveillance** : `GET https://<domaine>/api/health` toutes les 5 minutes, alerte email si ce n'est pas 200. Par ailleurs, même si le cron externe tombe, les tâches se relancent d'elles-mêmes lors des visites admin ou contracteur et à l'arrivée des leads. Les erreurs serveur sont envoyées par email aux admins.

## 5. Domaine d'envoi des emails (Resend)

Sans domaine vérifié, Resend ne délivre **qu'à l'adresse du titulaire du compte**.

1. Resend → Domains → **Add domain** → `landys.co`, ou un sous-domaine dédié comme `mail.landys.co` (conseillé).
2. Ajouter les enregistrements DNS affichés (SPF, DKIM, éventuellement DMARC) dans la zone DNS de landys.co. Wix : Domains → Manage DNS Records.
3. Attendre « Verified », puis définir `RESEND_FROM`.

Vérification : admin → Messages, les emails passent en « Sent ». Envoyer un test à une adresse Gmail externe.

## 6. SMS aux États-Unis (Twilio A2P 10DLC)

Sans enregistrement, les opérateurs américains filtrent ou bloquent les SMS.

1. Twilio Console → Messaging → Regulatory Compliance → **A2P 10DLC** : enregistrer la marque (la société du client), puis une campagne.
2. Cas d'usage : *Account notifications / Customer care*. Exemples de messages : reprendre ceux du journal admin → Messages.
3. Consentement : « Les contracteurs inscrits sur landys.co acceptent de recevoir par SMS les demandes de travaux et les suivis liés ; STOP pour se désinscrire. »
4. Créer un **Messaging Service** qui contient le numéro, puis définir `TWILIO_MESSAGING_SERVICE_SID`.

Les SMS partent entre 8 h et 21 h, heure locale du destinataire. Un STOP est respecté automatiquement : le contracteur est marqué « texts off » et reçoit encore les emails.

## 7. landys.co (développeurs Wix)

Leur envoyer `docs/LANDYS-CO-INTEGRATION-NOTES.md`, rédigé en anglais pour eux. Il contient :
- l'URL et l'en-tête d'authentification ;
- les réponses HTTP et quand réessayer ;
- les 3 points à confirmer : même liste de catégories dans le formulaire et le CMS, zones de service renseignées, champ Status.

## 8. Première synchro des contracteurs et invitations

1. Admin → **Contractors** → synchro Wix en **Dry run**. Le résultat indique combien seraient créés ou mis à jour et liste les **clés de champs reçues** (`sampleKeys`). C'est le moyen de vérifier le mapping.
2. Lancer la vraie synchro. Vérifier :
   - « without a service area » : ces contracteurs ne reçoivent des leads qu'en secours ;
   - « skipped (missing name or email) ».
3. Admin → **Invitations** : sélectionner les contracteurs, puis « Send now » ou « Schedule » à la date voulue. Chacun reçoit un email et un SMS de marque avec son lien d'inscription.

## 9. Nettoyage des données QA en production

L'ancienne route QA (supprimée) a pu créer en production :
- le contracteur « TECHMA QA Contractor » (`lihounhintoe@gmail.com`, catégorie General Contractor) : **le désactiver**, sinon il recevra de vrais leads en secours ;
- le lead « CONTROLLED PRODUCTION QA » (source `production_qa`) : **le supprimer** depuis admin → Leads ;
- l'admin `kevin.linhounhinto@techma.ca` avec le rôle OWNER : à garder ou retirer depuis admin → Team.

## 10. Test de bout en bout (avec un vrai téléphone)

**Automatique (en dev, à chaque mise à jour) :**

```bash
cd artifacts/landys-pro
pnpm run e2e:smoke          # ajoute -- --keep pour garder les données de test
```

Le script rejoue tout le parcours sur la base de dev et le serveur de dev. Il affiche PASS ou FAIL étape par étape. Tous les SMS et emails arrivent sur `DEVELOPMENT_NOTIFICATION_PHONE` et `DEVELOPMENT_NOTIFICATION_EMAIL`. Il refuse de tourner contre la production.

Avant de lancer le script, admin → **Messages** → « Send a test message » : un SMS et un email doivent arriver.

**Manuel (recette à deux, sur téléphone) :**

1. Créer un contracteur de test (votre email et votre mobile, ZIP de service = le vôtre, catégorie Roofing).
2. Envoyer une demande avec ce ZIP, depuis landys.co ou par `curl` (payload du PDF, `budget: "under-5k"`).
3. Vérifier, dans l'ordre :
   - SMS et email détaillés reçus ;
   - le lien ouvre la demande sans connexion ;
   - « Accept this job » affiche le contact ;
   - le propriétaire reçoit « <Entreprise> wants to help with your project ».
4. Admin → fiche du lead → **Follow-up tools** : « Send "Did you get the job?" now », répondre « Yes » avec un prix sur le téléphone, puis « Send "Have you been paid?" now » → « Yes ». Le SMS « Your success fee is due » doit arriver, puis la page de paiement (Stripe test en dev).
5. Même fiche : « Send "Did you hire someone?" to the homeowner now », puis répondre depuis l'email reçu.

## 11. Sauvegarde et routine après lancement

- **Avant le lancement :** dans l'onglet Database de Replit (production), vérifier que la restauration à un instant donné (point-in-time) est disponible et noter la procédure. La tester une fois sur la base de dev.

- Chaque jour : tableau de bord admin, bandeau des vérifications, puis Leads « en attente de revue ».
- Chaque semaine : admin → Messages → onglet **Failed**.
- Les alertes admin (lead non routé, aucun contracteur n'a accepté, fee en retard, incohérence propriétaire/contracteur) arrivent par email à tous les admins actifs.
