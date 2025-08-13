/**
 * Enhanced 3D Robot Arm Visualizer
 * Realistic robot arm simulation with smooth animations
 */

class RobotVisualizer {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        if (!this.canvas) {
            console.error('Canvas not found:', canvasId);
            return;
        }

        this.ctx = this.canvas.getContext('2d');

        // Robot state
        this.position = { x: 0, y: 0, z: 0 };
        this.targetPosition = { x: 0, y: 0, z: 0 };
        this.currentPosition = { x: 0, y: 0, z: 0 };
        this.gripperOpen = true;
        this.isAnimating = false;
        this.animationSpeed = 0.02;

        // Animation
        this.animationId = null;
        this.commandQueue = [];
        this.currentCommandIndex = 0;
        this.executionStartTime = null;
        this.isPaused = false;

        // 3D perspective settings
        this.cameraAngle = 0.3;
        this.cameraHeight = 0.8;
        this.scale = 1.5;

        // Colors
        this.colors = {
            background: '#1a1a1a',
            grid: '#333333',
            arm1: '#e53e3e',
            arm2: '#3182ce',
            arm3: '#10b981',
            base: '#4a5568',
            gripper: {
                open: '#38a169',
                closed: '#e53e3e'
            },
            workspace: '#2d3748',
            objects: ['#ef4444', '#3b82f6', '#10b981', '#f59e0b']
        };

        // Sample objects for demonstration
        this.objects = [
            { x: -80, y: 60, z: 15, type: 'cube', color: '#ef4444', name: 'Red Cube' },
            { x: 100, y: -40, z: 20, type: 'sphere', color: '#3b82f6', name: 'Blue Ball' },
            { x: -60, y: -80, z: 10, type: 'cylinder', color: '#10b981', name: 'Green Container' },
            { x: 120, y: 80, z: 25, type: 'cube', color: '#f59e0b', name: 'Yellow Block' }
        ];

