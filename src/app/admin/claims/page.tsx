'use client';

import React, { useEffect, useState } from 'react';
import { adminApi, ClaimRequest, ClaimStatus, UpdateClaimStatusDto } from '@/features/admin/api/admin.api'; // Adjust path if needed
import {
    FunnelIcon,
    MagnifyingGlassIcon,
    PlusIcon,
    EyeIcon,
    PencilSquareIcon,
    XMarkIcon,
    CheckIcon,
    DocumentIcon,
    PhotoIcon,
    CloudArrowUpIcon,
    ArrowPathIcon
} from '@heroicons/react/24/outline';
import { adminButtonClasses, adminChipClasses } from '@/features/admin/utils/adminUi';

export default function ClaimsPage() {
    const [claims, setClaims] = useState<ClaimRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        status: '' as ClaimStatus | '',
        truckNumber: '',
    });

    // Modal States
    const [showUpdateModal, setShowUpdateModal] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showDetailModal, setShowDetailModal] = useState(false);
    const [showDamageModal, setShowDamageModal] = useState(false);
    const [selectedClaim, setSelectedClaim] = useState<ClaimRequest | null>(null);
    const [uploadingMedia, setUploadingMedia] = useState<string | null>(null); // mediaType being uploaded
    const [removingMedia, setRemovingMedia] = useState<string | null>(null); // mediaType being removed

    // Form States
    const [updateForm, setUpdateForm] = useState<UpdateClaimStatusDto>({
        status: ClaimStatus.PENDING,
        surveyorName: '',
        surveyorContact: '',
        notes: '',
    });
    const [newClaimTruck, setNewClaimTruck] = useState('');

    // Fetch Claims
    const fetchClaims = async () => {
        setLoading(true);
        try {
            const response = await adminApi.getClaims({
                status: filters.status || undefined,
                truckNumber: filters.truckNumber || undefined,
            });
            if (response.success && response.data) {
                // Ensure we have an array
                const claimsArray = Array.isArray(response.data) ? response.data : [];
                setClaims(claimsArray);
            } else {
                console.error("Failed to fetch claims:", response.message || "Unknown error");
                setClaims([]);
            }
        } catch (error) {
            console.error("Failed to fetch claims", error);
            setClaims([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchClaims();
    }, [filters]);

    // Handlers
    const handleStatusUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClaim) return;

        try {
            const response = await adminApi.updateClaimStatus(selectedClaim.id, updateForm);
            if (!response.success) {
                throw new Error(response.message || 'Failed to update status');
            }
            alert(response.message || 'Status updated successfully');
            setShowUpdateModal(false);
            fetchClaims();
        } catch (error) {
            alert('Failed to update status');
        }
    };

    const handleCreateClaim = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const response = await adminApi.createClaimForUser(newClaimTruck.trim());
            if (!response.success) {
                throw new Error(response.message || 'Failed to create claim');
            }
            alert(response.message || 'Claim created successfully');
            setShowCreateModal(false);
            setNewClaimTruck('');
            fetchClaims();
        } catch (error) {
            alert('Failed to create claim. Ensure invoice exists for this truck.');
        }
    };

    const openUpdateModal = (claim: ClaimRequest) => {
        setSelectedClaim(claim);
        setUpdateForm({
            status: claim.status,
            surveyorName: claim.surveyorName || '',
            surveyorContact: claim.surveyorContact || '',
            notes: claim.notes || '',
        });
        setShowUpdateModal(true);
    };

    const openDetailModal = (claim: ClaimRequest) => {
        setSelectedClaim(claim);
        setShowDetailModal(true);
    };

    const handleMediaUpload = async (claimId: string, mediaType: 'fir' | 'accidentPic' | 'inspectionReport' | 'lorryReceipt' | 'insurancePolicy', file: File) => {
        // Validate inspectionReport is PDF only
        if (mediaType === 'inspectionReport' && !file.type.includes('pdf')) {
            alert('Inspection report must be a PDF file');
            return;
        }
        if (mediaType === 'accidentPic' && file.type.toLowerCase().startsWith('video/')) {
            alert('Video files are not allowed for accident picture');
            return;
        }
        setUploadingMedia(mediaType);
        try {
            const response = await adminApi.uploadClaimMedia(claimId, mediaType, file);
            if (response.success) {
                alert('Media uploaded successfully');
                fetchClaims();
                // Refresh selected claim if detail modal is open
                if (selectedClaim && selectedClaim.id === claimId) {
                    const updatedResponse = await adminApi.getClaimById(claimId);
                    if (updatedResponse.success && updatedResponse.data) {
                        setSelectedClaim(updatedResponse.data);
                    }
                }
            } else {
                alert(response.message || 'Failed to upload media');
            }
        } catch (error) {
            alert('Failed to upload media');
        } finally {
            setUploadingMedia(null);
        }
    };

    const handleMediaRemove = async (claimId: string, mediaType: 'fir' | 'accidentPic' | 'inspectionReport' | 'lorryReceipt' | 'insurancePolicy') => {
        setRemovingMedia(mediaType);
        try {
            const response = await adminApi.removeClaimMedia(claimId, mediaType);
            if (!response.success) {
                alert(response.message || 'Failed to remove media');
                return;
            }

            alert('Media removed successfully');
            fetchClaims();
            if (selectedClaim && selectedClaim.id === claimId) {
                const updatedResponse = await adminApi.getClaimById(claimId);
                if (updatedResponse.success && updatedResponse.data) {
                    setSelectedClaim(updatedResponse.data);
                }
            }
        } catch (error) {
            alert('Failed to remove media');
        } finally {
            setRemovingMedia(null);
        }
    };

    const openDamageFormModal = (claim: ClaimRequest) => {
        setSelectedClaim(claim);
        setShowDamageModal(true);
    };

    // Helper for Status Badge Color (matches new status enum)
    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed':
            case 'approved':
            case 'settled':
                return adminChipClasses.success;
            case 'rejected':
                return adminChipClasses.info;
            case 'inprogress':
                return adminChipClasses.pending;
            case 'surveyor_assigned':
                return 'border-[#4309ac]/20 bg-[#4309ac]/10 text-[#4309ac]';
            case 'pending':
            default:
                return adminChipClasses.pending;
        }
    };

    return (
        <div className="px-4 sm:px-6 lg:px-8 py-8">

            {/* Header */}
            <div className="sm:flex sm:items-center">
                <div className="sm:flex-auto">
                    <h1 className="text-2xl font-semibold text-gray-900">Claim Requests</h1>
                    <p className="mt-2 text-sm text-gray-700">
                        Manage all insurance claims, assign surveyors, and update status.
                    </p>
                </div>
                <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className={adminButtonClasses.primary + ' inline-flex items-center justify-center px-4 py-2 sm:w-auto'}
                    >
                        <PlusIcon className="-ml-1 mr-2 h-5 w-5" />
                        New Claim
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="mt-8 flex gap-4 flex-wrap bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                <div className="relative flex-1 min-w-[200px]">
                    <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                        <MagnifyingGlassIcon className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        className="block text-black w-full rounded-md border-gray-300 pl-10 focus:border-[#4309ac] focus:ring-[#4309ac] sm:text-sm py-2 border"
                        placeholder="Search by Truck Number..."
                        value={filters.truckNumber}
                        onChange={(e) => setFilters({ ...filters, truckNumber: e.target.value })}
                    />
                </div>
                <div className="w-48">
                    <select
                        className="block text-black w-full rounded-md border-gray-300 border py-2 px-3 focus:border-[#4309ac] focus:ring-[#4309ac] sm:text-sm"
                        value={filters.status}
                        onChange={(e) => setFilters({ ...filters, status: e.target.value as any })}
                    >
                        <option value="">All Statuses</option>
                        {Object.values(ClaimStatus).map((status) => (
                            <option key={status} value={status}>{status.replace('_', ' ')}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="mt-8 flex flex-col">
                <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
                    <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
                        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
                            <table className="min-w-full divide-y divide-gray-300">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Request ID</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Truck / Invoice</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Surveyor</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Date</th>
                                        <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">Status</th>
                                        <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                                            <span className="sr-only">Actions</span>
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 bg-white">
                                    {loading ? (
                                        <tr><td colSpan={6} className="text-center py-10">Loading claims...</td></tr>
                                    ) : claims.length === 0 ? (
                                        <tr><td colSpan={6} className="text-center py-10 text-gray-500">No claims found</td></tr>
                                    ) : (
                                        claims.map((claim) => (
                                            <tr key={claim.id}>
                                                <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                                                    {claim.id.slice(0, 8)}...
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    <div className="font-medium text-gray-900">{claim.invoice?.vehicleNumber || 'N/A'}</div>
                                                    <div className="text-xs text-gray-400">{claim.invoice?.invoiceNumber}</div>
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    {claim.surveyorName ? (
                                                        <div>
                                                            <div>{claim.surveyorName}</div>
                                                            <div className="text-xs">{claim.surveyorContact}</div>
                                                        </div>
                                                    ) : <span className="text-gray-400 italic">Not Assigned</span>}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                                                    {new Date(claim.createdAt).toLocaleDateString()}
                                                </td>
                                                <td className="whitespace-nowrap px-3 py-4 text-sm">
                                                    <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${getStatusColor(claim.status)}`}>
                                                        {claim.status.replace('_', ' ')}
                                                    </span>
                                                </td>
                                                <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => openDetailModal(claim)}
                                                            className="text-blue-600 hover:text-blue-900"
                                                            title="View Details & Manage Media"
                                                        >
                                                            <EyeIcon className="w-5 h-5" />
                                                        </button>
                                                        <button
                                                            onClick={() => openUpdateModal(claim)}
                                                            className="text-green-600 hover:text-green-900"
                                                            title="Update Status"
                                                        >
                                                            <PencilSquareIcon className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>

            {/* --- UPDATE STATUS MODAL --- */}
            {showUpdateModal && selectedClaim && (
                <div className="relative z-50" aria-labelledby="modal-title" role="dialog" aria-modal="true">
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
                    <div className="fixed inset-0 z-10 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
                            <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg">
                                <form onSubmit={handleStatusUpdate}>
                                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                        <div className="flex justify-between items-start">
                                            <h3 className="text-lg font-medium leading-6 text-gray-900" id="modal-title">Update Claim Status</h3>
                                            <button type="button" onClick={() => setShowUpdateModal(false)}>
                                                <XMarkIcon className="w-6 h-6 text-gray-400" />
                                            </button>
                                        </div>
                                        <div className="mt-4 space-y-4">
                                            {/* Status Select */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Status</label>
                                                <select
                                                    className="mt-1 block w-full rounded-md border-gray-300 border py-2 px-3 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                                                    value={updateForm.status}
                                                    onChange={(e) => setUpdateForm({ ...updateForm, status: e.target.value as ClaimStatus })}
                                                >
                                                    {Object.values(ClaimStatus).map(s => (
                                                        <option key={s} value={s}>{s.replace('_', ' ')}</option>
                                                    ))}
                                                </select>
                                            </div>

                                            {/* Surveyor Fields - Show only if needed or always visible */}
                                            <div className="grid grid-cols-2 gap-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Surveyor Name</label>
                                                    <input
                                                        type="text"
                                                        className="mt-1 block w-full rounded-md border-gray-300 border py-2 px-3 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                                                        value={updateForm.surveyorName}
                                                        onChange={(e) => setUpdateForm({ ...updateForm, surveyorName: e.target.value })}
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-700">Contact</label>
                                                    <input
                                                        type="text"
                                                        className="mt-1 block w-full rounded-md border-gray-300 border py-2 px-3 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                                                        value={updateForm.surveyorContact}
                                                        onChange={(e) => setUpdateForm({ ...updateForm, surveyorContact: e.target.value })}
                                                    />
                                                </div>
                                            </div>

                                            {/* Notes */}
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700">Admin Notes</label>
                                                <textarea
                                                    rows={3}
                                                    className="mt-1 block w-full rounded-md border-gray-300 border py-2 px-3 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                                                    value={updateForm.notes}
                                                    onChange={(e) => setUpdateForm({ ...updateForm, notes: e.target.value })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                                        <button type="submit" className="inline-flex w-full justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-green-700 sm:ml-3 sm:w-auto sm:text-sm">
                                            Update
                                        </button>
                                        <button type="button" onClick={() => setShowUpdateModal(false)} className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- DETAIL MODAL (Media Management) --- */}
            {showDetailModal && selectedClaim && (
                <div className="relative z-50" aria-labelledby="detail-modal-title" role="dialog" aria-modal="true">
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
                    <div className="fixed inset-0 z-10 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
                            <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-3xl max-h-[90vh] overflow-y-auto">
                                <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <h3 className="text-lg font-medium leading-6 text-gray-900" id="detail-modal-title">
                                            Claim Details & Media Management
                                        </h3>
                                        <button type="button" onClick={() => setShowDetailModal(false)}>
                                            <XMarkIcon className="w-6 h-6 text-gray-400" />
                                        </button>
                                    </div>

                                    {/* Claim Info */}
                                    <div className="mb-6 rounded-lg border border-slate-200 bg-slate-50 p-4">
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                <span className="font-medium text-slate-600">Claim ID:</span>
                                                <span className="ml-2 font-semibold text-slate-900">{selectedClaim.id.slice(0, 8)}...</span>
                                            </div>
                                            <div>
                                                <span className="font-medium text-slate-600">Status:</span>
                                                <span className={`ml-2 inline-flex rounded-full border px-2 py-0.5 text-xs font-semibold ${getStatusColor(selectedClaim.status)}`}>
                                                    {selectedClaim.status.replace('_', ' ')}
                                                </span>
                                            </div>
                                            <div>
                                                <span className="font-medium text-slate-600">Truck:</span>
                                                <span className="ml-2 font-semibold text-slate-900">{selectedClaim.invoice?.vehicleNumber || 'N/A'}</span>
                                            </div>
                                            <div>
                                                <span className="font-medium text-slate-600">Invoice:</span>
                                                <span className="ml-2 font-semibold text-slate-900">{selectedClaim.invoice?.invoiceNumber || 'N/A'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Media Upload Sections */}
                                    <div className="space-y-4">
                                        <h4 className="font-semibold text-gray-900">Documents & Media</h4>
                                        
                                        {/* 1. Accident Picture */}
                                        <MediaUploadSection
                                            label="Accident Picture (with GPS Tag)"
                                            mediaType="accidentPic"
                                            existingUrl={selectedClaim.accidentPic}
                                            claimId={selectedClaim.id}
                                            onUpload={handleMediaUpload}
                                            onRemove={handleMediaRemove}
                                            uploading={uploadingMedia === 'accidentPic'}
                                            removing={removingMedia === 'accidentPic'}
                                            accept="*/*"
                                        />

                                        {/* 2. Damage Certificate */}
                                        <div className="border border-gray-200 rounded-lg p-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-medium text-gray-700">Damage Certificate</span>
                                                    {selectedClaim.damageFormUrl ? (
                                                        <CheckIcon className="w-5 h-5 text-green-600" />
                                                    ) : null}
                                                </div>
                                                <div className="flex gap-2">
                                                    {selectedClaim.damageFormUrl ? (
                                                        <>
                                                            <a
                                                                href={selectedClaim.damageFormUrl}
                                                                target="_blank"
                                                                className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                                                            >
                                                                <DocumentIcon className="w-4 h-4" />
                                                                View PDF
                                                            </a>
                                                            <button
                                                                onClick={() => openDamageFormModal(selectedClaim)}
                                                                className="text-green-600 hover:text-green-800 text-sm flex items-center gap-1"
                                                            >
                                                                <PencilSquareIcon className="w-4 h-4" />
                                                                Update
                                                            </button>
                                                        </>
                                                    ) : (
                                                        <button
                                                            onClick={() => openDamageFormModal(selectedClaim)}
                                                            className="text-green-600 hover:text-green-800 text-sm flex items-center gap-1 px-3 py-1 border border-green-600 rounded"
                                                        >
                                                            <PlusIcon className="w-4 h-4" />
                                                            Create Damage Form
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* 3. FIR Document */}
                                        <MediaUploadSection
                                            label="FIR Copy"
                                            mediaType="fir"
                                            existingUrl={selectedClaim.fir}
                                            claimId={selectedClaim.id}
                                            onUpload={handleMediaUpload}
                                            onRemove={handleMediaRemove}
                                            uploading={uploadingMedia === 'fir'}
                                            removing={removingMedia === 'fir'}
                                            accept=".pdf,.doc,.docx"
                                        />

                                        {/* 4. Insurance Policy */}
                                        <MediaUploadSection
                                            label="Insurance Copy"
                                            mediaType="insurancePolicy"
                                            existingUrl={selectedClaim.insurancePolicy}
                                            claimId={selectedClaim.id}
                                            onUpload={handleMediaUpload}
                                            onRemove={handleMediaRemove}
                                            uploading={uploadingMedia === 'insurancePolicy'}
                                            removing={removingMedia === 'insurancePolicy'}
                                            accept=".pdf,.jpg,.jpeg,.png"
                                        />

                                        {/* 5. Lorry Receipt */}
                                        <MediaUploadSection
                                            label="Transport Lorry Receipt"
                                            mediaType="lorryReceipt"
                                            existingUrl={selectedClaim.lorryReceipt}
                                            claimId={selectedClaim.id}
                                            onUpload={handleMediaUpload}
                                            onRemove={handleMediaRemove}
                                            uploading={uploadingMedia === 'lorryReceipt'}
                                            removing={removingMedia === 'lorryReceipt'}
                                            accept=".pdf,.jpg,.jpeg,.png"
                                        />

                                        {/* 6. Inspection Report (Admin Only, PDF Only) */}
                                        <MediaUploadSection
                                            label="Joint Inspection Report (From Surveyor)" 
                                            mediaType="inspectionReport"
                                            existingUrl={selectedClaim.inspectionReport}
                                            claimId={selectedClaim.id}
                                            onUpload={handleMediaUpload}
                                            onRemove={handleMediaRemove}
                                            uploading={uploadingMedia === 'inspectionReport'}
                                            removing={removingMedia === 'inspectionReport'}
                                            accept=".pdf"
                                        />
                                    </div>
                                </div>
                                <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                                    <button
                                        type="button"
                                        onClick={() => setShowDetailModal(false)}
                                        className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                    >
                                        Close
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- DAMAGE FORM MODAL --- */}
            {showDamageModal && selectedClaim && (
                <DamageFormModal
                    claim={selectedClaim}
                    onClose={() => {
                        setShowDamageModal(false);
                        setSelectedClaim(null);
                    }}
                    onSuccess={() => {
                        setShowDamageModal(false);
                        fetchClaims();
                        if (showDetailModal) {
                            // Refresh claim details
                            adminApi.getClaimById(selectedClaim.id).then(response => {
                                if (response.success && response.data) {
                                    setSelectedClaim(response.data);
                                }
                            });
                        }
                    }}
                />
            )}

            {/* --- CREATE CLAIM MODAL --- */}
            {showCreateModal && (
                <div className="relative z-50">
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
                    <div className="fixed inset-0 z-10 overflow-y-auto">
                        <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
                            <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-sm">
                                <form onSubmit={handleCreateClaim}>
                                    <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                        <h3 className="text-lg font-medium leading-6 text-gray-900 mb-4">Create New Claim</h3>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Truck Number</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="e.g. MH12AB1234"
                                                className="mt-1 block w-full rounded-md border-gray-300 border py-2 px-3 shadow-sm focus:border-green-500 focus:ring-green-500 sm:text-sm"
                                                value={newClaimTruck}
                                                onChange={(e) => setNewClaimTruck(e.target.value)}
                                            />
                                            <p className="mt-2 text-xs text-gray-500">Will link to the latest invoice for this truck.</p>
                                        </div>
                                    </div>
                                    <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                                        <button type="submit" className="inline-flex w-full justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-green-700 sm:ml-3 sm:w-auto sm:text-sm">
                                            Create
                                        </button>
                                        <button type="button" onClick={() => setShowCreateModal(false)} className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm">
                                            Cancel
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}

// Media Upload Section Component
function MediaUploadSection({
    label,
    mediaType,
    existingUrl,
    claimId,
    onUpload,
    onRemove,
    uploading,
    removing,
    accept
}: {
    label: string;
    mediaType: 'fir' | 'accidentPic' | 'inspectionReport' | 'lorryReceipt' | 'insurancePolicy';
    existingUrl?: string | null;
    claimId: string;
    onUpload: (claimId: string, mediaType: 'fir' | 'accidentPic' | 'inspectionReport' | 'lorryReceipt' | 'insurancePolicy', file: File) => void;
    onRemove: (claimId: string, mediaType: 'fir' | 'accidentPic' | 'inspectionReport' | 'lorryReceipt' | 'insurancePolicy') => void;
    uploading: boolean;
    removing: boolean;
    accept: string;
}) {
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            onUpload(claimId, mediaType, file);
        }
        // Reset input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="border border-gray-200 rounded-lg p-4">
            <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-medium text-gray-700">{label}</span>
                    {existingUrl ? (
                        <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                            <CheckIcon className="w-3.5 h-3.5" />
                            Uploaded
                        </span>
                    ) : (
                        <span className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-semibold text-amber-700">
                            Not uploaded
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                    {existingUrl && (
                        <a
                            href={existingUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
                            title="View document"
                        >
                            <EyeIcon className="w-4 h-4" />
                            View
                        </a>
                    )}
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept={accept}
                        className="hidden"
                        id={`file-${mediaType}-${claimId}`}
                    />
                    <label
                        htmlFor={`file-${mediaType}-${claimId}`}
                        className={`text-sm flex items-center gap-1 px-3 py-1 rounded cursor-pointer ${
                            existingUrl
                                ? 'text-green-600 hover:text-green-800 border border-green-600'
                                : 'text-blue-600 hover:text-blue-800 border border-blue-600'
                        } ${(uploading || removing) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {uploading ? (
                            <>
                                <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                Uploading...
                            </>
                        ) : (
                            <>
                                <CloudArrowUpIcon className="w-4 h-4" />
                                {existingUrl ? 'Reupload' : 'Upload'}
                            </>
                        )}
                    </label>
                    {existingUrl && (
                        <button
                            type="button"
                            onClick={() => onRemove(claimId, mediaType)}
                            disabled={uploading || removing}
                            className={`text-sm flex items-center gap-1 px-3 py-1 rounded border border-rose-300 text-rose-700 hover:bg-rose-50 ${(uploading || removing) ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {removing ? (
                                <>
                                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                                    Removing...
                                </>
                            ) : (
                                <>
                                    <XMarkIcon className="w-4 h-4" />
                                    Remove
                                </>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// Damage Form Modal Component
function DamageFormModal({
    claim,
    onClose,
    onSuccess
}: {
    claim: ClaimRequest;
    onClose: () => void;
    onSuccess: () => void;
}) {
    type DateField = 'damageCertificateDate' | 'transportReceiptDate' | 'accidentDate';
    const [formData, setFormData] = useState({
        damageCertificateDate: new Date().toISOString().split('T')[0],
        transportReceiptMemoNo: claim.invoice?.invoiceNumber || '',
        transportReceiptDate: claim.invoice?.date || '',
        loadedWeightKg: claim.invoice?.quantity || 0,
        productName: claim.invoice?.item || '',
        fromParty: claim.invoice?.supplier || '',
        forParty: claim.invoice?.buyer || '',
        accidentDate: '',
        accidentLocation: '',
        accidentDescription: '',
        agreedDamageAmountNumber: 0,
        agreedDamageAmountWords: '',
        authorizedSignatoryName: '',
    });
    const [activeDateField, setActiveDateField] = useState<DateField | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const getDateInputType = (field: DateField): 'text' | 'date' =>
        activeDateField === field || Boolean(formData[field]) ? 'date' : 'text';

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);
        try {
            const response = await adminApi.submitDamageForm(claim.id, formData);
            if (response.success) {
                alert('Damage form submitted successfully');
                onSuccess();
            } else {
                alert(response.message || 'Failed to submit damage form');
            }
        } catch (error) {
            alert('Failed to submit damage form');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="relative z-50" aria-labelledby="damage-modal-title" role="dialog" aria-modal="true">
            <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"></div>
            <div className="fixed inset-0 z-10 overflow-y-auto">
                <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
                    <div className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl max-h-[90vh] overflow-y-auto">
                        <form onSubmit={handleSubmit}>
                            <div className="bg-white px-4 pt-5 pb-4 sm:p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <h3 className="text-lg font-medium leading-6 text-gray-900" id="damage-modal-title">
                                        Damage Certificate Form
                                    </h3>
                                    <button type="button" onClick={onClose}>
                                        <XMarkIcon className="w-6 h-6 text-gray-400" />
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Date</label>
                                            <input
                                                type={getDateInputType('damageCertificateDate')}
                                                placeholder="DD-MM-YYYY"
                                                required
                                                className="mt-1 block w-full rounded-md border-gray-300 border py-2 px-3 text-sm"
                                                value={formData.damageCertificateDate}
                                                onFocus={() => setActiveDateField('damageCertificateDate')}
                                                onBlur={() => {
                                                    if (!formData.damageCertificateDate) setActiveDateField(null);
                                                }}
                                                onChange={(e) => setFormData({ ...formData, damageCertificateDate: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Loaded Weight (Kg)</label>
                                            <input
                                                type="number"
                                                required
                                                className="mt-1 block w-full rounded-md border-gray-300 border py-2 px-3 text-sm"
                                                value={formData.loadedWeightKg}
                                                onChange={(e) => setFormData({ ...formData, loadedWeightKg: Number(e.target.value) })}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Receipt/Memo No</label>
                                            <input
                                                type="text"
                                                required
                                                className="mt-1 block w-full rounded-md border-gray-300 border py-2 px-3 text-sm"
                                                value={formData.transportReceiptMemoNo}
                                                onChange={(e) => setFormData({ ...formData, transportReceiptMemoNo: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Receipt Date</label>
                                            <input
                                                type={getDateInputType('transportReceiptDate')}
                                                placeholder="DD-MM-YYYY"
                                                required
                                                className="mt-1 block w-full rounded-md border-gray-300 border py-2 px-3 text-sm"
                                                value={formData.transportReceiptDate}
                                                onFocus={() => setActiveDateField('transportReceiptDate')}
                                                onBlur={() => {
                                                    if (!formData.transportReceiptDate) setActiveDateField(null);
                                                }}
                                                onChange={(e) => setFormData({ ...formData, transportReceiptDate: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">From Party</label>
                                            <input
                                                type="text"
                                                required
                                                className="mt-1 block w-full rounded-md border-gray-300 border py-2 px-3 text-sm"
                                                value={formData.fromParty}
                                                onChange={(e) => setFormData({ ...formData, fromParty: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">For Party</label>
                                            <input
                                                type="text"
                                                required
                                                className="mt-1 block w-full rounded-md border-gray-300 border py-2 px-3 text-sm"
                                                value={formData.forParty}
                                                onChange={(e) => setFormData({ ...formData, forParty: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Product Name</label>
                                        <input
                                            type="text"
                                            required
                                            className="mt-1 block w-full rounded-md border-gray-300 border py-2 px-3 text-sm"
                                            value={formData.productName}
                                            onChange={(e) => setFormData({ ...formData, productName: e.target.value })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Accident Date</label>
                                            <input
                                                type={getDateInputType('accidentDate')}
                                                placeholder="DD-MM-YYYY"
                                                required
                                                className="mt-1 block w-full rounded-md border-gray-300 border py-2 px-3 text-sm"
                                                value={formData.accidentDate}
                                                onFocus={() => setActiveDateField('accidentDate')}
                                                onBlur={() => {
                                                    if (!formData.accidentDate) setActiveDateField(null);
                                                }}
                                                onChange={(e) => setFormData({ ...formData, accidentDate: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Accident Location</label>
                                            <input
                                                type="text"
                                                required
                                                className="mt-1 block w-full rounded-md border-gray-300 border py-2 px-3 text-sm"
                                                value={formData.accidentLocation}
                                                onChange={(e) => setFormData({ ...formData, accidentLocation: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Accident Description</label>
                                        <textarea
                                            required
                                            rows={3}
                                            className="mt-1 block w-full rounded-md border-gray-300 border py-2 px-3 text-sm"
                                            value={formData.accidentDescription}
                                            onChange={(e) => setFormData({ ...formData, accidentDescription: e.target.value })}
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Agreed Amount (₹)</label>
                                            <input
                                                type="number"
                                                required
                                                className="mt-1 block w-full rounded-md border-gray-300 border py-2 px-3 text-sm"
                                                value={formData.agreedDamageAmountNumber}
                                                onChange={(e) => setFormData({ ...formData, agreedDamageAmountNumber: Number(e.target.value) })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700">Amount in Words</label>
                                            <input
                                                type="text"
                                                required
                                                className="mt-1 block w-full rounded-md border-gray-300 border py-2 px-3 text-sm"
                                                value={formData.agreedDamageAmountWords}
                                                onChange={(e) => setFormData({ ...formData, agreedDamageAmountWords: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700">Authorized Signatory Name</label>
                                        <input
                                            type="text"
                                            required
                                            className="mt-1 block w-full rounded-md border-gray-300 border py-2 px-3 text-sm"
                                            value={formData.authorizedSignatoryName}
                                            onChange={(e) => setFormData({ ...formData, authorizedSignatoryName: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="bg-gray-50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="inline-flex w-full justify-center rounded-md border border-transparent bg-green-600 px-4 py-2 text-base font-medium text-white shadow-sm hover:bg-green-700 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50"
                                >
                                    {submitting ? 'Submitting...' : 'Submit Damage Form'}
                                </button>
                                <button
                                    type="button"
                                    onClick={onClose}
                                    className="mt-3 inline-flex w-full justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-base font-medium text-gray-700 shadow-sm hover:bg-gray-50 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm"
                                >
                                    Cancel
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
}
