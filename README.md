# Social Media Operations System

A simple agency workspace: **Client ? Social account ? Posts sheet**.
Files and conversations stay in WhatsApp. Publishing is manual.

## Current workflow

1. Create a Client by name. Optionally create their email/password login in the same form.
2. Add the Client's social account: platform and handle. Timezone defaults to the Client's.
3. Open the account's **Posts sheet** and add a row. Choose Reel, Carousel, Single image or Story.
4. Write the content in the side panel and send it for Client approval.
5. Client approves or requests changes against the exact content version.
6. Reels wait for footage. Client records/sends clips through WhatsApp and marks footage sent.
   Agency checks the clips and uses **Receive clips & start editing**. Missing clips can be
   requested with feedback from the same panel.
7. Agency edits/designs the creative, adds a WhatsApp reference or preview link and sends
   the final version for approval. This submission confirms the Agency's quality check.
8. Client reviews the identified creative and caption, then approves or requests changes.
9. Agency publishes manually and selects **Mark published**, recording actual time and an
   optional post URL.
10. Agency selects **Add performance** to enter Likes, Comments and Views, or edits those
    columns directly in the published row. Clients can view their own recorded counts.

All four formats require content approval and final approval. Carousels, single images and
image stories skip shooting and go directly from approved content to design. Video-story
material can be described in the content/reference fields; a separate video-story workflow
is not included.

There are no mandatory idea, owner-selection, shoot-scheduling, footage-metadata or internal-QA
forms in the sheet workflow. Agency ownership is assigned automatically. Weekly targets and
Client login management are optional settings. Initial drafts remain Agency-only. Sending a
review shares the post, including when its publish date has not been chosen.

## Interface

- **Clients (Agency):** create Clients and optional logins, add social accounts, then open a sheet.
- **My social accounts (Client):** `/my-accounts` shows social account cards directly; each opens its own posts sheet. Client login, sidebar and account search use this route.
- **Posts:** filter by Client/account, format and stage; search; edit titles/dates in cells.
- Use **Open content & feedback** to open the post side panel. Titles, dates and
  performance counts remain editable in their cells. Rows have no drawer click action.
- **Post side panel:** content, caption, references, optional internal notes, review actions,
  feedback/history and publication details.
- **Calendar:** another view of the same dated rows, available inside Posts.
- **Overview:** the Agency's original four totals and checklist are retained.
- **My account:** profile and sign-out.

Agency users have full workspace access. Client users see only mapped accounts and shared
posts; they approve/request changes and report footage sent. Clients cannot edit Agency
content, verify footage or record publication. Internal notes, assignments, private verification
notes and private Agency approval references are excluded from Client responses.

Material changes invalidate the affected approvals and supersede pending requests. Old decisions
and revision records are preserved. Decisions require a current version and timestamp; stale
or duplicate submissions are rejected. Published and cancelled content is read-only.
Agency can update performance counts after publication without changing content or approvals.
Blank counts mean unrecorded; zero is an explicitly recorded value. Counts are entered manually.

## Pages and API

| Page | URL |
| --- | --- |
| Login | /login |
| Clients and accounts | /clients, /clients/[id] |
| My social accounts (Client) | /my-accounts |
| Posts sheet | /posts?clientId=...&socialAccountId=... |
| Calendar view | /posts?view=calendar |
| Open a post panel | /posts?postId=... |
| Agency overview | /agency/dashboard |
| My account | /account |

The old /content, /production, /production/[id] and /calendar URLs redirect into Posts.
Client dashboard links lead to /my-accounts. Client visits to legacy /clients and
/clients/[id] links redirect there; Agency Client management stays under /clients.
Existing suggestions remain accessible at /suggestions
but are not a mandatory step or primary navigation item.

Routes and controllers remain separate:
- GET/POST /api/posts ? scoped, paginated sheet and direct post creation.
- GET/PATCH /api/posts/:id ? role-filtered details and Agency content changes.
- POST /api/posts/:id/actions ? content review, footage sent/receipt, missing clips,
  final review, manual publication and cancellation.
- GET /api/posts/:id/history — scoped history.
- PATCH /api/posts/:id/metrics — Agency-only, published-post Likes/Comments/Views updates.
- POST /api/approvals/:id/decision ? authenticated Client decisions.
- POST /api/clients ? optional nested login creates Firebase identity and Client mapping
  with rollback cleanup on failure.

## Run locally

Next.js/React/JavaScript/Tailwind frontend, separate Express API, hosted MySQL with Prisma,
and Firebase Authentication. Node.js 22.12 or newer is required.

~~~powershell
npm.cmd ci
npm.cmd run db:generate
npm.cmd run db:deploy
npm.cmd run dev
~~~

Frontend: http://localhost:3000. API: http://127.0.0.1:4000/api/health.
On shells without the Windows PowerShell npm-wrapper restriction, npm works instead of npm.cmd.

Private settings belong in backend/.env and frontend/.env.local. Firebase Admin credentials
are backend-only. The Agency account is agency@gmail.com; its existing password is saved
privately under ignored .local/. Public password-reset and People & access pages remain removed.

Migration 202611020004_post_sheets makes ideaId optional, adds publication records and the
Published stage. Older migrations and APIs remain for compatibility; the new interface uses
direct account posts and sheet actions.

## Verification

~~~powershell
npm.cmd run build
~~~

Use builds and focused manual checks. Automated test suites and browser tooling were removed
at the user's request; no test pages or frameworks were added.

Live authenticated API verification passed for direct Client/login creation; direct posts
without ideas/dates; all four formats through both approvals and manual publication; changes
and missing footage; stale versions; Client privacy/scope; filters, pagination and calendar
queries. Temporary identities and records were removed. Browser/mobile visual verification
remains pending.

This workspace runs locally and has not been deployed. Hosting, reports, proactive alerts
and social publishing integrations are separate work.
