# Dossier d'enregistrement SMS (Twilio A2P 10DLC / Toll-Free)

Textes prêts à copier dans la console Twilio. Les champs à fournir par le client sont marqués **[CLIENT]**.

## Choix recommandé

- **Option rapide :** un numéro **toll-free** (8XX) avec *Toll-Free Verification*. Formulaire plus court, validation en général en quelques jours ouvrés. Adapté au volume de lancement.
- **Option standard :** une marque et une campagne **A2P 10DLC** sur un numéro local du Texas. Nécessite l'EIN de la société et prend en général 1 à 3 semaines.

Les deux options peuvent être déposées en parallèle le lundi 16. On garde celle qui est validée en premier.

## Marque (Brand)

| Champ | Valeur |
|---|---|
| Legal company name | **[CLIENT]** raison sociale exacte |
| EIN / Tax ID | **[CLIENT]** (requis pour l'A2P standard, pas pour le toll-free) |
| Address | **[CLIENT]** |
| Website | https://www.landys.co |
| Vertical | Real Estate / Home Services |
| Contact | **[CLIENT]** nom, email, téléphone |

## Campagne / cas d'usage

**Use case :** Customer Care (ou « Mixed » : Account Notification + Customer Care)

**Campaign description :**
> Landy's (landys.co) connects homeowners who request an estimate with local contractors listed in the Landy's directory. Landy's Pro sends contractors text messages about new job requests in their service area, and follow-ups about jobs they accepted (whether they were hired, whether the homeowner has paid them, and the success fee they owe Landy's). Messages are transactional and only go to contractors who are listed on landys.co.

**Message flow / opt-in (comment les contracteurs consentent) :**
> Contractors join the Landy's directory on landys.co and provide their mobile number to receive job requests. They are told that Landy's sends job requests and job follow-ups by text message, that message and data rates may apply, and that they can reply STOP at any time. Every first message identifies "Landy's Pro" and includes "Reply STOP to opt out". The same consent is repeated in the account invitation email and on https://<domaine>/privacy. Opt-outs are honored automatically.

**URLs :**
- Privacy policy : `https://<domaine>/privacy`
- Terms : `https://<domaine>/terms`

**Volume estimé :** moins de 1 000 messages par jour au lancement.

## Messages d'exemple (identiques aux messages réels)

1. `Landy's Pro: New job request near Hemphill, TX. Roofing - New Build. Budget: Under $5,000. When: Within 2 weeks. Free to view. If you win, Landy's fee is 5% of the job, paid after you get paid. See details and accept: https://<domaine>/accept/XXXX Reply STOP to opt out.`
2. `Landy's Pro: Did you get the Roofing - Repair job in Jasper, TX (homeowner: Jordan Lee)? Tap to answer, it takes 10 seconds: https://<domaine>/follow-up/XXXX Reply STOP to opt out.`
3. `Landy's Pro: Has Jordan Lee paid you for the Roofing - Repair job in Jasper, TX? Tap "Yes" or "Not yet": https://<domaine>/follow-up/XXXX Reply STOP to opt out.`
4. `Landy's Pro: Your success fee for the Roofing - Repair job in Jasper, TX is due: $320.00 (4% of $8,000.00). Pay securely by card in 1 minute: https://<domaine>/follow-up/XXXX Reply STOP to opt out.`
5. `Landy's Pro: Hi Caddo Lake Forestry Co, Landy's (landys.co) sends you job requests from homeowners near you. Free to receive. Create your free account: https://<domaine>/sign-up Reply STOP to opt out.`

## Mots-clés et réponses automatiques

| Mot-clé | Réponse |
|---|---|
| STOP, UNSUBSCRIBE, CANCEL, END, QUIT | `Landy's Pro: You are unsubscribed and will not receive more texts. You will still get emails. Reply START to resubscribe.` |
| HELP, INFO | `Landy's Pro: job requests from homeowners on landys.co. Help: reply to any Landy's Pro email. Msg & data rates may apply. Reply STOP to opt out.` |
| START, YES | `Landy's Pro: You are subscribed again to job request texts. Reply STOP to opt out.` |

Twilio gère STOP, HELP et START automatiquement (« Advanced Opt-Out » sur le Messaging Service) ; coller les réponses ci-dessus dans ses réglages. Côté app, un numéro désinscrit est détecté (erreur 21610) : le contracteur est marqué « texts off » et continue de recevoir les emails.

## Après validation

1. Créer un **Messaging Service** qui contient le numéro.
2. Secrets Replit de production : `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`, puis `TWILIO_FROM` (le numéro, en secours).
3. Admin → Messages → « Send a test message » vers un mobile : le SMS doit être reçu.
