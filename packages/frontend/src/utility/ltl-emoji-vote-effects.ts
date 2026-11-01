/* SPDX-License-Identifier: AGPL-3.0-only */

export function makeLtlEmojiRain(width: number, height: number) {
	const columns = Math.max(4, Math.min(10, Math.ceil(width / 73)));
	const cell = width / columns;
	// Bound both the number of nodes and the visible area in unusually tall panes.
	const rows = Math.min(40, Math.ceil(height / cell));
	return Array.from({ length: columns * rows }, (_, index) => {
		const row = Math.floor(index / columns);
		const col = index % columns;
		return {
			'--x': `${col * cell - 3}px`,
			'--y': `${row * cell - 3}px`,
			'--size': `${cell + 6}px`,
			'--from': `${-height - row * cell - cell}px`,
			'--drift': `${Math.round((Math.random() - 0.5) * 70)}px`,
			'--rotate': `${Math.round((Math.random() - 0.5) * 55)}deg`,
			'--delay': `${Math.random() * 160 + (rows - row - 1) / Math.max(1, rows - 1) * 120}ms`,
			'--duration': `${560 + Math.random() * 180}ms`,
		};
	});
}

type ConfettiParticle = {
	x: number; y: number; born: number; life: number;
	vx: number; vy: number; angle: number; spin: number;
	width: number; height: number; flutter: number; color: string;
};

/** Draw only into the Vue-owned, LTL-clipped canvas supplied by the caller. */
export function playLtlEmojiConfetti(
	canvas: HTMLCanvasElement,
	getOrigins: () => HTMLElement[],
	isActive: () => boolean,
	canEmit: () => boolean = () => true,
): () => void {
	const bounds = canvas.getBoundingClientRect();
	const availableContext = canvas.getContext('2d');
	if (!availableContext || bounds.width <= 0 || bounds.height <= 0) return () => {};
	const context = availableContext;
	const ratio = Math.min(window.devicePixelRatio || 1, 2);
	canvas.width = Math.ceil(bounds.width * ratio);
	canvas.height = Math.ceil(bounds.height * ratio);
	context.setTransform(ratio, 0, 0, ratio, 0, 0);
	const colors = ['#78b8ff', '#ff88ba', '#f6c65b', '#75dcb5', '#b39cff', '#fff1c2'];
	const particles: ConfettiParticle[] = [];
	const reach = Math.min(1.25, Math.max(0.7, Math.max(bounds.width, bounds.height) / 650));
	const started = window.performance.now();
	let burst = 0;
	let frame: number | null = null;
	let stopped = false;

	function stop() {
		stopped = true;
		if (frame !== null) window.cancelAnimationFrame(frame);
		frame = null;
		context.setTransform(1, 0, 0, 1, 0, 0);
		context.clearRect(0, 0, canvas.width, canvas.height);
		particles.length = 0;
	}

	function emit(elapsed: number) {
		const currentBounds = canvas.getBoundingClientRect();
		const origins = getOrigins().filter(img => img.isConnected).map(img => img.getBoundingClientRect())
			.filter(rect => rect.width > 0 && rect.height > 0 && rect.bottom > currentBounds.top && rect.top < currentBounds.bottom && rect.right > currentBounds.left && rect.left < currentBounds.right)
			.map(rect => ({ x: rect.left + rect.width / 2 - currentBounds.left, y: rect.top + rect.height / 2 - currentBounds.top }));
		// Tied winners share three 320-piece bursts (960 total), not 960 each.
		for (let originIndex = 0; originIndex < origins.length; originIndex++) {
			const count = Math.floor(320 / origins.length) + (originIndex < 320 % origins.length ? 1 : 0);
			for (let i = 0; i < count; i++) {
				const angle = (i + Math.random()) / count * Math.PI * 2;
				const speed = (280 + Math.random() * 640) * reach;
				particles.push({
					...origins[originIndex], born: elapsed, life: 2400 + Math.random() * 650,
					vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
					angle: Math.random() * Math.PI * 2, spin: (Math.random() - 0.5) * 16,
					width: 4 + Math.random() * 5, height: 7 + Math.random() * 9,
					flutter: Math.random() * Math.PI * 2, color: colors[Math.floor(Math.random() * colors.length)],
				});
			}
		}
	}

	function draw(timestamp: number) {
		frame = null;
		if (stopped) return;
		const elapsed = timestamp - started;
		if (!isActive() || !canvas.isConnected || elapsed >= 3400) { stop(); return; }
		// Skip old bursts after a suspended frame rather than releasing all at once.
		if (canEmit() && burst < 3 && elapsed >= burst * 150) {
			emit(elapsed);
			burst = Math.min(3, Math.floor(elapsed / 150) + 1);
		}
		context.clearRect(0, 0, bounds.width, bounds.height);
		let alive = false;
		for (const particle of particles) {
			const age = elapsed - particle.born;
			if (age >= particle.life) continue;
			alive = true;
			const seconds = age / 1000;
			const travel = (1 - Math.exp(-1.1 * seconds)) / 1.1;
			const x = particle.x + particle.vx * travel + Math.sin(seconds * 9 + particle.flutter) * 10 * Math.min(1, seconds);
			const y = particle.y + particle.vy * travel + 190 * seconds * seconds;
			context.save();
			context.globalAlpha = Math.min(1, (particle.life - age) / 550);
			context.fillStyle = particle.color;
			context.translate(x, y);
			context.rotate(particle.angle + particle.spin * seconds);
			context.scale(1, 0.25 + 0.75 * Math.abs(Math.cos(seconds * 8 + particle.flutter)));
			context.fillRect(-particle.width / 2, -particle.height / 2, particle.width, particle.height);
			context.restore();
		}
		if (!alive && burst >= 3) { stop(); return; }
		frame = window.requestAnimationFrame(draw);
	}

	frame = window.requestAnimationFrame(draw);
	return stop;
}
