import { useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, Pencil, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useStores } from "@/features/pos/store/StoreProvider";
import { storeBranchToken } from "@/features/pos/store/ActiveStoreProvider";
import { useConfirm } from "@/hooks/ConfirmProvider";
import { groupByType, groupByZone, makeTables, useTables, type DiningTable } from "./TablesProvider";

type Editor =
  | { kind: "bulk"; prefix: string; start: number; count: number; zone: string; seatingType: string; seats: number }
  | { kind: "edit"; table: DiningTable }
  | { kind: "type"; zone: string; oldType: string; seatingType: string; oldPrefix: string; prefix: string; seats: number | "" };

const NAME_RE = /^(.*?)(\d+)$/;
/** Most common non-numeric prefix within a group of spots. */
const groupPrefix = (ts: DiningTable[]): string | null => {
  const counts = new Map<string, number>();
  ts.forEach((t) => {
    const m = t.name.match(NAME_RE);
    if (m) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
  });
  let best: string | null = null;
  let n = 0;
  counts.forEach((c, p) => { if (c > n) { n = c; best = p; } });
  return best;
};
const guessPrefix = (type: string) => {
  const t = type.toLowerCase();
  return t.startsWith("bar") ? "B" : t.startsWith("patio") ? "P" : t.startsWith("booth") ? "BT" : "T";
};

const inputCls =
  "w-full h-12 px-4 rounded-xl bg-secondary border border-border text-[16px] text-foreground outline-none focus:border-primary";

const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <label className="block space-y-1.5">
    <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</span>
    {children}
  </label>
);

