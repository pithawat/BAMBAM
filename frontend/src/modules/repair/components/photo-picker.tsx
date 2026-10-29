"use client";

/* eslint-disable @next/next/no-img-element -- Plain images are required by HANDOFF for authenticated/blob photo URLs. */
import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";
import { AlertCircle, Camera, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MAX_PHOTOS, preparePhoto, uploadPhoto } from "../api";
import { errorCode, errorMessage } from "../errors";
import type { Photo } from "../types";
import { PhotoLightbox } from "./photo-gallery";

/**
 * CR-026 A1: a picked photo stays in the form until the form is sent. `file` is the resized photo
 * (`preparing` until the resize is done, then `ready`); the form's submit uploads it (`uploading` → `done`
 * with `photo`, kept so a retry re-uses it, or `failed`). A legacy draft photo has `photo` and no `file`.
 */
export type PhotoItem = {
  key: string; file?: File; preview: string; status: "preparing" | "ready" | "uploading" | "done" | "failed";
  progress: number; photo?: Photo; error?: string;
};

export const isImageFile = (file: File) => file.type.startsWith("image/") || /\.(heic|heif)$/i.test(file.name);

/** A kept photo restored from the draft store (S03, IndexedDB). */
export const keptPhoto = (file: File): PhotoItem => ({ key: crypto.randomUUID(), file, preview: URL.createObjectURL(file), status: "ready", progress: 0 });

/** Photos that can be shown in the lightbox: kept ones by their local preview, uploaded ones by their URL. */
export const viewablePhotos = (items: PhotoItem[]) => items.filter((p) => p.status === "ready" || p.status === "done");
const toLightbox = (items: PhotoItem[]): Photo[] => items.map((p) => p.photo ?? { id: p.key, url: p.preview, thumbUrl: p.preview });

/**
 * Why a form cannot be sent yet because of its photos (`_common.md` §5), or undefined. A tile that failed
 * for a network reason does not block: the next submit retries it. One the server refused (type / size) does.
 */
export function photoBlocker(items: PhotoItem[]): string | undefined {
  if (items.some((p) => p.status === "preparing" || p.status === "uploading")) return "รอให้รูปอัปโหลดเสร็จก่อน";
  if (items.some((p) => p.status === "failed" && p.error)) return "มีรูปที่อัปโหลดไม่สำเร็จ ลองใหม่หรือลบรูปนั้น";
  return undefined;
}

type PhotoGroup = { items: PhotoItem[]; onChange: Dispatch<SetStateAction<PhotoItem[]>> };

/** The type / size messages the server or the browser gives for one photo; other failures have none. */
const refusal = (err: unknown) => {
  const code = errorCode(err);
  return code === "PHOTO_TYPE_NOT_ALLOWED" || code === "PHOTO_TOO_LARGE" ? errorMessage(err) : undefined;
};

async function uploadOne(item: PhotoItem, onChange: PhotoGroup["onChange"], signal?: AbortSignal): Promise<Photo> {
  const set = (patch: Partial<PhotoItem>) => onChange((items) => items.map((p) => p.key === item.key ? { ...p, ...patch } : p));
  set({ status: "uploading", progress: 0, error: undefined });
  try {
    const photo = await uploadPhoto(item.file!, { signal, onProgress: (progress) => { if (!signal?.aborted) set({ progress }); } });
    set({ status: "done", progress: 1, photo });
    return photo;
  } catch (err) {
    if (!signal?.aborted) set({ status: "failed", error: refusal(err) });
    throw err;
  }
}

/**
 * CR-026 A1 submit step, shared by S03 (+ team `รูปหลังทำ`), S04 follow, S08 and S10: uploads (#3) every kept
 * photo not uploaded yet, one at a time, and returns the photo ids of each group in order. Photos uploaded by an
 * earlier attempt are re-used. Stops at the first failure (that tile turns `failed`) and rethrows it.
 * `onProgress(n, m)` drives the button label `กำลังส่งรูป {n}/{m}…`.
 */
export async function uploadKeptPhotos(groups: PhotoGroup[], onProgress?: (n: number, m: number) => void, signal?: AbortSignal): Promise<string[][]> {
  const m = groups.reduce((sum, g) => sum + g.items.filter((p) => !p.photo).length, 0);
  let n = 0;
  const out: string[][] = [];
  for (const group of groups) {
    const ids: string[] = [];
    for (const item of group.items) {
      if (item.photo) { ids.push(item.photo.id); continue; }
      onProgress?.(++n, m);
      ids.push((await uploadOne(item, group.onChange, signal)).id);
    }
    out.push(ids);
  }
  return out;
}

