"use client";

import {
  startTransition,
  useActionState,
  useCallback,
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { ImageUp, Minus, Plus, RotateCcw, TriangleAlert } from "lucide-react";
import type { ActionState } from "@/lib/action-state";
import { buttonClass } from "./button";
import { cn } from "./cn";
import { InlineAction } from "./form";

type Action = (prev: ActionState, formData: FormData) => Promise<ActionState>;

const ACCEPT = ["image/jpeg", "image/png", "image/webp", "image/avif"];
const MAX_BYTES = 15 * 1024 * 1024;
const MAX_ZOOM = 5;

interface Crop {
  /** Смещение левого верхнего угла картинки относительно рамки, px. */
  x: number;
  y: number;
  zoom: number;
}

/**
 * Загрузка фото с кадрированием в браузере: выбрать или перетащить файл → подвинуть и приблизить
 * (мышь, колесо, пальцы, клавиатура) → сохранить. На сервер уходит уже обрезанное изображение нужного
 * размера; сервер всё равно проверяет тип по содержимому, перекодирует и удаляет метаданные.
 */
export function ImageCropUpload({
  action,
  fields = {},
  fileField = "file",
  aspect = 1,
  output = { width: 512, height: 512 },
  round = true,
  preview,
  removeAction,
  removeFields,
  removeConfirm = "Удалить фото?",
  hint,
}: {
  action: Action;
  fields?: Record<string, string>;
  fileField?: string;
  /** Ширина / высота рамки. */
  aspect?: number;
  output?: { width: number; height: number };
  round?: boolean;
  /** Текущее фото (или заглушка). */
  preview: ReactNode;
  removeAction?: Action;
  removeFields?: Record<string, string>;
  removeConfirm?: string;
  hint?: ReactNode;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, {});
  const [src, setSrc] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.ok) {
      setSrc(null);
      router.refresh();
    }
  }, [state, router]);
  // Освобождаем память от blob: URL выбранного файла.
  useEffect(() => () => void (src && URL.revokeObjectURL(src)), [src]);

  const pick = (file: File | undefined) => {
    setError(null);
    if (!file) return;
    if (!ACCEPT.includes(file.type)) return setError("Нужна картинка JPEG, PNG, WebP или AVIF");
    if (file.size > MAX_BYTES) return setError("Файл больше 15 МБ");
    setSrc(URL.createObjectURL(file));
  };

  const save = async (canvas: HTMLCanvasElement) => {
    const blob = await toBlob(canvas);
    if (!blob) return setError("Не удалось подготовить изображение");
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, v);
    fd.set(fileField, new File([blob], blob.type === "image/webp" ? "photo.webp" : "photo.jpg", { type: blob.type }));
    startTransition(() => formAction(fd));
  };

  const serverError = state.error ? (state.fieldErrors?.[fileField] ?? state.error) : null;

  if (src) {
    return (
      <Cropper
        src={src}
        aspect={aspect}
        output={output}
        round={round}
        pending={pending}
        error={error ?? serverError}
        onCancel={() => {
          setSrc(null);
          setError(null);
        }}
        onSave={save}
        onError={setError}
      />
    );
  }

  return (
    <div className="grid gap-3">
      <div
        className={cn(
          "flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-4 text-center transition-colors",
          dragOver ? "border-fire bg-fire-soft/60" : "border-transparent",
        )}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          pick(e.dataTransfer.files[0]);
        }}
      >
        {preview}
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT.join(",")}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
          onChange={(e) => {
            pick(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" onClick={() => inputRef.current?.click()} className={buttonClass("secondary", "sm")}>
            <ImageUp className="size-4" aria-hidden /> Загрузить фото
          </button>
          {removeAction && <InlineAction action={removeAction} fields={removeFields ?? fields} label="Удалить" confirm={removeConfirm} />}
        </div>
        <p className="text-xs text-muted">{hint ?? "или перетащите файл сюда · JPEG, PNG, WebP до 15 МБ"}</p>
      </div>
      {(error || serverError) && <ErrorLine text={error ?? serverError!} />}
      {state.ok && state.message && <p className="text-sm text-success">{state.message}</p>}
    </div>
  );
}

function ErrorLine({ text }: { text: string }) {
  return (
    <p role="alert" className="flex items-center gap-2 text-sm text-danger">
      <TriangleAlert className="size-4 shrink-0" aria-hidden /> {text}
    </p>
  );
}

async function toBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  const as = (type: string, q: number) => new Promise<Blob | null>((r) => canvas.toBlob(r, type, q));
  const webp = await as("image/webp", 0.9);
  // Safari до 17 не кодирует WebP и молча отдаёт PNG — тогда шлём JPEG (меньше).
  if (webp && webp.type === "image/webp") return webp;
  return as("image/jpeg", 0.92);
}

