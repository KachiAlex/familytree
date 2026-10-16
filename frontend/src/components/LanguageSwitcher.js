import React, { useState } from 'react';
import { Box, IconButton, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import { Translate as TranslateIcon, Check as CheckIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'ig', label: 'Igbo' },
  { code: 'yo', label: 'Yorùbá' },
  { code: 'ha', label: 'Hausa' },
  { code: 'sw', label: 'Kiswahili' },
  { code: 'fr', label: 'Français' },
];

const LanguageSwitcher = () => {
  const { i18n, t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState(null);
  const current = (i18n.language || 'en').split('-')[0];

  const selectLanguage = (code) => {
    i18n.changeLanguage(code);
    try { localStorage.setItem('ftLanguage', code); } catch (e) { /* private mode */ }
    setAnchorEl(null);
  };

  return (
    <Box component="span">
      <IconButton
        onClick={(e) => setAnchorEl(e.currentTarget)}
        title={t('nav.language')}
        size="small"
        sx={{ color: '#22345E' }}
      >
        <TranslateIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={() => setAnchorEl(null)}>
        {LANGUAGES.map(({ code, label }) => (
          <MenuItem key={code} selected={code === current} onClick={() => selectLanguage(code)}>
            <ListItemIcon sx={{ minWidth: 28 }}>
              {code === current && <CheckIcon fontSize="small" />}
            </ListItemIcon>
            <ListItemText>{label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </Box>
  );
};

export default LanguageSwitcher;
