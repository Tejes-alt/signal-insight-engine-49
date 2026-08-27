# Social Sentinel

You are a senior staff-level full-stack engineer, product designer, data engineer, ML engineer, security engineer, and DevOps architect.

Build SENTINEX as a production-grade full-stack social intelligence platform.

Do NOT build a mockup.
Do NOT build a static dashboard.
Do NOT use fake analytics when real connected data is available.
Do NOT create placeholder buttons that do nothing.
Do NOT leave routes disconnected.
Do NOT silently invent unsupported platform capabilities.

The result should feel like a serious intelligence product used by analysts, researchers, marketing teams, communications teams, executives, and organizations that monitor public conversation.

============================================================
1. PRODUCT VISION
============================================================

Product name:

SENTINEX

Tagline:

"Turn social noise into intelligence."

Core idea:

Users connect multiple social-media accounts/sources and SENTINEX continuously collects the data they are authorized to access, normalizes it into a unified event model, analyzes it, detects meaningful changes, and presents evidence-backed intelligence.

The system must answer:

- What is happening?
- What changed?
- Why does it matter?
- What are people talking about?
- What is gaining momentum?
- What is losing momentum?
- What is unusually abnormal?
- What content is driving engagement?
- How does sentiment differ across topics/platforms/time?
- Which accounts/content are driving the conversation?
- What should the analyst investigate next?
- What changed since the previous observation?
- What deserves attention right now?

============================================================
2. CRITICAL DATA PRINCIPLE
============================================================

Use official APIs and authorized integrations.

Never ask users for social-media passwords.

Never store raw passwords.

Never scrape websites when an official API/authenticated integration is available.

Use OAuth / OAuth 2.0 / PKCE / platform-specific authorization flows as required.

Users should connect accounts by clicking:

"Connect X"
"Connect YouTube"
"Connect TikTok"
"Connect Instagram"

Then authenticate through the platform.

The user should see exactly what permissions are being requested.

Store access/refresh tokens securely on the SERVER ONLY.

Encrypt sensitive credentials at rest.

Never expose provider secrets or access tokens to Next.js client code.

Build the architecture so additional providers can be added through adapters.

============================================================
3. PLATFORM INTEGRATIONS
============================================================

Implement a provider abstraction:

SocialProvider
ProviderAccount
ProviderToken
ProviderCapability
ProviderSyncJob
ProviderEvent

Start with:

1. X
2. YouTube
3. TikTok
4. Instagram / Meta where supported and authorized

The provider layer must be modular.

Example:

backend/providers/
    base.py
    x_provider.py
    youtube_provider.py
    tiktok_provider.py
    instagram_provider.py
    registry.py

Each provider must expose capability metadata.

Example:

{
  "profiles": true,
  "posts": true,
  "comments": true,
  "likes": true,
  "shares": true,
  "views": true,
  "followers": true,
  "mentions": true,
  "search": true,
  "historical": false,
  "webhooks": true
}

Do not assume all platforms expose all capabilities.

The UI must display:

Available
Unavailable
Requires authorization
Requires elevated permission
Not supported by provider

For example, X currently provides user-post timelines and mention timelines, while some private metrics require user-context authentication. :contentReference[oaicite:1]{index=1}

YouTube provides channel/video resources and supports push notifications for channel uploads and certain video metadata changes. :contentReference[oaicite:2]{index=2}

TikTok's Display API supports authorized user profile information and recently uploaded videos through the relevant approved scopes. :contentReference[oaicite:3]{index=3}

============================================================
4. ACCOUNT CONNECTION EXPERIENCE
============================================================

Create a world-class onboarding experience.

First screen:

"Connect your intelligence sources."

Show provider cards:

X
YouTube
TikTok
Instagram

Each card includes:

provider logo
connected account count
connection status
last sync
available capabilities
connect button
disconnect button
sync button

Allow multiple accounts per provider.

Example:

X
@account_one
@account_two
@company_account

YouTube
Channel A
Channel B

TikTok
Creator A
Creator B

Instagram
Business A
Creator B

