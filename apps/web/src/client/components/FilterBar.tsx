export interface FilterBarProps {
  readonly severity: string;
  readonly onSelectSeverity: (s: string) => void;
  readonly query: string;
  readonly onQueryChange: (q: string) => void;
  readonly totalCount: number;
  readonly filteredCount: number;
}

const SEVERITY_OPTIONS = ['all', 'critical', 'serious', 'moderate', 'minor'];

export function FilterBar({
  severity,
  onSelectSeverity,
  query,
  onQueryChange,
  totalCount,
  filteredCount,
}: FilterBarProps) {
  return (
    <section className="filter-bar" aria-label="Filter findings">
      <div
        className="filter-chips"
        role="group"
        aria-label="Filter by severity"
      >
        {SEVERITY_OPTIONS.map((opt) => (
          <button
            key={opt}
            type="button"
            className={`filter-chip-btn ${severity === opt ? 'active' : ''}`}
            onClick={() => onSelectSeverity(opt)}
            aria-pressed={severity === opt}
          >
            {opt.charAt(0).toUpperCase() + opt.slice(1)}
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
        <input
          type="search"
          className="form-input"
          style={{
            minWidth: '180px',
            padding: '0.4rem 0.6rem',
            fontSize: '0.875rem',
          }}
          placeholder="Filter rules or tags…"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          aria-label="Filter findings by text"
        />
        <span
          style={{
            fontSize: '0.85rem',
            color: 'var(--text-muted)',
            whiteSpace: 'nowrap',
          }}
        >
          Showing <strong>{filteredCount}</strong> of {totalCount}
        </span>
      </div>
    </section>
  );
}
