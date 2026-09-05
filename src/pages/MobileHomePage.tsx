import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { MobileApp } from '@/components/common/MobileApp';

export default function MobileHomePage() {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  const handleLogout = async () => {
    await signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <MobileApp onLogout={handleLogout} />
    </div>
  );
}
