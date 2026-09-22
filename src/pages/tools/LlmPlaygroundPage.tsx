import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, FormEvent } from "react";

const API = import.meta.env.VITE_API_BASE || "";
const MAX_BATCH = 80;
const BATCH_PAUSE_MS = 400;
const MAX_RETRIES = 4;
const RETRY_BASE_MS = 1500;

const MISTRAL_MODELS = [
  "mistral-small-latest",
  "mistral-medium-latest",
  "mistral-large-latest",
  "ministral-8b-latest",
  "zai-glm-5-2",
] as const;

type MistralModel = (typeof MISTRAL_MODELS)[number];
type ReasoningEffort = "none" | "high" | "xhigh";
type PlayMode = "single" | "batch";
type RunStatus = "idle" | "queued" | "running" | "done" | "failed";

const MODEL_LABELS: Record<MistralModel, string> = {
  "mistral-small-latest": "Small",
  "mistral-medium-latest": "Medium",
  "mistral-large-latest": "Large",
  "ministral-8b-latest": "Ministral 8B",
  "zai-glm-5-2": "GLM 5.2 (Z.ai)",
};

const REASONING_EFFORTS: Record<MistralModel, readonly ReasoningEffort[]> = {
  "mistral-small-latest": ["none", "high"],
  "mistral-medium-latest": ["none", "high"],
  "mistral-large-latest": ["none", "high"],
  "ministral-8b-latest": ["none", "high"],
  "zai-glm-5-2": ["none", "high", "xhigh"],
};

const EFFORT_LABELS: Record<ReasoningEffort, string> = {
  none: "Sans raisonnement",
  high: "High",
  xhigh: "Max (xhigh)",
};

/** Facteur de sortie estimée selon l'effort (le raisonnement gonfle fortement l'output). */
const EFFORT_OUT_FACTOR: Record<ReasoningEffort, number> = {
  none: 1,
  high: 3,
  xhigh: 5,
};

/** USD / million de jetons (entrée, sortie) — tarifs API Mistral, sept. 2026. */
const PRIX_USD_PAR_M: Record<MistralModel, { input: number; output: number }> = {
  "mistral-small-latest": { input: 0.15, output: 0.6 },
  "mistral-medium-latest": { input: 1.5, output: 7.5 },
  "mistral-large-latest": { input: 0.5, output: 1.5 },
  "ministral-8b-latest": { input: 0.15, output: 0.15 },
  "zai-glm-5-2": { input: 1.4, output: 4.4 },
};

const CHARS_PER_TOKEN = 4;
const ESTIMATED_OUTPUT_RATIO = 0.25;
const ESTIMATED_OUTPUT_MIN = 200;
const ESTIMATED_OUTPUT_MAX = 4096;

type TokenUsage = {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
};

type CostBreakdown = {
  input_usd: number;
  output_usd: number;
  total_usd: number;
  price_input_per_m: number;
  price_output_per_m: number;
};

type ChatResponse = {
  content: string;
  parsed: unknown;
  model: string;
  reasoning_effort?: string;
  duration_s: number;
  tokens: TokenUsage;
  cost: CostBreakdown;
};

type SessionCall = {
  model: string;
  tokens: TokenUsage;
  cost: CostBreakdown;
  duration_s: number;
};

type BatchItem = {
  id: string;
  userPrompt: string;
  label?: string;
  open: boolean;
  status: RunStatus;
  result: ChatResponse | null;
  error: string | null;
};

type JsonIterateOption = {
  id: string;
  arrayPath: string[];
  field: string | null;
  count: number;
  sample: string;
};

const LABEL_KEYS = ["nom", "libelle", "label", "titre", "title", "code_zone", "code", "oap_id", "id", "name"];
const PREFERRED_FIELDS = ["reglementation", "reglementation_generale", "texte", "text", "content", "prompt"];

const STATUS_LABEL: Record<RunStatus, string> = {
  idle: "Prêt",
  queued: "En file",
  running: "En cours",
  done: "Terminé",
  failed: "Échec",
};

