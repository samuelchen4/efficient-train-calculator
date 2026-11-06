// Finds the cheapest set of routes connecting a set of destination cities
// (a Steiner tree over the board graph), using the Dreyfus–Wagner DP:
// dp[S][v] = best tree connecting the destinations in subset S plus city v.
//
// Each city pair is one edge; double routes collapse into a single edge
// (both lanes have the same length), and the lane is picked afterwards.

import { CITIES } from './cities'
import { ROUTES } from './routes'
import { ROUTE_GROUPS } from './routeGroups'
import { POINTS_BY_LENGTH } from './scoring'

// One player's supply of trains; caps the search in points-per-car mode.
export const MAX_CARS = 45

export const MODES = {
  cars: 'cars',
  turns: 'turns',
  ratio: 'ratio',
}

const CITY_NAMES = Object.keys(CITIES)
const CITY_INDEX = Object.fromEntries(CITY_NAMES.map((name, i) => [name, i]))
const N = CITY_NAMES.length

const EDGES = Object.entries(ROUTE_GROUPS).map(([key, indices]) => {
  const [from, to, length] = ROUTES[indices[0]]
  return { key, a: CITY_INDEX[from], b: CITY_INDEX[to], length }
})

const ADJ = Array.from({ length: N }, () => [])
EDGES.forEach((edge, e) => {
  ADJ[edge.a].push({ u: edge.b, e })
  ADJ[edge.b].push({ u: edge.a, e })
})

// Lexicographic weights: primary objective * BIG + tie-breaker.
// BIG exceeds any possible tie-breaker total (cars or turns of a whole tree).
const BIG = 1000
const WEIGHTS = {
  [MODES.cars]: (edge) => edge.length * BIG + 1, // fewest cars, then fewest turns
  [MODES.turns]: (edge) => BIG + edge.length, // fewest turns, then fewest cars
}

/**
 * @param {string[]} destinations city names
 * @param {string} mode one of MODES
 * @returns {string[] | null} route-group keys (city pairs) in the best tree,
 *   or null if fewer than two destinations / no connection found.
 */
export function findConnection(destinations, mode) {
  const terms = destinations.map((city) => CITY_INDEX[city])
  if (terms.length < 2) return null
  const edgeIds =
    mode === MODES.ratio ? bestRatioTree(terms) : minCostTree(terms, WEIGHTS[mode])
  return edgeIds && [...new Set(edgeIds)].map((e) => EDGES[e].key)
}

function lowestBit(S) {
  return S & -S
}

// Iterates the proper submasks A of S that contain S's lowest bit, so each
// unordered split {A, S^A} is visited exactly once.
function* splits(S) {
  const low = lowestBit(S)
  for (let A = (S - 1) & S; A > 0; A = (A - 1) & S) {
    if (A & low) yield A
  }
}

// Classic Dreyfus–Wagner with positive edge weights: exact minimum tree.
function minCostTree(terms, weight) {
  const k = terms.length
  const full = (1 << k) - 1
  const dp = Array.from({ length: full + 1 }, () => new Float64Array(N).fill(Infinity))
  const back = Array.from({ length: full + 1 }, () => new Array(N))

  terms.forEach((t, i) => {
    dp[1 << i][t] = 0
    back[1 << i][t] = { type: 'base' }
  })

  for (let S = 1; S <= full; S++) {
    const cost = dp[S]
    const bk = back[S]

    if (S !== lowestBit(S)) {
      for (const A of splits(S)) {
        const B = S ^ A
        for (let v = 0; v < N; v++) {
          const c = dp[A][v] + dp[B][v]
          if (c < cost[v]) {
            cost[v] = c
            bk[v] = { type: 'merge', A, B }
          }
        }
      }
    }

    // Dijkstra seeded with every city's current cost: grows trees along paths.
    const done = new Uint8Array(N)
    for (let iter = 0; iter < N; iter++) {
      let v = -1
      for (let i = 0; i < N; i++) {
        if (!done[i] && (v === -1 || cost[i] < cost[v])) v = i
      }
      if (cost[v] === Infinity) break
      done[v] = 1
      for (const { u, e } of ADJ[v]) {
        const c = cost[v] + weight(EDGES[e])
        if (c < cost[u]) {
          cost[u] = c
          bk[u] = { type: 'grow', from: v, edge: e }
        }
      }
    }
  }

  const root = terms[0]
  if (dp[full][root] === Infinity) return null

  const edges = []
  const collect = (S, v) => {
    const b = back[S][v]
    if (b.type === 'merge') {
      collect(b.A, v)
      collect(b.B, v)
    } else if (b.type === 'grow') {
      edges.push(b.edge)
      collect(S, b.from)
    }
  }
  collect(full, root)
  return edges
}

