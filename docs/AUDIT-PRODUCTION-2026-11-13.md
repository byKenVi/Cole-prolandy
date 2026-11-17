# Audit de mise en production — Landy's Pro

**Date :** 13 novembre 2026
**Périmètre :** `artifacts/landys-pro` (app Next.js), proxy `artifacts/api-server`, configuration Replit, intégration Wix (landys.co), notifications SMS/email, cycle du success fee, interface contracteur.
**Référence externe :** *Payload Reference Guide* (PDF transmis par les développeurs de landys.co).

## Verdict final — 14 novembre 2026

**Le code de Landy's Pro est prêt à 100 % pour la production.** Tout ce qui est listé ci-dessous a été traité :
- les 9 bloquants (P0) ;
- les 14 problèmes majeurs (P1) ;
- la dette utile au lancement (P2) ;
- la refonte de l'interface contracteur ;
- les outils de recette et de surveillance (Lot A de la roadmap).

Vérifié par 252 tests automatisés, typecheck, lint, build de production et une revue visuelle mobile.

Trois conditions de mise en service, détaillées dans `docs/ROADMAP-GO-LIVE.md` :
1. **Preuve sur l'infrastructure réelle :** `pnpm run e2e:smoke` à 100 % PASS sur l'environnement de dev Replit, et la recette manuelle (lundi 16). C'est la seule vérification qui exige les accès Replit.
2. **Domaine email vérifié** (DNS de landys.co). Chemin critique : sans lui, aucun email ne part.
3. **Fournisseurs du client :**
   - Twilio de production et enregistrement A2P. Plan B : lancement avec l'email seul, les SMS s'activent dès que les identifiants sont posés.
   - Stripe. Plan B : `ONLINE_PAYMENTS_ENABLED=false`, l'admin enregistre les paiements. Aucun fee n'est dû avant plusieurs semaines.

## Verdict initial — 13 novembre 2026

**L'application n'était pas prête pour la production.** Le code est propre et typé (typecheck OK, 235/238 tests verts), mais le flux principal ne fonctionne pas de bout en bout avec les vraies données de landys.co.

Exemple concret, vérifié par un test sur les deux payloads du PDF :

| Payload du PDF | Validation | Résultat réel |
|---|---|---|
| Get Three Estimates (`budget: "under-5k"`) | OK | Lead bloqué en « budget review » — **aucun contracteur prévenu** |
| Direct Estimate (`budget: "50k-plus"`) | OK | Lead bloqué en « budget review » — **le contracteur n'est pas prévenu** |

Il y avait 9 bloquants (P0), 14 problèmes majeurs (P1) et un lot de dette (P2). Les questions métier ont été tranchées par TECHMA dans l'intérêt du client (voir `docs/ROADMAP-GO-LIVE.md`, section 8) ; les informations attendues de landys.co font l'objet d'un email, sans bloquer le lancement.

---

## Statut des corrections — branche `prod-readiness` (14 novembre 2026)

