import React from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { AgentTodoItem } from '../../api';

type AgentTodoPanelProps = {
  todos: AgentTodoItem[];
  todoInput: string;
  todoBusy: boolean;
  onTodoInputChange: (value: string) => void;
  onCreateTodo: () => void;
  onToggleTodoDone: (todo: AgentTodoItem, done: boolean) => void;
  onDeleteTodo: (todoId: number) => void;
  onOpenContact: (contactId?: number | null) => void;
};

export function AgentTodoPanel({
  todos,
  todoInput,
  todoBusy,
  onTodoInputChange,
  onCreateTodo,
  onToggleTodoDone,
  onDeleteTodo,
  onOpenContact,
}: AgentTodoPanelProps) {
  const highCount = todos.filter((item) => item.priority === 'high').length;
  const withContactCount = todos.filter((item) => !!item.contact_id).length;

  return (
    <Box>
      <Typography variant="h6" sx={{ fontWeight: 700 }}>
        待办跟进
      </Typography>
      <Stack direction="row" spacing={0.8} flexWrap="wrap" useFlexGap sx={{ mt: 0.8 }}>
        <Chip size="small" label={`总计 ${todos.length}`} />
        <Chip size="small" variant="outlined" label={`高优先 ${highCount}`} />
        <Chip size="small" variant="outlined" label={`关联联系人 ${withContactCount}`} />
      </Stack>
      <Stack direction="row" spacing={1} sx={{ mt: 1.2 }}>
        <TextField
          size="small"
          fullWidth
          placeholder="新增待办（例如：周五前回复小红书合作）"
          value={todoInput}
          onChange={(event) => onTodoInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              onCreateTodo();
            }
          }}
        />
        <Button variant="contained" disabled={todoBusy} onClick={onCreateTodo}>
          添加
        </Button>
      </Stack>

      <Box sx={{ mt: 1.4, display: 'grid', gap: 0.8 }}>
        {todos.slice(0, 20).map((todo) => (
          <Paper
            key={todo.id}
            variant="outlined"
            sx={{
              p: 0.9,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Checkbox
              size="small"
              checked={todo.done}
              onChange={(event) => onToggleTodoDone(todo, event.target.checked)}
            />
            <Box sx={{ minWidth: 0, flex: 1 }}>
              <Typography
                variant="body2"
                sx={{
                  fontWeight: 700,
                  textDecoration: todo.done ? 'line-through' : 'none',
                }}
              >
                {todo.title}
              </Typography>
              <Typography variant="caption" color="text.secondary" noWrap>
                {(todo.detail || '无详情').replace(/\s+/g, ' ').trim()}
              </Typography>
            </Box>
            <Chip
              size="small"
              label={todo.priority || 'normal'}
              color={todo.priority === 'high' ? 'warning' : 'default'}
            />
            {todo.contact_id ? (
              <IconButton size="small" onClick={() => onOpenContact(todo.contact_id)} title="打开联系人">
                <OpenInNewIcon fontSize="inherit" />
              </IconButton>
            ) : null}
            <IconButton size="small" onClick={() => onDeleteTodo(todo.id)} title="删除待办">
              <DeleteOutlineIcon fontSize="inherit" />
            </IconButton>
          </Paper>
        ))}
        {todos.length === 0 && (
          <Typography variant="body2" color="text.secondary">
            目前没有待办项。
          </Typography>
        )}
      </Box>
    </Box>
  );
}
