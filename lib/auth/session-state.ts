type SessionState = {
  isAuthenticated?: boolean;
  userId?: string | null;
  sessionStatus?: string | null;
};

export function hasActiveSession(session: SessionState): boolean {
  return (
    session.isAuthenticated === true &&
    Boolean(session.userId) &&
    session.sessionStatus === "active"
  );
}