Allow users to:

Connect account
Rename account
Pause sync
Resume sync
Force sync
Remove account
View permissions
View last sync
View data coverage

============================================================
5. USERNAME / ACCOUNT INPUT
============================================================

Support two modes.

Mode A:
"Connect Account"

Preferred mode.

User authenticates through official OAuth.

Mode B:
"Add public source"

Where legally/API-supported.

User enters:

username
handle
channel ID
profile URL
public source URL

Then SENTINEX resolves the identifier using the official API.

Never claim access to private information simply because a username was provided.

If an account cannot be accessed through a supported provider/API, explain why.

============================================================
6. REAL-TIME / CONTINUOUS COLLECTION
============================================================

Build a continuous synchronization system.

Do NOT simply fetch data once when the user opens the dashboard.

Each connected source gets:

last_synced_at
next_sync_at
sync_status
cursor
provider_rate_limit
records_collected
error_count

Use:

- Webhooks where supported
- Push notifications where supported
- Adaptive polling where webhooks are unavailable
- Incremental cursors / since IDs
- Backoff on rate limits
- Retry policies
- Deduplication
- Idempotent ingestion

Architecture:

Provider
    ↓
Webhook / Polling Scheduler
    ↓
Raw Event
    ↓
Normalizer
    ↓
Deduplication
    ↓
Database
    ↓
Analytics Queue
    ↓
Analytics Workers
    ↓
Materialized Intelligence
    ↓
WebSocket / SSE
    ↓
Next.js Dashboard

The dashboard should update without requiring a full-page refresh.

Use WebSockets or Server-Sent Events for live dashboard updates.

Display:

LIVE
LAST UPDATED 12 SEC AGO
SYNCING
3 NEW POSTS
NEW ANOMALY
TREND ACCELERATED

YouTube push notifications should be used where appropriate rather than wastefully polling for upload events. :contentReference[oaicite:4]{index=4}

============================================================
7. DATABASE
============================================================

Use PostgreSQL.

Use SQLAlchemy or SQLModel.

Use Alembic migrations.

Core tables:

users
organizations
memberships

social_accounts
provider_accounts
provider_tokens
provider_permissions
provider_sync_state

posts
comments
media
hashtags
mentions
entities

sentiment_results
topic_results
trend_snapshots
engagement_snapshots
anomaly_events

insights
reports
alerts
saved_queries

sync_jobs
webhook_events
audit_logs

Store provider IDs to guarantee deduplication.

Each social object should include:

provider
provider_object_id
account_id
created_at
updated_at
raw payload reference if retained
normalized content

============================================================
8. DATA NORMALIZATION
============================================================

Create one canonical internal schema.

Example:

Post:

{
  id,
  provider,
  provider_post_id,
  account_id,
  author_id,
  author_name,
  author_handle,
  text,
  language,
  location,
  timestamp,
  media_type,
  hashtags,
  mentions,
  likes,
  comments,
  shares,
  views,
  replies,
  permalink
}

Never force provider-specific metrics into fields that don't exist.

Use null when unavailable.

Track provenance.

Example:

engagement.views = null

engagement.views_source = "unsupported"

============================================================
9. ANALYTICS ENGINE
============================================================

Create a serious analytics layer.

Do not only calculate basic percentages.

Implement:

Sentiment analysis
Topic modeling
Keyword extraction
Hashtag analysis
Entity extraction
Trend detection
Velocity
Momentum
Acceleration
Engagement rate
Engagement velocity
Audience response
Conversation volume
Share of voice
Source/platform comparison
Account-level performance
Content-level performance
Anomaly detection
Change-point detection
Burst detection
Narrative clustering
Cross-platform topic correlation
Temporal analysis

============================================================
10. SENTIMENT INTELLIGENCE
============================================================

Show:

Overall sentiment

Positive
Neutral
Negative

But also:

sentiment by platform
sentiment by account
sentiment by topic
sentiment over time
sentiment volatility
sentiment acceleration
sentiment divergence
sentiment confidence

Example:

