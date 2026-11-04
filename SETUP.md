# Project setup decisions

## Current simplified workflow — 2 November 2026

The user's spreadsheet workflow supersedes the earlier multi-page planning and
production flows described below. Use Client → Social account → Posts sheet.
Client name is entered directly; optional email/password login is created in the
same form. Social account setup needs only platform and handle. Other settings
are optional. A post is created directly under its account, without an idea.

Reels: content/script review → Client footage sent → Agency receives clips and
starts editing → final review → Ready → manual publication. Carousel, Single
image and Story use content review → design → final review → Ready → publication.
Both approvals are Client-authored, exact-version decisions. Sending final review
also confirms the Agency quality check; the sheet has no separate QA form.
Missing clips and changes loop back within the same row. References stay in
WhatsApp or external previews; no files are uploaded or auto-published.

The new /posts page offers inline title/date/format edits, a side panel for copy,
caption, references, optional notes and reviews, and a Calendar view of the same
rows. Legacy content/production/calendar URLs redirect to Posts. Agency landing
is Clients; Client landing is /my-accounts, showing social account cards directly.
The Client sidebar says My social accounts and account search uses /my-accounts.
Client visits to /clients and /clients/[id] redirect to /my-accounts; Agency still
uses /clients for Client management. Card links open the account's posts sheet. Agency overview totals
and Client management remain unchanged. Account data uses the existing server-scoped
planning options endpoint; Client search matches handles and platform names.

Migration 202611020004_post_sheets adds nullable ideaId and publication metadata
with PUBLISHED stage. New /api/posts routes/controllers enforce mapping, roles,
active accounts, current versions, content/footage/final gates and immutable
published rows. Initial drafts are private. Review submission shares undated posts
too; schedule selection is optional while planning.

Live verification covered all four formats, both approvals, publication, missing
clips, revisions/stale edits, combined Client/login creation, privacy, filters and
pagination. Temporary identities and records were removed. Use builds and focused
manual checks only; do not recreate test suites or browser tooling. Browser/mobile
visual acceptance is pending. README.md describes the current user-facing flow.

Published-post performance: migration 202611020005_post_engagement adds nullable
unsigned integer Likes/Comments/Views and metricsUpdatedAt. Agency can use Add/Update
performance in the post panel or edit the three sheet columns after publication.
Clients read their own recorded counts without edit controls. The dedicated
PATCH /api/posts/:id/metrics route requires Agency access, PUBLISHED state and
current updatedAt; it accepts nonnegative whole counts or null, records actor/history,
and preserves content versions, publication data and approvals. Blank is unrecorded;
zero is a real value. There is no automatic social-platform metrics integration.

User-selected stack supersedes the earlier blueprint's suggested stack:

- Frontend: Next.js, React, JavaScript, Tailwind CSS in `frontend/`.
- Backend: Node.js and Express in `backend/`.
- Database: hosted MySQL accessed through Prisma.
- Authentication: Firebase Authentication with both email/password and Google.
- Authorization: AGENCY and CLIENT. All Agency users have full workspace access.
  Express checks active user status and limits Clients to their mapped organizations
  against application records in MySQL. Agency users need no client assignments.

## Configuration prepared

- `frontend/.env.local.example`: supplied Firebase Web App configuration.
- `backend/.env.example`: MySQL address and Firebase Admin credential path template.
- `.gitignore`: excludes local environment files and the documented credential filename.

The frontend and backend have been implemented and dependencies installed.
Authenticated MySQL and Firebase service account checks passed. The initial
Prisma migration was applied to the previously empty database. No database
password or Firebase Admin private key is stored in the example templates.

Intended first Agency user: Sagar Kumar (`agency@gmail.com`). This records
the bootstrap identity; the account has been provisioned in Firebase and MySQL.

The public password setup/reset page and its login link have been removed at the
user's request. The People & access page and general user-management endpoints
have also been removed. Create a Client login from its client profile using a
contact name, email and password, then manage enable/disable access there. Client
role and business access are assigned automatically by the server. Creating a
client business does not require creating a login. Current Agency login details
belong only in the ignored local credential file, never in frontend source code.

Client login routes are `POST /api/clients/:id/login` and
`PATCH /api/clients/:id/login/:userId`, both Agency-only. A Client cannot create
accounts, grant roles or change login access. No schema migration is required.

## Required local setup

1. In Firebase Console for `social-media-ff4bc`, open Authentication, then Sign-in
   method. Enable Email/Password and Google. Supply Google's requested project
   support email. Under Authentication settings, ensure `localhost` is an
   authorized domain for development.
2. In Firebase Project settings, open Service accounts, then Firebase Admin SDK.
   Generate a private key if you do not already have suitable server credentials.
   Save the JSON privately and set `GOOGLE_APPLICATION_CREDENTIALS` to its absolute
   file path. Do not paste the JSON into chat or put it in the frontend.
3. In Hostinger Remote MySQL, allow the public IP from which the Express backend
   will connect. Hostname: `srv1275.hstgr.io`; supplied server IP:
   `193.203.184.46`; expected remote port: `3306`.
