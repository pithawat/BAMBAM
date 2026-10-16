"use client";

/* eslint-disable @next/next/no-img-element -- Authenticated API paths and mock blob URLs require plain images (HANDOFF). */
import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { Photo } from "../types";

export function PhotoLightbox({ photos, index, onIndexChange }: { photos: Photo[]; index: number | null; onIndexChange: (index: number | null) => void }) {
  const start = useRef<number | null>(null);
  const current = index === null ? undefined : photos[index];
  const move = (delta: number) => { if (index !== null && photos.length) onIndexChange((index + delta + photos.length) % photos.length); };
  return <Dialog open={!!current} onOpenChange={(open) => { if (!open) onIndexChange(null); }}>
    <DialogContent showCloseButton={false} className="flex h-dvh w-screen max-w-none flex-col rounded-none border-0 bg-foreground p-4 text-white sm:max-w-none" onKeyDown={(e) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowRight") { e.preventDefault(); move(e.key === "ArrowLeft" ? -1 : 1); }
    }}>
      <DialogTitle className="pr-12 text-base">รูปภาพ <span aria-live="polite">{index === null ? "" : `${index + 1}/${photos.length}`}</span></DialogTitle>
      <DialogDescription className="sr-only">เลื่อนซ้ายหรือขวาเพื่อดูรูป ใช้ปุ่มลูกศรหรือปัดบนรูปภาพ</DialogDescription>
      <DialogClose asChild><Button variant="glass" size="icon" className="absolute top-2 right-2" aria-label="ปิดรูปภาพ"><X /></Button></DialogClose>
      <div className="flex min-h-0 flex-1 items-center justify-center" onTouchStart={(e) => { start.current = e.touches[0].clientX; }} onTouchEnd={(e) => {
        if (start.current !== null) { const delta = e.changedTouches[0].clientX - start.current; if (Math.abs(delta) > 50) move(delta < 0 ? 1 : -1); } start.current = null;
      }}>
        {current && <img src={current.url} alt={`รูปภาพ ${index! + 1} จาก ${photos.length}`} className="max-h-full max-w-full object-contain" />}
      </div>
      {photos.length > 1 && <div className="flex justify-center gap-6 pb-4"><Button variant="glass" size="icon" onClick={() => move(-1)} aria-label="รูปก่อนหน้า"><ChevronLeft /></Button><Button variant="glass" size="icon" onClick={() => move(1)} aria-label="รูปถัดไป"><ChevronRight /></Button></div>}
    </DialogContent>
  </Dialog>;
}

export function PhotoGallery({ photos, label = "รูปภาพ" }: { photos: Photo[]; label?: string }) {
  const [index, setIndex] = useState<number | null>(null);
  if (!photos.length) return null;
  return <><div className="flex flex-wrap gap-2" aria-label={label}>{photos.map((photo, i) => <button key={photo.id} type="button" className="size-22 overflow-hidden rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2" onClick={() => setIndex(i)} aria-label={`${label} ${i + 1} เปิดรูปเต็ม`}><img src={photo.thumbUrl} alt={`${label} ${i + 1}`} className="size-full object-cover" /></button>)}</div><PhotoLightbox photos={photos} index={index} onIndexChange={setIndex} /></>;
}
