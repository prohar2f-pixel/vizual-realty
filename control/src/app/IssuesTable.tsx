"use client";

import { useMemo, useState } from "react";

import { describeIssue, filterIssues, formatMoscowDate, UNASSIGNED_AGENT_FILTER } from "../lib/dashboard";

type IssueRow = { id: string; canonicalId: string; ruleCode: string; status: string; lastSeenAt: string; agentName: string | null; realtyType: string | null };

const pageSize = 25;

export function IssuesTable({ issues }: { issues: IssueRow[] }) {
  const [query, setQuery] = useState("");
  const [ruleCode, setRuleCode] = useState("");
  const [group, setGroup] = useState("");
  const [agentName, setAgentName] = useState("");
  const [propertyType, setPropertyType] = useState("");
  const [page, setPage] = useState(1);
  const agentNames = useMemo(() => [...new Set(issues.flatMap((issue) => {
    const name = issue.agentName?.trim();
    return name ? [name] : [];
  }))].sort((left, right) => left.localeCompare(right, "ru")), [issues]);
  const filtered = useMemo(() => filterIssues(issues, { query, ruleCode, group, agentName, propertyType }), [issues, query, ruleCode, group, agentName, propertyType]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const visible = filtered.slice((page - 1) * pageSize, page * pageSize);
  const updateQuery = (value: string) => { setQuery(value); setPage(1); };
  const updateRule = (value: string) => { setRuleCode(value); setPage(1); };
  const updateGroup = (value: string) => { setGroup(value); setPage(1); };
  const updateAgent = (value: string) => { setAgentName(value); setPage(1); };
  const updatePropertyType = (value: string) => { setPropertyType(value); setPage(1); };

  return <>
    <section aria-label="Фильтры проблем" style={{ display: "flex", gap: 12, flexWrap: "wrap", margin: "18px 0" }}>
      <label>Поиск по ID или сотруднику<br /><input value={query} onChange={(event) => updateQuery(event.target.value)} placeholder="ID или фамилия" style={{ padding: 9, minWidth: 210 }} /></label>
      <label>Ответственный<br /><select value={agentName} onChange={(event) => updateAgent(event.target.value)} style={{ padding: 9, minWidth: 240 }}><option value="">Все ответственные</option>{agentNames.map((name) => <option key={name} value={name}>{name}</option>)}<option value={UNASSIGNED_AGENT_FILTER}>Не назначен / не передан</option></select></label>
      <label>Тип объекта<br /><select value={propertyType} onChange={(event) => updatePropertyType(event.target.value)} style={{ padding: 9, minWidth: 220 }}><option value="">Все типы</option><option value="flat">Квартиры и комнаты</option><option value="house">Дома</option><option value="land">Земельные участки</option><option value="other">Другой / не определён</option></select></label>
      <label>Группа проблем<br /><select value={group} onChange={(event) => updateGroup(event.target.value)} style={{ padding: 9, minWidth: 280 }}><option value="">Все группы</option><option value="advertising">Не добавлены в рекламу</option><option value="quality">Не заполнены обязательные поля</option><option value="support">Для поддержки Topnlab</option><option value="sync">Расхождения сайта и XML</option></select></label>
      <label>Тип расхождения<br /><select value={ruleCode} onChange={(event) => updateRule(event.target.value)} style={{ padding: 9, minWidth: 340 }}><option value="">Все причины</option><option value="api-not-in-xml">В рекламе по API, нет в XML-фиде</option><option value="xml-not-in-api">Есть в XML-фиде, нет среди объектов в рекламе по API</option><option value="xml-not-in-site">Есть в XML-фиде, нет на сайте</option><option value="site-not-in-xml">Есть на сайте, нет в XML-фиде</option></select></label>
    </section>
    <p style={{ color: "#526158" }}>Найдено: {filtered.length}. На странице: {visible.length} из {pageSize}.</p>
    {visible.length === 0 ? <p>По выбранным условиям проблем нет.</p> : <div style={{ overflowX: "auto" }}><table style={{ width: "100%", borderCollapse: "collapse", background: "white", minWidth: 780 }}><thead><tr style={{ borderBottom: "2px solid #d9e4dc" }}><th align="left">ID объекта</th><th align="left">Что нужно проверить</th><th align="left">Ответственный</th><th align="left">Статус</th><th align="left">Обнаружено</th><th /></tr></thead><tbody>{visible.map((issue) => { const description = describeIssue(issue.ruleCode); return <tr key={issue.id} style={{ borderBottom: "1px solid #edf1ee" }}><td style={{ padding: "10px 0", fontFamily: "monospace" }}>{issue.canonicalId}</td><td><strong>{description.title}</strong>{"details" in description ? <small style={{ display: "block", marginTop: 5, color: "#526158" }}>{description.details}</small> : null}</td><td>{issue.agentName ?? "Не передан доступными источниками"}</td><td>{issue.status === "open" ? "Требует проверки" : issue.status === "review" ? "На проверке" : "Устарело"}</td><td>{formatMoscowDate(issue.lastSeenAt)}</td><td><a href={`https://crm.topnlab.ru/object-card/${encodeURIComponent(issue.canonicalId)}`} target="_blank" rel="noreferrer">Открыть в Topnlab</a></td></tr>; })}</tbody></table></div>}
    {pageCount > 1 ? <nav aria-label="Страницы проблем" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16 }}><button type="button" disabled={page === 1} onClick={() => setPage(page - 1)}>Назад</button><span>Страница {page} из {pageCount}</span><button type="button" disabled={page === pageCount} onClick={() => setPage(page + 1)}>Вперёд</button></nav> : null}
  </>;
}
