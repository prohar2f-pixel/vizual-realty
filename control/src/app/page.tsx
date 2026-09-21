export const dynamic = "force-dynamic";

const sourceLabels: Record<string, string> = { xml: "XML-фид", api: "API Topnlab", site: "Каталог сайта" };
const sourceOrder = ["xml", "api", "site"];

export default async function Dashboard() {
  const { requireSession } = await import("../lib/security/request");
  await requireSession();
  const { RunButton } = await import("./RunButton");
  const { IssuesTable } = await import("./IssuesTable");
  const { getDb } = await import("../lib/db");
  const { formatMoscowDate, summarizeIssues } = await import("../lib/dashboard");
  const db = getDb();
  const run = await db.auditRun.findFirst({ orderBy: { startedAt: "desc" }, include: { snapshots: true } });
  const issues = await db.auditIssue.findMany({ where: { status: { in: ["open", "stale", "review"] } }, orderBy: { lastSeenAt: "desc" }, include: { observations: { orderBy: { auditRun: { startedAt: "desc" } }, take: 1 } } });
  const snapshots = run ? sourceOrder.map((source) => run.snapshots.find((snapshot) => snapshot.source === source)).filter((snapshot): snapshot is NonNullable<typeof snapshot> => Boolean(snapshot)) : [];
  const summary = summarizeIssues(issues);
  return <main style={{ maxWidth: 1180, margin: "40px auto", fontFamily: "Arial, sans-serif", padding: 24, color: "#18251f" }}>
    <p style={{ color: "#52715d", fontWeight: 700, margin: 0 }}>ВИЗУАЛ · КОНТРОЛЬ ДАННЫХ</p>
    <h1 style={{ marginBottom: 8 }}>Контроль синхронизации объектов</h1>
    <p style={{ maxWidth: 680, color: "#526158" }}>Панель только сравнивает источники. Она не вносит изменений ни в Topnlab, ни в каталог сайта.</p>
    <RunButton />
    {!run ? <p>Проверки ещё не запускались.</p> : <>
      <p><strong>Последний запуск:</strong> {run.status === "success" ? "успешно" : run.status === "partial" ? "частично" : "с ошибкой"} · {formatMoscowDate(run.startedAt)} · правила {run.ruleVersion}</p>
      <section aria-label="Сводка источников" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16 }}>
        {snapshots.map((snapshot) => <article key={snapshot.id} style={{ border: "1px solid #d9e4dc", background: "#f8fbf8", borderRadius: 12, padding: 16 }}>
          <strong>{sourceLabels[snapshot.source] ?? snapshot.source}</strong><br />
          Статус: {snapshot.status === "success" ? "получен" : "ошибка"}<br />
          Объектов: {snapshot.recordCount ?? "—"}<br />
          Снимок: {formatMoscowDate(snapshot.readFinishedAt)}<br />
          {snapshot.errorCode ? <>Код ошибки: {snapshot.errorCode}</> : null}
        </article>)}
      </section>
      <section aria-label="Сводка расхождений" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12, marginTop: 20 }}>
        <article style={{ borderLeft: "4px solid #ca8a04", padding: "8px 12px", background: "#fffbeb" }}><strong>{summary.apiOnly}</strong><br />есть в API, нет в XML</article>
        <article style={{ borderLeft: "4px solid #ca8a04", padding: "8px 12px", background: "#fffbeb" }}><strong>{summary.xmlOnly}</strong><br />есть в XML, нет в API</article>
        <article style={{ borderLeft: "4px solid #b45309", padding: "8px 12px", background: "#fff7ed" }}><strong>{summary.siteOnly}</strong><br />есть на сайте, нет в XML</article>
        <article style={{ borderLeft: "4px solid #b45309", padding: "8px 12px", background: "#fff7ed" }}><strong>{summary.xmlOnlySite}</strong><br />есть в XML, нет на сайте</article>
      </section>
    </>}
    <h2 style={{ marginTop: 40 }}>Проблемы объектов</h2>
    <p style={{ color: "#526158" }}>Исправлять данные нужно в Topnlab; после следующей проверки исчезнувшее расхождение закроется автоматически.</p>
    {issues.length === 0 ? <p>Открытых проблем нет.</p> : <IssuesTable issues={issues.map((issue) => {
      const evidence = issue.observations[0]?.evidence;
      const agentName = evidence && typeof evidence === "object" && !Array.isArray(evidence) && typeof evidence.agentName === "string" ? evidence.agentName : null;
      return { ...issue, agentName, lastSeenAt: issue.lastSeenAt.toISOString() };
    })} />}
  </main>;
}
