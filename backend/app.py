from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import os
import logging
import random
import re
from datetime import datetime

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class IntelligentMockAI:
    """Intelligent mock AI that provides realistic responses based on task description"""
    
    def __init__(self):
        # Object detection vocabulary
        self.common_objects = {
            'shapes': ['cube', 'sphere', 'cylinder', 'block', 'box'],
            'colors': ['red', 'blue', 'green', 'yellow', 'orange', 'purple', 'black', 'white'],
            'containers': ['container', 'box', 'tray', 'basket', 'bin'],
            'tools': ['screwdriver', 'wrench', 'hammer', 'pliers', 'tool'],
            'items': ['ball', 'component', 'part', 'piece', 'object']
        }
        
        # Task type patterns
        self.task_patterns = {
            'pick_and_place': ['pick', 'place', 'move', 'transfer', 'relocate'],
            'sorting': ['sort', 'organize', 'separate', 'group', 'categorize'],
            'stacking': ['stack', 'pile', 'tower', 'arrange vertically'],
            'assembly': ['assemble', 'connect', 'attach', 'join', 'combine'],
            'cleaning': ['clean', 'clear', 'remove', 'tidy']
        }
    
    def analyze_task_description(self, description):
        """Analyze task description to determine objects and actions"""
        desc_lower = description.lower()
        
        # Detect objects mentioned
        detected_objects = []
        for category, objects in self.common_objects.items():
            for obj in objects:
                if obj in desc_lower:
                    detected_objects.append(obj)
        
        # Detect colors
        detected_colors = []
        for color in self.common_objects['colors']:
            if color in desc_lower:
                detected_colors.append(color)
        
        # Combine colors and objects
        final_objects = []
        if detected_colors and detected_objects:
            for color in detected_colors:
                for obj in detected_objects:
                    if f"{color} {obj}" in desc_lower:
                        final_objects.append(f"{color}_{obj}")
        
        # Add standalone objects
        for obj in detected_objects:
            if obj not in [o.split('_')[-1] for o in final_objects]:
                final_objects.append(obj)
        
        # If no objects detected, create generic ones
        if not final_objects:
            final_objects = ['object_1', 'object_2', 'target_location']
        
        # Determine task type
        task_type = 'pick_and_place'  # default
        for task, keywords in self.task_patterns.items():
            if any(keyword in desc_lower for keyword in keywords):
                task_type = task
                break
        
        return final_objects, task_type
    
    def generate_realistic_analysis(self, description, objects, task_type):
        """Generate intelligent scene analysis"""
        
        analysis_templates = {
            'pick_and_place': [
                f"I can see a workspace with several objects that need to be manipulated. The task involves picking up {objects[0] if objects else 'an object'} and placing it in a new location. I'll plan a safe trajectory that avoids collisions with other objects in the scene.",
                f"The scene shows a typical pick-and-place scenario. I've identified {len(objects)} distinct objects including {', '.join(objects[:3])}. The robot will need to approach each object carefully and execute precise movements.",
                f"This is a classic manipulation task. I can see the target object clearly and have identified an optimal approach angle. The workspace appears uncluttered enough for safe robot operation."
            ],
            'sorting': [
                f"The workspace contains multiple objects that need to be sorted and organized. I've detected {len(objects)} different items including {', '.join(objects[:3])}. I'll group similar objects together based on their characteristics.",
                f"This sorting task requires careful object classification. I can distinguish between different object types and will organize them into designated areas based on their properties.",
                f"The scene shows various objects scattered across the workspace. My analysis indicates these can be efficiently sorted into {min(3, len(objects))} distinct categories."
            ]
        }
        
        # Select appropriate analysis
        templates = analysis_templates.get(task_type, analysis_templates['pick_and_place'])
        analysis = random.choice(templates)
        
        return analysis
    
    def generate_commands(self, objects, task_type, description):
        """Generate realistic robot commands based on task analysis"""
        
        commands = []
        
        # Always start with home position
        commands.append({
            'action': 'move_to',
            'x': 0, 'y': 0, 'z': 50,
            'speed': 60,
            'description': 'Move to home position and initialize'
        })
        
        # Generate pick and place commands
        for i, obj in enumerate(objects[:2]):  # Limit to 2 objects for demo
            pick_x = random.randint(-100, 100)
            pick_y = random.randint(-80, 80)
            place_x = random.randint(80, 150)
            place_y = random.randint(60, 120)
            
            commands.extend([
                {
                    'action': 'move_to',
                    'x': pick_x, 'y': pick_y, 'z': 30,
                    'speed': 50,
                    'description': f'Approach {obj.replace("_", " ")}'
                },
                {
                    'action': 'move_to',
                    'x': pick_x, 'y': pick_y, 'z': 15,
                    'speed': 20,
                    'description': f'Descend to {obj.replace("_", " ")}'
                },
                {
                    'action': 'close_gripper',
                    'description': f'Grasp {obj.replace("_", " ")}'
                },
                {
                    'action': 'move_to',
                    'x': pick_x, 'y': pick_y, 'z': 40,
                    'speed': 30,
                    'description': f'Lift {obj.replace("_", " ")}'
                },
                {
                    'action': 'move_to',
                    'x': place_x, 'y': place_y, 'z': 20,
                    'speed': 45,
                    'description': f'Transport {obj.replace("_", " ")} to destination'
                },
                {
                    'action': 'open_gripper',
                    'description': f'Release {obj.replace("_", " ")}'
                }
            ])
        
        # Return to home
        commands.append({
            'action': 'move_to',
            'x': 0, 'y': 0, 'z': 50,
            'speed': 50,
            'description': 'Return to home position - task complete'
        })
        
        return commands

