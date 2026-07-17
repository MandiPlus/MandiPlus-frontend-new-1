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
