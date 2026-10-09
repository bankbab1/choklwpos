// PromptPay / Thai QR payload builder ported from EverOn ESP32 reference.
// Generates EMVCo-style payload strings + appends CRC16/CCITT-FALSE checksum.
import type { AccountType, BankCode } from "@/features/pos/bank/BankAccountsProvider";

function crc16(data: string): string {
  let crc = 0xffff;
  for (let i = 0; i < data.length; i++) {
    crc ^= data.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      crc = (crc & 0x8000) ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

const pad2 = (n: number) => n.toString().padStart(2, "0");

function formatAmount(amount: number): string {
  // Always two decimals, no thousands separator
  return amount.toFixed(2);
}

export interface QrPayloadInput {
  bank: BankCode;
  type: AccountType;
  ref: string;
  amount: number; // in THB
}

/**
 * Build the Thai QR / PromptPay payload string for the given account + amount.
 * Returns null if unsupported combination.
 */
export function buildPromptPayPayload({ bank, type, ref, amount }: QrPayloadInput): string | null {
  const hasAmount = amount > 0;
  const amountStr = formatAmount(amount);
  let raw = "";
  let isStandardPromptPay = false;

  // --- Standard PromptPay (phone / idcard) for SCB / KTB / BBL ---
  if ((bank === "SCB" || bank === "KTB" || bank === "BBL") && (type === "phone" || type === "idcard")) {
    raw += "00020101021153037645802TH29370016A000000677010111";
    if (type === "phone") {
      raw += "0113" + ("0066" + ref.substring(1));
    } else {
      raw += "0213" + ref;
    }
    isStandardPromptPay = true;
  }

  // --- KBank Bank Account / Make by KBank ---
  else if (bank === "KBANK" && type === "bank") {
    raw += "00020101021129390016A0000006770101110315" + ref + "53037645802TH";
    isStandardPromptPay = true;
  }

  // --- KBank KShop (KPS004 prefix) ---
  else if (bank === "KBANK" && type === "kshop" && ref.startsWith("KPS004")) {
    const merchantId = ref.substring(6);
    raw += "000201010211";
    raw += "30810016A000000677010112";
    raw += "0115";
    raw += "0107536000315010214" + merchantId;
    raw += "0320KPS004" + merchantId;
    raw += "31690016A000000677010113";
    raw += "0103";
    raw += "0040214" + merchantId;
    raw += "0420KPS004" + merchantId;
    raw += "53037645802TH";
    if (hasAmount) raw += "54" + pad2(amountStr.length) + amountStr;
  }

  // --- KBank KShop (EMP prefix) ---
  else if (bank === "KBANK" && type === "kshop" && ref.toUpperCase().startsWith("EMP")) {
    const merchantId = ref.toUpperCase();
    const kbRef = merchantId.substring(3, merchantId.length - 3);
    raw += "000201010211";
    raw += "30810016A000000677010112";
    raw += "0115";
    raw += "010753600031508";
    raw += "0214" + kbRef + "03";
    raw += "20" + merchantId;
    raw += "31900016A000000677010113";
    raw += "0103";
    raw += "0040214" + kbRef + "04";
    raw += "20" + merchantId;
    raw += "0517" + kbRef + "001";
    raw += "53037645802TH";
    if (hasAmount) raw += "54" + pad2(amountStr.length) + amountStr;
  }

  // --- SCB Merchant (Company Biller — dynamic MPM) ---
  else if (bank === "SCB" && type === "merchant") {
    const merchantId = ref;
    const billRef = "REF001";
    raw += "0002010102" + (hasAmount ? "12" : "11");

    let tag30 = "";
    tag30 += "00" + "16" + "A000000677010112";
    tag30 += "01" + pad2(merchantId.length) + merchantId;
    tag30 += "02" + pad2(billRef.length) + billRef;
    tag30 += "03" + "04" + "0105";

    raw += "30" + pad2(tag30.length) + tag30;
    raw += "5802TH";
    raw += "5303764";
    if (hasAmount) raw += "54" + pad2(amountStr.length) + amountStr;

    raw += "6304";
    return raw + crc16(raw);
  }

  // --- SCB Mae Manee ---
  else if (bank === "SCB" && type === "maemanee") {
    const posId = "0000000000802739";
    raw += "0002010102" + (hasAmount ? "12" : "11");
    raw += "30650016A000000677010112";
    raw += "0115" + "010753600010286";
    raw += "0215" + ref;
    raw += "0303SCB5802TH5303764";
    if (hasAmount) raw += "54" + pad2(amountStr.length) + amountStr;
    raw += "62200716" + posId;
  } else {
    return null;
  }

  if (isStandardPromptPay && hasAmount) {
    raw += "54" + pad2(amountStr.length) + amountStr;
  }

  raw += "6304";
  return raw + crc16(raw);
}
