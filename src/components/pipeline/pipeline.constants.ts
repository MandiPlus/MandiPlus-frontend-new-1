export const PIPELINE_STAGE_DEFINITIONS = [
  { number: 1, name: 'Customer document submission' },
  { number: 2, name: 'Invoice generation' },
  { number: 3, name: 'Insurance creation' },
  { number: 4, name: 'Vehicle tracking setup' },
  { number: 5, name: 'Payment collection' },
  { number: 6, name: 'Vehicle monitoring' },
  { number: 7, name: 'Delivery completion' },
] as const;

export function getPipelineStageName(stageNumber: number) {
  return (
    PIPELINE_STAGE_DEFINITIONS.find((stage) => stage.number === stageNumber)
      ?.name || `Stage ${stageNumber}`
  );
}
