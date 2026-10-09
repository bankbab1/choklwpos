import { useEffect, useRef, useState, useCallback } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { X, Camera, QrCode, Zap, SwitchCamera } from "lucide-react";
import { BaseSheet } from "@/features/pos/shared/BaseSheet";

interface Props {
  open: boolean;
  isOpening?: boolean;
  isClosing?: boolean;
  onClose: () => void;
  onResult: (value: string) => void;
  title?: string;
  subtitle?: string;
}

type Facing = "environment" | "user";

const ScanOrderSheet = ({
  open,
  isOpening,
  isClosing,
  onClose,
  onResult,
  title = "Scan receipt",
  subtitle = "Align the QR inside the frame",
}: Props) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState<Facing>("environment");
  const [hasMultipleCameras, setHasMultipleCameras] = useState(false);

  const pickDevice = useCallback(
    (devices: MediaDeviceInfo[], f: Facing) => {
      if (f === "user") {
        return (
          devices.find((d) => /front|user|face/i.test(d.label)) ?? devices[0]
        );
      }
      return (
        devices.find((d) => /back|rear|environment/i.test(d.label)) ??
        devices[devices.length - 1] ??
        devices[0]
      );
    },
    [],
  );

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const reader = new BrowserMultiFormatReader();
    setError(null);
    setReady(false);

    (async () => {
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        setHasMultipleCameras(devices.length > 1);
        const device = pickDevice(devices, facing);
        if (!device || !videoRef.current) {
          setError("No camera found on this device");
          return;
        }
        const controls = await reader.decodeFromVideoDevice(
          device.deviceId,
          videoRef.current,
          (result) => {
            if (cancelled || !result) return;
            const text = result.getText();
            if (text) {
              controls.stop();
              onResult(text);
            }
          },
        );
        controlsRef.current = controls;
        if (videoRef.current) {
          videoRef.current.onloadedmetadata = () => setReady(true);
        }
      } catch (e) {
        setError(
          e instanceof Error
            ? "Camera access denied. Enable camera permission in your browser settings."
            : "Unable to start camera",
        );
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [open, onResult, facing, pickDevice]);


  if (!open && !isClosing) return null;

  return (
    <BaseSheet
      open={open}
      isOpening={isOpening}
      isClosing={isClosing}
      onClose={onClose}
      variant="full"
      showOverlay={false}
      className="bg-black !pb-0"
    >
      {({ onDragStart, onDragMove, onDragEnd }) => (
        <div className="relative w-full h-full overflow-hidden text-white select-none">
          {/* Camera feed */}
          <video
            ref={videoRef}
            className="absolute inset-0 w-full h-full object-cover"
            playsInline
            muted
            autoPlay
          />

          {/* Dark scrim with cutout via SVG mask */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <mask id="scan-cutout">
                <rect width="100%" height="100%" fill="white" />
                <rect
                  x="50%"
                  y="50%"
                  width="280"
                  height="280"
                  rx="32"
                  ry="32"
                  transform="translate(-140,-140)"
                  fill="black"
                />
              </mask>
            </defs>
            <rect
              width="100%"
              height="100%"
              fill="rgba(0,0,0,0.6)"
              mask="url(#scan-cutout)"
            />
          </svg>

          {/* Aim frame with corner brackets + scan line */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative w-[280px] h-[280px]">
              {/* Corner brackets */}
              {[
                "top-0 left-0 border-t-[3px] border-l-[3px] rounded-tl-2xl",
                "top-0 right-0 border-t-[3px] border-r-[3px] rounded-tr-2xl",
                "bottom-0 left-0 border-b-[3px] border-l-[3px] rounded-bl-2xl",
                "bottom-0 right-0 border-b-[3px] border-r-[3px] rounded-br-2xl",
              ].map((c, i) => (
                <span
                  key={i}
                  className={`absolute w-10 h-10 border-primary ${c}`}
                />
              ))}

              {/* Animated scan line */}
              {ready && !error && (
                <div className="absolute inset-x-3 top-3 bottom-3 overflow-hidden rounded-xl">
                  <div className="absolute inset-x-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_12px_2px_hsl(var(--primary))] animate-scan-line" />
                </div>
              )}
            </div>
          </div>

          {/* Top bar - swipe down to close */}
          <div
            className="absolute top-0 inset-x-0 z-20 pt-[env(safe-area-inset-top)] touch-none"
            onTouchStart={onDragStart}
            onMouseDown={onDragStart}
          >
            <div className="bg-gradient-to-b from-black/75 via-black/40 to-transparent">
              {/* Drag handle */}
              <div className="flex justify-center pt-2 pb-1">
                <div className="h-1.5 w-12 rounded-full bg-white/40" />
              </div>
              <div className="flex items-center justify-between px-4 pb-4 pt-1">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-2xl bg-primary/20 backdrop-blur flex items-center justify-center">
                    <QrCode className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-base font-bold leading-tight">{title}</h2>
                    <p className="text-[11px] text-white/70">
                      {subtitle}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hasMultipleCameras && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setFacing((f) => (f === "environment" ? "user" : "environment"));
                      }}
                      onTouchStart={(e) => e.stopPropagation()}
                      onMouseDown={(e) => e.stopPropagation()}
                      className="h-10 w-10 rounded-full bg-white/15 backdrop-blur flex items-center justify-center active:scale-95 transition-transform"
                      aria-label="Switch camera"
                    >
                      <SwitchCamera className="w-5 h-5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose();
                    }}
                    onTouchStart={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                    className="h-10 w-10 rounded-full bg-white/15 backdrop-blur flex items-center justify-center active:scale-95 transition-transform"
                    aria-label="Close"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

              </div>
            </div>
          </div>


          {/* Bottom hint */}
          <div className="absolute bottom-0 inset-x-0 z-20 pb-[env(safe-area-inset-bottom)]">
            <div className="px-6 pt-10 pb-6 bg-gradient-to-t from-black/80 via-black/50 to-transparent">
              {error ? (
                <div className="rounded-2xl bg-destructive/95 text-destructive-foreground p-4 text-sm flex items-start gap-3">
                  <Camera className="w-5 h-5 shrink-0 mt-0.5" />
                  <span className="leading-snug">{error}</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-white/85 text-[13px]">
                  <Zap className="w-4 h-4 text-primary" />
                  <span>
                    {ready ? "Searching for QR code…" : "Starting camera…"}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </BaseSheet>
  );
};

export default ScanOrderSheet;
