import { PropsWithChildren } from 'react';
import { AuthProvider } from '@/contexts/AuthContext';
import './app.scss';

export default function App({ children }: PropsWithChildren) {
  return <AuthProvider>{children}</AuthProvider>;
}
