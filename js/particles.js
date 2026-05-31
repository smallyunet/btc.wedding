/**
 * BTC.Wedding P2P Network Particle Background
 * Renders a high-performance network mesh representing the Bitcoin Peer-to-Peer network.
 */

class P2PNetworkBackground {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) return;
        
        this.ctx = this.canvas.getContext('2d');
        this.particles = [];
        this.blockParticles = [];
        this.mouse = { x: null, y: null, radius: 150 };
        
        this.config = {
            particleCount: 80,
            maxDistance: 130,
            nodeColor: 'rgba(197, 163, 88, 0.25)', // Antique gold with low opacity
            lineColor: 'rgba(197, 163, 88, 0.05)',  // Champagne gold with very low opacity
            blockColor: 'rgba(197, 163, 88, 0.6)',
            mouseLineColor: 'rgba(197, 163, 88, 0.15)'
        };

        this.init();
        this.animate();
        this.registerEvents();
    }

    init() {
        this.resize();
        this.particles = [];
        this.blockParticles = [];

        // Generate standard transaction network nodes
        for (let i = 0; i < this.config.particleCount; i++) {
            this.particles.push(this.createParticle());
        }

        // Generate slow-moving golden consensus stars
        for (let i = 0; i < 4; i++) {
            this.blockParticles.push(this.createBlockParticle());
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Adjust particle count based on screen size for premium performance
        if (window.innerWidth < 768) {
            this.config.particleCount = 35;
            this.config.maxDistance = 90;
        } else {
            this.config.particleCount = 75;
            this.config.maxDistance = 130;
        }
    }

    createParticle() {
        return {
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            vx: (Math.random() - 0.5) * 0.08, // 4x slower for high stability
            vy: (Math.random() - 0.5) * 0.08, // 4x slower for high stability
            radius: Math.random() * 1.5 + 0.8,
            pulseSpeed: 0.005 + Math.random() * 0.01, // slow breathing
            pulseValue: Math.random() * Math.PI
        };
    }

    createBlockParticle() {
        return {
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            vx: (Math.random() - 0.5) * 0.03, // imperceptible drift
            vy: (Math.random() - 0.5) * 0.03,
            radius: Math.random() * 12 + 8,
            pulseSpeed: 0.003 + Math.random() * 0.005, // very slow breath
            pulseValue: Math.random() * Math.PI,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.001 // slow orbit rotation
        };
    }

    registerEvents() {
        window.addEventListener('resize', () => this.init());
        
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.x;
            this.mouse.y = e.y;
        });

        window.addEventListener('mouseout', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });
    }

    drawMesh() {
        const len = this.particles.length;
        this.ctx.shadowBlur = 0; // Ensure no default glowing filters that slow performance
        
        for (let i = 0; i < len; i++) {
            const p1 = this.particles[i];
            
            // Pulse particle opacity and size for shimmering effect
            p1.pulseValue += p1.pulseSpeed;
            const sizePulse = p1.radius + Math.sin(p1.pulseValue) * 0.3;
            const opacity = 0.12 + Math.sin(p1.pulseValue) * 0.08;
            
            this.ctx.beginPath();
            this.ctx.arc(p1.x, p1.y, sizePulse, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(197, 163, 88, ${opacity})`;
            this.ctx.fill();

            // Connect to other nodes in network
            for (let j = i + 1; j < len; j++) {
                const p2 = this.particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < this.config.maxDistance) {
                    const alpha = (1 - dist / this.config.maxDistance) * 0.06;
                    this.ctx.beginPath();
                    this.ctx.moveTo(p1.x, p1.y);
                    this.ctx.lineTo(p2.x, p2.y);
                    this.ctx.strokeStyle = `rgba(197, 163, 88, ${alpha})`;
                    this.ctx.lineWidth = 0.5;
                    this.ctx.stroke();
                }
            }

            // Subtle interaction with mouse hover (draws fine lines to nearby nodes)
            if (this.mouse.x !== null) {
                const dx = p1.x - this.mouse.x;
                const dy = p1.y - this.mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < this.mouse.radius) {
                    const alpha = (1 - dist / this.mouse.radius) * 0.15;
                    this.ctx.beginPath();
                    this.ctx.moveTo(p1.x, p1.y);
                    this.ctx.lineTo(this.mouse.x, this.mouse.y);
                    this.ctx.strokeStyle = `rgba(224, 122, 21, ${alpha})`; // Soft amber interactive trace
                    this.ctx.lineWidth = 0.6;
                    this.ctx.stroke();
                }
            }
        }
    }

    drawBlocks() {
        const len = this.blockParticles.length;
        for (let i = 0; i < len; i++) {
            const b = this.blockParticles[i];
            b.pulseValue += b.pulseSpeed;
            b.rotation += b.rotationSpeed;
            const sizePulse = b.radius + Math.sin(b.pulseValue) * 2;
            
            // 1. Soft radial background glow (represents local block node field)
            const glowGradient = this.ctx.createRadialGradient(
                b.x, b.y, sizePulse * 0.1,
                b.x, b.y, sizePulse * 3
            );
            glowGradient.addColorStop(0, 'rgba(197, 163, 88, 0.15)');
            glowGradient.addColorStop(0.5, 'rgba(224, 122, 21, 0.03)');
            glowGradient.addColorStop(1, 'rgba(8, 8, 10, 0)');

            this.ctx.beginPath();
            this.ctx.arc(b.x, b.y, sizePulse * 3, 0, Math.PI * 2);
            this.ctx.fillStyle = glowGradient;
            this.ctx.fill();

            // 2. High-end orbit graphic: Slow-rotating dotted delicate ring (Gold)
            this.ctx.save();
            this.ctx.translate(b.x, b.y);
            this.ctx.rotate(b.rotation);
            
            this.ctx.beginPath();
            this.ctx.arc(0, 0, sizePulse * 1.6, 0, Math.PI * 2);
            this.ctx.strokeStyle = 'rgba(197, 163, 88, 0.2)';
            this.ctx.lineWidth = 0.75;
            this.ctx.setLineDash([2, 5]); // Delicate dotted circular orbit
            this.ctx.stroke();
            this.ctx.restore();

            // 3. Central solid star node: Small golden dot with soft high-contrast core
            this.ctx.beginPath();
            this.ctx.arc(b.x, b.y, 2, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            this.ctx.shadowBlur = 8;
            this.ctx.shadowColor = '#c5a358';
            this.ctx.fill();
        }
        
        // Reset shadow configuration for main drawings
        this.ctx.shadowBlur = 0;
    }

    update() {
        // Update transaction nodes
        for (let p of this.particles) {
            p.x += p.vx;
            p.y += p.vy;

            // Bounce off boundaries
            if (p.x < 0 || p.x > this.canvas.width) p.vx *= -1;
            if (p.y < 0 || p.y > this.canvas.height) p.vy *= -1;
        }

        // Update consensus star nodes (extremely gentle drift wrapping around screen edges)
        for (let b of this.blockParticles) {
            b.x += b.vx;
            b.y += b.vy;

            if (b.x < -100) b.x = this.canvas.width + 100;
            if (b.x > this.canvas.width + 100) b.x = -100;
            if (b.y < -100) b.y = this.canvas.height + 100;
            if (b.y > this.canvas.height + 100) b.y = -100;
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Render network mesh
        this.drawMesh();
        
        // Render consensus star nodes
        this.drawBlocks();
        
        // Update positions
        this.update();
        
        requestAnimationFrame(() => this.animate());
    }
}

// Instantiate particles when DOM is fully ready
document.addEventListener('DOMContentLoaded', () => {
    new P2PNetworkBackground('network-canvas');
});
