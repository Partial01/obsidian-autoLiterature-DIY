# DOI and official paper sources

[English](doi-sources.md) | [简体中文](doi-sources.zh-CN.md)

A DOI-shaped publisher catalog identifier does not guarantee a registered Crossref record. Crossref describes `10.5555` as a prefix used for test and unmaintained records. Some records can still contain real metadata, so the plugin does not reject the whole prefix. See the [Crossref explanation](https://community.crossref.org/t/crossref-test-account-prefixes/13263).

## Lookup failures

| Result | Meaning |
| --- | --- |
| Crossref 404 | That provider has no record for the identifier |
| doi.org 404 | The resolver cannot resolve the identifier |
| Publisher 403 | Access was refused; this does not establish whether a paper exists |
| 429 | Provider rate limit |
| Timeout or network error | No usable provider response; retry when connectivity is restored |

S2 enrichment runs after base metadata succeeds. Enabling S2 does not repair a missing Crossref record by itself. The plugin leaves unresolved placeholders unchanged and gives missing `10.5555/` records an official-source hint.

## USENIX inputs

For a USENIX paper without a usable DOI, use its official HTTPS presentation URL:

```md
- {https://www.usenix.org/conference/usenixsecurity25/presentation/yu-zheng}
```

The plugin reads the page's `citation_*` tags for title, authors, year, venue, and PDF URL. DOI registration is optional. It does not maintain a hardcoded catalog-to-paper mapping. With Semantic Scholar enabled, a unique exact title match can add an S2 link and a count. A failed or ambiguous match still preserves the base metadata.

## Read-only diagnosis

With Node 18 or later, run:

```sh
node scripts/diagnose-dois.cjs path/to/note.md
```

The script reads DOI placeholders and contacts Crossref, doi.org, ACM, and S2. It outputs the queried DOI, provider, HTTP status, or a fixed timeout/network category. It does not output response bodies, raw exceptions, note paths, or credentials. Identifiers remain in the output intentionally, so the result can still reveal which papers were queried. It does not edit notes or download PDFs.
