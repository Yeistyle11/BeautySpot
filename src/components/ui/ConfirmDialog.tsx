"use client";

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  confirmColor?: "green" | "red" | "blue";
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmText = "Confirmar",
  cancelText = "Cancelar",
  confirmColor = "blue",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const colors = {
    green: "bg-green-600 hover:bg-green-700",
    red: "bg-red-600 hover:bg-red-700",
    blue: "bg-indigo-600 hover:bg-indigo-700",
  };

  return (
    <div className="animate-fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="animate-scale-in mx-4 w-full max-w-md rounded-lg bg-white shadow-2xl">
        <div className="p-6">
          <h3 className="mb-2 text-xl font-bold text-gray-900">{title}</h3>
          <p className="mb-6 text-gray-600">{message}</p>

          <div className="flex justify-end gap-3">
            <button
              onClick={onCancel}
              className="rounded-lg bg-gray-200 px-4 py-2 font-medium text-gray-800 transition-colors hover:bg-gray-300"
            >
              {cancelText}
            </button>
            <button
              onClick={onConfirm}
              className={`px-4 py-2 ${colors[confirmColor]} rounded-lg font-medium text-white transition-colors`}
            >
              {confirmText}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
