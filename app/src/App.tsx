import { useEffect, useState } from 'react';
import { collectDeviceInfo, type DeviceInfo } from './lib/deviceInfo';
import {
  runBenchmark,
  type BenchResult,
  type BenchProgress,
} from './lib/benchmark';
import './App.css';

function App() {
  const [info, setInfo] = useState<DeviceInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<BenchProgress | null>(null);
  const [results, setResults] = useState<BenchResult[] | null>(null);
  const [total, setTotal] = useState<number | null>(null);

  useEffect(() => {
    collectDeviceInfo()
      .then(setInfo)
      .finally(() => setLoading(false));
  }, []);

  async function handleRun() {
    setRunning(true);
    setResults(null);
    setTotal(null);
    setProgress({ phase: '準備中…', ratio: 0 });
    try {
      const { results, total } = await runBenchmark(setProgress);
      setResults(results);
      setTotal(total);
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
            <p className="section-sub">CPU・メモリを実測してスコア化します</p>
          </div>
          <button
            type="button"
            className="run-btn"
            onClick={handleRun}
            disabled={running}
          >
            {running ? '計測中…' : results ? 'もう一度' : 'ベンチ開始'}
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

        {results && total !== null && (
          <div className="bench-results">
            <div className="total-score">
              <span className="total-num">{total.toLocaleString()}</span>
              <span className="total-label">総合スコア</span>
            </div>
            <ul className="spec-list">
              {results.map((r) => (
                <li key={r.key} className="spec-row">
                  <div className="spec-head">
                    <span className="spec-label">{r.label}</span>
                    <span className="spec-value">{r.score.toLocaleString()}</span>
                  </div>
                  <span className="spec-note">{r.metric}</span>
                </li>
              ))}
            </ul>
            <p className="bench-caveat">
              ※ 発熱・省電力状態・他アプリの影響でスコアは変動します。参考値としてご覧ください。
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
                {!item.value && item.note && (
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
