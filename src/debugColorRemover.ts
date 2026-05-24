import "./debugColorRemover.css";

type Pixel = {
  r: number;
  g: number;
  b: number;
  a: number;
};

type CanvasPoint = {
  x: number;
  y: number;
};

type PanState = {
  pointerId: number;
  startX: number;
  startY: number;
  scrollLeft: number;
  scrollTop: number;
} | null;

type ToolMode = "remove" | "paint";

type PlacementState = {
  image: HTMLImageElement;
  initialScale: number;
  scale: number;
  x: number;
  y: number;
};

type PlacementDragState = {
  pointerId: number;
  startX: number;
  startY: number;
  startPlacementX: number;
  startPlacementY: number;
} | null;

type PaintDragState = {
  pointerId: number;
} | null;

type Difficulty = "easy" | "hard" | "brutal";

type GeneratedPrompt = {
  slug: string;
  name: string;
  category: string;
  difficulty: Difficulty;
  imageSrc: string;
  targetHsb: [number, number, number];
  createdAt: string;
};

const GAME_IMAGE_SIZE = 1024;
const MIN_CANVAS_ZOOM = 0.1;
const MAX_CANVAS_ZOOM = 12;
const CANVAS_ZOOM_STEP = 1.18;

export function initDebugColorRemover(): void {
  const root = document.createElement("section");
  root.className = "debug-tools";
  root.innerHTML = `
    <button id="debugToolsToggle" class="debug-tools-toggle" type="button" aria-expanded="false" aria-controls="debugToolMenu">
      Tools
    </button>
    <div id="debugToolMenu" class="debug-tool-menu" aria-hidden="true">
      <button id="debugOpenRemover" class="debug-tool-action" type="button">Cor</button>
      <button id="debugOpenLibrary" class="debug-tool-action" type="button">Imgs</button>
    </div>
    <div id="debugToolsPanel" class="debug-tools-panel" aria-hidden="true">
      <aside class="debug-sidebar">
        <div class="debug-heading">
          <strong id="debugPanelTitle">Removedor de cor</strong>
          <button id="debugToolsClose" type="button" aria-label="Fechar ferramentas">x</button>
        </div>

        <div id="debugRemoverView">
          <p>Carregue uma imagem, enquadre no quadrado final e aplique antes de remover a cor.</p>

          <label for="debugFileInput">Imagem</label>
          <input id="debugFileInput" type="file" accept="image/*" />

          <div class="debug-tool-mode" role="group" aria-label="Modo da ferramenta">
            <button id="debugRemoveMode" class="active" type="button" data-mode="remove">Remover cor</button>
            <button id="debugPaintMode" type="button" data-mode="paint">Pintar</button>
          </div>

          <div class="debug-placement-controls">
            <label for="debugPlacementScale">Tamanho: <span id="debugPlacementScaleValue">100%</span></label>
            <input id="debugPlacementScale" type="range" min="25" max="300" value="100" disabled />

            <label for="debugPlacementX">Horizontal: <span id="debugPlacementXValue">0</span></label>
            <input id="debugPlacementX" type="range" min="-1024" max="1024" value="0" disabled />

            <label for="debugPlacementY">Vertical: <span id="debugPlacementYValue">0</span></label>
            <input id="debugPlacementY" type="range" min="-1024" max="1024" value="0" disabled />
          </div>

          <div id="debugPaintControls" class="debug-paint-controls" hidden>
            <label for="debugPaintColor">Cor da pintura</label>
            <input id="debugPaintColor" type="color" value="#ffffff" />

            <label for="debugBrushSize">Pincel: <span id="debugBrushSizeValue">36</span></label>
            <input id="debugBrushSize" type="range" min="4" max="160" value="36" />
          </div>

          <div id="debugRemoveControls" class="debug-remove-controls">
            <label for="debugTolerance">Tolerancia: <span id="debugToleranceValue">35</span></label>
            <input id="debugTolerance" type="range" min="0" max="150" value="35" />

            <label for="debugSoftness">Borda suave: <span id="debugSoftnessValue">20</span></label>
            <input id="debugSoftness" type="range" min="0" max="100" value="20" />

            <label class="debug-check">
              <input id="debugDiagonal" type="checkbox" checked />
              Conectar diagonais
            </label>

            <div class="debug-color-box">
              <div id="debugSwatch" class="debug-swatch"></div>
              <div>
                <span>Cor selecionada</span>
                <strong id="debugColorText">Nenhuma</strong>
              </div>
            </div>
          </div>
          <p id="debugStatus" class="debug-status">Escolha uma imagem para comecar.</p>

          <button id="debugUndoButton" class="debug-secondary" type="button" disabled>Desfazer</button>
          <button id="debugResetButton" class="debug-secondary" type="button" disabled>Restaurar imagem</button>
          <button id="debugApplyButton" class="debug-secondary" type="button" disabled>Aplicar mudanças</button>
          <button id="debugDownloadButton" type="button" disabled>Baixar PNG transparente</button>
          <button id="debugSaveOpenButton" type="button" disabled>Salvar para o jogo</button>

          <form id="debugSaveForm" class="debug-save-form" hidden>
            <label for="debugPromptName">Nome</label>
            <input id="debugPromptName" type="text" maxlength="48" placeholder="Hulk verde" />

            <label for="debugPromptSlug">Slug</label>
            <input id="debugPromptSlug" type="text" maxlength="64" placeholder="hulk-verde" />

            <label for="debugPromptCategory">Categoria</label>
            <select id="debugPromptCategory"></select>
            <input id="debugNewCategory" type="text" maxlength="40" placeholder="Nova categoria" />

            <div class="debug-save-preview">
              <span>Cor alvo</span>
              <strong id="debugTargetHsb">Selecione uma cor</strong>
            </div>

            <button id="debugSaveButton" type="submit">Salvar prompt</button>
          </form>
        </div>

        <div id="debugLibraryView" class="debug-library-sidebar" hidden>
          <p>Escolha uma categoria para ver os prompts salvos localmente.</p>
          <div id="debugCategoryList" class="debug-category-list"></div>
          <p id="debugLibraryStatus" class="debug-status"></p>
        </div>
      </aside>
      <main id="debugCanvasWrap" class="debug-canvas-wrap">
        <canvas id="debugCanvas"></canvas>
      </main>
      <main id="debugLibraryPanel" class="debug-library-panel" hidden>
        <div id="debugPromptGrid" class="debug-prompt-grid"></div>
      </main>
    </div>
  `;

  document.body.append(root);

  const toggleButton = getDebugEl<HTMLButtonElement>("debugToolsToggle");
  const toolMenu = getDebugEl<HTMLDivElement>("debugToolMenu");
  const openRemoverButton = getDebugEl<HTMLButtonElement>("debugOpenRemover");
  const openLibraryButton = getDebugEl<HTMLButtonElement>("debugOpenLibrary");
  const closeButton = getDebugEl<HTMLButtonElement>("debugToolsClose");
  const panel = getDebugEl<HTMLDivElement>("debugToolsPanel");
  const panelTitle = getDebugEl<HTMLElement>("debugPanelTitle");
  const removerView = getDebugEl<HTMLDivElement>("debugRemoverView");
  const libraryView = getDebugEl<HTMLDivElement>("debugLibraryView");
  const canvasWrap = getDebugEl<HTMLElement>("debugCanvasWrap");
  const libraryPanel = getDebugEl<HTMLElement>("debugLibraryPanel");
  const categoryList = getDebugEl<HTMLDivElement>("debugCategoryList");
  const libraryStatus = getDebugEl<HTMLParagraphElement>("debugLibraryStatus");
  const promptGrid = getDebugEl<HTMLDivElement>("debugPromptGrid");
  const fileInput = getDebugEl<HTMLInputElement>("debugFileInput");
  const removeModeButton = getDebugEl<HTMLButtonElement>("debugRemoveMode");
  const paintModeButton = getDebugEl<HTMLButtonElement>("debugPaintMode");
  const removeControls = getDebugEl<HTMLDivElement>("debugRemoveControls");
  const paintControls = getDebugEl<HTMLDivElement>("debugPaintControls");
  const placementScaleInput = getDebugEl<HTMLInputElement>("debugPlacementScale");
  const placementScaleValue = getDebugEl<HTMLSpanElement>("debugPlacementScaleValue");
  const placementXInput = getDebugEl<HTMLInputElement>("debugPlacementX");
  const placementXValue = getDebugEl<HTMLSpanElement>("debugPlacementXValue");
  const placementYInput = getDebugEl<HTMLInputElement>("debugPlacementY");
  const placementYValue = getDebugEl<HTMLSpanElement>("debugPlacementYValue");
  const paintColorInput = getDebugEl<HTMLInputElement>("debugPaintColor");
  const brushSizeInput = getDebugEl<HTMLInputElement>("debugBrushSize");
  const brushSizeValue = getDebugEl<HTMLSpanElement>("debugBrushSizeValue");
  const toleranceInput = getDebugEl<HTMLInputElement>("debugTolerance");
  const toleranceValue = getDebugEl<HTMLSpanElement>("debugToleranceValue");
  const softnessInput = getDebugEl<HTMLInputElement>("debugSoftness");
  const softnessValue = getDebugEl<HTMLSpanElement>("debugSoftnessValue");
  const diagonalInput = getDebugEl<HTMLInputElement>("debugDiagonal");
  const colorText = getDebugEl<HTMLElement>("debugColorText");
  const swatch = getDebugEl<HTMLDivElement>("debugSwatch");
  const status = getDebugEl<HTMLParagraphElement>("debugStatus");
  const undoButton = getDebugEl<HTMLButtonElement>("debugUndoButton");
  const resetButton = getDebugEl<HTMLButtonElement>("debugResetButton");
  const applyButton = getDebugEl<HTMLButtonElement>("debugApplyButton");
  const downloadButton = getDebugEl<HTMLButtonElement>("debugDownloadButton");
  const saveOpenButton = getDebugEl<HTMLButtonElement>("debugSaveOpenButton");
  const saveForm = getDebugEl<HTMLFormElement>("debugSaveForm");
  const promptNameInput = getDebugEl<HTMLInputElement>("debugPromptName");
  const promptSlugInput = getDebugEl<HTMLInputElement>("debugPromptSlug");
  const promptCategoryInput = getDebugEl<HTMLSelectElement>("debugPromptCategory");
  const newCategoryInput = getDebugEl<HTMLInputElement>("debugNewCategory");
  const targetHsbText = getDebugEl<HTMLElement>("debugTargetHsb");
  const canvas = getDebugEl<HTMLCanvasElement>("debugCanvas");
  const canvasContext = canvas.getContext("2d", { willReadFrequently: true });
  if (!canvasContext) throw new Error("Canvas 2D is not available");
  const ctx = canvasContext;
  const paintLayerCanvas = document.createElement("canvas");
  paintLayerCanvas.width = GAME_IMAGE_SIZE;
  paintLayerCanvas.height = GAME_IMAGE_SIZE;
  const paintLayerContext = paintLayerCanvas.getContext("2d", {
    willReadFrequently: true,
  });
  if (!paintLayerContext) throw new Error("Canvas 2D is not available");
  const paintCtx = paintLayerContext;

  let originalImageData: ImageData | null = null;
  let currentImageData: ImageData | null = null;
  let selectedTarget: Pixel | null = null;
  let undoStack: ImageData[] = [];
  let libraryPrompts: GeneratedPrompt[] = [];
  let selectedLibraryCategory = "";
  let toolMode: ToolMode = "remove";
  let placementState: PlacementState | null = null;
  let placementDragState: PlacementDragState = null;
  let paintDragState: PaintDragState = null;
  let canvasZoom = 1;
  let panState: PanState = null;

  const setMenuOpen = (isOpen: boolean) => {
    root.classList.toggle("is-menu-open", isOpen);
    toggleButton.setAttribute("aria-expanded", String(isOpen));
    toolMenu.setAttribute("aria-hidden", String(!isOpen));
  };

  const setOpen = (isOpen: boolean, view: "remover" | "library" = "remover") => {
    root.classList.toggle("is-open", isOpen);
    panel.setAttribute("aria-hidden", String(!isOpen));
    if (isOpen) {
      setMenuOpen(false);
      setView(view);
    }
  };

  const setView = (view: "remover" | "library") => {
    const isLibrary = view === "library";
    panelTitle.textContent = isLibrary ? "Biblioteca" : "Removedor de cor";
    removerView.hidden = isLibrary;
    canvasWrap.hidden = isLibrary;
    libraryView.hidden = !isLibrary;
    libraryPanel.hidden = !isLibrary;
    if (isLibrary) void refreshLibrary();
  };

  toggleButton.addEventListener("click", () => {
    setMenuOpen(!root.classList.contains("is-menu-open"));
  });
  openRemoverButton.addEventListener("click", () => setOpen(true, "remover"));
  openLibraryButton.addEventListener("click", () => setOpen(true, "library"));
  closeButton.addEventListener("click", () => setOpen(false));
  void refreshCategories();

  removeModeButton.addEventListener("click", () => setToolMode("remove"));
  paintModeButton.addEventListener("click", () => setToolMode("paint"));
  brushSizeInput.addEventListener("input", () => {
    brushSizeValue.textContent = brushSizeInput.value;
  });
  placementScaleInput.addEventListener("input", updatePlacementScale);
  placementXInput.addEventListener("input", updatePlacementOffset);
  placementYInput.addEventListener("input", updatePlacementOffset);
  toleranceInput.addEventListener("input", () => {
    toleranceValue.textContent = toleranceInput.value;
  });
  softnessInput.addEventListener("input", () => {
    softnessValue.textContent = softnessInput.value;
  });

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;

    const image = await loadDebugImage(file);
    canvas.width = GAME_IMAGE_SIZE;
    canvas.height = GAME_IMAGE_SIZE;
    clearPaintLayer();
    placementState = initialPlacementState(image);
    currentImageData = null;
    originalImageData = null;
    undoStack = [];
    selectedTarget = null;
    canvasZoom = getInitialCanvasZoom();
    renderPlacementPreview();
    syncPlacementControls();
    applyCanvasZoom();
    centerCanvasInView();
    colorText.textContent = "Nenhuma";
    swatch.style.background = "transparent";
    targetHsbText.textContent = "Selecione uma cor";
    status.textContent =
      "Ajuste a imagem no quadrado final, pinte as sobras transparentes se quiser e clique em Aplicar mudancas.";
    setToolMode("remove");
    updateButtons();
  });

  canvas.addEventListener(
    "wheel",
    (event) => {
      if (!currentImageData) return;
      event.preventDefault();

      const nextZoom =
        event.deltaY < 0
          ? canvasZoom * CANVAS_ZOOM_STEP
          : canvasZoom / CANVAS_ZOOM_STEP;
      setCanvasZoom(nextZoom, event);
    },
    { passive: false },
  );

  canvasWrap.addEventListener("pointerdown", (event) => {
    if (!currentImageData || event.button !== 0 || event.target === canvas) return;
    panState = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      scrollLeft: canvasWrap.scrollLeft,
      scrollTop: canvasWrap.scrollTop,
    };
    canvasWrap.setPointerCapture(event.pointerId);
    canvasWrap.classList.add("is-panning");
    event.preventDefault();
  });

  canvasWrap.addEventListener("pointermove", (event) => {
    if (!panState || event.pointerId !== panState.pointerId) return;
    canvasWrap.scrollLeft = panState.scrollLeft - (event.clientX - panState.startX);
    canvasWrap.scrollTop = panState.scrollTop - (event.clientY - panState.startY);
  });

  canvasWrap.addEventListener("pointerup", (event) => {
    if (panState?.pointerId !== event.pointerId) return;
    panState = null;
    canvasWrap.classList.remove("is-panning");
  });

  canvasWrap.addEventListener("pointercancel", (event) => {
    if (panState?.pointerId !== event.pointerId) return;
    panState = null;
    canvasWrap.classList.remove("is-panning");
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (event.button !== 0) return;
    if (placementState && toolMode === "remove") {
      placementDragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        startPlacementX: placementState.x,
        startPlacementY: placementState.y,
      };
      canvas.setPointerCapture(event.pointerId);
      event.preventDefault();
      return;
    }
    if (toolMode !== "paint") return;
    if (!placementState && !currentImageData) return;

    if (currentImageData) undoStack.push(cloneImageData(currentImageData));
    paintDragState = { pointerId: event.pointerId };
    canvas.setPointerCapture(event.pointerId);
    paintTransparentPixels(getCanvasPoint(canvas, event));
    event.preventDefault();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (placementDragState?.pointerId === event.pointerId && placementState) {
      placementState.x =
        placementDragState.startPlacementX + (event.clientX - placementDragState.startX) / canvasZoom;
      placementState.y =
        placementDragState.startPlacementY + (event.clientY - placementDragState.startY) / canvasZoom;
      renderPlacementPreview();
      syncPlacementControls();
      event.preventDefault();
      return;
    }
    if (paintDragState?.pointerId !== event.pointerId) return;
    paintTransparentPixels(getCanvasPoint(canvas, event));
    event.preventDefault();
  });

  canvas.addEventListener("pointerup", (event) => {
    if (placementDragState?.pointerId === event.pointerId) {
      placementDragState = null;
      if (canvas.hasPointerCapture(event.pointerId)) {
        canvas.releasePointerCapture(event.pointerId);
      }
      return;
    }
    if (paintDragState?.pointerId !== event.pointerId) return;
    paintDragState = null;
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    updateButtons();
  });

  canvas.addEventListener("pointercancel", (event) => {
    if (placementDragState?.pointerId === event.pointerId) {
      placementDragState = null;
    }
    if (paintDragState?.pointerId === event.pointerId) {
      paintDragState = null;
    }
    if (canvas.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    updateButtons();
  });

  canvas.addEventListener("click", (event) => {
    if (toolMode === "paint") return;
    if (placementState) {
      status.textContent = "Clique em Aplicar mudancas antes de remover cor.";
      return;
    }
    if (!currentImageData) return;

    const point = getCanvasPoint(canvas, event);
    const picked = getPixel(currentImageData, point.x, point.y);
    if (picked.a === 0) {
      status.textContent = "Esse ponto ja esta transparente.";
      return;
    }

    undoStack.push(cloneImageData(currentImageData));
    selectedTarget = picked;
    colorText.textContent = rgbToHex(picked.r, picked.g, picked.b);
    swatch.style.background = `rgb(${picked.r}, ${picked.g}, ${picked.b})`;
    targetHsbText.textContent = hsbText(rgbToHsb(picked.r, picked.g, picked.b));

    const result = removeContiguousColor({
      imageData: currentImageData,
      start: point,
      target: picked,
      tolerance: Number(toleranceInput.value),
      softness: Number(softnessInput.value),
      connectDiagonals: diagonalInput.checked,
    });

    currentImageData = result.imageData;
    ctx.putImageData(currentImageData, 0, 0);
    status.textContent = `${result.removedPixels.toLocaleString()} pixels removidos nesta area.`;
    updateButtons();
  });

  undoButton.addEventListener("click", undoLastRemoval);

  document.addEventListener("keydown", (event) => {
    const isUndoShortcut =
      event.key.toLowerCase() === "z" && (event.ctrlKey || event.metaKey);
    if (!isUndoShortcut || !root.classList.contains("is-open")) return;
    if (isTextEditingElement(document.activeElement)) return;
    if (undoButton.disabled) return;

    event.preventDefault();
    undoLastRemoval();
  });

  function undoLastRemoval(): void {
    const previous = undoStack.pop();
    if (!previous) return;

    currentImageData = previous;
    ctx.putImageData(currentImageData, 0, 0);
    status.textContent = "Ultima remocao desfeita.";
    updateButtons();
  }

  resetButton.addEventListener("click", () => {
    if (placementState) {
      placementState = initialPlacementState(placementState.image);
      clearPaintLayer();
      renderPlacementPreview();
      syncPlacementControls();
      undoStack = [];
      selectedTarget = null;
      colorText.textContent = "Nenhuma";
      swatch.style.background = "transparent";
      targetHsbText.textContent = "Selecione uma cor";
      status.textContent = "Enquadramento restaurado.";
      updateButtons();
      return;
    }

    if (!originalImageData) return;

    currentImageData = cloneImageData(originalImageData);
    ctx.putImageData(currentImageData, 0, 0);
    undoStack = [];
    selectedTarget = null;
    canvasZoom = getInitialCanvasZoom();
    applyCanvasZoom();
    centerCanvasInView();
    colorText.textContent = "Clique na imagem";
    swatch.style.background = "transparent";
    targetHsbText.textContent = "Selecione uma cor";
    status.textContent = "Imagem restaurada.";
    updateButtons();
  });

  applyButton.addEventListener("click", () => {
    if (!placementState && !currentImageData) return;

    if (placementState) renderPlacementPreview();
    currentImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    originalImageData = cloneImageData(currentImageData);
    placementState = null;
    placementDragState = null;
    clearPaintLayer();
    undoStack = [];
    selectedTarget = null;
    colorText.textContent = "Clique na imagem";
    swatch.style.background = "transparent";
    targetHsbText.textContent = "Selecione uma cor";
    status.textContent =
      "Mudancas aplicadas. Agora remova a cor alvo ou pinte areas transparentes.";
    syncPlacementControls();
    updateButtons();
  });

  downloadButton.addEventListener("click", () => {
    if (!currentImageData) return;

    const link = document.createElement("a");
    link.download = "imagem-com-area-removida.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  });

  saveOpenButton.addEventListener("click", () => {
    saveForm.hidden = !saveForm.hidden;
    if (!saveForm.hidden && !promptNameInput.value) promptNameInput.focus();
  });

  promptNameInput.addEventListener("input", () => {
    if (promptSlugInput.dataset.edited === "1") return;
    promptSlugInput.value = slugify(promptNameInput.value);
  });
  promptSlugInput.addEventListener("input", () => {
    promptSlugInput.dataset.edited = "1";
    promptSlugInput.value = slugify(promptSlugInput.value);
  });

  saveForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!currentImageData || !selectedTarget) return;

    const category =
      newCategoryInput.value.trim() || promptCategoryInput.value.trim();
    const targetHsb = rgbToHsb(selectedTarget.r, selectedTarget.g, selectedTarget.b);

    status.textContent = "Salvando no projeto...";
    try {
      const response = await fetch("/__debug/save-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: promptNameInput.value,
          slug: promptSlugInput.value,
          difficulty: "all",
          category,
          targetHsb,
          imageDataUrl: renderGameImage(canvas),
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        categories?: string[];
        imageSrc?: string;
      };
      if (!response.ok) throw new Error(payload.error || "Falha ao salvar");

      renderCategoryOptions(payload.categories || [], category);
      window.dispatchEvent(new CustomEvent("color-game:prompts-updated"));
      void refreshLibrary();
      clearCurrentImage();
      newCategoryInput.value = "";
      status.textContent = `Prompt salvo: ${payload.imageSrc}. Pronto para a proxima imagem.`;
    } catch (error) {
      status.textContent =
        error instanceof Error ? error.message : "Nao foi possivel salvar.";
    }
    updateButtons();
  });

  function updateButtons(): void {
    const hasImage = Boolean(currentImageData || placementState);
    undoButton.disabled = undoStack.length === 0;
    resetButton.disabled = !hasImage;
    applyButton.disabled = !hasImage;
    downloadButton.disabled = !currentImageData;
    saveOpenButton.disabled = !currentImageData || !selectedTarget;
    placementScaleInput.disabled = !placementState;
    placementXInput.disabled = !placementState;
    placementYInput.disabled = !placementState;
  }

  function setToolMode(mode: ToolMode): void {
    toolMode = mode;
    removeModeButton.classList.toggle("active", mode === "remove");
    paintModeButton.classList.toggle("active", mode === "paint");
    removeControls.hidden = mode !== "remove";
    paintControls.hidden = mode !== "paint";
    canvasWrap.dataset.tool = mode;
    status.textContent =
      mode === "paint"
        ? "Pinte apenas pixels transparentes com a cor escolhida."
        : placementState
          ? "Arraste a imagem ou use os controles de enquadramento antes de aplicar."
          : "Clique na area que quer apagar.";
  }

  function initialPlacementState(image: HTMLImageElement): PlacementState {
    const scale = Math.min(
      GAME_IMAGE_SIZE / image.width,
      GAME_IMAGE_SIZE / image.height,
    );
    const width = image.width * scale;
    const height = image.height * scale;
    return {
      image,
      initialScale: scale,
      scale,
      x: (GAME_IMAGE_SIZE - width) / 2,
      y: (GAME_IMAGE_SIZE - height) / 2,
    };
  }

  function renderPlacementPreview(): void {
    if (!placementState) return;

    ctx.clearRect(0, 0, GAME_IMAGE_SIZE, GAME_IMAGE_SIZE);
    ctx.drawImage(paintLayerCanvas, 0, 0);
    ctx.drawImage(
      placementState.image,
      placementState.x,
      placementState.y,
      placementState.image.width * placementState.scale,
      placementState.image.height * placementState.scale,
    );
  }

  function clearPaintLayer(): void {
    paintCtx.clearRect(0, 0, GAME_IMAGE_SIZE, GAME_IMAGE_SIZE);
  }

  function updatePlacementScale(): void {
    if (!placementState) return;

    const previousWidth = placementState.image.width * placementState.scale;
    const previousHeight = placementState.image.height * placementState.scale;
    const centerX = placementState.x + previousWidth / 2;
    const centerY = placementState.y + previousHeight / 2;
    placementState.scale =
      placementState.initialScale * (Number(placementScaleInput.value) / 100);
    const nextWidth = placementState.image.width * placementState.scale;
    const nextHeight = placementState.image.height * placementState.scale;
    placementState.x = centerX - nextWidth / 2;
    placementState.y = centerY - nextHeight / 2;
    renderPlacementPreview();
    syncPlacementControls();
  }

  function updatePlacementOffset(): void {
    if (!placementState) return;

    const width = placementState.image.width * placementState.scale;
    const height = placementState.image.height * placementState.scale;
    placementState.x =
      (GAME_IMAGE_SIZE - width) / 2 + Number(placementXInput.value);
    placementState.y =
      (GAME_IMAGE_SIZE - height) / 2 + Number(placementYInput.value);
    renderPlacementPreview();
    syncPlacementControls();
  }

  function syncPlacementControls(): void {
    if (!placementState) {
      placementScaleInput.value = "100";
      placementScaleValue.textContent = "100%";
      placementXInput.value = "0";
      placementXValue.textContent = "0";
      placementYInput.value = "0";
      placementYValue.textContent = "0";
      return;
    }

    const width = placementState.image.width * placementState.scale;
    const height = placementState.image.height * placementState.scale;
    const centerX = (GAME_IMAGE_SIZE - width) / 2;
    const centerY = (GAME_IMAGE_SIZE - height) / 2;
    const scalePercent = Math.round(
      (placementState.scale / placementState.initialScale) * 100,
    );
    const offsetX = Math.round(placementState.x - centerX);
    const offsetY = Math.round(placementState.y - centerY);
    placementScaleInput.value = String(clamp(scalePercent, 25, 300));
    placementScaleValue.textContent = `${scalePercent}%`;
    placementXInput.value = String(clamp(offsetX, -1024, 1024));
    placementXValue.textContent = String(offsetX);
    placementYInput.value = String(clamp(offsetY, -1024, 1024));
    placementYValue.textContent = String(offsetY);
    updateButtons();
  }

  function paintTransparentPixels(point: CanvasPoint): void {
    const color = hexToRgb(paintColorInput.value);
    const radius = Math.max(1, Number(brushSizeInput.value) / 2);
    const minX = Math.max(0, Math.floor(point.x - radius));
    const maxX = Math.min(GAME_IMAGE_SIZE - 1, Math.ceil(point.x + radius));
    const minY = Math.max(0, Math.floor(point.y - radius));
    const maxY = Math.min(GAME_IMAGE_SIZE - 1, Math.ceil(point.y + radius));

    if (placementState) {
      const composite = ctx.getImageData(0, 0, GAME_IMAGE_SIZE, GAME_IMAGE_SIZE);
      const layer = paintCtx.getImageData(0, 0, GAME_IMAGE_SIZE, GAME_IMAGE_SIZE);
      paintTransparentRegion(layer, composite, color, point, radius, minX, maxX, minY, maxY);
      paintCtx.putImageData(layer, 0, 0);
      renderPlacementPreview();
      status.textContent = "Pintura aplicada nas areas transparentes.";
      return;
    }
    if (!currentImageData) return;

    const next = cloneImageData(currentImageData);
    paintTransparentRegion(next, currentImageData, color, point, radius, minX, maxX, minY, maxY);
    currentImageData = next;
    ctx.putImageData(currentImageData, 0, 0);
    status.textContent = "Pintura aplicada nas areas transparentes.";
  }

  function setCanvasZoom(nextZoom: number, anchor?: MouseEvent): void {
    const previousRect = canvas.getBoundingClientRect();
    const previousScrollLeft = canvasWrap.scrollLeft;
    const previousScrollTop = canvasWrap.scrollTop;
    const anchorX = anchor ? anchor.clientX - previousRect.left : previousRect.width / 2;
    const anchorY = anchor ? anchor.clientY - previousRect.top : previousRect.height / 2;
    const ratioX = previousRect.width ? anchorX / previousRect.width : 0.5;
    const ratioY = previousRect.height ? anchorY / previousRect.height : 0.5;

    canvasZoom = Math.min(MAX_CANVAS_ZOOM, Math.max(MIN_CANVAS_ZOOM, nextZoom));
    applyCanvasZoom();

    const nextRect = canvas.getBoundingClientRect();
    if (!anchor) {
      centerCanvasInView();
      return;
    }

    canvasWrap.scrollLeft =
      previousScrollLeft + nextRect.width * ratioX - previousRect.width * ratioX;
    canvasWrap.scrollTop =
      previousScrollTop + nextRect.height * ratioY - previousRect.height * ratioY;
  }

  function applyCanvasZoom(): void {
    if (!canvas.width || !canvas.height) {
      canvas.style.removeProperty("width");
      canvas.style.removeProperty("height");
      canvas.style.removeProperty("margin");
      return;
    }

    canvas.style.width = `${canvas.width * canvasZoom}px`;
    canvas.style.height = `${canvas.height * canvasZoom}px`;
    const availableHeight = Math.max(0, canvasWrap.clientHeight - 36);
    const visualHeight = canvas.height * canvasZoom;
    const verticalMargin = Math.max(0, (availableHeight - visualHeight) / 2);
    canvas.style.margin = `${verticalMargin}px auto`;
  }

  function centerCanvasInView(): void {
    window.requestAnimationFrame(() => {
      canvasWrap.scrollLeft = Math.max(0, (canvasWrap.scrollWidth - canvasWrap.clientWidth) / 2);
      canvasWrap.scrollTop = Math.max(0, (canvasWrap.scrollHeight - canvasWrap.clientHeight) / 2);
    });
  }

  function getInitialCanvasZoom(): number {
    if (!canvas.width || !canvas.height) return 1;

    const horizontalPadding = 36;
    const verticalPadding = 36;
    const availableWidth = Math.max(1, canvasWrap.clientWidth - horizontalPadding);
    const availableHeight = Math.max(1, canvasWrap.clientHeight - verticalPadding);
    return Math.max(
      MIN_CANVAS_ZOOM,
      Math.min(1, availableWidth / canvas.width, availableHeight / canvas.height),
    );
  }

  function clearCurrentImage(): void {
    currentImageData = null;
    originalImageData = null;
    placementState = null;
    placementDragState = null;
    paintDragState = null;
    selectedTarget = null;
    undoStack = [];
    clearPaintLayer();
    fileInput.value = "";
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    canvas.removeAttribute("width");
    canvas.removeAttribute("height");
    canvasZoom = 1;
    applyCanvasZoom();
    colorText.textContent = "Nenhuma";
    swatch.style.background = "transparent";
    targetHsbText.textContent = "Selecione uma cor";
    promptNameInput.value = "";
    promptSlugInput.value = "";
    delete promptSlugInput.dataset.edited;
    saveForm.hidden = true;
    syncPlacementControls();
  }

  async function refreshCategories(): Promise<void> {
    try {
      const response = await fetch("/__debug/prompt-options", { cache: "no-store" });
      const payload = (await response.json()) as {
        categories?: string[];
        prompts?: GeneratedPrompt[];
      };
      renderCategoryOptions(payload.categories || []);
    } catch {
      renderCategoryOptions([]);
    }
  }

  function renderCategoryOptions(categories: string[], selected = ""): void {
    const values = categories.length ? categories : ["Geral"];
    promptCategoryInput.innerHTML = values
      .map(
        (category) =>
          `<option value="${escapeHtml(category)}" ${
            category === selected ? "selected" : ""
          }>${escapeHtml(category)}</option>`,
      )
      .join("");
  }

  async function refreshLibrary(): Promise<void> {
    libraryStatus.textContent = "Carregando biblioteca...";
    try {
      const response = await fetch("/__debug/prompt-options", { cache: "no-store" });
      const payload = (await response.json()) as {
        error?: string;
        prompts?: GeneratedPrompt[];
      };
      if (!response.ok) throw new Error(payload.error || "Falha ao carregar");

      libraryPrompts = payload.prompts || [];
      const categories = categoriesFromPrompts(libraryPrompts);
      selectedLibraryCategory =
        categories.includes(selectedLibraryCategory)
          ? selectedLibraryCategory
          : categories[0] || "";
      renderLibraryCategories(categories);
      renderLibraryGrid();
      libraryStatus.textContent = libraryPrompts.length
        ? `${libraryPrompts.length} cadastro(s) local(is).`
        : "Nenhum prompt local salvo ainda.";
    } catch (error) {
      libraryStatus.textContent =
        error instanceof Error ? error.message : "Nao foi possivel carregar.";
    }
  }

  function renderLibraryCategories(categories: string[]): void {
    categoryList.innerHTML = categories.length
      ? categories
          .map(
            (category) => `
              <button
                class="debug-category-button ${
                  category === selectedLibraryCategory ? "active" : ""
                }"
                type="button"
                data-category="${escapeHtml(category)}"
              >
                <span></span>${escapeHtml(category)}
              </button>
            `,
          )
          .join("")
      : '<div class="debug-empty">Sem categorias.</div>';

    categoryList
      .querySelectorAll<HTMLButtonElement>("[data-category]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          selectedLibraryCategory = button.dataset.category || "";
          renderLibraryCategories(categories);
          renderLibraryGrid();
        });
      });
  }

  function renderLibraryGrid(): void {
    const prompts = groupedLibraryPrompts()
      .filter((prompt) => prompt.category === selectedLibraryCategory);

    promptGrid.innerHTML = prompts.length
      ? prompts
          .map(
            (prompt) => `
              <article class="debug-prompt-card">
                <div class="debug-prompt-preview">
                  <img src="${escapeHtml(prompt.imageSrc)}?v=${encodeURIComponent(
                    prompt.createdAt,
                  )}" alt="" />
                </div>
                <div class="debug-prompt-meta">
                  <strong>${escapeHtml(prompt.name)}</strong>
                  <span>${escapeHtml(prompt.slug)}</span>
                </div>
                <button type="button" data-delete-slug="${escapeHtml(
                  prompt.slug,
                )}">Remover</button>
              </article>
            `,
          )
          .join("")
      : '<div class="debug-empty">Nenhuma imagem nesta categoria.</div>';

    promptGrid
      .querySelectorAll<HTMLButtonElement>("[data-delete-slug]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          void deletePrompt(button.dataset.deleteSlug || "");
        });
      });
  }

  function groupedLibraryPrompts(): Array<
    GeneratedPrompt & { difficulties: Difficulty[] }
  > {
    const bySlug = new Map<string, GeneratedPrompt & { difficulties: Difficulty[] }>();
    for (const prompt of libraryPrompts) {
      const existing = bySlug.get(prompt.slug);
      if (existing) {
        existing.difficulties.push(prompt.difficulty);
        continue;
      }
      bySlug.set(prompt.slug, { ...prompt, difficulties: [prompt.difficulty] });
    }
    return Array.from(bySlug.values());
  }

  async function deletePrompt(slug: string): Promise<void> {
    if (!slug) return;
    if (!window.confirm(`Remover "${slug}" da biblioteca local?`)) return;

    libraryStatus.textContent = "Removendo prompt...";
    try {
      const response = await fetch("/__debug/delete-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const payload = (await response.json()) as {
        error?: string;
        prompts?: GeneratedPrompt[];
      };
      if (!response.ok) throw new Error(payload.error || "Falha ao remover");

      window.dispatchEvent(new CustomEvent("color-game:prompts-updated"));
      await refreshLibrary();
      libraryStatus.textContent = "Prompt removido.";
    } catch (error) {
      libraryStatus.textContent =
        error instanceof Error ? error.message : "Nao foi possivel remover.";
    }
  }
}

