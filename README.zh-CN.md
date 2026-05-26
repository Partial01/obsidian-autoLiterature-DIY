# Obsidian AutoLiterature

[English](./README.md) | [简体中文](./README.zh-CN.md)

<!-- ![Version](https://img.shields.io/badge/version-1.2.2-blue) -->
<!-- ![Obsidian](https://img.shields.io/badge/Obsidian-plugin-7C3AED)
![License](https://img.shields.io/badge/license-MIT-green) -->

📚 **Obsidian AutoLiterature** 用于把 Obsidian 笔记中的论文 ID 自动转换为清晰的文献条目。它可以获取论文元数据、通过 Semantic Scholar 补充引用和会议信息，并可按需下载 PDF 到库内。

本项目受[Mu Li](https://www.bilibili.com/video/BV1nA41157y4)的启发，改编自 [obsidian-autoLiterature](https://github.com/hucorz/obsidian-autoLiterature) 和 [autoLiterature](https://github.com/wilmerwang/autoLiterature)。如需类似思路的 Python 脚本，可参考 [autoLiterature_DIY](https://github.com/Partial01/autoLiterature_DIY)。

## ✨ 功能

- 使用可自定义正则表达式识别笔记中的论文 ID。
- 支持获取 arXiv ID、DOI、medRxiv ID 和 bioRxiv ID 的元数据。
- 可选启用 Semantic Scholar，补充 S2 链接、引用数、会议/期刊信息和开放访问 PDF 链接。
- 可选自动下载 PDF，并保存到指定库路径。
- 支持使用占位符自定义生成的 Markdown 格式。

## 🚀 使用方法

1. 在笔记中按默认格式写入论文 ID：`- {paperID}`。
2. 通过左侧功能区图标或命令面板运行 **AutoLiterature**。
3. 插件会把匹配项替换为格式化后的论文信息。
4. 如果启用了 PDF 下载，插件会在找到可用 PDF 链接时自动保存文件。

示例：

```md
- {1706.03762}
- {10.1038/s41586-021-03819-2}
- {10.1101/2023.01.01.12345}
```

## ⚙️ 配置

### 文献识别

**Regular Expression**

- 默认值：`- \{.{3,}\}`
- 用于匹配笔记中的论文 ID。

**Output Format**

默认格式：

```md
- ## **${title}**. _${author}_${venueYear}${linksText}${citationText}
```

常用占位符：

| 占位符                                 | 含义                                               |
| -------------------------------------- | -------------------------------------------------- |
| `${title}`                             | 论文标题                                           |
| `${author}`                            | 第一作者；可识别多作者时附加 `et al.`              |
| `${journal}`                           | 期刊或来源名称                                     |
| `${pubDate}`                           | 发表日期                                           |
| `${year}`                              | 发表年份                                           |
| `${venue}`                             | 标准化会议/期刊名称，如 NeurIPS、CVPR、ICML、ICLR  |
| `${venueYear}`                         | 格式化后的会议/年份后缀                            |
| `${doi}` / `${doiUrl}`                 | DOI 和 DOI 链接                                    |
| `${arxivId}` / `${arxivUrl}`           | arXiv ID 和摘要页链接                              |
| `${pdfUrl}`                            | 下载成功后的本地 PDF 路径，否则为最佳远程 PDF 链接 |
| `${localPdfPath}`                      | 已下载 PDF 的库内路径                              |
| `${s2Url}`                             | Semantic Scholar 论文链接                          |
| `${citationCount}` / `${citationText}` | 引用数和格式化引用文本                             |
| `${links}` / `${linksText}`            | PDF、arXiv、Semantic Scholar 的紧凑 Markdown 链接  |

未知占位符会保持原样，因此旧的自定义格式仍可继续使用。

### 元数据增强

**Enable Semantic Scholar**

默认关闭。启用后，插件会在基础 arXiv、Crossref、medRxiv 或 bioRxiv 查询之后继续请求 Semantic Scholar。查询顺序为 DOI 或 arXiv ID 优先，随后回退到精确标题搜索。

Semantic Scholar 可提供：

- S2 论文链接
- 引用数
- 会议/期刊信息
- 开放访问 PDF 链接

如果 Semantic Scholar 请求失败或触发限流，插件仍会使用基础元数据更新笔记。

**Semantic Scholar API Key**

可选。留空时使用公共 API；填写 API Key 可提高请求稳定性并减少限流失败。

### PDF 管理

**Auto Download PDF**

启用后，插件会在更新文献信息时尝试下载 PDF。

PDF 链接优先级：

1. arXiv 或 Crossref PDF 链接
2. Semantic Scholar 开放访问 PDF 链接
3. 没有可用 PDF 链接时不下载

**PDF Storage Path Base**

- `vault`：相对于库根目录保存
- `mdFile`：相对于当前 Markdown 文件保存

**PDF Storage Path**

示例：

- Base: `vault`, Path: `pdfs` -> `vault/pdfs/paper.pdf`
- Base: `mdFile`, Path: `pdfs` -> `current_folder/pdfs/paper.pdf`

**PDF File Name Format**

- `Paper Title`：使用论文标题
- `Paper ID`：尽可能使用论文 ID
- `Custom`：使用 `${title}`、`${id}`、`${author}`、`${journal}`、`${pubDate}` 等占位符

非法文件名字符会被替换为 `-`，文件名最长限制为 100 个字符。

## 🧭 命令

- **Ribbon icon**：更新当前笔记。
- **Update selected text**：仅处理选中文本。
- **Update the whole vault**：处理库内所有 Markdown 文件。

## 📝 说明

- 不同 Obsidian 主题可能会以不同样式渲染生成的 Markdown。
- 如需在 Output Format 设置中插入制表符，建议先在文本编辑器中写好后复制，因为在 Obsidian 设置页按 Tab 可能会切换焦点。

## License

MIT License
