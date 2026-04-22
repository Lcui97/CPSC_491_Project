import { createContext, useCallback, useContext, useMemo, useState } from 'react';

const STORAGE_WIDTH = 'atlus_assistant_panel_width';
const MIN_WIDTH = 300;
const MAX_RATIO = 0.58;

const AssistantPanelContext = createContext(null);

export function AssistantPanelProvider({ children }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const [panelWidth, setPanelWidthState] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_WIDTH);
      const v = Number(raw);
      if (Number.isFinite(v) && v >= MIN_WIDTH) return v;
    } catch {
      // ignore
    }
    return 420;
  });

  const setPanelWidth = useCallback((w) => {
    const max =
      typeof window !== 'undefined' ? Math.floor(window.innerWidth * MAX_RATIO) : 900;
    const nw = Math.max(MIN_WIDTH, Math.min(Math.floor(w), max));
    setPanelWidthState(nw);
    try {
      localStorage.setItem(STORAGE_WIDTH, String(nw));
    } catch {
      // ignore
    }
  }, []);

  const openPanel = useCallback(() => {
    setIsOpen(true);
    setIsMinimized(false);
  }, []);

  const togglePanel = useCallback(() => {
    setIsOpen((prev) => {
      const next = !prev;
      setIsMinimized(false);
      return next;
    });
  }, []);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(false);
  }, []);

  const minimizePanel = useCallback(() => {
    setIsMinimized(true);
  }, []);

  const restorePanel = useCallback(() => {
    setIsMinimized(false);
    setIsOpen(true);
  }, []);

  const value = useMemo(
    () => ({
      isOpen,
      setIsOpen,
      isMinimized,
      setIsMinimized,
      panelWidth,
      setPanelWidth,
      openPanel,
      togglePanel,
      closePanel,
      minimizePanel,
      restorePanel,
    }),
    [
      isOpen,
      isMinimized,
      panelWidth,
      setPanelWidth,
      openPanel,
      togglePanel,
      closePanel,
      minimizePanel,
      restorePanel,
    ]
  );

  return <AssistantPanelContext.Provider value={value}>{children}</AssistantPanelContext.Provider>;
}

export function useAssistantPanel() {
  const ctx = useContext(AssistantPanelContext);
  if (!ctx) throw new Error('useAssistantPanel must be used within AssistantPanelProvider');
  return ctx;
}
