'use client';

import type {
  SupplierPartyAssistProduct,
  SupplierPartyAssistTemplate,
  SupplierPartyAssistVehicle,
} from '../api';

type AssistPanelProps = {
  templates: SupplierPartyAssistTemplate[];
  products: SupplierPartyAssistProduct[];
  vehicles: SupplierPartyAssistVehicle[];
  loading?: boolean;
  showTemplates?: boolean;
  showProducts?: boolean;
  showVehicles?: boolean;
  onRepeatLatest?: (template: SupplierPartyAssistTemplate) => void;
  onTemplateSelect: (template: SupplierPartyAssistTemplate) => void;
  onProductSelect: (product: SupplierPartyAssistProduct) => void;
  onVehicleSelect: (vehicle: SupplierPartyAssistVehicle) => void;
};

export default function AssistPanel({
  templates,
  products,
  vehicles,
  loading = false,
  showTemplates = false,
  showProducts = false,
  showVehicles = false,
  onRepeatLatest,
  onTemplateSelect,
  onProductSelect,
  onVehicleSelect,
}: AssistPanelProps) {
  const hasContent =
    (showTemplates && templates.length > 0) ||
    (showProducts && products.length > 0) ||
    (showVehicles && vehicles.length > 0);

  if (!loading && !hasContent) {
    return null;
  }

  return (
    <div className="mx-4 mb-3 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          Smart Suggestions
        </p>
      </div>

      <div className="max-h-72 overflow-y-auto overscroll-contain px-4 py-3 scrollbar-thin scrollbar-track-transparent scrollbar-thumb-slate-300">
        {loading ? (
          <div className="text-sm text-slate-500">Loading recent history...</div>
        ) : null}

        {showTemplates && templates.length > 0 ? (
          <div className="mb-4">
            {onRepeatLatest ? (
              <button
                type="button"
                onClick={() => onRepeatLatest(templates[0])}
                className="mb-3 w-full rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white px-4 py-3 text-left transition-colors hover:border-emerald-300 hover:from-emerald-100"
              >
                <p className="text-sm font-semibold text-emerald-900">
                  Repeat Last Invoice
                </p>
                <p className="mt-1 text-xs text-emerald-700">
                  Loads the latest template from {templates[0].invoiceNumber}
                </p>
              </button>
            ) : null}
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Recent Templates
            </p>
            <div className="space-y-2">
              {templates.map((template) => (
                <button
                  key={template.id}
                  type="button"
                  onClick={() => onTemplateSelect(template)}
                  className="w-full rounded-xl border border-slate-200 px-3 py-3 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50"
                >
                  <p className="text-sm font-semibold text-slate-900">
                    {template.productName || 'Saved template'}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {template.invoiceNumber}
                    {template.vehicleNumber ? ` | ${template.vehicleNumber}` : ''}
                    {template.rate ? ` | Rs ${template.rate}` : ''}
                  </p>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {showProducts && products.length > 0 ? (
          <div className="mb-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Product Suggestions
            </p>
            <div className="flex flex-wrap gap-2">
              {products.map((product) => (
                <button
                  key={`${product.name}-${product.hsnCode}`}
                  type="button"
                  onClick={() => onProductSelect(product)}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-emerald-300 hover:bg-emerald-50"
                >
                  {product.name}
                  <span className="ml-2 text-xs text-slate-400">{product.count}x</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {showVehicles && vehicles.length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Vehicle Suggestions
            </p>
            <div className="space-y-2">
              {vehicles.map((vehicle) => (
                <button
                  key={`${vehicle.vehicleNumber}-${vehicle.ownerName}`}
                  type="button"
                  onClick={() => onVehicleSelect(vehicle)}
                  className="flex w-full items-center justify-between rounded-xl border border-slate-200 px-3 py-2.5 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">
                      {vehicle.vehicleNumber}
                    </p>
                    {vehicle.ownerName ? (
                      <p className="mt-1 text-xs text-slate-500">{vehicle.ownerName}</p>
                    ) : null}
                  </div>
                  <span className="ml-3 shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-medium text-slate-600">
                    {vehicle.count}x
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