const TablesView = ({ onBack }: { onBack: () => void }) => {
  const { stores } = useStores();
  const { tablesForStore, addTables, updateTable, updateTables, removeTable } = useTables();
  const confirm = useConfirm();
  const [storeId, setStoreId] = useState<string | undefined>(stores[0]?.id);
  const [editor, setEditor] = useState<Editor | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setCollapsed((p) => {
      const n = new Set(p);
      if (n.has(key)) n.delete(key); else n.add(key);
      return n;
    });

  const list = useMemo(() => tablesForStore(storeId), [tablesForStore, storeId]);
  const zones = useMemo(() => groupByZone(list), [list]);
  const totalSeats = list.filter((t) => t.enabled).reduce((s, t) => s + t.seats, 0);

  const groupOf = (zone: string, type: string) =>
    list.filter((t) => (t.zone || "Main") === zone && (t.seatingType || "Table") === type);

  const openBulk = (zone = zones[0]?.[0] ?? "Main", seatingType = "Table", isNewType = false) => {
    const group = isNewType ? [] : groupOf(zone, seatingType);
    const prefix = groupPrefix(group) ?? guessPrefix(seatingType);
    const nums = group
      .map((t) => t.name.match(NAME_RE))
      .filter((m): m is RegExpMatchArray => !!m && m[1] === prefix)
      .map((m) => parseInt(m[2], 10));
    const seats = group[group.length - 1]?.seats ?? 4;
    setEditor({ kind: "bulk", prefix, start: (nums.length ? Math.max(...nums) : 0) + 1, count: 1, zone, seatingType: isNewType ? "" : seatingType, seats });
  };

  const openType = (zone: string, type: string) => {
    const p = groupPrefix(groupOf(zone, type)) ?? "";
    setEditor({ kind: "type", zone, oldType: type, seatingType: type, oldPrefix: p, prefix: p, seats: "" });
  };

  const save = () => {
    if (!editor || !storeId) return;
    if (editor.kind === "bulk") {
      addTables(makeTables(storeId, { ...editor, seatingType: editor.seatingType.trim() || "Table" }));
    } else if (editor.kind === "type") {
      const newType = editor.seatingType.trim() || editor.oldType;
      const newPrefix = editor.prefix.trim();
      updateTables(
        groupOf(editor.zone, editor.oldType).map((t) => {
          const m = t.name.match(NAME_RE);
          const name = m && m[1] === editor.oldPrefix && newPrefix !== editor.oldPrefix ? `${newPrefix}${m[2]}`.slice(0, 12) : t.name;
          return { ...t, seatingType: newType, name, seats: editor.seats === "" ? t.seats : editor.seats };
        }),
      );
    } else {
      updateTable({ ...editor.table, name: editor.table.name.trim() || "T", zone: editor.table.zone.trim() || "Main", seatingType: editor.table.seatingType.trim() || "Table" });
    }
    setEditor(null);
  };

  const del = () => {
    if (editor?.kind !== "edit") return;
    const t = editor.table;
    confirm({
      title: `Delete ${t.name}?`,
      description: "Past orders keep the table name on their receipts.",
      confirmText: "Delete",
      variant: "destructive",
      onConfirm: () => {
        removeTable(t.id);
        setEditor(null);
      },
    });
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <header className="sticky top-0 z-20 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            onClick={onBack}
            className="h-9 w-9 flex items-center justify-center rounded-full bg-card border border-border active:scale-95 shrink-0"
            aria-label="Back to settings"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest leading-none">Settings</p>
            <h1 className="text-lg font-bold text-foreground truncate leading-tight mt-0.5">Tables</h1>
          </div>
        </div>
        <div className="px-3 pb-3 flex gap-2 overflow-x-auto">
          {stores.map((s) => (
            <button
              key={s.id}
              onClick={() => setStoreId(s.id)}
              className={cn(
                "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border transition",
                s.id === storeId ? "bg-primary text-primary-foreground border-primary" : "bg-card border-border text-foreground",
              )}
            >
              {storeBranchToken(s) ?? s.name}
              {s.branchName ? ` · ${s.branchName}` : ""}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-3 py-4 space-y-5 pb-[calc(24px+env(safe-area-inset-bottom))]">
        <p className="px-1 text-xs text-muted-foreground">
          {list.length} spots · {totalSeats} people. Seating belongs to this branch only.
        </p>
        {list.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-6 text-center space-y-3">
            <p className="text-sm text-muted-foreground">No seating yet. Takeaway still works without seating.</p>
            <Button variant="outline" onClick={() => openBulk()}><Plus className="h-4 w-4" /> Add seating</Button>
          </div>
        )}
        {zones.map(([zone, ts]) => (
          <section key={zone} className="space-y-2">
            <h2 className="px-1 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {zone} · {ts.length}
            </h2>
            {groupByType(ts).map(([seatingType, typeTables]) => {
              const key = `${zone}::${seatingType}`;
              const open = !collapsed.has(key);
              return (
                <div key={seatingType} className="rounded-2xl border border-border bg-card/50">
                  <div className="flex items-center gap-1 pl-3 pr-1 h-12">
                    <button
                      type="button"
                      onClick={() => toggle(key)}
                      className="flex-1 flex items-center gap-2 h-full text-left"
                      aria-expanded={open}
                    >
                      <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", !open && "-rotate-90")} />
                      <span className="text-sm font-semibold text-foreground">{seatingType}</span>
                      <span className="text-xs text-muted-foreground">
                        · {typeTables.length} · {groupPrefix(typeTables) ?? "—"}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => openType(zone, seatingType)}
                      className="h-10 w-10 flex items-center justify-center rounded-full text-muted-foreground active:scale-95"
                      aria-label={`Edit ${seatingType} type`}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                  </div>
                  {open && (
                    <div className="grid grid-cols-4 gap-2 px-3 pb-3">
                      {typeTables.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => setEditor({ kind: "edit", table: { ...t } })}
                          className={cn(
                            "aspect-square rounded-2xl border bg-card flex flex-col items-center justify-center gap-0.5 active:scale-95 transition",
                            t.enabled ? "border-border" : "border-dashed border-border opacity-50",
                          )}
                        >
                          <span className="text-sm font-bold text-foreground">{t.name}</span>
                          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                            <Users className="h-3 w-3" />
                            {t.seats}
                          </span>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => openBulk(zone, seatingType)}
                        className="aspect-square rounded-2xl border border-dashed border-border bg-muted/20 flex flex-col items-center justify-center gap-1 text-muted-foreground active:scale-95 transition"
                        aria-label={`Add ${seatingType} in ${zone}`}
                      >
                        <Plus className="h-5 w-5" />
                        <span className="text-[10px] font-semibold">Add</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </section>
        ))}
        {list.length > 0 && (
          <button
            type="button"
            onClick={() => openBulk(zones[0]?.[0] ?? "Main", "", true)}
            className="w-full h-20 rounded-2xl border border-dashed border-border bg-muted/20 flex items-center justify-center gap-2 text-sm font-semibold text-muted-foreground active:scale-[0.99] transition"
          >
            <Plus className="h-5 w-5" /> Add seating type
          </button>
        )}
      </main>

      {editor && (
        <div className="fixed inset-0 z-[60] bg-background flex flex-col">
          <header className="border-b border-border px-4 py-3">
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Tables</p>
            <h2 className="text-lg font-bold text-foreground">
              {editor.kind === "bulk" ? "Add seating" : editor.kind === "type" ? `Edit type · ${editor.oldType}` : `Edit ${editor.table.name}`}
            </h2>
          </header>
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {editor.kind === "type" ? (
              <>
                <Field label="Type name">
                  <input className={inputCls} maxLength={20} value={editor.seatingType} onChange={(e) => setEditor({ ...editor, seatingType: e.target.value })} />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Prefix">
                    <input className={inputCls} maxLength={6} value={editor.prefix} onChange={(e) => setEditor({ ...editor, prefix: e.target.value })} />
                  </Field>
                  <Field label="People each">
                    <input className={inputCls} type="number" inputMode="numeric" min={1} placeholder="Keep" value={editor.seats} onChange={(e) => setEditor({ ...editor, seats: e.target.value === "" ? "" : Math.max(1, +e.target.value || 1) })} />
                  </Field>
                </div>
                <p className="text-xs text-muted-foreground rounded-xl bg-muted/40 p-3">
                  Applies to every spot in {editor.oldType} · {editor.zone}.
                  {editor.prefix.trim() !== editor.oldPrefix && editor.oldPrefix
                    ? ` Renames ${editor.oldPrefix}1, ${editor.oldPrefix}2… to ${editor.prefix.trim()}1, ${editor.prefix.trim()}2…`
                    : ""}
                  {editor.seats === "" ? " Leave People empty to keep each spot's own capacity." : ""}
                </p>
              </>
            ) : editor.kind === "bulk" ? (
              <>
                <div className="grid grid-cols-3 gap-3">
                  <Field label="Prefix">
                    <input className={inputCls} maxLength={6} value={editor.prefix} onChange={(e) => setEditor({ ...editor, prefix: e.target.value })} />
                  </Field>
                  <Field label="Start at">
                    <input className={inputCls} type="number" inputMode="numeric" min={0} value={editor.start} onChange={(e) => setEditor({ ...editor, start: Math.max(0, +e.target.value || 0) })} />
                  </Field>
                  <Field label="How many">
                    <input className={inputCls} type="number" inputMode="numeric" min={1} max={200} value={editor.count} onChange={(e) => setEditor({ ...editor, count: Math.min(200, Math.max(0, +e.target.value || 0)) })} />
                  </Field>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Zone">
                    <input className={inputCls} maxLength={20} placeholder="Main, Upstairs…" value={editor.zone} onChange={(e) => setEditor({ ...editor, zone: e.target.value })} />
                  </Field>
                  <Field label="Type">
                    <input className={inputCls} maxLength={20} placeholder="Table, Bar, Patio…" value={editor.seatingType} onChange={(e) => setEditor({ ...editor, seatingType: e.target.value })} />
                  </Field>
                </div>
                <Field label="People each">
                    <input className={inputCls} type="number" inputMode="numeric" min={1} value={editor.seats} onChange={(e) => setEditor({ ...editor, seats: Math.max(1, +e.target.value || 1) })} />
                </Field>
                <p className="text-xs text-muted-foreground rounded-xl bg-muted/40 p-3">
                  Creates {editor.count > 0 ? `${editor.prefix}${editor.start} – ${editor.prefix}${editor.start + editor.count - 1}` : "nothing"} as {editor.seatingType || "Table"} in {editor.zone || "Main"}. You can edit each spot afterwards.
                </p>
              </>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Spot name">
                    <input className={inputCls} maxLength={12} value={editor.table.name} onChange={(e) => setEditor({ kind: "edit", table: { ...editor.table, name: e.target.value } })} />
                  </Field>
                   <Field label="People">
                    <input className={inputCls} type="number" inputMode="numeric" min={1} value={editor.table.seats} onChange={(e) => setEditor({ kind: "edit", table: { ...editor.table, seats: Math.max(1, +e.target.value || 1) } })} />
                  </Field>
                </div>
                <Field label="Zone">
                  <input className={inputCls} maxLength={20} value={editor.table.zone} onChange={(e) => setEditor({ kind: "edit", table: { ...editor.table, zone: e.target.value } })} />
                </Field>
                <Field label="Type">
                  <input className={inputCls} maxLength={20} value={editor.table.seatingType} onChange={(e) => setEditor({ kind: "edit", table: { ...editor.table, seatingType: e.target.value } })} />
                </Field>
                <div className="flex items-center justify-between rounded-2xl border border-border bg-card p-4">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Available</p>
                    <p className="text-xs text-muted-foreground">Off hides it from the table map</p>
                  </div>
                  <Switch checked={editor.table.enabled} onCheckedChange={(v) => setEditor({ kind: "edit", table: { ...editor.table, enabled: v } })} />
                </div>
                <Button variant="destructive" className="w-full h-12 font-semibold" onClick={del}>
                  Delete seating
                </Button>
              </>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2 border-t border-border px-4 py-3 pb-[calc(12px+env(safe-area-inset-bottom))]">
            <Button variant="outline" className="h-12 font-semibold" onClick={() => setEditor(null)}>
              Cancel
            </Button>
            <Button className="h-12 font-semibold" disabled={editor.kind === "bulk" && editor.count < 1} onClick={save}>
              {editor.kind === "bulk" ? "Save" : "Update"}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default TablesView;
