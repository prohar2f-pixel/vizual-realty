# Admin content and featured properties

## Goal

Create a small protected `/admin` area where one customer can:

- select, order, and save one to three featured properties for the homepage;
- edit approved static text fields for the Home, About, Team, and Contacts pages;
- save content as a draft, preview it privately, publish it atomically, and restore the previous published version.

Property titles, prices, descriptions, photos, addresses, and other listing data remain owned by Topnlab.

## Delivery stages

The work is divided into independently testable stages:

1. Authentication and admin shell.
2. Featured-property management.
3. Structured content storage and public rendering.
4. Draft preview, publishing, and rollback.

Each completed stage must leave the public website functional and deployable.

## Authentication

The system has one administrator and no user-registration flow.

Server-only environment variables:

- `ADMIN_USERNAME`: exact login name;
- `ADMIN_PASSWORD_HASH`: scrypt password hash with salt, never a plaintext password;
- `ADMIN_SESSION_SECRET`: at least 32 random bytes encoded for storage;
- `ADMIN_SESSION_TTL_HOURS`: optional session lifetime, default 12 hours.

The login handler verifies the password with constant-time comparison and issues an encrypted, authenticated session cookie. The cookie is `HttpOnly`, `Secure` in production, `SameSite=Strict`, restricted to `/`, and expires with the server-side session timestamp. The payload contains only the administrator identity, issued-at time, expiry time, and a random nonce.

All `/admin/*` pages except `/admin/login` require a valid session. All admin mutation endpoints independently verify the session and reject cross-origin requests by checking `Origin` against the configured site origin. Login attempts use the existing rate-limit pattern and return one generic error for invalid credentials. Logout invalidates the browser cookie.

No secret, password, hash, session value, or production credential is written to source control, logs, page markup, or client JavaScript.

## Data model

### FeaturedProperty

- `propertyId String @id`: relation to `Property.id` with cascade deletion;
- `position Int @unique`: values 1, 2, or 3;
- `updatedAt DateTime @updatedAt`.

The public homepage reads featured properties ordered by `position`. It additionally requires `Property.isFeed = true`. If a property is deleted or hidden by Topnlab, it disappears from the public featured section without breaking the page.

The initial migration inserts the current three homepage properties, ordered by the existing `price desc` behavior. Before that initialization exists, the homepage retains the existing query as a compatibility fallback. After initialization, only the saved selection is shown, including when it contains fewer than three properties.

Saving a selection is transactional: validate one to three unique, visible property IDs; delete the previous selection; insert the new rows with positions 1–3. Invalid or hidden objects are rejected with a clear admin-facing error.

### SiteContent

One singleton row stores:

- `id String @id`, fixed value `site`;
- `draft Json`;
- `published Json`;
- `previousPublished Json?`;
- `draftUpdatedAt DateTime`;
- `publishedAt DateTime?`;
- `updatedAt DateTime @updatedAt`.

The JSON shape is versioned with `schemaVersion: 1`. Server-side validation parses every read and write. The structure contains only whitelisted plain-text fields grouped by page and section. Fields have explicit maximum lengths and required/optional rules. HTML, Markdown, scripts, URLs in ordinary text fields, arbitrary keys, and unbounded arrays are rejected.

On first migration, the current text constants from the four pages seed both `draft` and `published`, so deployment causes no visible copy change.

## Editable content scope

### Global header and footer

- public navigation labels for Home, Catalogue, About, Team, and Contacts;
- footer tagline, section headings, public address, phone, email, and copyright label;
- visible labels change without changing their fixed destinations or link behavior.

### Home

- hero heading and the two hero subtitle lines;
- featured-section heading and catalogue link label;
- Why Vizual heading, introduction, up to six benefit title/description pairs, and link label;
- `200+` panel eyebrow, value, and caption.

### About

- page heading and introductory paragraphs;
- section headings and paragraph copy;
- approved metric labels and values;
- call-to-action labels.

### Team

- page heading, introduction, and section copy;
- manager names, phones, email addresses, Telegram links, and photos remain code/data-managed in version 1 and are not free-form CMS fields.

### Contacts

- page heading, introduction, office address, public phone, public email, working-hours text, and form/helper labels that are currently static;
- manager contact records remain outside the CMS in version 1.

Legal/system error messages, catalogue filters, property data, SEO metadata, and object-page content are outside version 1 unless explicitly listed above.

