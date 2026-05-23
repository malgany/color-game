import {
  createChallenge,
  loadChallenge,
  loadChallengeScores,
  loadCategories,
  loadLeaderboard,
  loadPrompts,
  saveChallengeScoreDraft,
  saveScore,
  updateChallengeScoreName,
  type ChallengeEntry,
  type ChallengeScoreDraft,
  type ChallengeScoreEntry,
  type Difficulty,
  type LeaderboardEntry,
  type PromptItem,
  type ScoreRound,
} from "./data";
import {
  type HsbColor,
  hsbCss,
  hsbToRgb,
  readableSoftTextColor,
  readableTextColor,
  rgbCss,
  scoreHsb,
} from "./colorMath";
import "./styles.css";

type Screen =
  | "intro"
  | "category"
  | "multiplayer"
  | "picker"
  | "result"
  | "total"
  | "leaderboard";

type RoundResult = {
  prompt: PromptItem;
  picked: HsbColor;
  score: number;
};

type SharedChallenge = {
  code: string;
  name: string;
  score: number | null;
  difficulty: Difficulty;
  prompts: PromptItem[];
  isLocal?: boolean;
};

type ShareResult = {
  status: "native" | "copy" | "ready" | "failed";
  url?: string;
};

type LocalChallengePayload = {
  v: 1;
  name: string;
  score: number | null;
  difficulty: Difficulty;
  prompts: PromptItem[];
};

type CompareDragState = {
  pointerId: number;
  rect: DOMRect;
} | null;

type CategoryDragState = {
  pointerId: number;
  startX: number;
  startScrollLeft: number;
  dragged: boolean;
} | null;

const ROUND_COUNT = 5;
const STORAGE_THEME = "color_game_theme";
const STORAGE_MUTED = "color_game_muted";
const STORAGE_CATEGORY = "color_game_category";
const STORAGE_PLAYER_NAME = "color_game_player_name";
const DEFAULT_DIFFICULTY: Difficulty = "easy";
const ALL_CATEGORY_LABEL = "All categories";
const COUNTDOWN_STEPS = ["Ready", "Set", "Go"];
const IMAGE_PRELOAD_TIMEOUT_MS = 15000;
const CATEGORY_START_DELAY_MS = 220;

const icons = {
  target:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/></svg>',
  leaderboard:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v4a5 5 0 0 1-10 0V4Z"/><path d="M7 7H4v1a3 3 0 0 0 3 3"/><path d="M17 7h3v1a3 3 0 0 1-3 3"/></svg>',
  restart:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 2.34-5.66"/><path d="M4 4v6h6"/></svg>',
  volumeOn:
    '<svg class="vol-on" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M19.2478 4.75181C21.1027 6.6067 22.25 9.1692 22.25 11.9997C22.25 14.8301 21.1027 17.3926 19.2478 19.2475M15.8891 8.11119C16.8844 9.10649 17.5 10.4815 17.5 12.0003C17.5 13.5191 16.8844 14.8941 15.8891 15.8894M3.75 7.74986H5.35491C5.77433 7.74986 6.18314 7.618 6.52352 7.37293L11.4578 3.82021C11.7886 3.58208 12.25 3.81843 12.25 4.22598V19.7738C12.25 20.1813 11.7886 20.4177 11.4578 20.1795L6.52352 16.6268C6.18314 16.3817 5.77433 16.2499 5.35491 16.2499H3.75C2.64543 16.2499 1.75 15.3545 1.75 14.2499V9.74987C1.75 8.6453 2.64543 7.74986 3.75 7.74986Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  volumeOff:
    '<svg class="vol-off" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path fill-rule="evenodd" clip-rule="evenodd" d="M17 5.93934V4.22585C17 3.20697 15.8465 2.6161 15.0196 3.21143L10.0853 6.76415C9.87255 6.91732 9.61705 6.99973 9.35491 6.99973H7.75C6.23122 6.99973 5 8.23095 5 9.74973V14.2497C5 15.25 5.53405 16.1255 6.33257 16.6068L3.21967 19.7197C2.92678 20.0126 2.92678 20.4874 3.21967 20.7803C3.51256 21.0732 3.98744 21.0732 4.28033 20.7803L20.7803 4.28033C21.0732 3.98744 21.0732 3.51256 20.7803 3.21967C20.4874 2.92678 20.0126 2.92678 19.7197 3.21967L17 5.93934ZM7.47089 15.4685C6.91489 15.3416 6.5 14.8441 6.5 14.2497V9.74973C6.5 9.05938 7.05964 8.49973 7.75 8.49973H9.35491C9.93161 8.49973 10.4937 8.31842 10.9617 7.98145L15.5 4.71391V7.43934L7.47089 15.4685Z" fill="currentColor"/><path d="M15.5003 19.2857L11.0785 16.102L10.001 17.1795C10.0298 17.197 10.0581 17.2156 10.0856 17.2354L15.0199 20.7881C15.8468 21.3835 17.0003 20.7926 17.0003 19.7737V10.1802L15.5003 11.6802V19.2857Z" fill="currentColor"/></svg>',
  sun:
    '<svg class="icon-sun" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M11.9982 3.29083V1.76758M5.83985 18.1586L4.76275 19.2357M11.9982 22.2327V20.7094M19.2334 4.76468L18.1562 5.84179M20.707 12.0001H22.2303M18.1562 18.1586L19.2334 19.2357M1.76562 12.0001H3.28888M4.76267 4.76462L5.83977 5.84173M15.7104 8.28781C17.7606 10.3381 17.7606 13.6622 15.7104 15.7124C13.6601 17.7627 10.336 17.7627 8.28574 15.7124C6.23548 13.6622 6.23548 10.3381 8.28574 8.28781C10.336 6.23756 13.6601 6.23756 15.7104 8.28781Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  moon:
    '<svg class="icon-moon" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M21.2481 11.8112C20.1889 12.56 18.8958 13 17.5 13C13.9101 13 11 10.0899 11 6.5C11 5.10416 11.44 3.81108 12.1888 2.75189C12.126 2.75063 12.0631 2.75 12 2.75C6.89137 2.75 2.75 6.89137 2.75 12C2.75 17.1086 6.89137 21.25 12 21.25C17.1086 21.25 21.25 17.1086 21.25 12C21.25 11.9369 21.2494 11.874 21.2481 11.8112Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  arrow:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14"/><path d="M13 6l6 6-6 6"/></svg>',
};

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Missing #app root");

let screen: Screen = "intro";
let returnFromLeaderboard: Screen = "intro";
let queue: PromptItem[] = [];
let roundIndex = 0;
let pickerHsb: HsbColor = [180, 80, 90];
let results: RoundResult[] = [];
let theme = readTheme();
let muted = localStorage.getItem(STORAGE_MUTED) === "1";
let activeChallenge: SharedChallenge | null = null;
let pendingChallengeCode = readChallengeCode();
let pendingLocalChallenge = readLocalChallenge();
let challengeScores: ChallengeScoreEntry[] = [];
let selectedDifficulty: Difficulty = DEFAULT_DIFFICULTY;
let selectedCategory = localStorage.getItem(STORAGE_CATEGORY) || "all";
let leaderboardCategory = ALL_CATEGORY_LABEL;
let pickerValueHideTimer: number | undefined;
let availableCategories: string[] = [];
let compareDragState: CompareDragState = null;
let categoryDragState: CategoryDragState = null;
let suppressCategoryClick = false;
let categorySelectionPending = false;
let finalScorePosted = false;
let baseScorePosted = false;
let challengeScoreDraft: ChallengeScoreDraft | null = null;
let challengeScoreDraftPromise: Promise<ChallengeScoreDraft | null> | null = null;
let challengeScoreDraftRunId = 0;
let lastChallengeShareUrl: string | undefined;
let countdownInProgress = false;
let pickerHasSelection = false;
const imagePreloadCache = new Map<string, Promise<void>>();

class Sfx {
  private ctx: AudioContext | null = null;
  private lastSliderAt = 0;

  constructor(private isMuted: () => boolean) {}

  unlock(): void {
    if (this.isMuted()) return;
    const ctx = this.context();
    if (ctx?.state === "suspended") void ctx.resume();
  }

  hover(): void {
    this.tone(520, 0.045, "sine", 0.018);
  }

  iconHover(): void {
    this.tone(1200, 0.025, "square", 0.032);
  }

  click(): void {
    this.tone(190, 0.035, "triangle", 0.025);
    window.setTimeout(() => this.tone(330, 0.045, "sine", 0.018), 24);
  }

  submit(): void {
    this.tone(620, 0.06, "sine", 0.028);
    window.setTimeout(() => this.tone(980, 0.08, "triangle", 0.02), 55);
  }

  slider(): void {
    const now = performance.now();
    if (now - this.lastSliderAt < 34) return;
    this.lastSliderAt = now;
    this.tone(1800 + pickerHsb[0] * 4, 0.018, "sine", 0.012);
  }

  scoreRise(progress: number): void {
    const eased = Math.min(1, Math.max(0, progress));
    this.tone(180 + eased * 980, 0.055, "sine", 0.014 + eased * 0.014);
  }

  scoreLand(): void {
    this.tone(250, 0.06, "triangle", 0.026);
    window.setTimeout(() => this.tone(640, 0.09, "sine", 0.023), 70);
  }

  countdown(step: number): void {
    const notes = [330, 440, 660];
    const note = notes[Math.min(step, notes.length - 1)];
    this.tone(note, 0.09, "sine", 0.035);
    if (step === notes.length - 1) {
      window.setTimeout(() => this.tone(990, 0.12, "triangle", 0.024), 70);
    }
  }

  toDark(): void {
    this.tone(440, 0.12, "sine", 0.1);
    window.setTimeout(() => this.tone(330, 0.15, "sine", 0.08), 80);
    window.setTimeout(() => this.tone(220, 0.2, "sine", 0.06), 160);
  }

  toLight(): void {
    this.tone(330, 0.12, "sine", 0.08);
    window.setTimeout(() => this.tone(523, 0.12, "sine", 0.1), 80);
    window.setTimeout(() => this.tone(660, 0.15, "sine", 0.1), 160);
  }

