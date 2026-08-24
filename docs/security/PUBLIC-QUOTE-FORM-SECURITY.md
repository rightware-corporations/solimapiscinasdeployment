# SOLIMA Public Quote Form — Validation and Security Audit

Status: verified baseline with required remediations  
Reviewed branch: `integration/pre-production-hardened`  
Target implementation branch: `feat/postgres-office-support-foundation`  
Runtime target: Railway + PostgreSQL  
Public endpoint: `POST /api/leads`

## 1. Official product direction

- photographs of the work location will become mandatory
- inspiration photographs remain optional
- the exact minimum number of location photographs is pending approval
- every rule must be enforced by the server; browser validation is only usability assistance
- WAF and bot controls supplement application security and never replace it

## 2. Verified current behavior

### Browser

The current three-step form:

- requires name, telephone, location, service type and consent
- labels location photographs as recommended, not required
- permits zero to five location photographs
- permits zero to two inspiration photographs
- limits each selected file to 5 MB by browser-declared size
- allowlists JPEG, PNG and WebP by browser-declared MIME
- uses a honeypot field and submission start timestamp
- sends a UUID idempotency key

### API and media pipeline

The server currently:

- validates bounded text with Zod
- normalizes and validates Mozambican telephone numbers
- allowlists service and extra codes
- rejects control characters and HTML angle brackets
- requires consent
- enforces the honeypot and minimum completion time
- accepts zero to five location photographs and zero to two inspiration photographs
- caps multipart files, fields, field size, parts and per-file bytes
- detects real file type from file contents
- accepts only JPEG, PNG and WebP
- caps decoded image pixels
- decodes and re-encodes through Sharp
- auto-rotates and strips source metadata by producing a new JPEG
- limits output dimensions and processed size
- cleans raw and partially processed files on failure
- creates the lead, media and delivery outbox transactionally
- preserves idempotent replay/conflict behavior

## 3. Verified gaps

### Mandatory location evidence

Neither browser nor server currently requires a location photograph. This is a contract gap and must be changed in both layers, with the server authoritative.

### Rate limiting

The endpoint currently allows 12 attempts per IP per 30 minutes through the default in-memory `express-rate-limit` store.

Limitations:

- counters reset on process restart
- counters are not shared across replicas
- IP-only control can affect users behind shared carrier-grade NAT
- it does not distinguish cheap rejected requests from expensive image-processing work

Target:

- edge rate limiting at Cloudflare
- PostgreSQL-backed application limiter or another durable shared store compatible with the modular monolith
- separate limits for request starts, failed validation, accepted lead creation and expensive image processing
- trusted proxy configuration tested so attacker-controlled forwarding headers cannot choose the rate-limit key

### Bot and replay abuse

The honeypot and timing check are useful but insufficient against automated clients.

Target:

- Cloudflare Turnstile on the public form
- mandatory server-side Siteverify validation
- bind expected hostname/action
- reject missing, invalid, expired or replayed tokens
- retain idempotency, honeypot and timing checks

### Origin and request context

The public endpoint currently does not explicitly validate `Origin`, `Referer` fallback or Fetch Metadata.

Target:

- allowlisted production origins
- reject cross-site browser submissions using `Sec-Fetch-Site`
- verify `Origin` when present
- keep no permissive CORS policy
- do not treat Origin checks as protection for non-browser clients

### WAF

No repository-controlled WAF policy is present.

Target deployment:

- custom SOLIMA domain proxied through Cloudflare before Railway
- SSL/TLS mode compatible with Railway
- Cloudflare managed protections appropriate to the selected plan
- custom rule and edge rate limit focused on `POST /api/leads`
- managed challenge for suspicious automation
- preserve Railway webhook accessibility with path-specific rules
- restrict or monitor direct Railway-origin access so attackers cannot bypass Cloudflare

Cloudflare documents managed rules for common and zero-day application exploits and an OWASP ruleset on eligible plans. Railway documents Cloudflare-backed custom domains and the required SSL mode.

Important: WAF request-body inspection is plan-limited and may inspect only an initial portion of multipart bodies. Therefore image validation, size limits and safe decoding remain mandatory in the application.

References:

- https://developers.cloudflare.com/waf/managed-rules/
- https://developers.cloudflare.com/turnstile/get-started/server-side-validation/
- https://docs.railway.com/networking/domains/working-with-domains
- https://docs.railway.com/networking/troubleshooting/ssl

### SQL injection and persistence

Current Prisma writes are parameterized and the only inspected raw SQL is a constant `SELECT 1` health probe. No user input is concatenated into SQL in the reviewed public path.

Required continuation:

- use Prisma query APIs or parameterized tagged queries only
- never interpolate request strings into `$queryRawUnsafe`
- constrain sort/filter fields through allowlists in future Admin APIs
- test malicious payloads as data, including quotes, comments, Unicode and encoded metacharacters
- use least-privilege PostgreSQL credentials
- separate migration credentials from runtime credentials when operationally practical

## 4. Additional attack controls

Required:

- global request-header and body timeouts at proxy/runtime level
- multipart rejection before expensive processing where possible
- bounded image concurrency and resource monitoring
- structured security events without logging photographs, full phone numbers or secrets
- generic public errors; detailed internal correlation by request ID
- dependency and container scanning
- secret rotation and no secrets in repository
- PostgreSQL TLS, backup encryption and restore drills
- CSP retained and tightened as external runtime libraries are localized
- malware scanning is evaluated for permanent private Office attachments; image re-encoding remains the public lead-image boundary
- retention and deletion policy for public lead photographs must be explicit

## 5. Required tests before release

- zero location photographs rejected
- valid minimum location photographs accepted
- inspiration remains optional
- too many files and oversized parts rejected
- MIME spoofing and polyglot/corrupt images rejected
- decompression-bomb dimensions rejected
- raw and staged files removed after every failure path
- Turnstile invalid, expired and replayed tokens rejected
- rate limit survives process restart and is shared where applicable
- spoofed forwarding headers cannot evade limits
- cross-site form posts rejected
- SQL injection payload corpus stored only as bounded data
- simultaneous idempotent submissions create one business graph
- WAF bypass through the direct Railway hostname is prevented or detected

## 6. Pending product decision

Choose the minimum number of mandatory location photographs. Recommended initial rule: at least one and at most five.