function Cropper({
  src,
  aspect,
  output,
  round,
  pending,
  error,
  onCancel,
  onSave,
  onError,
}: {
  src: string;
  aspect: number;
  output: { width: number; height: number };
  round: boolean;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onSave: (canvas: HTMLCanvasElement) => void;
  onError: (msg: string) => void;
}) {
  const frameRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [frame, setFrame] = useState({ w: 0, h: 0 });
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [crop, setCrop] = useState<Crop>({ x: 0, y: 0, zoom: 1 });
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const pinch = useRef<{ dist: number; zoom: number } | null>(null);

  // Размер рамки следует за шириной контейнера (телефон/компьютер).
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.round(entry!.contentRect.width);
      setFrame({ w, h: Math.round(w / aspect) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [aspect]);

  const baseScale = natural && frame.w ? Math.max(frame.w / natural.w, frame.h / natural.h) : 1;

  const clamp = useCallback(
    (c: Crop): Crop => {
      if (!natural) return c;
      const zoom = Math.min(MAX_ZOOM, Math.max(1, c.zoom));
      const s = baseScale * zoom;
      const dw = natural.w * s;
      const dh = natural.h * s;
      return { zoom, x: Math.min(0, Math.max(frame.w - dw, c.x)), y: Math.min(0, Math.max(frame.h - dh, c.y)) };
    },
    [natural, baseScale, frame],
  );

  // Новая картинка или новый размер рамки — центрируем.
  useEffect(() => {
    if (!natural || !frame.w) return;
    const s = baseScale;
    setCrop({ zoom: 1, x: (frame.w - natural.w * s) / 2, y: (frame.h - natural.h * s) / 2 });
  }, [natural, frame, baseScale]);

  /** Приближение относительно точки (по умолчанию — центр рамки). */
  const zoomTo = useCallback(
    (zoom: number, at?: { x: number; y: number }) =>
      setCrop((c) => {
        const p = at ?? { x: frame.w / 2, y: frame.h / 2 };
        const s = baseScale * c.zoom;
        const next = Math.min(MAX_ZOOM, Math.max(1, zoom));
        const s2 = baseScale * next;
        const ix = (p.x - c.x) / s;
        const iy = (p.y - c.y) / s;
        return clamp({ zoom: next, x: p.x - ix * s2, y: p.y - iy * s2 });
      }),
    [baseScale, clamp, frame],
  );

  const local = (e: { clientX: number; clientY: number }) => {
    const r = frameRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const onPointerDown = (e: ReactPointerEvent) => {
    frameRef.current?.setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, local(e));
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { dist: Math.hypot(a!.x - b!.x, a!.y - b!.y), zoom: crop.zoom };
    }
  };
  const onPointerMove = (e: ReactPointerEvent) => {
    const prev = pointers.current.get(e.pointerId);
    if (!prev) return;
    const p = local(e);
    pointers.current.set(e.pointerId, p);
    if (pointers.current.size === 2 && pinch.current) {
      const [a, b] = [...pointers.current.values()];
      const dist = Math.hypot(a!.x - b!.x, a!.y - b!.y);
      zoomTo(pinch.current.zoom * (dist / pinch.current.dist), { x: (a!.x + b!.x) / 2, y: (a!.y + b!.y) / 2 });
    } else if (pointers.current.size === 1) {
      setCrop((c) => clamp({ ...c, x: c.x + (p.x - prev.x), y: c.y + (p.y - prev.y) }));
    }
  };
  const onPointerUp = (e: ReactPointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) pinch.current = null;
  };

  // Колесо мыши — приближение; обработчик не пассивный, чтобы страница не прокручивалась.
  useEffect(() => {
    const el = frameRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomTo(crop.zoom * (e.deltaY < 0 ? 1.1 : 1 / 1.1), { x: e.clientX - r.left, y: e.clientY - r.top });
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [zoomTo, crop.zoom]);

  const onKeyDown = (e: ReactKeyboardEvent) => {
    const step = e.shiftKey ? 40 : 10;
    const moves: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] };
    if (moves[e.key]) {
      e.preventDefault();
      const [dx, dy] = moves[e.key]!;
      setCrop((c) => clamp({ ...c, x: c.x + dx, y: c.y + dy }));
    } else if (e.key === "+" || e.key === "=") {
      e.preventDefault();
      zoomTo(crop.zoom * 1.15);
    } else if (e.key === "-") {
      e.preventDefault();
      zoomTo(crop.zoom / 1.15);
    }
  };

  const save = () => {
    if (!natural || !imgRef.current) return;
    const s = baseScale * crop.zoom;
    const canvas = document.createElement("canvas");
    canvas.width = output.width;
    canvas.height = output.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return onError("Браузер не поддерживает обработку изображений");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, output.width, output.height);
    ctx.drawImage(imgRef.current, -crop.x / s, -crop.y / s, frame.w / s, frame.h / s, 0, 0, output.width, output.height);
    onSave(canvas);
  };

  const s = baseScale * crop.zoom;
  return (
    <div className="grid gap-4">
      <div className="mx-auto w-full max-w-80">
        <div
          ref={frameRef}
          role="application"
          aria-label="Кадрирование фото: перетащите, чтобы подвинуть; колесо, щипок или клавиши плюс и минус — масштаб; стрелки — сдвиг"
          tabIndex={0}
          onKeyDown={onKeyDown}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="relative cursor-grab touch-none overflow-hidden rounded-2xl bg-ink select-none focus-visible:ring-3 focus-visible:ring-water/40 active:cursor-grabbing"
          style={{ height: frame.h || undefined, aspectRatio: frame.h ? undefined : String(aspect) }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt=""
            draggable={false}
            onLoad={(e) => setNatural({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
            onError={() => onError("Не удалось открыть изображение. Попробуйте другой файл (JPEG или PNG).")}
            className="pointer-events-none absolute top-0 left-0 max-w-none origin-top-left"
            style={natural ? { width: natural.w * s, height: natural.h * s, transform: `translate(${crop.x}px, ${crop.y}px)` } : { opacity: 0 }}
          />
          {/* Рамка: для круглого аватара снаружи круга затемнено — видно, что попадёт в кадр */}
          {round && (
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{ background: "radial-gradient(circle closest-side, transparent calc(100% - 1px), rgb(21 19 26 / 0.62) 100%)" }}
            />
          )}
          <div aria-hidden className={cn("pointer-events-none absolute inset-0 border-2 border-white/80", round ? "rounded-full" : "rounded-2xl")} />
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-80 items-center gap-3">
        <button type="button" onClick={() => zoomTo(crop.zoom / 1.2)} className="rounded-lg p-1.5 text-muted hover:bg-paper-2" aria-label="Отдалить">
          <Minus className="size-4" />
        </button>
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={crop.zoom}
          onChange={(e) => zoomTo(Number(e.target.value))}
          className="w-full accent-fire"
          aria-label="Масштаб"
        />
        <button type="button" onClick={() => zoomTo(crop.zoom * 1.2)} className="rounded-lg p-1.5 text-muted hover:bg-paper-2" aria-label="Приблизить">
          <Plus className="size-4" />
        </button>
        <button type="button" onClick={() => zoomTo(1)} className="rounded-lg p-1.5 text-muted hover:bg-paper-2" aria-label="Сбросить масштаб">
          <RotateCcw className="size-4" />
        </button>
      </div>
      <p className="text-center text-xs text-muted">Перетащите фото, чтобы выбрать кадр. Приближение — ползунком, колесом мыши или двумя пальцами.</p>

      {error && <ErrorLine text={error} />}
      <div className="flex flex-wrap justify-center gap-2">
        <button type="button" onClick={save} disabled={!natural || pending} className={buttonClass("primary", "md")}>
          {pending ? "Сохраняем…" : "Сохранить фото"}
        </button>
        <button type="button" onClick={onCancel} disabled={pending} className={buttonClass("ghost", "md")}>
          Отмена
        </button>
      </div>
    </div>
  );
}
