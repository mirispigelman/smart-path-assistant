import { useState, useEffect, useCallback, useRef } from 'react';
import Login from './Login';
import ShoppingActions from './shoppingActions';
import ShoppingListPage from './ShoppingListPage.jsx';
import StoreMap from './StoreMap.jsx';
import en from '../../i18n/en.js';

let toastSeq = 0;

const MainManager = () => {
    const [user, setUser] = useState(null);
    const [pathResult, setPathResult] = useState({ list: [], aiSummary: '', mappingWarning: '' });
    const [listRefreshKey, setListRefreshKey] = useState(0);
    const [itemCount, setItemCount] = useState(0);
    const [toasts, setToasts] = useState([]);
    const routeRef = useRef(null);

    const notify = useCallback((message, type = 'info') => {
        const id = ++toastSeq;
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 3800);
    }, []);

    useEffect(() => {
        const savedId = localStorage.getItem('userId');
        const savedName = localStorage.getItem('userName');
        if (!savedId) return;

        fetch(`http://localhost:5000/api/auth/validate/${savedId}`)
            .then((res) => res.json())
            .then((data) => {
                if (data.valid) setUser({ id: String(data.userId), name: savedName });
                else {
                    localStorage.removeItem('userId');
                    localStorage.removeItem('userName');
                }
            })
            .catch(() => {
                localStorage.removeItem('userId');
                localStorage.removeItem('userName');
            });
    }, []);

    const handleLogin = (id, name) => {
        localStorage.setItem('userId', id);
        localStorage.setItem('userName', name);
        setUser({ id, name });
    };

    const handleLogout = () => {
        localStorage.removeItem('userId');
        localStorage.removeItem('userName');
        setUser(null);
        setPathResult({ list: [], aiSummary: '', mappingWarning: '' });
        setItemCount(0);
    };

    const handlePathResult = (list, answer, mappingWarning) => {
        setPathResult({ list, aiSummary: answer || '', mappingWarning: mappingWarning || '' });
        if (list.length > 0) {
            requestAnimationFrame(() =>
                routeRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            );
        }
    };

    const refreshShoppingList = () => setListRefreshKey((k) => k + 1);

    if (!user) {
        return (
            <>
                <div className="app-bg-grid" />
                <Login onLoginSuccess={handleLogin} />
                <ToastStack toasts={toasts} />
            </>
        );
    }

    const initials = (user.name || '?').trim().charAt(0).toUpperCase();
    const hasRoute = pathResult.list.length > 0;
    const step = hasRoute ? 3 : itemCount > 0 ? 2 : 1;

    return (
        <>
            <div className="app-bg-grid" />
            <div className="app-shell">
                <nav className="topbar" aria-label={en.nav.primary}>
                    <div className="brand">
                        <span className="brand-logo" aria-hidden="true">🛒</span>
                        <span>{en.appName}</span>
                        <span className="brand-badge">{en.brandBadge}</span>
                    </div>
                    <div className="topbar-user">
                        <div className="user-chip">
                            <span className="user-avatar" aria-hidden="true">{initials}</span>
                            <span className="uname">{user.name}</span>
                        </div>
                        <button className="btn-ghost" onClick={handleLogout}>{en.nav.signOut}</button>
                    </div>
                </nav>

                <header className="hero">
                    <span className="hero-pill">
                        <span className="dot" aria-hidden="true" /> {en.hero.pill}
                    </span>
                    <h1>
                        {en.hero.title}{' '}
                        <span className="gradient-text">{en.hero.titleAccent}</span>
                    </h1>
                    <p>{en.hero.subtitle}</p>

                    <ol className="stepper" aria-label={en.progress}>
                        <li className={`step ${step === 1 ? 'active' : ''}`} aria-current={step === 1 ? 'step' : undefined}>
                            <span className="num" aria-hidden="true">1</span> {en.hero.step1}
                        </li>
                        <li className="step-sep" aria-hidden="true">→</li>
                        <li className={`step ${step === 2 ? 'active' : ''}`} aria-current={step === 2 ? 'step' : undefined}>
                            <span className="num" aria-hidden="true">2</span> {en.hero.step2}
                        </li>
                        <li className="step-sep" aria-hidden="true">→</li>
                        <li className={`step ${step === 3 ? 'active' : ''}`} aria-current={step === 3 ? 'step' : undefined}>
                            <span className="num" aria-hidden="true">3</span> {en.hero.step3}
                        </li>
                    </ol>
                </header>

                <ShoppingActions
                    userId={user.id}
                    notify={notify}
                    onPathCalculated={handlePathResult}
                    onListChanged={refreshShoppingList}
                    onSessionExpired={() => {
                        handleLogout();
                        notify(en.toast.sessionExpired, 'error');
                    }}
                />

                <ShoppingListPage
                    userId={user.id}
                    refreshKey={listRefreshKey}
                    notify={notify}
                    onItemsLoaded={setItemCount}
                />

                {hasRoute && (
                    <section className="glass-card" ref={routeRef} aria-labelledby="route-heading" tabIndex={-1}>
                        <h2 className="card-title" id="route-heading">
                            {en.route.title}
                        </h2>
                        <p className="card-sub">{en.route.subtitle}</p>

                        {pathResult.mappingWarning && (
                            <div className="banner banner-warn" role="alert">
                                <span>{pathResult.mappingWarning}</span>
                            </div>
                        )}

                        <StoreMap routeItems={pathResult.list} />

                        <div>
                            {pathResult.list.map((item, i) => (
                                <div
                                    className="route-stop"
                                    key={item.id ?? i}
                                    style={{ animationDelay: `${i * 0.05}s` }}
                                >
                                    <div className="route-num">{i + 1}</div>
                                    <div className="route-info">
                                        <div className="route-name">{item.item_name}</div>
                                        {item.categoryName && (
                                            <div className="route-cat">{item.categoryName}</div>
                                        )}
                                        {item.aisle && (
                                            <span className="route-aisle">
                                                📦 {en.route.aisle} {item.aisle.col} · {en.route.shelf} {item.aisle.row}
                                            </span>
                                        )}

                                        {!item.mapped ? (
                                            <p className="route-status">{en.route.notMapped}</p>
                                        ) : item.fullPath && item.fullPath.length > 0 ? (
                                            <div className="route-steps">
                                                <span className="label">{en.route.directions}</span>
                                                {item.fullPath.map((stepIcon, idx) => (
                                                    <span key={idx}>
                                                        {stepIcon}
                                                        {idx < item.fullPath.length - 1 && (
                                                            <span className="sep"> ➔ </span>
                                                        )}
                                                    </span>
                                                ))}
                                            </div>
                                        ) : i === 0 ? (
                                            <p className="route-status">{en.route.atEntrance}</p>
                                        ) : (
                                            <p className="route-status">{en.route.sameAisle}</p>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            <ToastStack toasts={toasts} />
        </>
    );
};

const ToastStack = ({ toasts }) => {
    const icon = { ok: '✅', error: '⚠️', info: 'ℹ️' };
    return (
        <div className="toast-stack" role="status" aria-live="polite" aria-atomic="false">
            {toasts.map((t) => (
                <div className={`toast ${t.type}`} key={t.id}>
                    <span className="ic" aria-hidden="true">{icon[t.type] || 'ℹ️'}</span>
                    <span>{t.message}</span>
                </div>
            ))}
        </div>
    );
};

export default MainManager;
