"use client";

import { useMemo, useState } from "react";

import { describeIssue, filterIssues } from "../lib/dashboard";

type IssueRow = { id: string; canonicalId: string; ruleCode: string; status: string; lastSeenAt: string; agentName: string | null };

const pageSize = 25;

export function IssuesTable({ issues }: { issues: IssueRow[] }) {
  const [query, setQuery] = useState("");
  const [ruleCode, setRuleCode] = useState("");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => filterIssues(issues, { query, ruleCode }), [issues, query, ruleCode]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const updateQuery = (value: string) => { setQuery(value); setPage(1); };
  const updateRule = (value: string) => { setRuleCode(value); setPage(1); };

  return <>
    <section aria-label="Фильтры проблем" style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "18px 0" }}>
      <label>Поиск по ID<br /><input value={query} onChange={(event) => updateQuery(event.target.value)} inputMode="numeric" placeholder="Например, 140742249" style={{ padding: 9, minWidth: 210 }} /></label>
      <label>Тип расхождения<br /><select value={ruleCode} onChange={(event) => updateRule(event.target.value)} style={{ padding: 9, minWidth: 280 }}><option value="">Все причины</option><option value="api-not-in-xml">Есть в API, нет в XML-фиде</option><option value="xml-not-in-api">Есть в XML-фиде, нет в API</option><option value="xml-not-in-site">Есть в XML-фиде, нет на сайте</option><option value="site-not-in-xml">Есть на сайте, нет в XML-фиде</option></select></label>
    </section>
    <p style={{ color: "#526158" }}>Найдено: {filtered.length}. На странице: {visible.length} из {pageSize}.</p>
    {visible.length === 0 ? <p>По выбранным условиям проблем нет.</p> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", background: "white", minWidth: 780 }}><thead><tr style={{ borderBottom: "2px solid #d9e4dc" }}><th align="left">ID объекта</th><th align="left">Что нужно проверить</th><th align="left">Ответственный</th><th align="left">Статус</th><th align="left">Обнаружено</th><th /></tr></thead><tbody>{visible.map((issue) => <tr key={issue.id} style={{ borderBottom: "1px solid #edf1ee" }}><td style={{ padding: "10px 0", fontFamily: "monospace" }}>{issue.canonicalId}</td><td>{describeIssue(issue.ruleCode).title}</td><td>{issue.agentName ?? "Не передан доступными источниками"}</td><td>{issue.status === "open" ? "Требует проверки" : issue.status === "review" ? "На проверке" : "Устарело"}</td><td>{new Date(issue.lastSeenAt).toLocaleString("ru-RU")}</td><td><a href={`https://crm.topnlab.ru/object-card/${encodeURIComponent(issue.canonicalId)}`} target="_blank" rel="noreferrer">Открыть в Topnlab</a></td></tr>)}</tbody></table></div>}
    {pageCount > 1 ? <nav aria-label="Страницы проблем" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16 }}><button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Назад</button><span>Страница {page} из {pageCount}</span><button type="button" disabled={page === pageCount} onClick={() => setPage(page + 1)}>Вперёд</button></nav> : null}
  </>;
}
