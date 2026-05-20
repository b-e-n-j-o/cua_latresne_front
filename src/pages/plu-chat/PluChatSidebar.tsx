import { useState } from "react";
import { PanelLeftClose, Plus, Trash2 } from "lucide-react";

export type SessionSummary = {
  session_id: string;
  title: string;
  zones_summary: string;
  total_turns: number;
  updated_at: string;
  preview?: string | null;
};

type Props = {
  isOpen: boolean;
  sessions: SessionSummary[];
  loadingSessions: boolean;
  loadingSessionId: string | null;
  deletingSessionId: string | null;
  activeSessionId: string | null;
  onClose: () => void;
  onNewChat: () => void;
  onSelectSession: (id: string) => void;
  onDeleteSession: (id: string) => Promise<void>;
};

function formatSessionDate(iso: string) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PluChatSidebar({
  isOpen,
  sessions,
  loadingSessions,
  loadingSessionId,
  deletingSessionId,
  activeSessionId,
  onClose,
  onNewChat,
  onSelectSession,
  onDeleteSession,
}: Props) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDeleteClick = (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setConfirmDeleteId(sessionId);
  };

  const handleConfirmDelete = async (e: React.MouseEvent, sessionId: string) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
    await onDeleteSession(sessionId);
  };

  const handleCancelDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmDeleteId(null);
  };

  return (
    <>
      {isOpen && (
        <button
          type="button"
          className="plu-chat__sidebar-backdrop"
          aria-label="Fermer l'historique"
          onClick={onClose}
        />
      )}

      <aside className="plu-chat__sidebar" aria-label="Historique des conversations">
        <div className="plu-chat__sidebar-head">
          <span className="plu-chat__sidebar-title">Historique</span>
          <button
            type="button"
            className="plu-chat__icon-btn"
            aria-label="Masquer l'historique"
            onClick={onClose}
          >
            <PanelLeftClose size={18} />
          </button>
        </div>

        <button type="button" className="plu-chat__sidebar-new" onClick={onNewChat}>
          <Plus size={16} />
          Nouvelle conversation
        </button>

        <div className="plu-chat__sidebar-list">
          {loadingSessions && sessions.length === 0 && (
            <p className="plu-chat__sidebar-empty">Chargement…</p>
          )}
          {!loadingSessions && sessions.length === 0 && (
            <p className="plu-chat__sidebar-empty">Aucune conversation enregistrée.</p>
          )}
          {sessions.map((s) => {
            const isActive = activeSessionId === s.session_id;
            const isLoading = loadingSessionId === s.session_id;
            const isDeleting = deletingSessionId === s.session_id;
            const isConfirming = confirmDeleteId === s.session_id;

            return (
              <div
                key={s.session_id}
                className={`plu-chat__sidebar-item-row${isActive ? " plu-chat__sidebar-item-row--active" : ""}`}
              >
                <button
                  type="button"
                  className={`plu-chat__sidebar-item${isActive ? " plu-chat__sidebar-item--active" : ""}`}
                  onClick={() => onSelectSession(s.session_id)}
                  disabled={isLoading || isDeleting}
                >
                  <span className="plu-chat__sidebar-item-title">{s.title}</span>
                  {s.zones_summary && s.zones_summary !== "aucune zone trouvée" && (
                    <span className="plu-chat__sidebar-item-zones">{s.zones_summary}</span>
                  )}
                  {s.preview && (
                    <span className="plu-chat__sidebar-item-preview">{s.preview}</span>
                  )}
                  <span className="plu-chat__sidebar-item-date">
                    {formatSessionDate(s.updated_at)}
                    {s.total_turns > 0
                      ? ` · ${s.total_turns} échange${s.total_turns > 1 ? "s" : ""}`
                      : ""}
                  </span>
                </button>

                {isConfirming ? (
                  <div className="plu-chat__sidebar-delete-confirm">
                    <button
                      type="button"
                      className="plu-chat__sidebar-delete-confirm-btn plu-chat__sidebar-delete-confirm-btn--yes"
                      onClick={(e) => void handleConfirmDelete(e, s.session_id)}
                      disabled={isDeleting}
                    >
                      Oui
                    </button>
                    <button
                      type="button"
                      className="plu-chat__sidebar-delete-confirm-btn"
                      onClick={handleCancelDelete}
                      disabled={isDeleting}
                    >
                      Non
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="plu-chat__sidebar-item-delete"
                    aria-label={`Supprimer ${s.title}`}
                    title="Supprimer la conversation"
                    onClick={(e) => handleDeleteClick(e, s.session_id)}
                    disabled={isLoading || isDeleting}
                  >
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </aside>
    </>
  );
}
