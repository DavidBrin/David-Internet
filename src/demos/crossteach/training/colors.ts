/** Shared palette for the training panel's canvases. U-Net = teal family, ViT = amber family. */
export const COLORS = {
  unetLight: "#5eead4", // supervised U-Net (dashed)
  unetDark: "#0f766e", // cross-teaching U-Net (solid)
  vitLight: "#fcd34d", // supervised ViT (dashed)
  vitDark: "#b45309", // cross-teaching ViT (solid)
  ensemble: "#1e293b", // cross-teaching ensemble (solid, dark slate)
  grid: "#e2e8f0",
  axisText: "#64748b",
  band: "rgba(20,184,166,0.12)",
  bandLine: "#14b8a6",
};
