import React, { useState } from 'react';
import { addItemManual, uploadFileToList, calculatePath, addVoiceItemsAI } from '../services/api.js';
import en, { translateApiMessage } from '../../i18n/en.js';

const ShoppingActions = ({ userId, onPathCalculated, onListChanged, onSessionExpired, notify }) => {
    const [textItem, setTextItem] = useState('');
    const [isWorking, setIsWorking] = useState(false);
    const [isListening, setIsListening] = useState(false);

    const toast = (msg, type = 'info') => (notify ? notify(msg, type) : null);

    const handleApiResponse = (data) => {
        if (data?.code === 'INVALID_USER') {
            onSessionExpired?.();
            return true;
        }
        if (data?.code === 'GEMINI_QUOTA') {
            toast(
                translateApiMessage(data.error) || en.toast.geminiQuota,
                'error'
            );
            return true;
        }
        return false;
    };

    const handleManual = async () => {
        if (!textItem.trim()) return;
        setIsWorking(true);
        try {
            await addItemManual(userId, textItem.trim());
            toast(en.toast.itemAdded(textItem.trim()), 'ok');
            setTextItem('');
            onListChanged?.();
        } catch (err) {
            toast(en.toast.addFailed, 'error');
        } finally {
            setIsWorking(false);
        }
    };

    const handleFileUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        setIsWorking(true);
        try {
            const data = await uploadFileToList(userId, file);
            if (handleApiResponse(data)) return;
            onListChanged?.();
            onPathCalculated?.([], '');
            if (data?.items?.length > 0) {
                toast(en.toast.fileAdded(data.items.join(', ')), 'ok');
            } else if (data?.success) {
                toast(
                    translateApiMessage(data.message) || en.toast.noProductsInFile,
                    'info'
                );
            } else {
                toast(translateApiMessage(data?.error) || en.toast.fileError, 'error');
            }
        } catch (err) {
            toast(en.toast.fileError, 'error');
        } finally {
            setIsWorking(false);
            e.target.value = '';
        }
    };

    const handleVoiceRecord = () => {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            toast(en.toast.voiceUnsupported, 'error');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'en-US';
        recognition.interimResults = false;

        recognition.onstart = () => setIsListening(true);
        recognition.onresult = async (event) => {
            const transcript = event.results[0][0].transcript;
            setIsListening(false);
            setIsWorking(true);
            try {
                const data = await addVoiceItemsAI(userId, transcript);
                if (handleApiResponse(data)) return;
                if (data.success && data.items?.length) {
                    onListChanged?.();
                    toast(en.toast.voiceAdded(data.items.join(', ')), 'ok');
                } else {
                    toast(en.toast.voiceEmpty, 'info');
                }
            } catch (err) {
                toast(en.toast.voiceError, 'error');
            } finally {
                setIsWorking(false);
            }
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognition.start();
    };

    const handleStartShopping = async () => {
        setIsWorking(true);
        try {
            const data = await calculatePath(userId);
            if (handleApiResponse(data)) return;
            if (data?.list?.length > 0) {
                onPathCalculated(
                    data.list,
                    data.answer || '',
                    data.mappingWarning
                );
                toast(en.toast.routeReady, 'ok');
            } else {
                toast(
                    translateApiMessage(data?.answer) ||
                        translateApiMessage(data?.error) ||
                        en.toast.routeEmpty,
                    'info'
                );
            }
        } catch (err) {
            toast(en.toast.routeError, 'error');
        } finally {
            setIsWorking(false);
        }
    };

    const handleClearList = async () => {
        if (!window.confirm(en.actions.confirmClear)) return;
        setIsWorking(true);
        try {
            const response = await fetch('http://localhost:5000/api/list/clear', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });
            const data = await response.json();
            if (data.success) {
                toast(en.toast.listCleared, 'ok');
                onPathCalculated?.([], '');
                onListChanged?.();
            }
        } catch (err) {
            toast(en.toast.clearError, 'error');
        } finally {
            setIsWorking(false);
        }
    };

    return (
        <section className="glass-card" aria-labelledby="build-heading">
            <h2 className="card-title" id="build-heading">
                {en.actions.title}
            </h2>
            <p className="card-sub">{en.actions.subtitle}</p>

            <div style={{ marginBottom: 20 }}>
                <label className="field-label" htmlFor="quick-add">{en.actions.quickAdd}</label>
                <div className="input-row">
                    <input
                        id="quick-add"
                        className="field"
                        type="text"
                        value={textItem}
                        onChange={(e) => setTextItem(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleManual()}
                        placeholder={en.actions.placeholder}
                        disabled={isWorking}
                    />
                    <button className="btn btn-primary" onClick={handleManual} disabled={isWorking || !textItem.trim()}>
                        {en.actions.add}
                    </button>
                </div>
            </div>

            <div className="action-grid">
                <div className="action-tile">
                    <h3><span aria-hidden="true">📄</span> {en.actions.uploadTitle}</h3>
                    <p className="hint">{en.actions.uploadHint}</p>
                    <label className="dropzone">
                        <span className="big" aria-hidden="true">⬆️</span>
                        <span>{isWorking ? en.actions.uploadProcessing : en.actions.uploadLabel}</span>
                        <input
                            type="file"
                            onChange={handleFileUpload}
                            accept="image/*,application/pdf"
                            disabled={isWorking}
                            aria-label={en.actions.uploadAria}
                        />
                    </label>
                </div>

                <div className="action-tile">
                    <h3><span aria-hidden="true">🎤</span> {en.actions.voiceTitle}</h3>
                    <p className="hint">{en.actions.voiceHint}</p>
                    <button
                        className={`voice-btn ${isListening ? 'listening' : ''}`}
                        onClick={handleVoiceRecord}
                        disabled={isWorking || isListening}
                        aria-pressed={isListening}
                    >
                        {isListening ? en.actions.voiceListening : en.actions.voiceRecord}
                    </button>
                </div>
            </div>

            <hr className="divider" />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <button
                    className="btn btn-primary btn-lg btn-block"
                    onClick={handleStartShopping}
                    disabled={isWorking || isListening}
                >
                    {isWorking ? <span className="spinner" /> : en.actions.calculateRoute}
                </button>
                <button
                    className="btn btn-danger btn-block"
                    onClick={handleClearList}
                    disabled={isWorking || isListening}
                >
                    {en.actions.clearList}
                </button>
            </div>
        </section>
    );
};

export default ShoppingActions;
