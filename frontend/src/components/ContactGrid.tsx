import React from 'react';
import { Contact } from '../api';
import { ContactCard } from './ContactCard';
import { ContactSkeleton } from './ContactSkeleton';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import { motion } from 'framer-motion';

interface ContactGridProps {
  contacts: Contact[] | undefined;
  onContactClick: (contact: Contact) => void;
  loading?: boolean;
}

export const ContactGrid: React.FC<ContactGridProps> = ({ contacts, onContactClick, loading }) => {
  const layoutForIndex = (index: number) => {
    // Editorial / magazine-like grid rhythm.
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
          <Typography
            variant="overline"
            sx={{ letterSpacing: '0.22em', opacity: 0.75 }}
          >
            样例布局
          </Typography>
          <Typography
            variant="h4"
            fontWeight={900}
            sx={{ letterSpacing: '-0.03em', mt: 0.5 }}
          >
            你的收件箱还没有内容。
          </Typography>
          <Typography
            variant="body1"
            color="textSecondary"
            sx={{ maxWidth: 760, mt: 1.25 }}
          >
            点击顶部 <b>同步</b> 拉取演示消息，或先到设置里连接真实邮箱/GitHub。
            下面两张样例卡片用来预览“杂志式”排布效果。
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
          {contacts.map((contact, index) => (
            <Box key={contact.id} sx={layoutForIndex(index)}>
              <ContactCard
                contact={contact}
                onClick={onContactClick}
                index={index}
                variant={index === 0 ? 'feature' : 'standard'}
              />
            </Box>
          ))}
        </Box>
    </Box>
  );
};
