'use client';

import { useState } from 'react';
import { adminApi } from '@/features/admin/api/admin.api';
import { toast } from 'react-toastify';
import { Upload, FileText, X, RefreshCw, AlertCircle } from 'lucide-react';
import { adminButtonClasses } from '@/features/admin/utils/adminUi';

export default function InsuranceUploadModal({
  invoice,
  onClose,
  onSuccess,
}: {
  invoice: any;
  onClose: () => void;
  onSuccess: (updatedInvoice?: any, uploadedFile?: File) => void; // Optional updated invoice and file
}) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  const isReplace = Boolean(invoice.insurance);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf') {
        setFile(droppedFile);
      } else {
        toast.error('Only PDF files are allowed');
      }
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile);
      } else {
        toast.error('Only PDF files are allowed');
        e.target.value = '';
      }
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Please select a PDF file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('File size must be less than 5MB');
      return;
    }

    setLoading(true);

    try {
      // Note: adminApi.uploadInvoiceInsurance returns response.data (already unwrapped from axios)
      const response = await adminApi.uploadInvoiceInsurance(invoice.id, file);
      toast.success('Insurance ' + (isReplace ? 'replaced' : 'uploaded') + ' successfully');
      
      // Pass updated invoice data (handles both ApiResponse-wrapped and direct invoice payloads)
      const updatedInvoice = (response as any)?.data ?? response;
      onSuccess(updatedInvoice, file);
      onClose();
    } catch (err: any) {
      console.error('Upload error:', err);
      toast.error(err.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            {isReplace ? (
              <div className="p-2 bg-[#4309ac]/10 rounded-lg">
                <RefreshCw className="w-5 h-5 text-[#4309ac]" />
              </div>
            ) : (
              <div className="p-2 bg-[#4309ac]/10 rounded-lg">
                <Upload className="w-5 h-5 text-[#4309ac]" />
              </div>
            )}
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {isReplace ? 'Replace Insurance PDF' : 'Upload Insurance PDF'}
              </h3>
              <p className="text-sm text-gray-500">Invoice: {invoice.invoiceNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={loading}
            className={adminButtonClasses.secondary}
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {isReplace && (
            <div className="flex items-start gap-3 p-3 bg-orange-50 border border-orange-200 rounded-lg">
              <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-orange-800">
                <p className="font-medium">This will replace the existing insurance PDF</p>
                <p className="mt-1 text-orange-700">The old file will be permanently removed.</p>
              </div>
            </div>
          )}

          {/* Drag & Drop Area */}
          <div
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
            className={
              'relative border-2 border-dashed rounded-lg p-8 text-center transition-all ' +
              (dragActive
                ? 'border-[#4309ac] bg-[#4309ac]/5'
                : file
                  ? 'border-[#4309ac]/40 bg-[#4309ac]/5'
                  : 'border-gray-300 hover:border-gray-400')
            }
          >
            <input
              id="file-upload"
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
              disabled={loading}
            />

            {file ? (
              <div className="space-y-3">
                <div className="flex items-center justify-center">
                  <div className="p-3 bg-[#4309ac]/10 rounded-full">
                    <FileText className="w-8 h-8 text-[#4309ac]" />
                  </div>
                </div>
                <div>
                  <p className="font-medium text-gray-900">{file.name}</p>
                  <p className="text-sm text-gray-500 mt-1">{formatFileSize(file.size)}</p>
                </div>
                <button
                  onClick={() => setFile(null)}
                  disabled={loading}
                  className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                >
                  Remove file
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-center">
                  <div className="p-3 bg-gray-100 rounded-full">
                    <Upload className="w-8 h-8 text-gray-400" />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="file-upload"
                    className="cursor-pointer text-[#4309ac] hover:text-[#4309ac]/80 font-medium"
                  >
                    Click to upload
                  </label>
                  <span className="text-gray-500"> or drag and drop</span>
                  <p className="text-xs text-gray-500 mt-2">PDF only (max 5MB)</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 bg-gray-50 rounded-b-xl">
          <button
            onClick={onClose}
            disabled={loading}
            className={adminButtonClasses.secondary}
          >
            Cancel
          </button>
          <button
            onClick={handleUpload}
            disabled={loading || !file}
            className={adminButtonClasses.primary + ' px-6 flex items-center gap-2'}
          >
            {loading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent"></div>
                Uploading...
              </>
            ) : (
              <>
                {isReplace ? <RefreshCw className="w-4 h-4" /> : <Upload className="w-4 h-4" />}
                {isReplace ? 'Replace' : 'Upload'}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}