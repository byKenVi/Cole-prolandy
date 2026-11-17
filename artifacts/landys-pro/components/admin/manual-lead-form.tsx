"use client";

import { useId, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { Check, ChevronDown, Paperclip, Search, Upload, X } from "lucide-react";
import { createManualLead, uploadLeadAttachment, type ManualLeadInput } from "@/app/actions/admin";
import {
  LANDYS_BUDGETS,
  LANDYS_LAND_TYPES,
  LANDYS_OTHER_PROJECTS,
  LANDYS_POPULAR_PROJECTS,
  LANDYS_TIMELINES,
  LANDYS_URGENCIES,
} from "@/lib/taxonomy/landys-form";

/**
 * "New request": the landys.co "Get Three Estimates" form, question for
 * question and choice for choice, so a request taken by phone is stored and
 * routed exactly like one sent from the site.
 */

type County = { value: string; label: string };
type Answers = ManualLeadInput;
type Done = { leadId: string; routed: boolean; message: string; uploadErrors: string[] };

const EMPTY: Answers = {
  propertyCounty: "",
  landType: "",
  projectType: "",
  timeline: "",
  budget: "",
  urgency: "",
  description: "",
  firstName: "",
  lastName: "",
  phone: "",
  email: "",
};

const STEPS = [
  { name: "Property", title: "Property details", intro: "A bit about the property and the kind of pro needed." },
  { name: "Scope", title: "Project scope", intro: "What needs doing, when, and the budget the homeowner has in mind." },
  { name: "Contact", title: "Contact details", intro: "Shared with a contractor only after they accept the job." },
] as const;

const MAX_FILES = 5;

const label: React.CSSProperties = {
  display: "block",
  marginBottom: 8,
  font: "600 15px/1.3 var(--ui)",
  color: "var(--ink)",
};
const field: React.CSSProperties = {
  width: "100%",
  height: 48,
  padding: "0 14px",
  borderRadius: 10,
  border: "1px solid var(--fieldLine)",
  background: "var(--field)",
  color: "var(--ink)",
  font: "400 16px/1.3 var(--ui)",
};

function Required() {
  return (
    <span aria-hidden style={{ color: "var(--brass)", marginLeft: 3 }}>
      *
    </span>
  );
}

function validateStep(step: number, a: Answers): string | null {
  if (step === 0) {
    if (!a.propertyCounty) return "Choose the property county.";
    if (!a.landType) return "Choose a land type.";
  }
  if (step === 1) {
    if (!a.projectType) return "Choose a project type.";
    if (!a.timeline) return "Choose when the work should start.";
    if (!a.budget) return "Choose a budget range.";
    if (!a.urgency) return "Choose the urgency.";
    if (a.description.trim().length < 10) return "Describe the project in at least 10 characters.";
  }
  if (step === 2) {
    if (!a.firstName.trim()) return "Enter the first name.";
    if (!a.lastName.trim()) return "Enter the last name.";
    if (a.phone.replace(/\D/g, "").length < 10) return "Enter a 10-digit phone number.";
    if (!/^\S+@\S+\.\S+$/.test(a.email.trim())) return "Enter a valid email address.";
  }
  return null;
}

/** Pill buttons that behave as one radio group. */
function Pills({
  name,
  options,
  value,
  onChange,
  equal = false,
}: {
  name: string;
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  equal?: boolean;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={name}
      style={
        equal
          ? { display: "grid", gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`, gap: 8 }
          : { display: "flex", flexWrap: "wrap", gap: 8 }
      }
      className={equal ? "manual-form-segments" : undefined}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            style={{
              minHeight: 42,
              padding: "0 16px",
              borderRadius: 999,
              border: `1px solid ${selected ? "var(--gold)" : "var(--fieldLine)"}`,
              background: selected ? "var(--gold)" : "var(--field)",
              color: selected ? "#fff" : "var(--ink)",
              font: `${selected ? 600 : 500} 15px/1 var(--ui)`,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Searchable project picker: popular projects first, like landys.co. */
function ProjectPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (p: string) => !q || p.toLowerCase().includes(q);
    return [
      { title: "Popular projects", items: LANDYS_POPULAR_PROJECTS.filter(match) },
      { title: "All projects", items: LANDYS_OTHER_PROJECTS.filter(match) },
    ].filter((g) => g.items.length > 0);
  }, [query]);
  const flat = groups.flatMap((g) => g.items as readonly string[]);

  function pick(project: string) {
    onChange(project);
    setQuery("");
    setOpen(false);
  }

  return (
    <div style={{ position: "relative" }}>
      <div
        className="a-field"
        style={{ ...field, display: "flex", alignItems: "center", gap: 10, padding: "0 12px 0 14px" }}
      >
        <Search size={17} aria-hidden style={{ color: "var(--ink3)", flex: "none" }} />
        <input
          ref={inputRef}
          id="projectType"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && flat[active] ? `${listId}-${active}` : undefined}
          className="a-input"
          value={open ? query : value}
          placeholder={value || "Search project type"}
          onFocus={() => {
            setOpen(true);
            setActive(0);
          }}
          onBlur={() => setTimeout(() => setOpen(false), 120)}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            setOpen(true);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setOpen(true);
              setActive((i) => Math.min(i + 1, flat.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => Math.max(i - 1, 0));
            } else if (e.key === "Enter" && open && flat[active]) {
              e.preventDefault();
              pick(flat[active]);
            } else if (e.key === "Escape") {
              setOpen(false);
            }
          }}
          style={{ flex: 1, minWidth: 0, height: "100%", fontSize: 16 }}
        />
        <ChevronDown size={18} aria-hidden style={{ color: "var(--ink2)", flex: "none" }} />
      </div>
      {open && (
        <div
          id={listId}
          role="listbox"
          aria-label="Project types"
          style={{
            position: "absolute",
            zIndex: 30,
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            maxHeight: 320,
            overflowY: "auto",
            background: "var(--card)",
            border: "1px solid var(--line)",
            borderRadius: 10,
            boxShadow: "var(--shadowMd)",
            padding: 6,
          }}
        >
          {flat.length === 0 && (
            <p style={{ margin: 0, padding: "12px 10px", font: "400 15px/1.4 var(--ui)", color: "var(--ink2)" }}>
              No project matches. The landys.co list is fixed; pick the closest one.
            </p>
          )}
          {groups.map((group) => (
            <div key={group.title} role="group" aria-label={group.title}>
              <p style={{ margin: 0, padding: "10px 10px 6px", font: "600 13px/1 var(--ui)", color: "var(--ink3)" }}>
                {group.title}
              </p>
              {group.items.map((project) => {
                const index = flat.indexOf(project);
                const selected = project === value;
                return (
                  <div
                    key={project}
                    id={`${listId}-${index}`}
                    role="option"
                    aria-selected={selected}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      pick(project);
                    }}
                    onMouseEnter={() => setActive(index)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: 10,
                      padding: "10px",
                      borderRadius: 7,
                      cursor: "pointer",
                      font: `${selected ? 600 : 400} 15px/1.3 var(--ui)`,
                      color: "var(--ink)",
                      background: index === active ? "var(--card2)" : "transparent",
                    }}
                  >
                    {project}
                    {selected && <Check size={16} aria-hidden style={{ color: "var(--gold)" }} />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilePicker({ files, onChange }: { files: File[]; onChange: (files: File[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function add(list: FileList | null) {
    if (!list) return;
    onChange([...files, ...Array.from(list)].slice(0, MAX_FILES));
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          add(e.dataTransfer.files);
        }}
        style={{
          width: "100%",
          padding: "22px 16px",
          borderRadius: 10,
          border: `1px dashed ${dragging ? "var(--gold)" : "var(--fieldLine)"}`,
          background: dragging ? "var(--goldSoft)" : "var(--card2)",
          color: "var(--ink)",
          cursor: "pointer",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 6,
        }}
      >
        <Upload size={20} aria-hidden style={{ color: "var(--gold)" }} />
        <span style={{ font: "600 15px/1.3 var(--ui)" }}>Click to upload or drag files here</span>
        <span style={{ font: "400 13px/1.3 var(--ui)", color: "var(--ink2)" }}>
          Photos, videos, PDFs or documents. Up to {MAX_FILES} files, 9 MB each.
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        hidden
        accept="image/*,video/*,.pdf,.doc,.docx,.txt"
        onChange={(e) => {
          add(e.target.files);
          e.target.value = "";
        }}
      />
      {files.length > 0 && (
        <ul style={{ listStyle: "none", margin: "10px 0 0", padding: 0, display: "grid", gap: 6 }}>
          {files.map((file, i) => (
            <li
              key={`${file.name}-${i}`}
              style={{ display: "flex", alignItems: "center", gap: 8, font: "400 14px/1.3 var(--ui)", color: "var(--ink)" }}
            >
              <Paperclip size={15} aria-hidden style={{ color: "var(--ink3)", flex: "none" }} />
              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {file.name}
              </span>
              <span style={{ color: "var(--ink3)", flex: "none" }}>{(file.size / 1024 / 1024).toFixed(1)} MB</span>
              <button
                type="button"
                aria-label={`Remove ${file.name}`}
                onClick={() => onChange(files.filter((_, j) => j !== i))}
                style={{ border: 0, background: "none", color: "var(--ink2)", cursor: "pointer", padding: 4 }}
              >
                <X size={16} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Stepper({ step }: { step: number }) {
  return (
    <ol
      aria-label="Steps"
      style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}
    >
      {STEPS.map((s, i) => {
        const done = i < step;
        const current = i === step;
        return (
          <li key={s.name} aria-current={current ? "step" : undefined} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span
              aria-hidden
              style={{
                width: 30,
                height: 30,
                flex: "none",
                borderRadius: 999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                font: "700 14px/1 var(--ui)",
                border: `2px solid ${done || current ? "var(--gold)" : "var(--fieldLine)"}`,
                background: done ? "var(--gold)" : "var(--card)",
                color: done ? "#fff" : current ? "var(--gold)" : "var(--ink3)",
              }}
            >
              {done ? <Check size={15} strokeWidth={3} /> : i + 1}
            </span>
            <span style={{ font: `${current ? 600 : 500} 15px/1.2 var(--ui)`, color: current ? "var(--ink)" : "var(--ink2)" }}>
              {s.name}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function ManualLeadForm({ counties }: { counties: County[] }) {
  const [answers, setAnswers] = useState<Answers>({ ...EMPTY });
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<Done | null>(null);
  const [pending, startTransition] = useTransition();
  const [progress, setProgress] = useState<string | null>(null);

  function set<K extends keyof Answers>(key: K, value: Answers[K]) {
    setAnswers((current) => ({ ...current, [key]: value }));
    setError(null);
  }

  function next() {
    const problem = validateStep(step, answers);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    if (step < STEPS.length - 1) {
      setStep(step + 1);
      return;
    }
    startTransition(async () => {
      setProgress("Creating the request");
      const result = await createManualLead(answers);
      if (!result.ok || !result.leadId) {
        setProgress(null);
        setError(result.message ?? "The request could not be created.");
        return;
      }
      const uploadErrors: string[] = [];
      for (const [i, file] of files.entries()) {
        setProgress(`Uploading file ${i + 1} of ${files.length}`);
        const body = new FormData();
        body.append("file", file);
        const uploaded = await uploadLeadAttachment(result.leadId, body);
        if (!uploaded.ok) uploadErrors.push(uploaded.message);
      }
      setProgress(null);
      setDone({
        leadId: result.leadId,
        routed: result.reviewStatus === "routed",
        message: result.message ?? "",
        uploadErrors,
      });
    });
  }

  if (done) {
    return (
      <div role="status" style={{ display: "grid", gap: 14, maxWidth: 560 }}>
        <h2 style={{ margin: 0, font: "700 24px/1.2 var(--head)", color: "var(--ink)" }}>
          {done.routed ? "Request created and sent" : "Request saved, waiting for you"}
        </h2>
        <p style={{ margin: 0, font: "400 16px/1.5 var(--ui)", color: "var(--ink2)" }}>{done.message}</p>
        {done.uploadErrors.map((message) => (
          <p key={message} style={{ margin: 0, font: "400 15px/1.45 var(--ui)", color: "var(--danger)" }}>
            {message}
          </p>
        ))}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 6 }}>
          <Link href={`/admin/leads/${done.leadId}`} className="a-gold" style={primaryButton}>
            Open the request
          </Link>
          <button
            type="button"
            className="a-ghostbtn"
            style={secondaryButton}
            onClick={() => {
              setAnswers({ ...EMPTY });
              setFiles([]);
              setStep(0);
              setDone(null);
            }}
          >
            Enter another request
          </button>
        </div>
      </div>
    );
  }

  const current = STEPS[step]!;
  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        next();
      }}
      style={{ display: "grid", gap: 24, maxWidth: 640 }}
    >
      <Stepper step={step} />

      <div>
        <h2 style={{ margin: 0, font: "700 22px/1.2 var(--head)", color: "var(--ink)" }}>{current.title}</h2>
        <p style={{ margin: "6px 0 0", font: "400 15px/1.45 var(--ui)", color: "var(--ink2)" }}>{current.intro}</p>
      </div>

      {step === 0 && (
        <>
          <div>
            <label htmlFor="propertyCounty" style={label}>
              Property county
              <Required />
            </label>
            <select
              id="propertyCounty"
              value={answers.propertyCounty}
              onChange={(e) => set("propertyCounty", e.target.value)}
              style={{ ...field, appearance: "auto" }}
            >
              <option value="">Select county</option>
              {counties.map((county) => (
                <option key={county.value} value={county.value}>
                  {county.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p style={label} id="landType-label">
              Land type
              <Required />
            </p>
            <Pills
              name="Land type"
              options={LANDYS_LAND_TYPES.map((t) => ({ value: t, label: t }))}
              value={answers.landType}
              onChange={(v) => set("landType", v)}
            />
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <div>
            <label htmlFor="projectType" style={label}>
              Project type
              <Required />
            </label>
            <ProjectPicker value={answers.projectType} onChange={(v) => set("projectType", v)} />
          </div>
          <div>
            <label htmlFor="timeline" style={label}>
              Timeline
              <Required />
            </label>
            <select
              id="timeline"
              value={answers.timeline}
              onChange={(e) => set("timeline", e.target.value)}
              style={{ ...field, appearance: "auto" }}
            >
              <option value="">When should work start?</option>
              {LANDYS_TIMELINES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <p style={label}>
              Budget range
              <Required />
            </p>
            <Pills
              name="Budget range"
              equal
              options={LANDYS_BUDGETS}
              value={answers.budget}
              onChange={(v) => set("budget", v)}
            />
          </div>
          <div>
            <p style={label}>
              Urgency
              <Required />
            </p>
            <Pills
              name="Urgency"
              options={LANDYS_URGENCIES.map((u) => ({ value: u, label: u }))}
              value={answers.urgency}
              onChange={(v) => set("urgency", v)}
            />
          </div>
          <div>
            <label htmlFor="description" style={label}>
              Project description
              <Required />
            </label>
            <textarea
              id="description"
              rows={5}
              value={answers.description}
              onChange={(e) => set("description", e.target.value)}
              placeholder="Describe the work needed, the current condition, and any specifics that would help a contractor scope the job. At least 10 characters."
              style={{ ...field, height: "auto", padding: "12px 14px", lineHeight: 1.5, resize: "vertical" }}
            />
          </div>
          <div>
            <p style={label}>
              Upload photos or documents <span style={{ fontWeight: 400, color: "var(--ink3)" }}>(optional)</span>
            </p>
            <FilePicker files={files} onChange={setFiles} />
          </div>
        </>
      )}

      {step === 2 && (
        <div className="manual-form-pair" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          {(
            [
              ["firstName", "First name", "text", "given-name", "Enter the first name"],
              ["lastName", "Last name", "text", "family-name", "Enter the last name"],
              ["phone", "Phone", "tel", "tel", "(555) 555-0100"],
              ["email", "Email", "email", "email", "name@example.com"],
            ] as const
          ).map(([key, text, type, autoComplete, placeholder]) => (
            <div key={key}>
              <label htmlFor={key} style={label}>
                {text}
                <Required />
              </label>
              <input
                id={key}
                type={type}
                autoComplete={autoComplete}
                placeholder={placeholder}
                value={answers[key]}
                onChange={(e) => set(key, e.target.value)}
                style={field}
              />
            </div>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" style={{ margin: 0, font: "500 15px/1.4 var(--ui)", color: "var(--danger)" }}>
          {error}
        </p>
      )}

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
        <button type="submit" disabled={pending} className="a-gold" style={{ ...primaryButton, opacity: pending ? 0.7 : 1 }}>
          {pending ? progress ?? "Working" : step < STEPS.length - 1 ? "Continue" : "Create request"}
        </button>
        {step > 0 && (
          <button
            type="button"
            disabled={pending}
            className="a-ghostbtn"
            style={secondaryButton}
            onClick={() => {
              setError(null);
              setStep(step - 1);
            }}
          >
            Back
          </button>
        )}
      </div>
    </form>
  );
}

const primaryButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minWidth: 180,
  height: 48,
  padding: "0 22px",
  borderRadius: 10,
  border: "none",
  background: "var(--gold)",
  color: "#fff",
  font: "600 16px/1 var(--ui)",
  textDecoration: "none",
  cursor: "pointer",
};

const secondaryButton: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  height: 48,
  padding: "0 20px",
  borderRadius: 10,
  border: "1px solid var(--fieldLine)",
  background: "var(--card)",
  color: "var(--ink)",
  font: "600 16px/1 var(--ui)",
  cursor: "pointer",
};
