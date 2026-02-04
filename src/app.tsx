import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import './app.css'

type Phase = 'idle' | 'placing' | 'shuffling' | 'ready' | 'revealing' | 'result'
type RoundResult = 'win' | 'lose' | null

const SLOT_X = [-160, 0, 160]
const REVEAL_DELAY_MS = 520
const STAKE_STEP = 5
const HIGH_SCORE_KEY = 'cupSelectHighScore'

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
  const [coins, setCoins] = useState(0)
  const [stake, setStake] = useState(0)
  const [round, setRound] = useState(1)
  const [highScore, setHighScore] = useState(0)
  const [lastResult, setLastResult] = useState<RoundResult>(null)
  const [bankedMessage, setBankedMessage] = useState('')

  const timeouts = useRef<number[]>([])

  const ballSlotIndex = cupSlots[ballCupId]

  const isReady = phase === 'ready'
  const playerWon = chosenCupId !== null && chosenCupId === ballCupId
  const canStake = lastResult === 'win' && coins >= STAKE_STEP
  const showActionButton = phase === 'idle' || phase === 'result'
  const showBank = lastResult === 'win' && phase === 'result'

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
    setBankedMessage('')
    setLiftOthers(false)
    setChosenCupId(null)
    setCupSlots([0, 1, 2])
    setLastResult(null)
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
    const savedScore = Number(window.localStorage.getItem(HIGH_SCORE_KEY) || 0)
    if (!Number.isNaN(savedScore)) setHighScore(savedScore)
    return () => clearTimers()
  }, [])

  useEffect(() => {
    if (phase !== 'shuffling') return
    const minShuffles = round <= 2 ? 3 : 4
    const maxShuffles = Math.min(12, 4 + round)
    const count = randomInt(minShuffles, maxShuffles)
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

  useEffect(() => {
    if (phase !== 'result' || chosenCupId === null) return
    if (playerWon) {
      setCoins((prev) => {
        const payout = prev === 0 || stake === 0 ? STAKE_STEP : stake
        return prev + payout
      })
      setLastResult('win')
    } else {
      setCoins(0)
      setStake(0)
      setLastResult('lose')
    }
  }, [phase, chosenCupId, playerWon, stake])

  const handlePick = (cupId: number) => {
    if (!isReady) return
    setChosenCupId(cupId)
    setPhase('revealing')
  }

  const handleBank = () => {
    if (!showBank) return
    if (coins > highScore) {
      window.localStorage.setItem(HIGH_SCORE_KEY, String(coins))
      setHighScore(coins)
      setBankedMessage('Banked!')
      queueTimeout(() => setBankedMessage(''), 1400)
    } else {
      setBankedMessage('No new high score')
      queueTimeout(() => setBankedMessage(''), 1400)
    }
  }

  const adjustStake = (delta: number) => {
    if (!canStake) return
    setStake((prev) => {
      const next = Math.max(0, Math.min(coins, prev + delta))
      return Math.floor(next / STAKE_STEP) * STAKE_STEP
    })
  }

  const maxStake = () => {
    if (!canStake) return
    setStake(Math.floor(coins / STAKE_STEP) * STAKE_STEP)
  }

  const handleNextRound = () => {
    if (phase !== 'idle' && phase !== 'result') return
    if (phase === 'result') {
      setRound((prev) => prev + 1)
    }
    startRound()
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
        <div class="hud">
          <div class="hud__item">
            <span class="hud__label">Coins</span>
            <span class="hud__value">{coins}</span>
          </div>
          <div class="hud__item">
            <span class="hud__label">Stake</span>
            <span class="hud__value">{stake}</span>
          </div>
          <div class="hud__item">
            <span class="hud__label">High</span>
            <span class="hud__value">{highScore}</span>
          </div>
          <div class="hud__item">
            <span class="hud__label">Round</span>
            <span class="hud__value">{round}</span>
          </div>
        </div>
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
        {showActionButton ? (
          <div class="action-row">
            <button class="play-again" onClick={handleNextRound}>
              {phase === 'idle' ? 'Begin' : 'Play again'}
            </button>
            {showBank ? (
              <button class="bank-button" onClick={handleBank}>
                Bank
              </button>
            ) : null}
            {bankedMessage ? (
              <div class="banked-confirm" role="status">
                {bankedMessage}
              </div>
            ) : null}
            {showBank && canStake ? (
              <div class="stake-controls">
                <button
                  class="stake-button"
                  onClick={() => adjustStake(-STAKE_STEP)}
                >
                  -{STAKE_STEP}
                </button>
                <div class="stake-value">{stake}</div>
                <button
                  class="stake-button"
                  onClick={() => adjustStake(STAKE_STEP)}
                >
                  +{STAKE_STEP}
                </button>
                <button class="stake-button" onClick={maxStake}>
                  Max
                </button>
              </div>
            ) : null}
          </div>
        ) : (
          <div class="scene__hint">
            {isReady ? 'Tap a cup to lift it.' : 'Keep your eye on the cups.'}
          </div>
        )}
      </footer>
    </div>
  )
}
