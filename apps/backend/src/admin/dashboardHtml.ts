export function adminDashboardHtml() {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Bookgram Admin</title>
  <style>
    :root {
      color-scheme: light dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #f7f8fb;
      color: #172033;
    }
    body {
      margin: 0;
      min-height: 100vh;
      background: #f7f8fb;
    }
    header {
      border-bottom: 1px solid #d8deea;
      background: #ffffff;
      padding: 18px 24px;
    }
    main {
      max-width: 1180px;
      margin: 0 auto;
      padding: 24px;
    }
    h1 {
      margin: 0;
      font-size: 22px;
      letter-spacing: 0;
    }
    h2 {
      font-size: 16px;
      margin: 0 0 12px;
    }
    .muted {
      color: #667085;
      font-size: 13px;
      margin-top: 4px;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      margin-bottom: 20px;
    }
    input, select, button {
      font: inherit;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 9px 10px;
      background: #ffffff;
      color: #172033;
    }
    input[type="password"] {
      min-width: 360px;
      max-width: 100%;
    }
    button {
      cursor: pointer;
      background: #172033;
      color: #ffffff;
      border-color: #172033;
    }
    button.secondary {
      background: #ffffff;
      color: #172033;
    }
    section {
      border-top: 1px solid #d8deea;
      padding: 20px 0;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
    }
    .metric {
      border: 1px solid #d8deea;
      border-radius: 8px;
      background: #ffffff;
      padding: 14px;
    }
    .metric strong {
      display: block;
      font-size: 24px;
      margin-top: 4px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: #ffffff;
      border: 1px solid #d8deea;
      border-radius: 8px;
      overflow: hidden;
    }
    th, td {
      text-align: left;
      padding: 10px;
      border-bottom: 1px solid #edf0f5;
      font-size: 13px;
      vertical-align: top;
    }
    th {
      background: #f1f4f9;
      color: #475467;
      font-weight: 650;
    }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      background: #111827;
      color: #e5e7eb;
      padding: 14px;
      border-radius: 8px;
      overflow: auto;
      min-height: 80px;
    }
    @media (prefers-color-scheme: dark) {
      :root, body { background: #0f172a; color: #e5e7eb; }
      header, .metric, table, input, select, button.secondary { background: #111827; color: #e5e7eb; }
      header, section, .metric, table, input, select { border-color: #334155; }
      th { background: #1f2937; color: #cbd5e1; }
      td, th { border-color: #263244; }
      .muted { color: #94a3b8; }
      button { background: #e5e7eb; color: #111827; border-color: #e5e7eb; }
    }
  </style>
</head>
<body>
  <header>
    <h1>Bookgram Admin</h1>
    <div class="muted">Internal operations surface for moderators and admins.</div>
  </header>
  <main>
    <div class="toolbar">
      <input id="token" type="password" placeholder="Bearer token" autocomplete="off" />
      <button id="saveToken">Save Token</button>
      <button class="secondary" id="clearToken">Clear</button>
    </div>

    <section>
      <h2>System Stats</h2>
      <div class="toolbar">
        <button id="loadStats">Refresh Stats</button>
      </div>
      <div class="grid" id="stats"></div>
    </section>

    <section>
      <h2>Content Scores</h2>
      <div class="toolbar">
        <select id="scoreSort">
          <option value="spam">Spam</option>
          <option value="quality">Quality</option>
          <option value="trending">Trending</option>
          <option value="engagement">Engagement</option>
        </select>
        <button id="loadScores">Load Scores</button>
      </div>
      <div id="scores"></div>
    </section>

    <section>
      <h2>Jobs</h2>
      <div class="toolbar">
        <button id="runSpam">Run Spam Score</button>
        <button id="runMaintenance">Run Maintenance</button>
      </div>
      <pre id="jobOutput">No job run yet.</pre>
    </section>
  </main>
  <script>
    const tokenInput = document.getElementById("token");
    const savedToken = localStorage.getItem("bookgram_admin_token");
    if (savedToken) tokenInput.value = savedToken;

    function token() {
      const value = tokenInput.value.trim();
      return value.startsWith("Bearer ") ? value.slice(7) : value;
    }

    async function api(path, options = {}) {
      const response = await fetch(path, {
        ...options,
        headers: {
          "content-type": "application/json",
          authorization: "Bearer " + token(),
          ...(options.headers || {})
        }
      });
      const text = await response.text();
      const payload = text ? JSON.parse(text) : null;
      if (!response.ok) {
        throw new Error(payload?.message || response.statusText);
      }
      return payload;
    }

    function metric(label, value) {
      return '<div class="metric"><span>' + label + '</span><strong>' + value + '</strong></div>';
    }

    document.getElementById("saveToken").onclick = () => {
      localStorage.setItem("bookgram_admin_token", token());
    };
    document.getElementById("clearToken").onclick = () => {
      localStorage.removeItem("bookgram_admin_token");
      tokenInput.value = "";
    };

    document.getElementById("loadStats").onclick = async () => {
      const stats = await api("/admin/stats");
      document.getElementById("stats").innerHTML = [
        metric("Users", stats.users.total),
        metric("Verified", stats.users.verified),
        metric("Active 24h", stats.users.active24h),
        metric("Articles", stats.content.articles),
        metric("Reviews", stats.content.reviews),
        metric("Pending", stats.content.pendingArticles + stats.content.pendingReviews),
        metric("Open Reports", stats.safety.openReports),
        metric("Media MB", Math.round(stats.media.bytes / 1024 / 1024))
      ].join("");
    };

    document.getElementById("loadScores").onclick = async () => {
      const sort = document.getElementById("scoreSort").value;
      const result = await api("/admin/content-scores?sort=" + encodeURIComponent(sort) + "&limit=25");
      const rows = result.data.map((row) => {
        const title = row.content?.title || row.targetId;
        return '<tr><td>' + row.targetType + '</td><td>' + title + '</td><td>' + Math.round(row.spamScore) + '</td><td>' + Math.round(row.qualityScore) + '</td><td>' + Math.round(row.trendingScore) + '</td><td>' + row.reports + '</td></tr>';
      }).join("");
      document.getElementById("scores").innerHTML = '<table><thead><tr><th>Type</th><th>Content</th><th>Spam</th><th>Quality</th><th>Trending</th><th>Reports</th></tr></thead><tbody>' + rows + '</tbody></table>';
    };

    document.getElementById("runSpam").onclick = async () => {
      const result = await api("/moderation/jobs/spam-score", { method: "POST", body: JSON.stringify({ limit: 200, threshold: 70 }) });
      document.getElementById("jobOutput").textContent = JSON.stringify(result, null, 2);
    };
    document.getElementById("runMaintenance").onclick = async () => {
      const result = await api("/moderation/jobs/maintenance", { method: "POST", body: JSON.stringify({ bookLimit: 50 }) });
      document.getElementById("jobOutput").textContent = JSON.stringify(result, null, 2);
    };
  </script>
</body>
</html>`;
}
