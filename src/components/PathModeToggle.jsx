import { MODES } from '../data/steiner'
import './PathModeToggle.css'

// Manual: highlight routes directly between the selected cities.
export const MANUAL = 'manual'

const OPTIONS = [
  { mode: MANUAL, label: 'Manual' },
  { mode: MODES.cars, label: 'Fewest cars' },
  { mode: MODES.turns, label: 'Fewest turns' },
  { mode: MODES.ratio, label: 'Best points per car' },
]

export default function PathModeToggle({ mode, onChange }) {
  return (
    <div className="mode-toggle" role="radiogroup" aria-label="Optimise for">
      {OPTIONS.map((option) => (
        <button
          key={option.mode}
          type="button"
          role="radio"
          aria-checked={mode === option.mode}
          className={mode === option.mode ? 'mode-option active' : 'mode-option'}
          onClick={() => onChange(option.mode)}
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}
