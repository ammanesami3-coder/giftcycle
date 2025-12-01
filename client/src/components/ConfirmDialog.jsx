import React from "react";

const ConfirmDialog = ({
  open,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-200/60 dark:border-gray-700/60">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {title}
        </h2>

        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
            {description}
          </p>
        )}

        <div className="flex justify-end gap-3 mt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                       text-sm text-gray-700 dark:text-gray-200
                       hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            {cancelLabel}
          </button>

          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700
                       text-sm font-medium text-white shadow-sm transition"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
