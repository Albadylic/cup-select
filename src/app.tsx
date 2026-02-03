import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import './app.css'

type Phase = 'idle' | 'placing' | 'shuffling' | 'ready' | 'revealing' | 'result'

const SLOT_X = [-160, 0, 160]
const SHUFFLE_MIN = 3
const SHUFFLE_MAX = 9
const REVEAL_DELAY_MS = 520

const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min

const buildShuffleSteps = (count: number): Array<[number, number]> => {
  const steps: Array<[number, number]> = []
  while (steps.length < count) {
    const a = randomInt(0, 2)
    let b = randomInt(0, 2)
    while (b === a) b = randomInt(0, 2)
    steps.push([a, b])
  }
  return steps
}

const CupSvg = ({ highlight }: { highlight?: boolean }) => (
  <svg
    class="cup-svg"
    width="160"
    height="160"
    viewBox="0 0 160 160"
    aria-hidden="true"
    shape-rendering="crispEdges"
  >
    <rect x="26" y="28" width="108" height="26" rx="4" fill="#d4a35a" />
    <rect x="34" y="48" width="92" height="76" rx="6" fill="#8c451d" />
    <rect x="34" y="48" width="92" height="18" rx="6" fill="#a85d2a" />
    <rect x="24" y="118" width="112" height="26" rx="6" fill="#5a2b12" />
    <rect x="40" y="56" width="10" height="52" fill="#b86a33" opacity="0.8" />
    <rect x="110" y="56" width="6" height="52" fill="#6d3216" opacity="0.6" />
    {highlight ? <rect x="30" y="30" width="100" height="6" fill="#ffdca0" opacity="0.7" /> : null}
  </svg>
)

const BallSvg = () => (
  <svg
    class="ball-svg"
    width="40"
    height="40"
    viewBox="0 0 40 40"
    aria-hidden="true"
    shape-rendering="crispEdges"
  >
    <circle cx="20" cy="20" r="16" fill="#d2472f" />
    <circle cx="15" cy="14" r="6" fill="#f4b39f" opacity="0.9" />
    <circle cx="24" cy="26" r="8" fill="#b13422" opacity="0.7" />
  </svg>
)

export function App() {
  const [phase, setPhase] = useState<Phase>('idle')
  const [cupSlots, setCupSlots] = useState([0, 1, 2])
  const [ballCupId, setBallCupId] = useState(0)
  const [chosenCupId, setChosenCupId] = useState<number | null>(null)
  const [shuffleCount, setShuffleCount] = useState(0)
  const [liftOthers, setLiftOthers] = useState(false)
  const [ballX, setBallX] = useState(0)

  const timeouts = useRef<number[]>([])

  const ballSlotIndex = cupSlots[ballCupId]

  const isReady = phase === 'ready'
  const isReveal = phase === 'revealing' || phase === 'result'
  const playerWon = chosenCupId !== null && chosenCupId === ballCupId

  const clearTimers = () => {
    timeouts.current.forEach((id) => window.clearTimeout(id))
    timeouts.current = []
  }

  const queueTimeout = (fn: () => void, delay: number) => {
    const id = window.setTimeout(fn, delay)
    timeouts.current.push(id)
  }

  const startRound = () => {
    clearTimers()
    setLiftOthers(false)
    setChosenCupId(null)
    setCupSlots([0, 1, 2])
    const nextBall = randomInt(0, 2)
    setBallCupId(nextBall)
    setBallX(0)
    setPhase('placing')
    queueTimeout(() => {
      setBallX(SLOT_X[nextBall])
    }, 320)
    queueTimeout(() => {
      setPhase('shuffling')
    }, 900)
  }

  useEffect(() => {
    return () => clearTimers()
  }, [])

  useEffect(() => {
    if (phase !== 'shuffling') return
    const count = randomInt(SHUFFLE_MIN, SHUFFLE_MAX)
    setShuffleCount(count)
    const steps = buildShuffleSteps(count)
    let stepIndex = 0
    const runStep = () => {
      if (stepIndex >= steps.length) {
        setPhase('ready')
        return
      }
      const [slotA, slotB] = steps[stepIndex]
      setCupSlots((prev) => {
        const next = [...prev]
        const cupA = next.findIndex((slot) => slot === slotA)
        const cupB = next.findIndex((slot) => slot === slotB)
        if (cupA !== -1) next[cupA] = slotB
        if (cupB !== -1) next[cupB] = slotA
        return next
      })
      stepIndex += 1
      queueTimeout(runStep, 520)
    }
    queueTimeout(runStep, 220)
  }, [phase])

  useEffect(() => {
    if (phase === 'placing') return
    setBallX(SLOT_X[ballSlotIndex])
  }, [phase, ballSlotIndex])

  useEffect(() => {
    if (phase !== 'revealing') return
    queueTimeout(() => setLiftOthers(true), REVEAL_DELAY_MS)
    queueTimeout(() => setPhase('result'), REVEAL_DELAY_MS + 520)
  }, [phase])

  const handlePick = (cupId: number) => {
    if (!isReady) return
    setChosenCupId(cupId)
    setPhase('revealing')
  }

  const ballVisible =
    phase === 'placing' || phase === 'revealing' || phase === 'result'

  const sceneSubtitle = useMemo(() => {
    if (phase === 'idle') return 'Ready when you are.'
    if (phase === 'placing') return 'The barkeep hides the ball...'
    if (phase === 'shuffling') return `Shuffling... (${shuffleCount})`
    if (phase === 'ready') return 'Pick a cup.'
    if (phase === 'result') return playerWon ? 'You found it!' : 'Wrong cup.'
    return 'Get ready.'
  }, [phase, shuffleCount, playerWon])

  return (
    <div class="scene">
      <header class="scene__header">
        <p class="scene__eyebrow">Tavern Trick</p>
        <h1 class="scene__title">Cup &amp; Coin</h1>
        <p class="scene__subtitle">{sceneSubtitle}</p>
      </header>

      <div class="table">
        <div class="table__surface" />
        <div class="table__slots">
          {cupSlots.map((slotIndex, cupId) => {
            const lifted =
              (phase === 'revealing' && chosenCupId === cupId) ||
              (liftOthers && chosenCupId !== cupId)
            const selectable = isReady
            return (
              <button
                key={cupId}
                class={`cup ${lifted ? 'cup--lifted' : ''} ${
                  selectable ? 'cup--ready' : ''
                }`}
                style={{ '--cup-x': `${SLOT_X[slotIndex]}px` } as Record<string, string>}
                onClick={() => handlePick(cupId)}
                disabled={!selectable}
                aria-label={`Cup ${cupId + 1}`}
              >
                <CupSvg highlight={selectable} />
              </button>
            )
          })}
          <div
            class={`ball ${ballVisible ? 'ball--visible' : ''}`}
            style={{ transform: `translateX(${ballX}px)` }}
          >
            <BallSvg />
          </div>
        </div>
      </div>

      <footer class="scene__footer">
        {phase === 'idle' || phase === 'result' ? (
          <button class="play-again" onClick={startRound}>
            {phase === 'idle' ? 'Begin' : 'Play again'}
          </button>
        ) : (
          <div class="scene__hint">
            {isReady ? 'Tap a cup to lift it.' : 'Keep your eye on the cups.'}
          </div>
        )}
      </footer>
    </div>
  )
}