  private context(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const AudioCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioCtor) return null;
    this.ctx = new AudioCtor();
    return this.ctx;
  }

  private tone(
    frequency: number,
    duration: number,
    type: OscillatorType,
    gainValue: number,
  ): void {
    if (this.isMuted()) return;
    const ctx = this.context();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const now = ctx.currentTime;

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(gainValue, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }
}

const sfx = new Sfx(() => muted);
const debugToolsEnabled =
  import.meta.env.DEV && import.meta.env.VITE_DEBUG_TOOLS === "true";

app.innerHTML = `
  <header class="site-bar">
    <a class="brand-link soundable" href="#" aria-label="Color Game home">Color Game</a>
    <nav class="game-nav" aria-label="Game navigation">
      <a class="nav-link active soundable" href="#">color</a>
    </nav>
    <div class="top-actions">
      <button id="muteToggle" class="icon-button soundable" type="button"></button>
      <button id="themeToggle" class="icon-button soundable" type="button"></button>
    </div>
  </header>

  <main class="page-shell">
    <div id="gameCard" class="game-card">
      <section id="introScreen" class="screen intro-screen active" aria-label="Intro">
        <button id="leaderboardGhost" class="ghost-orbit soundable" type="button" aria-label="Open high scores">
          ${icons.leaderboard}
        </button>
        <h1>color</h1>
        <div class="intro-copy">
          <p>Pick the missing color from memory. The transparent part of the image reveals whatever you choose.</p>
          <p>Five images. Ten points each. Get as close as your brain can manage.</p>
          <strong>Ready?</strong>
        </div>
        <div id="challengeIntroBoard" class="challenge-board intro-challenge-board" hidden></div>
        <div class="intro-actions">
          <button id="startButton" class="mode-button soundable" type="button" aria-label="Start game">
            ${icons.target}
          </button>
          <button id="multiplayerButton" class="intro-text-button soundable" type="button">Multiplayer</button>
        </div>
      </section>

      <section id="categoryScreen" class="screen category-screen" aria-label="Category selection">
        <button id="categoryBack" class="mini-close soundable" type="button" aria-label="Back to intro">Close</button>
        <h2>category</h2>
        <p>Pick a set of images for this run.</p>
        <div id="categoryList" class="category-choice-list"></div>
      </section>

      <section id="multiplayerScreen" class="screen multiplayer-screen" aria-label="Multiplayer setup">
        <button id="multiplayerBack" class="mini-close soundable" type="button" aria-label="Back to intro">Close</button>
        <h2>multiplayer</h2>
        <p>Create a challenge link first. Everyone who opens it plays the same five images and lands on the same board.</p>
        <form id="multiplayerForm" class="multiplayer-form">
          <input id="multiplayerNameInput" maxlength="4" autocomplete="nickname" placeholder="Name" aria-label="Name" autocapitalize="characters" spellcheck="false" />
          <button id="createMultiplayerButton" class="score-submit soundable" type="submit">Create and copy game link</button>
        </form>
        <p id="multiplayerStatus" class="score-save-status"></p>
        <div id="multiplayerLinkOutput" class="challenge-link-output" hidden></div>
      </section>

      <section id="pickerScreen" class="screen picker-screen" aria-label="Color picker">
        <div id="pickerBg" class="picker-bg"></div>
        <div class="picker-meta">
          <span id="pickerRound">1/5</span>
          <span id="pickerDifficulty"></span>
        </div>
        <div class="strip-container" aria-label="Color controls">
          <div id="hStrip" class="strip" data-channel="h" aria-label="Hue control">
            <div id="hHandle" class="strip-handle"></div>
          </div>
          <div id="sStrip" class="strip" data-channel="s" aria-label="Saturation control">
            <div id="sHandle" class="strip-handle"></div>
          </div>
          <div id="bStrip" class="strip" data-channel="b" aria-label="Brightness control">
            <div id="bHandle" class="strip-handle"></div>
          </div>
        </div>
        <div class="art-stage">
          <img id="pickerImage" class="prompt-image" alt="" draggable="false" />
        </div>
        <div class="picker-values">
          <span id="pickerValueLabel">Hue</span>
          <strong id="pickerValues">H180 S80 B90</strong>
        </div>
        <button id="submitButton" class="go-button soundable" type="button" aria-label="Submit color">
          ${icons.target}
        </button>
      </section>

      <section id="resultScreen" class="screen result-screen" aria-label="Round result">
        <button id="resultClose" class="mini-close soundable" type="button" aria-label="Back to intro">Close</button>
        <span id="resultRound" class="result-round">1/5</span>
        <div class="score-display">
          <span id="roundScoreMain">0</span><span class="score-dot">.</span><span id="roundScoreDecimal">00</span>
        </div>
        <p id="scoreMessage" class="score-message">Close enough to keep playing.</p>
        <div id="comparisonGrid" class="comparison-grid">
          <div id="comparePicked" class="comparison-card">
            <div id="pickedPreview" class="mini-preview">
              <img id="pickedImage" class="prompt-image" alt="" draggable="false" />
            </div>
            <div class="result-caption">
              <span>Your selection</span>
              <strong id="pickedCode">H180 S80 B90</strong>
            </div>
          </div>
          <div id="compareTarget" class="comparison-card">
            <div id="targetPreview" class="mini-preview">
              <img id="targetImage" class="prompt-image" alt="" draggable="false" />
            </div>
            <div class="result-caption">
              <span>Original</span>
              <strong id="targetCode">H180 S80 B90</strong>
            </div>
          </div>
          <button id="compareDivider" class="compare-divider" type="button" aria-label="Compare selected color and original">
            <span class="compare-label compare-label-left">Your selection</span>
            <span class="compare-label compare-label-right">Original</span>
          </button>
          <div class="compare-code compare-code-left">
            <strong id="pickedCodeDesktop">H180 S80 B90</strong>
          </div>
          <div class="compare-code compare-code-right">
            <strong id="targetCodeDesktop">H180 S80 B90</strong>
          </div>
        </div>
        <button id="nextButton" class="go-button result-go soundable" type="button" aria-label="Next round">
          ${icons.arrow}
        </button>
      </section>

      <section id="totalScreen" class="screen total-screen" aria-label="Final score">
        <button id="totalClose" class="total-close soundable" type="button" aria-label="Back to intro">Close</button>
        <div class="total-header">
          <div>
            <h2>total</h2>
            <p id="totalMessage">Five colors, one score.</p>
          </div>
          <div class="total-score">
            <span id="totalScore">0.00</span><span>/50</span>
          </div>
        </div>
        <div id="totalPalette" class="total-palette" aria-label="Round color comparisons"></div>
        <div id="challengeResult" class="challenge-result" hidden></div>
        <div id="challengeBoard" class="challenge-board total-challenge-board" hidden></div>
        <p id="scoreSaveStatus" class="score-save-status"></p>
        <div id="challengeLinkOutput" class="challenge-link-output" hidden></div>
        <form id="scoreForm" class="score-form">
          <input id="playerNameInput" maxlength="4" autocomplete="nickname" placeholder="Name" aria-label="Name" autocapitalize="characters" spellcheck="false" />
          <button id="saveScoreButton" class="score-submit soundable" type="submit">Post score & challenge a friend</button>
        </form>
      </section>

      <section id="leaderboardScreen" class="screen leaderboard-screen" aria-label="High scores">
        <button id="leaderboardClose" class="mini-close soundable" type="button" aria-label="Close high scores">Close</button>
        <h2>high scores</h2>
        <div id="leaderboardTabs" class="difficulty-tabs leaderboard-tabs" role="tablist" aria-label="Leaderboard category"></div>
        <div id="leaderboardList" class="leaderboard-list" aria-live="polite"></div>
        <button id="leaderboardRefresh" class="mini-action soundable" type="button">Refresh</button>
      </section>
      <div id="countdownOverlay" class="countdown-overlay" aria-live="assertive" aria-hidden="true" hidden>
        <span id="countdownText">Ready</span>
      </div>
    </div>
  </main>

  <footer class="footer-links is-hidden" aria-label="Footer links" aria-hidden="true">
    <a class="soundable" href="#">Discord</a>
    <span>-</span>
    <a class="soundable" href="#">Press</a>
    <span>-</span>
    <a class="soundable" href="#">Privacy</a>
    <span>-</span>
    <a class="soundable" href="#">Scoring</a>
    <span>-</span>
    <a class="soundable" href="#">Socials</a>
  </footer>
`;

