import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

/**
 * Handles Supabase OAuth and magic-link callback redirects.
 * Must be mounted at /auth/callback so Supabase can exchange
 * the auth code for a session.
 */
export default function AuthCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState('Processing authentication…');

  useEffect(() => {
    const handleCallback = async () => {
      try {
        const url = new URL(window.location.href);
        const authCode = url.searchParams.get('code');

        if (authCode) {
          const { data: exchangeData, error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(authCode);

          if (exchangeError) {
            throw exchangeError;
          }

          if (exchangeData.session) {
            toast.success('Signed in successfully!');
            navigate('/dashboard', { replace: true });
            return;
          }
        }

        // Supabase JS client automatically parses the URL hash/query
        // when detectSessionInUrl is true. We just need to ensure
        // the session is established before redirecting.
        const { data, error } = await supabase.auth.getSession();

        if (error) {
          throw error;
        }

        if (data.session) {
          toast.success('Signed in successfully!');
          navigate('/dashboard', { replace: true });
        } else {
          // No session found — might be a direct visit without auth params
          setStatus('No active session found. Redirecting to login…');
          setTimeout(() => navigate('/login', { replace: true }), 1500);
        }
      } catch (err: any) {
        toast.error(err.message || 'Authentication failed.');
        navigate('/login', { replace: true });
      }
    };

    handleCallback();
  }, [navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background text-on-surface">
      <div className="flex flex-col items-center gap-4">
        <LoadingSpinner />
        <p className="text-sm text-on-surface-variant">{status}</p>
      </div>
    </div>
  );
}
