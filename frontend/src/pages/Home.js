import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Grid, useTheme, useMediaQuery } from '@mui/material';
import { useAuth } from '../contexts/AuthContext';

const Home = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const features = [
    {
      icon: '◆',
      iconBg: '#F7E5D8',
      iconColor: '#C1622D',
      title: 'Clan & village origin',
      description: "Every person can carry their clan name and ancestral village — searchable and filterable across the whole tree.",
    },
    {
      icon: '✎',
      iconBg: '#E7EFE6',
      iconColor: '#3F6644',
      title: 'Oral history, written down',
      description: "Attach stories to any person — the ones usually only told at gatherings — so they outlast the gathering.",
    },
    {
      icon: '✓',
      iconBg: '#FBEFD6',
      iconColor: '#D79A1E',
      title: 'Elder verification',
      description: "Let the family's elders confirm details are correct, so the tree carries their authority, not just a member's guess.",
    },
  ];

  const views = [
    { num: '01', title: 'Vertical', desc: 'Classic top-down generations, color-coded by depth.' },
    { num: '02', title: 'Radial', desc: 'Root at center, generations ringing outward.' },
    { num: '03', title: '3D view', desc: 'An explorable tree you can orbit and tilt.' },
    { num: '04', title: 'Timeline', desc: 'Births and deaths laid out chronologically.' },
    { num: '05', title: 'Migration map', desc: "Watch the family's movement play out by year." },
    { num: '06', title: 'Horizontal', desc: 'Same structure, reading left to right.' },
  ];

  const stats = [
    { value: '40,000+', label: 'FAMILIES' },
    { value: '2.1M', label: 'PEOPLE MAPPED' },
    { value: '18,000+', label: 'ORAL STORIES SAVED' },
    { value: '30', label: 'COUNTRIES' },
  ];

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: '#FBF7F0', fontFamily: "'Work Sans', sans-serif", color: '#1C1410' }}>
      <Box sx={{ maxWidth: 1180, mx: 'auto', px: { xs: 3, sm: 5 } }}>
        {/* ---------- Navigation ---------- */}
        <Box component="nav" sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 2.75 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 19 }}>
            <svg viewBox="0 0 200 200" width="32" height="32">
              <rect width="200" height="200" rx="44" fill="#22345E" />
              <line x1="100" y1="150" x2="70" y2="176" stroke="#3A4F82" strokeWidth="4" strokeLinecap="round" />
              <line x1="100" y1="150" x2="100" y2="180" stroke="#3A4F82" strokeWidth="4" strokeLinecap="round" />
              <line x1="100" y1="150" x2="130" y2="176" stroke="#3A4F82" strokeWidth="4" strokeLinecap="round" />
              <line x1="100" y1="150" x2="100" y2="108" stroke="#F1E6D2" strokeWidth="5" strokeLinecap="round" />
              <line x1="100" y1="120" x2="62" y2="90" stroke="#F1E6D2" strokeWidth="4" strokeLinecap="round" />
              <line x1="100" y1="120" x2="100" y2="72" stroke="#F1E6D2" strokeWidth="4" strokeLinecap="round" />
              <line x1="100" y1="120" x2="138" y2="90" stroke="#F1E6D2" strokeWidth="4" strokeLinecap="round" />
              <circle cx="100" cy="66" r="11" fill="#D79A1E" />
              <circle cx="62" cy="90" r="8" fill="#3F6644" />
              <circle cx="138" cy="90" r="8" fill="#3F6644" />
            </svg>
            Family Tree
          </Box>
          {!isMobile && (
            <Box sx={{ display: 'flex', gap: 4.5, fontSize: 14, fontWeight: 500, color: '#22345E' }}>
              <Typography sx={{ cursor: 'pointer', '&:hover': { opacity: 0.7 } }}>Features</Typography>
              <Typography sx={{ cursor: 'pointer', '&:hover': { opacity: 0.7 } }}>Views</Typography>
              <Typography sx={{ cursor: 'pointer', '&:hover': { opacity: 0.7 } }}>Pricing</Typography>
              <Typography sx={{ cursor: 'pointer', '&:hover': { opacity: 0.7 } }}>Stories</Typography>
            </Box>
          )}
          <Box sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}>
            {isAuthenticated ? (
              <Button
                onClick={() => navigate('/dashboard')}
                sx={{
                  bgcolor: '#22345E', color: '#fff', fontWeight: 600, fontSize: 14, textTransform: 'none',
                  px: 3, py: 1.5, borderRadius: '10px',
                  boxShadow: '0 1px 2px rgba(34,52,94,.15), 0 8px 20px rgba(34,52,94,.18)',
                  '&:hover': { bgcolor: '#22345E', transform: 'translateY(-2px)', boxShadow: '0 4px 8px rgba(34,52,94,.2), 0 14px 28px rgba(34,52,94,.24)' },
                }}
              >
                Go to Dashboard
              </Button>
            ) : (
              <>
                <Button sx={{ color: '#22345E', fontWeight: 600, fontSize: 14, textTransform: 'none' }} onClick={() => navigate('/login')}>
                  Sign in
                </Button>
                <Button
                  onClick={() => navigate('/register')}
                  sx={{
                    bgcolor: '#22345E', color: '#fff', fontWeight: 600, fontSize: 14, textTransform: 'none',
                    px: 3, py: 1.5, borderRadius: '10px',
                    boxShadow: '0 1px 2px rgba(34,52,94,.15), 0 8px 20px rgba(34,52,94,.18)',
                    '&:hover': { bgcolor: '#22345E', transform: 'translateY(-2px)', boxShadow: '0 4px 8px rgba(34,52,94,.2), 0 14px 28px rgba(34,52,94,.24)' },
                  }}
                >
                  Start your tree
                </Button>
              </>
            )}
          </Box>
        </Box>

        {/* ---------- Hero ---------- */}
        <Box sx={{
          display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr .92fr' },
          gap: { xs: 4, md: 7 }, alignItems: 'center', pt: { xs: 4, md: 7 }, pb: 2.5,
        }}>
          <Box>
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', gap: 1, fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#D79A1E',
              bgcolor: '#FBEFD6', px: 1.75, py: 0.875, borderRadius: '20px', mb: 2.75,
            }}>
              <Box component="span" sx={{ fontSize: 8 }}>●</Box>
              Built for the whole family
            </Box>
            <Typography sx={{
              fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: { xs: 40, md: 58 },
              lineHeight: 1.05, letterSpacing: '-0.015em',
            }}>
              Every elder's story,<br />held in{' '}
              <Box component="span" sx={{ fontStyle: 'italic', fontWeight: 500, color: '#3A4F82' }}>one root.</Box>
            </Typography>
            <Typography sx={{ fontSize: '17.5px', lineHeight: 1.65, color: '#5C5346', mt: 3, maxWidth: 460 }}>
              Map your lineage across generations and continents. Record clan names, village origins, and the stories only your elders remember — before they're lost.
            </Typography>
            <Box sx={{ display: 'flex', gap: 2, mt: 4.25, alignItems: 'center', flexWrap: 'wrap' }}>
              <Button
                onClick={() => navigate('/register')}
                sx={{
                  bgcolor: '#22345E', color: '#fff', fontWeight: 600, fontSize: 14, textTransform: 'none',
                  px: 3, py: 1.5, borderRadius: '10px',
                  boxShadow: '0 1px 2px rgba(34,52,94,.15), 0 8px 20px rgba(34,52,94,.18)',
                  '&:hover': { bgcolor: '#22345E', transform: 'translateY(-2px)', boxShadow: '0 4px 8px rgba(34,52,94,.2), 0 14px 28px rgba(34,52,94,.24)' },
                }}
              >
                Create your family tree
              </Button>
              <Button
                onClick={() => navigate('/login')}
                sx={{
                  bgcolor: '#fff', color: '#22345E', fontWeight: 600, fontSize: 14, textTransform: 'none',
                  px: 3, py: 1.5, borderRadius: '10px', border: '1.5px solid #EAEEF6',
                  boxShadow: '0 1px 2px rgba(0,0,0,.03)',
                  '&:hover': { borderColor: '#3A4F82', transform: 'translateY(-2px)' },
                }}
              >
                See how it works
              </Button>
            </Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mt: 3.75 }}>
              <Box sx={{ display: 'flex' }}>
                {[
                  { bg: '#22345E', t: 'FA' },
                  { bg: '#D79A1E', t: 'OM' },
                  { bg: '#3F6644', t: 'KA' },
                  { bg: '#C1622D', t: 'ZN' },
                ].map((a, i) => (
                  <Box key={i} sx={{
                    width: 32, height: 32, borderRadius: '50%', border: '2.5px solid #FBF7F0',
                    ml: i === 0 ? 0 : '-8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 11, color: '#fff', bgcolor: a.bg,
                  }}>
                    {a.t}
                  </Box>
                ))}
              </Box>
              <Typography sx={{ fontSize: '12.5px', color: '#8C8171', fontFamily: "'IBM Plex Mono', monospace" }}>
                Joined by 40,000+ families across 30 countries
              </Typography>
            </Box>
          </Box>

          {/* Hero visual */}
          <Box sx={{ position: 'relative', display: { xs: 'none', md: 'block' } }}>
            <Box sx={{
              bgcolor: '#22345E', borderRadius: '28px', aspectRatio: '1 / 1.05',
              position: 'relative', overflow: 'hidden', boxShadow: '0 20px 50px rgba(34,52,94,.28)',
            }}>
              <svg viewBox="0 0 300 320" style={{ width: '100%', height: '100%' }}>
                <line x1="150" y1="46" x2="95" y2="112" stroke="rgba(255,255,255,.28)" strokeWidth="2" />
                <line x1="150" y1="46" x2="205" y2="112" stroke="rgba(255,255,255,.28)" strokeWidth="2" />
                <line x1="95" y1="112" x2="65" y2="188" stroke="rgba(255,255,255,.28)" strokeWidth="2" />
                <line x1="95" y1="112" x2="125" y2="188" stroke="rgba(255,255,255,.28)" strokeWidth="2" />
                <line x1="205" y1="112" x2="175" y2="188" stroke="rgba(255,255,255,.28)" strokeWidth="2" />
                <line x1="205" y1="112" x2="235" y2="188" stroke="rgba(255,255,255,.28)" strokeWidth="2" />
                <line x1="65" y1="188" x2="65" y2="262" stroke="rgba(255,255,255,.28)" strokeWidth="2" />
                <line x1="125" y1="188" x2="145" y2="262" stroke="rgba(255,255,255,.28)" strokeWidth="2" />
                <line x1="175" y1="188" x2="175" y2="262" stroke="rgba(255,255,255,.28)" strokeWidth="2" />
                <circle cx="150" cy="46" r="17" fill="#D79A1E" />
                <circle cx="95" cy="112" r="14" fill="#C1622D" />
                <circle cx="205" cy="112" r="14" fill="#C1622D" />
                <circle cx="65" cy="188" r="12" fill="#3F6644" />
                <circle cx="125" cy="188" r="12" fill="#3F6644" />
                <circle cx="175" cy="188" r="12" fill="#3F6644" />
                <circle cx="235" cy="188" r="12" fill="#3F6644" />
                <circle cx="65" cy="262" r="10" fill="#8DA2D6" />
                <circle cx="145" cy="262" r="10" fill="#8DA2D6" />
                <circle cx="175" cy="262" r="10" fill="#8DA2D6" />
              </svg>
            </Box>
            {/* Floating chips */}
            <Box sx={{
              position: 'absolute', top: '8%', right: '-6%', bgcolor: '#fff', borderRadius: '14px',
              px: 2, py: 1.5, boxShadow: '0 10px 30px rgba(28,20,16,.14)',
              display: 'flex', alignItems: 'center', gap: 1.25, fontSize: '12.5px', fontWeight: 600,
            }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#3F6644' }} />
              Verified by 3 elders
            </Box>
            <Box sx={{
              position: 'absolute', bottom: '12%', left: '-8%', bgcolor: '#fff', borderRadius: '14px',
              px: 2, py: 1.5, boxShadow: '0 10px 30px rgba(28,20,16,.14)',
              display: 'flex', alignItems: 'center', gap: 1.25, fontSize: '12.5px', fontWeight: 600,
            }}>
              <Box sx={{ width: 8, height: 8, borderRadius: '50%', bgcolor: '#D79A1E' }} />
              142 members
            </Box>
          </Box>
        </Box>

        {/* ---------- Trust strip ---------- */}
        <Box sx={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', py: 5,
          borderTop: '1px solid #E7DCC8', borderBottom: '1px solid #E7DCC8', mt: 4.5, flexWrap: 'wrap', gap: 3,
        }}>
          {stats.map((s, i) => (
            <Box key={i} sx={{ stat: true }}>
              <Typography sx={{ fontFamily: "'Fraunces', serif", fontSize: 28, fontWeight: 600, display: 'block', color: '#22345E' }}>
                {s.value}
              </Typography>
              <Typography sx={{ fontSize: '12.5px', color: '#8C8171', fontFamily: "'IBM Plex Mono', monospace" }}>
                {s.label}
              </Typography>
            </Box>
          ))}
        </Box>

        {/* ---------- Features section ---------- */}
        <Box sx={{ py: { xs: 6, md: 12 } }}>
          <Box sx={{ maxWidth: 600, mx: 'auto', mb: 6.5, textAlign: 'center' }}>
            <Box sx={{
              display: 'inline-flex', alignItems: 'center', gap: 1, fontFamily: "'IBM Plex Mono', monospace",
              fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#D79A1E',
              bgcolor: '#FBEFD6', px: 1.75, py: 0.875, borderRadius: '20px', mb: 2.75,
            }}>
              <Box component="span" sx={{ fontSize: 8 }}>●</Box>
              What's inside
            </Box>
            <Typography sx={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: { xs: 28, md: 36 }, letterSpacing: '-0.01em', lineHeight: 1.15 }}>
              A tree that holds more than names and dates.
            </Typography>
            <Typography sx={{ color: '#5C5346', mt: 1.75, fontSize: '15.5px', lineHeight: 1.65 }}>
              Every profile can carry the details that matter to an African family history — not just who, but where from, and what's remembered.
            </Typography>
          </Box>
          <Grid container spacing={3}>
            {features.map((f, i) => (
              <Grid item xs={12} sm={6} md={4} key={i}>
                <Box sx={{
                  bgcolor: '#FFFFFF', borderRadius: '18px', p: '32px 26px', border: '1px solid #E7DCC8',
                  transition: 'transform .15s ease, box-shadow .15s ease',
                  '&:hover': { transform: 'translateY(-4px)', boxShadow: '0 16px 32px rgba(28,20,16,.08)' },
                }}>
                  <Box sx={{
                    width: 46, height: 46, borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    mb: 2.5, fontSize: 20, bgcolor: f.iconBg, color: f.iconColor,
                  }}>
                    {f.icon}
                  </Box>
                  <Typography sx={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: 19, mb: 1.25 }}>
                    {f.title}
                  </Typography>
                  <Typography sx={{ fontSize: '13.5px', color: '#5C5346', lineHeight: 1.6 }}>
                    {f.description}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Box>

      {/* ---------- Views section (indigo rounded card) ---------- */}
      <Box sx={{
        bgcolor: '#22345E', borderRadius: { xs: 0, md: '32px' }, mx: { xs: 0, md: 5 },
        px: { xs: 3, md: 6 }, py: { xs: 6, md: 9 }, color: '#fff',
      }}>
        <Box sx={{ maxWidth: 600, mx: 'auto', mb: 6.5, textAlign: 'center' }}>
          <Box sx={{
            display: 'inline-flex', alignItems: 'center', gap: 1, fontFamily: "'IBM Plex Mono', monospace",
            fontSize: 12, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#D79A1E',
            bgcolor: 'rgba(255,255,255,.1)', px: 1.75, py: 0.875, borderRadius: '20px', mb: 2.75,
          }}>
            <Box component="span" sx={{ fontSize: 8 }}>●</Box>
            Six ways to see one story
          </Box>
          <Typography sx={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: { xs: 28, md: 36 }, letterSpacing: '-0.01em', lineHeight: 1.15, color: '#fff' }}>
            Your tree, from every angle.
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,.62)', mt: 1.75, fontSize: '15.5px', lineHeight: 1.65 }}>
            Switch views depending on what you're trying to understand — structure, chronology, or geography.
          </Typography>
        </Box>
        <Grid container spacing={2}>
          {views.map((v, i) => (
            <Grid item xs={12} sm={6} md={4} key={i}>
              <Box sx={{
                bgcolor: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.12)',
                borderRadius: '16px', p: 2.75, transition: 'background .15s ease',
                '&:hover': { bgcolor: 'rgba(255,255,255,.1)' },
              }}>
                <Typography sx={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, color: '#D79A1E', letterSpacing: '0.06em' }}>
                  {v.num}
                </Typography>
                <Typography sx={{ fontFamily: "'Fraunces', serif", fontSize: 18, fontWeight: 600, mt: 1.25, mb: 0.75 }}>
                  {v.title}
                </Typography>
                <Typography sx={{ fontSize: 13, color: 'rgba(255,255,255,.55)', lineHeight: 1.55 }}>
                  {v.desc}
                </Typography>
              </Box>
            </Grid>
          ))}
        </Grid>
      </Box>

      <Box sx={{ maxWidth: 1180, mx: 'auto', px: { xs: 3, sm: 5 } }}>
        {/* ---------- Testimonial ---------- */}
        <Box sx={{ py: { xs: 6, md: 12 } }}>
          <Box sx={{
            bgcolor: '#E7EFE6', borderRadius: { xs: 0, md: '24px' }, mx: { xs: 0, md: 0 },
            px: { xs: 3, md: 7 }, py: { xs: 5, md: 8 },
            display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'auto 1fr' }, gap: { xs: 2, md: 4.5 }, alignItems: 'center',
          }}>
            <Typography sx={{ fontFamily: "'Fraunces', serif", fontSize: 80, color: '#3F6644', lineHeight: 0.6, opacity: 0.35 }}>
              "
            </Typography>
            <Box>
              <Typography sx={{ fontFamily: "'Fraunces', serif", fontSize: { xs: 20, md: 26 }, fontWeight: 500, lineHeight: 1.4, color: '#1C1410' }}>
                We found out my great-grandmother had a whole trading business in Ijebu-Ode. Nobody had written that down anywhere — until now.
              </Typography>
              <Typography sx={{ mt: 2.5, fontSize: '13.5px', color: '#5C5346', fontFamily: "'IBM Plex Mono', monospace" }}>
                — Kemi A., Lagos &amp; London
              </Typography>
            </Box>
          </Box>
        </Box>

        {/* ---------- Final CTA ---------- */}
        <Box sx={{ textAlign: 'center', py: { xs: 7, md: 11 } }}>
          <Typography sx={{ fontFamily: "'Fraunces', serif", fontWeight: 600, fontSize: { xs: 30, md: 42 }, maxWidth: 600, mx: 'auto', mb: 2, letterSpacing: '-0.01em' }}>
            Your family's history is worth more than a group chat.
          </Typography>
          <Typography sx={{ color: '#5C5346', mb: 4, fontSize: '15.5px' }}>
            Start with one person. The rest of the tree grows from there.
          </Typography>
          {!isAuthenticated && (
            <Button
              onClick={() => navigate('/register')}
              sx={{
                bgcolor: '#22345E', color: '#fff', fontWeight: 600, fontSize: 14, textTransform: 'none',
                px: 4, py: 1.875, borderRadius: '10px',
                boxShadow: '0 1px 2px rgba(34,52,94,.15), 0 8px 20px rgba(34,52,94,.18)',
                '&:hover': { bgcolor: '#22345E', transform: 'translateY(-2px)', boxShadow: '0 4px 8px rgba(34,52,94,.2), 0 14px 28px rgba(34,52,94,.24)' },
              }}
            >
              Create your family tree
            </Button>
          )}
        </Box>

        {/* ---------- Footer ---------- */}
        <Box sx={{
          borderTop: '1px solid #E7DCC8', py: 4.5, display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', fontSize: 13, color: '#8C8171', flexWrap: 'wrap', gap: 2,
        }}>
          <Typography sx={{ fontSize: 13, color: '#8C8171' }}>
            © {new Date().getFullYear()} Family Tree
          </Typography>
          <Box sx={{ display: 'flex', gap: 3 }}>
            <Typography sx={{ fontSize: 13, color: '#8C8171', cursor: 'pointer', '&:hover': { opacity: 0.7 } }}>Privacy</Typography>
            <Typography sx={{ fontSize: 13, color: '#8C8171', cursor: 'pointer', '&:hover': { opacity: 0.7 } }}>Terms</Typography>
            <Typography sx={{ fontSize: 13, color: '#8C8171', cursor: 'pointer', '&:hover': { opacity: 0.7 } }}>Contact</Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default Home;
