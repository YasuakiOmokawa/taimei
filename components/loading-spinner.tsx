"use client";

import { useEffect } from "react";
import { Loader, Loader2, RefreshCw, RotateCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LoadingSpinnerProps {
  isLoading: boolean;
  message?: string;
  fullScreen?: boolean;
  iconType?: "loader" | "loader2" | "refreshCw" | "rotateCw";
}

export function LoadingSpinner({
  isLoading,
  message = "",
  fullScreen = true,
  iconType = "loader2",
}: LoadingSpinnerProps) {
  // スピナーが表示されている間はスクロールを無効にする
  useEffect(() => {
    if (isLoading && fullScreen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.body.style.overflow = "";
    };
  }, [isLoading, fullScreen]);

  // アイコンタイプに基づいて適切なアイコンを選択
  const LoadingIcon = () => {
    switch (iconType) {
      case "loader":
        return <Loader className="h-12 w-12 text-primary animate-spin mb-4" />;
      case "refreshCw":
        return (
          <RefreshCw className="h-12 w-12 text-primary animate-spin mb-4" />
        );
      case "rotateCw":
        return (
          <RotateCw className="h-12 w-12 text-primary animate-spin mb-4" />
        );
      case "loader2":
      default:
        return <Loader2 className="h-12 w-12 text-primary animate-spin mb-4" />;
    }
  };

  return (
    <AnimatePresence>
      {isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`${
            fullScreen ? "fixed inset-0 z-50" : "absolute inset-0 z-10"
          } flex items-center justify-center bg-black/50 backdrop-blur-sm`}
          aria-live="assertive"
          role="status"
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            transition={{ type: "spring", damping: 20, stiffness: 300 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 max-w-sm w-full mx-4 flex flex-col items-center"
          >
            <LoadingIcon />
            <p className="text-center text-gray-700 dark:text-gray-300 font-medium">
              {message}
            </p>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
