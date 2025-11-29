import { useEffect, useMemo, useState } from "react";
import "./App.css";

const API_BASE = "http://localhost:8080";

function App() {
  const [pdfs, setPdfs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selected, setSelected] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  // Filters
  const [sizeFilter, setSizeFilter] = useState("all"); // all | small | medium | large
  const [dateFilter, setDateFilter] = useState("all"); // all | last7 | last30 | older
  const [sortKey, setSortKey] = useState("modTime");   // name | size | modTime
  const [sortDir, setSortDir] = useState("desc");      // asc | desc
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    async function fetchPdfs() {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/api/pdfs`);
        if (!res.ok) throw new Error("Failed to load PDFs");
        const raw = await res.json();

        // Normalize data: ensure modTime is Date and url has leading slash
        const data = raw.map((pdf) => ({
          ...pdf,
          modTime: new Date(pdf.modTime),
          url: pdf.url?.startsWith("/") ? pdf.url : `/${pdf.url}`,
        }));

        setPdfs(data);
        if (data.length > 0) setSelected(data[0]);
      } catch (err) {
        setError(err.message || "Something went wrong");
      } finally {
        setLoading(false);
      }
    }

    fetchPdfs();
  }, []);

  const filteredAndSorted = useMemo(() => {
    const now = new Date();

    let items = pdfs
      .filter((pdf) => {
        // search by name
        if (
          searchTerm &&
          !pdf.name.toLowerCase().includes(searchTerm.toLowerCase())
        ) {
          return false;
        }

        // size filter (in bytes)
        if (sizeFilter !== "all") {
          const kb = pdf.size / 1024;
          if (sizeFilter === "small" && kb > 5000) return false; // <= ~5MB
          if (sizeFilter === "medium" && (kb <= 5000 || kb > 20000)) return false; // 5–20MB
          if (sizeFilter === "large" && kb <= 20000) return false; // > 20MB
        }

        // date filter
        if (dateFilter !== "all") {
          const diffDays =
            (now.getTime() - pdf.modTime.getTime()) / (1000 * 60 * 60 * 24);

          if (dateFilter === "last7" && diffDays > 7) return false;
          if (dateFilter === "last30" && diffDays > 30) return false;
          if (dateFilter === "older" && diffDays <= 30) return false;
        }

        return true;
      });

    items.sort((a, b) => {
      let va, vb;
      switch (sortKey) {
        case "name":
          va = a.name.toLowerCase();
          vb = b.name.toLowerCase();
          break;
        case "size":
          va = a.size;
          vb = b.size;
          break;
        case "modTime":
        default:
          va = a.modTime.getTime();
          vb = b.modTime.getTime();
      }

      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return items;
  }, [pdfs, sizeFilter, dateFilter, sortKey, sortDir, searchTerm]);

  useEffect(() => {
    // Synchronize selection with the filtered list — if selected is no longer
    // present (e.g., it got filtered out), then pick the first visible file or
    // clear selection. This keeps preview consistent with the list.
    if (!selected) return;
    const present = filteredAndSorted.find((p) => p.url === selected.url || p.name === selected.name);
    if (!present) {
      if (filteredAndSorted.length > 0) setSelected(filteredAndSorted[0]);
      else setSelected(null);
    }
  }, [filteredAndSorted]);

  const handleSelect = (pdf) => {
    // make sure selected contains normalized values
    setSelected({
      ...pdf,
      modTime: pdf.modTime instanceof Date ? pdf.modTime : new Date(pdf.modTime),
      url: pdf.url?.startsWith("/") ? pdf.url : `/${pdf.url}`,
    });
  };

  useEffect(() => {
    // when selected changes, show preview loading indicator
    if (selected) setPreviewLoading(true);
  }, [selected]);

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>PDF Workspace</h1>
        <p>Dynamic PDF browser with filters (no hardcoded filenames).</p>
      </header>

      <main className="layout">
        {/* Sidebar with filters + list */}
        <section className="sidebar">
          <div className="card">
            <h2>Filters</h2>

            <div className="field">
              <label>Search</label>
              <input
                type="text"
                placeholder="Search by file name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="field">
              <label>Size</label>
              <select
                value={sizeFilter}
                onChange={(e) => setSizeFilter(e.target.value)}
              >
                <option value="all">All sizes</option>
                <option value="small">Small (≤ ~5 MB)</option>
                <option value="medium">Medium (5–20 MB)</option>
                <option value="large">Large (&gt; 20 MB)</option>
              </select>
            </div>

            <div className="field">
              <label>Modified</label>
              <select
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
              >
                <option value="all">Any time</option>
                <option value="last7">Last 7 days</option>
                <option value="last30">Last 30 days</option>
                <option value="older">Older than 30 days</option>
              </select>
            </div>

            <div className="field">
              <label>Sort by</label>
              <div className="sort-buttons">
                <button
                  className={sortKey === "name" ? "active" : ""}
                  onClick={() => toggleSort("name")}
                >
                  Name {sortKey === "name" ? `(${sortDir})` : ""}
                </button>
                <button
                  className={sortKey === "size" ? "active" : ""}
                  onClick={() => toggleSort("size")}
                >
                  Size {sortKey === "size" ? `(${sortDir})` : ""}
                </button>
                <button
                  className={sortKey === "modTime" ? "active" : ""}
                  onClick={() => toggleSort("modTime")}
                >
                  Date {sortKey === "modTime" ? `(${sortDir})` : ""}
                </button>
              </div>
            </div>
          </div>

          <div className="card list-card">
            <h2>
              Files{" "}
              {filteredAndSorted.length > 0
                ? `(${filteredAndSorted.length})`
                : ""}
            </h2>
            {loading && <div className="info">Loading PDFs…</div>}
            {error && <div className="error">{error}</div>}

            {!loading && !error && filteredAndSorted.length === 0 && (
              <div className="info">No PDFs matching filters.</div>
            )}

            <ul className="pdf-list">
              {filteredAndSorted.map((pdf) => (
                <li
                  key={pdf.url || pdf.name}
                  className={
                    selected && selected.name === pdf.name ? "pdf-item active" : "pdf-item"
                  }
                  onClick={() => handleSelect(pdf)}
                >
                  <div className="pdf-main">
                    <span className="pdf-name">{pdf.name}</span>
                    <span className="pdf-size">
                      {(pdf.size / (1024 * 1024)).toFixed(2)} MB
                    </span>
                  </div>
                  <div className="pdf-sub">
                    <span>
                      {pdf.modTime.toLocaleDateString()}{" "}
                      {pdf.modTime.toLocaleTimeString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {/* Viewer */}
        <section className="viewer">
          <div className="card viewer-card">
            <h2>Preview</h2>
            {!selected && (
              <div className="info">
                Select a PDF from the list to view it.
              </div>
            )}
            {selected && (
              <div className="viewer-inner">
                <div className="viewer-header">
                  <div>
                    <div className="pdf-name">{selected.name}</div>
                    <div className="pdf-sub">
                      {(selected.size / (1024 * 1024)).toFixed(2)} MB •{" "}
                      {new Date(selected.modTime).toLocaleString()}
                    </div>
                  </div>
                  <a
                    href={`${API_BASE}${selected.url}`}
                    target="_blank"
                    rel="noreferrer"
                    className="download-link"
                  >
                    Open in new tab
                  </a>
                </div>
                {previewLoading && (
                  <div className="info">Loading preview…</div>
                )}
                <iframe
                  title={selected.name}
                  key={selected.url}
                  src={`${API_BASE}${selected.url}`}
                  className="pdf-frame"
                  onLoad={() => setPreviewLoading(false)}
                />
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