function isTextEditingElement(element: Element | null): boolean {
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) {
    return ["", "email", "number", "password", "search", "tel", "text", "url"].includes(
      element.type,
    );
  }
  return element instanceof HTMLElement && element.isContentEditable;
}

function removeContiguousColor(options: {
  imageData: ImageData;
  start: CanvasPoint;
  target: Pixel;
  tolerance: number;
  softness: number;
  connectDiagonals: boolean;
}): { imageData: ImageData; removedPixels: number } {
  const { imageData, start, target, tolerance, softness, connectDiagonals } =
    options;
  const { width, height } = imageData;
  const source = imageData.data;
  const data = new Uint8ClampedArray(source);
  const visited = new Uint8Array(width * height);
  const selected = new Uint8Array(width * height);
  const stack = [start.y * width + start.x];
  const neighbors = connectDiagonals
    ? [-width, width, -1, 1, -width - 1, -width + 1, width - 1, width + 1]
    : [-width, width, -1, 1];
  let removedPixels = 0;

  while (stack.length) {
    const pixelIndex = stack.pop();
    if (pixelIndex === undefined || visited[pixelIndex]) continue;
    visited[pixelIndex] = 1;

    const offset = pixelIndex * 4;
    const alpha = source[offset + 3];
    if (alpha === 0) continue;

    const distance = colorDistance(
      source[offset],
      source[offset + 1],
      source[offset + 2],
      target.r,
      target.g,
      target.b,
    );
    if (distance > tolerance) continue;

    selected[pixelIndex] = 1;
    data[offset + 3] = 0;
    removedPixels += 1;

    const x = pixelIndex % width;
    const y = Math.floor(pixelIndex / width);
    for (const step of neighbors) {
      const next = pixelIndex + step;
      if (next < 0 || next >= selected.length || visited[next]) continue;

      const nx = next % width;
      const ny = Math.floor(next / width);
      if (Math.abs(nx - x) > 1 || Math.abs(ny - y) > 1) continue;

      stack.push(next);
    }
  }

  if (softness > 0 && removedPixels > 0) {
    softenSelectionEdge(data, source, selected, width, height, target, tolerance, softness);
  }

  return {
    imageData: new ImageData(data, width, height),
    removedPixels,
  };
}