Sentiment
Positive 61.3%
Neutral 28.4%
Negative 10.3%

Then:

"Negative sentiment increased 18.4% over the last 6 hours."

Do not merely display statistics.
Explain the evidence behind changes.

============================================================
11. TOPIC INTELLIGENCE
============================================================

Build dynamic topic discovery.

Show:

Top topics
Emerging topics
Declining topics
Persistent topics
Exploding topics

For every topic:

volume
growth
velocity
sentiment
engagement
platform distribution
related keywords
related hashtags
top posts
top accounts

Provide an expandable topic intelligence view.

============================================================
12. TREND ENGINE
============================================================

The trend engine should be one of the strongest parts of the product.

Calculate:

mention growth
share growth
velocity
acceleration
moving average
baseline deviation
momentum score
confidence
cross-platform persistence

Example card:

EDUCATION

+214%
Momentum

██████████████████

Rising across:
X
YouTube
TikTok

Sentiment:
72% positive

Drivers:
AI
students
learning
skills

Then show:

"Why is this trending?"

with evidence.

============================================================
13. ANOMALY ENGINE
============================================================

Detect:

conversation spikes
conversation drops
engagement spikes
engagement collapse
sudden sentiment shifts
new keyword bursts
account behavior changes
unusual posting frequency
unusual cross-platform synchronization
topic emergence
topic disappearance

Each anomaly:

severity
confidence
metric
baseline
current value
delta
time
affected accounts
affected topics
evidence

Example:

HIGH

Unusual increase in "optimistic"

Baseline:
0.3 mentions/hour

Current:
19.0 mentions/hour

Deviation:
+6.8σ

Detected:
10:42 UTC

Then:

"Investigate"

============================================================
14. ENGAGEMENT INTELLIGENCE
============================================================

Go beyond raw likes.

Calculate:

engagement rate
engagement per post
engagement velocity
views-to-engagement ratio
comment-to-like ratio
share-to-view ratio
top content
top accounts
platform comparison
time-of-day effectiveness
content-type effectiveness

Show:

"Which content is actually driving attention?"

============================================================
15. ACCOUNT INTELLIGENCE
============================================================

Create account-level profiles.

For every connected account:

Followers
Following where available
Post frequency
Average engagement
Growth
Audience response
Sentiment
Top topics
Top content
Peak posting times
Trend participation
Anomaly history

Show:

Account Health Score

Conversation Influence
Engagement Quality
Audience Sentiment
Topic Authority
Momentum

Use explainable scoring.

============================================================
16. CROSS-PLATFORM INTELLIGENCE
============================================================

This should be a signature feature.

Show one topic across multiple platforms.

Example:

"Generative AI in Education"

X:
+81%

YouTube:
+42%

TikTok:
+117%

Instagram:
+64%

Then show:

Cross-platform momentum:
HIGH

Shared narrative:
"AI-assisted learning"

Platform-specific differences:

X:
policy discussion

YouTube:
tutorial discussion

TikTok:
creator/student discussion

Instagram:
visual education content

============================================================
17. COMMAND CENTER
============================================================

Create a powerful Command Center.

User types:

"show me negative sentiment"
"what changed today?"
"what is trending?"
"find anomalies"
"why is education rising?"
"compare X and YouTube"
"show top performing posts"
"generate executive report"

Do not make this a fake chatbot.

Translate natural-language commands into structured actions.

Example:

User:
"What is driving the latest spike?"

System:

Intent:
anomaly_investigation

Time:
last 6 hours

Target:
conversation_volume

Then return evidence.

============================================================
18. AI ANALYST
============================================================

AI is an interpretation layer, not the source of truth.

Give the AI:

structured analytics
ranked evidence
relevant source posts
trend calculations
anomaly calculations
topic summaries

Do not dump unlimited raw data.

AI must:

cite evidence IDs
distinguish observation from interpretation
state uncertainty
avoid fabricated causes
never invent data

Example:

"Conversation volume increased 41%.

Evidence:
17 posts in the last hour versus
12.1 hourly baseline.

