"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import type { ActionState } from "@/lib/action-state";
import { buttonClass } from "./button";
import { cn } from "./cn";

interface FormCtx {
  state: ActionState;
  pending: boolean;
}
const FormContext = createContext<FormCtx>({ state: {}, pending: false });

export function useFormCtx() {
  return useContext(FormContext);
}

/**
 * Форма поверх server action. Отправка через onSubmit + startTransition:
 * React не сбрасывает поля при ошибке валидации, а ошибки полей доступны через контекст.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess = false,
  refreshOnSuccess = false,
  confirmMessage,
  ...rest
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  refreshOnSuccess?: boolean;
  confirmMessage?: string;
} & Omit<ComponentProps<"form">, "action" | "onSubmit" | "children">) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (state.ok && resetOnSuccess) ref.current?.reset();
    if (state.ok && refreshOnSuccess) router.refresh();
  }, [state, resetOnSuccess, refreshOnSuccess, router]);

  return (
    <FormContext value={{ state, pending }}>
      <form
        ref={ref}
        className={className}
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          if (confirmMessage && !window.confirm(confirmMessage)) return;
          const fd = new FormData(e.currentTarget);
          const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
          if (submitter?.name) fd.set(submitter.name, submitter.value);
          startTransition(() => formAction(fd));
        }}
        {...rest}
      >
        {children}
      </form>
    </FormContext>
  );
}

export function FormMessage({ className }: { className?: string }) {
  const { state } = useFormCtx();
  if (state.error) {
    return (
      <div role="alert" className={cn("flex items-start gap-2 rounded-xl bg-[#fdecea] px-4 py-3 text-sm text-danger", className)}>
        <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{state.error}</span>
      </div>
    );
  }
  if (state.ok && state.message) {
    return (
      <div role="status" className={cn("flex items-start gap-2 rounded-xl bg-[#e7f5ec] px-4 py-3 text-sm text-success", className)}>
        <CircleCheck className="mt-0.5 size-4 shrink-0" aria-hidden />
        <span>{state.message}</span>
      </div>
    );
  }
  return null;
}

export function SubmitButton({
  children,
  pendingText = "Сохраняем…",
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & {
  pendingText?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "light";
  size?: "sm" | "md" | "lg";
}) {
  const { pending } = useFormCtx();
  return (
    <button type="submit" disabled={pending} aria-busy={pending} className={buttonClass(variant, size, className)} {...props}>
      {pending ? pendingText : children}
    </button>
  );
}

const inputBase =
  "w-full rounded-xl border border-line bg-white px-3.5 py-2.5 text-[0.95rem] text-ink placeholder:text-muted/70 transition-colors focus:border-water focus:outline-none focus:ring-3 focus:ring-water/20 disabled:bg-paper-2 aria-[invalid=true]:border-danger";

export function Field({
  label,
  name,
  hint,
  required,
  children,
  className,
}: {
  label: ReactNode;
  name: string;
  hint?: ReactNode;
  required?: boolean;
  children: ReactNode;
  className?: string;
}) {
  const { state } = useFormCtx();
  const error = state.fieldErrors?.[name];
  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      <label htmlFor={`f-${name}`} className="text-sm font-medium text-ink">
        {label}
        {required && <span className="text-fire"> *</span>}
      </label>
      {children}
      {error ? (
        <p id={`f-${name}-error`} className="text-sm text-danger">
          {error}
        </p>
      ) : hint ? (
        <p id={`f-${name}-hint`} className="text-xs text-muted">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

function useInvalid(name?: string) {
  const { state } = useFormCtx();
  return name ? Boolean(state.fieldErrors?.[name]) : false;
}

export function Input({ className, name, ...props }: ComponentProps<"input">) {
  const invalid = useInvalid(name);
  return (
    <input
      id={name ? `f-${name}` : undefined}
      name={name}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid && name ? `f-${name}-error` : undefined}
      className={cn(inputBase, className)}
      {...props}
    />
  );
}

export function Textarea({ className, name, rows = 4, ...props }: ComponentProps<"textarea">) {
  const invalid = useInvalid(name);
  return (
    <textarea
      id={name ? `f-${name}` : undefined}
      name={name}
      rows={rows}
      aria-invalid={invalid || undefined}
      aria-describedby={invalid && name ? `f-${name}-error` : undefined}
      className={cn(inputBase, "min-h-24 resize-y leading-relaxed", className)}
      {...props}
    />
  );
}

export function Select({ className, name, children, ...props }: ComponentProps<"select">) {
  const invalid = useInvalid(name);
  return (
    <select
      id={name ? `f-${name}` : undefined}
      name={name}
      aria-invalid={invalid || undefined}
      className={cn(inputBase, "appearance-auto pr-8", className)}
      {...props}
    >
      {children}
    </select>
  );
}

export function Checkbox({ label, name, className, ...props }: ComponentProps<"input"> & { label: ReactNode }) {
  const invalid = useInvalid(name);
  return (
    <div className={className}>
      <label className="flex cursor-pointer items-start gap-3 text-sm leading-snug">
        <input
          type="checkbox"
          name={name}
          aria-invalid={invalid || undefined}
          className="mt-0.5 size-5 shrink-0 cursor-pointer rounded border-line accent-fire"
          {...props}
        />
        <span>{label}</span>
      </label>
      {invalid && name && <FieldError name={name} />}
    </div>
  );
}

export function FieldError({ name }: { name: string }) {
  const { state } = useFormCtx();
  const error = state.fieldErrors?.[name];
  return error ? <p className="mt-1 text-sm text-danger">{error}</p> : null;
}

/** Показывает data из ответа (например, одноразовые коды) — рендер-функция. */
export function ActionData({ children }: { children: (data: Record<string, unknown>) => ReactNode }) {
  const { state } = useFormCtx();
  return state.data ? <>{children(state.data)}</> : null;
}

/** Маленькая форма-кнопка (удалить, опубликовать…) с подтверждением. */
export function InlineAction({
  action,
  fields,
  label,
  confirm,
  variant = "ghost",
  className,
  refresh = true,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  fields: Record<string, string>;
  label: ReactNode;
  confirm?: string;
  variant?: "primary" | "secondary" | "danger" | "ghost" | "light";
  className?: string;
  refresh?: boolean;
}) {
  return (
    <ActionForm action={action} confirmMessage={confirm} refreshOnSuccess={refresh} className="inline-flex flex-col items-start gap-1">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <SubmitButton variant={variant} size="sm" pendingText="…" className={className}>
        {label}
      </SubmitButton>
      <InlineError />
    </ActionForm>
  );
}

function InlineError() {
  const { state } = useFormCtx();
  return state.error ? <span className="text-xs text-danger">{state.error}</span> : null;
}
