import React, { useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import { styled, useTheme } from '@mui/material/styles';
import { useAuth } from '../contexts/AuthContext';
import SearchIcon from '@mui/icons-material/Search';
import CloseIcon from '@mui/icons-material/Close';
import LogoutIcon from '@mui/icons-material/LogoutOutlined';
import RefreshIcon from '@mui/icons-material/SyncOutlined';
import SettingsIcon from '@mui/icons-material/Settings';
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import CircularProgress from '@mui/material/CircularProgress';
import { useNavigate } from 'react-router-dom';

const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: 10,
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.default,
  '&:hover': {
    borderColor: theme.palette.text.secondary,
  },
  '&:focus-within': {
    borderColor: theme.palette.primary.main,
    boxShadow: `0 0 0 2px ${theme.palette.primary.main}22`,
  },
  marginRight: theme.spacing(2),
  marginLeft: 0,
  width: '100%',
  transition: 'all 0.15s ease',
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
  onRefresh: () => void;
  onSearch: (query: string) => void;
  loading: boolean;
  hideSearch?: boolean;
  hideSync?: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ onRefresh, onSearch, loading, hideSearch = false, hideSync = false }) => {
  const theme = useTheme();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [searchValue, setSearchValue] = useState('');

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    onSearch(e.target.value);
  };

  const handleClearSearch = () => {
    setSearchValue('');
    onSearch('');
  };

  return (
    <AppBar
      position="sticky"
      elevation={0}
      sx={{
        top: 0,
        zIndex: 1100,
        borderBottom: '1px solid',
        borderColor: 'divider',
        bgcolor: 'background.paper',
        color: 'text.primary',
      }}
    >
      <Toolbar sx={{ height: 56, minHeight: 56 }}>
        <Box
          onClick={() => navigate('/')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            mr: 2,
            cursor: 'pointer',
            background: 'transparent',
            borderRadius: 0,
            width: 40,
            height: 40,
            justifyContent: 'center',
            transition: 'transform 0.1s',
            '&:active': { transform: 'scale(0.95)' }
          }}
        >
          <img src="/logo.png" alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
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
                letterSpacing: '-0.015em',
                cursor: 'pointer',
                fontSize: '1.06rem'
            }}
        >
          MercuryDesk
        </Typography>

        {!hideSearch && (
          <Search sx={{ height: 36, display: 'flex', alignItems: 'center' }}>
            <SearchIconWrapper>
              <SearchIcon fontSize="small" />
            </SearchIconWrapper>
            <StyledInputBase
              placeholder="搜索联系人 / 邮件..."
              inputProps={{ 'aria-label': 'search' }}
              value={searchValue}
              onChange={handleSearchChange}
              sx={{ fontSize: '0.9rem' }}
            />
            {searchValue && (
              <IconButton
              size="small"
              onClick={handleClearSearch}
              sx={{ color: 'text.secondary', mr: 0.5, '&:hover': { color: 'text.primary', bgcolor: 'transparent' } }}
            >
                <CloseIcon fontSize="small" />
              </IconButton>
            )}
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
                  color: 'text.primary',
                  '&:hover': { bgcolor: 'action.hover' },
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
                color: 'text.primary',
                '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <SettingsIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title="退出登录">
          <IconButton 
            size="large" 
            onClick={logout}
            sx={{ 
                color: 'text.primary',
                '&:hover': { color: '#ef4444', bgcolor: 'rgba(239,68,68,0.08)' },
            }}
          >
            <LogoutIcon />
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
};
