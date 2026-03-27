const SUPA_URL = import.meta.env.VITE_SUPABASE_URL || "https://ecddhpgfdapuxfrlrszo.supabase.co";
const SUPA_KEY = import.meta.env.VITE_SUPABASE_KEY || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVjZGRocGdmZGFwdXhmcmxyc3pvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI4MDIxMDIsImV4cCI6MjA4ODM3ODEwMn0.UlaL7U_4zcuKyPqMjImRERvlU0f6vy9SY0gGb945o6U";

const sb = {
  _h: () => ({
    "Content-Type": "application/json",
    "apikey": SUPA_KEY,
    "Authorization": "Bearer " + SUPA_KEY,
    "Prefer": "return=representation",
  }),

  async select(table, params = "") {
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${params}`, { headers: sb._h() });
    if (!r.ok) { const e = await r.text(); console.error("sb.select", table, e); return []; }
    return r.json();
  },

  async insert(table, row) {
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}`, {
      method: "POST", headers: sb._h(), body: JSON.stringify(row),
    });
    if (!r.ok) { const e = await r.text(); console.error("sb.insert", table, e); return null; }
    const d = await r.json(); return Array.isArray(d) ? d[0] : d;
  },

  async update(table, match, data) {
    const q = Object.entries(match).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join("&");
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${q}`, {
      method: "PATCH", headers: sb._h(), body: JSON.stringify(data),
    });
    if (!r.ok) { const e = await r.text(); console.error("sb.update", table, e); }
  },

  async upsert(table, row, onConflict) {
    const h = { ...sb._h(), "Prefer": "resolution=merge-duplicates,return=representation" };
    if (onConflict) h["on_conflict"] = onConflict;
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?on_conflict=${onConflict || "id"}`, {
      method: "POST", headers: h, body: JSON.stringify(row),
    });
    if (!r.ok) { const e = await r.text(); console.error("sb.upsert", table, e); return null; }
    const d = await r.json(); return Array.isArray(d) ? d[0] : d;
  },

  async delete(table, match) {
    const q = Object.entries(match).map(([k, v]) => `${k}=eq.${encodeURIComponent(v)}`).join("&");
    const r = await fetch(`${SUPA_URL}/rest/v1/${table}?${q}`, {
      method: "DELETE", headers: sb._h(),
    });
    if (!r.ok) { const e = await r.text(); console.error("sb.delete", table, e); }
  },

  channel(table, cb) {
    return setInterval(cb, 3000);
  },

  // ── Storage ──
  async upload(bucket, path, file) {
    const r = await fetch(`${SUPA_URL}/storage/v1/object/${bucket}/${path}`, {
      method: "POST",
      headers: {
        "apikey": SUPA_KEY,
        "Authorization": "Bearer " + SUPA_KEY,
      },
      body: file,
    });
    if (!r.ok) { const e = await r.text(); console.error("sb.upload", e); return null; }
    return `${SUPA_URL}/storage/v1/object/public/${bucket}/${path}`;
  },

  async deleteFile(bucket, path) {
    await fetch(`${SUPA_URL}/storage/v1/object/${bucket}/${path}`, {
      method: "DELETE",
      headers: { "apikey": SUPA_KEY, "Authorization": "Bearer " + SUPA_KEY },
    });
  },
};

export default sb;
