# DOI 与官方论文来源

[English](doi-sources.md) | [简体中文](doi-sources.zh-CN.md)

出版方目录编号形似 DOI，并不保证存在已注册的 Crossref 记录。Crossref 说明 `10.5555` 用于测试或无人维护的记录；部分记录仍可能含有真实元数据，因此插件不会禁用整个前缀。见 [Crossref 说明](https://community.crossref.org/t/crossref-test-account-prefixes/13263)。

## 查询失败

| 结果 | 含义 |
| --- | --- |
| Crossref 404 | 该提供方没有对应编号记录 |
| doi.org 404 | 解析服务无法解析该编号 |
| 出版方 403 | 访问被拒绝，不能据此判断论文是否存在 |
| 429 | 提供方限流 |
| 超时或网络错误 | 没有获得可用响应，可在网络恢复后重试 |

S2 增强在基础元数据获取成功后执行。仅开启 S2 不能修复缺失的 Crossref 记录。无法解析的占位符保持原样，缺失的 `10.5555/` 记录会提示使用官方来源。

## USENIX 输入

USENIX 论文没有可用 DOI 时，可以使用官方 HTTPS presentation URL：

```md
- {https://www.usenix.org/conference/usenixsecurity25/presentation/yu-zheng}
```

插件读取页面的 `citation_*` 标签获取标题、作者、年份、会议及 PDF URL，DOI 为可选项，不维护目录编号到论文的硬编码映射。启用 Semantic Scholar 后，唯一精确题名匹配可补充 S2 链接和次数。匹配失败或有歧义时仍保留基础元数据。

## 只读诊断

使用 Node 18 或更新版本运行：

```sh
node scripts/diagnose-dois.cjs path/to/note.md
```

脚本读取 DOI 占位符并查询 Crossref、doi.org、ACM 和 S2，输出被查询 DOI、提供方、HTTP 状态或固定的超时及网络错误类别，不输出响应正文、原始异常、笔记路径或凭据。输出会有意保留论文编号，因此仍可能反映查询了哪些论文。脚本不修改笔记、不下载 PDF。
