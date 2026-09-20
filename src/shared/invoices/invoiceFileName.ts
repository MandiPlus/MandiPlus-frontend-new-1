/**
 * Download file names for invoice PDFs.
 *
 * SRT wants their invoices to land on disk as
 * `BuyerName_BuyerAddress_VehicleLast4` (e.g. `SRT_Katni_9477.pdf`) instead of
 * the stored object name (`invoice-INV-2026-010189.pdf`). Every other buyer
 * keeps the stored name.
 *
 * Nothing is renamed in storage: the name is applied at download time through
 * Cloudinary's `fl_attachment` flag, so it works for invoices that already
 * exist. Non-Cloudinary URLs (local/R2 dev storage) fall back to a blob
 * download.
 */

export interface InvoiceFileNameSource {
    billToName?: string | null;
    billToAddress?: string[] | string | null;
    vehicleNumber?: string | null;
    truckNumber?: string | null;
}

/** Buyers (bill-to names, upper-cased) that get the custom file name. */
const CUSTOM_FILE_NAME_BUYERS = new Set(['SRT']);

const CLOUDINARY_UPLOAD_MARKER = '/upload/';

/** Keeps a name segment safe for both a Cloudinary transformation and a file name. */
const sanitizePart = (value: string): string =>
    value
        .trim()
        .replace(/[^A-Za-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

const firstAddressLine = (address?: string[] | string | null): string => {
    if (Array.isArray(address)) {
        return String(address.find((line) => String(line || '').trim()) || '');
    }
    return String(address || '');
};

/**
 * `SRT_Katni_9477` for buyers on the custom-name list, otherwise `null`
 * (meaning: keep whatever the stored file is called). Returns `null` too when
 * the address or vehicle number is missing, so a half-built name is never used.
 */
export function buildInvoiceDownloadFileName(
    invoice: InvoiceFileNameSource,
): string | null {
    // Canonical spelling, so "Srt" and "SRT" produce the same file name.
    const buyerName = sanitizePart(String(invoice.billToName || '')).toUpperCase();
    if (!buyerName || !CUSTOM_FILE_NAME_BUYERS.has(buyerName)) return null;

    const address = sanitizePart(firstAddressLine(invoice.billToAddress));
    if (!address) return null;

    const vehicle = String(invoice.vehicleNumber || invoice.truckNumber || '')
        .replace(/[^A-Za-z0-9]/g, '')
        .toUpperCase();
    const vehicleLast4 = vehicle.slice(-4);
    if (vehicleLast4.length < 4) return null;

    return `${buyerName}_${address}_${vehicleLast4}`;
}

/**
 * Adds `fl_attachment:<fileName>` to a Cloudinary delivery URL so the browser
 * saves it under that name. Non-Cloudinary URLs come back untouched.
 */
export function withCloudinaryAttachmentName(url: string, fileName: string): string {
    if (!/^https?:\/\/res\.cloudinary\.com\//i.test(url)) return url;

    const markerIndex = url.indexOf(CLOUDINARY_UPLOAD_MARKER);
    if (markerIndex === -1) return url;

    const head = url.slice(0, markerIndex + CLOUDINARY_UPLOAD_MARKER.length);
    let tail = url.slice(markerIndex + CLOUDINARY_UPLOAD_MARKER.length);

    // Drop an attachment flag that is already there so names never stack up.
    if (tail.startsWith('fl_attachment')) {
        const nextSegment = tail.indexOf('/');
        tail = nextSegment === -1 ? '' : tail.slice(nextSegment + 1);
    }

    return `${head}fl_attachment:${fileName}/${tail}`;
}

const triggerAnchorDownload = (url: string, fileName?: string) => {
    const anchor = document.createElement('a');
    anchor.href = url;
    if (fileName) anchor.download = `${fileName}.pdf`;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
};

/**
 * Downloads an invoice PDF, renaming it when the buyer is on the custom-name
 * list. `url` must already be absolute.
 */
export async function downloadInvoicePdf(
    url: string,
    invoice: InvoiceFileNameSource,
): Promise<void> {
    if (!url) return;

    const fileName = buildInvoiceDownloadFileName(invoice);
    if (!fileName) {
        triggerAnchorDownload(url);
        return;
    }

    const attachmentUrl = withCloudinaryAttachmentName(url, fileName);
    if (attachmentUrl !== url) {
        // Cloudinary sends Content-Disposition with the name for us.
        triggerAnchorDownload(attachmentUrl);
        return;
    }

    // Other storage backends: pull the bytes so the download attribute applies
    // (it is ignored on cross-origin links).
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const blobUrl = URL.createObjectURL(await response.blob());
        triggerAnchorDownload(blobUrl, fileName);
        URL.revokeObjectURL(blobUrl);
    } catch {
        triggerAnchorDownload(url);
    }
}