const refs = {
  gameCard: getEl<HTMLDivElement>("gameCard"),
  introScreen: getEl<HTMLElement>("introScreen"),
  categoryScreen: getEl<HTMLElement>("categoryScreen"),
  multiplayerScreen: getEl<HTMLElement>("multiplayerScreen"),
  pickerScreen: getEl<HTMLElement>("pickerScreen"),
  resultScreen: getEl<HTMLElement>("resultScreen"),
  totalScreen: getEl<HTMLElement>("totalScreen"),
  totalClose: getEl<HTMLButtonElement>("totalClose"),
  totalPalette: getEl<HTMLDivElement>("totalPalette"),
  challengeResult: getEl<HTMLDivElement>("challengeResult"),
  challengeBoard: getEl<HTMLDivElement>("challengeBoard"),
  leaderboardScreen: getEl<HTMLElement>("leaderboardScreen"),
  startButton: getEl<HTMLButtonElement>("startButton"),
  multiplayerButton: getEl<HTMLButtonElement>("multiplayerButton"),
  challengeIntroBoard: getEl<HTMLDivElement>("challengeIntroBoard"),
  countdownOverlay: getEl<HTMLDivElement>("countdownOverlay"),
  countdownText: getEl<HTMLSpanElement>("countdownText"),
  categoryBack: getEl<HTMLButtonElement>("categoryBack"),
  categoryList: getEl<HTMLDivElement>("categoryList"),
  multiplayerBack: getEl<HTMLButtonElement>("multiplayerBack"),
  multiplayerForm: getEl<HTMLFormElement>("multiplayerForm"),
  multiplayerNameInput: getEl<HTMLInputElement>("multiplayerNameInput"),
  createMultiplayerButton: getEl<HTMLButtonElement>("createMultiplayerButton"),
  multiplayerStatus: getEl<HTMLParagraphElement>("multiplayerStatus"),
  multiplayerLinkOutput: getEl<HTMLDivElement>("multiplayerLinkOutput"),
  leaderboardGhost: getEl<HTMLButtonElement>("leaderboardGhost"),
  muteToggle: getEl<HTMLButtonElement>("muteToggle"),
  themeToggle: getEl<HTMLButtonElement>("themeToggle"),
  pickerBg: getEl<HTMLDivElement>("pickerBg"),
  pickerRound: getEl<HTMLSpanElement>("pickerRound"),
  pickerDifficulty: getEl<HTMLSpanElement>("pickerDifficulty"),
  pickerImage: getEl<HTMLImageElement>("pickerImage"),
  pickerValueLabel: getEl<HTMLElement>("pickerValueLabel"),
  pickerValues: getEl<HTMLElement>("pickerValues"),
  hStrip: getEl<HTMLDivElement>("hStrip"),
  sStrip: getEl<HTMLDivElement>("sStrip"),
  bStrip: getEl<HTMLDivElement>("bStrip"),
  hHandle: getEl<HTMLDivElement>("hHandle"),
  sHandle: getEl<HTMLDivElement>("sHandle"),
  bHandle: getEl<HTMLDivElement>("bHandle"),
  submitButton: getEl<HTMLButtonElement>("submitButton"),
  resultClose: getEl<HTMLButtonElement>("resultClose"),
  resultRound: getEl<HTMLSpanElement>("resultRound"),
  roundScoreMain: getEl<HTMLSpanElement>("roundScoreMain"),
  roundScoreDecimal: getEl<HTMLSpanElement>("roundScoreDecimal"),
  scoreMessage: getEl<HTMLParagraphElement>("scoreMessage"),
  pickedPreview: getEl<HTMLDivElement>("pickedPreview"),
  targetPreview: getEl<HTMLDivElement>("targetPreview"),
  comparisonGrid: getEl<HTMLDivElement>("comparisonGrid"),
  comparePicked: getEl<HTMLDivElement>("comparePicked"),
  compareTarget: getEl<HTMLDivElement>("compareTarget"),
  compareDivider: getEl<HTMLButtonElement>("compareDivider"),
  pickedImage: getEl<HTMLImageElement>("pickedImage"),
  targetImage: getEl<HTMLImageElement>("targetImage"),
  pickedCode: getEl<HTMLElement>("pickedCode"),
  targetCode: getEl<HTMLElement>("targetCode"),
  pickedCodeDesktop: getEl<HTMLElement>("pickedCodeDesktop"),
  targetCodeDesktop: getEl<HTMLElement>("targetCodeDesktop"),
  nextButton: getEl<HTMLButtonElement>("nextButton"),
  totalScore: getEl<HTMLSpanElement>("totalScore"),
  totalMessage: getEl<HTMLParagraphElement>("totalMessage"),
  scoreForm: getEl<HTMLFormElement>("scoreForm"),
  playerNameInput: getEl<HTMLInputElement>("playerNameInput"),
  saveScoreButton: getEl<HTMLButtonElement>("saveScoreButton"),
  scoreSaveStatus: getEl<HTMLParagraphElement>("scoreSaveStatus"),
  challengeLinkOutput: getEl<HTMLDivElement>("challengeLinkOutput"),
  leaderboardClose: getEl<HTMLButtonElement>("leaderboardClose"),
  leaderboardTabs: getEl<HTMLDivElement>("leaderboardTabs"),
  leaderboardList: getEl<HTMLDivElement>("leaderboardList"),
  leaderboardRefresh: getEl<HTMLButtonElement>("leaderboardRefresh"),
};

applyTheme();
updateMuteButton();
syncViewportHeight();
buildHueGradient();
updateRunUi();
bindEvents();
void refreshCategoryOptions();
applyChallengeIntro();
void loadPendingChallenge();
registerServiceWorker();
if (debugToolsEnabled) {
  void import("./debugColorRemover").then(({ initDebugColorRemover }) => {
    initDebugColorRemover();
  });
}
show("intro");

function bindEvents(): void {
  document.addEventListener("pointerdown", () => sfx.unlock(), { once: true });

  refs.startButton.addEventListener("click", () => {
    sfx.click();
    if (activeChallenge) {
      requestMobileFullscreen();
      void startGame();
    } else openCategorySelection();
  });
  refs.multiplayerButton.addEventListener("mouseenter", () => {
    sfx.hover();
  });
  refs.categoryList.addEventListener("pointerdown", handleCategoryPointerDown);
  refs.categoryList.addEventListener("pointermove", handleCategoryPointerMove);
  refs.categoryList.addEventListener("pointerup", handleCategoryPointerEnd);
  refs.categoryList.addEventListener("pointercancel", handleCategoryPointerEnd);
  refs.categoryBack.addEventListener("click", () => {
    sfx.click();
    show("intro");
  });
  refs.multiplayerButton.addEventListener("click", () => {
    sfx.click();
    openMultiplayerSetup();
  });
  refs.multiplayerBack.addEventListener("click", () => {
    sfx.click();
    show("intro");
  });
  refs.multiplayerForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitMultiplayerSetup();
  });
  refs.createMultiplayerButton.addEventListener("click", (event) => {
    event.preventDefault();
    void submitMultiplayerSetup();
  });
  refs.multiplayerNameInput.addEventListener("input", () => {
    refs.multiplayerNameInput.value = formatPlayerName(
      refs.multiplayerNameInput.value,
    );
  });
  refs.leaderboardGhost.addEventListener("click", () => {
    sfx.click();
    openLeaderboard(scoreCategoryLabel(), screen);
  });
  refs.submitButton.addEventListener("click", submitRound);
  refs.nextButton.addEventListener("click", () => {
    void nextRound();
  });
  refs.totalClose.addEventListener("click", () => {
    sfx.click();
    show("intro");
  });
  refs.leaderboardClose.addEventListener("click", () => {
    sfx.click();
    show(returnFromLeaderboard);
  });
  refs.leaderboardRefresh.addEventListener("click", () => {
    sfx.click();
    void refreshLeaderboard();
  });
  refs.scoreForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void submitFinalScore();
  });
  refs.playerNameInput.addEventListener("input", () => {
    refs.playerNameInput.value = formatPlayerName(refs.playerNameInput.value);
  });
  refs.resultClose.addEventListener("click", () => {
    sfx.click();
    show("intro");
  });
  refs.muteToggle.addEventListener("click", toggleMute);
  refs.themeToggle.addEventListener("click", toggleTheme);
  bindCompareDivider();
  window.addEventListener("resize", () => {
    syncViewportHeight();
    buildHueGradient();
    updatePickerUi();
    setComparePosition(50);
  });
  window.visualViewport?.addEventListener("resize", syncViewportHeight);
  window.visualViewport?.addEventListener("scroll", syncViewportHeight);
  window.addEventListener("color-game:prompts-updated", () => {
    void refreshCategoryOptions();
  });
  refs.muteToggle.addEventListener("mouseenter", () => sfx.iconHover());
  refs.themeToggle.addEventListener("mouseenter", () => sfx.iconHover());

  bindStrip(refs.hStrip, "h");
  bindStrip(refs.sStrip, "s");
  bindStrip(refs.bStrip, "b");

  document.querySelectorAll<HTMLElement>(".soundable").forEach((element) => {
    if (element === refs.muteToggle || element === refs.themeToggle) return;
    element.addEventListener("mouseenter", () => sfx.hover());
  });
  document.querySelectorAll<HTMLAnchorElement>('a[href="#"]').forEach((link) => {
    link.addEventListener("click", (event) => event.preventDefault());
  });
}

async function startGame(): Promise<void> {
  refs.startButton.disabled = true;
  refs.startButton.setAttribute("aria-busy", "true");

  if (activeChallenge) {
    selectedDifficulty = DEFAULT_DIFFICULTY;
    updateRunUi();
    queue = activeChallenge.prompts.slice(0, ROUND_COUNT);
  } else {
    queue = await buildRoundQueue();
  }
  preloadPromptImages(queue);
  roundIndex = 0;
  results = [];

  refs.startButton.disabled = false;
  refs.startButton.removeAttribute("aria-busy");
  await showPickerWithCountdown();
}

async function buildRoundQueue(): Promise<PromptItem[]> {
  const prompts = await loadPrompts(DEFAULT_DIFFICULTY);
  const categoryPrompts =
    selectedCategory === "all"
      ? prompts
      : prompts.filter((prompt) => prompt.category === selectedCategory);
  return shuffle(categoryPrompts.length ? categoryPrompts : prompts).slice(
    0,
    ROUND_COUNT,
  );
}

async function showPickerWithCountdown(): Promise<void> {
  if (countdownInProgress) return;
  countdownInProgress = true;
  refs.submitButton.disabled = true;
  refs.nextButton.disabled = true;

  const prompt = currentPrompt();
  clearPickerImage();
  const currentImageReady = preloadPromptImage(prompt);
  preloadUpcomingImages(roundIndex + 1);

  showCountdownOverlay();
  await Promise.all([
    runCountdownSteps(),
    waitForImagePreload(currentImageReady, IMAGE_PRELOAD_TIMEOUT_MS),
  ]);
  showPicker();
  await hideCountdownOverlay();

  refs.submitButton.disabled = false;
  refs.nextButton.disabled = false;
  countdownInProgress = false;
}

function showCountdownOverlay(): void {
  refs.countdownOverlay.hidden = false;
  refs.countdownOverlay.setAttribute("aria-hidden", "false");
  refs.countdownOverlay.classList.add("active");
}

async function runCountdownSteps(): Promise<void> {
  for (const [index, step] of COUNTDOWN_STEPS.entries()) {
    refs.countdownText.textContent = step;
    refs.countdownOverlay.dataset.step = String(index);
    refs.countdownOverlay.classList.remove("tick");
    void refs.countdownOverlay.offsetWidth;
    refs.countdownOverlay.classList.add("tick");
    sfx.countdown(index);
    await wait(520);
  }
}

async function hideCountdownOverlay(): Promise<void> {
  refs.countdownOverlay.classList.remove("active", "tick");
  refs.countdownOverlay.setAttribute("aria-hidden", "true");
  await wait(120);
  refs.countdownOverlay.hidden = true;
  refs.countdownOverlay.removeAttribute("data-step");
}

