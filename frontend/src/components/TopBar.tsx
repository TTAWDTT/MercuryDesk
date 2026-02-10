import React, { useState } from 'react';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import IconButton from '@mui/material/IconButton';
import InputBase from '@mui/material/InputBase';
import { styled, useTheme } from '@mui/material/styles';
import { headerLight, headerDark } from '../theme';
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

const Search = styled('div')(({ theme }) => {
  const isLight = theme.palette.mode === 'light';
  return {
    position: 'relative',
    borderRadius: 0,
    border: `2px solid ${isLight ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}`,
    backgroundColor: isLight ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)',
    '&:hover': {
      backgroundColor: isLight ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
      borderColor: isLight ? 'rgba(255,255,255,0.5)' : 'rgba(0,0,0,0.5)',
    },
    '&:focus-within': {
      backgroundColor: isLight ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)',
      borderColor: isLight ? '#ffffff' : '#000000',
      boxShadow: `2px 2px 0 0 ${isLight ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)'}`,
    },
    marginRight: theme.spacing(2),
    marginLeft: 0,
    width: '100%',
    transition: 'all 0.2s ease',
    [theme.breakpoints.up('sm')]: {
      marginLeft: theme.spacing(3),
      width: 'auto',
    },
  };
});

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 2),
  height: '100%',
  position: 'absolute',
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: theme.palette.primary.contrastText,
  opacity: 0.7,
}));

const StyledInputBase = styled(InputBase)(({ theme }) => ({
  color: theme.palette.primary.contrastText,
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
  const isLight = theme.palette.mode === 'light';
  const bgTexture = isLight ? headerLight : headerDark;

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchValue(e.target.value);
    onSearch(e.target.value);
  };

  const handleClearSearch = () => {
    setSearchValue('');
    onSearch('');
  };

  return (
    <AppBar position="sticky" elevation={0} sx={{ top: 0, zIndex: 1100, borderBottom: '4px solid', borderColor: 'text.primary', bgcolor: 'primary.main', backgroundImage: bgTexture, backgroundSize: 'auto', color: 'primary.contrastText' }}>
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
                color: 'primary.contrastText',
                letterSpacing: '-0.5px',
                cursor: 'pointer',
                fontSize: '1.1rem'
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
                sx={{ color: 'primary.contrastText', opacity: 0.7, mr: 0.5, '&:hover': { opacity: 1 } }}
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
                  color: 'primary.contrastText',
                  opacity: 0.8,
                  '&:hover': { opacity: 1, bgcolor: isLight ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)' } 
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
                color: 'primary.contrastText',
                opacity: 0.8,
                '&:hover': { opacity: 1, bgcolor: isLight ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)' } 
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
                color: 'primary.contrastText',
                opacity: 0.8,
                '&:hover': { opacity: 1, color: '#ef4444', bgcolor: 'rgba(239,68,68,0.15)' } 
            }}
          >
            <LogoutIcon />
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
};
