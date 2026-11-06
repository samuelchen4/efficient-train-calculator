import { ROUTES } from './routes'

// Groups parallel routes (double routes) that connect the same two cities.
// ROUTE_GROUPS: pairKey -> [route indices]; ROUTE_PAIR_KEYS: route index -> pairKey.
export const ROUTE_PAIR_KEYS = ROUTES.map(([from, to]) => [from, to].sort().join('|'))

export const ROUTE_GROUPS = ROUTE_PAIR_KEYS.reduce((groups, key, i) => {
  ;(groups[key] ??= []).push(i)
  return groups
}, {})

// For each city pair with both cities selected, returns the single route index
// that counts: the chosen lane for double routes (default: first lane).
export function getActiveRouteIndices(selectedCities, laneChoice) {
  const active = []
  Object.entries(ROUTE_GROUPS).forEach(([key, indices]) => {
    const [from, to] = ROUTES[indices[0]]
    if (!selectedCities.includes(from) || !selectedCities.includes(to)) return
    active.push(indices[laneChoice[key] ?? 0])
  })
  return active
}