4. Copy `backend/.env.example` to `backend/.env`. Replace the password placeholder
   with the current password, percent-encoding special characters for the URL.
   Confirm the hosting provider's connection encryption requirements before use.
5. Copy `frontend/.env.local.example` to `frontend/.env.local`.
6. The first Agency user's name and email have been provided and recorded in the local
   backend configuration. Authentication alone must not automatically grant a
   role or client access.

## Initial Agency setup

`backend/scripts/bootstrap-agency.js` is the only setup script. Run
`npm.cmd run bootstrap:agency` from the repository root when configuring a fresh
database. The configured Agency user already exists in the current database.
The optional bootstrap identity uses `BOOTSTRAP_AGENCY_NAME` and
`BOOTSTRAP_AGENCY_EMAIL` in the backend environment.

The two-role migration converts existing Admin and Team Member accounts to Agency.
It preserves Client portal mappings and archives previous internal roles and staff
assignments in activity history before removing the staff-assignment table.

The optional configuration, connection and provider check scripts were removed
at the user's request. Use `npm.cmd run build` for routine verification.

## First implementation milestone

Implemented: both applications, MySQL integration, Firebase ID-token verification
with revocation checks, Agency/Client access checks, client profiles, social
accounts, Client portal assignments, weekly posting targets and administrative audit events.

## Phase 2 implementation

Migration `202611020001_content_planning` adds ContentIdea, ContentItem and
CalendarNote, plus an optional ActivityEvent link to retain content date history.
Existing client/user records are preserved. Schema comparison against the hosted
database showed no differences after deployment.

Routes/controllers remain separate by resource: ideas, content, and planning
options/targets/notes. Creation, editing, repurposing, bulk scheduling and note
changes require Agency access. Client reads always combine their client mapping
with a shared scheduled status, including when query filters request private drafts.
New Client roles cannot be assigned as internal owners or contributors.

Partial updates remove creation defaults before parsing, so caption-only edits
preserve dates/status and status-only account edits preserve timezone. Bulk post
creation accepts up to 20 items with a 512 KB request limit; bulk shifts accept up
to 100 scheduled, non-cancelled posts and commit atomically. Date history remains
separate from current fields. Publish instants are stored in UTC and local dates
are converted using each account's IANA timezone, including daylight-saving changes.

Manual live verification covered four Instagram and three LinkedIn plans under
one idea, independent caption edits, stale-edit rejection, previous-date history,
slot warnings, repurposing, atomic rollback, large bulk requests, DST shifts,
weekly targets, private notes/drafts and Client write restrictions. Temporary
verification records were removed. No automated suites or browser tooling were added.

## Phase 3 implementation

Migration `202611020002_production_tracking` adds production fields, ContentRevision,
MediaHandoff and ProductionApproval. It preserves existing records and planning
labels, marks cancelled plans as cancelled production, applies Reel requirements,
and creates initial script/creative snapshots. Existing Approved planning labels
do not satisfy new version-specific production gates.

Production routes and controllers are separate from planning. `GET /api/production`
returns a paginated queue with stage, client, responsible-party and assignment
filters. `GET /api/production/:id` returns role-filtered details. Agency metadata
updates use `PATCH /api/production/:id`; stage actions use
`POST /api/production/:id/actions`. History and Agency-only revisions have separate
paginated endpoints. Metadata and action writes require the last `updatedAt`.

Reels use script review, client shooting, WhatsApp handoff, Agency verification,
production, internal QA and final review. Carousels skip client footage. LinkedIn
text skips visual production. Requirements can be adjusted only while planned or
drafting, with a recorded Agency reason. Current-version QA remains mandatory.

Agency users record external approval with the content version, source and
reference; the actual Agency actor is retained. This interim Phase 3 workflow
allows the recorded external decision to satisfy its approval gate. Phase 4 below
supersedes that interim final-release policy for new decisions.
Files stay in WhatsApp. Metadata is a locator, not an upload or proof of receipt.
Only Agency verification of the latest report unlocks editing. Missing footage
returns the item to Client input and retains earlier reports and history.

Clients may schedule/complete shoots and report footage only for their own shared
scheduled content. They cannot verify footage, record Agency approval, change
requirements or read private production/QA/verification notes and revision/approval
ledgers. Client timelines include sanitized summaries with actor and timestamp.
Business/account/target details remain read-only. The sidebar exposes Production
for Agency users and My actions for Clients. Existing dashboard totals are preserved.

Script/copy/reference edits create immutable snapshots and invalidate affected
current-version approvals, footage or QA. Hold/resume rechecks gates. Cancellation
requires a reason; cancelled items remain Agency-readable and may be repurposed.
Responsive layouts are included. Browser/mobile visual acceptance is pending.

Verification: production build, backend syntax and Prisma schema validation passed.
Live authenticated API checks covered the format-specific workflows, footage
verification, reshoots, private-field filtering, foreign-client access, stale writes,
version snapshots and approval/QA invalidation. Temporary Firebase identities and
MySQL records were removed; recovery/status details are in ignored `.local/` files.

