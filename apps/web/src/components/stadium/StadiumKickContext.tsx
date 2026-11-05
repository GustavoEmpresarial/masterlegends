import { createContext, useContext } from 'react';

export interface StadiumKickState {
  /** Slot id of the player currently kicking / receiving the ball. */
  kickSlotId: string | null;
}

const StadiumKickContext = createContext<StadiumKickState>({ kickSlotId: null });

export function StadiumKickProvider({
  kickSlotId,
  children,
}: {
  kickSlotId: string | null;
  children: React.ReactNode;
}) {
  return (
    <StadiumKickContext.Provider value={{ kickSlotId }}>
      {children}
    </StadiumKickContext.Provider>
  );
}

export function useStadiumKick(): StadiumKickState {
  return useContext(StadiumKickContext);
}
