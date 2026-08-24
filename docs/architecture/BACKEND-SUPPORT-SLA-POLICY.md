# SOLIMA Support — Formal Internal SLA Policy

Status: conceptual policy approved in principle  
Scope: Admin-registered, Project-bound SupportCases  
Timezone: `Africa/Maputo`  
Nature: formal internal operating policy, not a contractual customer promise

## 1. Business calendar

Regular business time:

- Monday through Friday
- 08:00 inclusive
- 17:00 exclusive
- timezone: Africa/Maputo

The regular day currently contributes nine business hours. Holiday and exceptional-closure behavior remains pending explicit approval.

All persisted timestamps use UTC. Calendar evaluation and Office display use `Africa/Maputo`.

## 2. Priorities

### NORMAL

Routine operational matter without immediate material impact.

- first response: 8 business hours
- mitigation: not required
- resolution: 5 business days

### HIGH

Relevant operational impact, meaningful degradation or significant customer dissatisfaction.

- first response: 4 business hours
- mitigation: 1 business day
- resolution: 2 business days

### URGENT

Safety concern, active or increasing damage, critical service interruption or comparable immediate risk.

- first response: 1 business hour
- mitigation: 4 business hours
- resolution: 1 business day

Priority is selected manually by the administrator and every change is audited.

## 3. SLA milestones

### First response

Satisfied by an explicit qualifying action, not merely viewing the case. Qualifying actions will be defined in the logical policy module and may include triage acceptance or a recorded customer-contact action.

### Mitigation

Satisfied when the administrator records a concrete temporary control or impact-reduction action. It is required only for HIGH and URGENT.

### Resolution

Satisfied when the SupportCase transitions to `RESOLVED` with a bounded resolution summary.

`CLOSED` is confirmation/administrative closure and is not the resolution milestone.

## 4. Versioning

SLA rules are versioned.

Every SupportCase SLA cycle stores or references:

- policy version
- priority at cycle creation
- calendar version
- opened timestamp
- response due timestamp
- mitigation due timestamp, when applicable
- resolution due timestamp
- achieved timestamps
- paused duration
- breached milestones

Changing future policy must not recalculate historical cases silently.

## 5. Reopening

`REOPENED` creates a new SLA cycle linked to the original SupportCase.

The original cycle remains immutable, including prior achievements and breaches. Exact reopen eligibility and the new-cycle target behavior remain pending approval.

## 6. Events and auditability

Material SLA events are append-only:

- cycle started
- priority changed
- response achieved
- mitigation achieved
- pause started
- pause ended
- resolution achieved
- milestone breached
- case reopened
- cycle closed or cancelled

The system must be able to explain every displayed deadline from persisted policy, calendar and event data.

## 7. Alerts

The first release should support internal warning states:

- approaching response deadline
- approaching mitigation deadline
- approaching resolution deadline
- breached response
- breached mitigation
- breached resolution

Alert delivery channels and thresholds remain operational decisions.

## 8. Non-contractual nature

SLA values are internal management targets.

They must not automatically appear in:

- public landing copy
- customer notifications
- quotes
- contracts
- support protocol receipts

Making them customer-facing requires a separate explicit commercial/legal approval.

## 9. Logical entities

Conceptual entities:

- BusinessCalendar
- BusinessCalendarVersion
- BusinessClosure
- SlaPolicy
- SlaPolicyVersion
- SupportSlaCycle
- SupportSlaEvent

The logical PostgreSQL model will decide whether regular weekly intervals are normalized rows or validated structured configuration.

## 10. Pending decisions

- treatment of Mozambique public holidays
- exceptional closure administration
- whether WAITING_CUSTOMER pauses resolution only
- reopen time window and authorization
- SLA targets used by reopened cycles
- warning thresholds
- priority downgrade restrictions
