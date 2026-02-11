import React from "react";
import Dialog from "@mui/material/Dialog";
import DialogTitle from "@mui/material/DialogTitle";
import DialogContent from "@mui/material/DialogContent";
import DialogActions from "@mui/material/DialogActions";
import Button from "@mui/material/Button";
import Typography from "@mui/material/Typography";
import Box from "@mui/material/Box";
import Chip from "@mui/material/Chip";

type FirstRunGuideDialogProps = {
  open: boolean;
  hasAccounts: boolean;
  syncing: boolean;
  onClose: () => void;
  onOpenSettings: () => void;
  onSync: () => void;
};

export function FirstRunGuideDialog({
  open,
  hasAccounts,
  syncing,
  onClose,
  onOpenSettings,
  onSync,
}: FirstRunGuideDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>欢迎使用 MercuryDesk</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary">
          首次进入建议按下面流程操作，之后你可以直接在画板中拖放卡片、置顶重点联系人、打开会话查看详情。
        </Typography>

        <Box sx={{ mt: 2, display: "grid", gap: 1.2 }}>
          <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
            <Chip size="small" label="1" />
            <Typography variant="body2">进入设置，连接 Gmail/Outlook/IMAP 或社媒账号。</Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
            <Chip size="small" label="2" />
            <Typography variant="body2">回到主页点击顶部“同步”，拉取最新内容。</Typography>
          </Box>
          <Box sx={{ display: "flex", gap: 1, alignItems: "flex-start" }}>
            <Chip size="small" label="3" />
            <Typography variant="body2">点击任一卡片打开边栏详情；置顶卡片会固定在“置顶带”。</Typography>
          </Box>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button color="inherit" onClick={onClose}>
          我知道了
        </Button>
        {!hasAccounts && (
          <Button variant="outlined" onClick={onSync} disabled={syncing}>
            {syncing ? "同步中…" : "先看演示数据"}
          </Button>
        )}
        <Button variant="contained" onClick={onOpenSettings}>
          去设置连接账户
        </Button>
      </DialogActions>
    </Dialog>
  );
}

