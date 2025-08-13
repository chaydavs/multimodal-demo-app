from enum import Enum
from typing import Dict, Any, Optional
from dataclasses import dataclass
from datetime import datetime

class CommandType(Enum):
    """Enumeration of robot command types"""
    MOVE_TO = "move_to"
    CLOSE_GRIPPER = "close_gripper"
    OPEN_GRIPPER = "open_gripper"
    SET_SPEED = "set_speed"
    WAIT = "wait"
    HOME = "home"

@dataclass
class Position:
    """3D position representation"""
    x: float
    y: float
    z: float
    
    def distance_to(self, other: 'Position') -> float:
        """Calculate Euclidean distance to another position"""
        return ((self.x - other.x)**2 + (self.y - other.y)**2 + (self.z - other.z)**2)**0.5
    
    def to_dict(self) -> Dict[str, float]:
        """Convert to dictionary"""
        return {'x': self.x, 'y': self.y, 'z': self.z}

@dataclass
class RobotCommand:
    """Robot command data structure"""
    action: CommandType
    position: Optional[Position] = None
    speed: Optional[float] = None
    force: Optional[float] = None
    duration: Optional[float] = None
    description: str = ""
    timestamp: Optional[datetime] = None
    
    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.utcnow()
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert command to dictionary for JSON serialization"""
        result = {
            'action': self.action.value,
            'description': self.description,
            'timestamp': self.timestamp.isoformat() if self.timestamp else None
        }
        
        if self.position:
            result.update({
                'x': self.position.x,
                'y': self.position.y,
                'z': self.position.z
            })
        
        if self.speed is not None:
            result['speed'] = self.speed
        
        if self.force is not None:
            result['force'] = self.force
        
        if self.duration is not None:
            result['duration'] = self.duration
        
        return result
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'RobotCommand':
        """Create RobotCommand from dictionary"""
        action = CommandType(data['action'])
        
        position = None
        if 'x' in data and 'y' in data and 'z' in data:
            position = Position(data['x'], data['y'], data['z'])
        
        return cls(
            action=action,
            position=position,
            speed=data.get('speed'),
            force=data.get('force'),
            duration=data.get('duration'),
            description=data.get('description', ''),
            timestamp=datetime.fromisoformat(data['timestamp']) if data.get('timestamp') else None
        )
    
    def validate(self, workspace_limits: Dict[str, float]) -> bool:
        """Validate command against workspace limits and safety constraints"""
        
        # Validate position limits
        if self.position:
            if not (workspace_limits['x_min'] <= self.position.x <= workspace_limits['x_max']):
                return False
            if not (workspace_limits['y_min'] <= self.position.y <= workspace_limits['y_max']):
                return False
            if not (workspace_limits['z_min'] <= self.position.z <= workspace_limits['z_max']):
                return False
        
        # Validate speed limits (0-100 mm/s typically)
        if self.speed is not None:
            if not (0 <= self.speed <= 100):
                return False
        
        # Validate force limits (0-10 N typically)
        if self.force is not None:
            if not (0 <= self.force <= 10):
                return False
        
        # Validate duration (0-30 seconds max for single command)
        if self.duration is not None:
            if not (0 <= self.duration <= 30):
                return False
        
        return True

class CommandSequence:
    """Manages a sequence of robot commands"""
    
    def __init__(self, commands: list = None):
        self.commands = commands or []
        self.created_at = datetime.utcnow()
        self.execution_id = None
        self.status = "pending"  # pending, executing, completed, failed
    
    def add_command(self, command: RobotCommand):
        """Add a command to the sequence"""
        self.commands.append(command)
    
    def validate_sequence(self, workspace_limits: Dict[str, float]) -> tuple[bool, list]:
        """Validate entire command sequence"""
        errors = []
        
        for i, cmd in enumerate(self.commands):
            if not cmd.validate(workspace_limits):
                errors.append(f"Command {i+1} validation failed: {cmd.description}")
        
        # Check for logical sequence issues
        if len(self.commands) > 100:
            errors.append("Command sequence too long (max 100 commands)")
        
        # Check for gripper state consistency
        gripper_state = "unknown"
        for i, cmd in enumerate(self.commands):
            if cmd.action == CommandType.CLOSE_GRIPPER:
                if gripper_state == "closed":
                    errors.append(f"Command {i+1}: Attempting to close already closed gripper")
                gripper_state = "closed"
            elif cmd.action == CommandType.OPEN_GRIPPER:
                if gripper_state == "open":
                    errors.append(f"Command {i+1}: Attempting to open already open gripper")
                gripper_state = "open"
        
        return len(errors) == 0, errors
    
    def estimate_total_time(self) -> float:
        """Estimate total execution time for the sequence"""
        total_time = 0.0
        current_pos = Position(0, 0, 0)  # Start from home
        
        for cmd in self.commands:
            if cmd.action == CommandType.MOVE_TO and cmd.position:
                # Calculate movement time
                distance = current_pos.distance_to(cmd.position)
                speed = cmd.speed or 50  # Default speed
                move_time = distance / speed
                
                # Add acceleration/deceleration time (simplified)
                accel_time = speed / 50  # Assume 50 mm/s² acceleration
                total_time += move_time + accel_time
                
                current_pos = cmd.position
            
            elif cmd.action in [CommandType.CLOSE_GRIPPER, CommandType.OPEN_GRIPPER]:
                total_time += 1.0  # 1 second for gripper operations
            
            elif cmd.action == CommandType.WAIT and cmd.duration:
                total_time += cmd.duration
            
            # Add safety delay between commands
            total_time += 0.2
        
        return total_time
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert sequence to dictionary"""
        return {
            'commands': [cmd.to_dict() for cmd in self.commands],
            'created_at': self.created_at.isoformat(),
            'execution_id': self.execution_id,
            'status': self.status,
            'command_count': len(self.commands),
            'estimated_duration': self.estimate_total_time()
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'CommandSequence':
        """Create CommandSequence from dictionary"""
        commands = [RobotCommand.from_dict(cmd_data) for cmd_data in data.get('commands', [])]
        sequence = cls(commands)
        sequence.execution_id = data.get('execution_id')
        sequence.status = data.get('status', 'pending')
        
        if 'created_at' in data:
            sequence.created_at = datetime.fromisoformat(data['created_at'])
        
        return sequence

# Utility functions for command generation
def create_move_command(x: float, y: float, z: float, speed: float = 50, description: str = "") -> RobotCommand:
    """Create a move command"""
    return RobotCommand(
        action=CommandType.MOVE_TO,
        position=Position(x, y, z),
        speed=speed,
        description=description
    )

def create_gripper_command(close: bool, force: float = 5.0, description: str = "") -> RobotCommand:
    """Create a gripper command"""
    action = CommandType.CLOSE_GRIPPER if close else CommandType.OPEN_GRIPPER
    return RobotCommand(
        action=action,
        force=force,
        description=description
    )

def create_wait_command(duration: float, description: str = "") -> RobotCommand:
    """Create a wait command"""
    return RobotCommand(
        action=CommandType.WAIT,
        duration=duration,
        description=description
    )

def create_home_command(speed: float = 50) -> RobotCommand:
    """Create a home position command"""
    return RobotCommand(
        action=CommandType.HOME,
        speed=speed,
        description="Move to home position"
    )