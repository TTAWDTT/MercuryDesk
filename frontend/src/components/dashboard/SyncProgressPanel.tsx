import React from "react";
import Box from "@mui/material/Box";
import LinearProgress from "@mui/material/LinearProgress";
import Typography from "@mui/material/Typography";

export type DashboardSyncProgress = {
  current: number;
  total: number;
  currentAccount: string;
  failedAccounts: string[];
};

type SyncProgressPanelProps = {
  progress: DashboardSyncProgress;
};

export function SyncProgressPanel({ progress }: SyncProgressPanelProps) {
  return (
    <Box sx={{ mt: 2, p: 2, bgcolor: "action.hover", borderRadius: 0 }}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
        <Typography variant="body2" fontWeight="bold">
          正在同步: {progress.currentAccount || "完成中..."}
        </Typography>
        <Typography variant="body2" color="text.secondary">
          {progress.current}/{progress.total}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={(progress.current / Math.max(progress.total, 1)) * 100}
        sx={{ height: 8, borderRadius: 0 }}
      />
      {progress.failedAccounts.length > 0 && (
        <Typography variant="caption" color="error" sx={{ mt: 1, display: "block" }}>
          同步失败: {progress.failedAccounts.join(", ")}
        </Typography>
      )}
    </Box>
  );
}