function clearPickerImage(): void {
  refs.pickerImage.removeAttribute("src");
  refs.pickerImage.alt = "";
}

function preloadPromptImages(prompts: PromptItem[]): void {
  prompts.forEach((prompt) => {
    void preloadPromptImage(prompt);
  });
}

function preloadUpcomingImages(startIndex: number): void {
  preloadPromptImages(queue.slice(startIndex));
}

function preloadPromptImage(prompt: PromptItem): Promise<void> {
  const cached = imagePreloadCache.get(prompt.imageSrc);
  if (cached) return cached;

  const preload = new Promise<void>((resolve) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => {
      const decoded = image.decode?.();
      if (decoded) void decoded.then(resolve, resolve);
      else resolve();
    };
    image.onerror = () => resolve();
    image.src = prompt.imageSrc;
  });

  imagePreloadCache.set(prompt.imageSrc, preload);
  return preload;
}

function waitForImagePreload(
  preload: Promise<void>,
  timeoutMs: number,
): Promise<void> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve();
    };

    const timeoutId = window.setTimeout(finish, timeoutMs);
    void preload.then(
      () => {
        window.clearTimeout(timeoutId);
        finish();
      },
      () => {
        window.clearTimeout(timeoutId);
        finish();
      },
    );
  });
}

function showPicker(): void {
  const prompt = currentPrompt();
  pickerHsb = randomPickerDefault(prompt.targetHsb[0]);
  pickerHasSelection = false;
  refs.pickerRound.textContent = `${roundIndex + 1}/${queue.length}`;
  refs.pickerDifficulty.textContent = activeChallenge ? "Challenge" : scoreCategoryLabel();
  refs.pickerImage.src = prompt.imageSrc;
  refs.pickerImage.alt = `${prompt.name} transparent color prompt`;
  refs.pickerValueLabel.textContent = "";
  refs.pickerValues.textContent = "";
  refs.pickerValues.parentElement?.classList.remove("active");
  updatePickerUi();
  show("picker");
}

function submitRound(): void {
  if (countdownInProgress) return;
  if (!pickerHasSelection) {
    pickerHasSelection = true;
    updatePickerUi();
  }
  const prompt = currentPrompt();
  const picked: HsbColor = [...pickerHsb];
  const score = scoreHsb(picked, prompt.targetHsb);
  results.push({ prompt, picked, score });
  sfx.submit();
  showResult(prompt, picked, score);
}

function showResult(prompt: PromptItem, picked: HsbColor, score: number): void {
  refs.resultRound.textContent = `${roundIndex + 1}/${queue.length}`;
  refs.pickedPreview.style.background = hsbCss(picked);
  refs.targetPreview.style.background = hsbCss(prompt.targetHsb);
  refs.pickedImage.src = prompt.imageSrc;
  refs.targetImage.src = prompt.imageSrc;
  refs.pickedImage.alt = `${prompt.name} with your selected color`;
  refs.targetImage.alt = `${prompt.name} with original color`;
  refs.pickedCode.textContent = hsbCode(picked);
  refs.targetCode.textContent = hsbCode(prompt.targetHsb);
  refs.pickedCodeDesktop.textContent = hsbCode(picked);
  refs.targetCodeDesktop.textContent = hsbCode(prompt.targetHsb);
  setComparePosition(50);
  refs.scoreMessage.textContent = scoreMessage(score);
  refs.nextButton.setAttribute(
    "aria-label",
    roundIndex === queue.length - 1 ? "See total score" : "Next round",
  );
  animateRoundScore(score);
  show("result");
}

async function nextRound(): Promise<void> {
  if (countdownInProgress) return;
  sfx.click();
  if (roundIndex >= queue.length - 1) {
    showTotal();
    return;
  }
  roundIndex += 1;
  await showPickerWithCountdown();
}

function showTotal(): void {
  const total = totalScore();
  finalScorePosted = false;
  baseScorePosted = false;
  challengeScoreDraft = null;
  challengeScoreDraftPromise = null;
  challengeScoreDraftRunId += 1;
  lastChallengeShareUrl = activeChallenge
    ? activeChallenge.isLocal
      ? undefined
      : buildChallengeUrl(activeChallenge.code).toString()
    : undefined;
  refs.totalScore.textContent = total.toFixed(2);
  refs.totalMessage.textContent = activeChallenge
    ? challengeSummaryMessage(total, activeChallenge)
    : `${scoreCategoryLabel()} - ${totalMessage(total)}`;
  refs.totalPalette.innerHTML = results
    .map(
      (result) => {
        const scoreTextColor = readableTextColor(hsbToRgb(...result.prompt.targetHsb));
        const scoreShadow =
          scoreTextColor === "#000"
            ? "0 1px rgba(255, 255, 255, 0.28)"
            : "0 1px 8px rgba(0, 0, 0, 0.56)";
        return `
          <div
            class="total-color-tile"
            style="--picked: ${hsbCss(result.picked)}; --target: ${hsbCss(
              result.prompt.targetHsb,
            )}; --score-text: ${scoreTextColor}; --score-shadow: ${scoreShadow};"
            title="${escapeHtml(result.prompt.name)}: ${result.score.toFixed(2)}"
          >
            <span>${result.score.toFixed(2)}</span>
          </div>
        `;
      },
    )
    .join("");
  refs.playerNameInput.value = activeChallenge
    ? ""
    : formatPlayerName(localStorage.getItem(STORAGE_PLAYER_NAME) || "");
  refs.playerNameInput.placeholder = activeChallenge ? "Nickname" : "Name";
  refs.scoreForm.classList.remove("is-saved");
  refs.saveScoreButton.disabled = false;
  refs.saveScoreButton.classList.remove("copied");
  refs.saveScoreButton.style.removeProperty("background");
  refs.saveScoreButton.style.removeProperty("color");
  refs.saveScoreButton.textContent = activeChallenge
    ? "Save score"
    : "Post score & challenge a friend";
  refs.scoreSaveStatus.textContent = "Post your score and copy a challenge link.";
  refs.scoreSaveStatus.dataset.state = "idle";
  hideChallengeLinkOutput();
  renderChallengeResult(total);
  renderChallengeBoards("total");
  if (activeChallenge) startChallengeScoreDraft(total);
  sfx.scoreLand();
  show("total");
}

async function submitFinalScore(): Promise<void> {
  const enteredName = formatPlayerName(refs.playerNameInput.value);
  const challenge = activeChallenge;

  if (challenge) {
    refs.playerNameInput.value = enteredName;
    await submitChallengeScoreName(challenge, enteredName);
    return;
  }

  const playerName = enteredName || "PLAY";
  refs.playerNameInput.value = playerName;

  if (finalScorePosted && lastChallengeShareUrl) {
    refs.saveScoreButton.disabled = true;
    refs.saveScoreButton.textContent = "Copying";
    const shared = await shareChallengeLink(
      currentShareText(playerName, null),
      new URL(lastChallengeShareUrl),
    );
    refs.saveScoreButton.disabled = false;
    refs.saveScoreButton.classList.add("copied");
    refs.saveScoreButton.textContent =
      shared.status === "ready" ? "Link ready" : "Link copied";
    refs.scoreSaveStatus.textContent =
      shared.status === "ready"
        ? "Clipboard blocked; challenge link is shown below."
        : "Challenge link copied.";
    refs.scoreSaveStatus.dataset.state = "success";
    if (shared.status === "ready") showChallengeLinkOutput(shared.url);
    else hideChallengeLinkOutput();
    return;
  }

  refs.saveScoreButton.disabled = true;
  refs.saveScoreButton.textContent = "Posting";
  refs.scoreSaveStatus.textContent = "Posting score...";
  refs.scoreSaveStatus.dataset.state = "pending";

  try {
    const rounds = currentScoreRounds();
    const total = totalScore();
    const savedTo = baseScorePosted
      ? "remote"
      : await saveScore({
        playerName,
        totalScore: total,
        difficulty: DEFAULT_DIFFICULTY,
        category: scoreCategoryLabel(),
        rounds,
      });
    baseScorePosted = true;
    localStorage.setItem(STORAGE_PLAYER_NAME, playerName);
    refs.scoreForm.classList.add("is-saved");
    const shared = await shareScoreChallenge(playerName);
    const saveLocation =
      savedTo === "remote" ? "Score posted." : "Score saved locally.";

    if (shared.status === "failed") {
      refs.saveScoreButton.textContent = "Couldn't copy";
      refs.saveScoreButton.style.background = "#333";
      refs.saveScoreButton.style.color = "#fff";
      refs.scoreSaveStatus.textContent = `${saveLocation} Could not create a challenge link.`;
      refs.scoreSaveStatus.dataset.state = "error";
    } else {
      refs.saveScoreButton.classList.add("copied");
      refs.saveScoreButton.textContent =
        shared.status === "native"
          ? "Shared"
          : shared.status === "ready"
            ? "Link ready"
            : "Link copied";
      refs.scoreSaveStatus.textContent =
        shared.status === "native"
          ? `${saveLocation} Challenge opened for sharing.`
          : shared.status === "ready"
            ? `${saveLocation} Clipboard blocked; challenge link is shown below.`
            : `${saveLocation} Challenge link copied.`;
      refs.scoreSaveStatus.dataset.state = "success";
      if (shared.status === "ready") {
        showChallengeLinkOutput(shared.url);
      } else {
        hideChallengeLinkOutput();
      }
      finalScorePosted = true;
      lastChallengeShareUrl = shared.url || lastChallengeShareUrl;
      window.setTimeout(() => {
        refs.saveScoreButton.classList.remove("copied");
        refs.saveScoreButton.style.removeProperty("background");
        refs.saveScoreButton.style.removeProperty("color");
        refs.saveScoreButton.textContent = "Challenge a friend";
      }, 2500);
    }
    refs.saveScoreButton.disabled = false;
    sfx.scoreLand();
  } catch {
    refs.saveScoreButton.disabled = false;
    refs.saveScoreButton.textContent = "Post score & challenge a friend";
    refs.scoreSaveStatus.textContent = "Could not save. Try again.";
    refs.scoreSaveStatus.dataset.state = "error";
  }
}

