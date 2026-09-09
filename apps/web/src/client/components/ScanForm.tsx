import { useState, type FormEvent } from 'react';

export interface ScanFormProps {
  readonly onScan: (url: string, timeout?: number) => void;
  readonly isScanning: boolean;
}

const QUICK_EXAMPLES = [
  { label: 'Example.com', url: 'https://example.com' },
  { label: 'W3C WAI', url: 'https://www.w3.org/WAI/' },
];

export function ScanForm({ onScan, isScanning }: ScanFormProps) {
  const [url, setUrl] = useState('');
  const [timeoutSec, setTimeoutSec] = useState(30);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    onScan(trimmed, timeoutSec * 1000);
  };

  return (
    <section className="card" aria-labelledby="scan-heading">
      <h2
        id="scan-heading"
        style={{ margin: '0 0 1rem 0', fontSize: '1.25rem' }}
      >
        Run Accessibility Audit
      </h2>
      <form
        onSubmit={handleSubmit}
        role="search"
        aria-label="Target website scanner"
      >
        <div className="form-group">
          <label htmlFor="target-url-input" className="form-label">
            Target Web Page URL
          </label>
          <div className="form-row">
            <input
              id="target-url-input"
              type="url"
              className="form-input"
              placeholder="https://example.com"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              required
              disabled={isScanning}
              aria-required="true"
            />
            <label htmlFor="timeout-select" className="sr-only">
              Navigation Timeout
            </label>
            <select
              id="timeout-select"
              className="form-select"
              value={timeoutSec}
              onChange={(e) => setTimeoutSec(Number(e.target.value))}
              disabled={isScanning}
              aria-label="Navigation timeout in seconds"
            >
              <option value={15}>15s Timeout</option>
              <option value={30}>30s Timeout</option>
              <option value={60}>60s Timeout</option>
            </select>
            <button
              type="submit"
              className="btn-primary"
              disabled={isScanning || !url.trim()}
              aria-busy={isScanning}
            >
              {isScanning ? 'Scanning…' : 'Scan Page'}
            </button>
          </div>
        </div>

        <div className="quick-try-row">
          <span>Quick try:</span>
          {QUICK_EXAMPLES.map((ex) => (
            <button
              key={ex.url}
              type="button"
              className="btn-chip"
              onClick={() => {
                setUrl(ex.url);
                onScan(ex.url, timeoutSec * 1000);
              }}
              disabled={isScanning}
            >
              {ex.label}
            </button>
          ))}
        </div>
      </form>
    </section>
  );
}