/** A failed #5 / #9 / #10 / #23 with PHOTO_NOT_FOUND: forget the uploads so the next submit sends the files again. */
export const forgetUploads = (items: PhotoItem[]) => items.map((p): PhotoItem => p.file && p.photo ? { ...p, photo: undefined, status: "ready", progress: 0 } : p);

/**
 * The photo list of a form (S03, S08, S10): adds files (resized at once, kept in the browser — nothing is
 * sent until submit, CR-026 A1), removes, and retries a failed tile. Previews are revoked on unmount.
 */
export function usePhotoList(value: PhotoItem[], onChange: Dispatch<SetStateAction<PhotoItem[]>>, disabled?: boolean) {
  const previews = useRef(new Set<string>());
  const retrying = useRef(new Map<string, AbortController>());
  const [message, setMessage] = useState("");
  useEffect(() => { value.forEach((p) => { if (p.preview.startsWith("blob:")) previews.current.add(p.preview); }); }, [value]);
  useEffect(() => {
    const urls = previews.current;
    const pending = retrying.current;
    return () => { pending.forEach((c) => c.abort()); urls.forEach((url) => URL.revokeObjectURL(url)); };
  }, []);
  function choose(files: FileList | File[] | null) {
    if (!files || disabled) return;
    setMessage("");
    const list = Array.from(files);
    const slots = MAX_PHOTOS - value.length;
    if (list.length > slots) toast.error("แนบได้สูงสุด 5 รูป");
    const items: PhotoItem[] = [];
    for (const file of list) {
      if (!isImageFile(file)) { setMessage("รองรับเฉพาะไฟล์รูปภาพ"); continue; }
      if (items.length >= slots) break;
      const key = crypto.randomUUID();
      const preview = URL.createObjectURL(file); previews.current.add(preview);
      items.push({ key, preview, status: "preparing", progress: 0 });
      preparePhoto(file).then((resized) => {
        onChange((all) => all.map((p) => p.key === key ? { ...p, file: resized, status: "ready" } : p));
      }, (err: unknown) => {
        setMessage(refusal(err) ?? "รองรับเฉพาะไฟล์รูปภาพ");
        onChange((all) => all.filter((p) => p.key !== key));
      });
    }
    onChange((existing) => [...existing, ...items]);
  }
  function remove(item: PhotoItem) {
    retrying.current.get(item.key)?.abort(); retrying.current.delete(item.key);
    if (previews.current.delete(item.preview)) URL.revokeObjectURL(item.preview);
    setMessage(""); onChange((items) => items.filter((p) => p.key !== item.key));
  }
  /** Tapping a failed tile (after a submit) uploads that photo again; the next submit re-uses it. */
  function retry(item: PhotoItem) {
    if (!item.file) return;
    const controller = new AbortController(); retrying.current.set(item.key, controller);
    uploadOne(item, onChange, controller.signal).catch(() => {}).finally(() => { if (retrying.current.get(item.key) === controller) retrying.current.delete(item.key); });
  }
  return { choose, remove, retry, message, full: value.length >= MAX_PHOTOS };
}

