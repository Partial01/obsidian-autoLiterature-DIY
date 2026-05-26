# Obsidian AutoLiterature

[English](./README.md) | [简体中文](./README.zh-CN.md)

<!-- ![Version](https://img.shields.io/badge/version-1.2.2-blue) -->

<!-- ![Obsidian](https://img.shields.io/badge/Obsidian-plugin-7C3AED)
![License](https://img.shields.io/badge/license-MIT-green) -->

📚 **Obsidian AutoLiterature** helps you turn paper IDs in Obsidian notes into clean literature entries. It can fetch metadata, enrich records with Semantic Scholar, and optionally download PDFs into your vault.

This project is inspired by [Mu Li](https://www.bilibili.com/video/BV1nA41157y4) and adapted from [obsidian-autoLiterature](https://github.com/hucorz/obsidian-autoLiterature) and [autoLiterature](https://github.com/wilmerwang/autoLiterature). A related Python-script workflow is available at [autoLiterature_DIY](https://github.com/Partial01/autoLiterature_DIY).

## ✨ Features

- Detect paper IDs in notes with a customizable regular expression.
- Fetch metadata for arXiv IDs, DOI links, medRxiv IDs, and bioRxiv IDs.
- Optionally enrich entries with Semantic Scholar links, citation counts, venue data, and open-access PDF URLs.
- Optionally download PDFs to a configurable vault path.
- Customize generated Markdown with placeholders.

## 🚀 Usage

1. Write a paper ID in a note using the default pattern: `- {paperID}`.
2. Run **AutoLiterature** from the ribbon icon or command palette.
3. The plugin replaces the matched item with formatted paper information.
4. If PDF download is enabled, the plugin saves the PDF when a usable PDF URL is found.

Examples:

```md
- {1706.03762}
- {10.1038/s41586-021-03819-2}
- {10.1101/2023.01.01.12345}
```

## ⚙️ Configuration

### Literature Detection

**Regular Expression**

- Default: `- \{.{3,}\}`
- Used to find paper IDs in notes.

**Output Format**

Default:

```md
- ## **${title}**. _${author}_${venueYear}${linksText}${citationText}
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
| `${citationCount}` / `${citationText}` | Citation count and formatted citation suffix                     |
| `${links}` / `${linksText}`            | Compact Markdown links for PDF, arXiv, and Semantic Scholar      |

Unknown placeholders are left unchanged, so older custom formats keep working.

### Metadata Enrichment

**Enable Semantic Scholar**

Disabled by default. When enabled, the plugin looks up Semantic Scholar after the base arXiv, Crossref, medRxiv, or bioRxiv lookup. It queries by DOI or arXiv ID first, then falls back to exact title search.

Semantic Scholar can provide:

- S2 paper links
- citation counts
- venue data
- open-access PDF URLs

If the Semantic Scholar request fails or is rate-limited, the note is still updated with the base metadata.

**Semantic Scholar API Key**

Optional. Leave it empty to use the public API, or add a key for more stable requests and fewer rate-limit failures.

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
