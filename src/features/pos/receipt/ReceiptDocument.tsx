import { CartItem } from "@/data/products";
import {
    getLineTotal,
    getOriginalLineTotal,
    getUnitDiscount,
} from "@/lib/pricing/pricing";
import ReceiptQr from "./ReceiptQr";
import { useStores, type Store } from "@/features/pos/store/StoreProvider";
import {
    ReceiptTemplate,
    useReceiptTemplate,
} from "./ReceiptTemplateProvider";
import type { BankCode, AccountType } from "@/features/pos/bank/BankAccountsProvider";
import { buildPromptPayPayload } from "@/lib/qr/promptpay";

export type ReceiptMode = "bill" | "receipt";

export interface ReceiptPayment {
    method: "cash" | "qr";
    bankName?: string;
    accountName?: string;
    accountRef?: string;
    refNo?: string;
    bank?: BankCode;
    type?: AccountType;
}

/** Slim view of a Store used by the receipt — supplied at render time. */
export interface ReceiptShopInfo {
    name: string;
    branch?: string;
    logo?: string;
    headline?: string;
    addressLines: string[];
    contactLines: string[]; // phone / tax id / website
    /** Optional sub-label shown beside the doc type (e.g. "ใบกำกับภาษีอย่างย่อ"). */
    taxInvoiceLabel?: string;
    qrCaption?: string;
    billFooterTitle?: string;
    billFooterSub?: string;
    billFooterNote1?: string;
    billFooterNote2?: string;
    receiptFooterTitle?: string;
    receiptFooterSub?: string;
    receiptFooterNote1?: string;
    receiptFooterNote2?: string;
}


export interface ReceiptProps {
    mode: ReceiptMode;
    items: CartItem[];
    orderId?: string;
    contextLabel?: string;
    issuedAt?: Date;
    memberName?: string;
    memberDiscount?: number;
    promotionName?: string;
    promotionDiscount?: number;
    orderDiscount?: number;
    payment?: ReceiptPayment;
    cashier?: string;
    /** Override store info (used by live preview). Otherwise pulled from default store. */
    shopOverride?: ReceiptShopInfo;
    /** Branch whose info should be printed (order's store). Falls back to default store. */
    storeId?: string;
    /** Override template (used by live preview). Otherwise pulled from context. */
    templateOverride?: ReceiptTemplate;
}

const fmt = (n: number) => n.toFixed(2);

const formatDateTime = (d: Date) => {
    const pad = (x: number) => String(x).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(
        d.getDate(),
    )} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const SCALE_CLASS: Record<ReceiptTemplate["textScale"], string> = {
    sm: "text-[11px]",
    md: "text-[12px]",
    lg: "text-[13px]",
};

const WIDTH_CLASS: Record<ReceiptTemplate["paperWidth"], string> = {
    narrow: "max-w-[280px] mx-auto",
    wide: "",
};

/** Build a ReceiptShopInfo from a Store record. */
export const shopInfoFromStore = (store?: Store | null): ReceiptShopInfo => {
    if (!store) {
        return {
            name: "Your Store",
            branch: "",
            logo: "",
            headline: "",
            addressLines: ["Add a store in Settings → Stores"],
            contactLines: [],
            qrCaption: "",
            billFooterTitle: "",
            billFooterSub: "",
            billFooterNote1: "",
            billFooterNote2: "",
            receiptFooterTitle: "",
            receiptFooterSub: "",
            receiptFooterNote1: "",
            receiptFooterNote2: "",
        };
    }
    const tinLine =
        store.vatRegistered && store.taxId
            ? `Tax ID: ${store.taxId}${
                  store.branchCode ? ` (Branch ${store.branchCode})` : ""
              }`
            : undefined;
    return {
        name: store.name || "Untitled Store",
        branch: store.branch,
        logo: store.logo,
        headline: store.headline,
        addressLines: [
            store.address_line1,
            store.address_line2,
            store.address_line3,
            store.address_line4,
        ].filter((l) => l && l.trim()),
        contactLines: [
            store.phone && `Tel: ${store.phone}`,
            tinLine,
            store.website,
        ].filter(Boolean) as string[],
        taxInvoiceLabel: store.vatRegistered
            ? "ABB (Abbreviated Tax Invoice)"
            : undefined,
        qrCaption: store.qrCaption,
        billFooterTitle: store.billFooterTitle,
        billFooterSub: store.billFooterSub,
        billFooterNote1: store.billFooterNote1,
        billFooterNote2: store.billFooterNote2,
        receiptFooterTitle: store.receiptFooterTitle,
        receiptFooterSub: store.receiptFooterSub,
        receiptFooterNote1: store.receiptFooterNote1,
        receiptFooterNote2: store.receiptFooterNote2,
    };
};


