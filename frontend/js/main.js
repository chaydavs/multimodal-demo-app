/**
 * Main Application Controller
 * Coordinates all components and handles user interactions
 */

class MultimodalRoboticsApp {
    constructor() {
        this.currentImage = null;
        this.currentImageData = null;
        this.analysisResult = null;
        this.robotCommands = [];
        this.isProcessing = false;

        // Initialize components
        this.robotVisualizer = null;
        this.notificationManager = new NotificationManager();

        this.init();
    }

    async init() {
        this.setupEventListeners();
        this.initializeUI();
        await this.loadAvailableModels();

        // Initialize robot visualizer after DOM is ready
        setTimeout(() => {
            this.initializeRobotVisualizer();
        }, 100);

        // Show welcome message
        this.showNotification('info', 'Welcome!', 'Upload an image and describe your robotics task to get started.');
    }

    initializeRobotVisualizer() {
        try {
            this.robotVisualizer = new RobotVisualizer('robotCanvas');
            console.log('✅ Robot visualizer initialized');
        } catch (error) {
            console.error('❌ Failed to initialize robot visualizer:', error);
        }
    }

    setupEventListeners() {
        // File upload
        const imageInput = document.getElementById('imageInput');
        const uploadArea = document.getElementById('uploadArea');

        if (imageInput) imageInput.addEventListener('change', (e) => this.handleFileSelect(e));
        if (uploadArea) uploadArea.addEventListener('click', () => imageInput.click());

        // Drag and drop
        if (uploadArea) {
            uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
            uploadArea.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            uploadArea.addEventListener('drop', (e) => this.handleFileDrop(e));
        }

        // Task input
        const taskInput = document.getElementById('taskInput');
        if (taskInput) {
            taskInput.addEventListener('input', () => this.updateCharacterCount());
            taskInput.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'Enter') {
                    this.processRequest();
                }
            });
        }

        // Control buttons
        const processBtn = document.getElementById('processBtn');
        const resetBtn = document.getElementById('resetBtn');

        if (processBtn) processBtn.addEventListener('click', () => this.processRequest());
        if (resetBtn) resetBtn.addEventListener('click', () => this.resetApplication());

        // Robot controls
        const simulateBtn = document.getElementById('simulateBtn');
        const pauseBtn = document.getElementById('pauseBtn');
        const stopBtn = document.getElementById('stopBtn');

        if (simulateBtn) simulateBtn.addEventListener('click', () => this.startSimulation());
        if (pauseBtn) pauseBtn.addEventListener('click', () => this.togglePause());
        if (stopBtn) stopBtn.addEventListener('click', () => this.stopSimulation());

        // AI model selection
        const aiModelSelect = document.getElementById('aiModel');
        if (aiModelSelect) aiModelSelect.addEventListener('change', (e) => this.switchAIModel(e.target.value));

        // Window events
        window.addEventListener('resize', () => this.handleResize());
        window.addEventListener('beforeunload', () => this.cleanup());

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboardShortcuts(e));
    }

    initializeUI() {
        this.updateCharacterCount();
        this.updateControls();

        // Set initial focus
        const taskInput = document.getElementById('taskInput');
        if (taskInput) {
            taskInput.focus();
        }
    }

    async loadAvailableModels() {
        try {
            const response = await apiClient.getAvailableModels();
            this.updateModelSelector(response.models, response.current_model);
        } catch (error) {
            console.warn('Failed to load available models:', error);
        }
    }

    updateModelSelector(availableModels, currentModel) {
        const select = document.getElementById('aiModel');
        if (!select) return;

        select.innerHTML = '';

        availableModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model;
            option.textContent = this.getModelDisplayName(model);
            option.selected = model === currentModel;
            select.appendChild(option);
        });
    }

    getModelDisplayName(modelName) {
        const displayNames = {
            'mock': 'Mock (Demo)',
            'openai': 'OpenAI GPT-4 Vision',
            'anthropic': 'Anthropic Claude',
            'google': 'Google Gemini Pro Vision'
        };
        return displayNames[modelName] || modelName;
    }

    async switchAIModel(modelName) {
        try {
            this.showLoading('Switching AI model...');
            await apiClient.switchModel(modelName);
            this.showNotification('success', 'Model Switched', `Now using ${this.getModelDisplayName(modelName)}`);
        } catch (error) {
            this.showNotification('error', 'Model Switch Failed', error.message);
            await this.loadAvailableModels();
        } finally {
            this.hideLoading();
        }
    }

    // File handling
    handleFileSelect(event) {
        if (event.target.files.length > 0) {
            this.handleFile(event.target.files[0]);
        }
    }

    handleDragOver(event) {
        event.preventDefault();
        event.target.closest('.upload-area').classList.add('dragover');
    }

    handleDragLeave(event) {
        event.target.closest('.upload-area').classList.remove('dragover');
    }

    handleFileDrop(event) {
        event.preventDefault();
        const uploadArea = event.target.closest('.upload-area');
        uploadArea.classList.remove('dragover');

        const files = event.dataTransfer.files;
        if (files.length > 0 && files[0].type.startsWith('image/')) {
            this.handleFile(files[0]);
        }
    }

    async handleFile(file) {
        try {
            this.showLoading('Validating image...');

            const imageData = await apiClient.validateImage(file);
            this.currentImageData = imageData;

            this.showImagePreview(imageData);

            this.showNotification('success', 'Image Uploaded',
                `Image loaded successfully: ${imageData.width}x${imageData.height} pixels`);

        } catch (error) {
            this.showNotification('error', 'Upload Failed', error.message);
            this.clearImagePreview();
        } finally {
            this.hideLoading();
        }
    }

    showImagePreview(imageData) {
        const previewContainer = document.getElementById('previewContainer');
        const imagePreview = document.getElementById('imagePreview');
        const imageInfo = document.getElementById('imageInfo');

        if (previewContainer && imagePreview) {
            imagePreview.src = imageData.dataUrl;
            previewContainer.style.display = 'block';

            if (imageInfo) {
                imageInfo.innerHTML = `
                    <strong>${imageData.name}</strong><br>
                    ${imageData.width} × ${imageData.height} pixels<br>
                    ${apiClient.formatFileSize(imageData.size)}
                `;
            }
        }

        this.updateControls();
    }

    clearImagePreview() {
        const previewContainer = document.getElementById('previewContainer');
        const imageInput = document.getElementById('imageInput');

        if (previewContainer) {
            previewContainer.style.display = 'none';
        }

        if (imageInput) {
            imageInput.value = '';
        }

        this.currentImageData = null;
        this.updateControls();
    }

    // Task processing
    async processRequest() {
        if (!this.validateInputs() || this.isProcessing) return;

        this.isProcessing = true;
        const taskDescription = document.getElementById('taskInput').value.trim();

        try {
            this.showLoading('Analyzing image and generating robot commands...');
            this.clearResults();

            // Send to backend for analysis
            this.analysisResult = await apiClient.analyzeImage(
                this.currentImageData.dataUrl,
                taskDescription
            );

            // Display results
            this.displayAnalysisResults();
            this.loadRobotCommands();

            this.showNotification('success', 'Analysis Complete',
                `Generated ${this.analysisResult.commands.length} robot commands`);

        } catch (error) {
            this.showNotification('error', 'Analysis Failed', error.message);
            console.error('Processing error:', error);
        } finally {
            this.hideLoading();
            this.isProcessing = false;
        }
    }

    validateInputs() {
        if (!this.currentImageData) {
            this.showNotification('warning', 'No Image', 'Please upload an image first.');
            return false;
        }

        const taskDescription = document.getElementById('taskInput').value.trim();
        if (!taskDescription) {
            this.showNotification('warning', 'No Task Description', 'Please describe what the robot should do.');
            document.getElementById('taskInput').focus();
            return false;
        }

        if (taskDescription.length < 10) {
            this.showNotification('warning', 'Description Too Short', 'Please provide a more detailed task description.');
            document.getElementById('taskInput').focus();
            return false;
        }

        return true;
    }

    displayAnalysisResults() {
        const responseContent = document.getElementById('responseContent');
        const commandList = document.getElementById('commandList');

        if (responseContent) {
            responseContent.innerHTML = this.createAnalysisHTML();
        }

        if (commandList) {
            commandList.style.display = 'block';
        }
    }

    createAnalysisHTML() {
        const result = this.analysisResult;

        return `
            <div class="analysis-section">
                <div class="analysis-header">
                    <span>🔍</span>
                    <span>Scene Analysis</span>
                </div>
                <div class="analysis-content">
                    ${result.analysis}
                </div>
            </div>
            
            <div class="analysis-section">
                <div class="analysis-header">
                    <span>📦</span>
                    <span>Objects Detected</span>
                </div>
                <div class="objects-detected">
                    ${result.objects_detected.map(obj =>
            `<span class="object-tag">${obj.replace('_', ' ')}</span>`
        ).join('')}
                </div>
            </div>
            
            <div class="analysis-section">
                <div class="analysis-header">
                    <span>📊</span>
                    <span>Confidence Level</span>
                </div>
                <div class="confidence-meter">
                    <div class="confidence-bar">
                        <div class="confidence-fill" style="width: ${(result.confidence * 100)}%"></div>
                    </div>
                    <span class="confidence-text">${(result.confidence * 100).toFixed(1)}%</span>
                </div>
            </div>
            
            <div class="analysis-section">
                <div class="analysis-header">
                    <span>⏱️</span>
                    <span>Estimated Execution Time</span>
                </div>
                <div class="analysis-content">
                    ${result.execution_time_estimate ? `${result.execution_time_estimate.toFixed(1)} seconds` : 'Calculating...'}
                </div>
            </div>
        `;
    }

    loadRobotCommands() {
        // Convert backend format to robot visualizer format
        this.robotCommands = this.analysisResult.commands.map(cmd => ({
            action: cmd.action,
            x: cmd.x || 0,
            y: cmd.y || 0,
            z: cmd.z || 0,
            speed: cmd.speed || 50,
            description: cmd.description || `${cmd.action} command`
        }));

        // Load commands into the robot visualizer
        if (this.robotVisualizer) {
            this.robotVisualizer.loadCommands(this.robotCommands);
            console.log('🎯 Commands loaded into robot visualizer:', this.robotCommands.length);
        } else {
            console.error('❌ Robot visualizer not initialized!');
            // Try to initialize it again
            this.initializeRobotVisualizer();
            if (this.robotVisualizer) {
                this.robotVisualizer.loadCommands(this.robotCommands);
            }
        }

        this.updateControls();
    }

    clearResults() {
        const responseContent = document.getElementById('responseContent');
        const commandList = document.getElementById('commandList');

        if (responseContent) {
            responseContent.innerHTML = `
                <div class="placeholder-content">
                    <div class="placeholder-icon">🤔</div>
                    <p>Upload an image and provide instructions to get started...</p>
                    <small>The AI will analyze your image and generate precise robot commands for the task.</small>
                </div>
            `;
        }

        if (commandList) {
            commandList.style.display = 'none';
        }

        this.analysisResult = null;
        this.robotCommands = [];

        if (this.robotVisualizer) {
            this.robotVisualizer.loadCommands([]);
        }
    }

    // Robot control
    startSimulation() {
        if (this.robotCommands.length === 0) {
            this.showNotification('warning', 'No Commands', 'Generate robot commands first by processing an image and task.');
            return;
        }

        if (!this.robotVisualizer) {
            this.showNotification('error', 'Visualizer Error', 'Robot visualizer not initialized.');
            this.initializeRobotVisualizer();
            return;
        }

        this.robotVisualizer.startExecution();
        this.updateControls();

        this.showNotification('info', 'Simulation Started', 'Robot arm is executing the command sequence.');
    }

    togglePause() {
        if (!this.robotVisualizer) return;

        const state = this.robotVisualizer.getState();

        if (state.isPaused) {
            this.robotVisualizer.resumeExecution();
            this.showNotification('info', 'Simulation Resumed', 'Continuing command execution.');
        } else {
            this.robotVisualizer.pauseExecution();
            this.showNotification('info', 'Simulation Paused', 'Command execution paused.');
        }

        this.updateControls();
    }

    stopSimulation() {
        if (this.robotVisualizer) {
            this.robotVisualizer.stopExecution();
        }
        this.updateControls();

        this.showNotification('info', 'Simulation Stopped', 'Robot arm returned to home position.');
    }

    // UI updates
    updateControls() {
        const processBtn = document.getElementById('processBtn');
        const simulateBtn = document.getElementById('simulateBtn');

        if (processBtn) {
            processBtn.disabled = !this.currentImageData || this.isProcessing;
        }

        if (simulateBtn) {
            simulateBtn.disabled = this.robotCommands.length === 0;
        }

        if (this.robotVisualizer) {
            this.robotVisualizer.updateControls();
        }
    }

    updateCharacterCount() {
        const taskInput = document.getElementById('taskInput');
        const charCount = document.getElementById('charCount');

        if (taskInput && charCount) {
            const count = taskInput.value.length;
            charCount.textContent = count;

            if (count > 450) {
                charCount.style.color = 'var(--danger-color)';
            } else if (count > 400) {
                charCount.style.color = 'var(--warning-color)';
            } else {
                charCount.style.color = 'var(--text-muted)';
            }
        }
    }

    resetApplication() {
        this.clearImagePreview();

        const taskInput = document.getElementById('taskInput');
        if (taskInput) {
            taskInput.value = '';
            this.updateCharacterCount();
        }

        this.stopSimulation();
        this.clearResults();
        this.updateControls();

        this.showNotification('info', 'Application Reset', 'Ready for new task.');
    }

    // Utility methods
    handleResize() {
        if (this.robotVisualizer) {
            this.robotVisualizer.handleResize();
        }
    }

    handleKeyboardShortcuts(event) {
        if (event.ctrlKey && event.key === 'Enter') {
            event.preventDefault();
            this.processRequest();
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            if (this.robotVisualizer && this.robotVisualizer.getState().isAnimating) {
                this.stopSimulation();
            }
        }

        if (event.code === 'Space' && event.target.tagName !== 'TEXTAREA') {
            event.preventDefault();
            if (this.robotVisualizer) {
                const state = this.robotVisualizer.getState();
                if (state.isAnimating) {
                    this.togglePause();
                }
            }
        }
    }

    showLoading(message = 'Loading...') {
        const overlay = document.getElementById('loadingOverlay');
        const loadingText = document.getElementById('loadingText');

        if (loadingText) {
            loadingText.textContent = message;
        }

        if (overlay) {
            overlay.style.display = 'flex';
        }
    }

    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }

    showNotification(type, title, message) {
        this.notificationManager.show(type, title, message);
    }

    cleanup() {
        if (this.robotVisualizer) {
            this.robotVisualizer.destroy();
        }
        this.notificationManager.destroy();
        if (window.apiClient) {
            apiClient.destroy();
        }
    }
}

