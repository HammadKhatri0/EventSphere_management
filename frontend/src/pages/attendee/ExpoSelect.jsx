import { Select } from '../../components/ui/index.jsx';
import { fmtRange } from '../../lib/utils.js';

/** Expo picker. Pass `allLabel` to add an "all expos" option with an empty value. */
export default function ExpoSelect({ expos, value, onChange, label = 'Expo', allLabel, wrapperClassName }) {
  const options = [
    ...(allLabel ? [{ value: '', label: allLabel }] : []),
    ...expos.map((e) => ({ value: e._id, label: `${e.title} · ${fmtRange(e.startDate, e.endDate)}` })),
  ];
  return <Select label={label} value={value || ''} onChange={(e) => onChange(e.target.value)} options={options} wrapperClassName={wrapperClassName} />;
}
