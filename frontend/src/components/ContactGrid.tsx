import React from 'react';
import { AgentCardLayoutItem, AgentPinRecommendationItem, Contact } from '../api';
import { ContactCard } from './ContactCard';
import { ContactSkeleton } from './ContactSkeleton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import PushPinIcon from '@mui/icons-material/PushPin';
import { motion } from 'framer-motion';
import { alpha, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';

interface ContactGridProps {
  contacts: Contact[] | undefined;
  onContactClick: (contact: Contact) => void;
  onCardLayoutChange?: (cards: AgentCardLayoutItem[]) => void;
  loading?: boolean;
  workspace?: string;
  pinRecommendations?: AgentPinRecommendationItem[];
  onCardAction?: (contact: Contact, action: 'summarize' | 'draft' | 'todo') => void;
  highlightContactId?: number | null;
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
  moved?: boolean;
  startX: number;
  startY: number;
  originX: number;
  originY: number;
  originWidth: number;
  originHeight: number;
  direction?: ResizeDirection;
};

type PointerSnapshot = {
  pointerId: number;
  clientX: number;
  clientY: number;
};

const STORAGE_KEY_PREFIX = 'mercurydesk:contact-card-layout:v4';
const DRAG_THRESHOLD_PX = 5;
const DRAG_CLICK_SUPPRESS_MS = 240;
const NOOP_CONTACT_CLICK = (_contact: Contact) => {};
const CARD_TOP_GUTTER = 2;
const UNPINNED_MIN_OFFSET = 8;
const LARGE_MODE_THRESHOLD = 200;

function buildStorageKey(workspace: string): string {
  const clean = (workspace || 'default').trim() || 'default';
  return `${STORAGE_KEY_PREFIX}:${clean}`;
}

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
}

