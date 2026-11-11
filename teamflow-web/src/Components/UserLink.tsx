import { Link } from "react-router-dom";

interface UserLinkProps {
  readonly id: number | null | undefined;
  readonly name: string;
  readonly className?: string;
}

// A name that opens that user's profile. Falls back to plain text when the id is unknown. 
export default function UserLink({ id, name, className = "" }: UserLinkProps) {
  if (id == null) {
    return <span className={className}>{name}</span>;
  }
  return (
    <Link to={`/users/${id}`} className={`user-link ${className}`.trim()} title={`View ${name}'s profile`}>
      {name}
    </Link>
  );
}