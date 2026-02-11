import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import Chip from '@mui/material/Chip';
import { useNavigate } from 'react-router-dom';

const Search = styled('div')(({ theme }) => ({
  position: 'relative',
  borderRadius: 999,
  border: `1px solid ${theme.palette.divider}`,
  backgroundColor: theme.palette.background.paper,
  '&:hover': {
    borderColor: theme.palette.text.primary,
  },
  '&:focus-within': {
    borderColor: theme.palette.primary.main,
    boxShadow: `0 0 0 3px ${theme.palette.primary.main}26`,
  },
  marginRight: theme.spacing(1.5),
  marginLeft: theme.spacing(1.5),
  width: '100%',
  maxWidth: 620,
  transition: 'all 0.2s ease',
  [theme.breakpoints.up('sm')]: {
    width: 'auto',
  },
}));

const SearchIconWrapper = styled('div')(({ theme }) => ({
  padding: theme.spacing(0, 1.7),
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
    padding: theme.spacing(1.25, 1, 1.25, 0),
    paddingLeft: `calc(1em + ${theme.spacing(4)})`,
    transition: theme.transitions.create('width', { duration: 200 }),
    width: '100%',
    fontSize: '0.9rem',
    [theme.breakpoints.up('md')]: {
      width: '30ch',
      '&:focus': {
        width: '42ch',
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
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const syncTooltipTitle = useMemo(() => (loading ? '正在同步中…' : '同步全部来源'), [loading]);

  const focusSearch = useCallback(() => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, []);

  useEffect(() => {
    if (hideSearch) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const isK = event.key.toLowerCase() === 'k';
      if (!isK) return;
      if (!(event.metaKey || event.ctrlKey)) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return;
      event.preventDefault();
      focusSearch();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [focusSearch, hideSearch]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchValue(value);
    onSearch(value);
  }, [onSearch]);

  const handleClearSearch = useCallback(() => {
    setSearchValue('');
    onSearch('');
    focusSearch();
  }, [focusSearch, onSearch]);

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
        backgroundImage:
          theme.palette.mode === 'light'
            ? 'linear-gradient(180deg, rgba(255,255,255,0.94), rgba(255,255,255,0.86))'
            : 'linear-gradient(180deg, rgba(27,34,43,0.94), rgba(27,34,43,0.86))',
        backdropFilter: 'blur(10px)',
        color: 'text.primary',
      }}
    >
      <Toolbar sx={{ minHeight: 64, height: 64, gap: 0.6 }}>
        <Box
          onClick={() => navigate('/')}
          sx={{
            display: 'flex',
            alignItems: 'center',
            mr: 0.8,
            cursor: 'pointer',
            width: 38,
            height: 38,
            justifyContent: 'center',
            transition: 'transform 0.15s ease',
            '&:active': { transform: 'scale(0.95)' },
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
            fontSize: '1.03rem',
            mr: { xs: 0, md: 0.8 },
          }}
        >
          MercuryDesk
        </Typography>

        {!hideSearch && (
          <Search sx={{ height: 40, display: 'flex', alignItems: 'center', flex: 1 }}>
            <SearchIconWrapper>
              <SearchIcon fontSize="small" />
            </SearchIconWrapper>
            <StyledInputBase
              inputRef={searchInputRef}
              placeholder="搜索联系人 / 邮件..."
              inputProps={{ 'aria-label': 'search' }}
              value={searchValue}
              onChange={handleSearchChange}
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
            <Chip
              size="small"
              label={/Mac|iPhone|iPad|iPod/i.test(navigator.platform) ? '⌘K' : 'Ctrl+K'}
              variant="outlined"
              sx={{
                mr: 0.8,
                display: { xs: 'none', md: 'inline-flex' },
                height: 22,
                fontSize: '0.68rem',
                color: 'text.secondary',
              }}
            />
          </Search>
        )}

        <Box sx={{ flexGrow: 1 }} />

        {!hideSync && (
          <Tooltip title={syncTooltipTitle}>
            <IconButton
              size="medium"
              onClick={onRefresh}
              disabled={loading}
              sx={{
                mr: 0.3,
                color: 'text.primary',
                border: '1px solid',
                borderColor: 'divider',
                '&:hover': { bgcolor: 'action.hover' },
              }}
            >
              {loading ? <CircularProgress size={18} color="inherit" /> : <RefreshIcon fontSize="small" />}
            </IconButton>
          </Tooltip>
        )}

        <Tooltip title="设置">
          <IconButton
            size="medium"
            onClick={() => navigate('/settings')}
            sx={{
              mr: 0.3,
              color: 'text.primary',
              border: '1px solid',
              borderColor: 'divider',
              '&:hover': { bgcolor: 'action.hover' },
            }}
          >
            <SettingsIcon fontSize="small" />
          </IconButton>
        </Tooltip>

        <Tooltip title="退出登录">
          <IconButton
            size="medium"
            onClick={logout}
            sx={{
              color: 'text.primary',
              border: '1px solid',
              borderColor: 'divider',
              '&:hover': { color: '#ef4444', bgcolor: 'rgba(239,68,68,0.08)' },
            }}
          >
            <LogoutIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
};
