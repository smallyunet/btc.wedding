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
        this.mouse = { x: null, y: null, radius: 180 };
        
        this.config = {
            particleCount: 80,
            maxDistance: 125,
            orangeNode: 'rgba(247, 147, 26, ', // Bitcoin Amber
            blueNode: 'rgba(56, 189, 248, ',    // Electric Sky Blue
            blockColor: 'rgba(247, 147, 26, 0.6)'
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
        
        // Adjust particle count based on screen size for performance
        if (window.innerWidth < 768) {
            this.config.particleCount = 35;
            this.config.maxDistance = 85;
        } else {
            this.config.particleCount = 75;
            this.config.maxDistance = 125;
        }
    }

    createParticle() {
        const isBlue = Math.random() < 0.22; // 22% electric blue nodes for a high-end dual-tone effect
        return {
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            vx: (Math.random() - 0.5) * 0.08, // slow drift
            vy: (Math.random() - 0.5) * 0.08,
            radius: Math.random() * 1.5 + 0.8,
            pulseSpeed: 0.005 + Math.random() * 0.01,
            pulseValue: Math.random() * Math.PI,
            color: isBlue ? this.config.blueNode : this.config.orangeNode,
            isBlue: isBlue
        };
    }

    createBlockParticle() {
        return {
            x: Math.random() * this.canvas.width,
            y: Math.random() * this.canvas.height,
            vx: (Math.random() - 0.5) * 0.03, // imperceptible drift
            vy: (Math.random() - 0.5) * 0.03,
            radius: Math.random() * 12 + 8,
            pulseSpeed: 0.003 + Math.random() * 0.005,
            pulseValue: Math.random() * Math.PI,
            rotation: Math.random() * Math.PI * 2,
            rotationSpeed: (Math.random() - 0.5) * 0.001
        };
    }

    registerEvents() {
        window.addEventListener('resize', () => this.init());
        
        window.addEventListener('mousemove', (e) => {
            this.mouse.x = e.clientX;
            this.mouse.y = e.clientY;
        });

        window.addEventListener('mouseout', () => {
            this.mouse.x = null;
            this.mouse.y = null;
        });
    }

    drawMesh() {
        const len = this.particles.length;
        this.ctx.shadowBlur = 0; // Disable slow glowing filters
        
        for (let i = 0; i < len; i++) {
            const p1 = this.particles[i];
            
            // Pulse particle opacity and size for shimmering effect
            p1.pulseValue += p1.pulseSpeed;
            const sizePulse = p1.radius + Math.sin(p1.pulseValue) * 0.3;
            const opacity = 0.12 + Math.sin(p1.pulseValue) * 0.08;
            
            this.ctx.beginPath();
            this.ctx.arc(p1.x, p1.y, sizePulse, 0, Math.PI * 2);
            this.ctx.fillStyle = `${p1.color}${opacity})`;
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
                    
                    // Style connection lines based on node colors
                    if (p1.isBlue && p2.isBlue) {
                        this.ctx.strokeStyle = `rgba(56, 189, 248, ${alpha})`;
                    } else {
                        this.ctx.strokeStyle = `rgba(247, 147, 26, ${alpha})`;
                    }
                    
                    this.ctx.lineWidth = 0.55;
                    this.ctx.stroke();
                }
            }

            // Subtle interaction with mouse hover
            if (this.mouse.x !== null) {
                const dx = p1.x - this.mouse.x;
                const dy = p1.y - this.mouse.y;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < this.mouse.radius) {
                    const alpha = (1 - dist / this.mouse.radius) * 0.12;
                    this.ctx.beginPath();
                    this.ctx.moveTo(p1.x, p1.y);
                    this.ctx.lineTo(this.mouse.x, this.mouse.y);
                    
                    // Match interactive trace to the node's native theme
                    this.ctx.strokeStyle = p1.isBlue 
                        ? `rgba(56, 189, 248, ${alpha})`
                        : `rgba(247, 147, 26, ${alpha})`;
                        
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
            glowGradient.addColorStop(0, 'rgba(247, 147, 26, 0.12)');
            glowGradient.addColorStop(0.5, 'rgba(247, 147, 26, 0.02)');
            glowGradient.addColorStop(1, 'rgba(4, 6, 10, 0)');

            this.ctx.beginPath();
            this.ctx.arc(b.x, b.y, sizePulse * 3, 0, Math.PI * 2);
            this.ctx.fillStyle = glowGradient;
            this.ctx.fill();

            // 2. Slow-rotating dotted delicate ring (Gold)
            this.ctx.save();
            this.ctx.translate(b.x, b.y);
            this.ctx.rotate(b.rotation);
            
            this.ctx.beginPath();
            this.ctx.arc(0, 0, sizePulse * 1.6, 0, Math.PI * 2);
            this.ctx.strokeStyle = 'rgba(247, 147, 26, 0.18)';
            this.ctx.lineWidth = 0.75;
            this.ctx.setLineDash([2, 5]); // Delicate dotted circular orbit
            this.ctx.stroke();
            this.ctx.restore();

            // 3. Central solid star node: Small golden dot with soft high-contrast core
            this.ctx.beginPath();
            this.ctx.arc(b.x, b.y, 2, 0, Math.PI * 2);
            this.ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            this.ctx.shadowBlur = 8;
            this.ctx.shadowColor = '#f7931a';
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
