import { useMemo, useState } from 'react'
import Board from './components/Board'
import StatsPanel from './components/StatsPanel'
import PathModeToggle, { MANUAL } from './components/PathModeToggle'
import { getActiveRouteIndices, ROUTE_GROUPS } from './data/routeGroups'
import { findConnection, MAX_CARS } from './data/steiner'
import './App.css'

function App() {
  const [selectedCities, setSelectedCities] = useState([])
  // pairKey -> chosen lane index for double routes.
  const [laneChoice, setLaneChoice] = useState({})
  // MANUAL: routes between selected cities. Otherwise: selected cities are
  // destinations, connected by the best tree for that mode.
  const [mode, setMode] = useState(MANUAL)

  const connection = useMemo(
    () => (mode === MANUAL ? null : findConnection(selectedCities, mode)),
    [selectedCities, mode]
  )

  const activeRoutes = useMemo(() => {
    if (mode === MANUAL) return getActiveRouteIndices(selectedCities, laneChoice)
    return (connection ?? []).map((key) => ROUTE_GROUPS[key][laneChoice[key] ?? 0])
  }, [mode, selectedCities, laneChoice, connection])

  return (
    <main className="app">
      <section className="app-section app-row">
        <StatsPanel
          activeRoutes={activeRoutes}
          onReset={() => {
            setSelectedCities([])
            setLaneChoice({})
          }}
        >
          <PathModeToggle mode={mode} onChange={setMode} />
          {mode !== MANUAL && selectedCities.length < 2 && (
            <p className="path-note">Select two or more destinations.</p>
          )}
          {mode !== MANUAL && selectedCities.length >= 2 && !connection && (
            <p className="path-note">No connection within {MAX_CARS} cars.</p>
          )}
        </StatsPanel>
        <Board
          selectedCities={selectedCities}
          setSelectedCities={setSelectedCities}
          activeRoutes={activeRoutes}
          setLaneChoice={setLaneChoice}
        />
      </section>
    </main>
  )
}

export default App
