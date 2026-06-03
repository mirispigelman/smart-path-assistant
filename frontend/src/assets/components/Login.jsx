import React, { useState } from 'react';
import { loginUser } from '../services/api.js';
import en from '../../i18n/en.js';

const Login = ({ onLoginSuccess }) => {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleAuth = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);
        try {
            const data = await loginUser(email, name);
            if (data.success) {
                onLoginSuccess(data.userId, name);
            } else {
                setError(data.error || en.login.signInError);
            }
        } catch (err) {
            setError(en.login.networkError);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-wrap">
            <div className="auth-card">
                <div className="auth-logo" aria-hidden="true">🛒</div>
                <span className="hero-pill" style={{ marginBottom: 18 }}>
                    <span className="dot" aria-hidden="true" /> {en.aiPill}
                </span>
                <h2>
                    {en.login.title}{' '}
                    <span className="gradient-text">{en.appName}</span>
                </h2>
                <p className="sub">{en.login.subtitle}</p>

                <form className="auth-form" onSubmit={handleAuth}>
                    <div>
                        <label className="field-label" htmlFor="name">{en.login.fullName}</label>
                        <input
                            id="name"
                            className="field"
                            type="text"
                            placeholder={en.login.namePlaceholder}
                            value={name}
                            required
                            onChange={(e) => setName(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="field-label" htmlFor="email">{en.login.email}</label>
                        <input
                            id="email"
                            className="field"
                            type="email"
                            placeholder={en.login.emailPlaceholder}
                            value={email}
                            required
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    {error && (
                        <div className="banner banner-warn" role="alert" style={{ marginBottom: 0 }}>
                            <span aria-hidden="true">⚠️</span>
                            <span>{error}</span>
                        </div>
                    )}

                    <button type="submit" className="btn btn-primary btn-block btn-lg" disabled={loading}>
                        {loading ? <span className="spinner" /> : en.login.continue}
                    </button>
                </form>

                <p className="auth-foot">{en.login.foot}</p>
            </div>
        </div>
    );
};

export default Login;
