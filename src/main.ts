import { difficulties } from "./catalog";
import {
  cleanPlayerName,
  difficultyLabels,
  loadCategories,
  loadLeaderboard,
  loadPrompts,
  saveScore,
  type Difficulty,
  type LeaderboardEntry,
  type PromptItem,
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
  | "picker"
  | "result"
  | "total"
  | "leaderboard";

type RoundResult = {
  prompt: PromptItem;
  picked: HsbColor;
  score: number;
};

type CompareDragState = {
  pointerId: number;
  rect: DOMRect;
} | null;

const ROUND_COUNT = 5;
const STORAGE_THEME = "color_game_theme";
const STORAGE_MUTED = "color_game_muted";
const STORAGE_DIFFICULTY = "color_game_difficulty";
const STORAGE_CATEGORY = "color_game_category";
const STORAGE_PLAYER_NAME = "color_game_player_name";

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
let selectedDifficulty = readDifficulty();
let selectedCategory = localStorage.getItem(STORAGE_CATEGORY) || "all";
let leaderboardDifficulty: Difficulty = selectedDifficulty;
let pickerValueHideTimer: number | undefined;
let availableCategories: string[] = [];
let compareDragState: CompareDragState = null;

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
        <div class="intro-actions">
          <button id="startButton" class="mode-button soundable" type="button" aria-label="Start game">
            ${icons.target}
          </button>
          <button id="difficultyCycle" class="difficulty-cycle soundable" type="button" aria-label="Change difficulty">Easy</button>
          <div id="difficultyPill" class="round-pill" aria-label="Selected difficulty">Choose category</div>
        </div>
      </section>

      <section id="categoryScreen" class="screen category-screen" aria-label="Category selection">
        <button id="categoryBack" class="mini-close soundable" type="button" aria-label="Back to intro">Close</button>
        <h2>category</h2>
        <p>Pick a set of images for this run.</p>
        <div id="categoryList" class="category-choice-list"></div>
      </section>

      <section id="pickerScreen" class="screen picker-screen" aria-label="Color picker">
        <div id="pickerBg" class="picker-bg"></div>
        <div class="picker-meta">
          <span id="pickerRound">1/5</span>
          <span id="pickerDifficulty">Easy</span>
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
        <h2>total</h2>
        <div class="total-score">
          <span id="totalScore">0.00</span><span>/50</span>
        </div>
        <p id="totalMessage">Five colors, one score.</p>
        <div id="roundList" class="round-list"></div>
        <form id="scoreForm" class="score-form">
          <label for="playerNameInput">name</label>
          <input id="playerNameInput" maxlength="24" autocomplete="nickname" placeholder="nickname" />
          <button id="saveScoreButton" class="score-submit soundable" type="submit">Save</button>
        </form>
        <p id="scoreSaveStatus" class="score-save-status"></p>
      </section>

      <section id="leaderboardScreen" class="screen leaderboard-screen" aria-label="High scores">
        <button id="leaderboardClose" class="mini-close soundable" type="button" aria-label="Close high scores">Close</button>
        <h2>high scores</h2>
        <div id="leaderboardTabs" class="difficulty-tabs leaderboard-tabs" role="tablist" aria-label="Leaderboard difficulty"></div>
        <div id="leaderboardList" class="leaderboard-list" aria-live="polite"></div>
        <button id="leaderboardRefresh" class="mini-action soundable" type="button">Refresh</button>
      </section>
    </div>
  </main>

  <footer class="footer-links" aria-label="Footer links">
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
  pickerScreen: getEl<HTMLElement>("pickerScreen"),
  resultScreen: getEl<HTMLElement>("resultScreen"),
  totalScreen: getEl<HTMLElement>("totalScreen"),
  totalClose: getEl<HTMLButtonElement>("totalClose"),
  leaderboardScreen: getEl<HTMLElement>("leaderboardScreen"),
  startButton: getEl<HTMLButtonElement>("startButton"),
  difficultyCycle: getEl<HTMLButtonElement>("difficultyCycle"),
  categoryBack: getEl<HTMLButtonElement>("categoryBack"),
  categoryList: getEl<HTMLDivElement>("categoryList"),
  leaderboardGhost: getEl<HTMLButtonElement>("leaderboardGhost"),
  muteToggle: getEl<HTMLButtonElement>("muteToggle"),
  themeToggle: getEl<HTMLButtonElement>("themeToggle"),
  difficultyPill: getEl<HTMLDivElement>("difficultyPill"),
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
  roundList: getEl<HTMLDivElement>("roundList"),
  scoreForm: getEl<HTMLFormElement>("scoreForm"),
  playerNameInput: getEl<HTMLInputElement>("playerNameInput"),
  saveScoreButton: getEl<HTMLButtonElement>("saveScoreButton"),
  scoreSaveStatus: getEl<HTMLParagraphElement>("scoreSaveStatus"),
  leaderboardClose: getEl<HTMLButtonElement>("leaderboardClose"),
  leaderboardTabs: getEl<HTMLDivElement>("leaderboardTabs"),
  leaderboardList: getEl<HTMLDivElement>("leaderboardList"),
  leaderboardRefresh: getEl<HTMLButtonElement>("leaderboardRefresh"),
};

