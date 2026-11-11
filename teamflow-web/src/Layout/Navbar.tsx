import GlobalSearch from "./GlobalSearch";

interface NavbarProps {
  readonly title: string;
  readonly onMenu: () => void;
}

const today = () =>
  new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });

export default function Navbar({ title, onMenu }: NavbarProps) {
  return (
    <header className="nb">
      <button type="button" className="nb-menu" aria-label="Toggle navigation" onClick={onMenu}>
        <span />
        <span />
        <span />
      </button>

      <div className="nb-title">
        <p>TeamFlow</p>
        <h1>{title}</h1>
      </div>

      <GlobalSearch />

      <span className="nb-date">{today()}</span>
    </header>
  );
}