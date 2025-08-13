import io
import logging
from typing import Tuple, Optional
from PIL import Image, ImageEnhance, ImageOps # type: ignore
import numpy as np # type: ignore

logger = logging.getLogger(__name__)

class ImageProcessor:
    """Utility class for image processing operations"""
    
    def __init__(self):
        self.max_size = (1024, 1024)  # Max dimensions for processing
        self.quality = 85  # JPEG quality for compression
    
    def process_image(self, image: Image.Image) -> Image.Image:
        """
        Process uploaded image for AI analysis
        
        Args:
            image: PIL Image object
            
        Returns:
            Processed PIL Image object
        """
        try:
            logger.info(f"Processing image: {image.size}, mode: {image.mode}")
            
            # Convert to RGB if necessary
            if image.mode in ('RGBA', 'LA', 'P'):
                image = image.convert('RGB')
                logger.info("Converted image to RGB mode")
            
            # Resize if too large
            if image.size[0] > self.max_size[0] or image.size[1] > self.max_size[1]:
                image.thumbnail(self.max_size, Image.Resampling.LANCZOS)
                logger.info(f"Resized image to: {image.size}")
            
            # Auto-orient based on EXIF data
            image = ImageOps.exif_transpose(image)
            
            # Enhance image quality for better AI analysis
            image = self._enhance_image(image)
            
            logger.info("Image processing completed successfully")
            return image
            
        except Exception as e:
            logger.error(f"Image processing failed: {str(e)}")
            raise ValueError(f"Failed to process image: {str(e)}")
    
    def _enhance_image(self, image: Image.Image) -> Image.Image:
        """
        Apply image enhancements to improve AI analysis
        
        Args:
            image: PIL Image object
            
        Returns:
            Enhanced PIL Image object
        """
        try:
            # Adjust contrast slightly
            contrast_enhancer = ImageEnhance.Contrast(image)
            image = contrast_enhancer.enhance(1.1)
            
            # Adjust sharpness slightly
            sharpness_enhancer = ImageEnhance.Sharpness(image)
            image = sharpness_enhancer.enhance(1.1)
            
            # Adjust color saturation slightly
            color_enhancer = ImageEnhance.Color(image)
            image = color_enhancer.enhance(1.05)
            
            return image
            
        except Exception as e:
            logger.warning(f"Image enhancement failed, returning original: {str(e)}")
            return image
    
    def validate_image(self, image: Image.Image) -> bool:
        """
        Validate image for robotics analysis
        
        Args:
            image: PIL Image object
            
        Returns:
            True if image is suitable for analysis
        """
        try:
            # Check minimum size
            min_size = (100, 100)
            if image.size[0] < min_size[0] or image.size[1] < min_size[1]:
                logger.warning(f"Image too small: {image.size}")
                return False
            
            # Check maximum size
            max_size = (4096, 4096)
            if image.size[0] > max_size[0] or image.size[1] > max_size[1]:
                logger.warning(f"Image too large: {image.size}")
                return False
            
            # Check if image has reasonable aspect ratio
            aspect_ratio = image.size[0] / image.size[1]
            if aspect_ratio > 10 or aspect_ratio < 0.1:
                logger.warning(f"Extreme aspect ratio: {aspect_ratio}")
                return False
            
            # Check if image appears to be corrupted
            try:
                image.verify()
                # Reopen after verify (verify closes the image)
                image = image.copy()
            except Exception:
                logger.warning("Image verification failed")
                return False
            
            return True
            
        except Exception as e:
            logger.error(f"Image validation failed: {str(e)}")
            return False
    
    def extract_workspace_info(self, image: Image.Image) -> dict:
        """
        Extract basic workspace information from image
        
        Args:
            image: PIL Image object
            
        Returns:
            Dictionary with workspace information
        """
        try:
            # Convert to numpy array for analysis
            img_array = np.array(image)
            
            # Basic color analysis
            mean_color = np.mean(img_array, axis=(0, 1))
            
            # Brightness analysis
            gray = np.dot(img_array[...,:3], [0.2989, 0.5870, 0.1140])
            brightness = np.mean(gray)
            
            # Contrast analysis
            contrast = np.std(gray)
            
            # Edge detection for object count estimation
            edges = self._simple_edge_detection(gray)
            edge_density = np.sum(edges > 0) / edges.size
            
            workspace_info = {
                'image_size': image.size,
                'mean_color_rgb': mean_color.tolist() if hasattr(mean_color, 'tolist') else [128, 128, 128],
                'brightness': float(brightness),
                'contrast': float(contrast),
                'edge_density': float(edge_density),
                'estimated_object_count': self._estimate_object_count(edge_density),
                'lighting_quality': self._assess_lighting_quality(brightness, contrast)
            }
            
            logger.info(f"Extracted workspace info: {workspace_info}")
            return workspace_info
            
        except Exception as e:
            logger.error(f"Workspace analysis failed: {str(e)}")
            return {
                'image_size': image.size,
                'mean_color_rgb': [128, 128, 128],
                'brightness': 128.0,
                'contrast': 50.0,
                'edge_density': 0.1,
                'estimated_object_count': 2,
                'lighting_quality': 'unknown'
            }
    
    def _simple_edge_detection(self, gray_image: np.ndarray) -> np.ndarray:
        """Simple edge detection using gradient"""
        try:
            # Simple Sobel-like edge detection
            dx = np.diff(gray_image, axis=1)
            dy = np.diff(gray_image, axis=0)
            
            # Pad to maintain shape
            dx = np.pad(dx, ((0, 0), (0, 1)), 'constant')
            dy = np.pad(dy, ((0, 1), (0, 0)), 'constant')
            
            edges = np.sqrt(dx**2 + dy**2)
            
            # Threshold
            threshold = np.mean(edges) + 2 * np.std(edges)
            edges = edges > threshold
            
            return edges.astype(float)
            
        except Exception as e:
            logger.warning(f"Edge detection failed: {str(e)}")
            return np.zeros_like(gray_image)
    
    def _estimate_object_count(self, edge_density: float) -> int:
        """Estimate number of objects based on edge density"""
        if edge_density < 0.05:
            return 1
        elif edge_density < 0.1:
            return 2
        elif edge_density < 0.15:
            return 3
        elif edge_density < 0.2:
            return 4
        else:
            return min(int(edge_density * 30), 10)  # Cap at 10 objects
    
    def _assess_lighting_quality(self, brightness: float, contrast: float) -> str:
        """Assess lighting quality for robotics vision"""
        if brightness < 50:
            return 'too_dark'
        elif brightness > 200:
            return 'too_bright'
        elif contrast < 20:
            return 'low_contrast'
        elif contrast > 80:
            return 'high_contrast'
        else:
            return 'good'
    
    def resize_for_display(self, image: Image.Image, max_size: Tuple[int, int] = (400, 300)) -> Image.Image:
        """
        Resize image for display purposes
        
        Args:
            image: PIL Image object
            max_size: Maximum size tuple (width, height)
            
        Returns:
            Resized PIL Image object
        """
        try:
            # Calculate size maintaining aspect ratio
            image_copy = image.copy()
            image_copy.thumbnail(max_size, Image.Resampling.LANCZOS)
            return image_copy
            
        except Exception as e:
            logger.error(f"Display resize failed: {str(e)}")
            return image
    
    def compress_for_api(self, image: Image.Image, max_file_size_kb: int = 512) -> bytes:
        """
        Compress image for API transmission
        
        Args:
            image: PIL Image object
            max_file_size_kb: Maximum file size in KB
            
        Returns:
            Compressed image as bytes
        """
        try:
            quality = 95
            
            while quality > 10:
                buffer = io.BytesIO()
                image.save(buffer, format='JPEG', quality=quality, optimize=True)
                
                size_kb = len(buffer.getvalue()) / 1024
                
                if size_kb <= max_file_size_kb:
                    logger.info(f"Compressed image to {size_kb:.1f}KB at quality {quality}")
                    return buffer.getvalue()
                
                quality -= 10
            
            # If still too large, resize image
            smaller_image = image.copy()
            smaller_image.thumbnail((800, 600), Image.Resampling.LANCZOS)
            
            buffer = io.BytesIO()
            smaller_image.save(buffer, format='JPEG', quality=70, optimize=True)
            
            size_kb = len(buffer.getvalue()) / 1024
            logger.info(f"Resized and compressed image to {size_kb:.1f}KB")
            
            return buffer.getvalue()
            
        except Exception as e:
            logger.error(f"Image compression failed: {str(e)}")
            # Return original as fallback
            buffer = io.BytesIO()
            image.save(buffer, format='JPEG', quality=85)
            return buffer.getvalue()
    
    def detect_workspace_boundaries(self, image: Image.Image) -> Optional[dict]:
        """
        Detect workspace boundaries in the image
        
        Args:
            image: PIL Image object
            
        Returns:
            Dictionary with boundary information or None if detection fails
        """
        try:
            img_array = np.array(image)
            gray = np.dot(img_array[...,:3], [0.2989, 0.5870, 0.1140])
            
            # Find edges
            edges = self._simple_edge_detection(gray)
            
            # Find potential workspace boundaries
            height, width = edges.shape
            
            # Look for horizontal and vertical lines that might indicate workspace edges
            horizontal_lines = np.sum(edges, axis=1)
            vertical_lines = np.sum(edges, axis=0)
            
            # Find peaks that might indicate boundaries
            h_threshold = np.mean(horizontal_lines) + np.std(horizontal_lines)
            v_threshold = np.mean(vertical_lines) + np.std(vertical_lines)
            
            top_boundary = 0
            bottom_boundary = height - 1
            left_boundary = 0
            right_boundary = width - 1
            
            # Find top boundary
            for i in range(height // 4):
                if horizontal_lines[i] > h_threshold:
                    top_boundary = i
                    break
            
            # Find bottom boundary
            for i in range(height - 1, 3 * height // 4, -1):
                if horizontal_lines[i] > h_threshold:
                    bottom_boundary = i
                    break
            
            # Find left boundary
            for i in range(width // 4):
                if vertical_lines[i] > v_threshold:
                    left_boundary = i
                    break
            
            # Find right boundary
            for i in range(width - 1, 3 * width // 4, -1):
                if vertical_lines[i] > v_threshold:
                    right_boundary = i
                    break
            
            boundaries = {
                'top': top_boundary,
                'bottom': bottom_boundary,
                'left': left_boundary,
                'right': right_boundary,
                'width': right_boundary - left_boundary,
                'height': bottom_boundary - top_boundary,
                'confidence': 0.7  # Simple confidence score
            }
            
            logger.info(f"Detected workspace boundaries: {boundaries}")
            return boundaries
            
        except Exception as e:
            logger.error(f"Workspace boundary detection failed: {str(e)}")
            return None