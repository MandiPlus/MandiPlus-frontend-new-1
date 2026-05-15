'use client';

import { useRef, useState } from 'react';
import {
  deletePipelineDocument,
  getPipelineDocumentUrl,
  PipelineDocument,
  uploadPipelineDocument,
} from '@/features/admin/api/pipeline.api';
import { formatDate } from '@/features/admin/utils/format';

export default function DocumentUploader({
  shipmentId,
  stageNumber,
  documents,
  onChange,
}: {
  shipmentId: string;
  stageNumber: number;
  documents: PipelineDocument[];
  onChange: () => Promise<void>;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleUpload = async (file?: File | null) => {
    if (!file) return;
    setBusy(true);
    try {
      await uploadPipelineDocument(shipmentId, stageNumber, file);
      await onChange();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (docId: string) => {
    setBusy(true);
    try {
      await deletePipelineDocument(docId);
      await onChange();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragActive(true);
        }}
        onDragLeave={() => setDragActive(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragActive(false);
          void handleUpload(event.dataTransfer.files?.[0]);
        }}
        onClick={() => inputRef.current?.click()}
        className={`cursor-pointer rounded-2xl border border-dashed px-4 py-6 text-center transition ${
          dragActive
            ? 'border-slate-900 bg-slate-50'
            : 'border-slate-300 bg-slate-50/60 hover:border-slate-400'
        }`}
      >
        <p className="text-sm font-semibold text-slate-800">
          Drag and drop a file here
        </p>
        <p className="mt-1 text-xs text-slate-500">
          or click to browse and upload a stage document
        </p>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(event) => void handleUpload(event.target.files?.[0])}
        />
      </div>

      <div className="mt-4 space-y-3">
        {documents.length === 0 ? (
          <div className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            No documents uploaded yet.
          </div>
        ) : (
          documents.map((document) => (
            <div
              key={document.id}
              className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <a
                  href={getPipelineDocumentUrl(document.fileUrl)}
                  target="_blank"
                  rel="noreferrer"
                  className="truncate text-sm font-semibold text-slate-900 hover:underline"
                >
                  {document.fileName}
                </a>
                <p className="mt-1 text-xs text-slate-500">
                  {document.uploadedBy || 'Admin'} • {formatDate(document.uploadedAt)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void handleDelete(document.id)}
                disabled={busy}
                className="rounded-xl border border-rose-200 px-3 py-2 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-60"
              >
                Delete
              </button>
            </div>
          ))
        )}
      </div>

      {busy ? (
        <p className="mt-3 text-xs text-slate-500">Updating documents...</p>
      ) : null}
    </div>
  );
}
