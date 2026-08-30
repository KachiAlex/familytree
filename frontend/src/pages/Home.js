import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const Home = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const features = [
    {
      icon: '◆',
      iconBg: '#F4E0D2',
      iconColor: '#B8541F',
      title: 'Clan & village origin',
      description: "Every person can carry their clan name and ancestral village — searchable and filterable across the whole tree.",
    },
    {
      icon: '✎',
      iconBg: '#E4EDE4',
      iconColor: '#3F6644',
      title: 'Oral history, written down',
      description: "Attach stories to any person — the ones usually only told at gatherings — so they outlast the gathering.",
    },
    {
      icon: '✓',
      iconBg: '#E8ECF4',
      iconColor: '#22345E',
      title: 'Elder verification',
      description: "Let the family's elders confirm details are correct, so the tree carries their authority, not just a member's guess.",
    },
  ];

  const views = [
    { num: '01', title: 'Vertical', desc: 'Classic top-down generations, color-coded by depth.' },
    { num: '02', title: 'Horizontal', desc: 'Same structure, reading left to right.' },
    { num: '03', title: 'Radial', desc: 'Root at center, generations ringing outward.' },
    { num: '04', title: '3D', desc: 'An explorable tree you can orbit and tilt.' },
    { num: '05', title: 'Timeline', desc: 'Births and deaths laid out chronologically.' },
    { num: '06', title: 'Migration map', desc: "Watch the family's movement play out by year." },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Navigation */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: { xs: 3, md: 7 }, py: 3, bgcolor: 'background.default' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25 }}>
          <Box sx={{
            width: 26, height: 26, borderRadius: '6px', bgcolor: '#22345E', position: 'relative', overflow: 'hidden',
            '&::after': {
              content: '""', position: 'absolute', inset: 0,
              background: 'repeating-linear-gradient(45deg, #C7930A 0 3px, transparent 3px 6px)', opacity: 0.5,
            },
          }} />
          <Typography variant="h6" sx={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 20 }}>
            Family Tree
          </Typography>
        </Box>
        {!isMobile && (
          <Box sx={{ display: 'flex', gap: 4, fontSize: 14, fontWeight: 500, color: '#22345E' }}>
            <Typography sx={{ cursor: 'pointer', '&:hover': { opacity: 0.7 } }}>Features</Typography>
            <Typography sx={{ cursor: 'pointer', '&:hover': { opacity: 0.7 } }}>Views</Typography>
            <Typography sx={{ cursor: 'pointer', '&:hover': { opacity: 0.7 } }}>Pricing</Typography>
          </Box>
        )}
        <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center' }}>
          {isAuthenticated ? (
            <Button
              variant="contained"
              onClick={() => navigate('/dashboard')}
              sx={{
                bgcolor: '#B8541F', color: '#FFFDF9', fontWeight: 600,
                boxShadow: '0 3px 0 0 #8a3d15',
                '&:hover': { bgcolor: '#B8541F', boxShadow: '0 4px 0 0 #8a3d15', transform: 'translateY(-1px)' },
              }}
            >
              Go to Dashboard
            </Button>
          ) : (
            <>
              <Button sx={{ color: '#22345E', fontWeight: 600, textTransform: 'none' }} onClick={() => navigate('/login')}>
                Sign in
              </Button>
              <Button
                variant="contained"
                onClick={() => navigate('/register')}
                sx={{
                  bgcolor: '#B8541F', color: '#FFFDF9', fontWeight: 600,
                  boxShadow: '0 3px 0 0 #8a3d15',
                  '&:hover': { bgcolor: '#B8541F', boxShadow: '0 4px 0 0 #8a3d15', transform: 'translateY(-1px)' },
                }}
              >
                Start your tree
              </Button>
            </>
          )}
        </Box>
      </Box>

      {/* Hero */}
      <Box sx={{ px: { xs: 3, md: 7 }, pt: { xs: 4, md: 8 }, pb: 0 }}>
        <Grid container spacing={5} alignItems="center">
          <Grid item xs={12} md={7}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2.5 }}>
              <Box sx={{ width: 22, height: 2, bgcolor: '#B8541F' }} />
              <Typography sx={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B8541F' }}>
                Built for the whole family
              </Typography>
            </Box>
            <Typography variant="h1" sx={{ fontSize: { xs: 36, md: 56 }, lineHeight: 1.06, letterSpacing: '-0.01em', color: 'text.primary' }}>
              Every elder's story,<br />held in <em style={{ color: '#22345E' }}>one root.</em>
            </Typography>
            <Typography sx={{ fontSize: 17, lineHeight: 1.6, color: '#463D34', mt: 2.5, maxWidth: 480 }}>
              Map your lineage across generations and continents. Record clan names, village origins, and the stories only your elders remember — before they're lost.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mt: 4, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => navigate('/register')}
                sx={{
                  bgcolor: '#B8541F', color: '#FFFDF9', fontWeight: 600,
                  px: 3, py: 1.4,
                  boxShadow: '0 3px 0 0 #8a3d15',
                  '&:hover': { bgcolor: '#B8541F', boxShadow: '0 4px 0 0 #8a3d15', transform: 'translateY(-1px)' },
                }}
              >
                Create your family tree
              </Button>
              <Button sx={{ color: '#22345E', fontWeight: 600, textTransform: 'none' }} onClick={() => navigate('/login')}>
                See how it works →
              </Button>
            </Box>
            <Typography sx={{ fontSize: 13, color: '#7A6D5C', mt: 2, fontFamily: "'IBM Plex Mono', monospace" }}>
              No card required · Private by default · Invite family in minutes
            </Typography>
          </Grid>
          <Grid item xs={12} md={5}>
            <Box sx={{
              position: 'relative', bgcolor: '#22345E', borderRadius: '20px', p: 4,
              aspectRatio: '1 / 1.02', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            }}>
              <svg viewBox="0 0 300 320" style={{ width: '100%', height: '100%' }}>
                <line x1="150" y1="40" x2="90" y2="110" stroke="#F1E6D2" strokeWidth="2" opacity=".5" />
                <line x1="150" y1="40" x2="210" y2="110" stroke="#F1E6D2" strokeWidth="2" opacity=".5" />
                <line x1="90" y1="110" x2="60" y2="190" stroke="#F1E6D2" strokeWidth="2" opacity=".5" />
                <line x1="90" y1="110" x2="120" y2="190" stroke="#F1E6D2" strokeWidth="2" opacity=".5" />
                <line x1="210" y1="110" x2="180" y2="190" stroke="#F1E6D2" strokeWidth="2" opacity=".5" />
                <line x1="210" y1="110" x2="240" y2="190" stroke="#F1E6D2" strokeWidth="2" opacity=".5" />
                <line x1="60" y1="190" x2="60" y2="270" stroke="#F1E6D2" strokeWidth="2" opacity=".5" />
                <line x1="120" y1="190" x2="140" y2="270" stroke="#F1E6D2" strokeWidth="2" opacity=".5" />
                <line x1="180" y1="190" x2="180" y2="270" stroke="#F1E6D2" strokeWidth="2" opacity=".5" />
                <circle cx="150" cy="40" r="16" fill="#C7930A" />
                <circle cx="90" cy="110" r="14" fill="#B8541F" />
                <circle cx="210" cy="110" r="14" fill="#B8541F" />
                <circle cx="60" cy="190" r="12" fill="#3F6644" />
                <circle cx="120" cy="190" r="12" fill="#3F6644" />
                <circle cx="180" cy="190" r="12" fill="#3F6644" />
                <circle cx="240" cy="190" r="12" fill="#3F6644" />
                <circle cx="60" cy="270" r="10" fill="#F1E6D2" />
                <circle cx="140" cy="270" r="10" fill="#F1E6D2" />
                <circle cx="180" cy="270" r="10" fill="#F1E6D2" />
              </svg>
            </Box>
          </Grid>
        </Grid>
      </Box>

      {/* Thread band */}
      <Box sx={{ mt: 7 }}>
        <div className="thread-band" />
      </Box>

      {/* Features section */}
      <Box sx={{ py: { xs: 6, md: 11 }, px: { xs: 3, md: 7 } }}>
        <Box sx={{ maxWidth: 600, mb: 6 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Box sx={{ width: 22, height: 2, bgcolor: '#B8541F' }} />
            <Typography sx={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#B8541F' }}>
              What's inside
            </Typography>
          </Box>
          <Typography variant="h2" sx={{ fontSize: { xs: 26, md: 34 }, letterSpacing: '-0.01em' }}>
            A tree that holds more than names and dates.
          </Typography>
          <Typography sx={{ color: '#4E4436', mt: 1.5, fontSize: '15.5px', lineHeight: 1.6 }}>
            Every profile can carry the details that matter to an African family history — not just who, but where from, and what's remembered.
          </Typography>
        </Box>
        <Grid container spacing={3}>
          {features.map((f, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Box sx={{
                bgcolor: 'background.paper', borderRadius: '14px', p: '28px 24px',
                border: '1px solid', borderColor: '#E4D3B0',
              }}>
                <Box sx={{
                  width: 42, height: 42, borderRadius: '10px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  mb: 2.25, fontSize: 19, bgcolor: f.iconBg, color: f.iconColor,
                }}>
                  {f.icon}
                </Box>
                <Typography variant="h4" sx={{ fontSize: 18, mb: 1 }}>
                  {f.title}
                </Typography>
                <Typography sx={{ fontSize: '13.5px', color: '#5A5042', lineHeight: 1.55 }}>
                  {f.description}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Views section (dark) */}
      <Box sx={{ bgcolor: '#1C1410', color: '#F1E6D2', py: { xs: 6, md: 11 }, px: { xs: 3, md: 7 } }}>
        <Box sx={{ maxWidth: 600, mb: 6 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
            <Box sx={{ width: 22, height: 2, bgcolor: '#C7930A' }} />
            <Typography sx={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#C7930A' }}>
              Six ways to see one story
            </Typography>
          </Box>
          <Typography variant="h2" sx={{ fontSize: { xs: 26, md: 34 }, color: '#FFFDF9' }}>
            Your tree, from every angle.
          </Typography>
          <Typography sx={{ color: 'rgba(255,253,249,0.6)', mt: 1.5, fontSize: '15.5px', lineHeight: 1.6 }}>
            Switch views depending on what you're trying to understand — structure, chronology, or geography.
          </Typography>
        </Box>
        <Box sx={{ display: 'flex', gap: 2, overflowX: 'auto', pb: 1 }}>
          {views.map((v, i) => (
            <Box key={i} sx={{
              flex: '0 0 auto', bgcolor: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: '12px',
              p: 2.25, width: 190,
            }}>
              <Typography sx={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#C7930A', letterSpacing: '0.06em' }}>
                {v.num}
              </Typography>
              <Typography variant="h4" sx={{ fontSize: 16, mt: 1, mb: 0.75, color: '#FFFDF9' }}>
                {v.title}
              </Typography>
              <Typography sx={{ fontSize: '12.5px', color: 'rgba(255,253,249,0.55)', lineHeight: 1.5 }}>
                {v.desc}
              </Typography>
            </Box>
          ))}
        </Box>
      </Box>

      {/* CTA band */}
      <Box sx={{ py: { xs: 6, md: 10 }, textAlign: 'center', bgcolor: '#E4D3B0', px: { xs: 3, md: 7 } }}>
        <Typography variant="h2" sx={{ fontSize: { xs: 26, md: 36 }, maxWidth: 560, mx: 'auto', mb: 1.75 }}>
          Your family's history is worth more than a group chat.
        </Typography>
        <Typography sx={{ color: '#5A5042', mb: 3.5 }}>
          Start with one person. The rest of the tree grows from there.
        </Typography>
        {!isAuthenticated && (
          <Button
            variant="contained"
            size="large"
            onClick={() => navigate('/register')}
            sx={{
              bgcolor: '#B8541F', color: '#FFFDF9', fontWeight: 600,
              px: 3.75, py: 1.75, fontSize: 15,
              boxShadow: '0 3px 0 0 #8a3d15',
              '&:hover': { bgcolor: '#B8541F', boxShadow: '0 4px 0 0 #8a3d15', transform: 'translateY(-1px)' },
            }}
          >
            Create your family tree
          </Button>
        )}
      </Box>

      {/* Thread band thin */}
      <div className="thread-band thin" />

      {/* Footer */}
      <Box sx={{ py: 4, px: { xs: 3, md: 7 }, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Typography sx={{ fontSize: 13, color: '#7A6D5C' }}>
          © {new Date().getFullYear()} Family Tree
        </Typography>
        <Typography sx={{ fontSize: 13, color: '#7A6D5C' }}>
          Private by default · Built for the whole family
        </Typography>
      </Box>
    </Box>
  );
};

export default Home;

