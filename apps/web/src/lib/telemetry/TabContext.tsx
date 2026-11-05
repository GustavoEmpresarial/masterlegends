import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

let currentPageTab: string | null = null;

export function getCurrentPageTab(): string | null {
  return currentPageTab;
}

function setCurrentPageTab(tab: string | null): void {
  currentPageTab = tab;
}

const TabContext = createContext<{
  tab: string | null;
  setTab: (tab: string | null) => void;
}>({
  tab: null,
  setTab: setCurrentPageTab,
});

export function TabProvider({ children }: { children: ReactNode }) {
  const [tab, setTabState] = useState<string | null>(null);

  const setTab = (next: string | null) => {
    setTabState(next);
    setCurrentPageTab(next);
  };

  return (
    <TabContext.Provider value={{ tab, setTab }}>{children}</TabContext.Provider>
  );
}

/** Registers the active in-page tab for error reports (cleared on unmount). */
export function usePageTab(tab: string | null): void {
  useEffect(() => {
    setCurrentPageTab(tab);
    return () => setCurrentPageTab(null);
  }, [tab]);
}

export function useTabContext() {
  return useContext(TabContext);
}