The increase is concentrated around
the 'AI education' topic."

Then:

"Possible interpretation:
increased attention around educational AI tools.

Confidence:
0.78"

============================================================
19. REPORTING
============================================================

Build serious report generation.

Report formats:

Dashboard summary
Analyst brief
Executive report
PDF
CSV
JSON

Report sections:

Executive summary
Key changes
Sentiment
Topics
Trends
Engagement
Anomalies
Top content
Account influence
Cross-platform comparison
Evidence
Methodology
Limitations

Allow:

Generate report
Schedule report
Download report
Share report
Duplicate report

============================================================
20. ALERT SYSTEM
============================================================

Users can create alerts.

Examples:

Alert when negative sentiment > 25%

Alert when topic momentum > 80

Alert when conversation volume increases > 50%

Alert when anomaly severity = HIGH

Alert when account engagement falls > 30%

Alert when keyword appears unusually frequently

Allow:

email
in-app
webhook
browser notification

Provide alert history.

============================================================
21. DASHBOARD DESIGN
============================================================

The UI should be extremely polished.

Visual direction:

dark
premium
technical
editorial
minimal
high-information-density
subtle cyan/blue accents
soft glass surfaces
precise borders
excellent typography
smooth motion
no cheesy gradients
no generic SaaS cards

Think:

Bloomberg Terminal
Palantir
Linear
Arc
Apple Pro applications
high-end intelligence systems

But create an original visual identity.

Avoid copying any company's interface.

============================================================
22. LANDING PAGE
============================================================

Hero:

"Turn social noise
into intelligence."

Subtitle:

"Understand what people are saying,
why it matters,
and what deserves attention."

Primary:

Launch Intelligence

Secondary:

Explore the demo

Hero visualization:

Live conversation intelligence map

Show nodes:

AI
TECH
JOBS
EDUCATION
POLICY

Animated radar-like intelligence visualization.

Do not make hero metrics claim to be live unless they are actually connected.

============================================================
23. APP NAVIGATION
============================================================

Sidebar:

Overview
Analyze
Sentiment
Topics
Trends
Engagement
Anomalies
Accounts
Command Center
AI Analyst
Reports

System:

Providers
Alerts
Settings

Top bar:

Search
Live status
Sync status
Notifications
User menu

============================================================
24. DASHBOARD OVERVIEW
============================================================

Build a genuinely useful command dashboard.

Top:

LIVE INTELLIGENCE

Last sync:
12 seconds ago

Then KPI strip:

Conversation volume
Sentiment
Momentum
Engagement
Active anomalies

Main sections:

What's happening
What's changing
What's trending
What needs attention

Include:

Live timeline
Trend graph
Sentiment graph
Topic clusters
Anomaly stream
Top accounts
Top posts

============================================================
25. VISUALIZATIONS
============================================================

Use excellent charts.

Implement:

Area charts
Line charts
Stacked areas
Horizontal ranking charts
Heatmaps
Sparklines
Topic bubbles
Network graphs
Timeline markers
Radar visualizations
Anomaly bands

Charts must have:

tooltips
hover states
date ranges
zoom where useful
platform filters
account filters
topic filters

No decorative charts with meaningless numbers.

============================================================
26. FILTER SYSTEM
============================================================

Global filters:

Date range
Platform
Account
Language
Location
Topic
Sentiment
Content type

Filters should persist across relevant dashboard pages.

Example:

User selects:

Last 24 hours
X + TikTok
AI topic
Negative sentiment

Then the views update consistently.

============================================================
27. LIVE DATA UX
============================================================

At the top of dashboards:

● LIVE
Last synchronized 9 seconds ago

If new events arrive:

+7 new conversations

Show subtle notification.

Allow:

Pause live updates
Resume live updates

Do not violently re-render the entire UI.

Use incremental updates.

============================================================
28. LOADING UX
============================================================

No blank screens.

Use elegant skeleton states.

Example:

Analyzing conversation graph...
Synchronizing X...
Waiting for YouTube...
Computing trend momentum...

============================================================
29. ERROR UX
============================================================

