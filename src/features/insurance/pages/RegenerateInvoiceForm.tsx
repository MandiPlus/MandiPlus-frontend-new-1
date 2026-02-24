import React, { useState, useEffect } from 'react';
import { regenerateInvoice, getInvoiceById, InsuranceForm } from '../api';

interface Props {
    invoiceId: string;
    onSuccess?: (updatedInvoice: InsuranceForm) => void;
    onCancel?: () => void;
}

export const RegenerateInvoiceForm: React.FC<Props> = ({
    invoiceId,
    onSuccess,
    onCancel
}) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [invoice, setInvoice] = useState<InsuranceForm | null>(null);
    const [invoiceDateInputType, setInvoiceDateInputType] = useState<'text' | 'date'>('text');

    // Form state
    const [formData, setFormData] = useState({
        invoiceDate: '',
        terms: 'Net 30',
        supplierName: '',
        supplierAddress: ['', ''],
        placeOfSupply: '',
        billToName: '',
        billToAddress: ['', ''],
        shipToName: '',
        shipToAddress: ['', ''],
        productName: '',
        hsnCode: '',
        quantity: 0,
        rate: 0,
        amount: 0,
        truckNumber: '',
        vehicleNumber: '',
        weighmentSlipNote: '',
        isClaim: false,
        claimDetails: ''
    });

    // Load existing invoice data
    useEffect(() => {
        const loadInvoice = async () => {
            try {
                setLoading(true);
                const data = await getInvoiceById(invoiceId);
                setInvoice(data);

                // Populate form with existing data
                setFormData({
                    invoiceDate: data.invoiceDate || '',
                    terms: 'Net 30',
                    supplierName: data.supplierName || '',
                    supplierAddress: data.supplierAddress || ['', ''],
                    placeOfSupply: data.placeOfSupply || '',
                    billToName: data.billToName || '',
                    billToAddress: data.billToAddress || ['', ''],
                    shipToName: data.shipToName || '',
                    shipToAddress: data.shipToAddress || ['', ''],
                    productName: Array.isArray(data.productName) ? data.productName[0] : data.productName || '',
                    hsnCode: data.hsnCode || '',
                    quantity: data.quantity || 0,
                    rate: data.rate || 0,
                    amount: data.quantity * data.rate,
                    truckNumber: data.truckNumber || data.vehicleNumber || '',
                    vehicleNumber: data.vehicleNumber || data.truckNumber || '',
                    weighmentSlipNote: data.weighmentSlipNote || '',
                    isClaim: data.isClaim || false,
                    claimDetails: data.claimDetails || ''
                });
                setInvoiceDateInputType(data.invoiceDate ? 'date' : 'text');
            } catch (err: any) {
                setError(err.message || 'Failed to load invoice');
            } finally {
                setLoading(false);
            }
        };

        loadInvoice();
    }, [invoiceId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            console.log('Form Data Submitted:', formData);
            const payload = {
                invoiceId,
                ...formData,
                // Convert single address strings to arrays if needed
                supplierAddress: formData.supplierAddress.filter(addr => addr.trim()),
                billToAddress: formData.billToAddress.filter(addr => addr.trim()),
                shipToAddress: formData.shipToAddress.filter(addr => addr.trim())
            };

            const updatedInvoice = await regenerateInvoice(payload);

            if (onSuccess) {
                onSuccess(updatedInvoice);
            }
        } catch (err: any) {
            const errorMsg = Array.isArray(err.message)
                ? err.message.join(', ')
                : err.message || 'Failed to regenerate invoice';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    const handleInputChange = (field: string, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleAddressChange = (type: 'supplierAddress' | 'billToAddress' | 'shipToAddress', index: number, value: string) => {
        setFormData(prev => ({
            ...prev,
            [type]: prev[type].map((addr, i) => i === index ? value : addr)
        }));
    };

    if (loading && !invoice) {
        return (
            <div className="flex items-center justify-center p-8">
                <div className="text-gray-600">Loading invoice...</div>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto p-6 bg-white rounded-lg shadow">
            <h2 className="text-2xl font-bold mb-6">Update & Regenerate Invoice</h2>

            {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded">
                    <p className="text-red-800">{error}</p>
                </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium mb-1">Invoice Date</label>
                        <input
                            type={invoiceDateInputType}
                            placeholder="DD-MM-YYYY"
                            value={formData.invoiceDate}
                            onFocus={() => setInvoiceDateInputType('date')}
                            onBlur={() => {
                                if (!formData.invoiceDate) setInvoiceDateInputType('text');
                            }}
                            onChange={(e) => handleInputChange('invoiceDate', e.target.value)}
                            className="w-full p-2 border rounded"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium mb-1">Terms</label>
                        <input
                            type="text"
                            value={formData.terms}
                            onChange={(e) => handleInputChange('terms', e.target.value)}
                            className="w-full p-2 border rounded"
                        />
                    </div>
                </div>

                {/* Supplier Info */}
                <div className="space-y-3">
                    <h3 className="font-semibold text-lg">Supplier Details</h3>
                    <input
                        type="text"
                        placeholder="Supplier Name"
                        value={formData.supplierName}
                        onChange={(e) => handleInputChange('supplierName', e.target.value)}
                        className="w-full p-2 border rounded"
                    />
                    {formData.supplierAddress.map((addr, idx) => (
                        <input
                            key={idx}
                            type="text"
                            placeholder={`Address Line ${idx + 1}`}
                            value={addr}
                            onChange={(e) => handleAddressChange('supplierAddress', idx, e.target.value)}
                            className="w-full p-2 border rounded"
                        />
                    ))}
                    <input
                        type="text"
                        placeholder="Place of Supply"
                        value={formData.placeOfSupply}
                        onChange={(e) => handleInputChange('placeOfSupply', e.target.value)}
                        className="w-full p-2 border rounded"
                    />
                </div>

                {/* Bill To */}
                <div className="space-y-3">
                    <h3 className="font-semibold text-lg">Bill To</h3>
                    <input
                        type="text"
                        placeholder="Bill To Name"
                        value={formData.billToName}
                        onChange={(e) => handleInputChange('billToName', e.target.value)}
                        className="w-full p-2 border rounded"
                    />
                    {formData.billToAddress.map((addr, idx) => (
                        <input
                            key={idx}
                            type="text"
                            placeholder={`Address Line ${idx + 1}`}
                            value={addr}
                            onChange={(e) => handleAddressChange('billToAddress', idx, e.target.value)}
                            className="w-full p-2 border rounded"
                        />
                    ))}
                </div>

                {/* Product Details */}
                <div className="space-y-3">
                    <h3 className="font-semibold text-lg">Product Details</h3>
                    <div className="grid grid-cols-2 gap-4">
                        <input
                            type="text"
                            placeholder="Product Name"
                            value={formData.productName}
                            onChange={(e) => handleInputChange('productName', e.target.value)}
                            className="w-full p-2 border rounded"
                        />
                        <input
                            type="text"
                            placeholder="HSN Code"
                            value={formData.hsnCode}
                            onChange={(e) => handleInputChange('hsnCode', e.target.value)}
                            className="w-full p-2 border rounded"
                        />
                        <input
                            type="number"
                            placeholder="Quantity"
                            value={formData.quantity}
                            onChange={(e) => handleInputChange('quantity', parseFloat(e.target.value))}
                            className="w-full p-2 border rounded"
                        />
                        <input
                            type="number"
                            placeholder="Rate"
                            value={formData.rate}
                            onChange={(e) => handleInputChange('rate', parseFloat(e.target.value))}
                            className="w-full p-2 border rounded"
                        />
                        <input
                            type="number"
                            placeholder="Amount"
                            value={formData.amount}
                            onChange={(e) => handleInputChange('amount', parseFloat(e.target.value))}
                            className="w-full p-2 border rounded col-span-2"
                        />
                    </div>
                </div>

                {/* Vehicle Info */}
                <div className="grid grid-cols-2 gap-4">
                    <input
                        type="text"
                        placeholder="Truck Number"
                        value={formData.truckNumber}
                        onChange={(e) => handleInputChange('truckNumber', e.target.value)}
                        className="w-full p-2 border rounded"
                    />
                    <input
                        type="text"
                        placeholder="Vehicle Number"
                        value={formData.vehicleNumber}
                        onChange={(e) => handleInputChange('vehicleNumber', e.target.value)}
                        className="w-full p-2 border rounded"
                    />
                </div>

                {/* Additional Info */}
                <textarea
                    placeholder="Weighment Slip Note"
                    value={formData.weighmentSlipNote}
                    onChange={(e) => handleInputChange('weighmentSlipNote', e.target.value)}
                    className="w-full p-2 border rounded"
                    rows={3}
                />

                {/* Claim Details */}
                <div className="space-y-3">
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={formData.isClaim}
                            onChange={(e) => handleInputChange('isClaim', e.target.checked)}
                            className="w-4 h-4"
                        />
                        <span className="text-sm font-medium">Is Claim?</span>
                    </label>
                    {formData.isClaim && (
                        <textarea
                            placeholder="Claim Details"
                            value={formData.claimDetails}
                            onChange={(e) => handleInputChange('claimDetails', e.target.value)}
                            className="w-full p-2 border rounded"
                            rows={3}
                        />
                    )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-4 justify-end pt-4">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="px-6 py-2 border rounded hover:bg-gray-50"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                        {loading ? 'Regenerating...' : 'Update & Regenerate PDF'}
                    </button>
                </div>
            </form>
        </div>
    );
};