| # | Statut | Ce qui a été fait |
|---|---|---|
| P0-1 Budgets Wix | **Corrigé** | Codes Wix acceptés ; le budget ne bloque plus jamais le routage. Testé avec les payloads exacts du PDF. |
| P0-2 Grille de prix | **Corrigé** | Le tier devient informatif ; toute erreur après enregistrement donne une mise en attente + alerte admin (réponse 202 à Wix). |
| P0-3 Taxonomie vide | **Corrigé** | Bootstrap idempotent au démarrage ; catégories, types et terrains inconnus sont créés à la volée. |
| P0-4 Géographie | **Corrigé** | Matching par catégorie + zone (rayon autour des ZIP de service, 50 mi par défaut, ou comté) ; secours sur les contracteurs sans zone. |
| P0-5 Taxonomie CMS ≠ demandes | **Corrigé** | Rapprochement automatique par slug + **fusion de catégories** dans l'admin (les futures demandes suivent la fusion). Confirmation demandée à landys.co, non bloquante. |
| P0-6 Clés Wix | **Corrigé** | Mapping tolérant (libellés ou clés API, listes texte ou tableau, « Yes »/true). Le dry-run admin affiche les clés reçues. |
| P0-7 Mocks en prod | **Corrigé** | `.replit` corrigé ; paiement simulé refusé en production ; interrupteur `ONLINE_PAYMENTS_ENABLED` pour lancer sans Stripe. Mise en service : domaine d'envoi (checklist §5). |
| P0-8 Cron | **Corrigé** | Endpoint unique `/api/cron/run` avec verrou et heartbeat, plus un filet de sécurité : les tâches se relancent lors des visites et à l'arrivée des leads. Mise en service : cron-job.org (checklist §4). |
| P0-9 Route QA | **Corrigé** | Routes supprimées ; le tableau de bord signale automatiquement toute donnée de test active en production (checklist §9 pour la désactiver). |
| P1-1 Email propriétaire | **Corrigé** | Email « <Entreprise> veut vous aider » à chaque acceptation ; « Avez-vous embauché ? » à J+14 avec un rappel ; aucune réponse enregistrée sans clic sur « Confirm ». |
| P1-2 Relances | **Corrigé** | Jusqu'à 3 relances par étape, puis alerte admin ; rappels de fee à J+3, J+7 et J+14, puis alerte « en retard ». |
| P1-3 Lien brûlé | **Corrigé** | Le lien n'est consommé qu'après succès. Test ajouté. |
| P1-4 Pièces jointes | **Corrigé** | Téléchargées après la réponse ; un échec ne bloque plus le lead. |
| P1-5 Zéro match | **Corrigé** | Lead mis en attente + alerte admin ; panneau admin « relancer le routage » ou « envoyer à des contracteurs choisis ». |
| P1-6 Synchro Wix | **Corrigé** | Une désactivation admin n'est jamais annulée par la synchro ; compteurs justes ; rattachement par email. |
| P1-7 Invitations | **Corrigé** | Page admin Invitations : envoi groupé immédiat ou programmé, email et SMS de marque. |
| P1-8 Messages | **Corrigé** | SMS et emails détaillés (ville, budget, délai, urgence, description, photos, règles, fee), ASCII, STOP, heures calmes, journal admin. |
| P1-9 Formulaire public | **Corrigé** | Désactivé en production (`PUBLIC_ESTIMATE_FORM_ENABLED`). |
| P1-10 Expirés affichés | **Corrigé** | Les listes n'affichent que les demandes encore ouvertes. |
| P1-11 Budget invisible | **Corrigé** | Fourchette et taux du fee affichés partout. |
| P1-12 Conditions | **Corrigé** | Mention « en acceptant vous acceptez… », pages `/terms` et `/privacy` (SMS) ; version et taux enregistrés à chaque acceptation. Relecture juridique du client après le lancement. |
| P1-13 Codes de retour Wix | **Corrigé** | 202 dès que le lead est enregistré. |
| P1-14 Twilio A2P | **Prêt** | Dossier d'enregistrement prêt à copier (`docs/TWILIO-A2P-PACKAGE.md`), consentement SMS affiché partout ; plan B email seul. Dépôt le 16 novembre. |
| Interface contracteur | **Refaite** | Mobile-first, ticket de chantier, 17–18 px, boutons de 58–64 px, appel/SMS en un geste, paiement sans connexion, pause des demandes, pages de connexion agrandies. |
| P2 Tests | **Corrigé** | 252 tests verts (les 3 échecs d'origine sont corrigés) + test de bout en bout `e2e:smoke`. |
| P2 Observabilité | **Corrigé** | Erreurs serveur envoyées par email aux admins (limitées en fréquence), `/api/health` pour la surveillance, journal de tous les messages, bandeau de vérifications dans l'admin. |
| P2 Sécurité cron | **Corrigé** | Comparaison du secret en temps constant ; un seul endpoint, en POST ou GET. |
| P2 Docs contradictoires | **Corrigé** | Anciens documents marqués « historiques », avec renvoi vers les références à jour. |
| P2 Version Node | **Corrigé** | `engines` aligné sur Node 22+ (Replit tourne en Node 24). |
| P2 Code legacy pay-per-lead | **Décision : conservé** | Plus accessible depuis l'interface contracteur ; on le garde pour l'historique financier existant. |
| P2 Répertoires annexes | **Décision : conservés** | `api-server` sert de proxy Replit ; `mockup-sandbox` et `.migration-backup` ne sont pas déployés. Aucun risque au lancement. |
| P2 Code legacy et fichiers morts (17 nov.) | **Supprimé** | Ancienne copie de l'app (`.migration-backup`), prompts collés (`attached_assets`), captures, images inutilisées ; recharge de portefeuille, grille de prix pay-per-lead, pages admin pricing/finance, composants et tests associés ; 30 % de CSS mort. Les tables historiques (wallet, prix) restent en base. |
| SEO et standards Google (17 nov.) | **Fait** | Titre, description, canonique, Open Graph et Twitter, image de partage, JSON-LD (Organization, WebSite, Service), `robots.txt` et `sitemap.xml` dynamiques ; `noindex` (en-tête HTTP + meta) sur toutes les pages privées et à jeton ; polices auto-hébergées (plus de requête bloquante vers Google Fonts) ; en-têtes de sécurité (HSTS, nosniff, Referrer-Policy, anti-iframe) ; contraste AA ; lint obligatoire au build ; vérification Search Console par variable d'environnement. |
| P2 Sauvegardes | **Procédure** | Vérifier et tester une fois la restauration de la base dans l'onglet Database de Replit avant le lancement (checklist §11). |

---

## P0 — Bloquants (empêchent la mise en production)

### P0-1 · Les budgets envoyés par Wix ne sont pas reconnus
Wix envoie des codes (`under-5k`, `50k-plus`, probablement `5k-15k`, `15k-50k`). Le normaliseur n'accepte que des libellés (`Under $5K`, `$50K+`…).
- Fichiers : `lib/taxonomy/live-v3.ts` (`BUDGET_BAND_ENTRIES`), `lib/domain/budget.ts`
- Effet : **100 % des demandes Wix restent bloquées** en revue admin. Aucun SMS, aucun email.
- Correctif : accepter les codes Wix + test de non-régression avec les payloads exacts du PDF.

### P0-2 · Le routage dépend encore de la grille de prix « pay-per-lead »
Après le passage au success fee, le prix du lead vaut 0, mais `autoRouteLead` exige toujours un `BudgetBandTierMapping` pour calculer un « tier ». S'il manque, une `InvalidStateError` est levée **après** l'enregistrement du lead → Wix reçoit un `422 invalid_reference` alors que le lead existe.
- Fichiers : `lib/services/lead-intake.ts` (`resolveLeadPricingSnapshot`, `autoRouteLead`), `lib/domain/tier-resolution.ts`
- Correctif : le tier devient informatif (jamais bloquant) ; toute erreur après persistance renvoie `202` avec un blocker explicite.

### P0-3 · La taxonomie de production est probablement vide
Replit « Publish » synchronise le schéma mais **n'exécute pas les INSERT des migrations Prisma** (constaté et noté dans `.agents/memory/production-publish-data-migrations.md`). L'initialiseur `/api/cron/initialize-settings` ne sème que les réglages et les paliers de fee — pas les catégories, types de travaux, types de terrain ni le mapping budget→tier. La route QA a dû créer à la main `general-contractor`, `new-build` et `residential`, ce qui le confirme.
- Effet si `roofing` (par exemple) n'existe pas en prod : `NotFoundError` → `422` → **le lead n'est même pas enregistré. Perte sèche de la demande.**
- Correctif : bootstrap idempotent de la taxonomie au démarrage (ou bouton admin), puis vérification sur la base de prod.

### P0-4 · Aucun filtrage géographique
`distributeLead` filtre seulement par catégorie (+ type de travaux). Un lead « roofing » au Texas part à **tous** les couvreurs de la base, peu importe où ils travaillent. Le CMS Wix fournit pourtant `Service Zip Codes` et `Service Counties` ; on les stocke en métadonnée sans jamais les utiliser.
- Fichiers : `lib/domain/leads.ts` (`distributeLead`), `lib/integrations/wix/contractor-adapter.ts`
- Décision requise : règle de zone (liste de ZIP ? comté ? rayon en miles ?) — voir Q1.

### P0-5 · Les catégories des contracteurs (CMS) ne correspondent pas à celles des demandes
- Les demandes utilisent : `roofing`, `plumbing`, `general-contractor`… et `new-build`, `renovation-remodel`…
- La fiche CMS d'exemple utilise : `Contractors Category: ["Land Lenders"]`, `Secondary Categories: ["Outdoor Renovation"]`, `Project Type: ["Outdoor Living Spaces", "Patio Installation", "Retaining Walls"]`.

Aucune de ces valeurs ne correspond aux codes des demandes. Un contracteur « Land Lenders » ne recevra jamais une demande « roofing ». Les libellés inconnus sont ignorés en silence : le contracteur est créé sans catégorie, donc ne reçoit **rien**.
- Décision requise : quelle taxonomie est réellement en ligne sur landys.co ? — voir Q2.

### P0-6 · Clés de champs Wix non vérifiées
L'adaptateur attend des clés techniques (`companyName`, `contractorsCategory`, `projectType`, `serviceZipCodes` en tableau, `verified` en booléen…). Le PDF montre des **libellés d'affichage** (`"Company Name"`, `"Contractors Category"`) et des types différents (`"Service Zip Codes": "75204, 75205, 75212"` en texte, `"Verified": "Yes"`, `"Featured": "No"`, `"Years Experience": "6"`).
- Effet possible : la synchro crée 0 contracteur (nom/email/téléphone vides → « unresolved »).
- Correctif : récupérer une vraie réponse de `POST /wix-data/v2/items/query` (identifiants requis — Q3), puis adapter le mapping et le rendre tolérant (texte « a, b, c » ou tableau, « Yes »/true).

### P0-7 · Les flags de production dans `.replit` désactivent paiement et email
```
[userenv.production]
STRIPE_MOCK = "true"
RESEND_MOCK = "true"
```
- Avec `STRIPE_MOCK=true`, `createSuccessFeeCheckout` n'a pas de garde-fou production : **quand un contracteur clique « Payer », le success fee passe à PAID sans qu'aucun argent ne bouge** (`app/actions/fees.ts` → `markSuccessFeePaid`), et une fausse carte « visa 4242 » est enregistrée.
- Avec `RESEND_MOCK=true`, **tous les emails sont refusés en production** (`UnconfiguredEmailProvider`).
- L'expéditeur par défaut `onboarding@resend.dev` ne délivre qu'à l'adresse du titulaire du compte Resend : il faut un domaine vérifié (Q4).
- Correctif : flags à `false`, et garde-fou dans le code — refus du mode mock en production pour chaque chemin de paiement.

### P0-8 · Aucune tâche planifiée n'est déclenchée
Les tâches périodiques sont des endpoints HTTP (`/api/cron/expire-leads`, `/api/cron/follow-ups`, `/api/cron/wix-contractor-sync`), mais **rien ne les appelle** : le cron Vercel a disparu avec la migration, et un déploiement Replit « Autoscale » n'a pas de cron.
- Effets : les leads n'expirent jamais ; les relances « Avez-vous eu le job ? » et « Avez-vous été payé ? » ne partent jamais ; **aucun success fee n'est déclenché automatiquement** ; la synchro Wix n'est jamais incrémentale.
- Correctif : scheduler (Q6) + endpoints idempotents, protégés et journalisés.

### P0-9 · Une porte dérobée QA est déployée en production
`/api/cron/align-qa-identities` (route publique protégée seulement par `CRON_SECRET`) contient en dur des emails personnels, donne le rôle **OWNER** à un compte TECHMA, et crée un faux contracteur et un faux lead « CONTROLLED PRODUCTION QA » dans la base de prod.
- Correctif : supprimer la route ; remplacer `initialize-settings` par le bootstrap idempotent de P0-3 ; nettoyer les données QA en prod (après validation).

---

## P1 — Majeurs (à corriger avant d'ouvrir aux vrais utilisateurs)

| # | Problème | Où | Effet |
|---|---|---|---|
| P1-1 | L'email au propriétaire « Avez-vous payé le contracteur ? » part **dès la première acceptation**, quelques minutes après sa demande | `lib/services/landowner-confirmation.ts` | Confusion côté propriétaire, données de confirmation fausses |
| P1-2 | Relances à un seul coup : si le contracteur ignore « Avez-vous eu le job ? », plus rien. Pareil pour « Avez-vous été payé ? ». `notifyFeeDue` n'est jamais appelé | `lib/domain/landowner-confirm.ts` (`dispatchDueFollowUps`), `lib/notifications.ts` | **Perte de revenus** : pas de relance, pas d'alerte admin |
| P1-3 | Le lien de relance est « consommé » avant validation : un montant invalide brûle le lien | `lib/domain/follow-up.ts` (`consumeFollowUpToken`), `app/actions/follow-up.ts` | Contracteur bloqué, fee jamais déclaré |
| P1-4 | Un échec de téléchargement de pièce jointe bloque tout le lead (« held for review ») ; les téléchargements (jusqu'à 5×20 Mo) se font pendant la requête Wix | `lib/services/lead-intake.ts`, `lib/services/lead-attachments.ts` | Une image Wix en 404 = lead non distribué ; risque de timeout côté Wix |
| P1-5 | Un lead sans aucun contracteur éligible est marqué `ROUTED` en silence | `lib/services/lead-intake.ts` | Demande perdue, personne n'est alerté |
| P1-6 | La synchro Wix réactive à chaque passage un contracteur désactivé par l'admin ; compteurs `reactivated`/`deactivated` faux ; un conflit d'email bloque le checkpoint | `lib/integrations/wix/contractor-sync.ts` | L'admin perd le contrôle |
| P1-7 | Invitations contracteurs : une par une, via l'email générique de Clerk ; les contracteurs synchronisés depuis Wix ne sont **jamais invités** ; pas d'envoi groupé ni programmé | `lib/contractor-invitations.ts`, `app/actions/admin.ts` | Demande explicite du client non couverte |
| P1-8 | SMS/emails trop laconiques : ni budget, ni délai, ni urgence, ni description, ni ville (ZIP seul), texte brut, **aucune mention STOP/HELP** (obligatoire A2P 10DLC/TCPA), pas d'heures calmes, échecs des relances non journalisés | `lib/notifications.ts` | Faible conversion, risque de blocage opérateur et risque juridique |
| P1-9 | Formulaire public `/estimate` + `POST /api/estimate` ouverts : n'importe qui peut créer un lead et déclencher des SMS ; limite de débit en mémoire, par instance | `app/estimate`, `app/api/estimate/route.ts`, `lib/rate-limit.ts` | Spam, coûts Twilio |
| P1-10 | Les opportunités expirées restent affichées « en attente » (tableau de bord, liste) | `app/(contractor)/opportunities/page.tsx`, `dashboard/page.tsx` | Le contracteur tape sur des jobs morts |
| P1-11 | Le budget n'est pas montré au contracteur quand Wix envoie une fourchette (on n'affiche que `budgetCents`) ; pas d'estimation du fee | `app/accept/[token]/page.tsx`, cartes | Le contracteur décide à l'aveugle |
| P1-12 | Le contracteur n'accepte jamais explicitement les conditions du success fee (X % si je gagne) | flux d'acceptation | **Fee difficilement opposable juridiquement** |
| P1-13 | Après persistance, certaines erreurs renvoient 4xx/5xx à Wix alors que le lead existe | `app/api/integrations/wix/estimate-requests/route.ts` | Wix croit à un échec ; rejeu incohérent |
| P1-14 | Twilio : statut A2P 10DLC inconnu ; un compte d'essai ajoute un préfixe et ne livre qu'aux numéros vérifiés | config | SMS filtrés ou non délivrés aux vrais contracteurs |

---

## P2 — Qualité, dette, hygiène

- **Tests :** 3 échecs dans `lib/integrations/notifications.test.ts` (dépendants de l'environnement : `DEVELOPMENT_NOTIFICATION_PHONE` manquant). `notifyNewLead` est censé ne jamais lever d'exception, mais lève de façon synchrone dans ce cas.
- **Code legacy pay-per-lead** toujours présent et partiellement exposé : wallet, top-up, `PriceTier`, `WorkTypePriceTier`, remboursements, « charge saved card top-up ». Surface d'attaque et confusion.
- **Répertoires morts :** `.migration-backup/` (copie complète de l'ancienne app, versionnée), `artifacts/mockup-sandbox/`, `lib/db`, `lib/api-*` ; fichier parasite `end` à la racine.
- **Documentation contradictoire :** Supabase vs Neon, pay-per-lead vs success fee, statuts « BLOCKED BY WIX » obsolètes, procédure `prisma migrate deploy` qui ne correspond pas au déploiement Replit réel.
- **Runtime :** `engines.node ">=22 <23"` alors que Replit tourne en Node 24.
- **Sécurité mineure :** secrets cron comparés sans `timingSafeEqual` ; endpoints cron mutants en `GET`.
- **Build :** `eslint.ignoreDuringBuilds: true`, `reactStrictMode: false`.
- **Observabilité :** pas de suivi d'erreurs (Sentry ou équivalent), pas de healthcheck applicatif côté Next, pas de procédure de sauvegarde/restauration documentée pour la base de prod.
- **État du repo :** `main` local a 1 commit d'avance sur `origin` ; 3 fichiers modifiés et 2 nouveaux non commités (panneau de succès d'acceptation, deep links propriétaire). Travail en cours à finaliser ou écarter.

---

## Interface contracteur — constat (public : artisans américains, souvent âgés)

Points forts : base mobile existante (barre d'onglets en bas), lien SMS qui fonctionne sans compte, palette chaleureuse cohérente avec Landy's.

À revoir :
- **Lisibilité :** onglets en 10 px, nombreux textes en 12–14 px. Viser 17–18 px minimum pour le corps du texte.
- **Contraste :** `#A79E8D` sur fond crème ≈ 2,6:1 ; `#8A7E68` ≈ 3,9:1. Sous le seuil WCAG AA (4,5:1).
- **Vocabulaire :** « Opps », « opportunity », « lead », « job » mélangés. Un seul mot, simple (« Job request » / « New job »).
- **Action principale :** pas de gros bouton « Call the homeowner » / « Text » après acceptation ; numéros pas toujours cliquables en évidence.
- **Information utile manquante :** ville (on affiche le ZIP), fourchette de budget, délai, urgence, photos.
- **Hiérarchie :** trop d'éléments d'importance égale ; une page doit avoir **une** action évidente.
- **Taille des cibles tactiles :** viser 56 px de haut pour les boutons principaux.

---

## Cas d'usage non couverts (à valider)

1. Le contracteur veut **mettre en pause** la réception (vacances, carnet plein).
2. Le contracteur répond **STOP** au SMS : désinscription à respecter et à refléter dans l'app.
3. Contracteur **sans email** dans le CMS : il ne peut pas créer de compte, mais doit recevoir les SMS (le lien d'acceptation marche sans compte).
4. Contracteur **sans téléphone** : email seul, à signaler à l'admin.
5. **Aucun contracteur** dans la zone ou la catégorie : alerte admin et option de routage manuel.
6. Demande **en double** (même propriétaire, même projet, à quelques minutes d'intervalle).
7. Le propriétaire **annule** sa demande.
8. Le contracteur **conteste** un fee ou a été **payé partiellement**.
9. **Alertes admin** (email/SMS) : lead bloqué, aucun match, incohérence propriétaire/contracteur, fee en retard.
10. **Heures calmes** pour les SMS (TCPA : pas de texto la nuit, heure locale du contracteur).
11. **Acceptation des conditions** (ToS + taux du fee) horodatée, au premier accept.
12. **Sauvegardes** et **plan de reprise** de la base de prod.
13. Contracteur **supprimé ou désactivé dans Wix** alors qu'il a des jobs en cours ou des fees dus.

---

## Questions à trancher (bloquent certaines corrections)

- **Q1 — Zone géographique.** Comment décide-t-on qu'un contracteur couvre une demande ? Liste de ZIP du CMS, comtés, rayon en miles autour d'un ZIP de base ? Que fait-on si le contracteur n'a renseigné aucune zone ?
- **Q2 — Taxonomie réelle.** Les fiches du CMS utilisent-elles les 11 catégories (Roofing, Plumbing…) ou les anciennes catégories terrain (Land Lenders, Forestry & Timber…) ? Idem pour « Project Type ». À demander aux devs de landys.co, idéalement avec un export.
- **Q3 — Accès API Wix.** `WIX_SITE_ID` et `WIX_API_AUTHORIZATION` sont-ils configurés dans les Secrets Replit ? Il nous faut une réponse brute de l'API pour 2–3 contracteurs (pas un export UI).
- **Q4 — Email.** Depuis quel domaine envoyer (`leads@landys.co` ?) Qui a accès au DNS de landys.co pour vérifier le domaine dans Resend ?
- **Q5 — SMS.** Le compte Twilio de production est-il enregistré A2P 10DLC (marque + campagne) ? Quel numéro expéditeur ?
- **Q6 — Tâches planifiées.** Replit « Scheduled Deployment » (payant, natif) ou service externe gratuit (cron-job.org) qui appelle nos endpoints protégés ? Fréquence souhaitée ?
- **Q7 — Communication au propriétaire.** Que lui envoie déjà landys.co après sa demande ? Veut-on qu'on lui envoie « Voici les pros qui vont vous contacter » à l'acceptation, puis « Avez-vous embauché quelqu'un ? » X jours plus tard ?
- **Q8 — Conditions du success fee.** Les taux 5 % / 4 % / 3 % (seuils 10 k$ / 25 k$) sont-ils définitifs ? Existe-t-il un texte de conditions validé par le client ?

---

## Plan de correction proposé

| Lot | Contenu | Dépend de |
|---|---|---|
| **1 — Intake & routage** | P0-1, P0-2, P0-3 (bootstrap taxonomie), P1-4, P1-5, P1-13, tests sur les payloads du PDF | — |
| **2 — Prod & sécurité** | P0-7 (garde-fous mock), P0-9 (suppression backdoor), P1-9, P2 sécurité, nettoyage legacy | Q4, Q5 pour l'activation |
| **3 — Wix contracteurs & invitations** | P0-6, P1-6, P1-7 (envoi groupé et programmé d'invitations, email et SMS de marque) | Q2, Q3 |
| **4 — Zone géographique** | P0-4, P0-5 | Q1, Q2 |
| **5 — Notifications explicites** | P1-8 (SMS/emails détaillés, HTML, STOP/HELP, heures calmes, journalisation), P1-1 | Q7 |
| **6 — Cycle du success fee** | P0-8 (scheduler), P1-2, P1-3, P1-12, alertes admin | Q6, Q8 |
| **7 — Refonte interface contracteur** | Mobile-first, lisibilité seniors, parcours en un geste | — |
| **8 — Go-live** | Docs à jour, checklist de déploiement Replit, QA de bout en bout, nettoyage des données QA en prod | tout |

### Contraintes d'environnement Replit à respecter
- Le build (`prisma generate && next build`) **n'exécute pas** de migration. Replit Publish synchronise le **schéma** de la base de dev vers la prod, mais **pas les données**. Donc :
  - tout changement de schéma doit rester **additif** et être appliqué d'abord sur la base de dev Replit (`prisma migrate dev` ou `db push` côté Replit) avant Publish ;
  - toute donnée de référence (taxonomie, réglages, paliers) doit être semée par un **bootstrap idempotent** applicatif, pas par du SQL de migration.
- Les secrets (Stripe, Twilio, Resend, Wix, `CRON_SECRET`) vivent dans les Secrets Replit ; `.replit` ne doit contenir que des valeurs non sensibles et **aucun flag mock en production**.
