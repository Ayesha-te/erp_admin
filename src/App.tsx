import { useCallback, useEffect, useState, type FormEvent } from "react";

const API = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "http://127.0.0.1:8000/api";
const APP_URL = (import.meta.env.VITE_BAKERY_APP_URL as string | undefined) || "";
type Bakery = { id: number; name: string; slug: string; is_active: boolean; created_at: string };
type BUser = { id: string; email: string; full_name: string; employee_code: string; role: string; is_active: boolean };

let access = sessionStorage.getItem("bh.platform.access") || "";

async function api<T>(path: string, init: RequestInit = {}, auth = true): Promise<T> {
  const headers = new Headers(init.headers);
  if (init.body) headers.set("Content-Type", "application/json");
  if (auth && access) headers.set("Authorization", `Bearer ${access}`);
  const r = await fetch(`${API}/${path}`, { ...init, headers });
  const text = await r.text();
  const data = text ? JSON.parse(text) : null;
  if (!r.ok) {
    const msg = data?.detail || (data && typeof data === "object" ? Object.entries(data).map(([k, v]) => `${k}: ${Array.isArray(v) ? v.join(" ") : v}`).join(" · ") : "") || `Request failed (${r.status})`;
    throw Object.assign(new Error(msg), { status: r.status });
  }
  return data as T;
}

function Login({ onDone }: { onDone: () => void }) {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState("");
  const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr("");
    try {
      const res = await api<{ access: string }>("auth/login/", { method: "POST", body: JSON.stringify({ email, password }) }, false);
      access = res.access; sessionStorage.setItem("bh.platform.access", access); onDone();
    } catch (x) { setErr((x as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="login"><form className="panel" onSubmit={submit}>
      <h1>BakeHub Control Room</h1><div className="muted">Platform owner sign-in</div>
      <label>Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
      <label>Password</label><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
      {err && <div className="err">{err}</div>}
      <button className="primary" style={{ width: "100%", marginTop: 16 }} disabled={busy}>{busy ? "Signing in…" : "Sign in"}</button>
    </form></div>
  );
}

function Dashboard({ onLogout }: { onLogout: () => void }) {
  const [rows, setRows] = useState<Bakery[]>([]); const [err, setErr] = useState(""); const [ok, setOk] = useState("");
  const [users, setUsers] = useState<{ bakery: Bakery; list: BUser[] } | null>(null);
  const [f, setF] = useState({ name: "", slug: "", admin_name: "", admin_email: "", admin_password: "" });
  const [busy, setBusy] = useState(false);

  const guard = useCallback((x: unknown) => { const e = x as Error & { status?: number }; if (e.status === 401) onLogout(); else setErr(e.message); }, [onLogout]);
  const load = useCallback(async () => {
    try { const d = await api<Bakery[] | { results: Bakery[] }>("platform/bakeries/"); setRows(Array.isArray(d) ? d : d.results); } catch (x) { guard(x); }
  }, [guard]);
  useEffect(() => { void load(); }, [load]);

  async function create(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr(""); setOk("");
    try {
      const b = await api<Bakery>("platform/bakeries/", { method: "POST", body: JSON.stringify(f) });
      setOk(`Created "${b.name}". Bakery code: ${b.slug} · admin login: ${f.admin_email}`);
      setF({ name: "", slug: "", admin_name: "", admin_email: "", admin_password: "" }); await load();
    } catch (x) { guard(x); } finally { setBusy(false); }
  }
  async function toggle(b: Bakery) {
    if (b.is_active && !confirm(`Suspend ${b.name}? Nobody there will be able to sign in.`)) return;
    try { await api(`platform/bakeries/${b.id}/`, { method: "PATCH", body: JSON.stringify({ is_active: !b.is_active }) }); await load(); } catch (x) { guard(x); }
  }
  async function reset(b: Bakery) {
    const pw = prompt(`New password for the ${b.name} administrator (min 8 chars):`); if (!pw) return;
    try { const r = await api<{ admin_email: string }>(`platform/bakeries/${b.id}/reset-admin-password/`, { method: "POST", body: JSON.stringify({ password: pw }) }); setOk(`Password reset for ${r.admin_email}.`); } catch (x) { guard(x); }
  }
  async function showUsers(b: Bakery) {
    try { setUsers({ bakery: b, list: await api<BUser[]>(`platform/bakeries/${b.id}/users/`) }); } catch (x) { guard(x); }
  }
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  return (<>
    <div className="top"><b>BakeHub Control Room</b><button onClick={onLogout}>Sign out</button></div>
    <div className="wrap">
      <div>
        {ok && <div className="ok">{ok}</div>}{err && <div className="err" style={{ marginBottom: 14 }}>{err}</div>}
        <div className="panel"><h2>Bakeries ({rows.length})</h2>
          <table><thead><tr><th>Name</th><th>Code</th><th>Status</th><th></th></tr></thead><tbody>
            {rows.map((b) => (<tr key={b.id}>
              <td><b>{b.name}</b></td><td><code>{b.slug}</code></td>
              <td><span className={`badge ${b.is_active ? "on" : "off"}`}>{b.is_active ? "Active" : "Suspended"}</span></td>
              <td><div className="actions">
                <button onClick={() => showUsers(b)}>Users</button>
                <button onClick={() => reset(b)}>Reset admin pw</button>
                <button className={b.is_active ? "danger" : ""} onClick={() => toggle(b)}>{b.is_active ? "Suspend" : "Activate"}</button>
                {APP_URL && <a href={APP_URL} target="_blank" rel="noreferrer"><button>Open app</button></a>}
              </div></td></tr>))}
            {!rows.length && <tr><td colSpan={4} className="muted">No bakeries yet. Create the first one.</td></tr>}
          </tbody></table>
        </div>
        {users && <div className="panel" style={{ marginTop: 20 }}><h2>Users of {users.bakery.name}</h2>
          <table><thead><tr><th>Name</th><th>Email</th><th>Code</th><th>Role</th></tr></thead><tbody>
            {users.list.map((u) => <tr key={u.id}><td>{u.full_name}</td><td>{u.email}</td><td>{u.employee_code}</td><td>{u.role}{u.is_active ? "" : " (inactive)"}</td></tr>)}
          </tbody></table></div>}
      </div>
      <form className="panel" onSubmit={create}><h2>New bakery</h2>
        <label>Bakery name</label><input value={f.name} onChange={set("name")} required />
        <label>Bakery code (optional)</label><input value={f.slug} onChange={set("slug")} placeholder="auto from name" />
        <label>Admin full name</label><input value={f.admin_name} onChange={set("admin_name")} required />
        <label>Admin email</label><input type="email" value={f.admin_email} onChange={set("admin_email")} required />
        <label>Admin password (min 8)</label><input type="password" value={f.admin_password} onChange={set("admin_password")} minLength={8} required />
        <button className="primary" style={{ width: "100%", marginTop: 16 }} disabled={busy}>{busy ? "Creating… (about 10s)" : "Create bakery"}</button>
        <p className="muted">The admin signs in to the bakery app with the bakery code and employee code ADMIN (or email), then adds their own staff and roles.</p>
      </form>
    </div></>);
}

export function App() {
  const [authed, setAuthed] = useState(!!access);
  const logout = useCallback(() => { access = ""; sessionStorage.removeItem("bh.platform.access"); setAuthed(false); }, []);
  return authed ? <Dashboard onLogout={logout} /> : <Login onDone={() => setAuthed(true)} />;
}