/** One photo tile: local or uploaded preview, upload ring while sending, retry, remove; tap opens the lightbox. */
export function PhotoTile({ item, index, disabled, onOpen, onRetry, onRemove, className }: {
  item: PhotoItem; index: number; disabled?: boolean; onOpen: () => void; onRetry: () => void; onRemove: () => void; className?: string;
}) {
  const viewable = item.status === "ready" || item.status === "done";
  return <div className={cn("relative overflow-hidden rounded-sm border bg-muted", className)} data-photo-status={item.status}>
    <button type="button" disabled={!viewable} className="size-full outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring" onClick={onOpen} aria-label={`รูปภาพ ${index + 1} เปิดรูปเต็ม`}><img src={item.preview} alt={`รูปภาพ ${index + 1}`} className={cn("size-full object-cover", item.status === "preparing" && "opacity-60")} /></button>
    {item.status === "preparing" && <div className="pointer-events-none absolute inset-0 grid place-items-center" role="status" aria-label={`กำลังเตรียมรูป ${index + 1}`}><Loader2 className="size-6 animate-spin text-white drop-shadow" aria-hidden /></div>}
    {item.status === "uploading" && <div className="pointer-events-none absolute inset-0 grid place-items-center bg-foreground/50 text-white" role="progressbar" aria-label={`อัปโหลดรูป ${index + 1}`} aria-valuenow={Math.round(item.progress * 100)} aria-valuemin={0} aria-valuemax={100}><div className="relative grid size-14 place-items-center"><svg className="absolute size-full -rotate-90" viewBox="0 0 48 48" aria-hidden><circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="3" opacity="0.25" /><circle cx="24" cy="24" r="20" fill="none" stroke="currentColor" strokeWidth="3" pathLength="100" strokeDasharray={`${item.progress * 100} 100`} /></svg><span className="text-xs">{Math.round(item.progress * 100)}%</span></div></div>}
    {item.status === "failed" && <button type="button" disabled={disabled || !item.file} onClick={onRetry} className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-destructive/90 px-2 pt-4 text-white focus-visible:outline-2 focus-visible:outline-ring" aria-label={`ลองใหม่ รูป ${index + 1}`}><AlertCircle className="size-5" aria-hidden /><span className="text-sm">ลองใหม่</span>{item.error && <span className="text-xs">{item.error}</span>}</button>}
    <Button type="button" variant="secondary" size="icon" disabled={disabled || item.status === "uploading"} onClick={onRemove} aria-label={`ลบรูป ${index + 1}`} className="absolute top-1 right-1 size-9 rounded-full bg-card/90"><X className="size-4" /></Button>
  </div>;
}

/** The lightbox over a photo list (local previews before upload). */
export function PhotoListLightbox({ items, opened, onOpened }: { items: PhotoItem[]; opened: string | null; onOpened: (key: string | null) => void }) {
  const list = viewablePhotos(items);
  const index = list.findIndex((p) => p.key === opened);
  return <PhotoLightbox photos={toLightbox(list)} index={index < 0 ? null : index} onIndexChange={(i) => onOpened(i === null ? null : list[i].key)} />;
}

/** Compact picker (S03 team `รูปหลังทำ`, S08 send back): tiles + "เพิ่มรูป" tile. */
export function PhotoPicker({ value, onChange, disabled, invalid, capture, id = "photoIds", describedBy = "photoIds-error photo-hint" }: { value: PhotoItem[]; onChange: Dispatch<SetStateAction<PhotoItem[]>>; disabled?: boolean; invalid?: boolean; capture?: boolean; id?: string; describedBy?: string }) {
  const input = useRef<HTMLInputElement>(null);
  const photos = usePhotoList(value, onChange, disabled);
  const [opened, setOpened] = useState<string | null>(null);
  return <div>
    <input ref={input} type="file" accept="image/*" capture={capture ? "environment" : undefined} multiple={!capture} className="sr-only" tabIndex={-1} aria-label="เพิ่มรูป" onChange={(e) => { photos.choose(e.target.files); e.target.value = ""; }} disabled={disabled} />
    <div className="grid grid-cols-3 gap-2 lg:max-w-125 lg:grid-cols-5">
      {value.map((item, i) => <PhotoTile key={item.key} item={item} index={i} disabled={disabled} className="aspect-square" onOpen={() => setOpened(item.key)} onRetry={() => photos.retry(item)} onRemove={() => photos.remove(item)} />)}
      {!photos.full && <button id={id} type="button" disabled={disabled} onClick={() => input.current?.click()} data-invalid={invalid} aria-describedby={describedBy} className="flex aspect-square flex-col items-center justify-center gap-1 rounded-sm border-2 border-dashed border-input bg-card text-muted-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 data-[invalid=true]:border-destructive"><Camera className="size-7" aria-hidden /><span className="text-sm">{capture && value.length ? "ถ่ายเพิ่ม" : "เพิ่มรูป"}</span><span className="text-xs">{value.length}/5</span></button>}
    </div>
    {photos.message && <p role="alert" className="mt-2 flex items-center gap-1 text-sm text-destructive"><AlertCircle className="size-4" aria-hidden />{photos.message}</p>}
    <PhotoListLightbox items={value} opened={opened} onOpened={setOpened} />
  </div>;
}
