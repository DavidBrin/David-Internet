import matplotlib.pyplot as plt
import matplotlib
import numpy as np
from matplotlib.patches import Patch
matplotlib.use('Agg')  # Use non-interactive backend for server environments


def generate_temp_plot(thermal_data):
    """
    Generate a heatmap visualization of the 8x8 thermal camera data.
    
    Args:
        thermal_data (dict): JSON data from ESP32 with structure:
            {
                "pixels": [float, ...],  # 64 temperature values (8x8 grid)
                "timestamp": str         # Time of reading
            }
    
    Returns:
        matplotlib.figure.Figure: Figure object containing the heatmap
    """
    # Extract pixel data
    pixels = thermal_data.get("pixels", [])
    timestamp = thermal_data.get("timestamp", "Unknown")
    
    if not pixels or len(pixels) != 64:
        # Create empty plot with error message
        fig, ax = plt.subplots(figsize=(8, 8))
        ax.text(0.5, 0.5, f'Invalid thermal data\nExpected 64 pixels, got {len(pixels)}', 
                ha='center', va='center', fontsize=16, color='red')
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)
        ax.axis('off')
        return fig
    
    # Reshape 1D array to 8x8 grid and rotate 90° clockwise
    # to match physical sensor orientation
    raw_data = np.array(pixels).reshape(8, 8)
    thermal_data_grid = np.rot90(raw_data, k=-1)  # 90° clockwise
    
    # Calculate temperature statistics
    min_temp = thermal_data_grid.min()
    max_temp = thermal_data_grid.max()
    avg_temp = thermal_data_grid.mean()
    
    # Auto-adjust color scale with padding
    vmin = min_temp - 2
    vmax = max_temp + 2
    
    # Create the figure
    fig, ax = plt.subplots(figsize=(10, 8))
    
    # Create heatmap with inferno colormap
    im = ax.imshow(thermal_data_grid, cmap='inferno', vmin=vmin, vmax=vmax, interpolation='nearest')
    
    # Add colorbar
    cbar = plt.colorbar(im, ax=ax, label='Temperature (C)')
    
    # Set title with comprehensive info
    ax.set_title(
        f'AMG8833 Thermal Camera | Time: {timestamp} | '
        f'Max: {max_temp:.1f}C | Min: {min_temp:.1f}C | Avg: {avg_temp:.1f}C',
        fontsize=12, pad=15
    )
    
    # Remove ticks for cleaner look
    ax.set_xticks([])
    ax.set_yticks([])
    
    plt.tight_layout()
    
    return fig
