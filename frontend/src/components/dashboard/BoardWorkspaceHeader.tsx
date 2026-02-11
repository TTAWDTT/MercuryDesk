import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';

type WorkspaceItem = {
  key: string;
  label: string;
};

type BoardWorkspaceHeaderProps = {
  workspaces: WorkspaceItem[];
  activeWorkspace: string;
  onSelectWorkspace: (key: string) => void;
  concurrency: number;
  onRefreshAgentPanels: () => void;
};

function BoardWorkspaceHeaderView({
  workspaces,
  activeWorkspace,
  onSelectWorkspace,
  concurrency,
  onRefreshAgentPanels,
}: BoardWorkspaceHeaderProps) {
  return (
    <>
      <Box
        p={{ xs: 1.6, md: 2.2 }}
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 1.2,
          flexWrap: 'wrap',
        }}
      >
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          <Typography variant="subtitle2" sx={{ fontWeight: 700, mr: 0.4 }}>
            工作区:
          </Typography>
          {workspaces.map((item) => (
            <Chip
              key={item.key}
              size="small"
              clickable
              onClick={() => onSelectWorkspace(item.key)}
              color={item.key === activeWorkspace ? 'primary' : 'default'}
              variant={item.key === activeWorkspace ? 'filled' : 'outlined'}
              label={item.label}
            />
          ))}
        </Stack>

        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
          <Chip
            size="small"
            variant="outlined"
            icon={<AutoAwesomeIcon fontSize="small" />}
            label={`同步并发 ${concurrency}`}
          />
          <Button size="small" variant="outlined" onClick={onRefreshAgentPanels}>
            刷新 AI 面板
          </Button>
        </Stack>
      </Box>
      <Divider />
    </>
  );
}

export const BoardWorkspaceHeader = React.memo(BoardWorkspaceHeaderView);