## Admin screens

### `/admin/login`

A compact form contains login, password, submit action, and one generic error area. Successful login redirects to `/admin/featured`. An authenticated visit redirects to the same destination without showing the form.

### `/admin/featured`

The page shows:

- the saved one-to-three property cards in homepage order;
- Move up, Move down, and Remove actions;
- a search field matching property ID, title, address, or city;
- paginated matching visible properties;
- Add actions disabled when three are already selected;
- a Save button and unsaved-change warning.

Ordering uses buttons rather than drag-and-drop so it remains reliable on phones and keyboard accessible. Saving updates the public homepage immediately. This screen is independent from the content draft/publish workflow.

### `/admin/content`

The page has tabs for Home, About, Team, and Contacts. Each field has a human-readable label, current value, length limit, and validation error. The page provides:

- Save draft;
- Preview;
- discard unsaved browser edits by reloading the last saved draft;
- a warning before navigation when fields differ from the saved draft.

### `/admin/preview`

Preview renders the real public page components with draft content. It is available only to an authenticated administrator, sends `Cache-Control: private, no-store`, and cannot be indexed. A persistent admin bar identifies the page as a draft and provides Return to editing and Publish actions.

Publishing validates the complete draft and, in one transaction:

1. copies `published` to `previousPublished`;
2. copies `draft` to `published`;
3. updates `publishedAt`.

Rollback requires confirmation and swaps `published` with `previousPublished`, preserving the version being replaced so the action can be reversed once.

## Public rendering

Public pages load only validated `published` content. A shared server-side content loader:

- returns the database value when it is valid;
- falls back to version-controlled default content when the row is missing, the database read fails, or stored JSON fails validation;
- records a concise server-side error without logging content or secrets.

This fallback ensures that admin-data failure does not make public pages unavailable. Public pages never read `draft` unless they are rendered through the authenticated preview path.

## Validation and safety

- All mutations validate session, origin, payload shape, field lengths, and allowed keys.
- Plain-text rendering relies on React escaping; no `dangerouslySetInnerHTML` is introduced.
- Featured IDs must exist and be publicly visible.
- A transaction prevents partial featured selection or partial publication.
- Confirmations are required for Publish, Rollback, and Logout from unsaved forms.
- Admin pages and APIs set no-index and no-store headers.
- Error responses do not expose stack traces, database details, environment values, or credential validity.

## Error handling

- Invalid login: generic credential error, with rate limiting.
- Expired or invalid session: clear cookie and redirect to login.
- Validation failure: keep entered form values and show field-specific messages.
- Save conflict or database failure: keep the current published version unchanged and show a retryable error.
- Selected property becomes hidden before save: reject the save and identify the unavailable card.
- Selected property becomes hidden after save: omit it from the public homepage and mark it unavailable in admin.
- Invalid stored content: render version-controlled defaults publicly and show a repair warning in admin.

## Testing

Automated coverage includes:

- password-hash verification, encrypted cookie round trip, expiry, tampering, and missing secrets;
- route protection, generic login failure, rate limiting, logout, and origin validation;
- featured selection uniqueness, maximum of three, ordering, hidden-property rejection, transactional replacement, initialization fallback, and public query order;
- content schema acceptance/rejection, maximum lengths, unknown keys, and default fallback;
- draft saving without public changes;
- authenticated preview using draft content and public pages using published content;
- atomic publish and one-step rollback;
- server-rendered admin screens and public pages;
- full existing test suite, lint assessment, and production build.

Deployment verification covers login, logout, mobile layout, featured selection, ordering, draft persistence, private preview, publication, rollback, public cache behavior, and unchanged Topnlab synchronization.

## Deployment

Deployment requires a Prisma schema update and database migration before restarting the application. The administrator username, password hash, session secret, TTL, and canonical site origin are configured directly on the server without printing their values or committing them.

The release initializes content from current site copy and initializes featured properties from the current homepage selection. After verification, the customer receives the `/admin/login` URL and credentials through a private channel outside Git and this task transcript.

## Out of scope

- Multiple administrators, roles, registration, password reset, or email login;
- arbitrary HTML, Markdown, rich text, page-builder blocks, or layout editing;
- image uploads or media-library management;
- editing Topnlab property data;
- editing manager records in version 1;
- scheduled publication, more than one historical rollback version, or a full audit log;
- drag-and-drop ordering.