function categoriesFromPrompts(prompts: GeneratedPrompt[]): string[] {
  return Array.from(
    new Set(
      prompts
        .map((prompt) => prompt.category.trim())
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b)),
    ),
  );
}

function softenSelectionEdge(
  data: Uint8ClampedArray,
  source: Uint8ClampedArray,
  selected: Uint8Array,
  width: number,
  height: number,
  target: Pixel,
  tolerance: number,
  softness: number,
): void {
  const fringeLimit = tolerance + softness;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const pixelIndex = y * width + x;
      if (selected[pixelIndex]) continue;
      if (!touchesSelection(selected, width, height, x, y)) continue;

      const offset = pixelIndex * 4;
      const alpha = source[offset + 3];
      if (alpha === 0) continue;

      const distance = colorDistance(
        source[offset],
        source[offset + 1],
        source[offset + 2],
        target.r,
        target.g,
        target.b,
      );
      if (distance > fringeLimit) continue;

      const keepRatio = Math.max(0.18, (distance - tolerance) / softness);
      data[offset + 3] = Math.round(alpha * keepRatio);
    }
  }
}

function touchesSelection(
  selected: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
): boolean {
  for (let dy = -1; dy <= 1; dy += 1) {
    for (let dx = -1; dx <= 1; dx += 1) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      if (selected[ny * width + nx]) return true;
    }
  }
  return false;
}

function loadDebugImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not load image"));
    };
    image.src = url;
  });
}

function cloneImageData(imageData: ImageData): ImageData {
  return new ImageData(
    new Uint8ClampedArray(imageData.data),
    imageData.width,
    imageData.height,
  );
}

function paintTransparentRegion(
  target: ImageData,
  alphaSource: ImageData,
  color: Pixel,
  center: CanvasPoint,
  radius: number,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): void {
  const radiusSquared = radius * radius;
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const dx = x - center.x;
      const dy = y - center.y;
      if (dx * dx + dy * dy > radiusSquared) continue;

      const offset = (y * target.width + x) * 4;
      if (alphaSource.data[offset + 3] !== 0) continue;

      target.data[offset] = color.r;
      target.data[offset + 1] = color.g;
      target.data[offset + 2] = color.b;
      target.data[offset + 3] = 255;
    }
  }
}

function getCanvasPoint(canvas: HTMLCanvasElement, event: MouseEvent): CanvasPoint {
  const rect = canvas.getBoundingClientRect();
  return {
    x: Math.min(
      canvas.width - 1,
      Math.max(0, Math.floor((event.clientX - rect.left) * (canvas.width / rect.width))),
    ),
    y: Math.min(
      canvas.height - 1,
      Math.max(0, Math.floor((event.clientY - rect.top) * (canvas.height / rect.height))),
    ),
  };
}

