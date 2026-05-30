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
            maxDistance: 120,
            nodeColor: 'rgba(247, 147, 26, 0.4)', // Bitcoin orange with opacity
            lineColor: 'rgba(212, 175, 55, 0.08)',  // Gold with very low opacity
            blockColor: 'rgba(247, 147, 26, 0.7)',
            mouseLineColor: 'rgba(247, 147, 26, 0.2)'
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

        // Generate slow-moving gold blocks
        for (let i = 0; i < 5; i++) {
            this.blockParticles.push(this.createBlockParticle());
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        
        // Adjust particle count based on screen size
        if (window.innerWidth < 768) {
            this.config.particleCount = 40;
            this.config.maxDistance = 80;
        } else {
            this.config.particleCount = 80;
            this.config.maxDistance = 120;
        }
    }

    createParticle() {
        return {
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            vx: (Math.random() - 0.5) * 0.35,
            vy: (Math.random() - 0.5) * 0.35,
            radius: Math.random() * 2 + 1,
            pulseSpeed: 0.02 + Math.random() * 0.03,
            pulseValue: Math.random() * Math.PI
        };
    }

    createBlockParticle() {
        return {
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            vx: (Math.random() - 0.5) * 0.15,
            vy: (Math.random() - 0.5) * 0.15,
            radius: Math.random() * 6 + 4,
            pulseSpeed: 0.01 + Math.random() * 0.01,
            pulseValue: Math.random() * Math.PI,
            label: '#' + Math.floor(Math.random() * 1000000)
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
        for (let i = 0; i < len; i++) {
            const p1 = this.particles[i];
            
            // Pulse particle opacity and size for shimmering effect
            p1.pulseValue += p1.pulseSpeed;
            const sizePulse = p1.radius + Math.sin(p1.pulseValue) * 0.5;
            const opacity = 0.2 + Math.sin(p1.pulseValue) * 0.15;
            
            this.ctx.beginPath();
            this.ctx.arc(p1.x, p1.y, sizePulse, 0, Math.PI * 2);
            this.ctx.fillStyle = `rgba(247, 147, 26, ${opacity})`;
            this.ctx.fill();

            // Connect to other nodes
            for (let j = i + 1; j < len; j++) {
                const p2 = this.particles[j];
                const dx = p1.x - p2.x;
                const dy = p1.y - p2.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < this.config.maxDistance) {
                    const alpha = (1 - dist / this.config.maxDistance) * 0.12;
                    this.ctx.beginPath();
                    this.ctx.moveTo(p1.x, p1.y);
                    this.ctx.lineTo(p2.x, p2.y);
                    this.ctx.strokeStyle = `rgba(212, 175, 55, ${alpha})`;
                    this.ctx.lineWidth = 0.6;
                    this.ctx.stroke();
                }
            }

            // Connect to mouse
            if (this.mouse.x !== null) {
                const dx = p1.x - this.mouse.x;
                const dy = p1.y - this.mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < this.mouse.radius) {
                    const alpha = (1 - dist / this.mouse.radius) * 0.25;
                    this.ctx.beginPath();
                    this.ctx.moveTo(p1.x, p1.y);
                    this.ctx.lineTo(this.mouse.x, this.mouse.y);
                    this.ctx.strokeStyle = `rgba(247, 147, 26, ${alpha})`;
                    this.ctx.lineWidth = 0.8;
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
            const sizePulse = b.radius + Math.sin(b.pulseValue) * 1.5;
            
            // Draw a glowing block representation (outer glow)
            const glowGradient = this.ctx.createRadialGradient(
                b.x, b.y, sizePulse * 0.2,
                b.x, b.y, sizePulse * 2
            );
            glowGradient.addColorStop(0, 'rgba(247, 147, 26, 0.4)');
            glowGradient.addColorStop(0.5, 'rgba(212, 175, 55, 0.08)');
            glowGradient.addColorStop(1, 'rgba(7, 7, 9, 0)');

            this.ctx.beginPath();
            this.ctx.arc(b.x, b.y, sizePulse * 2, 0, Math.PI * 2);
            this.ctx.fillStyle = glowGradient;
            this.ctx.fill();

            // Inner solid block core (square representing a bitcoin block)
            this.ctx.save();
            this.ctx.translate(b.x, b.y);
            this.ctx.rotate(b.pulseValue * 0.1);
            
            this.ctx.beginPath();
            const side = sizePulse;
            this.ctx.rect(-side / 2, -side / 2, side, side);
            this.ctx.fillStyle = 'rgba(247, 147, 26, 0.85)';
            this.ctx.shadowBlur = 15;
            this.ctx.shadowColor = '#f7931a';
            this.ctx.fill();
            
            // Gold border
            this.ctx.strokeStyle = '#d4af37';
            this.ctx.lineWidth = 1.5;
            this.ctx.stroke();
            this.ctx.restore();
        }
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

        // Update block nodes
        for (let b of this.blockParticles) {
            b.x += b.vx;
            b.y += b.vy;

            if (b.x < -20) b.x = this.canvas.width + 20;
            if (b.x > this.canvas.width + 20) b.x = -20;
            if (b.y < -20) b.y = this.canvas.height + 20;
            if (b.y > this.canvas.height + 20) b.y = -20;
        }
    }

    animate() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Render network mesh
        this.drawMesh();
        
        // Render block nodes
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
