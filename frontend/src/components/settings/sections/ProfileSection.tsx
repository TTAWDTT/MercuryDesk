import React from "react";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Grid from "@mui/material/Grid";
import Paper from "@mui/material/Paper";
import Typography from "@mui/material/Typography";

import type { User } from "../../../api";

type ProfileSectionProps = {
  user?: User;
  avatarFile: File | null;
  avatarPreview: string | null;
  updatingProfile: boolean;
  onAvatarFileChange: (file: File | null) => void;
  onUploadAvatar: () => void;
};

export function ProfileSection({
  user,
  avatarFile,
  avatarPreview,
  updatingProfile,
  onAvatarFileChange,
  onUploadAvatar,
}: ProfileSectionProps) {
  return (
    <Grid size={{ xs: 12 }}>
      <Paper sx={{ p: 4 }}>
        <Typography variant="h6" gutterBottom>
          个人资料
        </Typography>
        <Box display="flex" alignItems="center" gap={3} mb={3}>
          <Avatar
            src={avatarPreview || user?.avatar_url || undefined}
            sx={{ width: 80, height: 80, bgcolor: "primary.main", fontSize: 32 }}
          >
            {user?.email?.[0]?.toUpperCase()}
          </Avatar>
          <Box flexGrow={1}>
            <Typography variant="subtitle1" fontWeight="bold">
              {user?.email}
            </Typography>
            <Typography variant="body2" color="textSecondary">
              注册于 {user?.created_at ? new Date(user.created_at).getFullYear() : "..."}
            </Typography>
          </Box>
        </Box>
        <Box display="flex" gap={2} alignItems="center" flexWrap="wrap">
          <Button variant="outlined" component="label" disabled={updatingProfile}>
            选择图片
            <input
              hidden
              type="file"
              accept="image/*"
              onChange={(event) => onAvatarFileChange(event.target.files?.[0] ?? null)}
            />
          </Button>
          <Typography variant="body2" color="textSecondary" sx={{ flexGrow: 1, minWidth: 180 }}>
            {avatarFile ? avatarFile.name : "未选择文件"}
          </Typography>
          <Button variant="contained" disabled={!avatarFile || updatingProfile} onClick={onUploadAvatar}>
            上传头像
          </Button>
        </Box>
      </Paper>
    </Grid>
  );
}

