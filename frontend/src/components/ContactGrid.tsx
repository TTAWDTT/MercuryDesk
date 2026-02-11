import React from 'react';
import { AgentCardLayoutItem, Contact } from '../api';
import { ContactCard } from './ContactCard';
import { ContactSkeleton } from './ContactSkeleton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { motion } from 'framer-motion';
import { alpha, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

interface ContactGridProps {
  contacts: Contact[] | undefined;
  onContactClick: (contact: Contact) => void;
  onCardLayoutChange?: (cards: AgentCardLayoutItem[]) => void;
  loading?: boolean;
}

type CardLayoutState = {
  x: number;
  y: number;
  scale: number;
  pinned: boolean;
  z: number;
};

type DraggingState = {
  id: number;
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
};

const STORAGE_KEY = 'mercurydesk:contact-card-layout:v2';

function clampScale(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0.8, Math.min(1.5, Number(value)));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function readStoredLayout(): Record<number, CardLayoutState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<number, CardLayoutState> = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const id = Number(key);
      if (!Number.isInteger(id) || id <= 0) continue;
      const row = value as Partial<CardLayoutState> | undefined;
      out[id] = {
        x: Math.max(0, Number(row?.x ?? 0) || 0),
        y: Math.max(0, Number(row?.y ?? 0) || 0),
        scale: clampScale(Number(row?.scale ?? 1)),
        pinned: Boolean(row?.pinned),
        z: Math.max(1, Number(row?.z ?? 1) || 1),
      };
    }
    return out;
  } catch {
    return {};
  }
}

function writeStoredLayout(layout: Record<number, CardLayoutState>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
  } catch {
    // Ignore storage failures.
  }
}