/**
 * Notification Manager
 * Handles toast notifications
 */
class NotificationManager {
    constructor() {
        this.container = document.getElementById('notificationContainer');
        this.notifications = [];
        this.maxNotifications = 5;
        this.defaultDuration = 5000;
    }

    show(type, title, message, duration = this.defaultDuration) {
        const notification = this.createNotification(type, title, message, duration);
        this.addNotification(notification);

        if (duration > 0) {
            setTimeout(() => {
                this.removeNotification(notification.id);
            }, duration);
        }

        return notification.id;
    }

    createNotification(type, title, message, duration) {
        const id = 'notification-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);

        const notification = {
            id,
            type,
            title,
            message,
            duration,
            element: this.createNotificationElement(id, type, title, message)
        };

        return notification;
    }

    createNotificationElement(id, type, title, message) {
        const element = document.createElement('div');
        element.className = `notification ${type}`;
        element.setAttribute('data-id', id);

        const iconMap = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };

        element.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${iconMap[type] || 'ℹ️'}</span>
                <div class="notification-text">
                    <div class="notification-title">${title}</div>
                    <div class="notification-message">${message}</div>
                </div>
                <button class="notification-close" onclick="app.notificationManager.removeNotification('${id}')">&times;</button>
            </div>
        `;

        return element;
    }

    addNotification(notification) {
        while (this.notifications.length >= this.maxNotifications) {
            const oldest = this.notifications.shift();
            this.removeNotificationElement(oldest.element);
        }

        this.notifications.push(notification);
        if (this.container) {
            this.container.appendChild(notification.element);
        }

        requestAnimationFrame(() => {
            notification.element.classList.add('show');
        });
    }

    removeNotification(id) {
        const index = this.notifications.findIndex(n => n.id === id);
        if (index === -1) return;

        const notification = this.notifications[index];
        this.notifications.splice(index, 1);
        this.removeNotificationElement(notification.element);
    }

    removeNotificationElement(element) {
        if (!element || !element.parentNode) return;

        element.style.animation = 'slideOut 0.3s ease-in forwards';
        setTimeout(() => {
            if (element.parentNode) {
                element.parentNode.removeChild(element);
            }
        }, 300);
    }

    clear() {
        this.notifications.forEach(notification => {
            this.removeNotificationElement(notification.element);
        });
        this.notifications = [];
    }

    destroy() {
        this.clear();
    }
}

// Initialize application when DOM is loaded
let app;

document.addEventListener('DOMContentLoaded', () => {
    app = new MultimodalRoboticsApp();
    window.app = app;
    console.log('🚀 Multimodal Robotics App initialized');
});

window.addEventListener('beforeunload', () => {
    if (app) {
        app.cleanup();
    }
});