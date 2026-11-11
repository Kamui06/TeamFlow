import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useNavigate } from "react-router-dom";
import { isAbortError } from "../api/api";
import { searchService, type SearchResults } from "../services/SearchService";
import "./GlobalSearch.css";

const DEBOUNCE_MS = 250;

export default function GlobalSearch() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);

  // Wait for typing to pause before searching.
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(text.trim()), DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [text]);

  useEffect(() => {
    if (query.length < 2) {
      setResults(null);
      setError("");
      setLoading(false);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError("");

    searchService
      .search(query, controller.signal)
      .then((data) => {
        if (!controller.signal.aborted) setResults(data);
      })
      .catch((err: unknown) => {
        if (!isAbortError(err)) setError(err instanceof Error ? err.message : "Search failed");
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [query]);

  // Flatten sections into one list so arrow keys can move across them.
  const flat = useMemo(
    () =>
      (results?.sections ?? []).flatMap((section) =>
        section.items.map((item) => ({ section: section.key, item }))
      ),
    [results]
  );

  // Close when clicking outside the search box.
  useEffect(() => {
    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  // Keyboard shortcut: "/" focuses the search box, unless the user is typing elsewhere.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing = target?.matches("input, textarea, select, [contenteditable='true']");
      if (event.key === "/" && !typing) {
        event.preventDefault();
        rootRef.current?.querySelector("input")?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const go = (link: string) => {
    setOpen(false);
    setText("");
    setQuery("");
    setActive(-1);
    void navigate(link);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (flat.length === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => (i + 1) % flat.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => (i <= 0 ? flat.length - 1 : i - 1));
    } else if (event.key === "Enter" && active >= 0) {
      event.preventDefault();
      go(flat[active].item.link);
    }
  };

  const showPanel = open && text.trim().length > 0;
  let offset = 0;

  return (
    <div className="gs-root" ref={rootRef} role="search">
      <div className="gs-field">
        <span className="gs-icon" aria-hidden="true">⌕</span>
        <input
          type="search"
          role="combobox"
          aria-label="Search users, projects, teams, and tasks"
          aria-autocomplete="list"
          aria-haspopup="listbox"
          aria-controls="gs-panel"
          aria-expanded={showPanel}
          aria-activedescendant={active >= 0 ? `gs-item-${active}` : undefined}
          placeholder="Search users, projects, teams, tasks…   ( / )"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {loading && <span className="gs-spinner" aria-hidden="true" />}
      </div>

      {showPanel && (
        <div className="gs-panel" id="gs-panel" role="listbox">
          {text.trim().length < 2 && <p className="gs-hint">Type at least 2 characters.</p>}

          {error && <p className="gs-error" role="alert">{error}</p>}

          {results?.sections.map((section) => {
              const sectionStart = offset;
              offset += section.items.length;

              return (
                <div className="gs-section" key={section.key}>
                  <div className="gs-section-head">
                    <span>{section.label}</span>
                    <span className="gs-count">{section.items.length}</span>
                  </div>

                  {section.items.length === 0 ? (
                    <p className="gs-empty">No {section.label.toLowerCase()} match “{results.query}”.</p>
                  ) : (
                    section.items.map((item, i) => {
                      const index = sectionStart + i;
                      return (
                        <button
                          key={`${section.key}-${item.id}`}
                          id={`gs-item-${index}`}
                          type="button"
                          role="option"
                          aria-selected={active === index}
                          className={`gs-item ${active === index ? "is-active" : ""}`}
                          onMouseEnter={() => setActive(index)}
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => go(item.link)}
                        >
                          <span className={`gs-badge gs-badge-${section.key}`} aria-hidden="true">
                            {section.label.charAt(0)}
                          </span>
                          <span className="gs-text">
                            <strong>{item.title}</strong>
                            <small>{item.subtitle}</small>
                          </span>
                        </button>
                      );
                    })
                  )}
                </div>
              );
            })}

          {results && flat.length === 0 && (
            <p className="gs-empty-all">Nothing matches “{results.query}”.</p>
          )}
        </div>
      )}
    </div>
  );
}