Every API error should be understandable.

Bad:

"Failed to fetch"

Good:

"X connection expired.
Reconnect the account to resume synchronization."

Include:

Retry
Reconnect
View details

============================================================
30. BACKEND ARCHITECTURE
============================================================

Use FastAPI.

Recommended:

backend/
    app/
        main.py
        auth.py
        accounts.py
        providers.py
        analytics.py
        reports.py
        alerts.py
        command.py
        webhooks.py
    analytics/
        sentiment.py
        topics.py
        trends.py
        engagement.py
        anomalies.py
        entities.py
        influence.py
    providers/
        base.py
        x.py
        youtube.py
        tiktok.py
        instagram.py
        registry.py
    services/
        ingestion.py
        normalization.py
        deduplication.py
        sync.py
        intelligence.py
        ai.py
        reports.py
    db/
        models.py
        session.py
        migrations/
    workers/
        sync_worker.py
        analytics_worker.py
    tests/

============================================================
31. FRONTEND ARCHITECTURE
============================================================

Use:

Next.js App Router
TypeScript
Tailwind CSS
Framer Motion
Lucide
Recharts or another high-quality chart library

Structure:

frontend/
    app/
        page.tsx
        dashboard/
        analyze/
        sentiment/
        topics/
        trends/
        engagement/
        anomalies/
        accounts/
        command/
        ai-analyst/
        reports/
        providers/
        alerts/
        settings/
    components/
        navigation/
        charts/
        intelligence/
        accounts/
        providers/
        reports/
        command/
    lib/
        api.ts
        auth.ts
        realtime.ts
        providers.ts
        analytics.ts
        reports.ts
    hooks/
    types/

============================================================
32. AUTHENTICATION
============================================================

Implement user authentication.

Support:

email/password
OAuth providers where practical

Secure sessions.

Use:

HTTP-only cookies
CSRF protection as appropriate
secure session rotation
token revocation
rate limiting
audit logging

Do not store auth tokens in localStorage.

============================================================
33. ORGANIZATIONS / MULTI-USER
============================================================

Structure the application for organizations.

Organization
Member
Role

Roles:

Owner
Admin
Analyst
Viewer

Permissions:

Connect providers
Remove providers
View data
Generate reports
Create alerts
Manage members
Manage settings

============================================================
34. SECURITY
============================================================

Implement:

CORS
security headers
request limits
rate limits
input validation
SQL injection protection
token encryption
secret isolation
audit logs
provider permission boundaries
webhook signature validation
OAuth state validation
PKCE where required

Never log:

access tokens
refresh tokens
API keys
passwords
session cookies

============================================================
35. PRIVACY / DATA RETENTION
============================================================

Add configurable retention.

Example:

7 days
30 days
90 days
1 year
indefinite

Allow organizations to delete collected data.

Support:

Delete account
Disconnect provider
Delete provider data
Export user data

Show exactly what data is retained.

============================================================
36. BACKGROUND JOBS
============================================================

Use a job queue.

Examples:

Redis + Celery
or
Redis + RQ
or
another robust queue architecture.

Jobs:

provider sync
data normalization
analytics processing
report generation
alert evaluation
AI generation

Track:

queued
running
completed
failed
retrying

============================================================
37. OBSERVABILITY
============================================================

Add:

structured logs
health endpoint
readiness endpoint
metrics
provider latency
sync latency
job failures
API latency

Create:

/health
/ready
/metrics

============================================================
38. TESTING
============================================================

Write tests for:

authentication
provider OAuth
provider normalization
deduplication
sync
analytics
routes
permissions
reports
alerts
AI service
webhooks

Frontend:

route tests
component tests
critical interaction tests

E2E:

connect provider
sync data
view dashboard
filter data
generate report
create alert
disconnect provider

============================================================
39. DEMO MODE
============================================================

Keep a full demo mode.

Demo mode must be explicitly labeled.

Use deterministic synthetic data.

Do not mix fake demo data with live provider data.

Allow:

"Use demo workspace"