function startChallengeScoreDraft(total: number): void {
  const challenge = activeChallenge;
  if (!challenge) return;

  if (challenge.isLocal) {
    refs.saveScoreButton.disabled = true;
    refs.scoreSaveStatus.textContent = "This local challenge cannot post scores.";
    refs.scoreSaveStatus.dataset.state = "error";
    return;
  }

  const runId = challengeScoreDraftRunId;
  const rounds = currentScoreRounds();
  refs.saveScoreButton.disabled = true;
  refs.saveScoreButton.textContent = "Saving";
  refs.scoreSaveStatus.textContent = "Saving score...";
  refs.scoreSaveStatus.dataset.state = "pending";

  challengeScoreDraftPromise = saveChallengeScoreDraft({
    challengeCode: challenge.code,
    playerName: randomGuestName(),
    totalScore: total,
    rounds,
  })
    .then((draft) => {
      if (runId !== challengeScoreDraftRunId) return null;
      challengeScoreDraft = draft;
      refs.saveScoreButton.disabled = !draft;
      refs.saveScoreButton.textContent = "Save score";
      refs.scoreSaveStatus.textContent = draft
        ? "Score saved. Add a nickname to claim it."
        : "Could not save score. Try again.";
      refs.scoreSaveStatus.dataset.state = draft ? "success" : "error";
      return draft;
    })
    .catch(() => {
      if (runId !== challengeScoreDraftRunId) return null;
      refs.saveScoreButton.disabled = true;
      refs.saveScoreButton.textContent = "Save score";
      refs.scoreSaveStatus.textContent = "Could not save score. Try again.";
      refs.scoreSaveStatus.dataset.state = "error";
      return null;
    });
}

async function submitChallengeScoreName(
  challenge: SharedChallenge,
  playerName: string,
): Promise<void> {
  if (!refs.playerNameInput.value.trim()) {
    refs.playerNameInput.focus();
    refs.scoreSaveStatus.textContent = "Add a nickname before saving.";
    refs.scoreSaveStatus.dataset.state = "error";
    return;
  }

  if (challenge.isLocal) return;

  refs.saveScoreButton.disabled = true;
  refs.saveScoreButton.textContent = "Saving";
  refs.scoreSaveStatus.textContent = "Saving nickname...";
  refs.scoreSaveStatus.dataset.state = "pending";

  try {
    const draft = challengeScoreDraft || await challengeScoreDraftPromise;
    if (!draft) throw new Error("missing challenge score draft");
    if (!draft.editToken) {
      refs.saveScoreButton.textContent = "Save score";
      refs.scoreSaveStatus.textContent =
        "Score is posted. Nickname updates need the latest database migration.";
      refs.scoreSaveStatus.dataset.state = "error";
      return;
    }

    const updated = await updateChallengeScoreName(
      draft.entry.id,
      draft.editToken,
      playerName,
    );
    if (!updated) throw new Error("challenge score update failed");

    localStorage.setItem(STORAGE_PLAYER_NAME, playerName);
    refs.scoreForm.classList.add("is-saved");
    refs.saveScoreButton.classList.add("copied");
    refs.saveScoreButton.textContent = "Saved";
    refs.scoreSaveStatus.textContent = "Score saved to this challenge.";
    refs.scoreSaveStatus.dataset.state = "success";
    await refreshChallengeScores(challenge.code);
    renderChallengeResult(totalScore());
    renderChallengeBoards("total");
    window.setTimeout(() => {
      refs.saveScoreButton.classList.remove("copied");
      refs.saveScoreButton.textContent = "Save score";
    }, 1800);
    sfx.scoreLand();
  } catch {
    refs.saveScoreButton.textContent = "Save score";
    refs.scoreSaveStatus.textContent = "Could not save nickname. Try again.";
    refs.scoreSaveStatus.dataset.state = "error";
  } finally {
    refs.saveScoreButton.disabled = false;
  }
}

async function shareScoreChallenge(
  playerName: string,
): Promise<ShareResult> {
  const total = Number(totalScore().toFixed(2));
  const prompts = results.map((result) => result.prompt);
  const challenge = await createChallenge({
    creatorName: playerName,
    creatorScore: total,
    difficulty: DEFAULT_DIFFICULTY,
    prompts,
    rounds: currentScoreRounds(),
  });
  if (!challenge) return { status: "failed" };

  const shareUrl = buildChallengeUrl(challenge.code);
  return shareChallengeLink(currentShareText(playerName, null), shareUrl);
}

async function shareExistingChallenge(
  playerName: string,
  challenge: SharedChallenge,
): Promise<ShareResult> {
  const remoteChallenge = challenge.isLocal
    ? await createChallenge({
      creatorName: challenge.name,
      creatorScore: challenge.score === null ? undefined : challenge.score,
      difficulty: challenge.difficulty,
      prompts: challenge.prompts,
    })
    : null;

  if (challenge.isLocal) {
    if (!remoteChallenge) return { status: "failed" };
    activeChallenge = challengeEntryToShared(remoteChallenge);
    challenge = activeChallenge;
    challengeScores = [];
    renderChallengeBoards("total");
  }

  const shareUrl = buildChallengeUrl(challenge.code);
  return shareChallengeLink(currentShareText(playerName, challenge), shareUrl);
}

function currentShareText(
  playerName: string,
  challenge: SharedChallenge | null,
): string {
  const total = Number(totalScore().toFixed(2));
  if (challenge) {
    return `${playerName} scored ${total.toFixed(
      2,
    )}/50 against ${challenge.name}'s Color Game challenge.`;
  }

  return `${playerName} scored ${total.toFixed(
    2,
  )}/50 on Color Game. Can you beat it?`;
}

function buildChallengeUrl(code: string): URL {
  const shareUrl = new URL(window.location.href);
  shareUrl.search = "";
  shareUrl.hash = "";
  shareUrl.searchParams.set("c", code);
  return shareUrl;
}

async function shareChallengeLink(
  text: string,
  shareUrl: URL,
): Promise<ShareResult> {
  const clipText = `${text}\n${shareUrl.toString()}`;
  const url = shareUrl.toString();

  const isMobile = "ontouchstart" in window && window.innerWidth < 768;
  if (isMobile && navigator.share) {
    try {
      await navigator.share({
        title: "Color Game challenge",
        text,
        url,
      });
      return { status: "native", url };
    } catch {
      // Fall through to clipboard, matching Dialed's behavior.
    }
  }

  if (await copyText(clipText)) return { status: "copy", url };

  if (isMobile && navigator.share) {
    try {
      await navigator.share({
        title: "Color Game challenge",
        text,
        url,
      });
      return { status: "native", url };
    } catch {
      return { status: "ready", url };
    }
  }

  return { status: "ready", url };
}

function openLeaderboard(category: string, returnTo: Screen): void {
  leaderboardCategory = category;
  returnFromLeaderboard = returnTo === "leaderboard" ? "intro" : returnTo;
  renderLeaderboardTabs();
  show("leaderboard");
  void refreshLeaderboard();
}

async function refreshLeaderboard(): Promise<void> {
  const category = leaderboardCategory;
  refs.leaderboardRefresh.disabled = true;
  refs.leaderboardList.innerHTML = `<div class="leaderboard-empty">Loading ${escapeHtml(category)} scores...</div>`;

  try {
    const entries = await loadLeaderboard(category);
    if (category !== leaderboardCategory) return;
    renderLeaderboardEntries(entries);
  } catch {
    refs.leaderboardList.innerHTML =
      '<div class="leaderboard-empty">Scores are not available right now.</div>';
  } finally {
    refs.leaderboardRefresh.disabled = false;
  }
}

function renderLeaderboardEntries(entries: LeaderboardEntry[]): void {
  if (!entries.length) {
    refs.leaderboardList.innerHTML =
      '<div class="leaderboard-empty">No scores yet. Take the first spot.</div>';
    return;
  }

  refs.leaderboardList.innerHTML = entries
    .map(
      (entry, index) => `
        <div class="leaderboard-row">
          <span>${index + 1}</span>
          <strong>${escapeHtml(entry.playerName)}</strong>
          <em>${entry.totalScore.toFixed(2)}</em>
          <time>${formatScoreDate(entry.createdAt)}</time>
        </div>
      `,
    )
    .join("");
}

function renderLeaderboardTabs(): void {
  renderCategoryTabs(refs.leaderboardTabs, leaderboardCategory);

  refs.leaderboardTabs
    .querySelectorAll<HTMLButtonElement>("button")
    .forEach((button) => {
      button.addEventListener("click", () => {
        leaderboardCategory = button.dataset.category || ALL_CATEGORY_LABEL;
        renderLeaderboardTabs();
        sfx.click();
        void refreshLeaderboard();
      });
      button.addEventListener("mouseenter", () => sfx.hover());
    });
}

function renderCategoryTabs(container: HTMLElement, active: string): void {
  container.innerHTML = scoreCategories()
    .map(
      (category) => `
        <button
          class="difficulty-tab ${category === active ? "active" : ""}"
          type="button"
          role="tab"
          aria-selected="${category === active}"
          data-category="${escapeHtml(category)}"
        >
          ${escapeHtml(category)}
        </button>
      `,
    )
    .join("");
}

function updateRunUi(): void {
  refs.gameCard.dataset.difficulty = selectedDifficulty;
  refs.multiplayerButton.disabled = Boolean(activeChallenge);
}

function scoreCategoryLabel(): string {
  return selectedCategory === "all" ? ALL_CATEGORY_LABEL : selectedCategory;
}

function scoreCategories(): string[] {
  return [ALL_CATEGORY_LABEL, ...availableCategories];
}

function applyChallengeIntro(): void {
  if (!activeChallenge) {
    refs.introScreen.classList.remove("has-challenge");
    hideChallengeBoards();
    return;
  }
  refs.introScreen.classList.add("has-challenge");
  const introCopy = document.querySelector<HTMLElement>(".intro-copy");
  if (introCopy) {
    const firstLine =
      activeChallenge.score === null
        ? `<strong>${escapeHtml(activeChallenge.name)}</strong> started a challenge.`
        : `<strong>${escapeHtml(activeChallenge.name)}</strong> scored ${activeChallenge.score.toFixed(
          2,
        )}/50.`;
    const detailLine = activeChallenge.isLocal
      ? "Same images. Same colors. This link carries the original challenge."
      : "Same images. Same colors. Every posted result stays on this link.";
    introCopy.innerHTML = `
      <p>${firstLine}</p>
      <p>${detailLine}</p>
      <strong>Ready?</strong>
    `;
  }
  renderChallengeBoards("intro");
  refs.startButton.setAttribute("aria-label", "Start challenge");
}

