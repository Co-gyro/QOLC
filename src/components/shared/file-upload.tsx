"use client";

import { useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface FileUploadProps {
  onFile: (file: File) => void;
  accept?: string;
  maxSizeBytes?: number;
  label?: string;
  helperText?: string;
}

/**
 * ドラッグ&ドロップ対応のファイルアップロード入力。
 */
export function FileUpload({
  onFile,
  accept = ".csv,text/csv,application/octet-stream",
  maxSizeBytes = 10 * 1024 * 1024,
  label = "CSVファイルを選択またはドロップ",
  helperText = "最大10MBまで",
}: FileUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleFile(file: File) {
    setError(null);
    if (file.size > maxSizeBytes) {
      setError(`ファイルサイズが上限(${Math.round(maxSizeBytes / 1024 / 1024)}MB)を超えています`);
      return;
    }
    onFile(file);
  }

  return (
    <div>
      <div
        className={cn(
          "border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors",
          dragOver && "bg-green-50"
        )}
        style={{
          borderColor: dragOver ? "var(--qolc-primary)" : "var(--qolc-border)",
        }}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
      >
        <p className="text-base font-medium mb-1" style={{ color: "var(--qolc-text)" }}>
          {label}
        </p>
        <p className="text-xs" style={{ color: "var(--qolc-muted)" }}>
          {helperText}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
      </div>
      {error && (
        <p className="text-sm mt-2" style={{ color: "#DC2626" }}>
          {error}
        </p>
      )}
    </div>
  );
}
