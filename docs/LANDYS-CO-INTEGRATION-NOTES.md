# Landy's Pro ↔ landys.co — integration notes

Thank you for the Payload Reference Guide. We tested both payloads end to end and adapted Landy's Pro to them. This note lists what we expect from landys.co and three points we need you to confirm.

## 1. Estimate requests (Get Three Estimates + Direct Estimate)

- **Endpoint:** `POST https://<landys-pro-domain>/api/integrations/wix/estimate-requests`
- **Headers:** `Content-Type: application/json` and `Authorization: Bearer <shared secret>`
- **Body:** exactly the two payloads in your guide (`source`, `externalRequestId`, contact fields, codes, `budget`, `timeline`, `urgency`, `description`, optional `attachments`, plus `externalContractorId` for direct requests).

Values we accept (codes or labels, case-insensitive):

| Field | Accepted |
|---|---|
| `budget` | `under-5k`, `5k-15k`, `15k-50k`, `50k-plus` (or labels like "Under $5K", "$50K+", or an exact amount like "$7,500") |
| `timeline` | `asap`, `within-2-weeks`, `within-1-month`, `1-3-months` / "1-3 months", `3-plus-months`, `just-researching` |
| `urgency` | `emergency`, `high`, `medium`, `low` |
| `propertyCounty` **or** `propertyZip` | at least one. The current form only asks for the county: send it as chosen ("Sabine County" or "Sabine County, TX"). Requests are then sent to contractors who list that county, have a service ZIP in it, or work within their radius of it |
| `contractorCategoryCode`, `projectTypeCode`, `landTypeCode` | any value from your site; new values are added automatically. `contractorCategoryCode` is optional: without it, the category is deduced from the project (Pond Building goes to Dirt Work & Excavation, Septic System Installation to Water Well & Septic, and so on) |

**Responses:**

| Status | Meaning | Retry? |
|---|---|---|
| `201` | Saved and sent to matching contractors | No |
| `202` | Saved; Landy's staff will route it manually | **No** — the request is safe |
| `409` | The same `externalRequestId` was already used with different content | No — use a new ID |
| `401` / `415` / `422` | Wrong secret, content type or payload | Fix, then send again |
| `5xx` or network error | Temporary | Yes, with the **same** `externalRequestId` (safe to repeat) |

Photos (`attachments`) are downloaded after we reply, so your request never waits on them. Keep the `downloadUrl` valid for at least one hour.

## 2. Contractor directory (All Contractors collection)

We read the collection through the Wix Data API (`POST /wix-data/v2/items/query`) every 6 hours and on demand. We use:

- `_id` (the contractor's permanent ID — please send this as `externalContractorId` in direct requests);
- company name, email, phone, website, descriptions;
- **Contractors Category** and **Secondary Categories**;
- **Service Zip Codes** and **Service Counties**;
- **Status** (`Active` = receives requests; any other value = paused on Landy's Pro).

## 3. Please confirm

1. **Same category list on both sides.** The "Get Three Estimates" form sends categories like `roofing` and `plumbing`. The example contractor in your guide is in "Land Lenders" and "Outdoor Renovation". A request only reaches contractors whose CMS category matches the form's category. Can you confirm the form's category menu uses exactly the same list as the CMS "Contractors Category" field?
2. **Service area filled in.** Requests go to contractors whose **Service Zip Codes** (within a 50-mile radius) or **Service Counties** cover the property ZIP. Contractors with neither only receive requests when nobody nearby covers them. Can you make sure these fields are filled for active contractors, and include the state for counties ("Sabine County, TX")?
3. **Status values.** Which values can the **Status** field take besides "Active"?

Thank you!
