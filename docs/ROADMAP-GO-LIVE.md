# Roadmap de mise en production — Landy's Pro

**Objectif :** production la semaine du 16 novembre 2026, avec un parcours complet qui fonctionne pour l'admin, les contracteurs et les propriétaires.
**Principe :** on ne bloque pas sur le client. Quand une décision est logique pour son business, on la prend, on la documente (section « Décisions prises pour le client ») et on l'explique au lancement. Seules les dépendances réellement externes (accès DNS, comptes Twilio et Stripe du client, réponses des devs landys.co) sont demandées, avec un plan B pour chacune.

---

## 1. Où on en est

| Domaine | État |
|---|---|
| Bloquants de l'audit (P0) et problèmes majeurs (P1) côté code | Corrigés sur `prod-readiness` (voir le statut dans l'audit) |
| Refonte de l'interface contracteur | Faite et vérifiée sur mobile |
| Tests automatisés | 249 tests verts, typecheck, lint et build de production OK |
| Outils de fiabilité et de recette (Lot A) | **Livrés** le 14 novembre sur `prod-readiness` (A1 à A11) |
| Test de bout en bout en dev (Replit) | **À exécuter** le 16 novembre : `pnpm --filter @workspace/landys-pro run e2e:smoke` |
| Activation des fournisseurs (email, SMS, paiement) | **Dépendances externes** : voir section 4 |

---

## 2. Planning

| Jour | Qui | Quoi | Résultat attendu |
|---|---|---|---|
| **Sam 14 – Dim 15** | TECHMA (dev) | Lot A : derniers outils de fiabilité et de test (section 3) | Branche prête, tout vert |
| **Lun 16 matin** | TECHMA | Envoyer l'email aux devs landys.co (section 5) ; lancer l'enregistrement SMS (Twilio) et la vérification du domaine email | Demandes parties le jour 1 (critiques pour le planning) |
| **Lun 16** | TECHMA | Déployer `prod-readiness` en **dev** sur Replit, migrer la base de dev, lancer `pnpm e2e:smoke` puis la recette manuelle (section 6) | Rapport PASS du test de bout en bout ; SMS et emails reçus sur nos téléphones |
| **Mar 17** | TECHMA + landys.co | Synchro contracteurs en dry-run avec la vraie API Wix ; 2 vraies demandes de test envoyées vers l'URL de dev ; corrections | Mapping Wix confirmé ; demandes routées aux bons contracteurs |
| **Mer 18** | TECHMA | Configuration production (secrets, cron, domaine email) ; Publish ; synchro contracteurs prod ; invitations programmées pour jeudi 9 h (heure du Texas) | Production en ligne, tableau de bord admin sans alerte rouge |
| **Jeu 19** | TECHMA | **Lancement** : invitations envoyées ; le formulaire landys.co alimente la prod ; surveillance (Messages, alertes admin) | Premiers leads reçus et acceptés |
| **Ven 20** | TECHMA | Suivi rapproché, corrections à chaud, point avec le client | Rapport de lancement au client |

---

## 3. Lot A — ce que TECHMA met en place maintenant (sans le client)

**Statut au 14 novembre : A1 à A11 livrés, testés (252 tests, typecheck, lint, build de production) et poussés sur `prod-readiness`.**