const useDefaultShop = (storeId?: string): ReceiptShopInfo => {
    const { stores } = useStores();
    const { template } = useReceiptTemplate();
    const store =
        (storeId && stores.find((s) => s.id === storeId)) ||
        (template.defaultStoreId && stores.find((s) => s.id === template.defaultStoreId)) ||
        stores.find((s) => s.enabled) ||
        stores[0];
    return shopInfoFromStore(store);
};

const ReceiptDocument = ({
    mode,
    items,
    orderId,
    contextLabel,
    issuedAt = new Date(),
    memberName,
    memberDiscount = 0,
    promotionName,
    promotionDiscount = 0,
    orderDiscount = 0,
    payment,
    cashier = "Staff",
    shopOverride,
    storeId,
    templateOverride,
}: ReceiptProps) => {
    const ctxShop = useDefaultShop(storeId);
    const ctxTpl = useReceiptTemplate().templateForStore(storeId);
    const shop = shopOverride ?? ctxShop;
    const t = templateOverride ?? ctxTpl;

    const subtotal = items.reduce((s, i) => s + getOriginalLineTotal(i), 0);
    const itemDiscount = items.reduce(
        (s, i) => s + (getOriginalLineTotal(i) - getLineTotal(i)),
        0,
    );
    const afterItem = items.reduce((s, i) => s + getLineTotal(i), 0);
    const total = Math.max(
        0,
        afterItem - memberDiscount - promotionDiscount - orderDiscount,
    );
    const totalQty = items.reduce((s, i) => s + i.quantity, 0);

    const docTitle = mode === "bill" ? t.billTitle : t.receiptTitle;
    const docSub =
        mode === "bill"
            ? t.billSubLabel
            : payment?.method === "cash"
                ? t.receiptCashLabel
                : t.receiptQrLabel;

    const hasAddress = t.showAddress && shop.addressLines.length > 0;
    const hasContact = t.showContact && shop.contactLines.length > 0;
    const hasHeadline = t.showHeadline && !!shop.headline?.trim();

    const footerTitle =
        mode === "bill" ? shop.billFooterTitle : shop.receiptFooterTitle;
    const footerSub =
        mode === "bill" ? shop.billFooterSub : shop.receiptFooterSub;
    const footerNote1 =
        mode === "bill" ? shop.billFooterNote1 : shop.receiptFooterNote1;
    const footerNote2 =
        mode === "bill" ? shop.billFooterNote2 : shop.receiptFooterNote2;
    const footerLines = [footerTitle, footerSub, footerNote1, footerNote2].filter(
        (l) => l && l.trim(),
    ) as string[];
    const showFooterBlock = t.showFooter && footerLines.length > 0;

    return (
        <div
            className={`receipt-doc font-mono ${SCALE_CLASS[t.textScale]} text-zinc-900 bg-white ${WIDTH_CLASS[t.paperWidth]} relative`}
        >
            {/* HEAD */}
            <div className="text-center pt-5 pb-3 px-5">
                {t.showLogo && shop.logo && (
                    <img
                        src={shop.logo}
                        alt={shop.name}
                        className="mx-auto h-12 w-12 rounded-md object-cover mb-2"
                    />
                )}
                {t.showBranch && shop.branch && (
                    <div className="text-[10px] tracking-[0.25em] uppercase text-zinc-500">
                        {shop.branch}
                    </div>
                )}
                {t.showShopName && (
                    <h1 className="text-xl font-extrabold mt-1 tracking-tight">
                        {shop.name}
                    </h1>
                )}
                {hasHeadline && (
                    <div className="text-[10px] italic text-zinc-500 mt-0.5">
                        {shop.headline}
                    </div>
                )}
                {(hasAddress || hasContact) && (
                    <div className="text-[10px] text-zinc-500 mt-1 leading-snug">
                        {hasAddress &&
                            shop.addressLines.map((l, i) => (
                                <div key={`a-${i}`}>{l}</div>
                            ))}
                        {hasContact &&
                            shop.contactLines.map((l, i) => (
                                <div key={`c-${i}`}>{l}</div>
                            ))}
                    </div>
                )}

                {/* doc type badge */}
                <div className="inline-flex items-center gap-2 mt-3 px-3 py-1 rounded-full bg-zinc-900 text-white text-[10px] font-bold tracking-[0.2em]">
                    {docTitle}
                    <span className="w-1 h-1 rounded-full bg-white/60" />
                    {docSub}
                </div>
                {mode === "receipt" && shop.taxInvoiceLabel && (
                    <div className="text-[10px] mt-1 text-zinc-700 font-semibold tracking-wide">
                        {shop.taxInvoiceLabel}
                    </div>
                )}
            </div>


            {/* meta */}
            {(t.showOrderNo || t.showRef || t.showDate || t.showCashier || t.showCustomer) && (
                <div className="px-5 pb-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-[11px]">
                    {t.showOrderNo && (
                        <>
                            <div className="text-zinc-500">No.</div>
                            <div className="text-right font-semibold tabular-nums whitespace-nowrap text-[10px]">
                                {orderId || "—"}
                            </div>
                        </>
                    )}
                    {t.showRef && contextLabel && (
                        <>
                            <div className="text-zinc-500">Ref</div>
                            <div className="text-right font-semibold break-words">{contextLabel}</div>
                        </>
                    )}
                    {t.showDate && (
                        <>
                            <div className="text-zinc-500">Date</div>
                            <div className="text-right tabular-nums">
                                {formatDateTime(issuedAt)}
                            </div>
                        </>
                    )}
                    {t.showCashier && (
                        <>
                            <div className="text-zinc-500">Cashier</div>
                            <div className="text-right">{cashier}</div>
                        </>
                    )}
                    {t.showCustomer && (
                        <>
                            <div className="text-zinc-500">Customer</div>
                            <div className="text-right break-words">{memberName || "Walk-in"}</div>
                        </>
                    )}
                </div>
            )}

            {/* dashed sep */}
            <div className="mx-5 border-t border-dashed border-zinc-300 my-2" />

            {/* items */}
            <div className="px-5 space-y-2">
                {items.map((item, idx) => {
                    const original = getOriginalLineTotal(item);
                    const final = getLineTotal(item);
                    const unitDisc = getUnitDiscount(item);
                    const lineDisc =
                        item.lineTarget != null
                            ? original - item.lineTarget
                            : unitDisc * item.quantity;

                    return (
                        <div key={item.id} className="text-[11px]">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1">
                                    <div className="font-semibold leading-snug break-words">
                                        {idx + 1}. {item.name}
                                    </div>
                                    {item.options && item.options.length > 0 && (
                                        <div className="text-[10px] text-zinc-500 leading-snug mt-0.5">
                                            {item.options
                                                .map(
                                                    (o) =>
                                                        `${o.groupName}: ${o.optionName}${o.price > 0 ? ` (+${fmt(o.price)})` : ""
                                                        }`,
                                                )
                                                .join("  ·  ")}
                                        </div>
                                    )}
                                    {item.note && (
                                        <div className="text-[10px] text-zinc-500 italic mt-0.5">
                                            Note: {item.note}
                                        </div>
                                    )}
                                </div>
                                <div className="text-right tabular-nums shrink-0">
                                    <div className="text-zinc-500 text-[10px]">
                                        {item.quantity} × {fmt(original / Math.max(1, item.quantity))}
                                    </div>
                                    <div className="font-semibold">฿{fmt(final)}</div>
                                </div>
                            </div>
                            {t.showItemDiscounts && lineDisc > 0 && !item.isFree && (
                                <div className="flex justify-between text-[10px] text-emerald-700 mt-0.5">
                                    <span>Item discount</span>
                                    <span>-฿{fmt(lineDisc)}</span>
                                </div>
                            )}
                            {item.isFree && (
                                <div className="flex justify-between text-[10px] text-emerald-700 mt-0.5">
                                    <span>Free</span>
                                    <span>-฿{fmt(original)}</span>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="mx-5 border-t border-dashed border-zinc-300 my-2" />

            {/* totals */}
            <div className="px-5 text-[11px] space-y-1 tabular-nums">
                <div className="flex justify-between">
                    <span className="text-zinc-500">
                        Subtotal ({items.length} items · {totalQty} pcs)
                    </span>
                    <span>฿{fmt(subtotal)}</span>
                </div>
                {t.showItemDiscounts && itemDiscount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                        <span>Item discount</span>
                        <span>-฿{fmt(itemDiscount)}</span>
                    </div>
                )}
                {promotionDiscount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                        <span>Promo{promotionName ? ` (${promotionName})` : ""}</span>
                        <span>-฿{fmt(promotionDiscount)}</span>
                    </div>
                )}
                {memberDiscount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                        <span>Member discount</span>
                        <span>-฿{fmt(memberDiscount)}</span>
                    </div>
                )}
                {orderDiscount > 0 && (
                    <div className="flex justify-between text-emerald-700">
                        <span>Order discount</span>
                        <span>-฿{fmt(orderDiscount)}</span>
                    </div>
                )}
            </div>

            <div className="mx-5 border-t border-zinc-900 my-2" />

            <div className="px-5 flex justify-between items-center text-base font-extrabold tabular-nums">
                <span>{mode === "bill" ? "AMOUNT DUE" : "TOTAL"}</span>
                <span>฿{fmt(total)}</span>
            </div>

            {/* payment block (receipt only) */}
            {mode === "receipt" && payment && (
                <>
                    <div className="mx-5 border-t border-dashed border-zinc-300 my-3" />
                    <div className="px-5 text-[11px] space-y-1 tabular-nums">
                        <div className="flex justify-between">
                            <span className="text-zinc-500">Payment method</span>
                            <span className="font-semibold uppercase tracking-wide">
                                {payment.method === "cash" ? "Cash" : "QR Payment"}
                            </span>
                        </div>
                        {payment.method === "qr" && payment.bankName && (
                            <div className="flex justify-between">
                                <span className="text-zinc-500">Bank</span>
                                <span>{payment.bankName}</span>
                            </div>
                        )}
                        {payment.refNo && (
                            <div className="flex justify-between">
                                <span className="text-zinc-500">Txn No.</span>
                                <span>{payment.refNo}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-semibold">
                            <span>Amount paid</span>
                            <span>฿{fmt(total)}</span>
                        </div>
                    </div>
                </>
            )}

            {/* Bottom QR — payment on bill, order lookup on receipt */}
            {mode === "bill" && t.showBillPaymentQr && payment?.bank && payment?.type && payment?.accountRef && total > 0 && (
                <div className="text-center px-5 pt-3 pb-2">
                    <div className="mx-auto w-12 h-[2px] bg-zinc-900 mb-3" />
                    <div className="inline-block px-2.5 py-0.5 rounded-full bg-zinc-900 text-white text-[9px] font-bold tracking-[0.2em] mb-2">
                        PAY HERE
                    </div>
                    <ReceiptQr
                        value={buildPromptPayPayload({
                            bank: payment.bank,
                            type: payment.type,
                            ref: payment.accountRef,
                            amount: total,
                        }) ?? ""}
                        size={192}
                    />
                    <div className="text-[10px] text-zinc-500 mt-1.5 font-medium">
                        Scan to pay ฿{fmt(total)}
                    </div>
                </div>
            )}
            {mode === "bill" && t.showQr && orderId && (
                <div className="px-5 pt-3 pb-1">
                    <div className="mx-5 border-t border-dashed border-zinc-300 mb-3 -mx-0" />
                    <div className="flex items-center gap-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2">
                        <ReceiptQr value={orderId} size={80} />
                        <div className="flex-1 min-w-0">
                            <div className="inline-block px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700 text-[8px] font-bold tracking-[0.15em] uppercase">
                                Staff use
                            </div>
                            <div className="text-[10px] text-zinc-600 mt-1 leading-snug">
                                {shop.qrCaption || "Scan to look up this order"}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {mode === "receipt" && t.showQr && orderId && (
                <div className="px-5 pt-3 pb-2">
                    <div className="mx-5 border-t border-dashed border-zinc-300 mb-3 -mx-0" />
                    <div className="flex items-center gap-3 rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2">
                        <ReceiptQr value={orderId} size={80} />
                        <div className="flex-1 min-w-0">
                            <div className="inline-block px-1.5 py-0.5 rounded bg-zinc-200 text-zinc-700 text-[8px] font-bold tracking-[0.15em] uppercase">
                                Staff use
                            </div>
                            <div className="text-[10px] text-zinc-600 mt-1 leading-snug">
                                {shop.qrCaption || "Scan to look up this order"}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* footer — from the Store master, mode-specific */}
            {showFooterBlock ? (
                <div className="text-center px-5 pt-3 pb-5 mt-1">
                    <div className="mx-auto w-12 h-[2px] bg-zinc-900 mb-3" />
                    {footerTitle && footerTitle.trim() && (
                        <div className="text-[11px] font-semibold">{footerTitle}</div>
                    )}
                    {footerSub && footerSub.trim() && (
                        <div className="text-[10px] text-zinc-500 mt-0.5">{footerSub}</div>
                    )}
                    {footerNote1 && footerNote1.trim() && (
                        <div className="text-[10px] text-zinc-500 mt-0.5">{footerNote1}</div>
                    )}
                    {footerNote2 && footerNote2.trim() && (
                        <div className="text-[10px] text-zinc-500 mt-0.5">{footerNote2}</div>
                    )}
                </div>
            ) : (
                /* keep bottom whitespace so paper doesn't end abruptly */
                <div className="pb-6" />
            )}
        </div>
    );
};

export default ReceiptDocument;