# Initialize the intelligent mock AI
mock_ai = IntelligentMockAI()

@app.route('/')
def index():
    """Serve the main application page"""
    return send_from_directory('../frontend', 'index.html')

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'timestamp': datetime.utcnow().isoformat(),
        'version': '1.0.0'
    })

@app.route('/api/analyze', methods=['POST'])
def analyze_image():
    """Intelligent mock analyze endpoint"""
    try:
        data = request.json
        image_data = data.get('image')
        description = data.get('description', '')
        
        logger.info(f"Analyzing task: {description[:100]}...")
        
        # Analyze the task description intelligently
        objects, task_type = mock_ai.analyze_task_description(description)
        
        # Generate realistic analysis
        analysis = mock_ai.generate_realistic_analysis(description, objects, task_type)
        
        # Generate appropriate commands
        commands = mock_ai.generate_commands(objects, task_type, description)
        
        # Calculate realistic execution time
        execution_time = len(commands) * 2.5 + random.uniform(3, 8)
        
        # Generate confidence based on task complexity
        complexity_score = len(description.split()) / 20
        confidence = max(0.75, min(0.98, 0.85 + random.uniform(0, 0.1) - complexity_score * 0.05))
        
        response = {
            'analysis': analysis,
            'objects_detected': objects,
            'confidence': round(confidence, 3),
            'task_type': task_type,
            'commands': commands,
            'execution_time_estimate': round(execution_time, 1),
            'timestamp': datetime.utcnow().isoformat()
        }
        
        logger.info(f"Generated {len(commands)} commands for {task_type} task")
        return jsonify(response)
        
    except Exception as e:
        logger.error(f"Analysis error: {str(e)}")
        return jsonify({'error': 'Analysis failed'}), 500

@app.route('/api/robot/status', methods=['GET'])
def get_robot_status():
    """Get robot status"""
    return jsonify({
        'status': 'idle',
        'position': {'x': 0, 'y': 0, 'z': 0},
        'gripper_state': 'open',
        'timestamp': datetime.utcnow().isoformat()
    })

@app.route('/api/models/available', methods=['GET'])
def get_available_models():
    """Get available AI models"""
    return jsonify({
        'models': ['mock', 'openai', 'anthropic', 'google'],
        'current_model': 'mock'
    })

# Serve static files
@app.route('/css/<path:filename>')
def serve_css(filename):
    """Serve CSS files"""
    try:
        return send_from_directory('../frontend/css', filename)
    except FileNotFoundError:
        logger.error(f"CSS file not found: {filename}")
        return f"CSS file not found: {filename}", 404

@app.route('/js/<path:filename>')
def serve_js(filename):
    """Serve JavaScript files"""
    try:
        return send_from_directory('../frontend/js', filename)
    except FileNotFoundError:
        logger.error(f"JS file not found: {filename}")
        return f"JS file not found: {filename}", 404

@app.route('/assets/<path:filename>')
def serve_assets(filename):
    """Serve asset files"""
    try:
        return send_from_directory('../frontend/assets', filename)
    except FileNotFoundError:
        logger.error(f"Asset file not found: {filename}")
        return f"Asset file not found: {filename}", 404

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8000))
    logger.info(f"Starting Enhanced Robotics App on port {port}")
    app.run(host='0.0.0.0', port=port, debug=True)
