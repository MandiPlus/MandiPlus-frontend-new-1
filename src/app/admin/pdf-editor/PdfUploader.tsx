"use client";

type Props = {
  onUpload: (file: File) => void;
};

export default function PdfUploader({ onUpload }: Props) {
  return (
    <div className="flex justify-center w-full">
      <label
        className="flex flex-col items-center justify-center w-full max-w-2xl h-64
                   border-2 border-dashed border-slate-300
                   rounded-xl cursor-pointer
                   bg-slate-50 hover:bg-slate-100 hover:border-slate-400 transition-colors"
      >
        <div className="flex flex-col items-center justify-center pt-5 pb-6">
          <div className="w-12 h-12 mb-4 text-slate-400 bg-white shadow-sm border border-slate-200 rounded-full flex items-center justify-center">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path>
            </svg>
          </div>
          <p className="mb-2 text-lg font-medium text-slate-700">
            <span className="font-semibold text-blue-600">Click to upload</span> or drag and drop
          </p>
          <p className="text-sm text-slate-500">
            PDF documents only (Insurance policies)
          </p>
        </div>
        <input
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.[0]) {
              onUpload(e.target.files[0]);
            }
          }}
        />
      </label>
    </div>
  );
}
