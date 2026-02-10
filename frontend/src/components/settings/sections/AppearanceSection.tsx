import React from "react";
import Box from "@mui/material/Box";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Switch from "@mui/material/Switch";
import Typography from "@mui/material/Typography";

type AppearanceSectionProps = {
  mode: "light" | "dark";
  onToggleMode: () => void;
};

export function AppearanceSection({ mode, onToggleMode }: AppearanceSectionProps) {
  return (
    <Grid size={{ xs: 12 }}>
      <Paper sx={{ p: 3, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <Box>
          <Typography variant="h6">外观</Typography>
          <Typography variant="body2" color="textSecondary">
            浅色：暖白页纸 + 墨色边框；深色：纯黑底 + 灰白线条
          </Typography>
        </Box>
        <Box display="flex" alignItems="center" gap={1}>
          <Typography variant="body2" color={mode === "light" ? "primary" : "textSecondary"}>
            浅色
          </Typography>
          <Switch checked={mode === "dark"} onChange={onToggleMode} />
          <Typography variant="body2" color={mode === "dark" ? "primary" : "textSecondary"}>
            深色
          </Typography>
        </Box>
      </Paper>
    </Grid>
  );
}

