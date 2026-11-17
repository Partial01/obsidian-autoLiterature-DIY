# Changelog

## Unreleased

### Added

- Optional citation refresh within the existing update actions, off by default. Untracked legacy entries are skipped.
- Dedicated citation source links on new entries, with counts displayed in the link label and no JSON comments.
- Local conversion of supported v1 identity comments into source links, including when count refresh is disabled.
- Official USENIX presentation URLs as metadata inputs, including papers without DOIs.
- Offline metadata regression checks, an opt-in live USENIX check, and a read-only DOI diagnostic script.
- Public-file checks for sensitive text patterns, English documentation, translated examples, links, and runtime defaults.

### Fixed

- Updates preserve notes or selections edited during network requests. Repeated placeholders share lookups, and the default pattern no longer merges placeholders on one line.
- Escaped citation-link examples remain unchanged during refresh.
- Crossref errors now distinguish missing records, rate limits, network failures, invalid metadata, and timeouts. Missing `10.5555/` records include a USENIX input hint.
- Crossref requests trim and encode DOI inputs, fall back to available publication dates, and select only PDF links with the PDF media type.
- Semantic Scholar title matching ignores BibTeX braces and rejects ambiguous matches. Invalid citation values no longer enter parsed provider metadata.
- Provider and PDF failure notices no longer echo raw exception messages or request URLs. Diagnostic output omits response bodies and raw exceptions, and arXiv no longer logs full responses.
- Citation links use validated provider identities and omit credentials, query strings, and fragments. Original inputs and query timestamps are no longer appended as tracking metadata.
