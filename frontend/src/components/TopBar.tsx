import React from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import { styled, alpha, useTheme } from '@mui/material/styles';
import SearchIcon from '@mui/icons-material/Search';
import LogoutIcon from '@mui/icons-material/LogoutOutlined';
import RefreshIcon from '@mui/icons-material/SyncOutlined';
import SettingsIcon from '@mui/icons-material/Settings';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import { useNavigate } from 'react-router-dom';

const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: 99, // Pill shape
  backgroundColor: alpha(theme.palette.text.primary, theme.palette.mode === 'light' ? 0.06 : 0.12),
  '&:hover': {
    backgroundColor: alpha(theme.palette.text.primary, theme.palette.mode === 'light' ? 0.09 : 0.18),
  },
  marginRight: theme.spacing(2),
  marginLeft: 0,
  width: '100%',
  transition: 'all 0.2s ease',
  [theme.breakpoints.up('sm')]: {
    marginLeft: theme.spacing(3),
    width: 'auto',
  },
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.palette.text.secondary,
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: theme.palette.text.primary,
  width: '100%',
  '& .MuiInputBase-input': {
    padding: theme.spacing(1.5, 1, 1.5, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create('width'),
    width: '100%',
    [theme.breakpoints.up('md')]: {
      width: '24ch',
      '&:focus': {
        width: '32ch',
      },
    },
  },
}));

interface TopBarProps {
  onLogout: () => void;
  onRefresh: () => void;
  onSearch: (query: string) => void;
  loading: boolean;
  hideSearch?: boolean;
  hideSync?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ onLogout, onRefresh, onSearch, loading, hideSearch = false, hideSync = false }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const isLight = theme.palette.mode === 'light';

  return (
    <AppBar position="sticky" elevation={0} sx={{ top: 0, zIndex: 1100 }}>
      <Toolbar sx={{ height: 72 }}>
        <Box 
          onClick={() => navigate('/')}
          sx={{ 
            display: 'flex', 
            alignItems: 'center', 
            mr: 2,
            cursor: 'pointer',
            background: isLight ? theme.palette.primary.dark : theme.palette.primary.main,
            borderRadius: 3,
            width: 36,
            height: 36,
            justifyContent: 'center',
            color: theme.palette.primary.contrastText,
            fontWeight: 'bold',
            boxShadow: 'none'
          }}
        >
          M
        </Box>
        <Typography 
            variant="h6" 
            noWrap 
            component="div" 
            onClick={() => navigate('/')}
            sx={{ 
                display: { xs: 'none', sm: 'block' }, 
                fontWeight: 700, 
                color: 'text.primary', 
                letterSpacing: '-0.5px',
                cursor: 'pointer'
            }}
        >
          MercuryDesk
        </Typography>
        
        {!hideSearch && (
          <Search>
            <SearchIconWrapper>
              <SearchIcon />
            </SearchIconWrapper>
            <StyledInputBase
              placeholder="搜索联系人 / 邮件..."
              inputProps={{ 'aria-label': 'search' }}
              onChange={(e) => onSearch(e.target.value)}
            />
          </Search>
        )}
        
        <Box sx={{ flexGrow: 1 }} />
        
        {!hideSync && (
          <Tooltip title="同步全部来源">
            <IconButton
              size="large"
              onClick={onRefresh}
              disabled={loading}
              sx={{ 
                  mr: 1, 
                  color: 'text.secondary',
                  '&:hover': { color: 'text.primary', bgcolor: 'action.hover' } 
              }}
            >
              {loading ? <CircularProgress size={24} color="inherit" /> : <RefreshIcon />}
            </IconButton>
          </Tooltip>
        )}

        <Tooltip title="设置">
          <IconButton
            size="large"
            onClick={() => navigate('/settings')}
            sx={{ 
                mr: 1, 
                color: 'text.secondary',
                '&:hover': { color: 'text.primary', bgcolor: 'action.hover' } 
            }}
          >
            <SettingsIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title="退出登录">
          <IconButton 
            size="large" 
            onClick={onLogout}
            sx={{ 
                color: 'text.secondary',
                '&:hover': { color: 'error.main', bgcolor: alpha(theme.palette.error.main, 0.1) } 
            }}
          >
            <LogoutIcon />
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
};
