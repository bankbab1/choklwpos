/**
 * Order ID generator
 *
 * Format: YYMMDD_BRANCH_NNNNNN_HHMMSS
 *   - YYMMDD    : date the ID was minted
 *   - BRANCH    : 6-char branch code (mocked as BR0001 for now)
 *   - NNNNNN    : 6-digit running number, resets daily per branch
 *   - HHMMSS    : time the ID was minted
 *
 * The ID is generated once at the commit trigger (Hold / Save as Open / Pay)
 * and then frozen for the lifetime of the order.
 */

// TODO: replace with real branch code from settings/session
export const BRANCH_CODE = "BR0001";

const pad = (n: number, len: number) => n.toString().padStart(len, "0");

const ymd = (d: Date) =>
  `${pad(d.getFullYear() % 100, 2)}${pad(d.getMonth() + 1, 2)}${pad(d.getDate(), 2)}`;

const hms = (d: Date) =>
  `${pad(d.getHours(), 2)}${pad(d.getMinutes(), 2)}${pad(d.getSeconds(), 2)}`;

const seqKey = (branch: string, dateStr: string) =>
  `orderSeq:${branch}:${dateStr}`;

const nextSeq = (branch: string, dateStr: string): number => {
  if (typeof window === "undefined") return 1;
  const key = seqKey(branch, dateStr);
  const raw = window.localStorage.getItem(key);
  const curr = raw ? parseInt(raw, 10) || 0 : 0;
  const next = curr + 1;
  window.localStorage.setItem(key, String(next));
  return next;
};

export interface GenerateOrderIdOptions {
  /** Override the timestamp (used for mock/seed data). Defaults to now. */
  at?: Date | number;
  /** Override the branch code. Defaults to BRANCH_CODE. */
  branch?: string;
  /** Override the running number (used for mock/seed data). */
  seq?: number;
}

export const generateOrderId = (opts: GenerateOrderIdOptions = {}): string => {
  const d = opts.at instanceof Date ? opts.at : new Date(opts.at ?? Date.now());
  const branch = opts.branch ?? BRANCH_CODE;
  const dateStr = ymd(d);
  const seq = opts.seq ?? nextSeq(branch, dateStr);
  return `${dateStr}_${branch}_${pad(seq, 6)}_${hms(d)}`;
};
