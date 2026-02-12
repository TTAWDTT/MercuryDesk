import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Divider from '@mui/material/Divider';

type WorkspaceItem = {
  key: string;
  label: string;
};

type BoardWorkspaceHeaderProps = {
  workspaces: WorkspaceItem[];
  activeWorkspace: string;
  onSelectWorkspace: (key: string) => void;
  onRefreshAgentPanels: () => void;
};

function BoardWorkspaceHeaderView({
  workspaces,
  activeWorkspace,
  onSelectWorkspace,
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
        <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap>
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

        <Stack direction="row" spacing={1} alignItems="center">
          <Button size="small" variant="outlined" onClick={onRefreshAgentPanels}>
            刷新
          </Button>
        </Stack>
      </Box>
      <Divider />
    </>
  );
}

export const BoardWorkspaceHeader = React.memo(BoardWorkspaceHeaderView);
