<script lang="ts">
	import { onMount } from 'svelte';
	
	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let isHovering = false;
	let isDrawing = false; // New state for drawing mode
	let hoverX = 0;
	let hoverY = 0;
	
	// Color palette state
	let selectedColor = 'black'; // Default selected color
	const colors = {
		red: '#ff6b6b',
		green: '#51cf66', 
		blue: '#339af0',
		black: '#343a40',
		white: '#ffffff'
	};
	
	// Canvas persistence - 2D array to store each pixel's color
	let savedCanvas: string[][] = [];
	const canvasWidth = 48;
	const canvasHeight = 27;

	onMount(() => {
		ctx = canvas.getContext('2d')!;
		initializeSavedCanvas();
		drawFrame();
	});
	
	function initializeSavedCanvas() {
		// Initialize the saved canvas with all white pixels
		savedCanvas = Array(canvasHeight).fill(null).map(() => 
			Array(canvasWidth).fill('#ffffff')
		);
	}

	function selectColor(color: string) {
		selectedColor = color;
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
		// Update the saved canvas with the selected color
		if (x >= 0 && x < canvasWidth && y >= 0 && y < canvasHeight) {
			savedCanvas[y][x] = colors[selectedColor as keyof typeof colors];
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
				if (pixelColor !== '#ffffff') { // Only draw non-white pixels
					ctx.fillStyle = pixelColor;
					ctx.fillRect(x, y, 1, 1);
				}
			}
		}
		
		// Step 3: Draw hover preview if hovering (but not while drawing)
		if (isHovering && !isDrawing && hoverX >= 0 && hoverX < canvasWidth && hoverY >= 0 && hoverY < canvasHeight) {
			const existingColor = savedCanvas[hoverY][hoverX];
			const selectedHex = colors[selectedColor as keyof typeof colors];
			const hoverColor = blendColors(existingColor, selectedHex, 0.6); // 60% new color, 40% existing
			
			ctx.fillStyle = hoverColor;
			ctx.fillRect(hoverX, hoverY, 1, 1);
		}
	}

	function handleMouseMove(event: MouseEvent) {
		const { x, y } = getPixelCoordinates(event);
		
		hoverX = x;
		hoverY = y;
		isHovering = true;
		
		// If we're in drawing mode, paint the pixel
		if (isDrawing) {
			paintPixel(x, y);
		}
		
		drawFrame();
	}

	function handleMouseDown(event: MouseEvent) {
		const { x, y } = getPixelCoordinates(event);
		
		isDrawing = true;
		// Paint the initial clicked pixel
		paintPixel(x, y);
		drawFrame();
		
		// Prevent text selection while dragging
		event.preventDefault();
	}

	function handleMouseUp() {
		isDrawing = false;
		drawFrame();
	}

	function handleMouseLeave() {
		isHovering = false;
		// Stop drawing when mouse leaves canvas
		isDrawing = false;
		drawFrame();
	}
	
	function handleClick(event: MouseEvent) {
		// This is now handled by mousedown, but keeping for single clicks
		// when not dragging
		if (!isDrawing) {
			const { x, y } = getPixelCoordinates(event);
			paintPixel(x, y);
			drawFrame();
		}
	}
</script>

<div class="palette">
    <button 
		class="color" 
		class:selected={selectedColor === 'red'}
		data-color="red"
		type="button"
		aria-label="Select red color"
		on:click={() => selectColor('red')}
	></button>
    <button 
		class="color" 
		class:selected={selectedColor === 'green'}
		data-color="green"
		type="button"
		aria-label="Select green color"
		on:click={() => selectColor('green')}
	></button>
    <button 
		class="color" 
		class:selected={selectedColor === 'blue'}
		data-color="blue"
		type="button"
		aria-label="Select blue color"
		on:click={() => selectColor('blue')}
	></button>
    <button 
		class="color" 
		class:selected={selectedColor === 'black'}
		data-color="black"
		type="button"
		aria-label="Select black color"
		on:click={() => selectColor('black')}
	></button>
    <button 
		class="color" 
		class:selected={selectedColor === 'white'}
		data-color="white"
		type="button"
		aria-label="Select white color"
		on:click={() => selectColor('white')}
	></button>
</div>
<canvas 
	bind:this={canvas}
	width="48" 
	height="27"
	on:mousemove={handleMouseMove}
	on:mousedown={handleMouseDown}
	on:mouseup={handleMouseUp}
	on:mouseleave={handleMouseLeave}
	on:click={handleClick}
>
</canvas>

<style>
	.palette {
		display: flex;
		gap: 8px;
		margin-bottom: 16px;
		padding: 16px;
		background-color: #f5f5f5;
		border-radius: 8px;
	}

	.color {
		width: 40px;
		height: 40px;
		border-radius: 8px;
		cursor: pointer;
		border: 2px solid #ddd;
		transition: transform 0.2s ease;
		/* Remove default button styling */
		background: none;
		padding: 0;
		margin: 0;
		outline: none;
	}

	.color:hover {
		transform: scale(1.1);
		border-color: #333;
	}
	
	.color:focus {
		outline: 2px solid #007acc;
		outline-offset: 2px;
	}
	
	.color.selected {
		border-color: #333;
		border-width: 3px;
		transform: scale(1.05);
	}

	.color[data-color="red"] { background-color: #ff6b6b !important; }
	.color[data-color="green"] { background-color: #51cf66 !important; }
	.color[data-color="blue"] { background-color: #339af0 !important; }
	.color[data-color="black"] { background-color: #343a40 !important; }
	.color[data-color="white"] { background-color: #ffffff !important; }

	canvas {
		display: block;
		background-color: white;
		/* Scale up the canvas display by 24x while keeping actual dimensions */
		transform: scale(24);
		transform-origin: top left;
		/* Add some margin to account for the scaling */
		/* margin: 0 0 calc(108px * 3) calc(192px * 3); */
		/* Ensure crisp pixel rendering */
		image-rendering: pixelated;
		image-rendering: -moz-crisp-edges;
		image-rendering: crisp-edges;
		cursor: crosshair;
		/* Prevent text selection while drawing */
		user-select: none;
	}
</style>