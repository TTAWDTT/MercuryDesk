import SettingsIcon from '@mui/icons-material/Settings';
import { useNavigate } from 'react-router-dom';

// ... (Search, SearchIconWrapper, StyledInputBase definitions remain same) ...

interface TopBarProps {
  onLogout: () => void;
  onRefresh: () => void;
  onSearch: (query: string) => void;
  loading: boolean;
}

export const TopBar: React.FC<TopBarProps> = ({ onLogout, onRefresh, onSearch, loading }) => {
  const theme = useTheme();
  const navigate = useNavigate();

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
            background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
            borderRadius: 3,
            width: 36,
            height: 36,
            justifyContent: 'center',
            color: 'white',
            fontWeight: 'bold',
            boxShadow: '0 4px 6px -1px rgba(99, 102, 241, 0.3)'
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
        
        <Search>
          <SearchIconWrapper>
            <SearchIcon />
          </SearchIconWrapper>
          <StyledInputBase
            placeholder="Search contacts, emails..."
            inputProps={{ 'aria-label': 'search' }}
            onChange={(e) => onSearch(e.target.value)}
          />
        </Search>
        
        <Box sx={{ flexGrow: 1 }} />
        
        <Tooltip title="Sync Accounts">
          <IconButton
            size="large"
            onClick={onRefresh}
            disabled={loading}
            sx={{ 
                mr: 1, 
                color: 'text.secondary',
                '&:hover': { color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.1) } 
            }}
          >
            {loading ? <CircularProgress size={24} color="inherit" /> : <RefreshIcon />}
          </IconButton>
        </Tooltip>

        <Tooltip title="Settings">
          <IconButton
            size="large"
            onClick={() => navigate('/settings')}
            sx={{ 
                mr: 1, 
                color: 'text.secondary',
                '&:hover': { color: 'primary.main', bgcolor: alpha(theme.palette.primary.main, 0.1) } 
            }}
          >
            <SettingsIcon />
          </IconButton>
        </Tooltip>

        <Tooltip title="Logout">
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