'use client';

import { useEffect, useState } from 'react';

export default function NotesEditor({
  initialValue,
  onSave,
  disabled = false,
}: {
  initialValue?: string | null;
  onSave: (value: string) => Promise<void>;
  disabled?: boolean;
}) {
  const [value, setValue] = useState(initialValue || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setValue(initialValue || '');
  }, [initialValue]);

  const dirty = value !== (initialValue || '');

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(value);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-4">
      <label className="mb-2 block text-sm font-semibold text-slate-800">
        Internal notes
      </label>
      <textarea
        rows={4}
        value={value}
        disabled={disabled || saving}
        onChange={(event) => setValue(event.target.value)}
        className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-slate-900"
        placeholder="Add internal notes for this stage"
      />
      {dirty ? (
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={disabled || saving}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95 disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save notes'}
          </button>
        </div>
      ) : null}
    </div>
  );
}