async function loadPendingChallenge(): Promise<void> {
  if (!pendingChallengeCode && !pendingLocalChallenge) return;

  refs.startButton.disabled = true;
  refs.startButton.setAttribute("aria-busy", "true");
  const introCopy = document.querySelector<HTMLElement>(".intro-copy");
  if (introCopy) {
    const challengeLabel = pendingChallengeCode || "shared";
    introCopy.innerHTML = `
      <p>Loading challenge ${escapeHtml(challengeLabel)}...</p>
      <p>Fetching the same images and target colors.</p>
      <strong>One moment.</strong>
    `;
  }

  try {
    if (pendingLocalChallenge) {
      activeChallenge = pendingLocalChallenge;
      pendingLocalChallenge = null;
      pendingChallengeCode = null;
      challengeScores = [];
      selectedDifficulty = DEFAULT_DIFFICULTY;
      updateRunUi();
      applyChallengeIntro();
      return;
    }

    if (!pendingChallengeCode) return;
    const challenge = await loadChallenge(pendingChallengeCode);
    if (!challenge) {
      pendingChallengeCode = null;
      if (introCopy) {
        introCopy.innerHTML = `
          <p>This challenge link was not found.</p>
          <p>You can still start a normal five-image run.</p>
          <strong>Ready?</strong>
        `;
      }
      refs.startButton.setAttribute("aria-label", "Start game");
      return;
    }

    activeChallenge = challengeEntryToShared(challenge);
    pendingChallengeCode = null;
    selectedDifficulty = DEFAULT_DIFFICULTY;
    await refreshChallengeScores(challenge.code);
    updateRunUi();
    applyChallengeIntro();
  } finally {
    refs.startButton.disabled = false;
    refs.startButton.removeAttribute("aria-busy");
  }
}

async function refreshChallengeScores(code: string): Promise<void> {
  challengeScores = await loadChallengeScores(code);
  hydrateChallengeCreatorScore();
}

function challengeEntryToShared(challenge: ChallengeEntry): SharedChallenge {
  return {
    code: challenge.code,
    name: challenge.creatorName,
    score: challenge.creatorScore,
    difficulty: challenge.difficulty,
    prompts: challenge.prompts,
  };
}

function createLocalChallenge(
  name: string,
  score: number | null,
  difficulty: Difficulty,
  prompts: PromptItem[],
): SharedChallenge {
  const challengePrompts = prompts.slice(0, ROUND_COUNT).map((prompt) => ({
    id: prompt.id,
    name: prompt.name,
    imageSrc: prompt.imageSrc,
    category: prompt.category,
    targetHsb: [...prompt.targetHsb] as HsbColor,
    difficulty: prompt.difficulty || difficulty,
  }));

  return {
    code: localChallengeCode(name, score, challengePrompts),
    name,
    score,
    difficulty,
    prompts: challengePrompts,
    isLocal: true,
  };
}

function localChallengeCode(
  name: string,
  score: number | null,
  prompts: PromptItem[],
): string {
  const source = JSON.stringify({
    name,
    score,
    prompts: prompts.map((prompt) => [prompt.id, prompt.targetHsb]),
  });
  let hash = 0;
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0;
  }
  return `L${hash.toString(36).toUpperCase().padStart(6, "0")}`.slice(0, 10);
}

function hydrateChallengeCreatorScore(): void {
  const challenge = activeChallenge;
  if (!challenge || challenge.score !== null) return;

  const creatorEntry = challengeScores.find(
    (entry) => entry.playerName === challenge.name,
  );
  if (creatorEntry) challenge.score = creatorEntry.totalScore;
}

async function refreshCategoryOptions(): Promise<void> {
  availableCategories = await loadCategories();
  const values = ["all", ...availableCategories];
  if (!values.includes(selectedCategory)) selectedCategory = "all";
  leaderboardCategory = scoreCategories().includes(leaderboardCategory)
    ? leaderboardCategory
    : scoreCategoryLabel();
  updateRunUi();
  if (screen === "category") renderCategoryChoices();
  if (screen === "leaderboard") renderLeaderboardTabs();
}

function openCategorySelection(): void {
  renderCategoryChoices();
  show("category");
}

function openMultiplayerSetup(): void {
  refs.multiplayerNameInput.value =
    formatPlayerName(localStorage.getItem(STORAGE_PLAYER_NAME) || "") || "";
  refs.createMultiplayerButton.textContent = activeChallenge
    ? "Start playing"
    : "Create and copy game link";
  refs.createMultiplayerButton.disabled = false;
  refs.multiplayerStatus.textContent = activeChallenge
    ? "Challenge link is ready. Start when you are ready."
    : "This creates the shared link before anyone plays.";
  refs.multiplayerStatus.dataset.state = "idle";
  hideMultiplayerLinkOutput();
  show("multiplayer");
}

async function submitMultiplayerSetup(): Promise<void> {
  if (activeChallenge) {
    requestMobileFullscreen();
    void startGame();
    return;
  }

  const creatorName =
    formatPlayerName(refs.multiplayerNameInput.value) || "PLAY";
  refs.multiplayerNameInput.value = creatorName;
  refs.createMultiplayerButton.disabled = true;
  refs.createMultiplayerButton.textContent = "Creating";
  refs.multiplayerStatus.textContent = "Creating multiplayer link...";
  refs.multiplayerStatus.dataset.state = "pending";

  try {
    const prompts = await buildRoundQueue();
    const challenge = await createChallenge({
      creatorName,
      difficulty: DEFAULT_DIFFICULTY,
      prompts,
    });

    activeChallenge = challenge
      ? challengeEntryToShared(challenge)
      : null;
    if (!activeChallenge) throw new Error("challenge create failed");
    challengeScores = [];
    localStorage.setItem(STORAGE_PLAYER_NAME, creatorName);
    leaderboardCategory = scoreCategoryLabel();
    lastChallengeShareUrl = buildChallengeUrl(activeChallenge.code).toString();
    updateRunUi();
    applyChallengeIntro();

    const shared = await shareChallengeLink(
      `${creatorName} created a Color Game challenge. Same images, same board.`,
      new URL(lastChallengeShareUrl),
    );
    showMultiplayerLinkOutput(shared.url || lastChallengeShareUrl);
    refs.multiplayerStatus.textContent =
      shared.status === "copy"
        ? "Multiplayer link copied."
        : shared.status === "native"
          ? "Challenge opened for sharing."
          : "Multiplayer link is ready below.";
    refs.multiplayerStatus.dataset.state = "success";
    refs.createMultiplayerButton.textContent = "Start playing";
  } catch {
    refs.multiplayerStatus.textContent = "Could not create the link. Try again.";
    refs.multiplayerStatus.dataset.state = "error";
    refs.createMultiplayerButton.textContent = "Create and copy game link";
  } finally {
    refs.createMultiplayerButton.disabled = false;
  }
}

function renderCategoryChoices(): void {
  const values = ["all", ...availableCategories];
  refs.categoryList.innerHTML = values
    .map(
      (category) => `
        <button
          class="category-choice soundable ${
            category === selectedCategory ? "active" : ""
          }"
          type="button"
          data-category="${escapeHtml(category)}"
          aria-label="${escapeHtml(category === "all" ? ALL_CATEGORY_LABEL : category)}"
        >
          <img
            class="category-choice-art"
            src="${categoryArtworkSrc(category)}"
            alt=""
            width="512"
            height="512"
            loading="lazy"
            decoding="async"
            draggable="false"
          />
          <span>${category === "all" ? ALL_CATEGORY_LABEL : escapeHtml(category)}</span>
        </button>
      `
    )
    .join("");
  refs.categoryList
    .querySelectorAll<HTMLButtonElement>("[data-category]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        if (suppressCategoryClick || categorySelectionPending) return;
        categorySelectionPending = true;
        selectedCategory = button.dataset.category || "all";
        localStorage.setItem(STORAGE_CATEGORY, selectedCategory);
        leaderboardCategory = scoreCategoryLabel();
        refs.categoryList
          .querySelectorAll<HTMLButtonElement>("[data-category]")
          .forEach((choice) => {
            choice.classList.toggle("active", choice === button);
          });
        refs.categoryList.classList.add("selecting");
        updateRunUi();
        sfx.click();
        requestMobileFullscreen();
        window.setTimeout(() => {
          refs.categoryList.classList.remove("selecting");
          categorySelectionPending = false;
          void startGame();
        }, CATEGORY_START_DELAY_MS);
      });
      button.addEventListener("mouseenter", () => sfx.hover());
    });
}

function categoryArtworkSrc(category: string): string {
  const key = normalizeCategoryKey(category);
  if (key === "dbz") return assetSrc("assets/categories/dbz.webp");
  if (key === "desenhos") return assetSrc("assets/categories/desenhos.webp");
  if (key === "pokemon") return assetSrc("assets/categories/pokemon.webp");
  return assetSrc("assets/categories/all.webp");
}

function normalizeCategoryKey(category: string): string {
  return category
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function assetSrc(path: string): string {
  return `${import.meta.env.BASE_URL}${path.replace(/^\/+/, "")}`;
}

function handleCategoryPointerDown(event: PointerEvent): void {
  if (event.pointerType === "mouse" && event.button !== 0) return;
  if (window.matchMedia("(max-width: 720px)").matches) return;

  categoryDragState = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startScrollLeft: refs.categoryList.scrollLeft,
    dragged: false,
  };
  refs.categoryList.setPointerCapture(event.pointerId);
}

function handleCategoryPointerMove(event: PointerEvent): void {
  if (!categoryDragState || categoryDragState.pointerId !== event.pointerId) return;

  const deltaX = event.clientX - categoryDragState.startX;
  if (Math.abs(deltaX) > 4) {
    categoryDragState.dragged = true;
    refs.categoryList.classList.add("dragging");
  }
  if (!categoryDragState.dragged) return;

  event.preventDefault();
  refs.categoryList.scrollLeft = categoryDragState.startScrollLeft - deltaX;
}

