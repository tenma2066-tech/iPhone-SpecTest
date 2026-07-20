import { useEffect, useState } from 'react';
import { collectDeviceInfo, type DeviceInfo } from './lib/deviceInfo';
import {
  runBenchmark,
  type BenchOutcome,
  type BenchProgress,
} from './lib/benchmark';
import './App.css';

function Stars({ n }: { n: number }) {
  if (n <= 0) return <span className="stars stars-na">—</span>;
  return (
    <span className="stars" aria-label={`${n} / 5`}>
      {'★'.repeat(n)}
      <span className="stars-empty">{'★'.repeat(5 - n)}</span>
    </span>
  );
}

function App() {
  const [info, setInfo] = useState<DeviceInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BenchProgress | null>(null);
  const [outcome, setOutcome] = useState<BenchOutcome | null>(null);

  useEffect(() => {
    collectDeviceInfo()
      .then(setInfo)
      .finally(() => setLoading(false));
  }, []);

  async function handleRun() {
    setRunning(true);
    setOutcome(null);
    setProgress({ phase: '準備中…', ratio: 0 });
    try {
      const result = await runBenchmark(setProgress);
      setOutcome(result);
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="page">
      <header className="hero">
        <h1>iPhone SpecTest</h1>
        <p className="subtitle">スペック表示 ＆ 性能ベンチマーク</p>
      </header>

      {loading && <p className="status">読み込み中…</p>}

      {info && !info.isIOS && (
        <div className="banner">
          このアプリは iPhone（iOS Safari）向けです。他の端末では一部の値が正しく表示されない場合があります。
        </div>
      )}

      {/* ベンチマーク */}
      <section className="card bench">
        <div className="bench-head">
          <div>
            <h2 className="section-title">性能ベンチマーク</h2>
            <p className="section-sub">
              CPU・メモリ・GPU を各3回計測し中央値で判定します
            </p>
          </div>
          <button
            type="button"
            className="run-btn"
            onClick={handleRun}
            disabled={running}
          >
            {running ? '計測中…' : outcome ? 'もう一度' : 'ベンチ開始'}
          </button>
        </div>

        {running && progress && (
          <div className="bench-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${Math.round(progress.ratio * 100)}%` }}
              />
            </div>
            <p className="progress-label">{progress.phase}</p>
          </div>
        )}

        {outcome && (
          <div className="bench-results">
            <div className="total-score">
              <span className="tier-badge">{outcome.tier.label}</span>
              <span className="total-num">
                {outcome.total.toLocaleString()}
              </span>
              <span className="total-label">総合スコア</span>
              <span className="tier-desc">{outcome.tier.description}</span>
              <span className={`consistency consistency-${outcome.consistency.level}`}>
                計測信頼度: {outcome.consistency.label}
              </span>
            </div>
            <ul className="spec-list">
              {outcome.results.map((r) => (
                <li key={r.key} className="spec-row">
                  <div className="spec-head">
                    <span className="spec-label">{r.label}</span>
                    <span className="spec-value">
                      {r.available ? r.score.toLocaleString() : '—'}
                    </span>
                  </div>
                  <div className="rating-row">
                    <Stars n={r.rating.stars} />
                    <span className="rating-label">{r.rating.label}</span>
                    {r.available && r.cvPercent > 0 && (
                      <span className="cv-label">±{r.cvPercent}%</span>
                    )}
                  </div>
                  <span className="spec-note">{r.metric}</span>
                </li>
              ))}
            </ul>
            <p className="bench-caveat">
              ※ スコアとランクは目安です。発熱・省電力状態・他アプリの影響で変動します。
              「計測信頼度」が低い場合は数回試して中央的な結果をご覧ください。
            </p>
          </div>
        )}
      </section>

      {/* スペック一覧 */}
      {info && (
        <section className="card">
          <div className="card-title-row">
            <h2 className="section-title">この端末のスペック</h2>
          </div>
          <ul className="spec-list">
            {info.items.map((item) => (
              <li key={item.key} className="spec-row">
                <div className="spec-head">
                  <span className="spec-label">{item.label}</span>
                  {item.value ? (
                    <span className="spec-value">{item.value}</span>
                  ) : (
                    <span className="spec-value spec-unavailable">取得不可</span>
                  )}
                </div>
                {item.note && (!item.value || item.alwaysShowNote) && (
                  <span className="spec-note">{item.note}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="footer">
        計測はすべて端末内で完結し、情報は外部に送信されません。
      </footer>
    </div>
  );
}

export default App;
