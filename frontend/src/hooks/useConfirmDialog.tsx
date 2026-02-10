import React, { useState, useCallback } from 'react';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogActions from '@mui/material/DialogActions';
import Button from '@mui/material/Button';

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  severity?: 'error' | 'warning';
}

interface InternalState extends ConfirmOptions {
  resolve: (value: boolean) => void;
}

export function useConfirmDialog() {
  const [state, setState] = useState<InternalState | null>(null);

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({ ...options, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state?.resolve(true);
    setState(null);
  }, [state]);

  const handleCancel = useCallback(() => {
    state?.resolve(false);
    setState(null);
  }, [state]);

  const dialog = (
    <Dialog open={!!state} onClose={handleCancel} maxWidth="xs" fullWidth>
      {state && (
        <>
          <DialogTitle>{state.title}</DialogTitle>
          <DialogContent>
            <DialogContentText>{state.message}</DialogContentText>
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCancel} color="inherit">
              {state.cancelLabel || '取消'}
            </Button>
            <Button
              onClick={handleConfirm}
              color={state.severity === 'error' ? 'error' : 'primary'}
              variant="contained"
            >
              {state.confirmLabel || '确定'}
            </Button>
          </DialogActions>
        </>
      )}
    </Dialog>
  );

  return { confirm, ConfirmDialog: dialog };
}
