import { useState } from "react";

export const useSheetAnimation = (duration = 300) => {
  const [open, setOpen] = useState(false);
  const [isOpening, setIsOpening] = useState(false);
  const [isClosing, setIsClosing] = useState(false);

  const openSheet = () => {
    setOpen(true);
    setIsOpening(true);

    // ✅ force browser to apply initial state first
    setTimeout(() => {
      setIsOpening(false);
    }, 10); // 👈 important (NOT requestAnimationFrame)
  };

  const closeSheet = () => {
    setIsClosing(true);

    setTimeout(() => {
      setOpen(false);
      setIsClosing(false);
    }, duration);
  };

  return {
    open,
    isOpening,
    isClosing,
    openSheet,
    closeSheet,
  };
};