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
  width: number;
  height: number;
  pinned: boolean;
  z: number;
};

type ResizeDirection = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

type InteractionState = {
  mode: 'drag' | 'resize';
  id: number;
  pointerId: number;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  originWidth: number;
  originHeight: number;
  direction?: ResizeDirection;
};

const STORAGE_KEY = 'mercurydesk:contact-card-layout:v3';

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function readStoredLayout(
  baseWidth: number,
  baseHeight: number,
  minWidth: number,
  minHeight: number,
  maxWidth: number,
  maxHeight: number,
): Record<number, CardLayoutState> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return {};
    const out: Record<number, CardLayoutState> = {};

    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      const id = Number(key);
      if (!Number.isInteger(id) || id <= 0) continue;
      const row = value as Partial<CardLayoutState & { scale?: number }> | undefined;

      const legacyScale = clampNumber(Number(row?.scale ?? 1), 0.6, 2.6, 1);
      const width = clampNumber(Number(row?.width ?? baseWidth * legacyScale), minWidth, maxWidth, baseWidth);
      const height = clampNumber(Number(row?.height ?? baseHeight * legacyScale), minHeight, maxHeight, baseHeight);

      out[id] = {
        x: Math.max(0, Number(row?.x ?? 0) || 0),
        y: Math.max(0, Number(row?.y ?? 0) || 0),
        width,
        height,
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

function handleCursor(direction: ResizeDirection): string {
  if (direction === 'n' || direction === 's') return 'ns-resize';
  if (direction === 'e' || direction === 'w') return 'ew-resize';
  if (direction === 'ne' || direction === 'sw') return 'nesw-resize';
  return 'nwse-resize';
}

function getHandleSx(direction: ResizeDirection) {
  const common = {
    position: 'absolute' as const,
    zIndex: 6,
    borderRadius: 0,
  };

  switch (direction) {
    case 'n':
      return { ...common, top: -5, left: 10, right: 10, height: 10 };
    case 's':
      return { ...common, bottom: -5, left: 10, right: 10, height: 10 };
    case 'e':
      return { ...common, top: 10, bottom: 10, right: -5, width: 10 };
    case 'w':
      return { ...common, top: 10, bottom: 10, left: -5, width: 10 };
    case 'nw':
      return { ...common, top: -6, left: -6, width: 14, height: 14 };
    case 'ne':
      return { ...common, top: -6, right: -6, width: 14, height: 14 };
    case 'sw':
      return { ...common, bottom: -6, left: -6, width: 14, height: 14 };
    case 'se':
      return { ...common, bottom: -6, right: -6, width: 14, height: 14 };
    default:
      return common;
  }
}

const RESIZE_DIRECTIONS: ResizeDirection[] = ['n', 'e', 's', 'w', 'ne', 'nw', 'se', 'sw'];

export const ContactGrid: React.FC<ContactGridProps> = ({ contacts, onContactClick, onCardLayoutChange, loading }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const pinnedZoneHeight = isMobile ? 96 : 118;
  const baseCardWidth = isMobile ? 260 : 312;
  const baseCardHeight = isMobile ? 272 : 316;
  const minCardWidth = isMobile ? 170 : 210;
  const minCardHeight = isMobile ? 170 : 210;
  const maxCardWidth = isMobile ? 480 : 860;
  const maxCardHeight = isMobile ? 620 : 920;
  const gap = isMobile ? 14 : 18;
  const columns = isMobile ? 1 : 3;

  const [layoutMap, setLayoutMap] = React.useState<Record<number, CardLayoutState>>(() =>
    readStoredLayout(baseCardWidth, baseCardHeight, minCardWidth, minCardHeight, maxCardWidth, maxCardHeight)
  );
  const [activeCardId, setActiveCardId] = React.useState<number | null>(null);
  const [interactionMode, setInteractionMode] = React.useState<'drag' | 'resize' | null>(null);
  const interactionRef = React.useRef<InteractionState | null>(null);
  const zRef = React.useRef<number>(500);

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
            width: clampNumber(old.width, minCardWidth, maxCardWidth, baseCardWidth),
            height: clampNumber(old.height, minCardHeight, maxCardHeight, baseCardHeight),
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
          width: baseCardWidth,
          height: baseCardHeight,
          pinned: false,
          z: ++zRef.current,
        };
      });
      return next;
    });
  }, [
    baseCardHeight,
    baseCardWidth,
    columns,
    contacts,
    gap,
    maxCardHeight,
    maxCardWidth,
    minCardHeight,
    minCardWidth,
    pinnedZoneHeight,
  ]);

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
        order: index,
        x: Math.max(0, Math.round(layout?.x ?? 0)),
        y: Math.max(0, Math.round(layout?.y ?? 0)),
        width: Math.round(clampNumber(layout?.width ?? baseCardWidth, minCardWidth, maxCardWidth, baseCardWidth)),
        height: Math.round(clampNumber(layout?.height ?? baseCardHeight, minCardHeight, maxCardHeight, baseCardHeight)),
      };
    });

    onCardLayoutChange(payload);
  }, [
    baseCardHeight,
    baseCardWidth,
    contacts,
    layoutMap,
    maxCardHeight,
    maxCardWidth,
    minCardHeight,
    minCardWidth,
    onCardLayoutChange,
    sortedForMemory,
  ]);

  const handleTogglePin = React.useCallback(
    (contact: Contact) => {
      setLayoutMap((prev) => {
        const current = prev[contact.id] ?? {
          x: 20,
          y: pinnedZoneHeight + 24,
          width: baseCardWidth,
          height: baseCardHeight,
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
        const pinnedStepX = isMobile ? 190 : 260;
        const pinnedStepY = isMobile ? 92 : 98;
        const pinnedCol = pinnedCount % columns;
        const pinnedRow = Math.floor(pinnedCount / columns);

        return {
          ...prev,
          [contact.id]: {
            ...current,
            pinned: true,
            x: 14 + pinnedCol * pinnedStepX,
            y: 10 + pinnedRow * pinnedStepY,
            z: ++zRef.current,
          },
        };
      });
    },
    [baseCardHeight, baseCardWidth, columns, isMobile, pinnedZoneHeight]
  );

  const startDrag = React.useCallback(
    (contactId: number, event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const state = layoutMap[contactId];
      if (!state) return;
      if ((event.target as HTMLElement)?.closest('[data-card-control="1"]')) return;

      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      interactionRef.current = {
        mode: 'drag',
        id: contactId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: state.x,
        originY: state.y,
        originWidth: state.width,
        originHeight: state.height,
      };

      setActiveCardId(contactId);
      setInteractionMode('drag');
      setLayoutMap((prev) => ({
        ...prev,
        [contactId]: {
          ...prev[contactId],
          z: ++zRef.current,
        },
      }));
    },
    [layoutMap]
  );

  const startResize = React.useCallback(
    (contactId: number, direction: ResizeDirection, event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const state = layoutMap[contactId];
      if (!state) return;

      event.preventDefault();
      event.stopPropagation();

      const card = (event.currentTarget.closest('[data-card-id]') as HTMLDivElement | null) || null;
      card?.setPointerCapture(event.pointerId);

      interactionRef.current = {
        mode: 'resize',
        id: contactId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        originX: state.x,
        originY: state.y,
        originWidth: state.width,
        originHeight: state.height,
        direction,
      };

      setActiveCardId(contactId);
      setInteractionMode('resize');
      setLayoutMap((prev) => ({
        ...prev,
        [contactId]: {
          ...prev[contactId],
          z: ++zRef.current,
        },
      }));
    },
    [layoutMap]
  );

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const interaction = interactionRef.current;
      if (!interaction || interaction.pointerId !== event.pointerId) return;

      const dx = event.clientX - interaction.startX;
      const dy = event.clientY - interaction.startY;

      setLayoutMap((prev) => {
        const current = prev[interaction.id];
        if (!current) return prev;

        if (interaction.mode === 'drag') {
          return {
            ...prev,
            [interaction.id]: {
              ...current,
              x: Math.max(0, interaction.originX + dx),
              y: Math.max(0, interaction.originY + dy),
            },
          };
        }

        const direction = interaction.direction || 'se';
        const east = direction.includes('e');
        const west = direction.includes('w');
        const north = direction.includes('n');
        const south = direction.includes('s');

        let nextX = interaction.originX;
        let nextY = interaction.originY;
        let nextWidth = interaction.originWidth;
        let nextHeight = interaction.originHeight;

        if (east) {
          nextWidth = clampNumber(interaction.originWidth + dx, minCardWidth, maxCardWidth, interaction.originWidth);
        }
        if (south) {
          nextHeight = clampNumber(interaction.originHeight + dy, minCardHeight, maxCardHeight, interaction.originHeight);
        }
        if (west) {
          const widthFromLeft = clampNumber(interaction.originWidth - dx, minCardWidth, maxCardWidth, interaction.originWidth);
          nextX = interaction.originX + (interaction.originWidth - widthFromLeft);
          nextWidth = widthFromLeft;
        }
        if (north) {
          const heightFromTop = clampNumber(interaction.originHeight - dy, minCardHeight, maxCardHeight, interaction.originHeight);
          nextY = interaction.originY + (interaction.originHeight - heightFromTop);
          nextHeight = heightFromTop;
        }

        if (nextX < 0) {
          const overshoot = -nextX;
          nextX = 0;
          if (west) {
            nextWidth = clampNumber(nextWidth - overshoot, minCardWidth, maxCardWidth, nextWidth);
          }
        }
        if (nextY < 0) {
          const overshoot = -nextY;
          nextY = 0;
          if (north) {
            nextHeight = clampNumber(nextHeight - overshoot, minCardHeight, maxCardHeight, nextHeight);
          }
        }

        return {
          ...prev,
          [interaction.id]: {
            ...current,
            x: nextX,
            y: nextY,
            width: nextWidth,
            height: nextHeight,
          },
        };
      });
    },
    [maxCardHeight, maxCardWidth, minCardHeight, minCardWidth]
  );

  const finishInteraction = React.useCallback((pointerId: number | null = null) => {
    if (pointerId !== null && interactionRef.current && interactionRef.current.pointerId !== pointerId) return;
    interactionRef.current = null;
    setActiveCardId(null);
    setInteractionMode(null);
  }, []);

  const canvasHeight = React.useMemo(() => {
    if (!contacts || contacts.length === 0) return 580;
    let maxBottom = pinnedZoneHeight + 120;
    contacts.forEach((contact) => {
      const layout = layoutMap[contact.id];
      if (!layout) return;
      const bottom = layout.y + layout.height;
      if (bottom > maxBottom) maxBottom = bottom;
    });
    return Math.max(580, Math.ceil(maxBottom + 90));
  }, [contacts, layoutMap, pinnedZoneHeight]);

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
          连接账号后，这里会变成可拖放与边框缩放的卡片画板。
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
          画板模式: 自由拖放卡片，直接拖拽边框调整矩形尺寸，左上角坐标决定序数。置顶卡片会吸附到顶部置顶带。
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

          const pinned = Boolean(layout.pinned);
          const active = activeCardId === contact.id;
          const dragging = active && interactionMode === 'drag';
          const resizing = active && interactionMode === 'resize';

          return (
            <Box
              key={contact.id}
              data-card-id={contact.id}
              sx={{
                position: 'absolute',
                left: layout.x,
                top: layout.y,
                width: layout.width,
                height: layout.height,
                zIndex: active ? 9999 : layout.z,
                transition: active ? 'none' : 'box-shadow 0.2s ease, transform 0.2s ease',
                transform: dragging ? 'scale(1.01)' : 'scale(1)',
                boxShadow: active
                  ? `0 0 0 2px ${theme.palette.primary.main}, 0 10px 26px ${alpha(theme.palette.text.primary, 0.35)}`
                  : undefined,
                touchAction: 'none',
                userSelect: 'none',
              }}
              onPointerDown={(event) => startDrag(contact.id, event)}
              onPointerMove={handlePointerMove}
              onPointerUp={(event) => finishInteraction(event.pointerId)}
              onPointerCancel={(event) => finishInteraction(event.pointerId)}
            >
              <ContactCard
                contact={contact}
                onClick={onContactClick}
                index={0}
                variant={pinned ? 'feature' : 'standard'}
                pinned={pinned}
                cardWidth={layout.width}
                cardHeight={layout.height}
                onTogglePin={handleTogglePin}
              />

              {RESIZE_DIRECTIONS.map((direction) => (
                <Box
                  key={direction}
                  data-card-control="1"
                  onPointerDown={(event: React.PointerEvent<HTMLDivElement>) => startResize(contact.id, direction, event)}
                  sx={{
                    ...getHandleSx(direction),
                    cursor: handleCursor(direction),
                    bgcolor: resizing ? alpha(theme.palette.primary.main, 0.22) : 'transparent',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.25),
                    },
                  }}
                />
              ))}
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};
