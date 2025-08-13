const API_BASE_URL = window.location.origin;
/**
 * API Client for Multimodal Robotics Backend
 * Handles all communication with the Flask backend
 */

class APIClient {
    constructor(baseURL = '') {
        this.baseURL = baseURL;
        this.timeout = 30000; // 30 seconds
        this.retryAttempts = 3;
        this.retryDelay = 1000; // 1 second

        // Connection status
        this.isConnected = false;
        this.connectionCheckInterval = null;

        this.init();
    }

    async init() {
        await this.checkConnection();
        this.startConnectionMonitoring();
    }

    /**
     * Generic HTTP request method with error handling and retries
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}/api${endpoint}`;
        const defaultOptions = {
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: this.timeout,
        };

        const finalOptions = { ...defaultOptions, ...options };

        let lastError;

        for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
            try {
                console.log(`API Request (attempt ${attempt}): ${finalOptions.method || 'GET'} ${url}`);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), this.timeout);

                const response = await fetch(url, {
                    ...finalOptions,
                    signal: controller.signal
                });

                clearTimeout(timeoutId);

                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
                }

                const data = await response.json();
                console.log(`API Response: ${JSON.stringify(data).substring(0, 200)}...`);

                return data;

            } catch (error) {
                lastError = error;
                console.error(`API request failed (attempt ${attempt}):`, error.message);

                // Don't retry on certain errors
                if (error.name === 'AbortError') {
                    throw new Error('Request timeout');
                }

                if (attempt < this.retryAttempts && this.shouldRetry(error)) {
                    await this.delay(this.retryDelay * attempt);
                    continue;
                }

                break;
            }
        }

        throw lastError;
    }

    shouldRetry(error) {
        // Retry on network errors, timeouts, and 5xx server errors
        return error.message.includes('fetch') ||
            error.message.includes('timeout') ||
            error.message.includes('500') ||
            error.message.includes('502') ||
            error.message.includes('503') ||
            error.message.includes('504');
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Check backend connection and health
     */
    async checkConnection() {
        try {
            const response = await this.request('/health');
            this.isConnected = true;
            this.updateConnectionStatus('connected');
            return response;
        } catch (error) {
            this.isConnected = false;
            this.updateConnectionStatus('error');
            throw error;
        }
    }

    /**
     * Start monitoring connection status
     */
    startConnectionMonitoring() {
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
        }

        this.connectionCheckInterval = setInterval(async () => {
            try {
                await this.checkConnection();
            } catch (error) {
                console.warn('Connection check failed:', error.message);
            }
        }, 30000); // Check every 30 seconds
    }

    /**
     * Stop monitoring connection status
     */
    stopConnectionMonitoring() {
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
            this.connectionCheckInterval = null;
        }
    }

    /**
     * Update UI connection status indicator
     */
    updateConnectionStatus(status) {
        const indicator = document.getElementById('connectionStatus');
        if (!indicator) return;

        const statusIndicator = indicator.querySelector('.status-indicator');
        const statusText = indicator.querySelector('.status-text');

        // Remove existing status classes
        statusIndicator.classList.remove('connected', 'error');

        switch (status) {
            case 'connected':
                statusIndicator.classList.add('connected');
                statusText.textContent = 'Connected';
                break;
            case 'error':
                statusIndicator.classList.add('error');
                statusText.textContent = 'Connection Error';
                break;
            default:
                statusText.textContent = 'Connecting...';
        }
    }

    /**
     * Analyze image and task description
     */
    async analyzeImage(imageData, taskDescription) {
        const payload = {
            image: imageData,
            description: taskDescription
        };

        try {
            return await this.request('/analyze', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        } catch (error) {
            console.error('Image analysis failed:', error);
            throw new Error(`Analysis failed: ${error.message}`);
        }
    }

    /**
     * Get current robot status
     */
    async getRobotStatus() {
        try {
            return await this.request('/robot/status');
        } catch (error) {
            console.error('Failed to get robot status:', error);
            throw new Error(`Status check failed: ${error.message}`);
        }
    }

    /**
     * Execute robot command sequence
     */
    async executeCommands(commands) {
        const payload = { commands };

        try {
            return await this.request('/robot/execute', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        } catch (error) {
            console.error('Command execution failed:', error);
            throw new Error(`Execution failed: ${error.message}`);
        }
    }

    /**
     * Emergency stop robot
     */
    async emergencyStop() {
        try {
            return await this.request('/robot/stop', {
                method: 'POST'
            });
        } catch (error) {
            console.error('Emergency stop failed:', error);
            throw new Error(`Emergency stop failed: ${error.message}`);
        }
    }

    /**
     * Get available AI models
     */
    async getAvailableModels() {
        try {
            return await this.request('/models/available');
        } catch (error) {
            console.error('Failed to get available models:', error);
            throw new Error(`Model query failed: ${error.message}`);
        }
    }

    /**
     * Switch AI model
     */
    async switchModel(modelName) {
        const payload = { model: modelName };

        try {
            return await this.request('/models/switch', {
                method: 'POST',
                body: JSON.stringify(payload)
            });
        } catch (error) {
            console.error('Model switch failed:', error);
            throw new Error(`Model switch failed: ${error.message}`);
        }
    }

    /**
     * Upload and validate image file
     */
    async validateImage(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('No file provided'));
                return;
            }

            // Check file type
            if (!file.type.startsWith('image/')) {
                reject(new Error('File must be an image'));
                return;
            }

            // Check file size (10MB limit)
            const maxSize = 10 * 1024 * 1024; // 10MB
            if (file.size > maxSize) {
                reject(new Error('Image file too large (max 10MB)'));
                return;
            }

            const reader = new FileReader();

            reader.onload = (e) => {
                const img = new Image();

                img.onload = () => {
                    // Validate image dimensions
                    if (img.width < 100 || img.height < 100) {
                        reject(new Error('Image too small (minimum 100x100 pixels)'));
                        return;
                    }

                    if (img.width > 4096 || img.height > 4096) {
                        reject(new Error('Image too large (maximum 4096x4096 pixels)'));
                        return;
                    }

                    resolve({
                        dataUrl: e.target.result,
                        width: img.width,
                        height: img.height,
                        size: file.size,
                        type: file.type,
                        name: file.name
                    });
                };

                img.onerror = () => {
                    reject(new Error('Invalid or corrupted image file'));
                };

                img.src = e.target.result;
            };

            reader.onerror = () => {
                reject(new Error('Failed to read image file'));
            };

            reader.readAsDataURL(file);
        });
    }

    /**
     * Format file size for display
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));

        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Get error message from response
     */
    getErrorMessage(error) {
        if (typeof error === 'string') {
            return error;
        }

        if (error.message) {
            return error.message;
        }

        if (error.error) {
            return error.error;
        }

        return 'An unknown error occurred';
    }

    /**
     * Clean up resources
     */
    destroy() {
        this.stopConnectionMonitoring();
    }
}

// Create global API client instance
const apiClient = new APIClient();

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = APIClient;
}
// If using ES6 modules
else if (typeof define === 'function' && define.amd) {
    define(() => APIClient);
}   