function handleCategoryPointerEnd(event: PointerEvent): void {
  if (!categoryDragState || categoryDragState.pointerId !== event.pointerId) return;

  if (refs.categoryList.hasPointerCapture(event.pointerId)) {
    refs.categoryList.releasePointerCapture(event.pointerId);
  }
  if (categoryDragState.dragged) {
    suppressCategoryClick = true;
    window.setTimeout(() => {
      suppressCategoryClick = false;
    }, 0);
  }
  categoryDragState = null;
  refs.categoryList.classList.remove("dragging");
}

function show(nextScreen: Screen): void {
  screen = nextScreen;
  const map: Record<Screen, HTMLElement> = {
    intro: refs.introScreen,
    category: refs.categoryScreen,
    multiplayer: refs.multiplayerScreen,
    picker: refs.pickerScreen,
    result: refs.resultScreen,
    total: refs.totalScreen,
    leaderboard: refs.leaderboardScreen,
  };

  Object.entries(map).forEach(([name, element]) => {
    const isActive = name === screen;
    element.classList.toggle("active", isActive);
    element.setAttribute("aria-hidden", String(!isActive));
    (element as HTMLElement & { inert: boolean }).inert = !isActive;
  });
  refs.gameCard.dataset.screen = screen;
  document.body.dataset.screen = screen;
}

function updatePickerUi(): void {
  const selectedRgb = hsbToRgb(...pickerHsb);
  const selectedCss = rgbCss(selectedRgb);
  refs.pickerBg.classList.toggle("is-empty", !pickerHasSelection);
  if (pickerHasSelection) refs.pickerBg.style.background = selectedCss;
  else refs.pickerBg.style.removeProperty("background");
  refs.pickerValues.style.color = readableTextColor(selectedRgb);
  refs.pickerValues.previousElementSibling?.setAttribute(
    "style",
    `color: ${readableSoftTextColor(selectedRgb)}`,
  );
  refs.pickerRound.style.color = readableSoftTextColor(selectedRgb);
  refs.pickerDifficulty.style.color = readableSoftTextColor(selectedRgb);
  updateStripGradients();
  setHandlePosition(refs.hHandle, pickerHsb[0], 360, false);
  setHandlePosition(refs.sHandle, pickerHsb[1], 100, true);
  setHandlePosition(refs.bHandle, pickerHsb[2], 100, true);
}

function bindStrip(strip: HTMLDivElement, channel: "h" | "s" | "b"): void {
  let activePointer: number | null = null;

  strip.addEventListener("pointerdown", (event) => {
    activePointer = event.pointerId;
    strip.setPointerCapture(event.pointerId);
    updateFromStrip(event, strip, channel);
  });
  strip.addEventListener("pointermove", (event) => {
    if (activePointer !== event.pointerId) return;
    updateFromStrip(event, strip, channel);
  });
  strip.addEventListener("pointerup", (event) => {
    if (activePointer === event.pointerId) activePointer = null;
    hidePickerChannelSoon();
  });
  strip.addEventListener("pointercancel", (event) => {
    if (activePointer === event.pointerId) activePointer = null;
    hidePickerChannelSoon();
  });
}

function bindCompareDivider(): void {
  refs.comparisonGrid.addEventListener("pointerdown", (event) => {
    if (window.matchMedia("(max-width: 720px)").matches) return;
    compareDragState = {
      pointerId: event.pointerId,
      rect: refs.comparisonGrid.getBoundingClientRect(),
    };
    refs.comparisonGrid.setPointerCapture(event.pointerId);
    updateCompareFromPointer(event.clientX);
  });
  refs.comparisonGrid.addEventListener("pointermove", (event) => {
    if (!compareDragState || compareDragState.pointerId !== event.pointerId) {
      return;
    }
    updateCompareFromPointer(event.clientX);
  });
  refs.comparisonGrid.addEventListener("pointerup", (event) => {
    if (compareDragState?.pointerId === event.pointerId) compareDragState = null;
  });
  refs.comparisonGrid.addEventListener("pointercancel", (event) => {
    if (compareDragState?.pointerId === event.pointerId) compareDragState = null;
  });
}

function updateCompareFromPointer(clientX: number): void {
  if (!compareDragState) return;
  const percent =
    ((clientX - compareDragState.rect.left) / compareDragState.rect.width) * 100;
  setComparePosition(percent);
}

function setComparePosition(value: number): void {
  const percent = Math.min(100, Math.max(0, value));
  refs.resultScreen.style.setProperty("--compare-x", `${percent}%`);
}

function updateFromStrip(
  event: PointerEvent,
  strip: HTMLDivElement,
  channel: "h" | "s" | "b",
): void {
  const rect = strip.getBoundingClientRect();
  const pointerPosition = Math.min(
    rect.height,
    Math.max(0, event.clientY - rect.top),
  );
  const position = pointerPosition / rect.height;

  if (channel === "h") pickerHsb[0] = Math.round(position * 360) % 360;
  if (channel === "s") pickerHsb[1] = Math.round((1 - position) * 100);
  if (channel === "b") pickerHsb[2] = Math.round((1 - position) * 100);

  pickerHasSelection = true;
  sfx.slider();
  updatePickerUi();
  showPickerChannel(channel);
}

function updateStripGradients(): void {
  const [h, s, b] = pickerHsb;
  refs.sStrip.style.background = `linear-gradient(to bottom, ${hsbCss([
    h,
    100,
    b,
  ])}, ${hsbCss([h, 0, b])})`;
  refs.bStrip.style.background = `linear-gradient(to bottom, ${hsbCss([
    h,
    s,
    100,
  ])}, ${hsbCss([h, s, 0])})`;
}

function buildHueGradient(): void {
  const stops = Array.from({ length: 13 }, (_, index) => {
    const hue = index * 30;
    return `${hsbCss([hue, 100, 100])} ${((hue / 360) * 100).toFixed(1)}%`;
  });
  refs.hStrip.style.background = `linear-gradient(to bottom, ${stops.join(", ")})`;
}

function setHandlePosition(
  handle: HTMLDivElement,
  value: number,
  max: number,
  inverted: boolean,
): void {
  const percent = inverted ? 100 - (value / max) * 100 : (value / max) * 100;
  const clamped = Math.min(100, Math.max(0, percent));
  handle.style.left = "50%";
  handle.style.top = `${clamped}%`;
}

function animateRoundScore(score: number): void {
  const duration = 1450;
  const start = performance.now();
  let lastToneAt = 0;

  const frame = (now: number) => {
    const t = Math.min(1, (now - start) / duration);
    const eased = 1 - Math.pow(1 - t, 2.2);
    const value = score * eased;
    setRoundScore(value);
    if (now - lastToneAt > 86 && t < 0.98) {
      lastToneAt = now;
      sfx.scoreRise(eased);
    }
    if (t < 1) {
      requestAnimationFrame(frame);
    } else {
      setRoundScore(score);
      sfx.scoreLand();
    }
  };

  requestAnimationFrame(frame);
}

function setRoundScore(value: number): void {
  const fixed = value.toFixed(2);
  const [main, decimal] = fixed.split(".");
  refs.roundScoreMain.textContent = main;
  refs.roundScoreDecimal.textContent = decimal;
}

function toggleMute(): void {
  muted = !muted;
  localStorage.setItem(STORAGE_MUTED, muted ? "1" : "0");
  updateMuteButton();
  refs.muteToggle.blur();
  if (!muted) sfx.toLight();
}

function updateMuteButton(): void {
  refs.muteToggle.innerHTML = muted ? icons.volumeOff : icons.volumeOn;
  refs.muteToggle.setAttribute("aria-label", muted ? "Unmute" : "Mute");
}

function toggleTheme(): void {
  const nextTheme = theme === "dark" ? "light" : "dark";
  theme = nextTheme;
  localStorage.setItem(STORAGE_THEME, theme);
  applyTheme();
  refs.themeToggle.blur();
  if (nextTheme === "dark") sfx.toDark();
  else sfx.toLight();
}

function applyTheme(): void {
  document.body.dataset.theme = theme;
  refs?.themeToggle?.setAttribute(
    "aria-label",
    theme === "dark" ? "Use light mode" : "Use dark mode",
  );
  if (refs?.themeToggle) {
    refs.themeToggle.innerHTML = theme === "dark" ? icons.sun : icons.moon;
  }
}

function readTheme(): "light" | "dark" {
  const stored = localStorage.getItem(STORAGE_THEME);
  if (stored === "light" || stored === "dark") return stored;
  return "light";
}

function syncViewportHeight(): void {
  const height = window.visualViewport?.height || window.innerHeight;
  document.documentElement.style.setProperty(
    "--visual-viewport-height",
    `${Math.round(height)}px`,
  );
}

function requestMobileFullscreen(): void {
  if (!window.matchMedia("(max-width: 720px)").matches) return;
  if (document.fullscreenElement) return;

  const root = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  const request = root.requestFullscreen || root.webkitRequestFullscreen;
  if (!request) return;

  try {
    const result = request.call(root);
    if (result instanceof Promise) void result.catch(() => {});
  } catch {
    // Browser fullscreen support varies on mobile; layout fixes still apply.
  }
}

function registerServiceWorker(): void {
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;

  const baseUrl = import.meta.env.BASE_URL || "/";
  const serviceWorkerUrl = `${baseUrl}sw.js`;
  void window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register(serviceWorkerUrl, { scope: baseUrl })
      .catch(() => {});
  });
}

function currentPrompt(): PromptItem {
  const prompt = queue[roundIndex];
  if (!prompt) throw new Error("No prompt available for the current round");
  return prompt;
}

function randomPickerDefault(targetHue: number): HsbColor {
  const minHueGap = 45;
  let hue = Math.floor(Math.random() * 360);
  let guard = 0;
  while (hueDistance(hue, targetHue) < minHueGap && guard < 100) {
    hue = Math.floor(Math.random() * 360);
    guard += 1;
  }

  const saturationFloor = 35;
  const brightnessFloor = 40;
  return [
    hue,
    saturationFloor + Math.floor(Math.random() * (92 - saturationFloor)),
    brightnessFloor + Math.floor(Math.random() * (96 - brightnessFloor)),
  ];
}

