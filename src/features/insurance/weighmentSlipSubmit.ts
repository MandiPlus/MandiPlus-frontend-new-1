type FileRef<TFile> = {
  current?: TFile | null;
};

export const resolveWeighmentSlipForSubmit = <TFile>(
  fileArgument: TFile | null | undefined,
  weightmentSlipRef: FileRef<TFile>,
  weightmentSlip: TFile | null | undefined,
): TFile | null => {
  return fileArgument || weightmentSlipRef.current || weightmentSlip || null;
};

export const createCustomerWillUpdateLaterSlip = (): Promise<File> =>
  new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    canvas.width = 472;
    canvas.height = 300;

    const context = canvas.getContext('2d');
    if (!context) {
      reject(new Error('Could not create the customer-update-later slip.'));
      return;
    }

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = '#111827';
    context.font = '500 24px Arial, sans-serif';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText(
      'The customer will update later.',
      canvas.width / 2,
      canvas.height / 2,
    );

    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Could not create the customer-update-later slip.'));
        return;
      }

      resolve(
        new File([blob], 'customer-will-update-later.jpg', {
          type: 'image/jpeg',
        }),
      );
    }, 'image/jpeg', 0.92);
  });
