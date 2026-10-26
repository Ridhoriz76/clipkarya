"use client";
import { useRef, useState } from "react";
import { UploadCloud } from "lucide-react";
import { cn, formatBytes } from "@/lib/utils";

export function Dropzone({
  accept,
  onFile,
  hint,
  disabled,
  file,
}: {
  accept: string;
  onFile: (f: File) => void;
  hint?: string;
  disabled?: boolean;
  file?: File | null;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => !disabled && ref.current?.click()}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && ref.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const f = e.dataTransfer.files[0];
        if (f && !disabled) onFile(f);
      }}
      className={cn(
        "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-border px-6 py-10 text-center transition-colors hover:border-primary/50 hover:bg-primary/5",
        over && "border-primary bg-primary/5",
        disabled && "pointer-events-none opacity-60",
      )}
    >
      <UploadCloud className="mb-3 size-8 text-muted-foreground" />
      {file ? (
        <>
          <p className="font-medium">{file.name}</p>
          <p className="text-sm text-muted-foreground">{formatBytes(file.size)} · klik untuk mengganti</p>
        </>
      ) : (
        <>
          <p className="font-medium">Tarik & lepas file, atau klik untuk memilih</p>
          {hint && <p className="mt-1 text-sm text-muted-foreground">{hint}</p>}
        </>
      )}
      <input
        ref={ref}
        type="file"
        accept={accept}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />
    </div>
  );
}
