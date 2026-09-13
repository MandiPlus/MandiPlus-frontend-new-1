/**
 * Canonical mandi (APMC / wholesale market) options for the admin "Mandi Name"
 * filter on the insurance-payments page.
 *
 * Keep in sync with `MANDI_DIRECTORY` in
 * `mandiplus/src/common/mandi-directory.ts` — that file is the source of truth
 * for how free-text supplier + bill-to addresses normalize into these names.
 */

export const UNMAPPED_MANDI_VALUE = 'OTHER_UNMAPPED';

export interface MandiOption {
  value: string;
  label: string;
  state:
    | 'Karnataka'
    | 'Andhra Pradesh'
    | 'Delhi'
    | 'Haryana'
    | 'Uttar Pradesh'
    | 'Gujarat'
    | 'Tamil Nadu'
    | 'Maharashtra';
}

export const MANDI_OPTIONS: MandiOption[] = [
  // Karnataka
  { value: 'Kolar', label: 'Kolar', state: 'Karnataka' },
  { value: 'Chintamani', label: 'Chintamani', state: 'Karnataka' },
  { value: 'Bagepalli', label: 'Bagepalli', state: 'Karnataka' },
  { value: 'Srinivaspur', label: 'Srinivaspur', state: 'Karnataka' },
  { value: 'Chelikere', label: 'Chelikere', state: 'Karnataka' },
  { value: 'Channarayapatna', label: 'Channarayapatna', state: 'Karnataka' },
  { value: 'Mandya', label: 'Mandya', state: 'Karnataka' },
  { value: 'Bannur', label: 'Bannur', state: 'Karnataka' },
  { value: 'Maddur', label: 'Maddur', state: 'Karnataka' },
  { value: 'Kikkeri', label: 'Kikkeri / KR Pet', state: 'Karnataka' },
  { value: 'Pandavapura', label: 'Pandavapura', state: 'Karnataka' },
  { value: 'Shravanabelagola', label: 'Shravanabelagola', state: 'Karnataka' },
  { value: 'Hassan', label: 'Hassan', state: 'Karnataka' },
  { value: 'Kadur', label: 'Kadur', state: 'Karnataka' },
  { value: 'Chamarajanagar', label: 'Chamarajanagar', state: 'Karnataka' },
  { value: 'Davangere', label: 'Davangere', state: 'Karnataka' },
  { value: 'Chitradurga', label: 'Chitradurga', state: 'Karnataka' },
  { value: 'Hunsur', label: 'Hunsur', state: 'Karnataka' },
  { value: 'Mysore', label: 'Mysore', state: 'Karnataka' },
  // Andhra Pradesh
  { value: 'Anantapur', label: 'Anantapur', state: 'Andhra Pradesh' },
  { value: 'Madanapalle', label: 'Madanapalle', state: 'Andhra Pradesh' },
  { value: 'Angallu', label: 'Angallu', state: 'Andhra Pradesh' },
  { value: 'Mulakalacheruvu', label: 'Mulakalacheruvu', state: 'Andhra Pradesh' },
  { value: 'Punganuru', label: 'Punganuru', state: 'Andhra Pradesh' },
  { value: 'Kalyandurg', label: 'Kalyandurg', state: 'Andhra Pradesh' },
  { value: 'Kalikiri', label: 'Kalikiri', state: 'Andhra Pradesh' },
  {
    value: 'Venkatagirikota',
    label: 'Venkatagirikota (V Kota)',
    state: 'Andhra Pradesh',
  },
  { value: 'Vizianagaram', label: 'Vizianagaram', state: 'Andhra Pradesh' },
  { value: 'Tirupati', label: 'Tirupati', state: 'Andhra Pradesh' },
  { value: 'Rajanagaram', label: 'Rajanagaram', state: 'Andhra Pradesh' },
  { value: 'Pedapuram', label: 'Pedapuram', state: 'Andhra Pradesh' },
  // Delhi NCR
  { value: 'Azadpur', label: 'Azadpur Mandi', state: 'Delhi' },
  { value: 'Ghazipur', label: 'Ghazipur', state: 'Delhi' },
  // Haryana
  { value: 'Faridabad', label: 'Faridabad (Dabua Mandi)', state: 'Haryana' },
  { value: 'Gurugram', label: 'Gurugram (Khandsa)', state: 'Haryana' },
  // Uttar Pradesh
  { value: 'Ghaziabad', label: 'Ghaziabad', state: 'Uttar Pradesh' },
  { value: 'Saharanpur', label: 'Saharanpur', state: 'Uttar Pradesh' },
  // Gujarat
  { value: 'Gadu', label: 'Gadu', state: 'Gujarat' },
  { value: 'Mangrol', label: 'Mangrol', state: 'Gujarat' },
  // Tamil Nadu
  { value: 'Pollachi', label: 'Pollachi', state: 'Tamil Nadu' },
  { value: 'Cuddalore', label: 'Cuddalore', state: 'Tamil Nadu' },
  // Maharashtra
  { value: 'Nashik', label: 'Nashik', state: 'Maharashtra' },
  { value: 'Hiwarkhed', label: 'Hiwarkhed', state: 'Maharashtra' },
  { value: 'Jamner', label: 'Jamner', state: 'Maharashtra' },
  { value: 'Sangola', label: 'Sangola', state: 'Maharashtra' },
];

const STATE_ORDER: MandiOption['state'][] = [
  'Karnataka',
  'Andhra Pradesh',
  'Delhi',
  'Haryana',
  'Uttar Pradesh',
  'Gujarat',
  'Tamil Nadu',
  'Maharashtra',
];

export const MANDI_OPTION_GROUPS: Array<{
  state: MandiOption['state'];
  options: MandiOption[];
}> = STATE_ORDER.map((state) => ({
  state,
  options: MANDI_OPTIONS.filter((o) => o.state === state),
})).filter((group) => group.options.length > 0);

/** Every selectable filter value (canonical mandis + unmapped sentinel). */
export const ALL_MANDI_FILTER_VALUES: string[] = [
  ...MANDI_OPTIONS.map((option) => option.value),
  UNMAPPED_MANDI_VALUE,
];

export function formatMandiFilterLabel(selected: ReadonlySet<string>): string {
  if (selected.size === 0 || selected.size === ALL_MANDI_FILTER_VALUES.length) {
    return 'All Mandis';
  }

  const fullySelectedStates = MANDI_OPTION_GROUPS.filter((group) =>
    group.options.every((option) => selected.has(option.value)),
  ).map((group) => group.state);

  const coveredByStates = new Set(
    MANDI_OPTION_GROUPS.filter((group) =>
      fullySelectedStates.includes(group.state),
    ).flatMap((group) => group.options.map((option) => option.value)),
  );

  const leftover = Array.from(selected).filter(
    (value) => value !== UNMAPPED_MANDI_VALUE && !coveredByStates.has(value),
  );
  const includesUnmapped = selected.has(UNMAPPED_MANDI_VALUE);

  const parts: string[] = [...fullySelectedStates];
  if (leftover.length === 1) {
    const match = MANDI_OPTIONS.find((option) => option.value === leftover[0]);
    parts.push(match?.label || leftover[0]);
  } else if (leftover.length > 1) {
    parts.push(`${leftover.length} mandis`);
  }
  if (includesUnmapped) parts.push('Unmapped');

  if (parts.length === 1) return parts[0];
  if (parts.length <= 2) return parts.join(' + ');
  return `${selected.size} selected`;
}
