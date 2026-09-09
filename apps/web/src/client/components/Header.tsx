export interface HeaderProps {
  readonly theme: 'light' | 'dark';
  readonly onToggleTheme: () => void;
}

export function Header({ theme, onToggleTheme }: HeaderProps) {
  return (
    <header className="app-header" role="banner">
      <div className="header-content">
        <h1 className="brand-title">
          <span>A11yFix</span>
          <span className="brand-badge">WCAG 2.1 AA</span>
        </h1>
        <button
          type="button"
          className="theme-btn"
          onClick={onToggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
        >
          {theme === 'light' ? '🌙 Dark' : '☀️ Light'}
        </button>
      </div>
    </header>
  );
}
