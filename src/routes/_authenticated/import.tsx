import { useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { CheckCircle2, Download, FileSpreadsheet, ImageIcon, Keyboard, Trash2, TriangleAlert, Undo2, Upload } from "lucide-react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { PlatformMark } from "@/components/platform";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDashboard } from "@/hooks/dashboard-context";
import { cn } from "@/lib/utils";
import {
  METRIC_FIELDS,
  METRIC_LABEL,
  SOURCE_LABEL,
  TARGET_OPTIONS,
  guessTarget,
  prepareRows,
  type MetricField,
  type TargetField,
} from "@/lib/import/schema";
import { parseFile, readImage, type ParsedFile } from "@/lib/import/parse-file";
import {
  commitFileImport,
  exportWorkspaceData,
  getImportHistory,
  readScreenshotMetrics,
  saveManualSnapshot,
  undoFileImport,
} from "@/lib/data.functions";

export const Route = createFileRoute("/_authenticated/import")({
  component: ImportPage,
  head: () => ({
    meta: [
      { title: "Import Center · SocialPulse" },
      {
        name: "description",
        content:
          "Add your numbers by hand, upload a CSV or spreadsheet export, or read them from a screenshot — you confirm every value before it is saved.",
      },
      { property: "og:title", content: "Import Center · SocialPulse" },
      {
        property: "og:description",
        content: "Manual entries, file imports and screenshot readings, all confirmed by you before saving.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

const today = () => new Date().toISOString().slice(0, 10);

function AccountPicker({
  value,
  onChange,
}: {
  value: string | null;
  onChange: (id: string) => void;
}) {
  const { accounts } = useDashboard();
  if (accounts.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
        Add a profile first, then you can save measurements for it.{" "}
        <Link to="/accounts" className="font-medium text-primary underline-offset-4 hover:underline">
          Go to Accounts
        </Link>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {accounts.map((account) => (
        <button
          key={account.id}
          type="button"
          onClick={() => onChange(account.id)}
          className={cn(
            "flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-all duration-200 hover:-translate-y-0.5",
            value === account.id
              ? "border-primary/60 bg-secondary text-foreground shadow-[var(--shadow-soft)]"
              : "border-border text-muted-foreground hover:text-foreground",
          )}
        >
          <PlatformMark provider={account.platform} size="sm" />
          {account.displayName ?? account.handle}
        </button>
      ))}
    </div>
  );
}

function ManualEntry() {
  const { orgId, accounts } = useDashboard();
  const queryClient = useQueryClient();
  const saveFn = useServerFn(saveManualSnapshot);
  const [accountId, setAccountId] = useState<string | null>(accounts[0]?.id ?? null);
  const [date, setDate] = useState(today());
  const [values, setValues] = useState<Record<string, string>>({});

  const numbers = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [key, raw] of Object.entries(values)) {
      const n = Number(raw.replace(/[,\s]/g, ""));
      if (raw.trim() !== "" && Number.isFinite(n) && n >= 0) out[key] = Math.round(n);
    }
    return out;
  }, [values]);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          orgId: orgId!,
          accountId: accountId!,
          source: "manual" as const,
          entry: { capturedAt: new Date(`${date}T12:00:00.000Z`).toISOString(), metrics: numbers },
        },
      }),
    onSuccess: async (result) => {
      if (!result.saved) {
        toast.error(result.reason ?? "That measurement wasn't saved.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["public-overview"] });
      setValues({});
      toast.success("Measurement saved.");
    },
    onError: () => toast.error("We couldn't save that measurement."),
  });

  const ready = Boolean(orgId && accountId && Object.keys(numbers).length > 0 && date);

  return (
    <div className="panel space-y-5 p-5">
      <div>
        <h2 className="font-display text-base font-semibold">Enter today's numbers</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Type what you see in your own analytics. Leave anything you don't have blank — SocialPulse never fills in a
          number for you.
        </p>
      </div>

      <AccountPicker value={accountId} onChange={setAccountId} />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5">
          <Label htmlFor="entry-date">Date</Label>
          <Input id="entry-date" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {METRIC_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={`field-${field.key}`}>{field.label}</Label>
            <Input
              id={`field-${field.key}`}
              inputMode="numeric"
              placeholder="—"
              value={values[field.key] ?? ""}
              onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
            />
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Button disabled={!ready || save.isPending} onClick={() => save.mutate()}>
          <CheckCircle2 className="mr-1.5 size-4" /> Save measurement
        </Button>
        <span className="text-xs text-muted-foreground">
          {Object.keys(numbers).length} value{Object.keys(numbers).length === 1 ? "" : "s"} ready
        </span>
      </div>
    </div>
  );
}

function FileImport() {
  const { orgId, accounts } = useDashboard();
  const queryClient = useQueryClient();
  const commitFn = useServerFn(commitFileImport);
  const [accountId, setAccountId] = useState<string | null>(accounts[0]?.id ?? null);
  const [file, setFile] = useState<ParsedFile | null>(null);
  const [mapping, setMapping] = useState<Record<string, TargetField>>({});
  const inputRef = useRef<HTMLInputElement>(null);

  const account = accounts.find((a) => a.id === accountId) ?? null;
  const prepared = useMemo(() => (file ? prepareRows(file.rows, mapping) : null), [file, mapping]);

  async function onFile(selected: File) {
    try {
      const parsed = await parseFile(selected);
      setFile(parsed);
      setMapping(Object.fromEntries(parsed.headers.map((h) => [h, guessTarget(h)])));
      toast.success(`${parsed.rows.length} rows read from ${parsed.fileName}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "We couldn't read that file.");
    }
  }

  const commit = useMutation({
    mutationFn: () => {
      const rows = prepared!.rows.filter((r) => r.problems.length === 0);
      const isContent = prepared!.hasContent;
      const entries = isContent
        ? []
        : rows.map((r) => ({
            capturedAt: r.capturedAt ?? new Date().toISOString(),
            metrics: r.metrics as Record<string, number>,
          }));
      const content = isContent
        ? rows.map((r, i) => ({
            externalId: r.url ?? `${file!.fileName}-${r.index}-${i}`,
            title: r.title,
            url: r.url,
            publishedAt: r.capturedAt,
            views: r.metrics.views ?? null,
            likes: r.metrics.likes ?? null,
            comments: r.metrics.comments ?? null,
            shares: r.metrics.shares ?? null,
            reach: r.metrics.reach ?? null,
            impressions: r.metrics.impressions ?? null,
            saves: r.metrics.saves ?? null,
          }))
        : [];
      return commitFn({
        data: {
          orgId: orgId!,
          accountId: accountId!,
          platform: account!.platform,
          fileName: file!.fileName,
          fileType: file!.fileType,
          entries,
          content,
        },
      });
    },
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ["public-overview"] });
      await queryClient.invalidateQueries({ queryKey: ["imports"] });
      setFile(null);
      setMapping({});
      toast.success(
        `Imported ${result.measurements} measurement${result.measurements === 1 ? "" : "s"}${
          result.content ? ` and ${result.content} posts` : ""
        }.`,
        result.skipped ? { description: `${result.skipped} row(s) already had a measurement for that date.` } : undefined,
      );
    },
    onError: () => toast.error("We couldn't finish that import."),
  });

  const missingDate = Boolean(prepared && !prepared.hasDate);

  return (
    <div className="panel space-y-5 p-5">
      <div>
        <h2 className="font-display text-base font-semibold">Upload an export</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          CSV, Excel or JSON exports from any platform. You choose what each column means before anything is saved.
        </p>
      </div>

      <AccountPicker value={accountId} onChange={setAccountId} />

      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const dropped = e.dataTransfer.files?.[0];
          if (dropped) void onFile(dropped);
        }}
        className="grid place-items-center rounded-2xl border border-dashed border-border bg-secondary/30 px-6 py-10 text-center transition-colors hover:border-primary/50"
      >
        <FileSpreadsheet className="size-7 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium">Drop your file here</p>
        <p className="text-xs text-muted-foreground">.csv, .xlsx or .json — up to 5,000 rows</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => inputRef.current?.click()}>
          <Upload className="mr-1.5 size-3.5" /> Choose a file
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls,.json"
          className="hidden"
          onChange={(e) => {
            const selected = e.target.files?.[0];
            if (selected) void onFile(selected);
            e.target.value = "";
          }}
        />
      </div>

      {file && prepared ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-border p-4">
            <p className="label-mono">Match your columns</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {file.headers.map((header) => (
                <div key={header} className="space-y-1.5">
                  <Label htmlFor={`map-${header}`} className="truncate">
                    {header}
                  </Label>
                  <select
                    id={`map-${header}`}
                    value={mapping[header] ?? "ignore"}
                    onChange={(e) => setMapping((m) => ({ ...m, [header]: e.target.value as TargetField }))}
                    className="h-9 w-full rounded-lg border border-input bg-background px-2 text-sm"
                  >
                    {TARGET_OPTIONS.map((option) => (
                      <option key={option.key} value={option.key}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {missingDate ? (
            <p className="flex items-center gap-2 rounded-xl border border-warning/40 bg-warning/10 p-3 text-xs text-warning">
              <TriangleAlert className="size-4" /> Pick which column holds the date, so growth can be measured correctly.
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-left text-xs">
              <thead className="bg-secondary/50 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Date</th>
                  {prepared.hasContent ? <th className="px-3 py-2 font-medium">Title</th> : null}
                  {prepared.metricColumns.map((key) => (
                    <th key={key} className="px-3 py-2 font-medium">
                      {METRIC_LABEL[key as MetricField]}
                    </th>
                  ))}
                  <th className="px-3 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {prepared.rows.slice(0, 12).map((row) => (
                  <tr key={row.index} className="border-t border-border">
                    <td className="px-3 py-2 tabular">{row.capturedAt ? row.capturedAt.slice(0, 10) : "—"}</td>
                    {prepared.hasContent ? <td className="max-w-[16rem] truncate px-3 py-2">{row.title ?? "—"}</td> : null}
                    {prepared.metricColumns.map((key) => (
                      <td key={key} className="px-3 py-2 tabular">
                        {row.metrics[key as MetricField]?.toLocaleString() ?? "—"}
                      </td>
                    ))}
                    <td className="px-3 py-2">
                      {row.problems.length === 0 ? (
                        <span className="text-success">Ready</span>
                      ) : (
                        <span className="text-warning">{row.problems[0]}</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Button
              disabled={!orgId || !accountId || prepared.validCount === 0 || commit.isPending || (missingDate && !prepared.hasContent)}
              onClick={() => commit.mutate()}
            >
              <CheckCircle2 className="mr-1.5 size-4" /> Confirm and import {prepared.validCount} row
              {prepared.validCount === 1 ? "" : "s"}
            </Button>
            <Button variant="ghost" onClick={() => setFile(null)}>
              Cancel
            </Button>
            <span className="text-xs text-muted-foreground">
              {prepared.rows.length - prepared.validCount} row(s) will be skipped
            </span>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ScreenshotImport() {
  const { orgId, accounts } = useDashboard();
  const queryClient = useQueryClient();
  const readFn = useServerFn(readScreenshotMetrics);
  const saveFn = useServerFn(saveManualSnapshot);
  const [accountId, setAccountId] = useState<string | null>(accounts[0]?.id ?? null);
  const [preview, setPreview] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [date, setDate] = useState(today());
  const inputRef = useRef<HTMLInputElement>(null);
  const account = accounts.find((a) => a.id === accountId) ?? null;

  const read = useMutation({
    mutationFn: async (image: string) => readFn({ data: { image, platform: account!.platform } }),
    onSuccess: (result) => {
      if (result.note) toast.message(result.note);
      const found = Object.entries(result.metrics ?? {});
      if (!found.length) {
        toast.message("No numbers were read — you can type them in below.");
        return;
      }
      setValues(Object.fromEntries(found.map(([k, v]) => [k, String(v)])));
      if ("date" in result && typeof result.date === "string") {
        const iso = Date.parse(result.date);
        if (!Number.isNaN(iso)) setDate(new Date(iso).toISOString().slice(0, 10));
      }
      toast.success(`${found.length} value(s) read — please check them before saving.`);
    },
    onError: () => toast.error("We couldn't read that screenshot."),
  });

  const numbers = useMemo(() => {
    const out: Record<string, number> = {};
    for (const [key, raw] of Object.entries(values)) {
      const n = Number(raw.replace(/[,\s]/g, ""));
      if (raw.trim() !== "" && Number.isFinite(n) && n >= 0) out[key] = Math.round(n);
    }
    return out;
  }, [values]);

  const save = useMutation({
    mutationFn: () =>
      saveFn({
        data: {
          orgId: orgId!,
          accountId: accountId!,
          source: "screenshot" as const,
          entry: { capturedAt: new Date(`${date}T12:00:00.000Z`).toISOString(), metrics: numbers },
        },
      }),
    onSuccess: async (result) => {
      if (!result.saved) {
        toast.error(result.reason ?? "That measurement wasn't saved.");
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["public-overview"] });
      setPreview(null);
      setValues({});
      toast.success("Measurement saved.");
    },
    onError: () => toast.error("We couldn't save that measurement."),
  });

  return (
    <div className="panel space-y-5 p-5">
      <div>
        <h2 className="font-display text-base font-semibold">Read a screenshot</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Upload a screenshot of your own analytics. Every number is shown for you to confirm or correct — nothing is
          saved automatically.
        </p>
      </div>

      <AccountPicker value={accountId} onChange={setAccountId} />

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="grid place-items-center rounded-2xl border border-dashed border-border bg-secondary/30 px-6 py-10 text-center">
          {preview ? (
            <img src={preview} alt="Screenshot to confirm" className="max-h-64 rounded-xl object-contain" />
          ) : (
            <>
              <ImageIcon className="size-7 text-muted-foreground" />
              <p className="mt-3 text-sm font-medium">Upload a screenshot</p>
              <p className="text-xs text-muted-foreground">PNG or JPG of your analytics screen</p>
            </>
          )}
          <Button
            variant="outline"
            size="sm"
            className="mt-4"
            disabled={!account || read.isPending}
            onClick={() => inputRef.current?.click()}
          >
            <Upload className="mr-1.5 size-3.5" /> {preview ? "Choose another" : "Choose an image"}
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={async (e) => {
              const selected = e.target.files?.[0];
              e.target.value = "";
              if (!selected || !account) return;
              const dataUrl = await readImage(selected);
              setPreview(dataUrl);
              read.mutate(dataUrl);
            }}
          />
        </div>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="shot-date">Date</Label>
            <Input id="shot-date" type="date" max={today()} value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {METRIC_FIELDS.map((field) => (
              <div key={field.key} className="space-y-1.5">
                <Label htmlFor={`shot-${field.key}`}>{field.label}</Label>
                <Input
                  id={`shot-${field.key}`}
                  inputMode="numeric"
                  placeholder="—"
                  value={values[field.key] ?? ""}
                  onChange={(e) => setValues((v) => ({ ...v, [field.key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <Button
            disabled={!orgId || !accountId || Object.keys(numbers).length === 0 || save.isPending}
            onClick={() => save.mutate()}
          >
            <CheckCircle2 className="mr-1.5 size-4" /> Confirm and save
          </Button>
        </div>
      </div>
    </div>
  );
}

function ImportHistory() {
  const { orgId, accounts } = useDashboard();
  const queryClient = useQueryClient();
  const historyFn = useServerFn(getImportHistory);
  const undoFn = useServerFn(undoFileImport);

  const query = useQuery({
    queryKey: ["imports", orgId],
    queryFn: () => historyFn({ data: { orgId: orgId! } }),
    enabled: Boolean(orgId),
  });

  const undo = useMutation({
    mutationFn: (importId: string) => undoFn({ data: { orgId: orgId!, importId } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["imports"] });
      await queryClient.invalidateQueries({ queryKey: ["public-overview"] });
      toast.success("Import removed.");
    },
    onError: () => toast.error("We couldn't remove that import."),
  });

  const rows = query.data?.imports ?? [];

  return (
    <div className="panel p-5">
      <h2 className="font-display text-base font-semibold">Import history</h2>
      {rows.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nothing imported yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border">
          {rows.map((row: Record<string, any>) => {
            const account = accounts.find((a) => a.id === row["account_id"]);
            return (
              <li key={row["id"]} className="flex flex-wrap items-center gap-3 py-3">
                {account ? <PlatformMark provider={account.platform} size="sm" /> : null}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{row["file_name"]}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(row["created_at"]).toLocaleString()} · {row["metric_count"] ?? 0} measurements ·{" "}
                    {row["content_count"] ?? 0} posts
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={undo.isPending}
                  onClick={() => undo.mutate(row["id"] as string)}
                >
                  <Undo2 className="mr-1.5 size-3.5" /> Undo
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ExportPanel() {
  const { orgId } = useDashboard();
  const exportFn = useServerFn(exportWorkspaceData);

  const run = useMutation({
    mutationFn: () => exportFn({ data: { orgId: orgId! } }),
    onSuccess: (payload) => {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `socialpulse-export-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      toast.success("Your data was downloaded.");
    },
    onError: () => toast.error("We couldn't prepare that download."),
  });

  return (
    <div className="panel flex flex-wrap items-center justify-between gap-3 p-5">
      <div>
        <h2 className="font-display text-base font-semibold">Export everything</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Download every profile, measurement and post stored in your workspace.
        </p>
      </div>
      <Button variant="outline" disabled={!orgId || run.isPending} onClick={() => run.mutate()}>
        <Download className="mr-1.5 size-4" /> Download my data
      </Button>
    </div>
  );
}

function ImportPage() {
  return (
    <AppShell>
      <PageHeader
        title="Import Center"
        description="Three ways to get your numbers in — typed by hand, from a file, or read from a screenshot. You confirm everything before it is saved."
      />

      <Tabs defaultValue="manual" className="space-y-5">
        <TabsList>
          <TabsTrigger value="manual">
            <Keyboard className="mr-1.5 size-4" /> Manual
          </TabsTrigger>
          <TabsTrigger value="file">
            <FileSpreadsheet className="mr-1.5 size-4" /> File
          </TabsTrigger>
          <TabsTrigger value="screenshot">
            <ImageIcon className="mr-1.5 size-4" /> Screenshot
          </TabsTrigger>
        </TabsList>
        <TabsContent value="manual">
          <ManualEntry />
        </TabsContent>
        <TabsContent value="file">
          <FileImport />
        </TabsContent>
        <TabsContent value="screenshot">
          <ScreenshotImport />
        </TabsContent>
      </Tabs>

      <div className="mt-6 grid gap-5">
        <ImportHistory />
        <ExportPanel />
        <p className="text-xs text-muted-foreground">
          Every saved value is labelled with where it came from: {Object.values(SOURCE_LABEL).join(", ")}.{" "}
          <Trash2 className="inline size-3" /> Removing an import deletes everything it added.
        </p>
      </div>
    </AppShell>
  );
}