        this.init();
    }

    init() {
        this.setupCanvas();
        this.draw();
        this.updateDisplay();

        // Start animation loop
        this.animate();

        console.log('🤖 Robot Visualizer initialized');
    }

    setupCanvas() {
        // Handle high DPI displays
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;

        this.canvas.width = rect.width * dpr;
        this.canvas.height = rect.height * dpr;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';

        this.ctx.scale(dpr, dpr);

        // Update canvas dimensions for calculations
        this.canvasWidth = rect.width;
        this.canvasHeight = rect.height;
        this.centerX = this.canvasWidth / 2;
        this.centerY = this.canvasHeight - 80;
    }

    /**
     * Convert 3D world coordinates to 2D screen coordinates
     */
    project3D(x, y, z) {
        // Simple isometric projection
        const scale = this.scale;
        const screenX = this.centerX + (x - y) * Math.cos(Math.PI / 6) * scale;
        const screenY = this.centerY - (x + y) * Math.sin(Math.PI / 6) * scale - z * scale;

        return { x: screenX, y: screenY };
    }

    /**
     * Main drawing function
     */
    draw() {
        this.clearCanvas();
        this.drawWorkspace();
        this.drawObjects();
        this.drawRobotArm();
        this.drawCoordinateSystem();
    }

    clearCanvas() {
        this.ctx.fillStyle = this.colors.background;
        this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight);
    }

    drawWorkspace() {
        const ctx = this.ctx;

        // Draw floor grid
        ctx.strokeStyle = this.colors.grid;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 2]);

        const gridSize = 40;
        const gridRange = 200;

        for (let x = -gridRange; x <= gridRange; x += gridSize) {
            for (let y = -gridRange; y <= gridRange; y += gridSize) {
                // Grid lines
                const p1 = this.project3D(x, y, 0);
                const p2 = this.project3D(x + gridSize, y, 0);
                const p3 = this.project3D(x, y + gridSize, 0);

                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p2.x, p2.y);
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(p1.x, p1.y);
                ctx.lineTo(p3.x, p3.y);
                ctx.stroke();
            }
        }

        ctx.setLineDash([]);

        // Draw workspace boundary
        ctx.strokeStyle = this.colors.workspace;
        ctx.lineWidth = 2;
        const corners = [
            this.project3D(-200, -200, 0),
            this.project3D(200, -200, 0),
            this.project3D(200, 200, 0),
            this.project3D(-200, 200, 0)
        ];

        ctx.beginPath();
        ctx.moveTo(corners[0].x, corners[0].y);
        for (let i = 1; i < corners.length; i++) {
            ctx.lineTo(corners[i].x, corners[i].y);
        }
        ctx.closePath();
        ctx.stroke();
    }

    drawObjects() {
        this.objects.forEach((obj, index) => {
            const pos = this.project3D(obj.x, obj.y, obj.z);

            this.ctx.fillStyle = obj.color;
            this.ctx.strokeStyle = '#ffffff';
            this.ctx.lineWidth = 2;

            // Add shadow
            const shadowPos = this.project3D(obj.x + 5, obj.y + 5, 0);
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            this.ctx.beginPath();
            this.ctx.ellipse(shadowPos.x, shadowPos.y, 15, 8, 0, 0, 2 * Math.PI);
            this.ctx.fill();

            // Draw object
            this.ctx.fillStyle = obj.color;

            switch (obj.type) {
                case 'cube':
                    this.drawCube(pos, 20, obj.color);
                    break;
                case 'sphere':
                    this.drawSphere(pos, 15, obj.color);
                    break;
                case 'cylinder':
                    this.drawCylinder(pos, 12, 20, obj.color);
                    break;
            }

            // Label
            this.ctx.fillStyle = '#ffffff';
            this.ctx.font = '12px Arial';
            this.ctx.fillText(obj.name, pos.x - 30, pos.y - 30);
        });
    }

    drawCube(pos, size, color) {
        const ctx = this.ctx;
        const half = size / 2;

        // Define cube vertices in 3D
        const vertices = [
            this.project3D(pos.x - half, pos.y - half, pos.z - half),
            this.project3D(pos.x + half, pos.y - half, pos.z - half),
            this.project3D(pos.x + half, pos.y + half, pos.z - half),
            this.project3D(pos.x - half, pos.y + half, pos.z - half),
            this.project3D(pos.x - half, pos.y - half, pos.z + half),
            this.project3D(pos.x + half, pos.y - half, pos.z + half),
            this.project3D(pos.x + half, pos.y + half, pos.z + half),
            this.project3D(pos.x - half, pos.y + half, pos.z + half)
        ];

        // Draw visible faces
        ctx.fillStyle = color;

        // Top face
        ctx.beginPath();
        ctx.moveTo(vertices[4].x, vertices[4].y);
        ctx.lineTo(vertices[5].x, vertices[5].y);
        ctx.lineTo(vertices[6].x, vertices[6].y);
        ctx.lineTo(vertices[7].x, vertices[7].y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Right face (darker)
        ctx.fillStyle = this.darkenColor(color, 0.3);
        ctx.beginPath();
        ctx.moveTo(vertices[1].x, vertices[1].y);
        ctx.lineTo(vertices[5].x, vertices[5].y);
        ctx.lineTo(vertices[6].x, vertices[6].y);
        ctx.lineTo(vertices[2].x, vertices[2].y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Front face (darker)
        ctx.fillStyle = this.darkenColor(color, 0.2);
        ctx.beginPath();
        ctx.moveTo(vertices[0].x, vertices[0].y);
        ctx.lineTo(vertices[4].x, vertices[4].y);
        ctx.lineTo(vertices[7].x, vertices[7].y);
        ctx.lineTo(vertices[3].x, vertices[3].y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    drawSphere(pos, radius, color) {
        const ctx = this.ctx;

        // Draw sphere with gradient
        const gradient = ctx.createRadialGradient(
            pos.x - radius / 3, pos.y - radius / 3, 0,
            pos.x, pos.y, radius
        );
        gradient.addColorStop(0, this.lightenColor(color, 0.3));
        gradient.addColorStop(1, color);

        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.stroke();
    }

    drawCylinder(pos, radius, height, color) {
        const ctx = this.ctx;

        // Draw cylinder
        const topPos = this.project3D(pos.x, pos.y, pos.z + height);

        // Side
        ctx.fillStyle = this.darkenColor(color, 0.2);
        ctx.beginPath();
        ctx.moveTo(pos.x - radius, pos.y);
        ctx.lineTo(topPos.x - radius, topPos.y);
        ctx.lineTo(topPos.x + radius, topPos.y);
        ctx.lineTo(pos.x + radius, pos.y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        // Top
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(topPos.x, topPos.y, radius, radius * 0.3, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
    }

    drawRobotArm() {
        const ctx = this.ctx;

        // Robot arm parameters
        const basePos = this.project3D(0, 0, 0);
        const armLength1 = 80;
        const armLength2 = 60;
        const armLength3 = 40;

        // Calculate joint positions using current position
        const distance = Math.sqrt(this.currentPosition.x ** 2 + this.currentPosition.y ** 2);
        const angle1 = Math.atan2(this.currentPosition.y, this.currentPosition.x);
        const angle2 = Math.atan2(this.currentPosition.z, distance) * 0.5;
        const angle3 = angle2 * 0.3;

        // Joint positions in 3D space
        const joint1_3d = {
            x: armLength1 * Math.cos(angle1),
            y: armLength1 * Math.sin(angle1),
            z: 20
        };

        const joint2_3d = {
            x: joint1_3d.x + armLength2 * Math.cos(angle1 + angle2),
            y: joint1_3d.y + armLength2 * Math.sin(angle1 + angle2),
            z: joint1_3d.z + armLength2 * Math.sin(angle2)
        };

        const endEffector_3d = {
            x: joint2_3d.x + armLength3 * Math.cos(angle1 + angle2 + angle3),
            y: joint2_3d.y + armLength3 * Math.sin(angle1 + angle2 + angle3),
            z: joint2_3d.z + armLength3 * Math.sin(angle3)
        };

        // Project to 2D
        const joint1 = this.project3D(joint1_3d.x, joint1_3d.y, joint1_3d.z);
        const joint2 = this.project3D(joint2_3d.x, joint2_3d.y, joint2_3d.z);
        const endEffector = this.project3D(endEffector_3d.x, endEffector_3d.y, endEffector_3d.z);

        // Draw base
        this.drawCylinder({ x: 0, y: 0, z: 0 }, 25, 20, this.colors.base);

        // Draw arm segments
        this.drawArmSegment(basePos, joint1, 12, this.colors.arm1);
        this.drawArmSegment(joint1, joint2, 8, this.colors.arm2);
        this.drawArmSegment(joint2, endEffector, 6, this.colors.arm3);

        // Draw joints
        this.drawJoint(joint1, 10);
        this.drawJoint(joint2, 8);

        // Draw end effector
        const gripperColor = this.gripperOpen ? this.colors.gripper.open : this.colors.gripper.closed;
        this.drawSphere(endEffector, 8, gripperColor);

        // Draw gripper jaws
        this.drawGripper(endEffector, angle1 + angle2 + angle3);

        // Draw target position indicator
        if (this.isAnimating) {
            const targetPos = this.project3D(this.targetPosition.x, this.targetPosition.y, this.targetPosition.z);
            ctx.strokeStyle = '#fbbf24';
            ctx.lineWidth = 3;
            ctx.setLineDash([8, 8]);
            ctx.beginPath();
            ctx.arc(targetPos.x, targetPos.y, 15, 0, 2 * Math.PI);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    drawArmSegment(start, end, thickness, color) {
        const ctx = this.ctx;

        ctx.strokeStyle = color;
        ctx.lineWidth = thickness;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        // Add highlight
        ctx.strokeStyle = this.lightenColor(color, 0.3);
        ctx.lineWidth = thickness * 0.3;
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
    }

    drawJoint(pos, size) {
        const ctx = this.ctx;

        ctx.fillStyle = this.colors.base;
        ctx.strokeStyle = '#2d3748';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(pos.x, pos.y, size, 0, 2 * Math.PI);
        ctx.fill();
        ctx.stroke();
    }

    drawGripper(pos, angle) {
        const ctx = this.ctx;

        ctx.strokeStyle = '#2d3748';
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';

        if (this.gripperOpen) {
            // Open gripper
            const jawLength = 15;
            const jawAngle = 0.5;

            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.lineTo(
                pos.x + jawLength * Math.cos(angle + jawAngle),
                pos.y + jawLength * Math.sin(angle + jawAngle)
            );
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.lineTo(
                pos.x + jawLength * Math.cos(angle - jawAngle),
                pos.y + jawLength * Math.sin(angle - jawAngle)
            );
            ctx.stroke();
        } else {
            // Closed gripper
            const jawLength = 12;

            ctx.beginPath();
            ctx.moveTo(pos.x, pos.y);
            ctx.lineTo(
                pos.x + jawLength * Math.cos(angle),
                pos.y + jawLength * Math.sin(angle)
            );
            ctx.stroke();
        }
    }

    drawCoordinateSystem() {
        const ctx = this.ctx;
        const origin = this.project3D(0, 0, 0);
        const axisLength = 50;

        // X axis (red)
        const xEnd = this.project3D(axisLength, 0, 0);
        ctx.strokeStyle = '#ef4444';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(xEnd.x, xEnd.y);
        ctx.stroke();

        // Y axis (green)
        const yEnd = this.project3D(0, axisLength, 0);
        ctx.strokeStyle = '#10b981';
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(yEnd.x, yEnd.y);
        ctx.stroke();

        // Z axis (blue)
        const zEnd = this.project3D(0, 0, axisLength);
        ctx.strokeStyle = '#3b82f6';
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(zEnd.x, zEnd.y);
        ctx.stroke();

        // Labels
        ctx.fillStyle = '#ffffff';
        ctx.font = '14px Arial';
        ctx.fillText('X', xEnd.x + 5, xEnd.y);
        ctx.fillText('Y', yEnd.x + 5, yEnd.y);
        ctx.fillText('Z', zEnd.x + 5, zEnd.y);
    }

    /**
     * Animation loop
     */
    animate() {
        // Smooth interpolation towards target position
        if (this.isAnimating) {
            const dx = this.targetPosition.x - this.currentPosition.x;
            const dy = this.targetPosition.y - this.currentPosition.y;
            const dz = this.targetPosition.z - this.currentPosition.z;

            this.currentPosition.x += dx * this.animationSpeed;
            this.currentPosition.y += dy * this.animationSpeed;
            this.currentPosition.z += dz * this.animationSpeed;

            // Check if reached target
            const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);
            if (distance < 2) {
                this.currentPosition = { ...this.targetPosition };
                this.completeCurrentCommand();
            }
        }

        // Update display
        this.position = { ...this.currentPosition };
        this.draw();
        this.updateDisplay();

        // Continue animation
        requestAnimationFrame(() => this.animate());
    }

    /**
     * Load command sequence
     */
    loadCommands(commands) {
        this.commandQueue = commands.map((cmd, index) => ({
            ...cmd,
            index: index,
            completed: false
        }));
        this.currentCommandIndex = 0;
        this.updateCommandDisplay();
        console.log('📝 Loaded', commands.length, 'commands');
    }

    /**
     * Start execution
     */
    startExecution() {
        if (this.commandQueue.length === 0) return;

        this.isAnimating = true;
        this.isPaused = false;
        this.executionStartTime = Date.now();
        this.currentCommandIndex = 0;

        console.log('🚀 Starting robot execution');
        this.executeNextCommand();
        this.updateControls();
        this.showExecutionInfo();
    }

    /**
     * Execute next command
     */
    executeNextCommand() {
        if (this.isPaused || this.currentCommandIndex >= this.commandQueue.length) {
            if (this.currentCommandIndex >= this.commandQueue.length) {
                this.completeExecution();
            }
            return;
        }

        const command = this.commandQueue[this.currentCommandIndex];
        this.markCommandActive(this.currentCommandIndex);

        console.log(`🎯 Executing command ${this.currentCommandIndex + 1}:`, command.action);

        switch (command.action) {
            case 'move_to':
                this.targetPosition = { x: command.x, y: command.y, z: command.z };
                this.animationSpeed = (command.speed || 50) / 2500; // Adjust speed
                break;

            case 'close_gripper':
                this.gripperOpen = false;
                setTimeout(() => this.completeCurrentCommand(), 1000);
                break;

            case 'open_gripper':
                this.gripperOpen = true;
                setTimeout(() => this.completeCurrentCommand(), 1000);
                break;

            default:
                setTimeout(() => this.completeCurrentCommand(), 500);
        }
    }

    /**
     * Complete current command
     */
    completeCurrentCommand() {
        if (this.currentCommandIndex < this.commandQueue.length) {
            this.markCommandCompleted(this.currentCommandIndex);
            this.currentCommandIndex++;
        }

        setTimeout(() => this.executeNextCommand(), 200);
    }

    /**
     * Complete execution
     */
    completeExecution() {
        this.isAnimating = false;
        console.log('✅ Execution complete!');
        this.updateControls();

        // Show completion notification
        if (window.app && window.app.showNotification) {
            window.app.showNotification('success', 'Execution Complete', 'All robot commands executed successfully!');
        }
    }

    /**
     * Utility functions
     */
    lightenColor(color, amount) {
        const hex = color.replace('#', '');
        const r = Math.min(255, parseInt(hex.substr(0, 2), 16) + amount * 255);
        const g = Math.min(255, parseInt(hex.substr(2, 2), 16) + amount * 255);
        const b = Math.min(255, parseInt(hex.substr(4, 2), 16) + amount * 255);
        return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
    }

    darkenColor(color, amount) {
        return this.lightenColor(color, -amount);
    }

    updateDisplay() {
        if (document.getElementById('posX')) {
            document.getElementById('posX').textContent = Math.round(this.position.x);
            document.getElementById('posY').textContent = Math.round(this.position.y);
            document.getElementById('posZ').textContent = Math.round(this.position.z);
            document.getElementById('gripperState').textContent = this.gripperOpen ? 'Open' : 'Closed';
        }
    }

    updateControls() {
        const simulateBtn = document.getElementById('simulateBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const stopBtn = document.getElementById('stopBtn');

        if (simulateBtn) simulateBtn.disabled = this.isAnimating || this.commandQueue.length === 0;
        if (pauseBtn) pauseBtn.disabled = !this.isAnimating;
        if (stopBtn) stopBtn.disabled = !this.isAnimating;
    }

    showExecutionInfo() {
        const executionInfo = document.getElementById('executionInfo');
        if (executionInfo) {
            executionInfo.style.display = 'block';
        }
    }

    updateCommandDisplay() {
        const commandSequence = document.getElementById('commandSequence');
        if (!commandSequence || this.commandQueue.length === 0) return;

        commandSequence.innerHTML = this.commandQueue.map((cmd, index) => `
            <div class="command-item ${cmd.completed ? 'completed' : ''} ${index === this.currentCommandIndex ? 'active' : ''}" data-index="${index}">
                <div class="command-number">${index + 1}</div>
                <div class="command-details">
                    <div class="command-action">${cmd.action.replace('_', ' ').toUpperCase()}</div>
                    <div class="command-description">${cmd.description || 'No description'}</div>
                    ${cmd.x !== undefined ? `<div class="command-params">X:${cmd.x} Y:${cmd.y} Z:${cmd.z}</div>` : ''}
                </div>
            </div>
        `).join('');
    }

    markCommandActive(index) {
        const commandItems = document.querySelectorAll('.command-item');
        commandItems.forEach((item, i) => {
            item.classList.toggle('active', i === index);
        });
    }

    markCommandCompleted(index) {
        const commandItem = document.querySelector(`.command-item[data-index="${index}"]`);
        if (commandItem) {
            commandItem.classList.add('completed');
            commandItem.classList.remove('active');
        }

        if (this.commandQueue[index]) {
            this.commandQueue[index].completed = true;
        }
    }

    pauseExecution() {
        this.isPaused = true;
        this.updateControls();
    }

    resumeExecution() {
        this.isPaused = false;
        this.updateControls();
        this.executeNextCommand();
    }

    stopExecution() {
        this.isAnimating = false;
        this.isPaused = false;
        this.currentPosition = { x: 0, y: 0, z: 0 };
        this.targetPosition = { x: 0, y: 0, z: 0 };
        this.gripperOpen = true;
        this.updateControls();

        const executionInfo = document.getElementById('executionInfo');
        if (executionInfo) {
            executionInfo.style.display = 'none';
        }

        this.updateCommandDisplay();
        console.log('⏹️ Execution stopped');
    }

    handleResize() {
        this.setupCanvas();
        this.draw();
    }

    getState() {
        return {
            position: { ...this.position },
            gripperOpen: this.gripperOpen,
            isAnimating: this.isAnimating,
            isPaused: this.isPaused,
            currentCommandIndex: this.currentCommandIndex,
            totalCommands: this.commandQueue.length
        };
    }

    destroy() {
        this.stopExecution();
        console.log('🤖 Robot Visualizer destroyed');
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = RobotVisualizer;
}