function newItemId(): string {
  return crypto.randomUUID?.() ?? `ctx-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function emptyBatchItem(userPrompt = "", open = true, label?: string): BatchItem {
  return {
    id: newItemId(),
    userPrompt,
    label,
    open,
    status: "idle",
    result: null,
    error: null,
  };
}

function formatJsonPath(option: JsonIterateOption): string {
  const base = option.arrayPath.length ? option.arrayPath.join(".") : "";
  if (!option.field) return base ? `${base}[]` : "[]";
  return base ? `${base}[].${option.field}` : `[].${option.field}`;
}

function navigateToArray(root: unknown, path: string[]): unknown[] {
  let current: unknown = root;
  for (const key of path) {
    if (Array.isArray(current)) {
      current = current.flatMap((item) => {
        if (!item || typeof item !== "object" || Array.isArray(item)) return [];
        const value = (item as Record<string, unknown>)[key];
        if (Array.isArray(value)) return value;
        return value === undefined ? [] : [value];
      });
    } else if (current && typeof current === "object") {
      current = (current as Record<string, unknown>)[key];
    } else {
      return [];
    }
  }
  return Array.isArray(current) ? current : [];
}

function collectJsonOptions(root: unknown, path: string[] = [], acc: JsonIterateOption[] = []): JsonIterateOption[] {
  if (Array.isArray(root)) {
    const strings = root.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    if (strings.length > 0) {
      acc.push({
        id: `${path.join(".")}[]`,
        arrayPath: path,
        field: null,
        count: strings.length,
        sample: strings[0].slice(0, 180),
      });
    }
    const objects = root.filter(
      (item): item is Record<string, unknown> => Boolean(item) && typeof item === "object" && !Array.isArray(item),
    );
    if (objects.length > 0) {
      const stats = new Map<string, { count: number; sample: string }>();
      for (const obj of objects) {
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === "string" && value.trim()) {
            const prev = stats.get(key);
            if (prev) prev.count += 1;
            else stats.set(key, { count: 1, sample: value.slice(0, 180) });
          }
          if (Array.isArray(value)) collectJsonOptions(value, [...path, key], acc);
        }
      }
      for (const [field, info] of stats) {
        acc.push({
          id: `${path.join(".")}[].${field}`,
          arrayPath: path,
          field,
          count: info.count,
          sample: info.sample,
        });
      }
    }
    return acc;
  }
  if (root && typeof root === "object") {
    for (const [key, value] of Object.entries(root as Record<string, unknown>)) {
      collectJsonOptions(value, [...path, key], acc);
    }
  }
  return acc;
}

function rankJsonOptions(options: JsonIterateOption[]): JsonIterateOption[] {
  const seen = new Set<string>();
  return options
    .filter((option) => {
      if (seen.has(option.id)) return false;
      seen.add(option.id);
      return option.count > 0;
    })
    .sort((a, b) => {
      const pref = (field: string | null) => {
        if (!field) return 1;
        const i = PREFERRED_FIELDS.indexOf(field.toLowerCase());
        return i === -1 ? 20 : i;
      };
      const pa = pref(a.field);
      const pb = pref(b.field);
      if (pa !== pb) return pa - pb;
      return b.count - a.count;
    });
}

function extractJsonTexts(
  root: unknown,
  option: JsonIterateOption,
): { text: string; label?: string }[] {
  const rows = navigateToArray(root, option.arrayPath);
  const out: { text: string; label?: string }[] = [];
  for (const item of rows) {
    if (option.field == null) {
      if (typeof item === "string" && item.trim()) out.push({ text: item });
      continue;
    }
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const rec = item as Record<string, unknown>;
    const raw = rec[option.field];
    const text = typeof raw === "string" ? raw : raw != null && typeof raw !== "object" ? String(raw) : "";
    if (!text.trim()) continue;
    const labelKey = LABEL_KEYS.find(
      (key) => key !== option.field && typeof rec[key] === "string" && String(rec[key]).trim(),
    );
    out.push({ text, label: labelKey ? String(rec[labelKey]) : undefined });
  }
  return out;
}

function estimateTokens(text: string): number {
  const n = [...text].length;
  if (n === 0) return 0;
  return Math.max(1, Math.round(n / CHARS_PER_TOKEN));
}

function estimateOutputTokens(inputTokens: number, effort: ReasoningEffort): number {
  if (inputTokens === 0) return 0;
  const factor = EFFORT_OUT_FACTOR[effort];
  const cap = effort === "none" ? ESTIMATED_OUTPUT_MAX : ESTIMATED_OUTPUT_MAX * 2;
  return Math.min(
    cap,
    Math.max(ESTIMATED_OUTPUT_MIN, Math.round(inputTokens * ESTIMATED_OUTPUT_RATIO * factor)),
  );
}

function costFromTokens(model: MistralModel, promptTokens: number, completionTokens: number): CostBreakdown {
  const prix = PRIX_USD_PAR_M[model];
  const input_usd = (promptTokens / 1_000_000) * prix.input;
  const output_usd = (completionTokens / 1_000_000) * prix.output;
  return {
    input_usd,
    output_usd,
    total_usd: input_usd + output_usd,
    price_input_per_m: prix.input,
    price_output_per_m: prix.output,
  };
}

function formatUsd(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "$0";
  if (n < 0.01) return `$${n.toFixed(4)}`;
  return `$${n.toFixed(3)}`;
}

function parseApiError(body: unknown, fallback: string): string {
  const detail = (body as { detail?: unknown } | null)?.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(" · ") || fallback;
  }
  return fallback;
}

function isRetryableError(message: string, status?: number): boolean {
  if (status === 400 || status === 401 || status === 403 || status === 404 || status === 422) {
    return false;
  }
  if (status === 408 || status === 429 || (status != null && status >= 500)) return true;
  const t = message.toLowerCase();
  return [
    "429",
    "quota",
    "timeout",
    "timed out",
    "502",
    "503",
    "500",
    "504",
    "network",
    "failed to fetch",
    "load failed",
    "échec de l'appel",
    "overloaded",
  ].some((marker) => t.includes(marker));
}

const STORAGE_KEY = "kerelia-appel-llm";

type PersistedPrompts = {
  systemPrompt?: string;
  model?: MistralModel;
  jsonMode?: boolean;
  mode?: PlayMode;
  reasoningEffort?: ReasoningEffort;
};

function loadPersisted(): PersistedPrompts {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PersistedPrompts;
  } catch {
    return {};
  }
}

function isMistralModel(value: string): value is MistralModel {
  return (MISTRAL_MODELS as readonly string[]).includes(value);
}

function isReasoningEffort(value: string, model: MistralModel): value is ReasoningEffort {
  return (REASONING_EFFORTS[model] as readonly string[]).includes(value);
}

function clampEffort(model: MistralModel, effort: string): ReasoningEffort {
  if (isReasoningEffort(effort, model)) return effort;
  return "none";
}

function formatChars(n: number): string {
  return n.toLocaleString("fr-FR");
}

function prettyOutput(result: ChatResponse | null): string {
  if (!result) return "";
  if (result.parsed != null) {
    try {
      return JSON.stringify(result.parsed, null, 2);
    } catch {
      return result.content;
    }
  }
  return result.content;
}

async function sleep(ms: number): Promise<void> {
  await new Promise((resolve) => window.setTimeout(resolve, ms));
}

const paneWrap: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  minWidth: 0,
  minHeight: 0,
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  overflow: "hidden",
};

const paneHeader: CSSProperties = {
  padding: "10px 16px",
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  background: "rgba(255,255,255,0.06)",
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "baseline",
  gap: 12,
};

const textareaStyle: CSSProperties = {
  flex: 1,
  minHeight: 280,
  margin: 0,
  padding: 16,
  resize: "none",
  border: "none",
  outline: "none",
  background: "transparent",
  color: "rgba(255,255,255,0.92)",
  fontSize: 13,
  lineHeight: 1.55,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
};

const outputStyle: CSSProperties = {
  ...textareaStyle,
  whiteSpace: "pre-wrap",
  wordBreak: "break-word",
  overflow: "auto",
};

const ghostBtn: CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.2)",
  color: "rgba(255,255,255,0.7)",
  borderRadius: 6,
  padding: "3px 10px",
  fontSize: 11,
  letterSpacing: 0,
  textTransform: "none",
  cursor: "pointer",
};

export default function LlmPlaygroundPage() {
  const persisted = useMemo(() => loadPersisted(), []);
  const [mode, setMode] = useState<PlayMode>(persisted.mode === "batch" ? "batch" : "single");
  const [systemPrompt, setSystemPrompt] = useState(persisted.systemPrompt ?? "");
  const [userPrompt, setUserPrompt] = useState("");
  const [items, setItems] = useState<BatchItem[]>(() => [emptyBatchItem()]);
  const [jsonRaw, setJsonRaw] = useState("");
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [jsonParsed, setJsonParsed] = useState<unknown>(null);
  const [jsonOptions, setJsonOptions] = useState<JsonIterateOption[]>([]);
  const [selectedJsonId, setSelectedJsonId] = useState<string>("");
  const jsonFileRef = useRef<HTMLInputElement>(null);
  const [model, setModel] = useState<MistralModel>(
    persisted.model && isMistralModel(persisted.model) ? persisted.model : "mistral-small-latest",
  );
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(() => {
    const initialModel =
      persisted.model && isMistralModel(persisted.model) ? persisted.model : "mistral-small-latest";
    return clampEffort(initialModel, persisted.reasoningEffort ?? "none");
  });
  const [jsonMode, setJsonMode] = useState(persisted.jsonMode ?? true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ChatResponse | null>(null);
  const [copied, setCopied] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sessionCalls, setSessionCalls] = useState<SessionCall[]>([]);
  const [batchDone, setBatchDone] = useState(0);
  const [batchTotal, setBatchTotal] = useState(0);
  const [retryNote, setRetryNote] = useState<string | null>(null);
  const [runAlerts, setRunAlerts] = useState<string[]>([]);
  const cancelRef = useRef(false);

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ systemPrompt, model, jsonMode, mode, reasoningEffort } satisfies PersistedPrompts),
    );
  }, [systemPrompt, model, jsonMode, mode, reasoningEffort]);

  useEffect(() => {
    const raw = jsonRaw.trim();
    if (!raw) {
      setJsonError(null);
      setJsonParsed(null);
      setJsonOptions([]);
      setSelectedJsonId("");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      const options = rankJsonOptions(collectJsonOptions(parsed));
      setJsonParsed(parsed);
      setJsonOptions(options);
      setJsonError(options.length ? null : "JSON valide, mais aucun tableau de textes n'a été trouvé.");
      setSelectedJsonId((prev) => {
        if (prev && options.some((option) => option.id === prev)) return prev;
        return options[0]?.id ?? "";
      });
    } catch {
      setJsonParsed(null);
      setJsonOptions([]);
      setJsonError("JSON invalide — vérifiez virgules, guillemets et crochets.");
      setSelectedJsonId("");
    }
  }, [jsonRaw]);

  const output = prettyOutput(result);
  const filledItems = items.filter((item) => item.userPrompt.trim());
  const prix = PRIX_USD_PAR_M[model];

  const estimate = useMemo(() => {
    const texts =
      mode === "batch"
        ? items
            .filter((item) => item.userPrompt.trim())
            .map((item) => `${systemPrompt}\n${item.userPrompt}`.trim())
        : [`${systemPrompt}\n${userPrompt}`.trim()].filter(Boolean);
    const promptTokens = texts.reduce((sum, text) => sum + estimateTokens(text), 0);
    const completionTokens = texts.reduce(
      (sum, text) => sum + estimateOutputTokens(estimateTokens(text), reasoningEffort),
      0,
    );
    const cost = costFromTokens(model, promptTokens, completionTokens);
    return { promptTokens, completionTokens, cost, calls: texts.length };
  }, [mode, items, systemPrompt, userPrompt, model, reasoningEffort]);

  const sessionTotalUsd = sessionCalls.reduce((sum, call) => sum + call.cost.total_usd, 0);
  const sessionTotalTokens = sessionCalls.reduce((sum, call) => sum + call.tokens.total_tokens, 0);
  const progressPct = batchTotal > 0 ? Math.round((batchDone / batchTotal) * 100) : 0;

  const ensureCost = useCallback(
    (data: ChatResponse): ChatResponse => {
      if (data.cost) return data;
      return {
        ...data,
        cost: costFromTokens(
          isMistralModel(data.model) ? data.model : model,
          data.tokens.prompt_tokens,
          data.tokens.completion_tokens,
        ),
      };
    },
    [model],
  );

  const callChat = useCallback(
    async (prompt: string): Promise<ChatResponse> => {
      const res = await fetch(`${API}/appel-llm/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          system_prompt: systemPrompt,
          user_prompt: prompt,
          model,
          json_mode: jsonMode,
          temperature: 0,
          reasoning_effort: reasoningEffort,
          max_tokens: reasoningEffort === "none" ? 8192 : 16384,
        }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        const err = new Error(parseApiError(body, res.statusText));
        (err as Error & { status?: number }).status = res.status;
        throw err;
      }
      return ensureCost(body as ChatResponse);
    },
    [ensureCost, jsonMode, model, reasoningEffort, systemPrompt],
  );

  const callChatWithRetry = useCallback(
    async (
      prompt: string,
      onRetry?: (attempt: number, max: number, message: string) => void,
    ): Promise<ChatResponse> => {
      let lastErr: unknown;
      for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
          return await callChat(prompt);
        } catch (err) {
          lastErr = err;
          const message = err instanceof Error ? err.message : "Échec de l'appel LLM";
          const status = (err as Error & { status?: number }).status;
          if (attempt >= MAX_RETRIES || !isRetryableError(message, status)) {
            throw err;
          }
          onRetry?.(attempt, MAX_RETRIES, message);
          await sleep(RETRY_BASE_MS * attempt);
        }
      }
      throw lastErr instanceof Error ? lastErr : new Error("Échec de l'appel LLM");
    },
    [callChat],
  );

  const pushSession = useCallback((data: ChatResponse) => {
    setSessionCalls((prev) => [
      {
        model: data.model,
        tokens: data.tokens,
        cost: data.cost,
        duration_s: data.duration_s,
      },
      ...prev,
    ]);
  }, []);

  const copyText = useCallback(async (text: string, id: string | null = null) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopiedId(id);
      window.setTimeout(() => {
        setCopied(false);
        setCopiedId(null);
      }, 1600);
    } catch {
      setError("Impossible de copier dans le presse-papiers");
    }
  }, []);

  const switchMode = (next: PlayMode) => {
    if (next === mode || submitting) return;
    setError(null);
    if (next === "batch") {
      setItems((prev) => {
        if (prev.some((item) => item.userPrompt.trim()) || prev.length > 1) return prev;
        return [emptyBatchItem(userPrompt, true)];
      });
    } else if (!userPrompt.trim()) {
      const first = items.find((item) => item.userPrompt.trim());
      if (first) setUserPrompt(first.userPrompt);
    }
    setMode(next);
  };

  const addItem = () => {
    if (items.length >= MAX_BATCH) return;
    setItems((prev) => [...prev.map((item) => ({ ...item, open: false })), emptyBatchItem("", true)]);
  };

  const selectedJsonOption = jsonOptions.find((option) => option.id === selectedJsonId) ?? null;
  const jsonPreviewCount = selectedJsonOption
    ? extractJsonTexts(jsonParsed, selectedJsonOption).length
    : 0;

  const applyJsonToBatch = () => {
    if (!jsonParsed || !selectedJsonOption) {
      setError("Collez un JSON valide et choisissez un attribut.");
      return;
    }
    const extracted = extractJsonTexts(jsonParsed, selectedJsonOption);
    if (!extracted.length) {
      setError("Aucune valeur non vide pour cet attribut.");
      return;
    }
    const truncated = extracted.length > MAX_BATCH;
    const slice = extracted.slice(0, MAX_BATCH);
    setItems(
      slice.map((row, index) => emptyBatchItem(row.text, index === 0, row.label)),
    );
    setError(
      truncated
        ? `${extracted.length} textes trouvés — les ${MAX_BATCH} premiers ont été chargés.`
        : null,
    );
    setMode("batch");
  };

  const onJsonFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setJsonRaw(typeof reader.result === "string" ? reader.result : "");
    };
    reader.readAsText(file);
  };

  const removeItem = (id: string) => {
    setItems((prev) => {
      const next = prev.filter((item) => item.id !== id);
      return next.length ? next : [emptyBatchItem()];
    });
  };

  const updateItemPrompt = (id: string, value: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, userPrompt: value, status: "idle", error: null } : item,
      ),
    );
  };

  const toggleItem = (id: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, open: !item.open } : item)));
  };

  const copyAllOutputs = () => {
    const payloads = items
      .filter((item) => item.result)
      .map((item, index) => ({
        index: index + 1,
        label: item.label ?? null,
        output: item.result?.parsed ?? item.result?.content ?? null,
      }));
    copyText(JSON.stringify(payloads, null, 2), "all");
  };

  const onSubmitSingle = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setRetryNote(null);
    if (!userPrompt.trim()) {
      setError("Collez un texte dans le prompt utilisateur.");
      return;
    }
    setSubmitting(true);
    try {
      const data = await callChatWithRetry(userPrompt, (attempt, max, message) => {
        const note = `Erreur : ${message} — nouvel essai ${attempt + 1}/${max}`;
        setRetryNote(note);
        setRunAlerts((prev) => [...prev, note]);
      });
      setRetryNote(null);
      setResult(data);
      pushSession(data);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Échec de l'appel LLM";
      setRetryNote(null);
      setError(message);
      setRunAlerts((prev) => [...prev, message]);
    } finally {
      setSubmitting(false);
    }
  };

  const onSubmitBatch = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setRetryNote(null);
    setRunAlerts([]);
    const pending = items.filter((item) => item.userPrompt.trim());
    if (!pending.length) {
      setError("Ajoutez au moins un contexte utilisateur.");
      return;
    }

    cancelRef.current = false;
    setSubmitting(true);
    setBatchDone(0);
    setBatchTotal(pending.length);
    setItems((prev) =>
      prev.map((item) =>
        item.userPrompt.trim()
          ? { ...item, status: "queued", error: null }
          : item,
      ),
    );

    let processed = 0;
    for (const item of pending) {
      if (cancelRef.current) break;
      setItems((prev) =>
        prev.map((row) =>
          row.id === item.id ? { ...row, status: "running", open: true, error: null } : row,
        ),
      );
      try {
        const data = await callChatWithRetry(item.userPrompt, (attempt, max, message) => {
          const note = `Contexte ${processed + 1} : ${message} — nouvel essai ${attempt + 1}/${max}`;
          setRetryNote(note);
          setRunAlerts((prev) => [...prev, note]);
          setItems((prev) =>
            prev.map((row) =>
              row.id === item.id ? { ...row, status: "running", error: note } : row,
            ),
          );
        });
        setRetryNote(null);
        setItems((prev) =>
          prev.map((row) =>
            row.id === item.id ? { ...row, status: "done", result: data, error: null } : row,
          ),
        );
        pushSession(data);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Échec de l'appel LLM";
        const note = `Contexte ${processed + 1} en échec : ${message}`;
        setRetryNote(null);
        setRunAlerts((prev) => [...prev, note]);
        setItems((prev) =>
          prev.map((row) =>
            row.id === item.id ? { ...row, status: "failed", error: message } : row,
          ),
        );
      }
      processed += 1;
      setBatchDone(processed);
      if (processed < pending.length && !cancelRef.current) {
        await sleep(BATCH_PAUSE_MS);
      }
    }

    setSubmitting(false);
  };

  const canLaunch =
    mode === "batch" ? filledItems.length > 0 : Boolean(userPrompt.trim());

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0e0e0c",
        color: "#fff",
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
        padding: "32px max(24px, 4vw) 48px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <a
        href="/"
        style={{
          color: "rgba(255,255,255,0.45)",
          fontSize: 12,
          textDecoration: "none",
          letterSpacing: "0.08em",
        }}
      >
        ← KERELIA
      </a>

      <h1 style={{ fontSize: 28, fontWeight: 600, marginTop: 24, marginBottom: 8 }}>
        Playground LLM — Mistral
      </h1>
      <p style={{ color: "rgba(255,255,255,0.55)", maxWidth: 760, lineHeight: 1.6, marginBottom: 20 }}>
        {mode === "single"
          ? "Le prompt système reste en place. Collez un texte, lancez, récupérez le JSON, puis remplacez uniquement le texte."
          : "Même prompt système pour N contextes. Saisissez-les à la main, ou collez un JSON et choisissez l'attribut à itérer (ex. reglementation)."}
      </p>

      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        {(
          [
            { id: "single" as const, label: "Unitaire", hint: "Un texte à la fois" },
            { id: "batch" as const, label: "Batch", hint: "N contextes, même consignes" },
          ] as const
        ).map((opt) => (
          <button
            key={opt.id}
            type="button"
            disabled={submitting}
            onClick={() => switchMode(opt.id)}
            style={{
              padding: "12px 18px",
              borderRadius: 10,
              border: mode === opt.id ? "1px solid #c8e6a0" : "1px solid rgba(255,255,255,0.15)",
              background: mode === opt.id ? "rgba(200,230,160,0.15)" : "rgba(255,255,255,0.04)",
              color: mode === opt.id ? "#c8e6a0" : "rgba(255,255,255,0.75)",
              cursor: submitting ? "not-allowed" : "pointer",
              textAlign: "left",
            }}
          >
            <span style={{ display: "block", fontWeight: 600, fontSize: 14 }}>{opt.label}</span>
            <span style={{ display: "block", fontSize: 11, opacity: 0.65, marginTop: 4 }}>{opt.hint}</span>
          </button>
        ))}
      </div>

      <form
        onSubmit={mode === "batch" ? onSubmitBatch : onSubmitSingle}
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: 16,
          marginBottom: 20,
        }}
      >
        <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 240 }}>
          <span style={{ fontSize: 12, opacity: 0.7 }}>Modèle</span>
          <select
            value={model}
            disabled={submitting}
            onChange={(ev) => {
              const next = ev.target.value as MistralModel;
              setModel(next);
              setReasoningEffort((prev) => clampEffort(next, prev));
            }}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(0,0,0,0.3)",
              color: "#fff",
              fontSize: 14,
            }}
          >
            {MISTRAL_MODELS.map((m) => {
              const p = PRIX_USD_PAR_M[m];
              return (
                <option key={m} value={m}>
                  {MODEL_LABELS[m]} — ${p.input} / ${p.output} / M
                </option>
              );
            })}
          </select>
        </label>

        <label style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 200 }}>
          <span style={{ fontSize: 12, opacity: 0.7 }}>Raisonnement</span>
          <select
            value={reasoningEffort}
            disabled={submitting}
            onChange={(ev) => setReasoningEffort(ev.target.value as ReasoningEffort)}
            style={{
              padding: "10px 12px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.15)",
              background: "rgba(0,0,0,0.3)",
              color: "#fff",
              fontSize: 14,
            }}
          >
            {REASONING_EFFORTS[model].map((effort) => (
              <option key={effort} value={effort}>
                {EFFORT_LABELS[effort]}
              </option>
            ))}
          </select>
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            fontSize: 14,
            cursor: submitting ? "not-allowed" : "pointer",
            marginTop: 18,
          }}
        >
          <input
            type="checkbox"
            checked={jsonMode}
            disabled={submitting}
            onChange={(ev) => setJsonMode(ev.target.checked)}
          />
          Sortie JSON
        </label>

        <button
          type="submit"
          disabled={submitting || !canLaunch}
          style={{
            marginTop: 18,
            background: submitting ? "#444" : "#c8e6a0",
            color: "#0e0e0c",
            border: "none",
            borderRadius: 8,
            padding: "12px 24px",
            fontWeight: 600,
            cursor: submitting ? "wait" : "pointer",
          }}
        >
          {submitting
            ? mode === "batch"
              ? `Batch ${batchDone}/${batchTotal}…`
              : retryNote
                ? "Nouvel essai…"
                : "Analyse en cours…"
            : mode === "batch"
              ? `Lancer le batch (${filledItems.length})`
              : "Lancer l'analyse"}
        </button>

        {submitting && mode === "batch" && (
          <button
            type="button"
            onClick={() => {
              cancelRef.current = true;
            }}
            style={{
              marginTop: 18,
              background: "transparent",
              color: "#f87171",
              border: "1px solid rgba(248,113,113,0.5)",
              borderRadius: 8,
              padding: "10px 16px",
              fontSize: 13,
              cursor: "pointer",
            }}
          >
            Arrêter après l&apos;appel en cours
          </button>
        )}
      </form>

      {mode === "batch" && (submitting || batchTotal > 0) && (
        <div style={{ marginBottom: 16, maxWidth: "min(1400px, 100%)" }}>
          <div
            style={{
              height: 6,
              background: "rgba(255,255,255,0.1)",
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${progressPct}%`,
                background: "#c8e6a0",
                transition: "width 0.3s",
              }}
            />
          </div>
          <p style={{ fontSize: 12, opacity: 0.5, margin: "6px 0 0" }}>
            {batchDone} / {batchTotal} contextes
            {submitting ? " — un appel à la suite de l’autre" : ""}
            {items.some((item) => item.status === "done")
              ? ` · ${items.filter((item) => item.status === "done").length} sortie${
                  items.filter((item) => item.status === "done").length > 1 ? "s" : ""
                } conservée${items.filter((item) => item.status === "done").length > 1 ? "s" : ""}`
              : ""}
          </p>
        </div>
      )}

      <div
        style={{
          marginBottom: 20,
          padding: 16,
          background: "rgba(200,230,160,0.08)",
          border: "1px solid rgba(200,230,160,0.25)",
          borderRadius: 12,
          display: "flex",
          flexDirection: "column",
          gap: 12,
          maxWidth: "min(1400px, 100%)",
        }}
      >
        <p style={{ margin: 0, fontSize: 12, opacity: 0.6 }}>
          Tarif {MODEL_LABELS[model]} : ${prix.input.toFixed(2)} / ${prix.output.toFixed(2)} pour 1 M jetons
          (entrée / sortie) · raisonnement {EFFORT_LABELS[reasoningEffort]}
        </p>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: 16,
          }}
        >
          <div>
            <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", opacity: 0.7 }}>
              Estimation {mode === "batch" ? `batch (${estimate.calls})` : "prochain appel"}
            </p>
            <p style={{ margin: 0, fontSize: 14, color: "#c8e6a0" }}>
              ≈ {formatChars(estimate.promptTokens)} in + {formatChars(estimate.completionTokens)} out →{" "}
              <strong>{formatUsd(estimate.cost.total_usd)}</strong>
            </p>
            <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.55 }}>
              entrée {formatUsd(estimate.cost.input_usd)} · sortie {formatUsd(estimate.cost.output_usd)}
              {" "}(sortie ≈ {Math.round(25 * EFFORT_OUT_FACTOR[reasoningEffort])} % de l&apos;entrée, 4 car./jeton)
            </p>
          </div>

          {result && mode === "single" && (
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", opacity: 0.7 }}>
                Dernier appel — réel
              </p>
              <p style={{ margin: 0, fontSize: 14, color: "#c8e6a0" }}>
                {formatChars(result.tokens.prompt_tokens)} in / {formatChars(result.tokens.completion_tokens)} out →{" "}
                <strong>{formatUsd(result.cost.total_usd)}</strong>
              </p>
              <p style={{ margin: "4px 0 0", fontSize: 12, opacity: 0.55 }}>
                entrée {formatUsd(result.cost.input_usd)} · sortie {formatUsd(result.cost.output_usd)} ·{" "}
                {result.duration_s.toFixed(1)} s
              </p>
            </div>
          )}

          {sessionCalls.length > 0 && (
            <div>
              <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", opacity: 0.7 }}>
                Session
              </p>
              <p style={{ margin: 0, fontSize: 14, color: "#c8e6a0" }}>
                {sessionCalls.length} appel{sessionCalls.length > 1 ? "s" : ""} ·{" "}
                {formatChars(sessionTotalTokens)} jetons →{" "}
                <strong>{formatUsd(sessionTotalUsd)}</strong>
              </p>
            </div>
          )}
        </div>
      </div>

      {(retryNote || runAlerts.length > 0) && (
        <div
          role="status"
          style={{
            marginBottom: 16,
            padding: "12px 14px",
            borderRadius: 10,
            border: "1px solid rgba(251,191,36,0.4)",
            background: "rgba(251,191,36,0.1)",
            maxWidth: "min(1400px, 100%)",
          }}
        >
          {retryNote && (
            <p style={{ margin: 0, color: "#fbbf24", fontSize: 13, fontWeight: 600 }}>
              {retryNote}
            </p>
          )}
          {runAlerts.length > 0 && (
            <ul style={{ margin: retryNote ? "8px 0 0" : 0, paddingLeft: 18, color: "#fbbf24", fontSize: 12, lineHeight: 1.5 }}>
              {runAlerts.slice(-6).map((alert, index) => (
                <li key={`${alert}-${index}`}>{alert}</li>
              ))}
            </ul>
          )}
          <p style={{ margin: "8px 0 0", fontSize: 12, opacity: 0.7 }}>
            Les sorties déjà obtenues restent affichées ci-dessous.
          </p>
        </div>
      )}

      {error && (
        <p style={{ color: "#f87171", marginTop: 0, marginBottom: 16 }} role="alert">
          {error}
        </p>
      )}

      <style>{`
        @media (max-width: 1100px) {
          .llm-panes { grid-template-columns: 1fr !important; min-height: auto !important; }
          .llm-panes textarea, .llm-panes pre { min-height: 220px !important; }
          .llm-batch-split { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {mode === "single" ? (
        <div
          className="llm-panes"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: 12,
            flex: 1,
            minHeight: "min(68vh, 720px)",
          }}
        >
          <div style={paneWrap}>
            <div style={paneHeader}>
              <span>Prompt système</span>
              <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: "none", opacity: 0.55 }}>
                {formatChars(systemPrompt.length)} car. · conservé
              </span>
            </div>
            <textarea
              value={systemPrompt}
              disabled={submitting}
              onChange={(ev) => setSystemPrompt(ev.target.value)}
              placeholder="Consignes stables, réutilisées à chaque analyse (rôle, schéma JSON, règles)…"
              style={textareaStyle}
            />
          </div>

          <div style={paneWrap}>
            <div style={paneHeader}>
              <span>Prompt utilisateur</span>
              <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: "none", opacity: 0.55 }}>
                  {formatChars(userPrompt.length)} car. · à coller
                </span>
                <button
                  type="button"
                  disabled={submitting || !userPrompt}
                  onClick={() => setUserPrompt("")}
                  style={{
                    ...ghostBtn,
                    color: userPrompt ? "rgba(255,255,255,0.7)" : "rgba(255,255,255,0.25)",
                    cursor: userPrompt ? "pointer" : "default",
                  }}
                >
                  Vider
                </button>
              </span>
            </div>
            <textarea
              value={userPrompt}
              disabled={submitting}
              onChange={(ev) => setUserPrompt(ev.target.value)}
              placeholder="Collez ici le texte du règlement n°1, lancez, puis remplacez par le n°2…"
              style={textareaStyle}
            />
          </div>

          <div style={{ ...paneWrap, borderColor: "rgba(200,230,160,0.28)" }}>
            <div
              style={{
                ...paneHeader,
                background: "rgba(200,230,160,0.1)",
                color: "#c8e6a0",
              }}
            >
              <span>Sortie</span>
              <button
                type="button"
                disabled={!output}
                onClick={() => copyText(output)}
                style={{
                  ...ghostBtn,
                  border: "1px solid rgba(200,230,160,0.45)",
                  color: output ? "#c8e6a0" : "rgba(200,230,160,0.35)",
                  cursor: output ? "pointer" : "default",
                }}
              >
                {copied && !copiedId ? "Copié" : "Copier"}
              </button>
            </div>
            <pre style={outputStyle}>
              {submitting && !output
                ? retryNote || "Appel Mistral en cours…"
                : output || "(La réponse JSON apparaîtra ici)"}
            </pre>
            {submitting && output && (
              <p style={{ margin: 0, padding: "8px 16px", fontSize: 12, color: "#fbbf24", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                {retryNote || "Nouvel appel en cours — la sortie précédente reste visible."}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12, flex: 1 }}>
          <div style={{ ...paneWrap, minHeight: 200 }}>
            <div style={paneHeader}>
              <span>Prompt système — commun à tout le batch</span>
              <span style={{ fontWeight: 400, letterSpacing: 0, textTransform: "none", opacity: 0.55 }}>
                {formatChars(systemPrompt.length)} car. · conservé
              </span>
            </div>
            <textarea
              value={systemPrompt}
              disabled={submitting}
              onChange={(ev) => setSystemPrompt(ev.target.value)}
              placeholder="Consignes stables, appliquées à chaque contexte utilisateur…"
              style={{ ...textareaStyle, minHeight: 160 }}
            />
          </div>

          <div style={{ ...paneWrap, minHeight: 160 }}>
            <div style={paneHeader}>
              <span>Importer un JSON — découper selon un attribut</span>
              <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  ref={jsonFileRef}
                  type="file"
                  accept=".json,application/json"
                  hidden
                  onChange={(ev) => {
                    onJsonFile(ev.target.files?.[0]);
                    ev.target.value = "";
                  }}
                />
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => jsonFileRef.current?.click()}
                  style={ghostBtn}
                >
                  Fichier…
                </button>
                {jsonRaw && (
                  <button
                    type="button"
                    disabled={submitting}
                    onClick={() => setJsonRaw("")}
                    style={ghostBtn}
                  >
                    Vider
                  </button>
                )}
              </span>
            </div>
            <textarea
              value={jsonRaw}
              disabled={submitting}
              onChange={(ev) => setJsonRaw(ev.target.value)}
              placeholder={'Collez ici un JSON, par ex. [{"nom":"UA","reglementation":"..."}, ...]'}
              style={{ ...textareaStyle, minHeight: 140 }}
            />
            {jsonError && (
              <p style={{ margin: 0, padding: "8px 16px", fontSize: 12, color: "#f87171", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
                {jsonError}
              </p>
            )}
            {jsonOptions.length > 0 && (
              <div
                style={{
                  padding: 14,
                  borderTop: "1px solid rgba(255,255,255,0.08)",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12 }}>
                  <span style={{ opacity: 0.7 }}>Attribut à itérer</span>
                  <select
                    value={selectedJsonId}
                    disabled={submitting}
                    onChange={(ev) => setSelectedJsonId(ev.target.value)}
                    style={{
                      padding: "10px 12px",
                      borderRadius: 8,
                      border: "1px solid rgba(255,255,255,0.15)",
                      background: "rgba(0,0,0,0.3)",
                      color: "#fff",
                      fontSize: 14,
                      maxWidth: 560,
                    }}
                  >
                    {jsonOptions.map((option) => (
                      <option key={option.id} value={option.id}>
                        {formatJsonPath(option)} — {option.count} valeur{option.count > 1 ? "s" : ""}
                      </option>
                    ))}
                  </select>
                </label>
                {selectedJsonOption && (
                  <p style={{ margin: 0, fontSize: 12, opacity: 0.55, lineHeight: 1.5 }}>
                    Aperçu : {selectedJsonOption.sample}
                    {selectedJsonOption.sample.length >= 180 ? "…" : ""}
                  </p>
                )}
                <div>
                  <button
                    type="button"
                    disabled={submitting || jsonPreviewCount === 0}
                    onClick={applyJsonToBatch}
                    style={{
                      ...ghostBtn,
                      border: "1px solid #c8e6a0",
                      color: "#c8e6a0",
                      padding: "8px 14px",
                      fontSize: 13,
                      cursor: submitting || jsonPreviewCount === 0 ? "not-allowed" : "pointer",
                    }}
                  >
                    Créer {jsonPreviewCount || 0} contexte{jsonPreviewCount > 1 ? "s" : ""}
                  </button>
                </div>
              </div>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <p style={{ margin: 0, fontSize: 13, opacity: 0.65 }}>
              {items.length} contexte{items.length > 1 ? "s" : ""} · {filledItems.length} prêt
              {filledItems.length > 1 ? "s" : ""}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              {items.some((item) => item.result) && (
                <button type="button" onClick={copyAllOutputs} style={ghostBtn}>
                  {copiedId === "all" ? "Sorties copiées" : "Copier toutes les sorties"}
                </button>
              )}
              <button
                type="button"
                disabled={submitting || items.length >= MAX_BATCH}
                onClick={addItem}
                style={{
                  ...ghostBtn,
                  border: "1px solid #c8e6a0",
                  color: "#c8e6a0",
                  padding: "6px 12px",
                  fontSize: 13,
                  cursor: submitting || items.length >= MAX_BATCH ? "not-allowed" : "pointer",
                }}
              >
                + Ajouter un contexte
              </button>
            </div>
          </div>

          {items.map((item, index) => {
            const itemOutput = prettyOutput(item.result);
            const statusColor =
              item.status === "done"
                ? "#c8e6a0"
                : item.status === "failed"
                  ? "#f87171"
                  : item.status === "running"
                    ? "#fbbf24"
                    : "rgba(255,255,255,0.45)";
            return (
              <div key={item.id} style={paneWrap}>
                <div
                  style={{
                    ...paneHeader,
                    cursor: "pointer",
                    alignItems: "center",
                    textTransform: "none",
                    letterSpacing: 0,
                  }}
                  onClick={() => toggleItem(item.id)}
                >
                  <span style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                    <span style={{ opacity: 0.5, width: 12 }}>{item.open ? "▾" : "▸"}</span>
                    <strong>
                      {item.label ? item.label : `Contexte ${index + 1}`}
                    </strong>
                    <span style={{ fontWeight: 400, opacity: 0.55 }}>
                      {formatChars(item.userPrompt.length)} car.
                    </span>
                    <span style={{ color: statusColor, fontWeight: 500, fontSize: 12 }}>
                      {STATUS_LABEL[item.status]}
                    </span>
                    {item.result && (
                      <span style={{ fontWeight: 400, opacity: 0.55, fontSize: 12 }}>
                        {formatUsd(item.result.cost.total_usd)}
                      </span>
                    )}
                  </span>
                  <span style={{ display: "flex", gap: 8 }} onClick={(ev) => ev.stopPropagation()}>
                    {itemOutput && (
                      <button type="button" onClick={() => copyText(itemOutput, item.id)} style={ghostBtn}>
                        {copiedId === item.id ? "Copié" : "Copier"}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => removeItem(item.id)}
                      style={{
                        ...ghostBtn,
                        color: "#f87171",
                        borderColor: "rgba(248,113,113,0.35)",
                        cursor: submitting ? "not-allowed" : "pointer",
                      }}
                    >
                      Supprimer
                    </button>
                  </span>
                </div>

                {item.open && (
                  <div
                    className="llm-batch-split"
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 1fr",
                      minHeight: 260,
                    }}
                  >
                    <textarea
                      value={item.userPrompt}
                      disabled={submitting}
                      onChange={(ev) => updateItemPrompt(item.id, ev.target.value)}
                      placeholder={`Collez ici le texte ${index + 1} à analyser…`}
                      style={{ ...textareaStyle, minHeight: 260, borderRight: "1px solid rgba(255,255,255,0.08)" }}
                    />
                    <pre
                      style={{
                        ...outputStyle,
                        minHeight: 260,
                        background: "rgba(200,230,160,0.04)",
                        color: item.status === "failed" && !itemOutput ? "#f87171" : outputStyle.color,
                      }}
                    >
                      {item.status === "running" && !itemOutput
                        ? item.error || "Appel Mistral en cours…"
                        : itemOutput ||
                          (item.error ? item.error : "(La sortie de ce contexte apparaîtra ici)")}
                    </pre>
                    {(item.status === "running" || item.status === "failed") && item.error && itemOutput && (
                      <p
                        style={{
                          gridColumn: "1 / -1",
                          margin: 0,
                          padding: "8px 16px",
                          fontSize: 12,
                          color: item.status === "failed" ? "#f87171" : "#fbbf24",
                          borderTop: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        {item.error}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
