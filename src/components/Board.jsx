import { CITIES } from '../data/cities'
import { ROUTES } from '../data/routes'
import { COLORS } from '../data/colors'
import { ROUTE_GROUPS, ROUTE_PAIR_KEYS } from '../data/routeGroups'
import './Board.css'

// Scaled up from the board's native 1000x650 ratio so that fixed-size city
// circles and route-chunk thickness take up proportionally less room,
// giving tightly-clustered cities (e.g. Seattle/Portland/Vancouver) enough
// space for their rails to stay legible and clear of the nodes.
const WIDTH = 1600
const HEIGHT = 1040

function toPoint(city) {
  const { x, y } = CITIES[city]
  return { px: x * WIDTH, py: (1 - y) * HEIGHT }
}

// Lane spacing between parallel tracks connecting the same two cities.
// Routes with no parallel twin get offset 0 so they stay centered on their cities.
const LANE_SPACING = 16
const LANE_OFFSETS = (() => {
  const offsets = new Array(ROUTES.length).fill(0)
  Object.values(ROUTE_GROUPS).forEach((indices) => {
    const count = indices.length
    indices.forEach((routeIndex, lane) => {
      offsets[routeIndex] = (lane - (count - 1) / 2) * LANE_SPACING
    })
  })
  return offsets
})()

const CITY_RADIUS = 24
const CITY_MARGIN = 8

function routeChunks(from, to, length, color, laneOffset) {
  const a = toPoint(from)
  const b = toPoint(to)
  const dx = b.py - a.py
  const dy = a.px - b.px
  const perpLen = Math.hypot(dx, dy) || 1
  const ox = (dx / perpLen) * laneOffset
  const oy = (dy / perpLen) * laneOffset

  const rawAx = a.px + ox
  const rawAy = a.py + oy
  const rawBx = b.px + ox
  const rawBy = b.py + oy
  const rawVx = rawBx - rawAx
  const rawVy = rawBy - rawAy
  const rawLen = Math.hypot(rawVx, rawVy) || 1
  const ux = rawVx / rawLen
  const uy = rawVy / rawLen

  // Keep rails clear of the city nodes by trimming each end back from the center.
  const trim = Math.min(CITY_RADIUS + CITY_MARGIN, rawLen * 0.35)
  const ax = rawAx + ux * trim
  const ay = rawAy + uy * trim
  const bx = rawBx - ux * trim
  const by = rawBy - uy * trim
  const vx = bx - ax
  const vy = by - ay
  const totalLen = Math.hypot(vx, vy) || 1
  const angle = (Math.atan2(vy, vx) * 180) / Math.PI
  const segLen = totalLen / length
  const chunkLen = segLen * 0.75

  return Array.from({ length }, (_, i) => {
    const dist = segLen * (i + 0.5)
    const cx = ax + (vx / totalLen) * dist
    const cy = ay + (vy / totalLen) * dist
    return { cx, cy, angle, chunkLen, color }
  })
}

export default function Board({
  selectedCities,
  setSelectedCities,
  activeRoutes,
  setLaneChoice,
}) {
  function toggleCity(city) {
    setSelectedCities((prev) =>
      prev.includes(city) ? prev.filter((c) => c !== city) : [...prev, city]
    )
  }

  // Clicking either lane of a selected double route switches to the other lane.
  function toggleLane(routeIndex) {
    const key = ROUTE_PAIR_KEYS[routeIndex]
    const lanes = ROUTE_GROUPS[key]
    setLaneChoice((prev) => ({
      ...prev,
      [key]: ((prev[key] ?? 0) + 1) % lanes.length,
    }))
  }

  return (
    <div className="board-wrapper">
      <svg
        className="board-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Ticket to Ride USA board"
      >
        {/* Continuous band behind each selected route, drawn under every
            route so it never covers a neighbouring lane. */}
        <g className="route-halos">
          {ROUTES.map(([from, to, length, color], i) => {
            if (!activeRoutes.includes(i)) return null
            const chunks = routeChunks(from, to, length, color, LANE_OFFSETS[i])
            const first = chunks[0]
            const last = chunks[chunks.length - 1]
            const rad = (first.angle * Math.PI) / 180
            const hx = (Math.cos(rad) * first.chunkLen) / 2
            const hy = (Math.sin(rad) * first.chunkLen) / 2
            return (
              <line
                key={i}
                className="route-halo"
                x1={first.cx - hx}
                y1={first.cy - hy}
                x2={last.cx + hx}
                y2={last.cy + hy}
              />
            )
          })}
        </g>

        <g className="routes">
          {ROUTES.map(([from, to, length, color], i) => {
            const chunks = routeChunks(from, to, length, color, LANE_OFFSETS[i])
            const isHighlighted = activeRoutes.includes(i)
            // A double route can switch lanes whenever one of its lanes is in use.
            const lanes = ROUTE_GROUPS[ROUTE_PAIR_KEYS[i]]
            const isSwitchable =
              lanes.length > 1 && lanes.some((lane) => activeRoutes.includes(lane))
            return (
              <g
                key={`${from}-${to}-${i}`}
                className={isSwitchable ? 'route switchable' : 'route'}
                onClick={isSwitchable ? () => toggleLane(i) : undefined}
              >
                {chunks.map((chunk, j) => (
                  <rect
                    key={j}
                    x={-chunk.chunkLen / 2}
                    y={-5}
                    width={chunk.chunkLen}
                    height={10}
                    rx={3}
                    className="route-chunk"
                    style={isHighlighted ? { fill: COLORS[color] } : undefined}
                    stroke={COLORS[color]}
                    transform={`translate(${chunk.cx}, ${chunk.cy}) rotate(${chunk.angle})`}
                  />
                ))}
              </g>
            )
          })}
        </g>

        <g className="cities">
          {Object.keys(CITIES).map((city) => {
            const { px, py } = toPoint(city)
            const isSelected = selectedCities.includes(city)
            return (
              <g
                key={city}
                className="city"
                transform={`translate(${px}, ${py})`}
                onClick={() => toggleCity(city)}
              >
                <circle
                  r={isSelected ? CITY_RADIUS + 2 : CITY_RADIUS}
                  className={isSelected ? 'city-dot selected' : 'city-dot'}
                />
                <text className="city-label" textAnchor="middle">
                  {city.split(' ').map((word, idx, words) => (
                    <tspan
                      key={idx}
                      x={0}
                      dy={idx === 0 ? `${-(words.length - 1) * 0.55}em` : '1.1em'}
                    >
                      {word}
                    </tspan>
                  ))}
                </text>
              </g>
            )
          })}
        </g>
      </svg>

      <p className="selected-city">
        {selectedCities.length > 0
          ? `Selected: ${selectedCities.join(', ')}`
          : 'Click cities to select'}
      </p>
    </div>
  )
}