applyTheme();
updateMuteButton();
buildHueGradient();
updateDifficultyUi();
bindEvents();
void refreshCategoryOptions();
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
    openCategorySelection();
  });
  refs.difficultyCycle.addEventListener("click", () => {
    cycleDifficulty();
    sfx.click();
  });
  refs.categoryBack.addEventListener("click", () => {
    sfx.click();
    show("intro");
  });
  refs.leaderboardGhost.addEventListener("click", () => {
    sfx.click();
    openLeaderboard(selectedDifficulty, screen);
  });
  refs.submitButton.addEventListener("click", submitRound);
  refs.nextButton.addEventListener("click", nextRound);
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
  refs.resultClose.addEventListener("click", () => {
    sfx.click();
    show("intro");
  });
  refs.muteToggle.addEventListener("click", toggleMute);
  refs.themeToggle.addEventListener("click", toggleTheme);
  bindCompareDivider();
  window.addEventListener("resize", () => {
    buildHueGradient();
    updatePickerUi();
    setComparePosition(50);
  });
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

  const prompts = await loadPrompts(selectedDifficulty);
  const categoryPrompts =
    selectedCategory === "all"
      ? prompts
      : prompts.filter((prompt) => prompt.category === selectedCategory);
  queue = shuffle(categoryPrompts.length ? categoryPrompts : prompts).slice(
    0,
    ROUND_COUNT,
  );
  roundIndex = 0;
  results = [];

  refs.startButton.disabled = false;
  refs.startButton.removeAttribute("aria-busy");
  showPicker();
}

function showPicker(): void {
  const prompt = currentPrompt();
  pickerHsb = randomPickerDefault(prompt.targetHsb[0], selectedDifficulty);
  refs.pickerRound.textContent = `${roundIndex + 1}/${queue.length}`;
  refs.pickerDifficulty.textContent = difficultyLabels[selectedDifficulty];
  refs.pickerImage.src = prompt.imageSrc;
  refs.pickerImage.alt = `${prompt.name} transparent color prompt`;
  refs.pickerValues.parentElement?.classList.remove("active");
  updatePickerUi();
  show("picker");
}

