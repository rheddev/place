<script lang="ts">
  import { onMount } from "svelte";
  import ColorPicker from "$lib/ColorPicker.svelte";
  import { Palette, Pipette, LogOut, LogIn, User, Twitch } from "@lucide/svelte";
  import type { PageData } from "./$types";

  let { data }: { data: PageData } = $props();

  // Authentication state - now managed by server data
  let isAuthenticated = $state(data.isAuthenticated);
  let userId = $state(data.userId);
  let userInfo = $state(data.userInfo);

  // API Configuration
  const API_BASE = 'http://localhost:4000';

  let canvas: HTMLCanvasElement;
  let canvasContainer: HTMLDivElement;
  let ctx: CanvasRenderingContext2D;
  let isHovering = $state(false);
  let hoverX = $state(0);
  let hoverY = $state(0);
  let isDrawing = $state(false); // Track if mouse is pressed down
  let isPanning = $state(false); // Track if we're panning the canvas

  // Canvas positioning and scaling
  let canvasScale = $state(1);
  let canvasTranslateX = $state(0);
  let canvasTranslateY = $state(0);
  let lastPanX = $state(0);
  let lastPanY = $state(0);

  // Color palette state
  let selectedColor = $state("#000000"); // Default selected color (now hex)
  let colorPickerMode = $state(false); // Track if color picker tool is active
  let showColorWheel = $state(false); // Track if color wheel is open
  const colors = {
    red: "#ff0000",
    green: "#00ff00",
    blue: "#0000ff",
    black: "#000000",
    white: "#ffffff",
  };

  // Canvas persistence - 2D array to store each pixel's color
  let savedCanvas = $state<string[][]>([]);

  // Debounced saving state
  let pendingChanges = $state<Array<{x: number, y: number, color: string}>>([]);
  let saveTimeout: number | null = null;
  const SAVE_DELAY = 500; // 500ms debounce delay

  // Get canvas dimensions from CSS variables (with fallback defaults)
  let canvasWidth = $state<number>(128);
  let canvasHeight = $state<number>(72);

  // Color format conversion functions
  function hexToRgb(hex: string): [number, number, number] {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return [r, g, b];
  }

  function rgbToHex(r: number, g: number, b: number): string {
    return (
      "#" +
      [r, g, b]
        .map((x) => {
          const hex = Math.round(x).toString(16);
          return hex.length === 1 ? "0" + hex : hex;
        })
        .join("")
    );
  }

  // API Functions
  async function loadCanvasFromServer() {
    try {
      const response = await fetch(`${API_BASE}/api/canvas`);
      if (!response.ok) {
        console.error('Failed to load canvas from server');
        return;
      }
      
      const data = await response.json();
      
      // Decode base64 canvas data
      const binaryData = atob(data.canvas);
      const uint8Array = new Uint8Array(binaryData.length);
      for (let i = 0; i < binaryData.length; i++) {
        uint8Array[i] = binaryData.charCodeAt(i);
      }
      
      // Convert RGBA binary data to 2D hex color array
      const newCanvas = Array(canvasHeight)
        .fill(null)
        .map(() => Array(canvasWidth).fill(colors.white));
      
      for (let y = 0; y < canvasHeight; y++) {
        for (let x = 0; x < canvasWidth; x++) {
          const pixelIndex = (y * canvasWidth + x) * 4; // 4 bytes per pixel (RGBA)
          const r = uint8Array[pixelIndex];
          const g = uint8Array[pixelIndex + 1];
          const b = uint8Array[pixelIndex + 2];
          const a = uint8Array[pixelIndex + 3];
          
          // Only set non-transparent pixels
          if (a > 0) {
            newCanvas[y][x] = rgbToHex(r, g, b);
          }
        }
      }
      
      savedCanvas = newCanvas;
      drawFrame();
    } catch (error) {
      console.error('Error loading canvas from server:', error);
    }
  }

  async function saveChangesToServer(changes: Array<{x: number, y: number, color: string}>) {
    if (!isAuthenticated || changes.length === 0) {
      return;
    }

    try {
      // Convert hex colors to RGB format for API
      const pixels = changes.map(change => {
        const [r, g, b] = hexToRgb(change.color);
        return {
          x: change.x,
          y: change.y,
          r,
          g,
          b
        };
      });

      const response = await fetch(`${API_BASE}/api/canvas`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include session cookies
        body: JSON.stringify({ pixels })
      });

      if (!response.ok) {
        const error = await response.json();
        console.error('Failed to save canvas changes:', error);
      } else {
        console.log(`Successfully saved ${changes.length} pixel changes`);
      }
    } catch (error) {
      console.error('Error saving canvas changes:', error);
    }
  }

  // Debounced save function
  function scheduleCanvasSave() {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    saveTimeout = setTimeout(() => {
      if (pendingChanges.length > 0) {
        saveChangesToServer([...pendingChanges]);
        pendingChanges = [];
      }
      saveTimeout = null;
    }, SAVE_DELAY);
  }

  // Updated paint pixel function to add to pending changes
  function paintPixel(x: number, y: number) {
    // Paint the pixel if within bounds
    if (x >= 0 && x < canvasWidth && y >= 0 && y < canvasHeight) {
      const oldColor = savedCanvas[y][x];
      if (oldColor !== selectedColor) {
        savedCanvas[y][x] = selectedColor;
        
        // Add to pending changes if authenticated
        if (isAuthenticated) {
          // Remove any existing change for this pixel
          pendingChanges = pendingChanges.filter(change => 
            !(change.x === x && change.y === y)
          );
          
          // Add new change
          pendingChanges.push({
            x,
            y,
            color: selectedColor
          });
          
          // Schedule save
          scheduleCanvasSave();
        }
      }
    }
  }

  // Auth functions
  async function handleLogout() {
    try {
      // Call the server logout endpoint to clear the session
      const response = await fetch('http://localhost:4000/auth/logout', {
        method: 'POST',
        credentials: 'include', // Include cookies to identify the session
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        // Server logout successful, clear local state
        isAuthenticated = false;
        userId = null;
        userInfo = null;
        
        // Reload to ensure clean state
        window.location.reload();
      } else {
        console.error('Logout failed on server');
        // Still clear local state and reload as fallback
        isAuthenticated = false;
        userId = null;
        userInfo = null;
        window.location.reload();
      }
    } catch (error) {
      console.error('Error during logout:', error);
      // Clear local state and reload as fallback
      isAuthenticated = false;
      userId = null;
      userInfo = null;
      window.location.reload();
    }
  }

  // Update auth state when data changes (e.g., after navigation)
  $effect(() => {
    isAuthenticated = data.isAuthenticated;
    userId = data.userId;
    userInfo = data.userInfo;
  });

  // Cleanup function to clear pending timeouts
  $effect(() => {
    return () => {
      if (saveTimeout) {
        clearTimeout(saveTimeout);
      }
    };
  });

  onMount(async () => {
    // Get canvas dimensions from CSS variables
    const styles = getComputedStyle(document.documentElement);
    canvasWidth = parseInt(styles.getPropertyValue("--canvas-width"));
    canvasHeight = parseInt(styles.getPropertyValue("--canvas-height"));

    ctx = canvas.getContext("2d")!;
    
    // Load canvas from server first, then initialize if failed
    await loadCanvasFromServer();
    
    // Initialize with blank canvas if loading failed
    if (savedCanvas.length === 0) {
      initializeSavedCanvas();
    }
    
    initializeCanvasScale();
    drawFrame();
  });

  function initializeSavedCanvas() {
    // Initialize the saved canvas with all white pixels
    savedCanvas = Array(canvasHeight)
      .fill(null)
      .map(() => Array(canvasWidth).fill(colors.white));
  }

  function initializeCanvasScale() {
    // Calculate scale to fit canvas in viewport with some padding
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const padding = 100; // Space for palette and margins

    const maxWidth = viewportWidth - padding;
    const maxHeight = viewportHeight - padding;

    const scaleX = maxWidth / canvasWidth;
    const scaleY = maxHeight / canvasHeight;

    // Use the smaller scale to ensure it fits both dimensions
    canvasScale = Math.min(scaleX, scaleY, 24); // Cap at 24x max

    // Center the canvas
    canvasTranslateX = (viewportWidth - canvasWidth * canvasScale) / 2;
    canvasTranslateY = (viewportHeight - canvasHeight * canvasScale) / 2;

    updateCanvasTransform();
  }

  function updateCanvasTransform() {
    if (canvas) {
      canvas.style.transform = `translate(${canvasTranslateX}px, ${canvasTranslateY}px) scale(${canvasScale})`;
    }
  }

  function selectColor(color: string) {
    selectedColor = color;
    colorPickerMode = false; // Exit color picker mode when selecting a color
    showColorWheel = false; // Close color wheel
  }

  function toggleColorPicker() {
    colorPickerMode = !colorPickerMode;
    showColorWheel = false; // Close color wheel when activating picker
  }

  function toggleColorWheel() {
    showColorWheel = !showColorWheel;
    colorPickerMode = false; // Exit color picker mode when opening wheel
  }

  function handleColorChange(color: string) {
    selectedColor = color;
  }

  function pickColorFromCanvas(x: number, y: number) {
    if (x >= 0 && x < canvasWidth && y >= 0 && y < canvasHeight) {
      const pickedColor = savedCanvas[y][x];
      selectedColor = pickedColor;
      colorPickerMode = false; // Exit picker mode after picking
    }
  }

  function blendColors(
    color1: string,
    color2: string,
    ratio: number = 0.5
  ): string {
    const [r1, g1, b1] = hexToRgb(color1);
    const [r2, g2, b2] = hexToRgb(color2);

    const r = r1 * (1 - ratio) + r2 * ratio;
    const g = g1 * (1 - ratio) + g2 * ratio;
    const b = b1 * (1 - ratio) + b2 * ratio;

    return rgbToHex(r, g, b);
  }

  function clearCanvas() {
    if (!ctx) return;
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function getPixelCoordinates(event: MouseEvent) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: Math.floor((event.clientX - rect.left) * scaleX),
      y: Math.floor((event.clientY - rect.top) * scaleY),
    };
  }

  function drawFrame() {
    if (!ctx) return;

    // Step 1: Clear canvas
    clearCanvas();

    // Step 2: Draw the saved canvas state
    for (let y = 0; y < canvasHeight; y++) {
      for (let x = 0; x < canvasWidth; x++) {
        const pixelColor = savedCanvas[y][x];
        if (pixelColor !== colors.white) {
          // Only draw non-white pixels
          ctx.fillStyle = pixelColor;
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }

    // Step 3: Draw hover preview if hovering (but not if actively drawing)
    if (
      isHovering &&
      !isDrawing &&
      !colorPickerMode &&
      hoverX >= 0 &&
      hoverX < canvasWidth &&
      hoverY >= 0 &&
      hoverY < canvasHeight
    ) {
      const existingColor = savedCanvas[hoverY][hoverX];
      const hoverColor = blendColors(existingColor, selectedColor, 0.6); // 60% new color, 40% existing

      ctx.fillStyle = hoverColor;
      ctx.fillRect(hoverX, hoverY, 1, 1);
    }
  }

  function handleMouseDown(event: MouseEvent) {
    if (event.button === 2 || event.ctrlKey || event.metaKey) {
      // Right click or Ctrl+click for panning
      isPanning = true;
      lastPanX = event.clientX;
      lastPanY = event.clientY;
      event.preventDefault();
    } else {
      const { x, y } = getPixelCoordinates(event);

      if (colorPickerMode) {
        // Color picker mode - pick color from canvas
        pickColorFromCanvas(x, y);
        drawFrame();
      } else {
        // Left click for drawing
        isDrawing = true;

        // Paint the initial pixel
        paintPixel(x, y);
        drawFrame();
      }
    }
  }

  function handleMouseUp() {
    isDrawing = false;
    isPanning = false;
    drawFrame(); // Redraw to show hover preview again
  }

  function handleMouseMove(event: MouseEvent) {
    if (isPanning) {
      // Pan the canvas
      const deltaX = event.clientX - lastPanX;
      const deltaY = event.clientY - lastPanY;

      canvasTranslateX += deltaX;
      canvasTranslateY += deltaY;

      updateCanvasTransform();

      lastPanX = event.clientX;
      lastPanY = event.clientY;
    } else {
      // Normal drawing/hover behavior
      const { x, y } = getPixelCoordinates(event);

      hoverX = x;
      hoverY = y;
      isHovering = true;

      // If we're drawing, paint the pixel
      if (isDrawing) {
        paintPixel(x, y);
      }

      drawFrame();
    }
  }

  function handleMouseLeave() {
    isHovering = false;
    isDrawing = false; // Stop drawing if mouse leaves canvas
    isPanning = false;
    drawFrame();
  }

  function handleWheel(event: WheelEvent) {
    event.preventDefault();

    // Zoom in/out with mouse wheel
    const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
    const newScale = canvasScale * zoomFactor;

    // Limit zoom range
    if (newScale >= 1 && newScale <= 50) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = event.clientX;
      const mouseY = event.clientY;

      // Calculate zoom center point
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Adjust translation to zoom towards mouse position
      const deltaX = (mouseX - centerX) * (zoomFactor - 1);
      const deltaY = (mouseY - centerY) * (zoomFactor - 1);

      canvasScale = newScale;
      canvasTranslateX -= deltaX;
      canvasTranslateY -= deltaY;

      updateCanvasTransform();
    }
  }

  function handleContextMenu(event: Event) {
    event.preventDefault(); // Prevent right-click menu
  }
</script>

<!-- Main app content -->
<div class="palette">
  <!-- Authentication section -->
  {#if isAuthenticated}
    <div class="auth-section">
      {#if userInfo?.image}
        <img src={userInfo.image} alt="Profile" class="profile-picture" />
      {:else}
        <div class="user-avatar">
          <User size="16" />
        </div>
      {/if}
      <button class="logout-btn" onclick={handleLogout} title="Logout">
        <LogOut size="16" />
      </button>
    </div>
  {:else}
    <div class="login-section">
      <a href="http://localhost:4000/auth/twitch" class="login-icon-btn twitch-btn" title="Login with Twitch">
        <Twitch size="16" />
      </a>
      <a href="http://localhost:4000/auth/twitch" class="login-icon-btn general-login-btn" title="Login">
        <LogIn size="20" />
      </a>
    </div>
  {/if}

  <!-- Divider -->
  <div class="palette-divider"></div>

  <!-- Current color display -->
  <div
    class="current-color"
    style="background-color: {selectedColor};"
    title="Current color: {selectedColor}"
  ></div>

  <!-- Default color buttons -->
  <div class="default-colors">
    <button
      class="color"
      class:selected={selectedColor === colors.red}
      data-color="red"
      type="button"
      aria-label="Select red color"
      onclick={() => selectColor(colors.red)}
    ></button>
    <button
      class="color"
      class:selected={selectedColor === colors.green}
      data-color="green"
      type="button"
      aria-label="Select green color"
      onclick={() => selectColor(colors.green)}
    ></button>
    <button
      class="color"
      class:selected={selectedColor === colors.blue}
      data-color="blue"
      type="button"
      aria-label="Select blue color"
      onclick={() => selectColor(colors.blue)}
    ></button>
    <button
      class="color"
      class:selected={selectedColor === colors.black}
      data-color="black"
      type="button"
      aria-label="Select black color"
      onclick={() => selectColor(colors.black)}
    ></button>
    <button
      class="color"
      class:selected={selectedColor === colors.white}
      data-color="white"
      type="button"
      aria-label="Select white color"
      onclick={() => selectColor(colors.white)}
    ></button>
  </div>

  <!-- Tool buttons -->
  <div class="tools">
    <button
      class="tool-btn"
      class:active={showColorWheel}
      type="button"
      aria-label="Open color wheel"
      onclick={toggleColorWheel}
    >
      <Palette size="20" />
    </button>
    <button
      class="tool-btn"
      class:active={colorPickerMode}
      type="button"
      aria-label="Color picker tool"
      onclick={toggleColorPicker}
    >
      <Pipette size="20" />
    </button>
  </div>
</div>

<!-- Color wheel popup -->
{#if showColorWheel}
  <div class="color-wheel-popup">
    <div class="color-wheel-content">
      <ColorPicker {selectedColor} onColorChange={handleColorChange} />
      <button class="close-btn" onclick={() => (showColorWheel = false)}
        >✕</button
      >
    </div>
  </div>
{/if}

<div class="canvas-container" bind:this={canvasContainer}>
  <canvas
    bind:this={canvas}
    class:color-picker-mode={colorPickerMode}
    width={canvasWidth}
    height={canvasHeight}
    onmousedown={handleMouseDown}
    onmouseup={handleMouseUp}
    onmousemove={handleMouseMove}
    onmouseleave={handleMouseLeave}
    onwheel={handleWheel}
    oncontextmenu={handleContextMenu}
  >
  </canvas>
</div>

<div class="instructions">
  <p><strong>Controls:</strong></p>
  <p>• Left click + drag: Draw</p>
  <p>• Right click + drag: Pan canvas</p>
  <p>• Mouse wheel: Zoom in/out</p>
  <p>• Palette tool: Choose custom colors</p>
  <p>• Pipette tool: Sample colors from canvas</p>
</div>

<style>
  :global(body) {
    margin: 0;
    padding: 0;
    overflow: hidden; /* Prevent page scrolling */
    background-color: var(
      --app-bg
    ); /* Use CSS variable instead of hardcoded color */
    font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
    height: 100vh;
  }

  .palette {
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px 20px;
    background-color: var(--palette-bg);
    border-radius: 16px;
    box-shadow: var(--shadow-lg);
    backdrop-filter: blur(10px);
    z-index: 100;
    border: 1px solid var(--palette-border);
    max-width: 90vw;
    flex-wrap: wrap;
    justify-content: center;
  }

  .auth-section {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px;
    background-color: rgba(145, 70, 255, 0.08);
    border: 1px solid rgba(145, 70, 255, 0.2);
    border-radius: 12px;
  }

  .palette-divider {
    width: 1px;
    height: 32px;
    background-color: var(--border-alpha);
    opacity: 0.5;
  }



  .user-avatar {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    background-color: rgba(145, 70, 255, 0.15);
    border: 1px solid rgba(145, 70, 255, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: rgba(145, 70, 255, 0.8);
    transition: all 0.2s ease;
  }

  .user-avatar:hover {
    background-color: rgba(145, 70, 255, 0.2);
    border-color: rgba(145, 70, 255, 0.5);
    transform: scale(1.05);
  }

  .profile-picture {
    width: 28px;
    height: 28px;
    border-radius: 50%;
    object-fit: cover;
    border: 1px solid rgba(145, 70, 255, 0.3);
    transition: all 0.2s ease;
  }

  .profile-picture:hover {
    border-color: rgba(145, 70, 255, 0.5);
    transform: scale(1.05);
  }

  .logout-btn {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.2);
    color: rgba(239, 68, 68, 0.8);
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
  }

  .logout-btn:hover {
    background-color: rgba(239, 68, 68, 0.15);
    border-color: rgba(239, 68, 68, 0.4);
    color: rgba(239, 68, 68, 1);
  }

  .login-section {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px;
    background-color: rgba(59, 130, 246, 0.08);
    border: 1px solid rgba(59, 130, 246, 0.2);
    border-radius: 12px;
  }

  .login-icon-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    cursor: pointer;
    border: 2px solid transparent;
    transition: all 0.2s ease;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    margin: 0;
    outline: none;
    text-decoration: none;
    flex-shrink: 0;
  }

  .twitch-btn {
    background-color: rgba(145, 70, 255, 0.15);
    color: rgba(145, 70, 255, 1);
    border-color: rgba(145, 70, 255, 0.3);
  }

  .twitch-btn:hover {
    background-color: rgba(145, 70, 255, 0.2);
    border-color: rgba(145, 70, 255, 0.5);
    transform: scale(1.05);
  }

  .general-login-btn {
    background-color: rgba(59, 130, 246, 0.15);
    color: rgba(59, 130, 246, 1);
    border-color: rgba(59, 130, 246, 0.3);
  }

  .general-login-btn:hover {
    background-color: rgba(59, 130, 246, 0.2);
    border-color: rgba(59, 130, 246, 0.5);
    transform: scale(1.05);
  }





  .current-color {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    border: 2px solid var(--border-alpha);
    box-shadow: var(--shadow-md);
    flex-shrink: 0;
    transition: all 0.2s ease;
  }

  .current-color:hover {
    transform: scale(1.05);
    border-color: var(--text-primary);
  }

  .default-colors {
    display: flex;
    gap: 10px;
    align-items: center;
  }

  .tools {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .color {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    cursor: pointer;
    border: 2px solid var(--border-alpha);
    transition: all 0.2s ease;
    /* Remove default button styling */
    background: none;
    padding: 0;
    margin: 0;
    outline: none;
    flex-shrink: 0;
  }

  .color:hover {
    transform: scale(1.1);
    border-color: var(--text-primary);
    box-shadow: var(--shadow-md);
  }

  .color:focus {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

  .color.selected {
    border-color: var(--text-primary);
    border-width: 2px;
    transform: scale(1.05);
    box-shadow: var(--shadow-lg);
    outline: 2px solid var(--text-primary);
    outline-offset: 1px;
  }

  .color[data-color="red"] {
    background-color: #ff0000 !important;
  }
  .color[data-color="green"] {
    background-color: #00ff00 !important;
  }
  .color[data-color="blue"] {
    background-color: #0000ff !important;
  }
  .color[data-color="black"] {
    background-color: #000000 !important;
  }
  .color[data-color="white"] {
    background-color: #ffffff !important;
  }

  .tool-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    cursor: pointer;
    border: 2px solid var(--border-alpha);
    background-color: var(--tool-btn-bg);
    transition: all 0.2s ease;
    font-size: 16px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0;
    margin: 0;
    outline: none;
    color: var(--text-primary);
    flex-shrink: 0;
  }

  .tool-btn:hover {
    transform: scale(1.1);
    border-color: var(--text-primary);
    box-shadow: var(--shadow-md);
    background-color: var(--tool-btn-bg-hover);
  }

  .tool-btn:focus {
    outline: 2px solid var(--primary-color);
    outline-offset: 2px;
  }

  .tool-btn.active {
    border-color: var(--primary-color);
    border-width: 2px;
    background-color: var(--primary-alpha);
    transform: scale(1.05);
    box-shadow: var(--shadow-lg);
    outline: 2px solid var(--primary-color);
    outline-offset: 1px;
  }

  .color-wheel-popup {
    position: fixed;
    top: 80px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 200;
  }

  .color-wheel-content {
    background-color: var(--bg-primary);
    border-radius: 12px;
    padding: 0;
    box-shadow: var(--shadow-xl);
    border: 1px solid var(--border-color);
    position: relative;
    overflow: hidden;
  }

  .close-btn {
    position: absolute;
    top: 10px;
    right: 10px;
    background: var(--bg-primary);
    border: 1px solid var(--border-color);
    font-size: 16px;
    cursor: pointer;
    color: var(--text-secondary);
    padding: 6px;
    border-radius: 50%;
    transition: all 0.2s;
    width: 28px;
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
  }

  .close-btn:hover {
    background-color: var(--bg-secondary);
    color: var(--text-primary);
    box-shadow: var(--shadow);
  }

  .canvas-container {
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
    cursor: grab;
  }

  .canvas-container:active {
    cursor: grabbing;
  }

  canvas {
    position: absolute;
    top: 0;
    left: 0;
    background-color: var(--canvas-bg);
    box-shadow: var(--shadow-md);
    transform-origin: top left;
    /* Ensure crisp pixel rendering */
    image-rendering: pixelated;
    image-rendering: -moz-crisp-edges;
    image-rendering: crisp-edges;
    cursor: crosshair;
  }

  canvas.color-picker-mode {
    cursor: copy;
  }

  .instructions {
    position: fixed;
    bottom: 20px;
    left: 20px;
    padding: 12px 16px;
    background-color: var(--instructions-bg);
    color: var(--instructions-text);
    border-radius: 8px;
    font-size: 12px;
    line-height: 1.4;
    backdrop-filter: blur(10px);
    z-index: 100;
  }

  .instructions p {
    margin: 0 0 4px 0;
  }

  .instructions p:last-child {
    margin-bottom: 0;
  }
</style>