function readStoredLayout(
  storageKey: string,
  baseWidth: number,
  baseHeight: number,
  minWidth: number,
  minHeight: number,
  maxWidth: number,
  maxHeight: number,
): Record<number, CardLayoutState> {
  try {
    const raw = localStorage.getItem(storageKey);
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

function writeStoredLayout(storageKey: string, layout: Record<number, CardLayoutState>) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(layout));
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

export const ContactGrid: React.FC<ContactGridProps> = ({
  contacts,
  onContactClick,
  onCardLayoutChange,
  loading,
  workspace = 'default',
  pinRecommendations,
  onCardAction,
  highlightContactId,
}) => {
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

  const storageKey = React.useMemo(() => buildStorageKey(workspace), [workspace]);
  const [layoutMap, setLayoutMap] = React.useState<Record<number, CardLayoutState>>(() =>
    readStoredLayout(storageKey, baseCardWidth, baseCardHeight, minCardWidth, minCardHeight, maxCardWidth, maxCardHeight)
  );
  const [activeCardId, setActiveCardId] = React.useState<number | null>(null);
  const [interactionMode, setInteractionMode] = React.useState<'drag' | 'resize' | null>(null);
  const [viewportRange, setViewportRange] = React.useState<{ top: number; bottom: number }>({ top: -999999, bottom: 999999 });
  const interactionRef = React.useRef<InteractionState | null>(null);
  const layoutMapRef = React.useRef<Record<number, CardLayoutState>>(layoutMap);
  const suppressClickUntilRef = React.useRef<Record<number, number>>({});
  const pendingPointerRef = React.useRef<PointerSnapshot | null>(null);
  const pointerRafRef = React.useRef<number | null>(null);
  const canvasRef = React.useRef<HTMLDivElement | null>(null);
  const canvasWidthRef = React.useRef<number>(0);
  const zRef = React.useRef<number>(500);
  const pinnedZoneMaxY = Math.max(0, pinnedZoneHeight - CARD_TOP_GUTTER);
  const unpinnedMinY = pinnedZoneHeight + UNPINNED_MIN_OFFSET;

  const clampXWithinCanvas = React.useCallback((value: number): number => {
    const maxX = canvasWidthRef.current > 0
      ? Math.max(0, canvasWidthRef.current - 12)
      : Number.POSITIVE_INFINITY;
    return Math.max(0, Math.min(maxX, value));
  }, []);

  const clampYByPinState = React.useCallback((value: number, pinned: boolean): number => {
    if (pinned) return clampNumber(value, 0, pinnedZoneMaxY, 0);
    return Math.max(unpinnedMinY, value);
  }, [pinnedZoneMaxY, unpinnedMinY]);

  React.useEffect(() => {
    layoutMapRef.current = layoutMap;
  }, [layoutMap]);

  React.useEffect(() => {
    const next = readStoredLayout(
      storageKey,
      baseCardWidth,
      baseCardHeight,
      minCardWidth,
      minCardHeight,
      maxCardWidth,
      maxCardHeight
    );
    setLayoutMap(next);
  }, [baseCardHeight, baseCardWidth, maxCardHeight, maxCardWidth, minCardHeight, minCardWidth, storageKey]);

  React.useEffect(() => {
    const element = canvasRef.current;
    if (!element) return;

    const updateWidth = () => {
      canvasWidthRef.current = element.clientWidth;
    };
    updateWidth();

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    if (!contacts || contacts.length <= LARGE_MODE_THRESHOLD) {
      setViewportRange({ top: -999999, bottom: 999999 });
      return;
    }
    let raf = 0;
    const update = () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const canvasTopGlobal = rect.top + window.scrollY;
      const viewportTopGlobal = window.scrollY;
      const viewportBottomGlobal = viewportTopGlobal + window.innerHeight;
      const buffer = 900;
      setViewportRange({
        top: viewportTopGlobal - canvasTopGlobal - buffer,
        bottom: viewportBottomGlobal - canvasTopGlobal + buffer,
      });
    };
    const onScrollLike = () => {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        update();
      });
    };
    update();
    window.addEventListener('scroll', onScrollLike, { passive: true });
    window.addEventListener('resize', onScrollLike);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      window.removeEventListener('scroll', onScrollLike);
      window.removeEventListener('resize', onScrollLike);
    };
  }, [contacts]);

  React.useEffect(() => {
    if (!contacts || contacts.length === 0) return;
    setLayoutMap((prev) => {
      const next: Record<number, CardLayoutState> = {};
      contacts.forEach((contact, index) => {
        const old = prev[contact.id];
        if (old) {
          const nextPinned = Boolean(old.pinned);
          const nextX = clampXWithinCanvas(Math.max(0, Number(old.x) || 0));
          const nextY = clampYByPinState(Math.max(0, Number(old.y) || 0), nextPinned);
          next[contact.id] = {
            x: nextX,
            y: nextY,
            width: clampNumber(old.width, minCardWidth, maxCardWidth, baseCardWidth),
            height: clampNumber(old.height, minCardHeight, maxCardHeight, baseCardHeight),
            pinned: nextPinned,
            z: Math.max(1, Number(old.z) || 1),
          };
          return;
        }

        const col = index % columns;
        const row = Math.floor(index / columns);
        next[contact.id] = {
          x: clampXWithinCanvas(20 + col * (baseCardWidth + gap)),
          y: Math.max(unpinnedMinY, pinnedZoneHeight + 24 + row * (baseCardHeight + gap)),
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
    clampXWithinCanvas,
    clampYByPinState,
    unpinnedMinY,
  ]);

  React.useEffect(() => {
    if (!contacts || contacts.length === 0) return;
    if (interactionMode !== null) return;
    writeStoredLayout(storageKey, layoutMap);
  }, [contacts, interactionMode, layoutMap, storageKey]);

  React.useEffect(() => {
    if (!contacts || contacts.length === 0 || !onCardLayoutChange) return;
    if (interactionMode !== null) return;

    const sortedForMemory = [...contacts].sort((a, b) => {
      const la = layoutMap[a.id];
      const lb = layoutMap[b.id];
      if (!la || !lb) return a.id - b.id;
      if (la.y !== lb.y) return la.y - lb.y;
      if (la.x !== lb.x) return la.x - lb.x;
      return a.id - b.id;
    });

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
    interactionMode,
    layoutMap,
    maxCardHeight,
    maxCardWidth,
    minCardHeight,
    minCardWidth,
    onCardLayoutChange,
  ]);

  const recommendedMap = React.useMemo(() => {
    const map = new Map<number, AgentPinRecommendationItem>();
    for (const item of pinRecommendations ?? []) {
      map.set(item.contact_id, item);
    }
    return map;
  }, [pinRecommendations]);

  const applyPinRecommendations = React.useCallback(() => {
    if (!pinRecommendations?.length) return;
    const top = pinRecommendations.slice(0, isMobile ? 2 : 4).map((x) => x.contact_id);
    setLayoutMap((prev) => {
      const next = { ...prev };
      let pinnedCount = 0;
      for (const cid of top) {
        const current = next[cid];
        if (!current) continue;
        const pinnedCol = pinnedCount % columns;
        const pinnedRow = Math.floor(pinnedCount / columns);
        const pinnedStepX = isMobile ? 190 : 260;
        const pinnedStepY = isMobile ? 92 : 98;
        next[cid] = {
          ...current,
          pinned: true,
          x: clampXWithinCanvas(14 + pinnedCol * pinnedStepX),
          y: clampYByPinState(10 + pinnedRow * pinnedStepY, true),
          z: ++zRef.current,
        };
        pinnedCount += 1;
      }
      return next;
    });
  }, [clampXWithinCanvas, clampYByPinState, columns, isMobile, pinRecommendations]);

  const handleTogglePin = React.useCallback(
    (contact: Contact) => {
      setLayoutMap((prev) => {
        const current = prev[contact.id] ?? {
          x: clampXWithinCanvas(20),
          y: Math.max(unpinnedMinY, pinnedZoneHeight + 24),
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
              x: clampXWithinCanvas(current.x),
              y: clampYByPinState(current.y, false),
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
            x: clampXWithinCanvas(14 + pinnedCol * pinnedStepX),
            y: clampYByPinState(10 + pinnedRow * pinnedStepY, true),
            z: ++zRef.current,
          },
        };
      });
    },
    [baseCardHeight, baseCardWidth, columns, isMobile, pinnedZoneHeight, clampXWithinCanvas, clampYByPinState, unpinnedMinY]
  );

  const startDrag = React.useCallback(
    (contactId: number, event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const state = layoutMapRef.current[contactId];
      if (!state) return;
      if ((event.target as HTMLElement)?.closest('[data-card-control="1"]')) return;

      event.currentTarget.setPointerCapture(event.pointerId);
      interactionRef.current = {
        mode: 'drag',
        id: contactId,
        pointerId: event.pointerId,
        moved: false,
        startX: event.clientX,
        startY: event.clientY,
        originX: state.x,
        originY: state.y,
        originWidth: state.width,
        originHeight: state.height,
      };
    },
    []
  );

  const startResize = React.useCallback(
    (contactId: number, direction: ResizeDirection, event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const state = layoutMapRef.current[contactId];
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
    []
  );

  const applyPointerMove = React.useCallback(
    (snapshot: PointerSnapshot) => {
      const interaction = interactionRef.current;
      if (!interaction || interaction.pointerId !== snapshot.pointerId) return;

      const dx = snapshot.clientX - interaction.startX;
      const dy = snapshot.clientY - interaction.startY;
      if (interaction.mode === 'drag' && !interaction.moved) {
        const distance = Math.hypot(dx, dy);
        if (distance < DRAG_THRESHOLD_PX) return;
        interaction.moved = true;
        setActiveCardId(interaction.id);
        setInteractionMode('drag');
      }

      setLayoutMap((prev) => {
        const current = prev[interaction.id];
        if (!current) return prev;

        if (interaction.mode === 'drag') {
          return {
            ...prev,
            [interaction.id]: {
              ...current,
              x: clampXWithinCanvas(interaction.originX + dx),
              y: clampYByPinState(interaction.originY + dy, current.pinned),
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
        const originalBottom = nextY + nextHeight;
        const originalRight = nextX + nextWidth;

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

        const clampedX = clampXWithinCanvas(nextX);
        if (west && clampedX !== nextX) {
          nextWidth = clampNumber(originalRight - clampedX, minCardWidth, maxCardWidth, nextWidth);
        }
        nextX = clampedX;

        const clampedY = clampYByPinState(nextY, current.pinned);
        if (north && clampedY !== nextY) {
          nextHeight = clampNumber(originalBottom - clampedY, minCardHeight, maxCardHeight, nextHeight);
        }
        nextY = clampedY;

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
    [maxCardHeight, maxCardWidth, minCardHeight, minCardWidth, clampXWithinCanvas, clampYByPinState]
  );

  const schedulePointerFrame = React.useCallback(() => {
    if (pointerRafRef.current !== null) return;
    pointerRafRef.current = window.requestAnimationFrame(() => {
      pointerRafRef.current = null;
      const snapshot = pendingPointerRef.current;
      if (!snapshot) return;
      applyPointerMove(snapshot);
    });
  }, [applyPointerMove]);

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const interaction = interactionRef.current;
      if (!interaction || interaction.pointerId !== event.pointerId) return;
      if (interaction.mode === 'drag' && interaction.moved) {
        event.preventDefault();
      }
      pendingPointerRef.current = {
        pointerId: event.pointerId,
        clientX: event.clientX,
        clientY: event.clientY,
      };
      schedulePointerFrame();
    },
    [schedulePointerFrame]
  );

  const finishInteraction = React.useCallback((pointerId: number | null = null) => {
    if (pointerId !== null && interactionRef.current && interactionRef.current.pointerId !== pointerId) return;
    pendingPointerRef.current = null;
    if (pointerRafRef.current !== null) {
      window.cancelAnimationFrame(pointerRafRef.current);
      pointerRafRef.current = null;
    }
    const ended = interactionRef.current;
    const shouldSuppressClick =
      (ended?.mode === 'drag' && Boolean(ended.moved)) ||
      ended?.mode === 'resize';
    if (ended && shouldSuppressClick) {
      suppressClickUntilRef.current[ended.id] = Date.now() + DRAG_CLICK_SUPPRESS_MS;
      setLayoutMap((prev) => {
        const current = prev[ended.id];
        if (!current) return prev;
        return {
          ...prev,
          [ended.id]: {
            ...current,
            z: ++zRef.current,
          },
        };
      });
    }
    interactionRef.current = null;
    setActiveCardId(null);
    setInteractionMode(null);
  }, []);

  React.useEffect(() => {
    return () => {
      if (pointerRafRef.current !== null) {
        window.cancelAnimationFrame(pointerRafRef.current);
      }
    };
  }, []);

  const handleCardClickCapture = React.useCallback((contactId: number, event: React.MouseEvent<HTMLDivElement>) => {
    const until = suppressClickUntilRef.current[contactId] || 0;
    if (Date.now() > until) return;
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const handleCardOpen = React.useCallback(
    (contact: Contact, event: React.MouseEvent<HTMLDivElement>) => {
      if ((event.target as HTMLElement)?.closest('[data-card-control="1"]')) return;
      const until = suppressClickUntilRef.current[contact.id] || 0;
      if (Date.now() <= until) return;
      onContactClick(contact);
    },
    [onContactClick]
  );

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

  const renderContacts = React.useMemo(() => {
    if (!contacts) return [];
    if (contacts.length <= LARGE_MODE_THRESHOLD) return contacts;
    return contacts.filter((contact) => {
      if (activeCardId === contact.id) return true;
      const layout = layoutMap[contact.id];
      if (!layout) return false;
      const bottom = layout.y + layout.height;
      return bottom >= viewportRange.top && layout.y <= viewportRange.bottom;
    });
  }, [activeCardId, contacts, layoutMap, viewportRange.bottom, viewportRange.top]);

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
      p={{ xs: 2, md: 4 }}
    >
      {!!pinRecommendations?.length && (
        <Box sx={{ mb: 1 }}>
          <Button size="small" variant="text" onClick={applyPinRecommendations}>
            应用置顶推荐
          </Button>
        </Box>
      )}

      <Box
        ref={canvasRef}
        sx={{
          position: 'relative',
          minHeight: canvasHeight,
          border: '1px solid',
          borderColor: 'divider',
          boxShadow:
            theme.palette.mode === 'light'
              ? '0 6px 14px rgba(20,20,19,0.06)'
              : '0 8px 18px rgba(0,0,0,0.24)',
          backgroundColor: alpha(theme.palette.background.paper, 0.98),
          overflow: 'hidden',
          borderRadius: 2.4,
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
            py: 0.95,
            borderBottom: '1px solid',
            borderColor: alpha(theme.palette.primary.main, 0.3),
            bgcolor: alpha(theme.palette.primary.main, 0.07),
            pointerEvents: 'none',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <Typography variant="overline" sx={{ fontWeight: 800, letterSpacing: '0.08em', display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
            <PushPinIcon fontSize="inherit" />
            置顶带
          </Typography>
        </Box>

        {renderContacts.map((contact) => {
          const layout = layoutMap[contact.id];
          if (!layout) return null;

          const pinned = Boolean(layout.pinned);
          const active = activeCardId === contact.id;
          const dragging = active && interactionMode === 'drag';
          const resizing = active && interactionMode === 'resize';
          const highlighted = highlightContactId != null && highlightContactId === contact.id;
          const recommendation = recommendedMap.get(contact.id);
          const tag = recommendation ? `AI推荐 ${Math.round(recommendation.score)}` : undefined;

          return (
            <Box
              key={contact.id}
              data-card-id={contact.id}
              sx={{
                '@keyframes bridgePulse': {
                  '0%, 100%': { transform: 'scale(1)' },
                  '50%': { transform: 'scale(1.012)' },
                },
                position: 'absolute',
                left: layout.x,
                top: layout.y,
                width: layout.width,
                height: layout.height,
                zIndex: active ? 9999 : layout.z,
                transition: active ? 'none' : 'box-shadow 0.2s ease, transform 0.2s ease',
                transform: dragging ? 'scale(1.006)' : 'scale(1)',
                animation: highlighted ? 'bridgePulse 940ms ease-in-out 2' : 'none',
                boxShadow: highlighted
                  ? `0 0 0 2px ${alpha(theme.palette.warning.main, 0.58)}, 0 0 0 7px ${alpha(theme.palette.warning.main, 0.16)}, 0 16px 24px ${alpha(theme.palette.text.primary, 0.14)}`
                  : active
                    ? `0 0 0 2px ${alpha(theme.palette.primary.main, 0.32)}, 0 8px 16px ${alpha(theme.palette.text.primary, 0.18)}`
                    : undefined,
                willChange: active ? 'transform, left, top, width, height' : 'auto',
                contentVisibility: active ? 'visible' : 'auto',
                containIntrinsicSize: '340px 320px',
                touchAction: 'none',
                userSelect: 'none',
              }}
              onPointerDown={(event) => startDrag(contact.id, event)}
              onPointerMove={handlePointerMove}
              onPointerUp={(event) => finishInteraction(event.pointerId)}
              onPointerCancel={(event) => finishInteraction(event.pointerId)}
              onClickCapture={(event) => handleCardClickCapture(contact.id, event)}
              onClick={(event) => handleCardOpen(contact, event)}
            >
              <ContactCard
                contact={contact}
                onClick={NOOP_CONTACT_CLICK}
                index={0}
                variant={pinned ? 'feature' : 'standard'}
                pinned={pinned}
                tag={tag}
                cardWidth={layout.width}
                cardHeight={layout.height}
                onTogglePin={handleTogglePin}
                onQuickAction={onCardAction}
              />

              {RESIZE_DIRECTIONS.map((direction) => (
                <Box
                  key={direction}
                  data-card-control="1"
                  onPointerDown={(event: React.PointerEvent<HTMLDivElement>) => startResize(contact.id, direction, event)}
                  sx={{
                    ...getHandleSx(direction),
                    cursor: handleCursor(direction),
                    bgcolor: resizing ? alpha(theme.palette.primary.main, 0.14) : 'transparent',
                    '&:hover': {
                      bgcolor: alpha(theme.palette.primary.main, 0.16),
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
