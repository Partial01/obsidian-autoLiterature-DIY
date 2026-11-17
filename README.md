# Obsidian AutoLiterature

[English](./README.md) | [简体中文](./README.zh-CN.md)

<!-- ![Version](https://img.shields.io/badge/version-1.2.2-blue) -->

<!-- ![Obsidian](https://img.shields.io/badge/Obsidian-plugin-7C3AED)
![License](https://img.shields.io/badge/license-MIT-green) -->

📚 **Obsidian AutoLiterature** helps you turn paper IDs in Obsidian notes into clean literature entries. It can fetch metadata, enrich records with Semantic Scholar, and optionally download PDFs into your vault.

This project is inspired by [Mu Li](https://www.bilibili.com/video/BV1nA41157y4) and adapted from [obsidian-autoLiterature](https://github.com/hucorz/obsidian-autoLiterature) and [autoLiterature](https://github.com/wilmerwang/autoLiterature). A related Python-script workflow is available at [autoLiterature_DIY](https://github.com/Partial01/autoLiterature_DIY).

## ✨ Features

- Detect paper IDs in notes with a customizable regular expression.
- Fetch metadata for arXiv IDs, DOIs, medRxiv IDs, bioRxiv IDs, and official USENIX presentation URLs.
- Optionally enrich entries with Semantic Scholar links, citation counts, venue data, and open-access PDF URLs.
- Optionally download PDFs to a configurable vault path.
- Customize generated Markdown with placeholders.

## 🚀 Usage

1. Write a paper ID in a note using the default pattern: `- {paperID}`.
2. Run **AutoLiterature** from the ribbon icon or command palette.
3. The plugin replaces the matched item with formatted paper information.
4. If PDF download is enabled, the plugin saves the PDF when a usable PDF URL is found.
5. To refresh counts in the same action, enable **Refresh citation counts when updating**. This is off by default. Ordinary older entries without dedicated citation links remain unchanged.

Examples:

```md
- {1706.03762}
- {10.1038/s41586-021-03819-2}
- {10.1101/2023.01.01.12345}
- {https://www.usenix.org/conference/usenixsecurity25/presentation/yu-zheng}
```

Some ACM catalog IDs under `10.5555/` have no Crossref or DOI resolver record. For a USENIX paper, use its official presentation URL. See [DOI and official paper sources](docs/doi-sources.md).

## ⚙️ Configuration

### Literature Detection

**Regular Expression**

- Default: `- \{[^{}\r\n]+\}`
- Used to find paper IDs in notes.

**Output Format**

Default:

```md
- **${title}**. *${author}*${venueYear}${linksText}${citationText}
	-
```

Common placeholders:

| Placeholder                            | Meaning                                                          |
| -------------------------------------- | ---------------------------------------------------------------- |
| `${title}`                             | Paper title                                                      |
| `${author}`                            | First author, with `et al.` when available                       |
| `${journal}`                           | Journal or source name                                           |
| `${pubDate}`                           | Publication date                                                 |
| `${year}`                              | Publication year                                                 |
| `${venue}`                             | Normalized venue name, such as NeurIPS, CVPR, ICML, or ICLR      |
| `${venueYear}`                         | Formatted venue/year suffix                                      |
| `${doi}` / `${doiUrl}`                 | DOI and DOI URL                                                  |
| `${arxivId}` / `${arxivUrl}`           | arXiv ID and abstract URL                                        |
| `${pdfUrl}`                            | Local PDF path after download, otherwise the best remote PDF URL |
| `${localPdfPath}`                      | Local vault path for a downloaded PDF                            |
| `${s2Url}`                             | Semantic Scholar paper URL                                       |
| `${citationCount}` / `${citationText}` | Raw count and clickable citation source suffix                 |
| `${citationUrl}`                      | Citation provider URL for custom link layouts                    |
| `${links}` / `${linksText}`            | Compact Markdown links for PDF, arXiv, and Semantic Scholar      |

Unknown placeholders are left unchanged, so older custom formats keep working.

For source-link contents and diagnostic output, see [diagnostics and privacy](#diagnostics-and-privacy).

### Metadata Enrichment

**Refresh citation counts when updating**

Disabled by default. When enabled, the ribbon, **Update selected text**, and **Update the whole vault** convert new placeholders and refresh dedicated citation links in the same action. New entries display a source link such as `[Citations 7](provider-URL)` after the paper links and append no JSON comments. A known source without a count displays `[Citations](provider-URL)`.

Existing ordinary S2, DOI, PDF links and plain counts do not trigger refresh. Valid old identity comments are converted to citation links when their source is identifiable, including when refresh is off. Unresolvable comments remain unchanged. Refresh preserves titles, authors, other links, notes, and images. Unavailable counts keep their old values. S2 counts require **Enable Semantic Scholar** and are not replaced with Crossref counts on failure. See [citation links](#citation-links) for format limits.

**Enable Semantic Scholar**

Disabled by default. When enabled, the plugin looks up Semantic Scholar after the base arXiv, Crossref, medRxiv, bioRxiv, or USENIX lookup. It queries by DOI or arXiv ID first, then falls back to a unique exact title match among the returned candidates. Title matching ignores BibTeX braces, whitespace, and case.

Semantic Scholar can provide:

- S2 paper links
- citation counts
- venue data
- open-access PDF URLs

If the Semantic Scholar request fails or is rate-limited, the note is still updated with the base metadata.

**Semantic Scholar API Key**

Optional. Leave it empty to use the public API, or add a key for more stable requests and fewer rate-limit failures.

### Citation links

The dedicated `Citations` link identifies both the provider and the paper. Crossref links use a DOI; S2 links use a paper ID or a DOI/arXiv lookup key. A successful S2 lookup can replace a lookup endpoint with its paper-page URL. The provider never changes on failure.

Refresh supports one dedicated link on an entry header such as `- **Title**` or `- ## **Title**`. Raw `${citationCount}` and separate-line links are not automatically reformatted. Use `${citationText}` or `[Citations ${citationCount}](${citationUrl})` on the header, and select complete entry lines for **Update selected text**. Zero is valid; missing, invalid, or unavailable counts preserve the original link.

Old comments are removed only after a safe conversion. Invalid metadata, unknown extension fields, conflicting links, or missing identifiers retain the original comment. Code fences and inline examples are skipped. File and selection changes during a lookup skip the write to preserve edits.

### Diagnostics and privacy

New entries append no JSON tracking comments, original-input records, query timestamps, or API keys. Citation source links contain only validated provider identities, without URL credentials, query strings, or fragments. Paper identities and counts are visible by design.

Failure notices omit raw network exceptions and request URLs. The read-only DOI diagnostic outputs queried identifiers and provider statuses, not response bodies or note paths. Its identifiers can still reveal reading interests. S2 keys remain in local plugin settings and request headers; `data.json` is ignored by Git but is not encrypted on disk.

Run `npm test`, `npm run build`, and `npm run check:public` before preparing a change. Optional `npm run test:citations-live` and `npm run test:usenix-live` checks contact public providers without editing notes or downloading PDFs. These checks do not replace testing in a running Obsidian editor.

### PDF Management

**Auto Download PDF**

Enable this to download PDFs while updating literature information.

PDF URL priority:

1. arXiv or Crossref PDF links
2. Semantic Scholar open-access PDF links
3. no download when no usable PDF URL is available

**PDF Storage Path Base**

- `vault`: store PDFs relative to the vault root
- `mdFile`: store PDFs relative to the active Markdown file

**PDF Storage Path**

Examples:

- Base: `vault`, Path: `pdfs` -> `vault/pdfs/paper.pdf`
- Base: `mdFile`, Path: `pdfs` -> `current_folder/pdfs/paper.pdf`

**PDF File Name Format**

- `Paper Title`: use the paper title
- `Paper ID`: use the paper identifier when possible
- `Custom`: use placeholders such as `${title}`, `${id}`, `${author}`, `${journal}`, and `${pubDate}`

Illegal filename characters are replaced with `-`, and filenames are limited to 100 characters.

## 🧭 Commands

- **Ribbon icon**: update the active note.
- **Update selected text**: process only the selected text.
- **Update the whole vault**: process all Markdown files in the vault.

## 📝 Notes

- Different Obsidian themes may render the generated Markdown differently.
- To insert tabs in the output format setting, copy the format from a text editor because pressing Tab in Obsidian settings may move focus.

## License

MIT License
