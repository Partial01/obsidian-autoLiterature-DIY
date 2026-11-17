# Obsidian AutoLiterature

[English](./README.md) | [简体中文](./README.zh-CN.md)

<!-- ![Version](https://img.shields.io/badge/version-1.2.2-blue) -->
<!-- ![Obsidian](https://img.shields.io/badge/Obsidian-plugin-7C3AED)
![License](https://img.shields.io/badge/license-MIT-green) -->

📚 **Obsidian AutoLiterature** 用于把 Obsidian 笔记中的论文 ID 自动转换为清晰的文献条目。它可以获取论文元数据、通过 Semantic Scholar 补充引用和会议信息，并可按需下载 PDF 到库内。

本项目受[Mu Li](https://www.bilibili.com/video/BV1nA41157y4)的启发，改编自 [obsidian-autoLiterature](https://github.com/hucorz/obsidian-autoLiterature) 和 [autoLiterature](https://github.com/wilmerwang/autoLiterature)。如需类似思路的 Python 脚本，可参考 [autoLiterature_DIY](https://github.com/Partial01/autoLiterature_DIY)。

## ✨ 功能

- 使用可自定义正则表达式识别笔记中的论文 ID。
- 支持获取 arXiv ID、DOI、medRxiv ID、bioRxiv ID 和 USENIX 官方论文页的元数据。
- 可选启用 Semantic Scholar，补充 S2 链接、引用数、会议/期刊信息和开放访问 PDF 链接。
- 可选自动下载 PDF，并保存到指定库路径。
- 支持使用占位符自定义生成的 Markdown 格式。

## 🚀 使用方法

1. 在笔记中按默认格式写入论文 ID：`- {paperID}`。
2. 通过左侧功能区图标或命令面板运行 **AutoLiterature**。
3. 插件会把匹配项替换为格式化后的论文信息。
4. 如果启用了 PDF 下载，插件会在找到可用 PDF 链接时自动保存文件。
5. 如需同一次操作刷新被引次数，启用 **Refresh citation counts when updating**。此项默认关闭，无专用 citation 链接的普通旧条目保持原样。

示例：

```md
- {1706.03762}
- {10.1038/s41586-021-03819-2}
- {10.1101/2023.01.01.12345}
- {https://www.usenix.org/conference/usenixsecurity25/presentation/yu-zheng}
```

部分 `10.5555/` ACM 目录编号没有 Crossref 或 DOI 解析记录。对于 USENIX 论文，可改用官方 presentation URL。见 [DOI 与官方论文来源](docs/doi-sources.zh-CN.md)。

## ⚙️ 配置

### 文献识别

**Regular Expression**

- 默认值：`- \{[^{}\r\n]+\}`
- 用于匹配笔记中的论文 ID。

**Output Format**

默认格式：

```md
- **${title}**. *${author}*${venueYear}${linksText}${citationText}
	-
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
| `${citationCount}` / `${citationText}` | 原始次数和可点击来源的 citation 后缀              |
| `${citationUrl}`                      | 用于自定义链接布局的次数提供方 URL                |
| `${links}` / `${linksText}`            | PDF、arXiv、Semantic Scholar 的紧凑 Markdown 链接  |

未知占位符会保持原样，因此旧的自定义格式仍可继续使用。

关于来源链接内容和诊断输出，见 [诊断与隐私](#diagnostics-and-privacy)。

### 元数据增强

**Refresh citation counts when updating**

默认关闭。开启后，左侧按钮、**Update selected text** 和 **Update the whole vault** 在同一次操作中转换新占位符并刷新专用 citation 链接。新条目在论文链接后显示如 `[Citations 7](provider-URL)` 的来源链接，不再追加 JSON 注释。已知来源但没有次数时，显示 `[Citations](provider-URL)`。

普通 S2、DOI、PDF 链接及纯文本次数不会触发刷新。已有有效标识注释在能确认来源时转换为 citation 链接，关闭刷新时也执行；无法确认的注释保持原样。刷新保留标题、作者、其他链接、手写笔记和图片；查询失败保留旧次数。S2 次数需启用 **Enable Semantic Scholar**，失败时不会被 Crossref 次数覆盖。格式范围见 [被引次数链接](#citation-links)。

**Enable Semantic Scholar**

默认关闭。启用后，插件会在基础 arXiv、Crossref、medRxiv、bioRxiv 或 USENIX 查询之后继续请求 Semantic Scholar。查询顺序为 DOI 或 arXiv ID 优先，随后回退到标题搜索。标题匹配忽略 BibTeX 花括号、空白和大小写，仅接受返回候选中唯一的精确匹配。

Semantic Scholar 可提供：

- S2 论文链接
- 引用数
- 会议/期刊信息
- 开放访问 PDF 链接

如果 Semantic Scholar 请求失败或触发限流，插件仍会使用基础元数据更新笔记。

**Semantic Scholar API Key**

可选。留空时使用公共 API；填写 API Key 可提高请求稳定性并减少限流失败。

### Citation links

专用 `Citations` 链接同时识别提供方和论文。Crossref 链接使用 DOI，S2 链接使用 paper ID 或 DOI/arXiv 查询标识。S2 查询成功后可将查询接口替换为论文页 URL，失败时不切换数据源。

刷新支持以 `- **Title**` 或 `- ## **Title**` 开头且只有一个专用链接的标题行。裸 `${citationCount}` 和单独放在其他行的链接不会被自动重排。应在标题行使用 `${citationText}` 或 `[Citations ${citationCount}](${citationUrl})`，执行 **Update selected text** 时选择完整条目行。零有效；缺失、无效或不可用的次数保留原链接。

旧注释只有在安全转换后才移除。元数据无效、含未知扩展字段、链接冲突或缺少标识时保留原注释。代码围栏和行内示例会被跳过，查询期间文件或选区发生变化则跳过写入，保留编辑内容。

### Diagnostics and privacy

新条目不追加 JSON 追踪注释、原始输入记录、查询时间或 API Key。次数来源链接只包含经过验证的提供方标识，不含 URL 凭据、查询参数或片段；论文标识和次数按设计可见。

失败通知不输出原始网络异常或请求 URL。只读 DOI 诊断输出查询编号和提供方状态，不输出响应正文或笔记路径，但编号仍可能反映阅读兴趣。S2 Key 保存在本地插件设置中并用于请求头；`data.json` 被 Git 忽略，但磁盘文件本身没有加密。

准备修改前运行 `npm test`、`npm run build` 和 `npm run check:public`。可选的 `npm run test:citations-live`、`npm run test:usenix-live` 会查询公开服务，不编辑笔记或下载 PDF。这些检查不能替代真实 Obsidian 编辑器测试。

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
