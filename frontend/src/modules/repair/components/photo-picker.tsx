"use client";

/* eslint-disable @next/next/no-img-element -- Plain images are required by HANDOFF for authenticated/blob photo URLs. */
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { AlertCircle, Camera, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { MAX_PHOTOS, uploadPhoto } from "../api";
import { errorCode, errorMessage } from "../errors";
import type { Photo } from "../types";
import { PhotoLightbox } from "./photo-gallery";

export type PhotoItem = { key: string; file: File; preview: string; status: "uploading" | "done" | "failed"; progress: number; photo?: Photo; error?: string };

export function PhotoPicker({ value, onChange, disabled, invalid }: { value: PhotoItem[]; onChange: Dispatch<SetStateAction<PhotoItem[]>>; disabled?: boolean; invalid?: boolean }) {
  const input = useRef<HTMLInputElement>(null);
  const controllers = useRef(new Map<string, AbortController>());
  const previews = useRef(new Set<string>());
  const [message, setMessage] = useState("");
  const [opened, setOpened] = useState<string | null>(null);
  useEffect(() => {
    const pending = controllers.current;
    const urls = previews.current;
    return () => { pending.forEach((c) => c.abort()); urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, []);
  function upload(item: PhotoItem) {
    const controller = new AbortController(); controllers.current.set(item.key, controller);
    onChange((items) => items.map((p) => p.key === item.key ? { ...p, status: "uploading", progress: 0, error: undefined } : p));
    uploadPhoto(item.file, { signal: controller.signal, onProgress: (progress) => {
      if (!controller.signal.aborted) onChange((items) => items.map((p) => p.key === item.key ? { ...p, progress } : p));
    } }).then((photo) => {
      if (!controller.signal.aborted) onChange((items) => items.map((p) => p.key === item.key ? { ...p, status: "done", progress: 1, photo } : p));
    }).catch((err: unknown) => {
      if (controller.signal.aborted) return;
      const code = errorCode(err);
      const message = code === "PHOTO_TYPE_NOT_ALLOWED" || code === "PHOTO_TOO_LARGE" ? errorMessage(err) : undefined;
      if (message) setMessage(message);
      onChange((items) => items.map((p) => p.key === item.key ? { ...p, status: "failed", error: message } : p));
    }).finally(() => { if (controllers.current.get(item.key) === controller) controllers.current.delete(item.key); });
  }
  function choose(files: FileList | null) {
    if (!files || disabled) return;
    setMessage("");
    const slots = MAX_PHOTOS - value.length;
    if (files.length > slots) toast.error("แนบได้สูงสุด 5 รูป");
    const items: PhotoItem[] = [];
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/") && !/\.(heic|heif)$/i.test(file.name)) { setMessage("รองรับเฉพาะไฟล์รูปภาพ"); continue; }
      if (items.length >= slots) break;
      const preview = URL.createObjectURL(file); previews.current.add(preview);
      items.push({ key: crypto.randomUUID(), file, preview, status: "uploading", progress: 0 });
    }
    onChange((existing) => [...existing, ...items]);
    items.forEach(upload);
  }
  function remove(item: PhotoItem) {
    controllers.current.get(item.key)?.abort(); controllers.current.delete(item.key);
    URL.revokeObjectURL(item.preview); previews.current.delete(item.preview);
    setMessage(""); onChange((items) => items.filter((p) => p.key !== item.key));
  }
  const done = value.filter((p) => p.status === "done" && p.photo);
  const lightboxIndex = done.findIndex((p) => p.key === opened);
  return <div>
    <input ref={input} id="photo-files" type="file" accept="image/*" multiple className="sr-only" tabIndex={-1} aria-label="เพิ่มรูป" onChange={(e) => { choose(e.target.files); e.target.value = ""; }} disabled={disabled} />
    <div className="grid grid-cols-3 gap-2 lg:max-w-125 lg:grid-cols-5">
      {value.map((item, i) => <div key={item.key} className="relative aspect-square overflow-hidden rounded-sm bg-muted">
        <button type="button" disabled={item.status !== "done"} className="size-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={() => setOpened(item.key)} aria-label={`รูปภาพ ${i + 1} เปิดรูปเต็ม`}><img src={item.preview} alt={`รูปภาพ ${i + 1}`} className="size-full object-cover" /></button>
        {item.status === "uploading" && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-foreground/50 text-white" role="progressbar" aria-label={`อัปโหลดรูป ${i + 1}`} aria-valuenow={Math.round(item.progress * 100)} aria-valuemin={0} aria-valuemax={100}><div className="relative grid size-14 place-items-center"><svg className="absolute size-full -rotate-90" viewBox="0 0 48 48" aria-hidden><circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.25" /><circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="3" pathLength="100" strokeDasharray={`${item.progress * 100} 100`} /></svg><span className="text-xs">{Math.round(item.progress * 100)}%</span></div></div>}
        {item.status === "failed" && <button type="button" disabled={disabled} onClick={() => upload(item)} className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-destructive/90 px-2 pt-4 text-white focus-visible:outline-2 focus-visible:outline-ring" aria-label={`ลองใหม่ รูป ${i + 1}`}><AlertCircle className="size-5" aria-hidden /><span className="text-sm">ลองใหม่</span>{item.error && <span className="text-xs">{item.error}</span>}</button>}
        <Button type="button" variant="secondary" size="icon" disabled={disabled} onClick={() => remove(item)} aria-label={`ลบรูป ${i + 1}`} className="absolute top-0 right-0 rounded-full"><X className="size-4" /></Button>
      </div>)}
      {value.length < MAX_PHOTOS && <button id="photoIds" type="button" disabled={disabled} onClick={() => input.current?.click()} data-invalid={invalid} aria-describedby="photoIds-error photo-hint" className="flex aspect-square flex-col items-center justify-center gap-1 rounded-sm border-2 border-dashed border-input bg-card text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 data-[invalid=true]:border-destructive"><Camera className="size-7" aria-hidden /><span className="text-sm">เพิ่มรูป</span><span className="text-xs">{value.length}/5</span></button>}
    </div>
    {message && <p role="alert" className="mt-2 flex items-center gap-1 text-sm text-destructive"><AlertCircle className="size-4" aria-hidden />{message}</p>}
    <PhotoLightbox photos={done.map((p) => p.photo!)} index={lightboxIndex < 0 ? null : lightboxIndex} onIndexChange={(i) => setOpened(i === null ? null : done[i].key)} />
  </div>;
}
