<script lang="ts">
	import { createEventDispatcher, onMount } from 'svelte';
	import { Sun } from '@lucide/svelte';
	
	export let selectedColor = '#000000';
	
	const dispatch = createEventDispatcher();
	
	let canvas: HTMLCanvasElement;
	let ctx: CanvasRenderingContext2D;
	let isDragging = false;
	
	// RGB values (0-255)
	let r = 0;
	let g = 0;
	let b = 0;
	
	// HSV values for color wheel
	let hue = 0; // 0-360
	let saturation = 1; // 0-1
	let value = 1; // 0-1
	
	const wheelSize = 200;
	const wheelCenter = wheelSize / 2;
	const wheelRadius = wheelSize / 2 - 10;
	
	onMount(() => {
		ctx = canvas.getContext('2d')!;
		hexToRgb(selectedColor);
		rgbToHsv();
		drawColorWheel();
	});
	
	function hexToRgb(hex: string) {
		const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
		if (result) {
			r = parseInt(result[1], 16);
			g = parseInt(result[2], 16);
			b = parseInt(result[3], 16);
		}
	}
	
	function rgbToHex(r: number, g: number, b: number): string {
		const toHex = (n: number) => Math.round(Math.max(0, Math.min(255, n))).toString(16).padStart(2, '0');
		return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
	}
	
	function rgbToHsv() {
		const rNorm = r / 255;
		const gNorm = g / 255;
		const bNorm = b / 255;
		
		const max = Math.max(rNorm, gNorm, bNorm);
		const min = Math.min(rNorm, gNorm, bNorm);
		const delta = max - min;
		
		// Hue
		if (delta === 0) {
			hue = 0;
		} else if (max === rNorm) {
			hue = ((gNorm - bNorm) / delta) % 6;
		} else if (max === gNorm) {
			hue = (bNorm - rNorm) / delta + 2;
		} else {
			hue = (rNorm - gNorm) / delta + 4;
		}
		hue = Math.round(hue * 60);
		if (hue < 0) hue += 360;
		
		// Saturation
		saturation = max === 0 ? 0 : delta / max;
		
		// Value
		value = max;
	}
	
	function hsvToRgb(h: number, s: number, v: number) {
		const c = v * s;
		const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
		const m = v - c;
		
		let rPrime = 0, gPrime = 0, bPrime = 0;
		
		if (h >= 0 && h < 60) {
			rPrime = c; gPrime = x; bPrime = 0;
		} else if (h >= 60 && h < 120) {
			rPrime = x; gPrime = c; bPrime = 0;
		} else if (h >= 120 && h < 180) {
			rPrime = 0; gPrime = c; bPrime = x;
		} else if (h >= 180 && h < 240) {
			rPrime = 0; gPrime = x; bPrime = c;
		} else if (h >= 240 && h < 300) {
			rPrime = x; gPrime = 0; bPrime = c;
		} else if (h >= 300 && h < 360) {
			rPrime = c; gPrime = 0; bPrime = x;
		}
		
		return {
			r: Math.round((rPrime + m) * 255),
			g: Math.round((gPrime + m) * 255),
			b: Math.round((bPrime + m) * 255)
		};
	}
	
	function drawColorWheel() {
		if (!ctx) return;
		
		const imageData = ctx.createImageData(wheelSize, wheelSize);
		const data = imageData.data;
		
		for (let y = 0; y < wheelSize; y++) {
			for (let x = 0; x < wheelSize; x++) {
				const dx = x - wheelCenter;
				const dy = y - wheelCenter;
				const distance = Math.sqrt(dx * dx + dy * dy);
				
				if (distance <= wheelRadius) {
					const angle = Math.atan2(dy, dx);
					const hue = (angle * 180 / Math.PI + 360) % 360;
					const saturation = distance / wheelRadius;
					
					const { r, g, b } = hsvToRgb(hue, saturation, value);
					
					const index = (y * wheelSize + x) * 4;
					data[index] = r;     // Red
					data[index + 1] = g; // Green
					data[index + 2] = b; // Blue
					data[index + 3] = 255; // Alpha
				}
			}
		}
		
		ctx.putImageData(imageData, 0, 0);
		
		// Draw selection indicator
		const angleRad = (hue * Math.PI) / 180;
		const indicatorDistance = saturation * wheelRadius;
		const indicatorX = wheelCenter + Math.cos(angleRad) * indicatorDistance;
		const indicatorY = wheelCenter + Math.sin(angleRad) * indicatorDistance;
		
		ctx.strokeStyle = value > 0.5 ? '#000000' : '#ffffff';
		ctx.lineWidth = 2;
		ctx.beginPath();
		ctx.arc(indicatorX, indicatorY, 6, 0, 2 * Math.PI);
		ctx.stroke();
		
		ctx.strokeStyle = value > 0.5 ? '#ffffff' : '#000000';
		ctx.lineWidth = 1;
		ctx.beginPath();
		ctx.arc(indicatorX, indicatorY, 6, 0, 2 * Math.PI);
		ctx.stroke();
	}
	
	function handleWheelClick(event: MouseEvent) {
		const rect = canvas.getBoundingClientRect();
		const x = event.clientX - rect.left;
		const y = event.clientY - rect.top;
		
		const dx = x - wheelCenter;
		const dy = y - wheelCenter;
		const distance = Math.sqrt(dx * dx + dy * dy);
		
		if (distance <= wheelRadius) {
			const angle = Math.atan2(dy, dx);
			hue = (angle * 180 / Math.PI + 360) % 360;
			saturation = Math.min(distance / wheelRadius, 1);
			
			updateRgbFromHsv();
			updateColor();
			drawColorWheel();
		}
	}
	
	function handleWheelMouseDown(event: MouseEvent) {
		isDragging = true;
		handleWheelClick(event);
	}
	
	function handleWheelMouseMove(event: MouseEvent) {
		if (isDragging) {
			handleWheelClick(event);
		}
	}
	
	function handleWheelMouseUp() {
		isDragging = false;
	}
	
	function updateRgbFromHsv() {
		const rgb = hsvToRgb(hue, saturation, value);
		r = rgb.r;
		g = rgb.g;
		b = rgb.b;
	}
	
	function updateHsvFromRgb() {
		rgbToHsv();
		drawColorWheel();
	}
	
	function updateColor() {
		selectedColor = rgbToHex(r, g, b);
		dispatch('colorChange', selectedColor);
	}
	
	function onRChange() {
		updateHsvFromRgb();
		updateColor();
	}
	
	function onGChange() {
		updateHsvFromRgb();
		updateColor();
	}
	
	function onBChange() {
		updateHsvFromRgb();
		updateColor();
	}
	
	function onValueChange() {
		updateRgbFromHsv();
		updateColor();
		drawColorWheel();
	}
