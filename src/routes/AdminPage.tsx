import React, { useEffect, useState } from "react";

const API = import.meta.env.VITE_API_BASE;

export default function AdminPage() {
  const [schemas, setSchemas] = useState<string[]>([]);
  const [tables, setTables] = useState<string[]>([]);
  const [schema, setSchema] = useState("");
  const [table, setTable] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);

  const [catalogues, setCatalogues] = useState<string[]>([]);
  const [selectedCatalogue, setSelectedCatalogue] = useState("");
  const [catalogData, setCatalogData] = useState<any>(null);

  // ----------------------------
  // Load schemas
  // ----------------------------
  useEffect(() => {
    fetch(`${API}/admin/schemas`)
      .then(r => r.json())
      .then(setSchemas)
      .catch(console.error);
  }, []);

  useEffect(() => {
    fetch(`${API}/admin/catalogues`)
      .then(r => r.json())
      .then(setCatalogues)
      .catch(console.error);
  }, []);

  const loadTables = (s: string) => {
    setSchema(s);
    fetch(`${API}/admin/tables?schema=${s}`)
      .then(r => r.json())
      .then(setTables);
  };

  const loadTableData = (p = 1) => {
    fetch(`${API}/admin/table-data?schema=${schema}&table=${table}&page=${p}`)
      .then(r => r.json())
      .then(res => {
        setRows(res.rows || []);
        setPage(res.page);
      });
  };

  const loadCatalogue = (name: string) => {
    setSelectedCatalogue(name);
    fetch(`${API}/admin/catalogue/${name}`)
      .then(r => r.json())
      .then(setCatalogData);
  };

  const saveCatalogue = () => {
    fetch(`${API}/admin/catalogue/${selectedCatalogue}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(catalogData),
    });
  };

  return (
    <div className="min-h-screen bg-[#0B131F] text-[#D5E1E3] px-6 py-10">

      <h1 className="text-4xl font-bold mb-10 text-center">
        Admin Kerelia
      </h1>

      {/* ===================== DB BROWSER CARD ===================== */}
      <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl p-8 max-w-5xl mx-auto mb-14 shadow-xl">
        <h2 className="text-2xl font-semibold mb-6">🔵 Base de données</h2>

        <div className="flex flex-wrap gap-4 mb-6">
          {/* SCHEMA */}
          <select
            value={schema}
            onChange={(e) => loadTables(e.target.value)}
            className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-[#D5E1E3]"
          >
            <option value="">Choisir un schéma</option>
            {schemas.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>

          {/* TABLE */}
          <select
            value={table}
            disabled={!schema}
            onChange={(e) => {
              setTable(e.target.value);
              loadTableData(1);
            }}
            className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-[#D5E1E3]"
          >
            <option value="">Choisir une table</option>
            {tables.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>

          <button
            onClick={() => loadTableData()}
            className="px-4 py-2 rounded-xl bg-[#FF4F3B] text-white font-semibold shadow hover:opacity-90"
          >
            🔄 Refresh
          </button>
        </div>

        {/* TABLE DATA */}
        {rows.length > 0 && (
          <div className="overflow-auto border border-white/20 rounded-xl">
            <table className="w-full text-sm">
              <thead className="bg-white/10">
                <tr>
                  {Object.keys(rows[0]).map((col) => (
                    <th key={col} className="px-3 py-2 border-b border-white/10">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="odd:bg-white/5">
                    {Object.values(r).map((v, j) => (
                      <td key={j} className="px-3 py-2 border-b border-white/5">
                        {String(v)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* PAGINATION */}
        <div className="flex gap-4 mt-4 items-center">
          <button
            onClick={() => loadTableData(Math.max(1, page - 1))}
            className="px-4 py-2 bg-white/10 rounded-xl border border-white/20 hover:bg-white/20"
          >
            ⬅️
          </button>

          <span className="opacity-80">Page {page}</span>

          <button
            onClick={() => loadTableData(page + 1)}
            className="px-4 py-2 bg-white/10 rounded-xl border border-white/20 hover:bg-white/20"
          >
            ➡️
          </button>
        </div>
      </div>

      {/* ===================== CATALOGUES CARD ===================== */}
      <div className="bg-white/10 backdrop-blur-xl border border-white/10 rounded-2xl p-8 max-w-5xl mx-auto shadow-xl">
        <h2 className="text-2xl font-semibold mb-6">🟢 Catalogues JSON</h2>

        <select
          value={selectedCatalogue}
          onChange={(e) => loadCatalogue(e.target.value)}
          className="px-4 py-2 rounded-xl bg-white/10 border border-white/20 text-[#D5E1E3]"
        >
          <option value="">Sélectionner un catalogue…</option>
          {catalogues.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        {catalogData && (
          <>
            <textarea
              value={JSON.stringify(catalogData, null, 2)}
              onChange={(e) => {
                try {
                  setCatalogData(JSON.parse(e.target.value));
                } catch {}
              }}
              className="w-full h-96 mt-6 bg-black/20 border border-white/20 rounded-xl p-4 font-mono text-sm"
            />

            <button
              onClick={saveCatalogue}
              className="mt-4 px-6 py-3 rounded-xl bg-[#FF4F3B] text-white font-semibold hover:opacity-90"
            >
              💾 Enregistrer
            </button>
          </>
        )}
      </div>
    </div>
  );
}
