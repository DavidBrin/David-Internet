import matplotlib.pyplot as plt
import matplotlib
from matplotlib.patches import Patch
matplotlib.use('Agg')  # Use non-interactive backend for server environments


def generate_netmap_plot(scan_data):
    """
    Generate a bar chart visualization of WiFi network scan data.
    
    Args:
        scan_data (dict): JSON data from ESP32 with structure:
            {
                "device_id": str,
                "timestamp": int,
                "connected_ssid": str,
                "connected_rssi": int,
                "networks": [{"ssid": str, "rssi": int}, ...]
            }
    
    Returns:
        matplotlib.figure.Figure: Figure object containing the plot
    """
    # Extract network data
    networks = scan_data.get("networks", [])
    connected_ssid = scan_data.get("connected_ssid", "Unknown")
    connected_rssi = scan_data.get("connected_rssi", 0)
    device_id = scan_data.get("device_id", "ESP32")
    
    if not networks:
        # Create empty plot with message
        fig, ax = plt.subplots(figsize=(10, 6))
        ax.text(0.5, 0.5, 'No networks detected', 
                ha='center', va='center', fontsize=16)
        ax.set_xlim(0, 1)
        ax.set_ylim(0, 1)
        ax.axis('off')
        return fig
    
    # Sort networks by RSSI (strongest first)
    sorted_networks = sorted(networks, key=lambda x: x['rssi'], reverse=True)
    
    # Extract SSIDs and RSSI values
    ssids = [net['ssid'] for net in sorted_networks]
    rssi_values = [net['rssi'] for net in sorted_networks]
    
    # Create color map (green for strong, yellow for medium, red for weak)
    colors = []
    for rssi in rssi_values:
        if rssi >= -50:
            colors.append('#28a745')  # Green - excellent
        elif rssi >= -60:
            colors.append('#8bc34a')  # Light green - good
        elif rssi >= -70:
            colors.append('#ffc107')  # Yellow - fair
        elif rssi >= -80:
            colors.append('#ff9800')  # Orange - weak
        else:
            colors.append('#f44336')  # Red - very weak
    
    # Highlight connected network
    edge_colors = []
    edge_widths = []
    for ssid in ssids:
        if ssid == connected_ssid:
            edge_colors.append('blue')
            edge_widths.append(3)
        else:
            edge_colors.append('none')
            edge_widths.append(0)
    
    # Create the plot
    fig, ax = plt.subplots(figsize=(12, max(6, len(networks) * 0.4)))
    
    # Create horizontal bar chart
    y_pos = range(len(ssids))
    bars = ax.barh(y_pos, rssi_values, color=colors, 
                   edgecolor=edge_colors, linewidth=edge_widths)
    
    # Customize the plot
    ax.set_yticks(y_pos)
    ax.set_yticklabels(ssids)
    ax.invert_yaxis()  # Strongest signal at top
    ax.set_xlabel('Signal Strength (RSSI dBm)', fontsize=12, fontweight='bold')
    ax.set_ylabel('Network SSID', fontsize=12, fontweight='bold')
    ax.set_title(f'WiFi Network Scan - {device_id}\nConnected to: {connected_ssid} ({connected_rssi} dBm)', 
                 fontsize=14, fontweight='bold', pad=20)
    
    # Add RSSI reference lines
    ax.axvline(-50, color='gray', linestyle='--', alpha=0.3, linewidth=1)
    ax.axvline(-60, color='gray', linestyle='--', alpha=0.3, linewidth=1)
    ax.axvline(-70, color='gray', linestyle='--', alpha=0.3, linewidth=1)
    ax.axvline(-80, color='gray', linestyle='--', alpha=0.3, linewidth=1)
    
    # Add value labels on bars
    for i, (bar, rssi) in enumerate(zip(bars, rssi_values)):
        ax.text(rssi - 2, i, f'{rssi} dBm', 
                va='center', ha='right', fontsize=9, color='white', fontweight='bold')
    
    # Add legend for signal quality
    from matplotlib.patches import Patch
    legend_elements = [
        Patch(facecolor='#28a745', label='Excellent (>= -50 dBm)'),
        Patch(facecolor='#8bc34a', label='Good (-50 to -60 dBm)'),
        Patch(facecolor='#ffc107', label='Fair (-60 to -70 dBm)'),
        Patch(facecolor='#ff9800', label='Weak (-70 to -80 dBm)'),
        Patch(facecolor='#f44336', label='Very Weak (< -80 dBm)'),
        Patch(facecolor='white', edgecolor='blue', linewidth=3, label='Connected Network')
    ]
    ax.legend(handles=legend_elements, loc='lower right', fontsize=9)
    
    # Set x-axis limits
    ax.set_xlim(min(rssi_values) - 10, -20)
    
    # Add grid for better readability
    ax.grid(axis='x', alpha=0.3, linestyle=':', linewidth=0.5)
    ax.set_axisbelow(True)
    
    plt.tight_layout()
    
    return fig
