import React from "react";
import Button from "@mui/material/Button";
import Dialog from "@mui/material/Dialog";
import DialogActions from "@mui/material/DialogActions";
import DialogContent from "@mui/material/DialogContent";
import DialogTitle from "@mui/material/DialogTitle";
import Typography from "@mui/material/Typography";

type GmailBindDialogProps = {
  open: boolean;
  binding: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

export function GmailBindDialog({ open, binding, onClose, onConfirm }: GmailBindDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>绑定 Gmail（推荐）</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary">
          当前账号尚未授权 Gmail 读取权限。绑定后可自动同步邮件并集中展示在 MercuryDesk。
        </Typography>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} color="inherit">
          稍后再说
        </Button>
        <Button onClick={onConfirm} variant="contained" disabled={binding}>
          {binding ? "授权中…" : "同意并绑定 Gmail"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

