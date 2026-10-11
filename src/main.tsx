import React, {
  useState,
  useEffect,
  type ReactNode,
  type FormEvent,
} from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

type Task = { id: number; title: string; status: string; priority: string };
type Product = {
  id: number;
  sku: string;
  name: string;
  quantity: number;
  threshold: number;
  low_stock: number;
};
type Movement = { id: number; name: string; note: string; delta: number };
type BookingRecord = {
  id: number;
  resource: string;
  guest: string;
  starts_at: string;
  ends_at: string;
};
type Expense = {
  id: number;
  label: string;
  payer: string;
  cents: number;
  participants: string[];
};
type Balance = { person: string; cents: number };
type Settlement = { from: string; to: string; cents: number };
type Inbox = { id: string; name: string; secret: string };
type CapturedEvent = {
  id: number;
  event_key: string;
  body: string;
  received_at: string;
};
type DocumentRecord = { id: number; title: string; body: string };
async function api(path: string, method = "GET", body?: unknown) {
  const res = await fetch("/api" + path, {
    method,
    headers:
      body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return null;
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed.");
  return data;
}
function useLoad<T>(path: string, revision: number) {
  const [data, setData] = useState<T>(),
    [error, setError] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    setError("");
    fetch("/api" + path, { signal: controller.signal })
      .then(async (r) => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error);
        return d;
      })
      .then(setData)
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      });
    return () => controller.abort();
  }, [path, revision]);
  return { data, error };
}
const money = (cents: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(
    cents / 100,
  );
function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="notice" role="alert">
      {children}
    </p>
  );
}
function Field({
  label,
  name,
  type = "text",
  placeholder,
  required = true,
  min,
  step,
  children,
}: {
  label: string;
  name: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  min?: string;
  step?: string;
  children?: ReactNode;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      {children ? (
        <select aria-label={label} name={name} required={required}>
          {children}
        </select>
      ) : type === "textarea" ? (
        <textarea
          aria-label={label}
          name={name}
          placeholder={placeholder}
          required={required}
          rows={5}
        />
      ) : (
        <input
          aria-label={label}
          name={name}
          type={type}
          placeholder={placeholder}
          required={required}
          min={min}
          step={step}
        />
      )}
    </label>
  );
}
function Form({
  title,
  children,
  submit,
  onSubmit,
}: {
  title: string;
  children: ReactNode;
  submit: string;
  onSubmit: (f: FormData) => Promise<void>;
}) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [success, setSuccess] = useState("");
  async function send(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setError("");
    setSuccess("");
    try {
      await onSubmit(new FormData(form));
      form.reset();
      setSuccess("Saved.");
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel">
      <h2>{title}</h2>
      <form onSubmit={send}>
        {children}
        {error && <Notice>{error}</Notice>}
        <div className="form-footer">
          <button disabled={busy}>{busy ? "Saving…" : submit}</button>
          {success && <span role="status">{success}</span>}
        </div>
      </form>
    </section>
  );
}
type Props = { revision: number; refresh: () => void };
function Tasks({ revision, refresh }: Props) {
  const { data, error } = useLoad<Task[]>("/tasks", revision),
    [actionError, setError] = useState("");
  async function move(id: number, status: string) {
    try {
      await api("/tasks/" + id, "PATCH", { status });
      setError("");
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }
  return (
    <>
      <Form
        title="Capture a task"
        submit="Add task"
        onSubmit={async (f) => {
          await api("/tasks", "POST", {
            title: f.get("title"),
            priority: f.get("priority"),
          });
          refresh();
        }}
      >
        <div className="form-row">
          <Field
            label="Task title"
            name="title"
            placeholder="What needs to happen?"
          />
          <Field label="Priority" name="priority">
            <option>Medium</option>
            <option>High</option>
            <option>Low</option>
          </Field>
        </div>
      </Form>
      {(error || actionError) && <Notice>{error || actionError}</Notice>}
      <div className="board">
        {["Backlog", "In progress", "Done"].map((status) => (
          <section className="column" key={status}>
            <h2>
              {status}
              <span>
                {data?.filter((t) => t.status === status).length ?? 0}
              </span>
            </h2>
            {data
              ?.filter((t) => t.status === status)
              .map((t) => (
                <article className="task" key={t.id}>
                  <span className={"badge " + t.priority.toLowerCase()}>
                    {t.priority}
                  </span>
                  <h3>{t.title}</h3>
                  <label className="small">
                    Move task
                    <select
                      aria-label={"Status for " + t.title}
                      value={t.status}
                      onChange={(e) => move(t.id, e.target.value)}
                    >
                      {["Backlog", "In progress", "Done"].map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </label>
                </article>
              ))}
          </section>
        ))}
      </div>
    </>
  );
}
function App(){
      const [revision,setRevision]=useState(0);
      return <div className="shell"><aside><a className="brand" href="#"><span className="brand-mark">T</span><span>Taskboard<small>OPEN SOURCE APPLICATION</small></span></a><p className="nav-label">WORKFLOW</p><div className="sidebar-note"><b>Built to explore.</b><p>React · TypeScript · Node.js<br/>SQLite · Playwright</p><span>v0.1 · Local demo</span></div></aside><main><div className="topline"><span>TASKBOARD / WORKFLOW</span><span className="local-tag">LOCAL DEMO</span></div><header><p className="eyebrow">OPEN SOURCE / WORKFLOW</p><h1>Taskboard</h1><p className="lead">An issue tracker with persisted task states and priorities.</p></header><Tasks revision={revision} refresh={()=>setRevision(v=>v+1)}/><footer>Taskboard · MIT licensed source · AI-assisted local demo</footer></main></div>;
    }
    createRoot(document.getElementById("root")!).render(<React.StrictMode><App/></React.StrictMode>);
    