function getPixel(imageData: ImageData, x: number, y: number): Pixel {
  const index = (y * imageData.width + x) * 4;
  return {
    r: imageData.data[index],
    g: imageData.data[index + 1],
    b: imageData.data[index + 2],
    a: imageData.data[index + 3],
  };
}

function colorDistance(
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
): number {
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  return Math.sqrt(dr * dr + dg * dg + db * db);
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

function hexToRgb(value: string): Pixel {
  const normalized = value.replace(/^#/, "");
  const parsed = Number.parseInt(normalized, 16);
  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
    a: 255,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function rgbToHsb(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const delta = max - min;
  let hue = 0;

  if (delta !== 0) {
    if (max === rn) hue = ((gn - bn) / delta) % 6;
    else if (max === gn) hue = (bn - rn) / delta + 2;
    else hue = (rn - gn) / delta + 4;
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
  }

  return [
    hue % 360,
    Math.round(max === 0 ? 0 : (delta / max) * 100),
    Math.round(max * 100),
  ];
}

function hsbText([h, s, b]: [number, number, number]): string {
  return `H${h} S${s} B${b}`;
}

function renderGameImage(sourceCanvas: HTMLCanvasElement): string {
  if (
    sourceCanvas.width === GAME_IMAGE_SIZE &&
    sourceCanvas.height === GAME_IMAGE_SIZE
  ) {
    return sourceCanvas.toDataURL("image/png");
  }

  const output = document.createElement("canvas");
  output.width = GAME_IMAGE_SIZE;
  output.height = GAME_IMAGE_SIZE;
  const outputCtx = output.getContext("2d");
  if (!outputCtx) throw new Error("Canvas 2D is not available");

  const scale = Math.min(
    GAME_IMAGE_SIZE / sourceCanvas.width,
    GAME_IMAGE_SIZE / sourceCanvas.height,
  );
  const width = Math.round(sourceCanvas.width * scale);
  const height = Math.round(sourceCanvas.height * scale);
  const x = Math.round((GAME_IMAGE_SIZE - width) / 2);
  const y = Math.round((GAME_IMAGE_SIZE - height) / 2);
  outputCtx.drawImage(sourceCanvas, x, y, width, height);

  return output.toDataURL("image/png");
}

function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getDebugEl<T extends HTMLElement>(id: string): T {
  const element = document.getElementById(id);
  if (!element) throw new Error(`Missing debug element #${id}`);
  return element as T;
}
