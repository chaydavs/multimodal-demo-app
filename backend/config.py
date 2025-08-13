import os
from datetime import timedelta

class Config:
    """Application configuration"""
    
    # Flask settings
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'
    
    # API Keys for external services
    OPENAI_API_KEY = os.environ.get('OPENAI_API_KEY')
    ANTHROPIC_API_KEY = os.environ.get('ANTHROPIC_API_KEY')
    GOOGLE_API_KEY = os.environ.get('GOOGLE_API_KEY')
    
    # AI Service Configuration
    DEFAULT_AI_MODEL = os.environ.get('DEFAULT_AI_MODEL', 'mock')
    AI_TIMEOUT = int(os.environ.get('AI_TIMEOUT', 30))  # seconds
    MAX_IMAGE_SIZE = int(os.environ.get('MAX_IMAGE_SIZE', 10 * 1024 * 1024))  # 10MB
    
    # Robot Configuration
    ROBOT_WORKSPACE_X_MIN = -200
    ROBOT_WORKSPACE_X_MAX = 200
    ROBOT_WORKSPACE_Y_MIN = -200
    ROBOT_WORKSPACE_Y_MAX = 200
    ROBOT_WORKSPACE_Z_MIN = 0
    ROBOT_WORKSPACE_Z_MAX = 150
    
    # Safety limits
    MAX_MOVEMENT_SPEED = 100  # mm/s
    MAX_ACCELERATION = 50     # mm/s²
    GRIPPER_FORCE_LIMIT = 10  # N
    
    # File upload settings
    UPLOAD_FOLDER = 'uploads'
    ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'}
    
    # Rate limiting
    RATE_LIMIT_PER_MINUTE = int(os.environ.get('RATE_LIMIT_PER_MINUTE', 30))
    
    # Logging
    LOG_LEVEL = os.environ.get('LOG_LEVEL', 'INFO')
    
    # CORS settings
    CORS_ORIGINS = os.environ.get('CORS_ORIGINS', '*').split(',')
    
    @staticmethod
    def init_app(app):
        """Initialize configuration for the Flask app"""
        pass

class DevelopmentConfig(Config):
    """Development configuration"""
    DEBUG = True
    TESTING = False

class ProductionConfig(Config):
    """Production configuration"""
    DEBUG = False
    TESTING = False
    
    # Use provided SECRET_KEY or fallback for demo purposes
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'demo-secret-key-change-in-production'

class TestingConfig(Config):
    """Testing configuration"""
    TESTING = True
    DEBUG = True
    
    # Use mock services for testing
    DEFAULT_AI_MODEL = 'mock'

# Configuration dictionary
config = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig
}