## Phase 4 implementation

Migration `202611020003_client_collaboration` adds immutable ApprovalRequest
snapshots, Client decision provenance/feedback/acknowledgment, ContentSuggestion,
an explicit external-final-release exception and a shared Client action deadline.
Existing pending reviews are backfilled as portal requests. Existing accounts,
content, historical decisions and Ready items are preserved.

`POST /api/approvals/:id/decision` is Client-only. The transaction checks business
mapping, shared content visibility, active account/client, request status, item
timestamp, current version, expected stage and all release gates. Changes require
feedback; approving a WhatsApp/external creative requires explicit acknowledgment.
Each request accepts one decision, including under concurrent submission. The
authenticated Client is the recorded actor; the body cannot supply identity/source.

Agency submission captures title, copy, caption, creative reference, summary,
review location, preview URL and optional public deadline. Preview URLs accept
only HTTP/HTTPS. Material edits supersede affected pending requests and retain
old snapshots/decisions. Paused and cancelled work cannot accept Client decisions.
Closed requests and attributed Client feedback are visible in review history.
Internal notes, QA notes, verification notes and private external-decision
references remain excluded from Client responses.

Final approvals default to Client portal decisions. Agency can record external
confirmation without releasing the item. To allow external release for one item,
enable its workflow exception while planned/drafting and record a reason. That
decision remains explicitly RECORDED_BY_AGENCY; Client actions are CLIENT_PORTAL.
QA and footage checks still apply to all releases.

Client dashboards now show Needs your action and upcoming posts across their
shared accounts, retaining existing business totals and setup board. My actions
links to the exact review and shooting controls. My suggestions and Agency Client
suggestions use separate routes/controllers: `GET/POST /api/suggestions`, with
Agency-only `PATCH /api/suggestions/:id` for a shared reply. Clients can submit only
for mapped active businesses and read only their own mapped submissions.

Live API verification passed for Client approvals/changes, immutable versions,
duplicate concurrent decisions, stale requests, private fields, cross-client URLs,
shoot updates, current QA/release gates, external-policy fallback and suggestions.
Temporary identities and data were removed. No test pages or test tooling were
added. Mobile/browser visual verification remains pending.

Firebase provider configuration was read back and confirmed: email/password enabled,
Google enabled, and localhost authorized. See README.md for startup and build commands.

Automated test suites, helpers and browser tooling were removed at the user's
request. Do not recreate them unless requested; use builds and focused manual
checks for subsequent changes.

UI redesigns should preserve each page's existing information and behavior unless
the user explicitly asks to change them. The Agency dashboard retains its four
workspace totals, overview content and setup checklist with the updated visual styling.

The Client portal review preserves Phase 1 scope: business/account information and
weekly targets are read-only; only the user's own display name can be edited.
Client-facing copy uses business terminology and directs setup changes to the agency.
List/detail failures clear stale records, with retry and filter recovery controls.
Authentication failures clear the loaded profile, and requests from a previous
sign-in cannot replace a newer account's profile. `ACCOUNT_ACCESS_DENIED` identifies
disabled or unprovisioned application access separately from an Agency-only action.
Client totals exclude inactive social accounts and archived businesses; archived
business details remain readable only by their mapped users.

The hosted MariaDB server rejects LIKE search comparisons under the driver's binary
prepared-statement protocol with error 1267 (mixed collations). The connection uses
UTF8MB4_UNICODE_CI and the Prisma MariaDB adapter's parameterized text protocol;
values are still passed through the driver's escaping API. Keep Client scope filters
on the database query when changing search behavior.

On this Windows environment use `npm.cmd` for npm commands because PowerShell
blocks the npm PowerShell wrapper. Installed versions observed during setup:
Node.js 22.20.0 and npm 11.6.1. Dependency compatibility must be checked when
selecting package versions.

## Reference instructions

### Hosted database connection limits

The API uses a lazy pool of at most two reusable MySQL connections. It does not
open replacement connections solely to maintain an idle minimum. The driver pauses
remote connection attempts for 60 seconds after MySQL reports account resource
error 1226. The API returns HTTP 503 with a safe error code and Retry-After, and
the login screen respects that delay instead of treating the outage as denied access.

The current Hostinger database rejected sign-in lookups with
`max_connections_per_hour` (limit 500). Application changes reduce connection
pressure but cannot reset a hosting-enforced hourly counter. If it remains blocked,
wait for the provider's counter to reset or contact Hostinger support. Stopping an
application process does not itself reset an hourly connection counter. Check the
live Agency login after the provider allows a new database connection.

- Firebase Admin setup: https://firebase.google.com/docs/admin/setup
- Firebase sign-in methods: https://firebase.google.com/docs/auth/web/start
- Hostinger Remote MySQL: https://www.hostinger.com/support/1583546-how-to-set-up-remote-mysql-access-in-hostinger/
- Prisma connection URL encoding: https://docs.prisma.io/docs/orm/v7/reference/connection-urls
