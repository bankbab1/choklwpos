import { useEffect, useState } from "react";
import QRCode from "qrcode";

interface Props {
  value: string;
  size?: number;
}

const ReceiptQr = ({ value, size = 96 }: Props) => {
  const [dataUrl, setDataUrl] = useState<string>("");

  useEffect(() => {
    let cancelled = false;
    if (!value) {
      setDataUrl("");
      return;
    }
    QRCode.toDataURL(value, {
      width: size,
      margin: 0,
      errorCorrectionLevel: "M",
      color: { dark: "#0a0a0a", light: "#ffffff" },
    })
      .then((url) => {
        if (!cancelled) setDataUrl(url);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [value, size]);

  if (!dataUrl) {
    return (
      <div
        style={{ width: size, height: size }}
        className="block mx-auto bg-white"
      />
    );
  }

  return (
    <img
      src={dataUrl}
      width={size}
      height={size}
      alt="QR code"
      className="block mx-auto"
      style={{ width: size, height: size }}
    />
  );
};

export default ReceiptQr;
