import { ROUTES } from '../data/routes'
import { POINTS_BY_LENGTH } from '../data/scoring'
import { COLORS, COLOR_NAMES } from '../data/colors'
import './StatsPanel.css'

// activeRoutes holds one route index per selected city pair
// (only the chosen lane of a double route), matching the board highlighting.
function computeStats(activeRoutes) {
  const byColor = {}
  let cars = 0
  let points = 0

  activeRoutes.forEach((i) => {
    const [, , length, color] = ROUTES[i]
    cars += length
    points += POINTS_BY_LENGTH[length]
    byColor[color] = (byColor[color] ?? 0) + length
  })

  return { cars, points, byColor }
}

export default function StatsPanel({ activeRoutes, onReset, children }) {
  const { cars, points, byColor } = computeStats(activeRoutes)
  const ratio = cars > 0 ? points / cars : 0
  const colorEntries = Object.entries(byColor).sort((a, b) => b[1] - a[1])

  return (
    <aside className="stats-panel">
      {children}

      <div className="stat">
        <span className="stat-label">Cars selected</span>
        <span className="stat-value">{cars}</span>
      </div>

      <div className="stat">
        <span className="stat-label">Colour distribution</span>
        {colorEntries.length === 0 ? (
          <span className="stat-empty">None</span>
        ) : (
          <ul className="color-list">
            {colorEntries.map(([code, count]) => (
              <li key={code}>
                <span className="swatch" style={{ background: COLORS[code] }} />
                <span className="color-name">{COLOR_NAMES[code]}</span>
                <span className="color-count">{count}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="stat">
        <span className="stat-label">Total points</span>
        <span className="stat-value">{points}</span>
      </div>

      <div className="stat">
        <span className="stat-label">Points per train</span>
        <span className="stat-value">{ratio.toFixed(2)}</span>
      </div>

      <div className="stat">
        <span className="stat-label">Turns</span>
        {/* Claiming each route costs one turn. */}
        <span className="stat-value">{activeRoutes.length}</span>
      </div>

      <button type="button" className="reset-button" onClick={onReset}>
        Reset
      </button>
    </aside>
  )
}
