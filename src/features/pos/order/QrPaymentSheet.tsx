import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { Check, Landmark } from "lucide-react";
import { BaseSheet } from "@/features/pos/shared/BaseSheet";
import { SheetHeader } from "@/features/pos/shared/SheetHeader";
import { SheetFooter } from "@/features/pos/shared/SheetFooter";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { BANK_META, BankAccount } from "@/features/pos/bank/BankAccountsProvider";
import { buildPromptPayPayload } from "@/lib/qr/promptpay";
import qrInner from "@/relate_image/qr_inner.png";
import mainQrHead from "@/relate_image/main_qr_head.png";
import subQrHead from "@/relate_image/sub_qr_head.png";

interface Props {
  open: boolean;
  isOpening?: boolean;
  isClosing?: boolean;
  total: number;
  account: BankAccount | null;
  onClose: () => void;
  onPaid: () => void;
}

const maskRef = (ref: string) => {
  if (!ref) return "";
  if (ref.length <= 4) return ref;
  return `••• ${ref.slice(-4)}`;
};

const QrPaymentSheet = ({ open, isOpening, isClosing, total, account, onClose, onPaid }: Props) => {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const payload = useMemo(() => {
    if (!account || !account.bank || !account.type) return null;
    return buildPromptPayPayload({
      bank: account.bank,
      type: account.type,
      ref: account.ref,
      amount: total,
    });
  }, [account, total]);

  useEffect(() => {
    let cancelled = false;
    if (!payload) {
      setDataUrl(null);
      setError(account ? "Unsupported account configuration." : null);
      return;
    }
    setError(null);
    QRCode.toDataURL(payload, {
      errorCorrectionLevel: "H",
      margin: 1,
      width: 720,
      color: { dark: "#000000", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch((err) => {
        if (!cancelled) setError(err?.message ?? "Failed to render QR.");
      });
    return () => {
      cancelled = true;
    };
  }, [payload, account]);

  if (!open && !isClosing) return null;

  const meta = account?.bank ? BANK_META[account.bank] : null;

  return (
    <BaseSheet
      open={open}
      isOpening={isOpening}
      isClosing={isClosing}
      onClose={onClose}
      variant="full"
      className="bg-background flex flex-col"
    >
      {({ onDragStart, onDragMove, onDragEnd }) => (
        <div className="flex flex-col h-full overflow-hidden">
          <SheetHeader
            title="Payment QR"
            subtitle={account?.name || "Scan to pay"}
            meta={`฿${total.toFixed(2)}`}
            onClose={onClose}
            onDragStart={onDragStart}
            onDragMove={onDragMove}
            onDragEnd={onDragEnd}
          />

          <div className="flex-1 min-h-0 overflow-hidden px-5 py-3 flex flex-col items-center">
            {/* QR card — fits available height */}
            <div className="w-full max-w-[360px] h-full rounded-3xl bg-white shadow-sm border border-border/60 flex flex-col items-center overflow-hidden">
              <img src={mainQrHead} alt="" className="w-full object-contain shrink-0" />
              <img src={subQrHead} alt="" className="w-[28%] object-contain mt-2 shrink-0" />
              <div className="relative flex-1 min-h-0 aspect-square mt-1 mb-1">
                {dataUrl ? (
                  <>
                    <img
                      src={dataUrl}
                      alt="Payment QR code"
                      className="w-full h-full object-contain"
                    />
                    <img
                      src={qrInner}
                      alt=""
                      className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[18%] h-[18%] object-contain"
                    />
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">
                    {error ?? "Generating QR…"}
                  </div>
                )}
              </div>
              {account && (
                <div className="px-3 pb-3 text-center text-foreground shrink-0 w-full">
                  <p className="text-sm font-bold uppercase tracking-wide truncate">
                    {account.name || "Untitled account"}
                  </p>
                  <p className="text-xs font-medium mt-0.5 truncate">
                    {account.type ? `${account.type} : ${account.ref}` : account.ref}
                  </p>
                </div>
              )}
            </div>
          </div>

          <SheetFooter className="py-3">
            <Button
              className="w-full h-14 font-semibold gap-2"
              disabled={!dataUrl}
              onClick={onPaid}
            >
              <Check className="w-5 h-5" />
              Mark as paid
            </Button>
          </SheetFooter>
        </div>
      )}
    </BaseSheet>
  );
};

export default QrPaymentSheet;
