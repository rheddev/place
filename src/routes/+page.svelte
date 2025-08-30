<script lang="ts">
	import { onMount } from 'svelte';
	import ColorPicker from '$lib/ColorPicker.svelte';
	import { Palette, Pipette } from '@lucide/svelte';
	
	let canvas: HTMLCanvasElement;
	let canvasContainer: HTMLDivElement;
	let ctx: CanvasRenderingContext2D;
	let isHovering = false;
	let hoverX = 0;
	let hoverY = 0;
	let isDrawing = false; // Track if mouse is pressed down
	let isPanning = false; // Track if we're panning the canvas
	
	// Canvas positioning and scaling
	let canvasScale = 1;
	let canvasTranslateX = 0;
	let canvasTranslateY = 0;
	let lastPanX = 0;
	let lastPanY = 0;
	
	// Color palette state
	let selectedColor = '#000000'; // Default selected color (now hex)
	let colorPickerMode = false; // Track if color picker tool is active
	let showColorWheel = false; // Track if color wheel is open
	const colors = {
		red: '#ff0000',
		green: '#00ff00', 
		blue: '#0000ff',
		black: '#000000',
		white: '#ffffff'
	};
	
	// Canvas persistence - 2D array to store each pixel's color
	let savedCanvas: string[][] = [];
	const canvasWidth = 48;
	const canvasHeight = 27;

	onMount(() => {
		ctx = canvas.getContext('2d')!;
		initializeSavedCanvas();
		initializeCanvasScale();
		drawFrame();
	});
	
	function initializeSavedCanvas() {
		// Initialize the saved canvas with all white pixels
		savedCanvas = Array(canvasHeight).fill(null).map(() => 
			Array(canvasWidth).fill(colors.white)
		);
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
	
	function handleColorChange(event: CustomEvent<string>) {
		selectedColor = event.detail;
	}
	
	function pickColorFromCanvas(x: number, y: number) {
		if (x >= 0 && x < canvasWidth && y >= 0 && y < canvasHeight) {
			const pickedColor = savedCanvas[y][x];
			selectedColor = pickedColor;
			colorPickerMode = false; // Exit picker mode after picking
		}
	}

	function hexToRgb(hex: string): [number, number, number] {
		const r = parseInt(hex.slice(1, 3), 16);
		const g = parseInt(hex.slice(3, 5), 16);
		const b = parseInt(hex.slice(5, 7), 16);
		return [r, g, b];
	}

	function rgbToHex(r: number, g: number, b: number): string {
		return '#' + [r, g, b].map(x => {
			const hex = Math.round(x).toString(16);
			return hex.length === 1 ? '0' + hex : hex;
		}).join('');
	}

	function blendColors(color1: string, color2: string, ratio: number = 0.5): string {
		const [r1, g1, b1] = hexToRgb(color1);
		const [r2, g2, b2] = hexToRgb(color2);
		
		const r = r1 * (1 - ratio) + r2 * ratio;
		const g = g1 * (1 - ratio) + g2 * ratio;
		const b = b1 * (1 - ratio) + b2 * ratio;
		
		return rgbToHex(r, g, b);
	}

	function clearCanvas() {
		if (!ctx) return;
		ctx.fillStyle = 'white';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
	}

	function getPixelCoordinates(event: MouseEvent) {
		const rect = canvas.getBoundingClientRect();
		const scaleX = canvas.width / rect.width;
		const scaleY = canvas.height / rect.height;
		
		return {
			x: Math.floor((event.clientX - rect.left) * scaleX),
			y: Math.floor((event.clientY - rect.top) * scaleY)
		};
	}

	function paintPixel(x: number, y: number) {
		// Paint the pixel if within bounds
		if (x >= 0 && x < canvasWidth && y >= 0 && y < canvasHeight) {
			savedCanvas[y][x] = selectedColor;
		}
	}

	function drawFrame() {
		if (!ctx) return;
		
		// Step 1: Clear canvas
		clearCanvas();
		
		// Step 2: Draw the saved canvas state
		for (let y = 0; y < canvasHeight; y++) {
			for (let x = 0; x < canvasWidth; x++) {
				const pixelColor = savedCanvas[y][x];
				if (pixelColor !== colors.white) { // Only draw non-white pixels
					ctx.fillStyle = pixelColor;
					ctx.fillRect(x, y, 1, 1);
				}
			}
		}
		
		// Step 3: Draw hover preview if hovering (but not if actively drawing)
		if (isHovering && !isDrawing && !colorPickerMode && hoverX >= 0 && hoverX < canvasWidth && hoverY >= 0 && hoverY < canvasHeight) {
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

<div class="palette">
	<!-- Current color display -->
	<div class="current-color" style="background-color: {selectedColor};" title="Current color: {selectedColor}"></div>
	
	<!-- Default color buttons -->
	<div class="default-colors">
		<button 
			class="color" 
			class:selected={selectedColor === colors.red}
			data-color="red"
			type="button"
			aria-label="Select red color"
			on:click={() => selectColor(colors.red)}
		></button>
		<button 
			class="color" 
			class:selected={selectedColor === colors.green}
			data-color="green"
			type="button"
			aria-label="Select green color"
			on:click={() => selectColor(colors.green)}
		></button>
		<button 
			class="color" 
			class:selected={selectedColor === colors.blue}
			data-color="blue"
			type="button"
			aria-label="Select blue color"
			on:click={() => selectColor(colors.blue)}
		></button>
		<button 
			class="color" 
			class:selected={selectedColor === colors.black}
			data-color="black"
			type="button"
			aria-label="Select black color"
			on:click={() => selectColor(colors.black)}
		></button>
		<button 
			class="color" 
			class:selected={selectedColor === colors.white}
			data-color="white"
			type="button"
			aria-label="Select white color"
			on:click={() => selectColor(colors.white)}
		></button>
	</div>
	
	<!-- Tool buttons -->
	<div class="tools">
		<button 
			class="tool-btn" 
			class:active={showColorWheel}
			type="button"
			aria-label="Open color wheel"
			on:click={toggleColorWheel}
		>
			<Palette size="20" />
		</button>
		<button 
			class="tool-btn" 
			class:active={colorPickerMode}
			type="button"
			aria-label="Color picker tool"
			on:click={toggleColorPicker}
		>
			<Pipette size="20" />
		</button>
	</div>
</div>

<!-- Color wheel popup -->
{#if showColorWheel}
	<div class="color-wheel-popup">
		<div class="color-wheel-content">
			<ColorPicker 
				{selectedColor} 
				on:colorChange={handleColorChange}
			/>
			<button class="close-btn" on:click={() => showColorWheel = false}>✕</button>
		</div>
	</div>
{/if}

<div class="canvas-container" bind:this={canvasContainer}>
	<canvas 
		bind:this={canvas}
		class:color-picker-mode={colorPickerMode}
		width="48" 
		height="27"
		on:mousedown={handleMouseDown}
		on:mouseup={handleMouseUp}
		on:mousemove={handleMouseMove}
		on:mouseleave={handleMouseLeave}
		on:wheel={handleWheel}
		on:contextmenu={handleContextMenu}
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
		background-color: var(--app-bg); /* Use CSS variable instead of hardcoded color */
		font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
		height: 100vh;
	}

	.palette {
		position: fixed;
		top: 20px;
		left: 50%;
		transform: translateX(-50%);
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 12px 16px;
		background-color: var(--palette-bg);
		border-radius: 12px;
		box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
		backdrop-filter: blur(10px);
		z-index: 100;
		border: 1px solid var(--palette-border);
	}

	.current-color {
		width: 48px;
		height: 48px;
		border-radius: 50%;
		border: 3px solid rgba(0, 0, 0, 0.2);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		flex-shrink: 0;
	}

	.default-colors {
		display: flex;
		gap: 8px;
	}

	.tools {
		display: flex;
		gap: 6px;
	}

	.color {
		width: 36px;
		height: 36px;
		border-radius: 8px;
		cursor: pointer;
		border: 2px solid rgba(0, 0, 0, 0.1);
		transition: all 0.2s ease;
		/* Remove default button styling */
		background: none;
		padding: 0;
		margin: 0;
		outline: none;
	}

	.color:hover {
		transform: scale(1.1);
		border-color: var(--text-primary);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
	}
	
	.color:focus {
		outline: 2px solid var(--primary-color);
		outline-offset: 2px;
	}
	
	.color.selected {
		border-color: var(--text-primary);
		border-width: 3px;
		transform: scale(1.05);
		box-shadow: 0 2px 12px rgba(0, 0, 0, 0.3);
	}

	.color[data-color="red"] { background-color: #ff0000 !important; }
	.color[data-color="green"] { background-color: #00ff00 !important; }
	.color[data-color="blue"] { background-color: #0000ff !important; }
	.color[data-color="black"] { background-color: #000000 !important; }
	.color[data-color="white"] { background-color: #ffffff !important; }

	.tool-btn {
		width: 36px;
		height: 36px;
		border-radius: 8px;
		cursor: pointer;
		border: 2px solid rgba(0, 0, 0, 0.1);
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
	}

	.tool-btn:hover {
		transform: scale(1.1);
		border-color: var(--text-primary);
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
		background-color: var(--tool-btn-bg-hover);
	}

	.tool-btn:focus {
		outline: 2px solid var(--primary-color);
		outline-offset: 2px;
	}

	.tool-btn.active {
		border-color: var(--primary-color);
		border-width: 3px;
		background-color: rgba(59, 130, 246, 0.1);
		transform: scale(1.05);
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
		box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
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
		box-shadow: 0px 5px 10px rgba(0, 0, 0, 0.3);
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