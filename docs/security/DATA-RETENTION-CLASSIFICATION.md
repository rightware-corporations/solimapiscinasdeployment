# SOLIMA Backend — Data Retention Classification

Status: classification approved; exact durations pending external validation  
Applies to: PostgreSQL records, object storage, backups, logs and exported documents  
Organization: SOLIMA  
System timezone: Africa/Maputo

## 1. Official decision

SOLIMA will not use one blanket retention duration.

Data is assigned to a retention class according to its business purpose, sensitivity, evidentiary value and operational lifecycle. Exact durations must be validated against applicable Mozambican legal, fiscal, accounting, employment, consumer and contractual requirements before production automation is enabled.

Until that validation is completed:

- production data must not be automatically destroyed merely because an assumed duration elapsed
- no document may claim a legally required number of years without an authoritative source and responsible approval
- security and temporary operational data may use narrowly scoped expiry only when it is not business evidence
- legal hold, dispute, warranty, investigation or active support obligations suspend disposal
- deletion and anonymization jobs remain disabled by default and require documented configuration

## 2. Retention classes

| Class | Records | Lifecycle trigger | End-of-retention action |
|---|---|---|---|
| R1 Security and session data | sessions, login attempts, rate-limit events, anti-abuse signals, recovery tokens | expiry, revocation or security-event closure | delete or aggregate when no investigation/hold exists |
| R2 Unconverted lead data | public Lead contact snapshot, intent, optional inspiration media, abandoned commercial activity | Lead reaches LOST, CANCELLED or DUPLICATE and no dispute/renewal exists | anonymize direct identifiers; remove eligible media; retain bounded commercial statistics |
| R3 Customer identity data | Customer name, normalized phone, email and address | customer relationship becomes inactive and all linked obligations close | anonymize only after every linked higher-retention record permits it |
| R4 Commercial and financial evidence | Quote, issued QuoteVersion, lines, tax/discount snapshots, acceptance evidence, generated documents | proposal/contract lifecycle closes | retain immutable evidence for validated fiscal/contractual duration; then archive or anonymize where lawful |
| R5 Project and service records | Project, SiteVisit, reports, technical media, warranty and SupportCase records | project, warranty, support and reopening windows all close | retain operational evidence for validated duration; remove eligible media separately |
| R6 Audit and integrity records | status histories, AuditEvent, idempotency evidence, public-number allocation | related aggregate reaches final retention eligibility | preserve integrity metadata; minimize or pseudonymize personal payloads |
| R7 Media and attachments | location, inspiration, technical, acceptance and support files | owning record becomes eligible under its class | delete object only after all references, holds and backup rules permit it |
| R8 Backups and recovery copies | database backups, object-store versions, disaster-recovery archives | backup rotation point | expire through controlled rotation; never selectively mutate a sealed backup |

A record inherits the longest applicable active class. A media object referenced by multiple aggregates cannot be removed until every reference is eligible.

## 3. Data-state model

Retention state is distinct from business status.

Proposed states:

- `ACTIVE`: used by an active process
- `RETAINED`: business lifecycle closed but preservation is required
- `HOLD`: disposal suspended for a documented reason
- `ANONYMIZATION_DUE`: approved eligibility reached
- `ANONYMIZED`: direct identifiers transformed or removed
- `DELETION_DUE`: physical removal allowed for eligible non-evidence data
- `DELETED`: physical object removed, with a non-sensitive disposal receipt retained

Business tables should not all duplicate this state. A central `retention_subject`/policy service or derived retention view should track eligibility, holds and disposal execution.

## 4. Legal hold

A hold must include:

- target aggregate, Customer or media scope
- reason and bounded note
- creating administrator
- start timestamp
- optional review date
- releasing administrator, reason and timestamp

A hold:

- overrides scheduled anonymization and deletion
- is audited
- cannot be silently expired
- does not make otherwise unauthorized data access permissible

## 5. Anonymization rules

Anonymization is an authorized business operation, not a generic SQL update.

It must:

- execute transactionally for relational records
- preserve UUIDs, public numbers, financial values, statuses and referential integrity
- remove or irreversibly transform direct identifiers no longer required
- avoid placing original values in AuditEvent before/after payloads
- invalidate search indexes, caches and derived exports containing the identifiers
- create a non-sensitive disposal/anonymization receipt
- be idempotent
- never silently merge two Customers
- respect legal holds and active Project, warranty, Quote or Support obligations

Pseudonymization is not treated as irreversible anonymization when a re-identification key still exists.

## 6. Media disposal

Object deletion requires:

1. resolve every MediaAttachment reference
2. verify each owning aggregate's retention class
3. verify no legal hold
4. verify the media is not required as acceptance, technical, warranty, complaint or security evidence
5. delete the canonical object and eligible derived variants
6. record checksum, object key hash, actor/job and timestamp without retaining the content
7. allow encrypted backup copies to expire through normal backup rotation

Public transport temporary files must follow a shorter technical lifecycle and must not become the canonical retained copy.

## 7. Backups

Backups require their own fixed rotation schedule after infrastructure and recovery objectives are approved.

Rules:

- encrypted in transit and at rest
- access restricted and audited
- restoration tested
- retention documented per environment
- production data not copied into development without approved sanitization
- expired backups removed through provider-supported lifecycle controls
- restored data immediately re-enters current retention and hold evaluation

## 8. Required configuration before automation

The following policy fields must be versioned configuration, not hard-coded assumptions:

- retention class code
- triggering business event
- duration and unit
- approved legal/business basis
- approval owner and approval date
- anonymization field map
- media disposal eligibility
- backup interaction
- effective-from date
- superseded policy version

A policy change applies prospectively and must not silently destroy records newly classified under a shorter duration.

## 9. Validation required

Before production retention jobs are enabled, SOLIMA must obtain and record:

- accounting validation for quote, tax and financial-document preservation
- legal validation for customer, contractual, complaint and dispute evidence
- operational validation for project, technical, warranty and support records
- security validation for session, authentication and incident logs
- approved backup recovery objectives and rotation
- a named SOLIMA policy owner

The result must populate an approved retention matrix with authoritative references. Until then, class assignment and hold support may be implemented, but destructive automation remains disabled.

## 10. Implementation acceptance criteria

- every retained aggregate maps to at least one class
- the longest-active-class rule is tested
- hold creation/release is authorized and audited
- anonymization is idempotent and preserves relational integrity
- media deletion refuses shared or held assets
- dry-run produces an exact candidate report without mutation
- production execution requires an approved policy version
- metrics expose due, held, anonymized, failed and deleted counts without personal data
- restore tests confirm expired data is not accidentally reintroduced beyond the backup window
