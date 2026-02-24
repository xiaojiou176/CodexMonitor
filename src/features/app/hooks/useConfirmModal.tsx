import type { ReactNode } from "react";
import { useCallback, useState } from "react";
import { ModalShell } from "../../design-system/components/modal/ModalShell";

type ConfirmState = {
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
} | null;

export function useConfirmModal(): {
  openConfirm: (message: string, onConfirm: () => void, confirmLabel?: string) => void;
  ConfirmModalNode: ReactNode;
} {
  const [state, setState] = useState<ConfirmState>(null);

  const openConfirm = useCallback(
    (message: string, onConfirm: () => void, confirmLabel?: string) => {
      setState({ message, onConfirm, confirmLabel });
    },
    [],
  );

  const handleConfirm = useCallback(() => {
    state?.onConfirm();
    setState(null);
  }, [state]);

  const handleCancel = useCallback(() => {
    setState(null);
  }, []);

  const ConfirmModalNode: ReactNode = state ? (
    <ModalShell
      ariaLabel={state.message}
      onBackdropClick={handleCancel}
    >
      <div className="confirm-modal-content">
        <p className="confirm-modal-message">{state.message}</p>
        <div className="confirm-modal-actions">
          <button type="button" className="confirm-modal-cancel" onClick={handleCancel}>
            取消
          </button>
          <button type="button" className="confirm-modal-confirm" onClick={handleConfirm}>
            {state.confirmLabel ?? "确认"}
          </button>
        </div>
      </div>
    </ModalShell>
  ) : null;

  return { openConfirm, ConfirmModalNode };
}