</script>

<div class="color-picker">
	<div class="wheel-container">
		<canvas
			bind:this={canvas}
			width={wheelSize}
			height={wheelSize}
			on:mousedown={handleWheelMouseDown}
			on:mousemove={handleWheelMouseMove}
			on:mouseup={handleWheelMouseUp}
			on:mouseleave={handleWheelMouseUp}
		></canvas>
	</div>
	
	<div class="controls">
				<div class="slider-group">
			<label for="brightness" class="icon-label">
				<Sun size="16" />:
			</label>
			<input 
				id="brightness"
				type="range" 
				min="0" 
				max="1" 
				step="0.01" 
				bind:value={value}
				on:input={onValueChange}
				class="brightness-slider"
			>
			<span class="value">{Math.round(value * 100)}</span>
		</div>
		
		<div class="slider-group">
			<label for="red">R:</label>
			<input 
				id="red"
				type="range" 
				min="0" 
				max="255" 
				bind:value={r}
				on:input={onRChange}
				class="red-slider"
			>
			<span class="value">{r}</span>
		</div>
		
		<div class="slider-group">
			<label for="green">G:</label>
			<input 
				id="green"
				type="range" 
				min="0" 
				max="255" 
				bind:value={g}
				on:input={onGChange}
				class="green-slider"
			>
			<span class="value">{g}</span>
		</div>
		
		<div class="slider-group">
			<label for="blue">B:</label>
			<input 
				id="blue"
				type="range" 
				min="0" 
				max="255" 
				bind:value={b}
				on:input={onBChange}
				class="blue-slider"
			>
			<span class="value">{b}</span>
		</div>
		
		<div class="slider-group hex-display">
			<!-- svelte-ignore a11y_label_has_associated_control -->
			<label>Hex:</label>
			<input 
				type="text" 
				value={selectedColor}
				readonly
				class="hex-input"
			>
			<span class="value"></span>
		</div>
	</div>
</div>

<style>
	.color-picker {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 20px;
		padding: 20px;
	}
	
	.wheel-container {
		position: relative;
	}
	
	canvas {
		border-radius: 50%;
		cursor: crosshair;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
	}
	
	.controls {
		display: flex;
		flex-direction: column;
		gap: 12px;
		width: 100%;
		max-width: 240px;
		min-width: 240px;
	}
	
	.slider-group {
		display: flex;
		align-items: center;
		gap: 12px;
		width: 100%;
	}
	
	.slider-group label {
		width: 32px;
		font-weight: bold;
		font-size: 14px;
		display: flex;
		align-items: center;
		justify-content: flex-start;
		flex-shrink: 0;
	}
	
	.icon-label {
		display: flex;
		align-items: center;
		gap: 2px;
	}
	
	.slider-group .value {
		width: 36px;
		text-align: right;
		font-size: 12px;
		color: #666;
		flex-shrink: 0;
		font-family: 'Courier New', monospace;
	}
	
	input[type="range"] {
		flex: 1;
		height: 6px;
		border-radius: 3px;
		outline: none;
		appearance: none;
		min-width: 0; /* Ensure flex works properly */
	}
	
	input[type="range"]::-webkit-slider-thumb {
		-webkit-appearance: none;
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #333;
		cursor: pointer;
		border: 2px solid #fff;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
	}
	
	input[type="range"]::-moz-range-thumb {
		width: 16px;
		height: 16px;
		border-radius: 50%;
		background: #333;
		cursor: pointer;
		border: 2px solid #fff;
		box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
	}
	
	.brightness-slider {
		background: linear-gradient(to right, #000, #fff);
	}
	
	.red-slider {
		background: linear-gradient(to right, #000, #f00);
	}
	
	.green-slider {
		background: linear-gradient(to right, #000, #0f0);
	}
	
	.blue-slider {
		background: linear-gradient(to right, #000, #00f);
	}
	
	input[type="range"]::-webkit-slider-track {
		height: 6px;
		border-radius: 3px;
	}
	
	input[type="range"]::-moz-range-track {
		height: 6px;
		border-radius: 3px;
		border: none;
	}
	
	.hex-display {
		border-top: 1px solid #eee;
		padding-top: 12px;
		margin-top: 4px;
	}
	
	.hex-input {
		flex: 1;
		padding: 6px 8px;
		border: 1px solid #ddd;
		border-radius: 4px;
		font-family: 'Courier New', monospace;
		font-size: 12px;
		background-color: #f9f9f9;
		text-align: center;
		min-width: 0;
	}
</style> 