function submitRound(): void {
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

function nextRound(): void {
  sfx.click();
  if (roundIndex >= queue.length - 1) {
    showTotal();
    return;
  }
  roundIndex += 1;
  showPicker();
}

function showTotal(): void {
  const total = totalScore();
  refs.totalScore.textContent = total.toFixed(2);
  refs.totalMessage.textContent = `${difficultyLabels[selectedDifficulty]} - ${totalMessage(total)}`;
  refs.roundList.innerHTML = results
    .map(
      (result, index) => `
        <div class="round-row">
          <span>${index + 1}</span>
          <strong>${escapeHtml(result.prompt.name)}</strong>
          <em>${result.score.toFixed(2)}</em>
        </div>
      `,
    )
    .join("");
  refs.playerNameInput.value =
    localStorage.getItem(STORAGE_PLAYER_NAME) || "";
  refs.scoreForm.classList.remove("is-saved");
  refs.saveScoreButton.disabled = false;
  refs.saveScoreButton.textContent = "Save";
  refs.scoreSaveStatus.textContent = "Save your score to enter the board.";
  refs.scoreSaveStatus.dataset.state = "idle";
  sfx.scoreLand();
  show("total");
}

async function submitFinalScore(): Promise<void> {
  const playerName = cleanPlayerName(refs.playerNameInput.value);
  refs.playerNameInput.value = playerName;
  refs.saveScoreButton.disabled = true;
  refs.saveScoreButton.textContent = "Saving";
  refs.scoreSaveStatus.textContent = "Saving score...";
  refs.scoreSaveStatus.dataset.state = "pending";

  try {
    const savedTo = await saveScore({
      playerName,
      totalScore: totalScore(),
      difficulty: selectedDifficulty,
      rounds: results.map((result) => ({
        promptId: result.prompt.id,
        promptName: result.prompt.name,
        picked: result.picked,
        target: result.prompt.targetHsb,
        score: Number(result.score.toFixed(2)),
      })),
    });
    localStorage.setItem(STORAGE_PLAYER_NAME, playerName);
    refs.scoreForm.classList.add("is-saved");
    refs.saveScoreButton.textContent = "Saved";
    refs.scoreSaveStatus.textContent =
      savedTo === "remote"
        ? "Saved to high scores."
        : "Saved locally. Supabase is unavailable.";
    refs.scoreSaveStatus.dataset.state = "success";
    sfx.scoreLand();
  } catch {
    refs.saveScoreButton.disabled = false;
    refs.saveScoreButton.textContent = "Save";
    refs.scoreSaveStatus.textContent = "Could not save. Try again.";
    refs.scoreSaveStatus.dataset.state = "error";
  }
}

function openLeaderboard(difficulty: Difficulty, returnTo: Screen): void {
  leaderboardDifficulty = difficulty;
  returnFromLeaderboard = returnTo === "leaderboard" ? "intro" : returnTo;
  renderLeaderboardTabs();
  show("leaderboard");
  void refreshLeaderboard();
}

async function refreshLeaderboard(): Promise<void> {
  const difficulty = leaderboardDifficulty;
  refs.leaderboardRefresh.disabled = true;
  refs.leaderboardList.innerHTML = `<div class="leaderboard-empty">Loading ${difficultyLabels[difficulty]} scores...</div>`;

  try {
    const entries = await loadLeaderboard(difficulty);
    if (difficulty !== leaderboardDifficulty) return;
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
  renderTabs(refs.leaderboardTabs, leaderboardDifficulty);

  refs.leaderboardTabs
    .querySelectorAll<HTMLButtonElement>("button")
    .forEach((button) => {
      button.addEventListener("click", () => {
        leaderboardDifficulty = button.dataset.difficulty as Difficulty;
        renderLeaderboardTabs();
        sfx.click();
        void refreshLeaderboard();
      });
      button.addEventListener("mouseenter", () => sfx.hover());
    });
}

function renderTabs(container: HTMLElement, active: Difficulty): void {
  container.innerHTML = difficulties
    .map(
      (difficulty) => `
        <button
          class="difficulty-tab ${difficulty === active ? "active" : ""}"
          type="button"
          role="tab"
          aria-selected="${difficulty === active}"
          data-difficulty="${difficulty}"
        >
          ${difficultyLabels[difficulty]}
        </button>
      `,
    )
    .join("");
}

function setDifficulty(difficulty: Difficulty): void {
  if (!difficulties.includes(difficulty)) return;
  selectedDifficulty = difficulty;
  leaderboardDifficulty = difficulty;
  localStorage.setItem(STORAGE_DIFFICULTY, difficulty);
  updateDifficultyUi();
}

function updateDifficultyUi(): void {
  refs.difficultyCycle.textContent = difficultyLabels[selectedDifficulty];
  refs.difficultyPill.textContent = "Choose category";
  refs.gameCard.dataset.difficulty = selectedDifficulty;
}

async function refreshCategoryOptions(): Promise<void> {
  availableCategories = await loadCategories();
  const values = ["all", ...availableCategories];
  if (!values.includes(selectedCategory)) selectedCategory = "all";
  if (screen === "category") renderCategoryChoices();
}

function openCategorySelection(): void {
  renderCategoryChoices();
  show("category");
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
        >
          <span>${category === "all" ? "All categories" : escapeHtml(category)}</span>
          <em>${difficultyLabels[selectedDifficulty]}</em>
        </button>
      `
    )
    .join("");
  refs.categoryList
    .querySelectorAll<HTMLButtonElement>("[data-category]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        selectedCategory = button.dataset.category || "all";
        localStorage.setItem(STORAGE_CATEGORY, selectedCategory);
        sfx.click();
        void startGame();
      });
      button.addEventListener("mouseenter", () => sfx.hover());
    });
}

function cycleDifficulty(): void {
  const currentIndex = difficulties.indexOf(selectedDifficulty);
  const next = difficulties[(currentIndex + 1) % difficulties.length];
  setDifficulty(next);
}

function show(nextScreen: Screen): void {
  screen = nextScreen;
  const map: Record<Screen, HTMLElement> = {
    intro: refs.introScreen,
    category: refs.categoryScreen,
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
  refs.pickerBg.style.background = selectedCss;
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

function readDifficulty(): Difficulty {
  const stored = localStorage.getItem(STORAGE_DIFFICULTY);
  if (stored === "hard" || stored === "brutal") return stored;
  return "easy";
}

function currentPrompt(): PromptItem {
  const prompt = queue[roundIndex];
  if (!prompt) throw new Error("No prompt available for the current round");
  return prompt;
}

function randomPickerDefault(
  targetHue: number,
  difficulty: Difficulty,
): HsbColor {
  const minHueGap = difficulty === "easy" ? 45 : difficulty === "hard" ? 90 : 130;
  let hue = Math.floor(Math.random() * 360);
  let guard = 0;
  while (hueDistance(hue, targetHue) < minHueGap && guard < 100) {
    hue = Math.floor(Math.random() * 360);
    guard += 1;
  }

  const saturationFloor = difficulty === "easy" ? 35 : 20;
  const brightnessFloor = difficulty === "brutal" ? 28 : 40;
  return [
    hue,
    saturationFloor + Math.floor(Math.random() * (92 - saturationFloor)),
    brightnessFloor + Math.floor(Math.random() * (96 - brightnessFloor)),
  ];
}

function pickerValueText(): string {
  if (selectedDifficulty === "easy") {
    return `H${pickerHsb[0]} S${pickerHsb[1]} B${pickerHsb[2]}`;
  }

  if (selectedDifficulty === "hard") return "adjust by sight";
  return "no readout";
}

function showPickerChannel(channel: "h" | "s" | "b"): void {
  if (pickerValueHideTimer) window.clearTimeout(pickerValueHideTimer);
  const channelLabels = {
    h: "HUE",
    s: "SATURATION",
    b: "BRIGHTNESS",
  };
  refs.pickerValueLabel.textContent = channelLabels[channel];
  refs.pickerValues.textContent = "";
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
