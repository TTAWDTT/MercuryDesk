import React from 'react';
import { Contact, AgentCardLayoutItem } from '../api';
import { ContactCard } from './ContactCard';
import { ContactSkeleton } from './ContactSkeleton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { motion } from 'framer-motion';
import PushPinIcon from '@mui/icons-material/PushPin';

interface ContactGridProps {
  contacts: Contact[] | undefined;
  onContactClick: (contact: Contact) => void;
  onCardLayoutChange?: (cards: AgentCardLayoutItem[]) => void;
  loading?: boolean;
}

type CardLayoutState = {
  order: number;
  pinned: boolean;
  scale: number;
};

const STORAGE_KEY = 'mercurydesk:contact-card-layout:v1';

function clampScale(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(0.8, Math.min(1.5, Number(value)));
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
        order: Math.max(0, Number(row?.order ?? 0) || 0),
        pinned: Boolean(row?.pinned),
        scale: clampScale(Number(row?.scale ?? 1)),
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

function byLayout(a: Contact, b: Contact, map: Record<number, CardLayoutState>, fallback: Map<number, number>) {
  const la = map[a.id];
  const lb = map[b.id];
  const pinnedA = Boolean(la?.pinned);
  const pinnedB = Boolean(lb?.pinned);
  if (pinnedA !== pinnedB) return pinnedA ? -1 : 1;

  const orderA = Number.isFinite(la?.order) ? (la?.order as number) : (fallback.get(a.id) ?? 0);
  const orderB = Number.isFinite(lb?.order) ? (lb?.order as number) : (fallback.get(b.id) ?? 0);
  if (orderA !== orderB) return orderA - orderB;

  const fallbackA = fallback.get(a.id) ?? 0;
  const fallbackB = fallback.get(b.id) ?? 0;
  return fallbackA - fallbackB;
}

export const ContactGrid: React.FC<ContactGridProps> = ({ contacts, onContactClick, onCardLayoutChange, loading }) => {
  const [layoutMap, setLayoutMap] = React.useState<Record<number, CardLayoutState>>(() => readStoredLayout());
  const [draggingId, setDraggingId] = React.useState<number | null>(null);
  const [dragOverId, setDragOverId] = React.useState<number | null>(null);

  const layoutForIndex = (index: number) => {
    if (index === 0) {
      return {
        gridColumn: { xs: '1 / -1', sm: '1 / -1', md: 'span 12', lg: 'span 8' },
      };
    }
    if (index === 1) {
      return {
        gridColumn: { xs: '1 / -1', sm: 'span 1', md: 'span 6', lg: 'span 4' },
      };
    }
    if (index === 5 || index === 6) {
      return {
        gridColumn: { xs: '1 / -1', sm: '1 / -1', md: 'span 12', lg: 'span 6' },
      };
    }
    return {
      gridColumn: { xs: '1 / -1', sm: 'span 1', md: 'span 6', lg: 'span 4' },
    };
  };

  React.useEffect(() => {
    if (!contacts || contacts.length === 0) return;
    setLayoutMap((prev) => {
      const next: Record<number, CardLayoutState> = {};
      contacts.forEach((contact, index) => {
        const current = prev[contact.id];
        next[contact.id] = {
          order: Math.max(0, Number(current?.order ?? index) || 0),
          pinned: Boolean(current?.pinned),
          scale: clampScale(Number(current?.scale ?? 1)),
        };
      });
      return next;
    });
  }, [contacts]);

  const fallbackOrderMap = React.useMemo(() => {
    const map = new Map<number, number>();
    (contacts ?? []).forEach((contact, index) => map.set(contact.id, index));
    return map;
  }, [contacts]);

  const orderedContacts = React.useMemo(() => {
    if (!contacts) return [];
    const cloned = [...contacts];
    cloned.sort((a, b) => byLayout(a, b, layoutMap, fallbackOrderMap));
    return cloned;
  }, [contacts, fallbackOrderMap, layoutMap]);

  React.useEffect(() => {
    if (!contacts || contacts.length === 0) return;
    writeStoredLayout(layoutMap);
    if (!onCardLayoutChange) return;
    const payload: AgentCardLayoutItem[] = orderedContacts.map((contact, index) => ({
      contact_id: contact.id,
      display_name: contact.display_name || contact.handle || `contact-${contact.id}`,
      pinned: Boolean(layoutMap[contact.id]?.pinned),
      scale: clampScale(Number(layoutMap[contact.id]?.scale ?? 1)),
      order: index,
    }));
    onCardLayoutChange(payload);
  }, [contacts, layoutMap, onCardLayoutChange, orderedContacts]);

  const updateScale = React.useCallback((contact: Contact, nextScale: number) => {
    setLayoutMap((prev) => ({
      ...prev,
      [contact.id]: {
        order: prev[contact.id]?.order ?? 0,
        pinned: Boolean(prev[contact.id]?.pinned),
        scale: clampScale(nextScale),
      },
    }));
  }, []);

  const togglePin = React.useCallback((contact: Contact) => {
    setLayoutMap((prev) => {
      const current = prev[contact.id] ?? { order: 0, pinned: false, scale: 1 };
      const nextPinned = !current.pinned;
      const orders = Object.values(prev).map((item) => item.order);
      const minOrder = orders.length ? Math.min(...orders) : 0;
      const maxOrder = orders.length ? Math.max(...orders) : 0;
      return {
        ...prev,
        [contact.id]: {
          order: nextPinned ? minOrder - 1 : maxOrder + 1,
          pinned: nextPinned,
          scale: clampScale(current.scale),
        },
      };
    });
  }, []);

  const reorder = React.useCallback((fromId: number, toId: number) => {
    if (fromId === toId) return;
    setLayoutMap((prev) => {
      const ids = orderedContacts.map((contact) => contact.id);
      const fromIndex = ids.indexOf(fromId);
      const toIndex = ids.indexOf(toId);
      if (fromIndex < 0 || toIndex < 0) return prev;
      ids.splice(toIndex, 0, ids.splice(fromIndex, 1)[0]);
      const next: Record<number, CardLayoutState> = { ...prev };
      ids.forEach((id, index) => {
        const cur = next[id] ?? { pinned: false, scale: 1, order: index };
        next[id] = {
          pinned: Boolean(cur.pinned),
          scale: clampScale(cur.scale),
          order: index,
        };
      });
      return next;
    });
  }, [orderedContacts]);

  if (loading || !contacts) {
    return (
      <Box p={{ xs: 2, md: 5 }}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(12, minmax(0, 1fr))',
            },
            gap: { xs: 2, md: 3 },
            alignItems: 'start',
          }}
        >
          {Array.from({ length: 8 }).map((_, i) => (
            <Box key={i} sx={layoutForIndex(i)}>
              <ContactSkeleton variant={i === 0 ? 'feature' : 'standard'} />
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  if (contacts.length === 0) {
    const now = new Date();
    const sampleContacts: Contact[] = [
      {
        id: -1,
        display_name: 'MercuryDesk 编辑台',
        handle: 'editorial@mercurydesk',
        avatar_url: null,
        last_message_at: now.toISOString(),
        unread_count: 0,
        latest_subject: '欢迎来到「按发信人聚合」收件箱',
        latest_preview:
          '连接你的真实邮箱后即可同步邮件。这张卡片是样例，用来展示“重点发信人（大卡）”在杂志式布局中的效果。',
        latest_source: 'email',
        latest_received_at: now.toISOString(),
      },
      {
        id: -2,
        display_name: 'octocat',
        handle: 'octocat@github',
        avatar_url: null,
        last_message_at: new Date(now.getTime() - 1000 * 60 * 42).toISOString(),
        unread_count: 0,
        latest_subject: '请求你 Review：优化主面板交互',
        latest_preview:
          '这是一张“标准卡片”样例——信息更密但依然清晰。你也可以连接 GitHub 来同步真实通知。',
        latest_source: 'github',
        latest_received_at: new Date(now.getTime() - 1000 * 60 * 42).toISOString(),
      },
    ];

    return (
      <Box
        component={motion.div}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        p={{ xs: 2, md: 5 }}
      >
        <Box sx={{ mb: { xs: 2.5, md: 3 } }}>
          <Typography variant="overline" sx={{ letterSpacing: '0.22em', opacity: 0.75 }}>
            样例布局
          </Typography>
          <Typography variant="h4" fontWeight={900} sx={{ letterSpacing: '-0.03em', mt: 0.5 }}>
            你的收件箱还没有内容。
          </Typography>
          <Typography variant="body1" color="textSecondary" sx={{ maxWidth: 760, mt: 1.25 }}>
            点击顶部 <b>同步</b> 拉取演示消息，或先到设置里连接真实邮箱/GitHub。现在支持拖拽排序、置顶与缩放卡片。
          </Typography>
        </Box>

        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: '1fr',
              sm: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(12, minmax(0, 1fr))',
            },
            gap: { xs: 2, md: 3 },
            gridAutoFlow: { md: 'row dense' },
            alignItems: 'start',
          }}
        >
          {sampleContacts.map((contact, index) => (
            <Box key={contact.id} sx={layoutForIndex(index)}>
              <ContactCard
                contact={contact}
                onClick={() => {}}
                index={index}
                variant={index === 0 ? 'feature' : 'standard'}
                disabled
                tag="样例"
              />
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      p={{ xs: 2, md: 5 }}
    >
      <Box sx={{ mb: 1.5, display: 'flex', alignItems: 'center', gap: 1 }}>
        <PushPinIcon fontSize="small" />
        <Typography variant="caption" color="text.secondary">
          支持拖拽排序、置顶、缩放。你的布局偏好会同步到 Agent 记忆。
        </Typography>
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: '1fr',
            sm: 'repeat(2, minmax(0, 1fr))',
            md: 'repeat(12, minmax(0, 1fr))',
          },
          gap: { xs: 2, md: 3 },
          gridAutoFlow: { md: 'row dense' },
          alignItems: 'start',
        }}
      >
        {orderedContacts.map((contact, index) => {
          const id = contact.id;
          const pinned = Boolean(layoutMap[id]?.pinned);
          const scale = clampScale(Number(layoutMap[id]?.scale ?? 1));
          const isDragging = draggingId === id;
          const isDragOver = dragOverId === id && draggingId !== null && draggingId !== id;
          return (
            <Box
              key={id}
              sx={{
                ...layoutForIndex(index),
                opacity: isDragging ? 0.35 : 1,
                outline: isDragOver ? '2px dashed' : 'none',
                outlineColor: isDragOver ? 'primary.main' : 'transparent',
                outlineOffset: 4,
              }}
              draggable
              onDragStart={() => {
                setDraggingId(id);
              }}
              onDragEnd={() => {
                setDraggingId(null);
                setDragOverId(null);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                setDragOverId(id);
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (draggingId !== null) reorder(draggingId, id);
                setDraggingId(null);
                setDragOverId(null);
              }}
            >
              <ContactCard
                contact={contact}
                onClick={onContactClick}
                index={index}
                variant={index === 0 ? 'feature' : 'standard'}
                pinned={pinned}
                scale={scale}
                onTogglePin={togglePin}
                onScaleChange={updateScale}
              />
            </Box>
          );
        })}
      </Box>
    </Box>
  );
};