export const ContactGrid: React.FC<ContactGridProps> = ({ contacts, onContactClick, onCardLayoutChange, loading }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const pinnedZoneHeight = isMobile ? 96 : 118;
  const baseCardWidth = isMobile ? 260 : 312;
  const baseCardHeight = isMobile ? 272 : 316;
  const gap = isMobile ? 14 : 18;
  const columns = isMobile ? 1 : 3;

  const [layoutMap, setLayoutMap] = React.useState<Record<number, CardLayoutState>>(() => readStoredLayout());
  const [draggingId, setDraggingId] = React.useState<number | null>(null);
  const draggingRef = React.useRef<DraggingState | null>(null);
  const zRef = React.useRef<number>(400);

  React.useEffect(() => {
    if (!contacts || contacts.length === 0) return;
    setLayoutMap((prev) => {
      const next: Record<number, CardLayoutState> = {};
      contacts.forEach((contact, index) => {
        const old = prev[contact.id];
        if (old) {
          next[contact.id] = {
            x: Math.max(0, Number(old.x) || 0),
            y: Math.max(0, Number(old.y) || 0),
            scale: clampScale(old.scale),
            pinned: Boolean(old.pinned),
            z: Math.max(1, Number(old.z) || 1),
          };
          return;
        }

        const col = index % columns;
        const row = Math.floor(index / columns);
        next[contact.id] = {
          x: 20 + col * (baseCardWidth + gap),
          y: pinnedZoneHeight + 24 + row * (baseCardHeight + gap),
          scale: 1,
          pinned: false,
          z: ++zRef.current,
        };
      });
      return next;
    });
  }, [baseCardHeight, baseCardWidth, columns, contacts, gap, pinnedZoneHeight]);

  React.useEffect(() => {
    if (!contacts || contacts.length === 0) return;
    writeStoredLayout(layoutMap);
  }, [contacts, layoutMap]);

  const sortedForMemory = React.useMemo(() => {
    if (!contacts) return [];
    return [...contacts].sort((a, b) => {
      const la = layoutMap[a.id];
      const lb = layoutMap[b.id];
      if (!la || !lb) return a.id - b.id;
      // 序数按左上角位置确定。
      if (la.y !== lb.y) return la.y - lb.y;
      if (la.x !== lb.x) return la.x - lb.x;
      return a.id - b.id;
    });
  }, [contacts, layoutMap]);

  React.useEffect(() => {
    if (!contacts || contacts.length === 0 || !onCardLayoutChange) return;
    const payload: AgentCardLayoutItem[] = sortedForMemory.map((contact, index) => {
      const layout = layoutMap[contact.id];
      return {
        contact_id: contact.id,
        display_name: contact.display_name || contact.handle || `contact-${contact.id}`,
        pinned: Boolean(layout?.pinned),
        scale: clampScale(layout?.scale ?? 1),
        order: index,
        x: Math.max(0, Math.round(layout?.x ?? 0)),
        y: Math.max(0, Math.round(layout?.y ?? 0)),
      };
    });
    onCardLayoutChange(payload);
  }, [contacts, layoutMap, onCardLayoutChange, sortedForMemory]);

  const handleTogglePin = React.useCallback((contact: Contact) => {
    setLayoutMap((prev) => {
      const current = prev[contact.id] ?? {
        x: 20,
        y: pinnedZoneHeight + 24,
        scale: 1,
        pinned: false,
        z: ++zRef.current,
      };
      const toPinned = !current.pinned;
      if (!toPinned) {
        return {
          ...prev,
          [contact.id]: {
            ...current,
            pinned: false,
            y: current.y < pinnedZoneHeight ? pinnedZoneHeight + 24 : current.y,
            z: ++zRef.current,
          },
        };
      }

      const pinnedCount = Object.values(prev).filter((x) => x.pinned && x !== current).length;
      const pinnedCol = pinnedCount % columns;
      const pinnedRow = Math.floor(pinnedCount / columns);
      return {
        ...prev,
        [contact.id]: {
          ...current,
          pinned: true,
          x: 16 + pinnedCol * (baseCardWidth * 0.86),
          y: 12 + pinnedRow * Math.max(74, baseCardHeight * 0.32),
          z: ++zRef.current,
        },
      };
    });
  }, [baseCardHeight, baseCardWidth, columns, pinnedZoneHeight]);

  const handleScaleChange = React.useCallback((contact: Contact, nextScale: number) => {
    setLayoutMap((prev) => {
      const current = prev[contact.id];
      if (!current) return prev;
      return {
        ...prev,
        [contact.id]: {
          ...current,
          scale: round2(clampScale(nextScale)),
          z: ++zRef.current,
        },
      };
    });
  }, []);

  const handlePointerDown = React.useCallback(
    (contactId: number, event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const state = layoutMap[contactId];
      if (!state) return;

      if ((event.target as HTMLElement)?.closest('[data-card-control="1"]')) return;

      event.preventDefault();
      (event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
      draggingRef.current = {
        id: contactId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: state.x,
        originY: state.y,
      };
      setDraggingId(contactId);
      setLayoutMap((prev) => ({
        ...prev,
        [contactId]: {
          ...prev[contactId],
          z: ++zRef.current,
        },
      }));
    },
    [layoutMap],
  );

  const handlePointerMove = React.useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    const drag = draggingRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = event.clientX - drag.startX;
    const dy = event.clientY - drag.startY;
    setLayoutMap((prev) => {
      const current = prev[drag.id];
      if (!current) return prev;
      return {
        ...prev,
        [drag.id]: {
          ...current,
          x: Math.max(0, drag.originX + dx),
          y: Math.max(0, drag.originY + dy),
        },
      };
    });
  }, []);

  const finishDrag = React.useCallback((pointerId: number | null = null) => {
    if (pointerId !== null && draggingRef.current && draggingRef.current.pointerId !== pointerId) return;
    draggingRef.current = null;
    setDraggingId(null);
  }, []);

  const canvasHeight = React.useMemo(() => {
    if (!contacts || contacts.length === 0) return 580;
    let maxBottom = pinnedZoneHeight + 120;
    contacts.forEach((contact) => {
      const layout = layoutMap[contact.id];
      if (!layout) return;
      const h = baseCardHeight * clampScale(layout.scale);
      const bottom = layout.y + h;
      if (bottom > maxBottom) maxBottom = bottom;
    });
    return Math.max(580, Math.ceil(maxBottom + 90));
  }, [baseCardHeight, contacts, layoutMap, pinnedZoneHeight]);

  if (loading || !contacts) {
    return (
      <Box p={{ xs: 2, md: 5 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(3, minmax(0, 1fr))',
            },
            gap: { xs: 2, md: 3 },
            alignItems: 'start',
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <ContactSkeleton key={i} variant={i === 0 ? 'feature' : 'standard'} />
          ))}
        </Box>
      </Box>
    );
  }

  if (contacts.length === 0) {
    return (
      <Box p={{ xs: 2, md: 5 }}>
        <Typography variant="h5" fontWeight={900}>
          你的收件箱还没有内容。
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          连接账号后，这里会变成可拖放与缩放的卡片画板。
        </Typography>
      </Box>
    );
  }

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.45 }}
      p={{ xs: 2, md: 5 }}
    >
      <Box sx={{ mb: 1.5 }}>
        <Typography variant="caption" color="text.secondary">
          画板模式: 拖动卡片到任意位置，左上角坐标决定序数。置顶卡片会吸附到顶部置顶带。
        </Typography>
      </Box>

      <Box
        sx={{
          position: 'relative',
          minHeight: canvasHeight,
          border: '2px solid',
          borderColor: 'divider',
          boxShadow: `4px 4px 0 0 ${theme.palette.text.primary}`,
          backgroundColor: alpha(theme.palette.background.paper, 0.86),
          backgroundImage: `
            linear-gradient(${alpha(theme.palette.text.primary, 0.06)} 1px, transparent 1px),
            linear-gradient(90deg, ${alpha(theme.palette.text.primary, 0.06)} 1px, transparent 1px)
          `,
          backgroundSize: `${isMobile ? 18 : 24}px ${isMobile ? 18 : 24}px`,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            position: 'absolute',
            left: 0,
            top: 0,
            right: 0,
            height: pinnedZoneHeight,
            px: 2,
            py: 1,
            borderBottom: '2px dashed',
            borderColor: alpha(theme.palette.primary.main, 0.5),
            bgcolor: alpha(theme.palette.primary.main, 0.08),
            pointerEvents: 'none',
          }}
        >
          <Typography variant="overline" sx={{ fontWeight: 900, letterSpacing: '0.1em' }}>
            置顶带
          </Typography>
        </Box>

        {contacts.map((contact) => {
          const layout = layoutMap[contact.id];
          if (!layout) return null;
          const scale = clampScale(layout.scale);
          const width = baseCardWidth * scale;
          const height = baseCardHeight * scale;
          const pinned = Boolean(layout.pinned);
          const dragging = draggingId === contact.id;

          return (
            <Box
              key={contact.id}
              sx={{
                position: 'absolute',
                left: layout.x,
                top: layout.y,
                width,
                height,
                zIndex: dragging ? 9999 : layout.z,
                transition: dragging ? 'none' : 'box-shadow 0.2s ease, transform 0.2s ease',
                transform: dragging ? 'scale(1.015)' : 'scale(1)',
                boxShadow: dragging
                  ? `0 0 0 2px ${theme.palette.primary.main}, 0 10px 26px ${alpha(theme.palette.text.primary, 0.35)}`
                  : undefined,
              }}
              onPointerDown={(event) => handlePointerDown(contact.id, event)}
              onPointerMove={handlePointerMove}
              onPointerUp={(event) => finishDrag(event.pointerId)}
              onPointerCancel={(event) => finishDrag(event.pointerId)}
            >
              <ContactCard
                contact={contact}
                onClick={onContactClick}
                index={0}
                variant={pinned ? 'feature' : 'standard'}
                pinned={pinned}
                scale={scale}
                onTogglePin={handleTogglePin}
                onScaleChange={handleScaleChange}
              />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

