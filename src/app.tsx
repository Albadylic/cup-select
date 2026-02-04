import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import "./app.css";

type Phase =
  | "idle"
  | "placing"
  | "shuffling"
  | "ready"
  | "revealing"
  | "result";
const SLOT_X = [-160, 0, 160];
const REVEAL_DELAY_MS = 520;
const PLACEMENT_PAUSE_MS = 1400;
const STAKE_STEP = 5;
const HIGH_SCORE_KEY = "cupSelectHighScore";

const randomInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const buildShuffleSteps = (count: number): Array<[number, number]> => {
  const steps: Array<[number, number]> = [];
  while (steps.length < count) {
    const a = randomInt(0, 2);
    let b = randomInt(0, 2);
    while (b === a) b = randomInt(0, 2);
    steps.push([a, b]);
  }
  return steps;
};

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
    {highlight ? (
      <rect x="30" y="30" width="100" height="6" fill="#ffdca0" opacity="0.7" />
    ) : null}
  </svg>
);

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
);

export function App() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [cupSlots, setCupSlots] = useState([0, 1, 2]);
  const [ballCupId, setBallCupId] = useState(0);
  const [chosenCupId, setChosenCupId] = useState<number | null>(null);
  const [shuffleCount, setShuffleCount] = useState(0);
  const [liftOthers, setLiftOthers] = useState(false);
  const [ballX, setBallX] = useState(0);
  const [walletState, setWalletState] = useState({ wallet: 5, stake: 5 });
  const [round, setRound] = useState(1);
  const [highScore, setHighScore] = useState(0);
  const [showIntro, setShowIntro] = useState(true);
  const [roundResolved, setRoundResolved] = useState(false);
  const [showHighScoreToast, setShowHighScoreToast] = useState(false);
  const [toastKey, setToastKey] = useState(0);

  const timeouts = useRef<number[]>([]);

  const ballSlotIndex = cupSlots[ballCupId];

  const { wallet, stake } = walletState;
  const isReady = phase === "ready";
  const playerWon = chosenCupId !== null && chosenCupId === ballCupId;
  const showActionButton = phase === "idle" || phase === "result";
  const canIncreaseStake = wallet >= STAKE_STEP;
  const canDecreaseStake = stake > STAKE_STEP;
  const totalCoins = wallet + stake;
  const hasRequiredStake = stake >= STAKE_STEP;
  const gameOver = totalCoins < STAKE_STEP;
  const speedLevel = Math.floor((round - 1) / 3);
  const shuffleDuration = Math.max(400, 520 - speedLevel * 30);

  const clearTimers = () => {
    timeouts.current.forEach((id) => window.clearTimeout(id));
    timeouts.current = [];
  };

  const queueTimeout = (fn: () => void, delay: number) => {
    const id = window.setTimeout(fn, delay);
    timeouts.current.push(id);
  };

  const startRound = () => {
    clearTimers();
    setLiftOthers(false);
    setChosenCupId(null);
    setCupSlots([0, 1, 2]);
    setRoundResolved(false);
    setShowHighScoreToast(false);
    const nextBall = randomInt(0, 2);
    setBallCupId(nextBall);
    setBallX(SLOT_X[nextBall]);
    setPhase("placing");
    queueTimeout(() => {
      setPhase("shuffling");
    }, PLACEMENT_PAUSE_MS);
  };

  useEffect(() => {
    const savedScore = Number(window.localStorage.getItem(HIGH_SCORE_KEY) || 0);
    if (!Number.isNaN(savedScore)) setHighScore(savedScore);
    return () => clearTimers();
  }, []);

  useEffect(() => {
    if (phase !== "shuffling") return;
    const minShuffles = Math.min(8, 3 + Math.floor((round - 1) / 3));
    const maxShuffles = Math.max(minShuffles, 4 + round);
    const count = randomInt(minShuffles, maxShuffles);
    setShuffleCount(count);
    const steps = buildShuffleSteps(count);
    let stepIndex = 0;
    const runStep = () => {
      if (stepIndex >= steps.length) {
        setPhase("ready");
        return;
      }
      const [slotA, slotB] = steps[stepIndex];
      setCupSlots((prev) => {
        const next = [...prev];
        const cupA = next.findIndex((slot) => slot === slotA);
        const cupB = next.findIndex((slot) => slot === slotB);
        if (cupA !== -1) next[cupA] = slotB;
        if (cupB !== -1) next[cupB] = slotA;
        return next;
      });
      stepIndex += 1;
      queueTimeout(runStep, shuffleDuration);
    };
    queueTimeout(runStep, Math.max(160, Math.floor(shuffleDuration * 0.4)));
  }, [phase, shuffleDuration]);

  useEffect(() => {
    if (phase === "placing") return;
    setBallX(SLOT_X[ballSlotIndex]);
  }, [phase, ballSlotIndex]);

  useEffect(() => {
    if (phase !== "revealing") return;
    queueTimeout(() => setLiftOthers(true), REVEAL_DELAY_MS);
    queueTimeout(() => setPhase("result"), REVEAL_DELAY_MS + 520);
  }, [phase]);

  useEffect(() => {
    if (phase !== "result" || chosenCupId === null) return;
    if (roundResolved) return;
    setRoundResolved(true);
    if (playerWon) {
      const newWallet = wallet + stake * 2;
      if (newWallet > highScore) {
        window.localStorage.setItem(HIGH_SCORE_KEY, String(newWallet));
        setHighScore(newWallet);
        setShowHighScoreToast(true);
        setToastKey((prev) => prev + 1);
        queueTimeout(() => setShowHighScoreToast(false), 1500);
      }
      setWalletState(() => ({
        wallet: newWallet,
        stake: 0,
      }));
    } else {
      setWalletState((prev) => ({
        wallet: prev.wallet,
        stake: 0,
      }));
    }
  }, [phase, chosenCupId, playerWon, highScore, roundResolved, wallet, stake]);

  const handlePick = (cupId: number) => {
    if (!isReady) return;
    setChosenCupId(cupId);
    setPhase("revealing");
  };

  const increaseStake = () => {
    if (!canIncreaseStake) return;
    setWalletState((prev) => ({
      wallet: prev.wallet - STAKE_STEP,
      stake: prev.stake + STAKE_STEP,
    }));
  };

  const decreaseStake = () => {
    if (!canDecreaseStake) return;
    setWalletState((prev) => ({
      wallet: prev.wallet + STAKE_STEP,
      stake: prev.stake - STAKE_STEP,
    }));
  };

  const maxStake = () => {
    if (wallet === 0) return;
    setWalletState((prev) => ({
      wallet: 0,
      stake: prev.stake + prev.wallet,
    }));
  };

  const handleNextRound = () => {
    if (phase !== "idle" && phase !== "result") return;
    if (!hasRequiredStake) return;
    if (phase === "result") {
      setRound((prev) => prev + 1);
    }
    startRound();
  };

  const resetGame = () => {
    clearTimers();
    setWalletState({ wallet: 5, stake: 5 });
    setRound(1);
    setChosenCupId(null);
    setLiftOthers(false);
    setPhase("idle");
    setRoundResolved(false);
    setShowHighScoreToast(false);
  };

  const ballVisible =
    phase === "placing" || phase === "revealing" || phase === "result";

  const sceneSubtitle = useMemo(() => {
    if (phase === "idle") return "Ready when you are.";
    if (phase === "placing") return "The barkeep hides the ball...";
    if (phase === "shuffling") return `Shuffling... (${shuffleCount})`;
    if (phase === "ready") return "Pick a cup.";
    if (phase === "result") {
      if (playerWon) return "You found it!";
      return gameOver ? "You are out of coins." : "Wrong cup.";
    }
    return "Get ready.";
  }, [phase, shuffleCount, playerWon, gameOver]);

  return (
    <div class="scene">
      {showIntro ? (
        <div class="intro">
          <div class="intro__card">
            <p class="intro__eyebrow">How to Play</p>
            <h2 class="intro__title">Cup &amp; Coin</h2>
            <ul class="intro__list">
              <li>Stake at least 5 coins before each round.</li>
              <li>Watch the shuffle, then pick a cup.</li>
              <li>Win to earn double your stake. Lose and you forfeit it.</li>
              <li>Earn a new high score when your wallet grows.</li>
            </ul>
            <button class="play-again" onClick={() => setShowIntro(false)}>
              Start
            </button>
          </div>
        </div>
      ) : null}
      <header class="scene__header">
        <p class="scene__eyebrow">Tavern Trick</p>
        <h1 class="scene__title">Cup &amp; Coin</h1>
        <p class="scene__subtitle">{sceneSubtitle}</p>
        <div class="hud">
          <div class="hud__item">
            <span class="hud__label">Wallet</span>
            <span class="hud__value">{wallet}</span>
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

      <div
        class="table-zone"
        style={
          { "--shuffle-ms": `${shuffleDuration}ms` } as Record<string, string>
        }
      >
        {showHighScoreToast ? (
          <div key={toastKey} class="highscore-toast" role="status">
            <div class="toast-icon" aria-hidden="true">
              <svg viewBox="0 0 140 60" width="120" height="52">
                <g>
                  <rect
                    x="8"
                    y="18"
                    width="40"
                    height="28"
                    rx="6"
                    fill="#c68135"
                  />
                  <rect
                    x="14"
                    y="12"
                    width="28"
                    height="10"
                    rx="4"
                    fill="#f2d08b"
                  />
                  <rect
                    x="14"
                    y="8"
                    width="28"
                    height="6"
                    rx="3"
                    fill="#f7f0d6"
                  />
                  <circle cx="50" cy="30" r="8" fill="#c68135" />
                  <circle cx="50" cy="30" r="4" fill="#7b4d2a" />
                </g>
                <g>
                  <rect
                    x="86"
                    y="18"
                    width="40"
                    height="28"
                    rx="6"
                    fill="#c68135"
                  />
                  <rect
                    x="92"
                    y="12"
                    width="28"
                    height="10"
                    rx="4"
                    fill="#f2d08b"
                  />
                  <rect
                    x="92"
                    y="8"
                    width="28"
                    height="6"
                    rx="3"
                    fill="#f7f0d6"
                  />
                  <circle cx="84" cy="30" r="8" fill="#c68135" />
                  <circle cx="84" cy="30" r="4" fill="#7b4d2a" />
                </g>
                <circle cx="70" cy="6" r="4" fill="#f7f0d6" opacity="0.9" />
                <circle cx="78" cy="4" r="3" fill="#f7f0d6" opacity="0.7" />
                <circle cx="62" cy="4" r="3" fill="#f7f0d6" opacity="0.7" />
              </svg>
            </div>
            <div class="toast-text">New high score!</div>
          </div>
        ) : null}
        <div class="table">
          <div class="table__surface" />
          <div class="table__slots">
            {cupSlots.map((slotIndex, cupId) => {
              const lifted =
                (phase === "revealing" && chosenCupId === cupId) ||
                (liftOthers && chosenCupId !== cupId);
              const selectable = isReady;
              return (
                <button
                  key={cupId}
                  class={`cup ${lifted ? "cup--lifted" : ""} ${
                    selectable ? "cup--ready" : ""
                  }`}
                  style={
                    { "--cup-x": `${SLOT_X[slotIndex]}px` } as Record<
                      string,
                      string
                    >
                  }
                  onClick={() => handlePick(cupId)}
                  disabled={!selectable}
                  aria-label={`Cup ${cupId + 1}`}
                >
                  <CupSvg highlight={selectable} />
                </button>
              );
            })}
            <div
              class={`ball ${ballVisible ? "ball--visible" : ""}`}
              style={{ transform: `translateX(${ballX}px)` }}
            >
              <BallSvg />
            </div>
          </div>
        </div>
      </div>

      <footer class="scene__footer">
        {showActionButton ? (
          <div class="action-row">
            <button
              class="play-again"
              onClick={handleNextRound}
              disabled={!hasRequiredStake || gameOver}
            >
              {phase === "idle" ? "Begin" : "Play again"}
            </button>
            {!gameOver ? (
              <div class="stake-controls">
                <button
                  class="stake-button"
                  onClick={decreaseStake}
                  disabled={!canDecreaseStake}
                >
                  -{STAKE_STEP}
                </button>
                <div class="stake-value">{stake}</div>
                <button
                  class="stake-button"
                  onClick={increaseStake}
                  disabled={!canIncreaseStake}
                >
                  +{STAKE_STEP}
                </button>
                <button class="stake-button" onClick={maxStake}>
                  Max
                </button>
              </div>
            ) : null}
            {gameOver ? (
              <button class="bank-button" onClick={resetGame}>
                Reset
              </button>
            ) : null}
          </div>
        ) : (
          <div class="scene__hint">
            {isReady ? "Tap a cup to lift it." : "Keep your eye on the cups."}
          </div>
        )}
      </footer>
    </div>
  );
}