| # | Livrable | Pourquoi |
|---|---|---|
| A1 | **Test de bout en bout automatisé** (`pnpm e2e:smoke`) : demande Wix, routage, acceptation, email au propriétaire, relances, job gagné, payé, fee dû, lien de paiement, question au propriétaire. Il échoue clairement à la moindre étape cassée. | Prouver en dev que tout le parcours marche, en un seul geste, avant chaque mise en production |
| A2 | **Bouton admin « Envoyer un SMS / email de test »** vers n'importe quel numéro ou adresse | Valider Twilio et Resend en 10 secondes, en dev comme en prod |
| A3 | **Actions admin par job** : « Envoyer maintenant la question Did you get the job? », « Renvoyer le lien de paiement » | Recette sans attendre 3 à 14 jours ; support client après le lancement |
| A4 | **Mode « paiement en ligne pas encore activé »** : message clair au contracteur, l'admin enregistre les paiements reçus autrement | Lancer sans attendre le compte Stripe du client (les premiers fees ne tombent que 2 à 4 semaines après le lancement) |
| A5 | **Filet de sécurité du planificateur** : si le cron externe ne passe pas, les tâches se lancent lors des visites admin ou contracteur et à l'arrivée des leads | Aucune relance perdue si cron-job.org tombe ou est mal configuré |
| A6 | **Fusion de catégories** dans l'admin (ex. « Roofing & Gutters » fusionnée dans « Roofing ») ; les futures demandes sont redirigées automatiquement | Corriger nous-mêmes un écart de catégories entre le formulaire et le CMS landys.co, sans redéploiement |
| A7 | **Alertes d'erreurs serveur par email aux admins** (limitées en fréquence) + endpoint `/api/health` | Surveillance sans abonnement Sentry ; cron-job.org peut aussi surveiller la disponibilité |
| A8 | **Détection des données de test en production** dans le tableau de bord admin | Ne jamais envoyer un vrai lead à un contracteur de test |
| A9 | **Consentement SMS** affiché (acceptation, invitation, compte) et texte d'opt-in prêt pour le dossier Twilio | Conformité TCPA et A2P ; dossier d'enregistrement plus rapide à valider |
| A10 | **Pages de connexion lisibles** (Clerk) : grosses polices, gros boutons | Même public senior que le reste de l'interface |
| A11 | **Nettoyage** : documents obsolètes marqués, version Node alignée sur Replit | Éviter qu'un prochain intervenant suive une ancienne procédure |

---

## 4. Dépendances externes et plan B

| Dépendance | Propriétaire | Demande le | Délai habituel | Plan B si ce n'est pas prêt jeudi |
|---|---|---|---|---|
| **Domaine email vérifié** (enregistrements DNS sur landys.co, gérés sur Wix) | Devs landys.co | Lun 16 | Moins d'une heure une fois les DNS ajoutés | Faire vérifier un sous-domaine (`mail.landys.co`) ; en dernier recours, acheter un domaine dédié (~12 $/an, accord du client sur le nom). **Sans domaine vérifié, aucun email ne part : c'est le chemin critique.** |
| **Twilio de production + enregistrement A2P 10DLC** | Client (compte) / TECHMA (dossier) | Lun 16 | 3 à 15 jours ouvrés selon les opérateurs | Lancer avec **l'email seul** : les SMS s'activent dès que les identifiants sont posés dans les Secrets, sans redéploiement ; les échecs SMS n'empêchent jamais l'email. Option plus rapide : un numéro toll-free avec « Toll-Free Verification ». |
| **Compte Stripe du client** (connecteur Replit en live) | Client | Lun 16 | Quelques minutes une fois l'accès donné | Lot A4 : paiements enregistrés à la main par l'admin, message clair au contracteur. Aucun fee n'est dû avant plusieurs semaines. |
| **Confirmation de la liste de catégories** (formulaire = CMS) | Devs landys.co | Lun 16 | 1 à 2 jours | Rapprochement automatique déjà en place + fusion de catégories (A6) |
| **ZIP et comtés de service remplis dans le CMS** | Devs landys.co / client | Lun 16 | Variable | Contracteurs sans zone utilisés en secours ; l'admin peut saisir les zones ; alerte dans le tableau de bord |
| **Relecture juridique de `/terms`** | Client | Après le lancement | — | Texte clair et versionné déjà en ligne ; chaque acceptation enregistre la version et le taux affichés |

---

## 5. Email à envoyer aux développeurs landys.co (lundi matin)

> **Subject:** Landy's Pro launch next week — 4 quick items from your side
>
> Hi team,
>
> Thanks for the Payload Reference Guide — both payloads now work end to end on our side. We plan to go live on Thursday, November 19. Could you help with these four items by Tuesday?
>
> 1. **Email DNS records.** We will send you 3–4 DNS records (SPF/DKIM) for `mail.landys.co` so job emails come from Landy's. Could you add them in the Wix DNS settings when you receive them?
> 2. **Category list.** Does the "Get Three Estimates" form use exactly the same category list as the CMS field "Contractors Category"? If not, please send us both lists.
> 3. **Service area.** Please make sure active contractors have "Service Zip Codes" (and/or "Service Counties" with the state, e.g. "Sabine County, TX") filled in, and tell us which values the "Status" field can take.
> 4. **Test requests.** On Tuesday, could you send two test requests (one general, one direct) to our test URL `https://<dev-url>/api/integrations/wix/estimate-requests` with the same secret? We will share the URL Monday.
>
> If your pro sign-up form has no SMS consent line yet, we suggest adding: "I agree to receive job requests and updates from Landy's by text message. Message and data rates may apply. Reply STOP to opt out."
>
> The full technical notes are attached (LANDYS-CO-INTEGRATION-NOTES.md). Thanks!

