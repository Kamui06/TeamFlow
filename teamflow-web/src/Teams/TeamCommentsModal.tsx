import Dialog from "../Components/Dialog";
import CommentThread from "../Comments/CommentThread";

interface TeamCommentsModalProps {
  readonly teamId: number;
  readonly teamName: string;
  readonly onClose: () => void;
}

export default function TeamCommentsModal({ teamId, teamName, onClose }: TeamCommentsModalProps) {
  return (
    <Dialog eyebrow="Team discussion" title={teamName} size="lg" onClose={onClose}>
      <CommentThread
        scope="TEAM"
        targetId={teamId}
        title="Comments"
        subtitle="Visible to everyone in this team"
      />
    </Dialog>
  );
}