function pickerValueText(): string {
  return `H${pickerHsb[0]} S${pickerHsb[1]} B${pickerHsb[2]}`;
}

function showPickerChannel(channel: "h" | "s" | "b"): void {
  if (pickerValueHideTimer) window.clearTimeout(pickerValueHideTimer);

  const channelLabels = {
    h: "HUE",
    s: "SATURATION",
    b: "BRIGHTNESS",
  };
  refs.pickerValueLabel.textContent = channelLabels[channel];
  refs.pickerValues.textContent = pickerValueText();
  refs.pickerValues.parentElement?.classList.add("active");
}

function hidePickerChannelSoon(): void {
  if (pickerValueHideTimer) window.clearTimeout(pickerValueHideTimer);
  pickerValueHideTimer = window.setTimeout(() => {
    refs.pickerValues.parentElement?.classList.remove("active");
  }, 900);
}

function hsbCode(hsb: HsbColor): string {
  return `H${hsb[0]} S${hsb[1]} B${hsb[2]}`;
}

function hueDistance(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, 360 - diff);
}

function scoreMessage(score: number): string {
  if (score >= 9.6) return "That is uncomfortably close.";
  if (score >= 8.4) return "Your memory had the color mostly locked.";
  if (score >= 6.8) return "Right neighborhood, questionable address.";
  if (score >= 5) return "The idea was there. The color was negotiating.";
  if (score >= 3) return "Recognizable only if someone squints for you.";
  return "That color left the room a while ago.";
}

function totalMessage(total: number): string {
  if (total >= 45) return "That is a suspiciously good eye.";
  if (total >= 36) return "Sharp enough to be annoying.";
  if (total >= 28) return "Decent. Not legendary. Decent.";
  if (total >= 18) return "Some colors survived the trip.";
  return "The images won this round.";
}

function totalScore(): number {
  return results.reduce((sum, result) => sum + result.score, 0);
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function renderChallengeResult(total: number): void {
  if (!activeChallenge || activeChallenge.score === null) {
    refs.challengeResult.hidden = true;
    refs.challengeResult.innerHTML = "";
    refs.challengeResult.removeAttribute("data-result");
    return;
  }

  const diff = total - activeChallenge.score;
  const outcome =
    Math.abs(diff) < 0.005 ? "tie" : diff > 0 ? "win" : "loss";
  const detail =
    outcome === "win"
      ? `You beat ${activeChallenge.name} by ${Math.abs(diff).toFixed(2)}.`
      : outcome === "loss"
        ? `${activeChallenge.name} stayed ahead by ${Math.abs(diff).toFixed(2)}.`
        : `You tied ${activeChallenge.name}.`;

  refs.challengeResult.hidden = false;
  refs.challengeResult.dataset.result = outcome;
  refs.challengeResult.innerHTML = `
    <div class="challenge-result-row">
      <span>${escapeHtml(activeChallenge.name)}</span>
      <strong>${activeChallenge.score.toFixed(2)}</strong>
    </div>
    <div class="challenge-result-row is-you">
      <span>You</span>
      <strong>${total.toFixed(2)}</strong>
    </div>
    <p>${escapeHtml(detail)}</p>
  `;
}

function renderChallengeBoards(scope: "intro" | "total" | "all" = "all"): void {
  if (!activeChallenge) {
    hideChallengeBoards();
    return;
  }

  if (scope === "intro" || scope === "all") {
    renderChallengeBoard(refs.challengeIntroBoard, 4);
  }
  if (scope === "total" || scope === "all") {
    renderChallengeBoard(refs.challengeBoard, 6);
  }
}

function renderChallengeBoard(container: HTMLElement, limit: number): void {
  const challenge = activeChallenge;
  if (!challenge) return;
  const entries = challengeBoardEntries().slice(0, limit);
  container.hidden = false;
  container.innerHTML = `
    <div class="challenge-board-head">
      <span>Challenge board</span>
      <em>${entries.length} ${entries.length === 1 ? "posted score" : "posted scores"}</em>
    </div>
    <div class="challenge-board-list">
      ${
        entries.length
          ? entries.map((entry, index) => {
          const isOrigin =
            challenge.score !== null &&
            entry.playerName === challenge.name &&
            Math.abs(entry.totalScore - challenge.score) < 0.005;
          return `
            <div class="challenge-board-row ${isOrigin ? "is-origin" : ""}">
              <span>${index + 1}</span>
              <strong>${escapeHtml(entry.playerName)}</strong>
              <em>${entry.totalScore.toFixed(2)}</em>
            </div>
          `;
        }).join("")
          : '<div class="challenge-board-empty">No posted scores yet.</div>'
      }
    </div>
  `;
}

function challengeBoardEntries(): ChallengeScoreEntry[] {
  const challenge = activeChallenge;
  if (!challenge) return [];

  const entries = [...challengeScores];
  const hasCreator = entries.some(
    (entry) =>
      challenge.score !== null &&
      entry.playerName === challenge.name &&
      Math.abs(entry.totalScore - challenge.score) < 0.005,
  );

  if (!hasCreator && challenge.score !== null) {
    entries.push({
      id: `challenge-${challenge.code}`,
      playerName: challenge.name,
      totalScore: challenge.score,
      createdAt: "",
    });
  }

  return entries.sort((a, b) => {
    if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
    return a.createdAt.localeCompare(b.createdAt);
  });
}

function hideChallengeBoards(): void {
  refs.introScreen.classList.remove("has-challenge");
  refs.challengeIntroBoard.hidden = true;
  refs.challengeIntroBoard.innerHTML = "";
  refs.challengeBoard.hidden = true;
  refs.challengeBoard.innerHTML = "";
}

function showChallengeLinkOutput(url?: string): void {
  if (!url) {
    hideChallengeLinkOutput();
    return;
  }

  refs.challengeLinkOutput.hidden = false;
  refs.challengeLinkOutput.innerHTML = `
    <span>Challenge link</span>
    <a href="${escapeHtml(url)}">${escapeHtml(url)}</a>
  `;
}

function hideChallengeLinkOutput(): void {
  refs.challengeLinkOutput.hidden = true;
  refs.challengeLinkOutput.innerHTML = "";
}

function showMultiplayerLinkOutput(url?: string): void {
  if (!url) {
    hideMultiplayerLinkOutput();
    return;
  }

  refs.multiplayerLinkOutput.hidden = false;
  refs.multiplayerLinkOutput.innerHTML = `
    <span>Challenge link</span>
    <a href="${escapeHtml(url)}">${escapeHtml(url)}</a>
  `;
}

function hideMultiplayerLinkOutput(): void {
  refs.multiplayerLinkOutput.hidden = true;
  refs.multiplayerLinkOutput.innerHTML = "";
}

function challengeSummaryMessage(
  total: number,
  challenge: SharedChallenge,
): string {
  if (challenge.score === null) {
    return "Challenge - post your result.";
  }
  const diff = total - challenge.score;
  if (Math.abs(diff) < 0.005) return "Challenge - tied.";
  if (diff > 0) {
    return `Challenge - you won by ${diff.toFixed(2)}.`;
  }
  return `Challenge - ${Math.abs(diff).toFixed(
    2,
  )} behind.`;
}

function currentScoreRounds(): ScoreRound[] {
  return results.map((result) => ({
    promptId: result.prompt.id,
    promptName: result.prompt.name,
    picked: [...result.picked],
    target: [...result.prompt.targetHsb],
    score: Number(result.score.toFixed(2)),
  }));
}

function formatPlayerName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, 4);
}

function randomGuestName(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const values = crypto.getRandomValues(new Uint8Array(3));
  return `G${Array.from(values, (value) => alphabet[value % alphabet.length]).join("")}`;
}

async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.append(textarea);
      textarea.focus();
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      return copied;
    } catch {
      return false;
    }
  }
}

function readChallengeCode(): string | null {
  const value = new URLSearchParams(window.location.search).get("c");
  if (!value || !isShortChallengeCode(value)) return null;
  return value.toUpperCase();
}

function readLocalChallenge(): SharedChallenge | null {
  const value = new URLSearchParams(window.location.search).get("lc");
  if (!value) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(value)) as unknown;
    return localChallengePayloadToShared(payload);
  } catch {
    return null;
  }
}

function localChallengePayloadToShared(value: unknown): SharedChallenge | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Partial<LocalChallengePayload>;
  if (payload.v !== 1) return null;
  if (typeof payload.name !== "string") return null;
  if (!(payload.score === null || typeof payload.score === "number")) return null;
  if (!isDifficulty(payload.difficulty)) return null;
  if (!Array.isArray(payload.prompts)) return null;

  const prompts = payload.prompts.filter(isLocalChallengePrompt).slice(0, ROUND_COUNT);
  if (!prompts.length) return null;

  return createLocalChallenge(
    formatPlayerName(payload.name) || "PLAY",
    payload.score === null ? null : Number(payload.score.toFixed(2)),
    payload.difficulty,
    prompts,
  );
}

function isLocalChallengePrompt(value: unknown): value is PromptItem {
  if (!value || typeof value !== "object") return false;
  const prompt = value as Partial<PromptItem>;
  return (
    typeof prompt.id === "string" &&
    typeof prompt.name === "string" &&
    typeof prompt.imageSrc === "string" &&
    (typeof prompt.category === "string" || prompt.category === undefined) &&
    Array.isArray(prompt.targetHsb) &&
    prompt.targetHsb.length === 3 &&
    prompt.targetHsb.every((channel) => typeof channel === "number") &&
    isDifficulty(prompt.difficulty)
  );
}

function isDifficulty(value: unknown): value is Difficulty {
  return value === "easy" || value === "hard" || value === "brutal";
}

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function isShortChallengeCode(value: string): boolean {
  return /^[a-zA-Z0-9]{6,10}$/.test(value);
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [copy[index], copy[swapIndex]] = [copy[swapIndex], copy[index]];
  }
  return copy;
}

function formatScoreDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "2-digit",
  }).format(date);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getEl<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing element #${id}`);
  return element as T;
}