---

## 6. Recette en dev (lundi 16)

1. Déployer `prod-readiness` dans l'environnement de dev Replit ; `prisma migrate deploy` (ou `db push`) sur la base de dev.
2. Mettre dans les Secrets de dev : `DEVELOPMENT_NOTIFICATION_EMAIL`, l'adresse du compte Resend natif (seule adresse livrée sans domaine vérifié), et `DEVELOPMENT_NOTIFICATION_PHONE`, un numéro vérifié dans le compte Twilio de test. **En dev, tous les SMS et emails sont redirigés vers ces deux destinataires.**
3. Admin → Settings → « Send a test message » : un SMS et un email reçus.
4. `pnpm --filter @workspace/landys-pro run e2e:smoke` : le rapport doit être 100 % PASS, et le téléphone de test reçoit toute la séquence.
5. Recette manuelle à 2 personnes, avec la checklist de `docs/GO-LIVE-CHECKLIST.md` §10 (admin + contracteur sur téléphone).
6. Corrections → nouveau passage de `e2e:smoke` → feu vert pour mercredi.

---

## 7. Critères de « Go » pour mercredi

- [ ] `e2e:smoke` 100 % PASS en dev.
- [ ] Recette manuelle signée (admin, contracteur, propriétaire).
- [ ] Synchro Wix en dry-run : noms, emails et zones correctement lus sur 5 contracteurs pris au hasard.
- [ ] Domaine email vérifié (ou plan B validé).
- [ ] Cron-job.org actif ; « Scheduler last ran » se met à jour toutes les 10 minutes.
- [ ] Tableau de bord admin de production : aucune alerte rouge, sauf « SMS pas encore activés » si le plan B Twilio est retenu.

---

## 8. Décisions prises pour le client (à lui présenter au lancement)

| Décision | Raison business |
|---|---|
| Un lead part aux contracteurs à moins de **50 miles** (réglable) ou dans leurs comtés | Des contracteurs ruraux couvrent de grandes zones ; au-delà, ils ignorent le lead et finissent par se désinscrire |
| Les contracteurs sans zone ne reçoivent un lead **qu'en secours** | Aucun lead perdu, sans spammer tout le Texas |
| Le budget est **informatif**, jamais bloquant | Un lead non distribué, c'est zéro revenu ; le fee dépend du prix final, pas du budget annoncé |
| **3 premiers** contracteurs qui acceptent (1 pour une demande directe), expiration à **48 h** | Le principe « Get Three Estimates » de landys.co ; de l'urgence sans saturer le propriétaire |
| Relances : J+3 « Did you get the job? », jusqu'à 3 rappels, puis alerte admin | Le revenu dépend de la déclaration du contracteur ; on la sécurise sans harceler |
| Rappels de fee à J+3, J+7 et J+14, puis alerte « en retard » à J+21 | Encaisser sans relance manuelle |
| Question au propriétaire « Avez-vous embauché ? » à **J+14** | Contrôle indépendant des déclarations des contracteurs (protection du revenu) |
| SMS seulement entre **8 h et 21 h**, heure locale | Bonnes pratiques TCPA ; public âgé |
| Taux par défaut 5 % / 4 % / 3 % (seuils 10 k$ et 25 k$), modifiables dans l'admin | Valeurs déjà posées dans l'admin ; le client peut les changer à tout moment |
| Formulaire public `/estimate` désactivé | landys.co est la seule source ; évite le spam et des SMS payants |
| Lancement possible **avec l'email seul**, puis SMS dès l'approbation Twilio ; paiements en ligne activés dès l'accès Stripe | Ne pas retarder le lancement pour des délais d'opérateurs |
