import { useEffect, useState } from 'react';
import { collectDeviceInfo, type DeviceInfo } from './lib/deviceInfo';
import './App.css';

function App() {
  const [info, setInfo] = useState<DeviceInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    collectDeviceInfo()
      .then(setInfo)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page">
      <header className="hero">
        <h1>iPhone SpecTest</h1>
        <p className="subtitle">この端末のスペックを表示します</p>
      </header>

      {loading && <p className="status">読み込み中…</p>}

      {info && !info.isIOS && (
        <div className="banner">
          このアプリは iPhone（iOS Safari）向けです。他の端末では一部の値が正しく表示されない場合があります。
        </div>
      )}

      {info && (
        <section className="card">
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
        <br />
        性能ベンチマーク機能は次のフェーズで追加予定です。
      </footer>
    </div>
  );
}

export default App;
