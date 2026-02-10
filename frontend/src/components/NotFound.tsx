import React from 'react';
import { useNavigate } from 'react-router-dom';
import { NotFoundContent } from './not-found/NotFoundContent';

export default function NotFound() {
  const navigate = useNavigate();

  return <NotFoundContent onGoHome={() => navigate('/')} />;
}