// City sets as two 32-bit halves (there are more than 32 cities).
const maskLo = (i) => (i < 32 ? 1 << i : 0)
const maskHi = (i) => (i < 32 ? 0 : 1 << (i - 32))

// Points-per-car isn't additive, so instead of one cost per state we keep,
// for every exact car count c <= MAX_CARS, the highest-points tree:
// dp[S][v][c]. Each entry tracks its city set so merges and growth only ever
// produce genuine trees (no reused routes, no going back and forth to pad
// the score). At the end, pick the car count with the best points/car.
// Keeping only the top-points tree per car count is a heuristic in rare
// cases where that tree blocks a merge another one wouldn't.
function bestRatioTree(terms) {
  const k = terms.length
  const full = (1 << k) - 1
  const dp = Array.from({ length: full + 1 }, () =>
    Array.from({ length: N }, () => new Array(MAX_CARS + 1).fill(null))
  )

  terms.forEach((t, i) => {
    dp[1 << i][t][0] = { p: 0, lo: maskLo(t), hi: maskHi(t), back: { type: 'base' } }
  })

  for (let S = 1; S <= full; S++) {
    const layer = dp[S]

    if (S !== lowestBit(S)) {
      for (const A of splits(S)) {
        const B = S ^ A
        for (let v = 0; v < N; v++) {
          const listA = dp[A][v]
          const listB = dp[B][v]
          const vlo = maskLo(v)
          const vhi = maskHi(v)
          for (let c1 = 0; c1 <= MAX_CARS; c1++) {
            const a = listA[c1]
            if (!a) continue
            for (let c2 = 0; c1 + c2 <= MAX_CARS; c2++) {
              const b = listB[c2]
              if (!b) continue
              // The two trees may only share the city they're joined at.
              if ((a.lo & b.lo) !== vlo || (a.hi & b.hi) !== vhi) continue
              const p = a.p + b.p
              const cur = layer[v][c1 + c2]
              if (!cur || p > cur.p) {
                layer[v][c1 + c2] = {
                  p,
                  lo: a.lo | b.lo,
                  hi: a.hi | b.hi,
                  back: { type: 'merge', A, B, c1, c2 },
                }
              }
            }
          }
        }
      }
    }

    // Grow along routes in increasing car count; every route adds >= 1 car,
    // so an entry is final by the time it's extended.
    for (let c = 0; c <= MAX_CARS; c++) {
      for (let v = 0; v < N; v++) {
        const cur = layer[v][c]
        if (!cur) continue
        for (const { u, e } of ADJ[v]) {
          const { length } = EDGES[e]
          const nc = c + length
          if (nc > MAX_CARS) continue
          const ulo = maskLo(u)
          const uhi = maskHi(u)
          if ((cur.lo & ulo) || (cur.hi & uhi)) continue
          const p = cur.p + POINTS_BY_LENGTH[length]
          const next = layer[u][nc]
          if (!next || p > next.p) {
            layer[u][nc] = {
              p,
              lo: cur.lo | ulo,
              hi: cur.hi | uhi,
              back: { type: 'grow', from: v, c, edge: e },
            }
          }
        }
      }
    }
  }

  const root = terms[0]
  let bestC = -1
  for (let c = 1; c <= MAX_CARS; c++) {
    const entry = dp[full][root][c]
    if (!entry) continue
    // Higher points per car wins; ties go to fewer cars (found first).
    if (bestC === -1 || entry.p * bestC > dp[full][root][bestC].p * c) bestC = c
  }
  if (bestC === -1) return null

  const edges = []
  const collect = (S, v, c) => {
    const b = dp[S][v][c].back
    if (b.type === 'merge') {
      collect(b.A, v, b.c1)
      collect(b.B, v, b.c2)
    } else if (b.type === 'grow') {
      edges.push(b.edge)
      collect(S, b.from, b.c)
    }
  }
  collect(full, root, bestC)
  return edges
}