The demo should showcase the full product even when no social accounts are connected.

============================================================
40. PROVIDER STATUS CENTER
============================================================

Create a premium provider management screen.

Each provider:

Connected
Not connected
Syncing
Rate limited
Expired
Error
Unavailable

Show:

Last sync
Next sync
Records collected
Rate-limit status
Permissions
Connection age

Allow reconnect.

============================================================
41. DATA IMPORT
============================================================

Support:

CSV
JSON
JSONL

Validate columns.

Map fields.

Preview records.

Detect:

timestamp
author
content
likes
comments
shares
views
platform
hashtags

Then run analysis.

============================================================
42. PERFORMANCE
============================================================

Use:

database indexes
pagination
cursor pagination
cached aggregates
incremental analytics
background computation
lazy loading
virtualized tables where useful

Do not make the dashboard fetch hundreds of thousands of raw posts.

Use aggregated endpoints.

============================================================
43. API CONTRACT
============================================================

Build consistent responses.

Success:

{
  "success": true,
  "data": {...}
}

Error:

{
  "success": false,
  "error": {
      "code": "...",
      "message": "...",
      "details": {...}
  }
}

Use typed frontend models.

============================================================
44. FRONTEND API LAYER
============================================================

Never scatter raw fetch calls everywhere.

Use:

api-client.ts

with:

get()
post()
put()
delete()
upload()

Centralize:

timeouts
error parsing
authentication
headers
request IDs
retry behavior

============================================================
45. REALTIME LAYER
============================================================

Create:

realtime.ts

Use:

WebSocket
or SSE

Events:

post.created
post.updated
sentiment.updated
topic.updated
trend.updated
anomaly.detected
sync.started
sync.completed
provider.error
alert.triggered

============================================================
46. AUDITABILITY
============================================================

Every important intelligence insight should provide:

source data
calculation
time window
algorithm
confidence
supporting records

Add:

"View evidence"

The analyst should be able to drill from:

Insight
↓
Metric
↓
Topic
↓
Posts
↓
Source account
↓
Original platform

============================================================
47. AI SAFETY / TRUST
============================================================

The AI analyst should never be allowed to fabricate facts.

Every AI insight must be linked to backend evidence.

Use language like:

Observed
Detected
Correlated
Possible explanation
Insufficient evidence

Avoid:

"This definitely happened because..."

unless causality is actually proven.

============================================================
48. REPORT QUALITY
============================================================

Reports should look like professional intelligence documents.

Use:

clear hierarchy
page numbers
metadata
time window
source coverage
methodology
confidence
evidence references

No giant walls of text.

============================================================
49. EMPTY STATES
============================================================

When no accounts are connected:

"Your intelligence surface is empty."

Then:

Connect a source
Use the demo workspace

When accounts are connected but syncing:

"Building your intelligence baseline..."

When no anomalies:

"No significant anomalies detected."

Do not display fake numbers.

============================================================
50. SETTINGS
============================================================

Settings:

Profile
Organization
Connected accounts
Provider permissions
Data retention
Notifications
Alerts
AI configuration
Appearance
Security
API
Advanced

============================================================
51. DEPLOYMENT
============================================================

Make the project deployable.

Provide:

Dockerfile
docker-compose.yml
.env.example
production environment docs

Recommended deployment architecture:

Frontend:
Next.js

Backend:
FastAPI

Database:
PostgreSQL

Cache:
Redis

Workers:
background worker processes

Reverse proxy:
Nginx / managed ingress

============================================================
52. DOCUMENTATION
============================================================

Create a README explaining:

what SENTINEX is
architecture
frontend
backend
database
provider integrations
OAuth setup
environment variables
local development
production deployment
testing
security
data retention
AI configuration

Also create:

docs/
    architecture.md
    providers.md
    analytics.md
    realtime.md
    security.md
    deployment.md

============================================================
53. ENVIRONMENT VARIABLES
============================================================

Create .env.example.

Include placeholders for:

DATABASE_URL
REDIS_URL

NEXT_PUBLIC_API_URL

