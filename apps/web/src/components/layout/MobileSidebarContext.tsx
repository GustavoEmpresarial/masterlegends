import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';

interface MobileSidebarContextValue {
  enabled: boolean;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

const MobileSidebarContext = createContext<MobileSidebarContextValue>({
  enabled: false,
  isOpen: false,
  open: () => {},
  close: () => {},
  toggle: () => {},
});

export function MobileSidebarProvider({
  enabled,
  children,
}: {
  enabled: boolean;
  children: React.ReactNode;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!enabled || !isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [enabled, isOpen]);

  useEffect(() => {
    if (!enabled || !isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [enabled, isOpen]);

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen((v) => !v), []);

  const value = useMemo(
    () => ({ enabled, isOpen, open, close, toggle }),
    [enabled, isOpen, open, close, toggle],
  );

  return <MobileSidebarContext.Provider value={value}>{children}</MobileSidebarContext.Provider>;
}

export function useMobileSidebar() {
  return useContext(MobileSidebarContext);
}
