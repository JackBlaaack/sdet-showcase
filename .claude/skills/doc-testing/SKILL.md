---
name: doc-testing
description: "Use when analyzing documentation for gaps, contradictions, or inconsistencies. Triggers on: \"review the docs\", \"check requirements\", \"validate API docs\", \"find gaps in spec\", \"documentation issues\", \"requirements complete?\", \"does doc match implementation\", \"audit the spec\". Checklists for functional, non-functional, API documentation quality."
---

# Documentation Testing

## Requirements Validation

### Functional Requirements Checklist

**Completeness:**
- [ ] All requirements are testable
- [ ] User stories have acceptance criteria
- [ ] API endpoints fully specified
- [ ] Error conditions defined
- [ ] Success conditions clear

**Clarity:**
- [ ] Requirements unambiguous
- [ ] Success criteria measurable
- [ ] Error messages specified
- [ ] Validation rules explicit
- [ ] Data constraints defined

**Consistency:**
- [ ] No conflicting requirements
- [ ] Terminology consistent
- [ ] Data models align across interfaces
- [ ] Permissions model consistent
- [ ] Business rules don't contradict

### Non-Functional Requirements

- [ ] Performance: response time, throughput, concurrent users
- [ ] Security: auth, authorization, encryption, audit logging, rate limiting
- [ ] Availability: SLA, backup, RTO
- [ ] Scalability: user/storage growth, horizontal scaling

## API Documentation Checklist

### OpenAPI/Swagger Structure

- [ ] All endpoints documented
- [ ] HTTP methods correct
- [ ] Request: path params, query params, headers, body schemas
- [ ] Response: all status codes (200, 201, 400, 401, 403, 404, 500), schemas
- [ ] Authentication requirements specified
- [ ] Tags and descriptions present

### Schema Quality

- [ ] Required fields marked
- [ ] Data types correct (string, number, boolean, array, object)
- [ ] Enum values listed
- [ ] Format constraints (email, date-time, uuid)
- [ ] Nullable fields marked
- [ ] Default values specified

### Consistency Checks

- [ ] Field naming consistent (snake_case or camelCase throughout)
- [ ] Pagination approach consistent
- [ ] Error response format consistent
- [ ] ID format consistent (uuid vs integer)
- [ ] Date/time format consistent (ISO 8601)

### Example Quality

- [ ] Request examples for all methods
- [ ] Response examples for all status codes
- [ ] Examples use realistic data
- [ ] Examples match schema definitions

## Gap Analysis Process

1. **Identify missing requirements** — compare feature description vs detailed specs
2. **Check error handling** — all error cases covered?
3. **Verify edge cases** — boundaries, nulls, special chars
4. **Validate data integrity** — constraints, uniqueness, foreign keys

**Prioritize gaps:**
- Critical → blocks testing
- Important → reduces coverage
- Nice-to-have → future

## Documentation Issue Report Format

```markdown
## Documentation Issue: {Brief Title}

**Severity:** Critical | High | Medium | Low
**Status:** Open | In Progress | Fixed

### Description
{What is wrong}

### Location
- File: {filename}
- Section: {section}

### Problem
{Specific issue}

### Impact
{Impact on testing/development}

### Recommendation
{What needs fixing}

### Suggested Fix
{Specific text changes needed}
```

## Implementation Consistency Checklist

- [ ] API docs match actual endpoint implementations
- [ ] Request/response schemas match actual data
- [ ] Error codes match actual error responses
- [ ] Authentication requirements match implementation
- [ ] Rate limits match actual limits
- [ ] Timeout values match config

## Inconsistency Report Format

```markdown
## Inconsistency: {Brief Title}

**Location:** {Endpoint/Page}
**Type:** Schema | Business Rule | Error Code
**Severity:** High | Medium | Low

### Documentation States
{What docs say}

### Implementation Does
{What actually happens}

### Recommendation
{Docs update or code fix?}
```