SESSION_SECRET
ENCRYPTION_KEY

X_CLIENT_ID
X_CLIENT_SECRET

YOUTUBE_CLIENT_ID
YOUTUBE_CLIENT_SECRET

TIKTOK_CLIENT_KEY
TIKTOK_CLIENT_SECRET

META_APP_ID
META_APP_SECRET

OPENAI_API_KEY

AI_MODEL

WEBHOOK_BASE_URL

Never place actual credentials in Git.

============================================================
54. GIT SAFETY
============================================================

.gitignore must include:

.env
.env.*
node_modules
.next
__pycache__
.pytest_cache
*.log
*.tsbuildinfo

Do not commit credentials.

============================================================
55. QUALITY BAR
============================================================

Before declaring the project complete:

Backend must:

compile
start
pass tests
serve OpenAPI
connect to database
run migrations

Frontend must:

typecheck
build
load every route
have no broken navigation
have no inert primary buttons

All major API calls must work.

No fake "live" indicators.

No dead routes.

No duplicated API logic.

No placeholder "coming soon" for core functionality.

============================================================
56. FINAL UX STANDARD
============================================================

The product should feel:

fast
confident
technical
calm
premium
intelligent
evidence-driven

Animation should be:

subtle
purposeful
60fps where possible

Avoid:

oversized gradients
cartoonish icons
generic SaaS templates
excessive rounded cards
fake metrics
fake live indicators
unnecessary popups

============================================================
57. IMPORTANT IMPLEMENTATION RULE
============================================================

Build incrementally.

First establish:

1. project structure
2. database
3. authentication
4. provider abstraction
5. OAuth connection
6. ingestion
7. normalized schema
8. analytics
9. realtime
10. dashboard
11. reports
12. alerts
13. AI analyst
14. security
15. tests
16. deployment

After every major phase:

run tests
run typecheck
run build
fix all errors

Never move forward while the current phase is broken.

============================================================
58. FIRST DELIVERY
============================================================

Start by generating the complete repository structure.

Then implement:

A. PostgreSQL database
B. FastAPI backend
C. Next.js frontend
D. authentication
E. provider abstraction
F. X integration
G. YouTube integration
H. TikTok integration
I. Instagram/Meta integration where officially supported
J. background synchronization
K. normalized social data schema
L. analytics pipeline
M. realtime event system
N. premium dashboard
O. reports
P. alerts
Q. AI analyst
R. provider management
S. settings
T. security
U. tests
V. Docker
W. documentation

============================================================
59. NON-NEGOTIABLE RESULT
============================================================

When a user opens SENTINEX:

They should be able to:

1. Create an account
2. Create/select a workspace
3. Connect multiple authorized social accounts
4. See connection status
5. Start synchronization
6. Watch incoming data update
7. Explore sentiment
8. Explore topics
9. Explore trends
10. Explore engagement
11. Investigate anomalies
12. Compare platforms
13. Investigate accounts
14. Search intelligence
15. Ask the AI analyst
16. Generate reports
17. Create alerts
18. Manage data
19. Disconnect providers
20. Delete their data

Everything should be backed by real application state.

The application must degrade gracefully when a provider is unavailable.

If a provider does not support a requested feature, say so clearly in the UI rather than pretending it works.

============================================================
60. FINAL INSTRUCTION
============================================================

Do not give me a superficial prototype.

Build SENTINEX like a serious production product.

Use real architecture.
Use real state.
Use real APIs.
Use real authentication.
Use real persistence.
Use real background jobs.
Use real analytics.
Use real-time updates where technically available.
Use provider capability detection.
Use evidence-backed intelligence.
Use polished UI.

Prioritize correctness over pretending.

If a platform API requires approval, special access, audit, or elevated permissions, implement the integration architecture and clearly surface the required setup rather than bypassing the platform's restrictions.

Every major button must perform a real action.

Every major route must work.

Every important insight must be explainable.

The final result should look and behave like a premium intelligence platform, not a hackathon dashboard.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/c22f084e-9ed8-47af-82d1-f18ff83ebb70).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
