import type { MouseEventHandler, ReactNode } from "react";
import { useEffect, useRef } from "react";
import { joinClassNames } from "../classNames";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex]:not([tabindex="-1"])';

type ModalShellProps = {
  children: ReactNode;
  className?: string;
  cardClassName?: string;
  onBackdropClick?: MouseEventHandler<HTMLElement>;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
};

export function ModalShell({
  children,
  className,
  cardClassName,
  onBackdropClick,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
}: ModalShellProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const card = cardRef.current;
    if (!card) {
      return;
    }

    const getFocusable = () =>
      Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => !el.closest("[hidden]") && el.offsetParent !== null,
      );

    const focusable = getFocusable();
    const previouslyFocused = document.activeElement as HTMLElement | null;
    focusable[0]?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        onBackdropClick?.({} as Parameters<MouseEventHandler<HTMLElement>>[0]);
        return;
      }
      if (e.key === "Tab") {
        const current = getFocusable();
        if (current.length === 0) {
          return;
        }
        const first = current[0];
        const last = current[current.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      previouslyFocused?.focus?.();
    };
  }, [onBackdropClick]);

  return (
    <div
      className={joinClassNames("ds-modal", className)}
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      aria-labelledby={ariaLabelledBy}
      aria-describedby={ariaDescribedBy}
    >
      <button
        type="button"
        className="ds-modal-backdrop"
        onClick={onBackdropClick}
        aria-label="关闭弹窗"
        tabIndex={-1}
      />
      <div ref={cardRef} className={joinClassNames("ds-modal-card", cardClassName)}>
        {children}
      </div>
    </div>
  );
}
