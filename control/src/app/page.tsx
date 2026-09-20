export const dynamic = "force-dynamic";

const sourceLabels: Record<string, string> = { xml: "XML-фид", api: "API Topnlab", site: "Каталог сайта" };

export default async function Dashboard() {
  const { db } = await import("../lib/db");
  const run = await db.auditRun.findFirst({ orderBy: { startedAt: "desc" }, include: { snapshots: true } });
  const issues = await db.auditIssue.findMany({ where: { status: { in: ["open", "stale", "review"] } }, orderBy: { lastSeenAt: "desc" }, take: 100 });
  return <main style={{ maxWidth: 1180, margin: "40px auto", fontFamily: "Arial, sans-serif", padding: 24 }}>
    <h1>Контроль синхронизации объектов</h1>
    <p>Тестовый read-only контур. Он ничего не изменяет в Topnlab и на сайте.</p>
    {!run ? <p>Проверки ещё не запускались.</p> : <>
      <p>Последний запуск: {run.status} · {run.startedAt.toLocaleString("ru-RU")} · версия правил {run.ruleVersion}</p>
      <section style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        {run.snapshots.map((snapshot) => <article key={snapshot.id} style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16, minWidth: 220 }}>
          <strong>{sourceLabels[snapshot.source] ?? snapshot.source}</strong><br />
          Статус: {snapshot.status}<br />
          Объектов: {snapshot.recordCount ?? "—"}<br />
          Снимок: {snapshot.readFinishedAt.toLocaleString("ru-RU")}<br />
          {snapshot.errorCode ? <>Код ошибки: {snapshot.errorCode}</> : null}
        </article>)}
      </section>
    </>}
    <h2 style={{ marginTop: 40 }}>Проблемы объектов</h2>
    {issues.length === 0 ? <p>Открытых проблем нет.</p> : <table style={{ width: "100%", borderCollapse: "collapse" }}><thead><tr><th align="left">ID</th><th align="left">Правило</th><th align="left">Статус</th><th align="left">Обнаружено</th></tr></thead><tbody>{issues.map((issue) => <tr key={issue.id}><td>{issue.canonicalId}</td><td>{issue.ruleCode}</td><td>{issue.status}</td><td>{issue.lastSeenAt.toLocaleString("ru-RU")}</td></tr>)}</tbody></table>}
  </main>;
}
