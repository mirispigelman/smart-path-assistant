import { useState, useEffect, useCallback } from 'react';
import en from '../../i18n/en.js';

const API = 'http://localhost:5000/api';

const ShoppingListPage = ({ userId, refreshKey = 0, notify, onItemsLoaded }) => {
    const [items, setItems] = useState([]);
    const [showList, setShowList] = useState(true);
    const [loading, setLoading] = useState(false);
    const [editItem, setEditItem] = useState(null);

    const toast = (msg, type = 'info') => (notify ? notify(msg, type) : null);

    const fetchShoppingList = useCallback(() => {
        setLoading(true);
        fetch(`${API}/list/${userId}`)
            .then((res) => res.json())
            .then((data) => {
                const list = Array.isArray(data) ? data : [];
                setItems(list);
                onItemsLoaded?.(list.length);
            })
            .catch(() => toast(en.toast.loadFailed, 'error'))
            .finally(() => setLoading(false));
    }, [userId, notify, onItemsLoaded]);

    useEffect(() => {
        fetchShoppingList();
    }, [fetchShoppingList, refreshKey]);

    const handleDelete = (id) => {
        if (!window.confirm(en.list.confirmDelete)) return;
        fetch(`${API}/item/${id}`, { method: 'DELETE' })
            .then(() => {
                const next = items.filter((item) => item.id !== id);
                setItems(next);
                onItemsLoaded?.(next.length);
                toast(en.toast.removed, 'ok');
            })
            .catch(() => toast(en.toast.removeFailed, 'error'));
    };

    const handleUpdate = () => {
        fetch(`${API}/item/${editItem.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ item_name: editItem.item_name }),
        })
            .then(() => {
                setItems(items.map((item) => (item.id === editItem.id ? editItem : item)));
                setEditItem(null);
                toast(en.toast.updated, 'ok');
            })
            .catch(() => toast(en.toast.updateFailed, 'error'));
    };

    return (
        <section className="glass-card" aria-labelledby="items-heading">
            <div className="list-header">
                <h2 className="card-title" id="items-heading" style={{ marginBottom: 0 }}>
                    <span className="ic" aria-hidden="true">🧾</span> {en.list.title}
                    <span className="list-count">{items.length}</span>
                </h2>
                <button
                    className="btn-icon"
                    onClick={() => setShowList((s) => !s)}
                    aria-expanded={showList}
                    aria-controls="items-body"
                    aria-label={showList ? en.list.collapse : en.list.expand}
                >
                    {showList ? '▲' : '▼'}
                </button>
            </div>

            <div className={`list-body ${showList ? 'open' : ''}`} id="items-body">
                <div className="inner">
                    {loading && <p className="muted">{en.list.loading}</p>}

                    {!loading && items.length === 0 && (
                        <div className="empty-state">
                            <span className="emoji" aria-hidden="true">🛍️</span>
                            {en.list.empty}
                        </div>
                    )}

                    {!loading &&
                        items.map((item) => (
                            <div className="item-row" key={item.id}>
                                <span className="name">{item.item_name}</span>
                                <div className="item-actions">
                                    <button
                                        className="btn-icon"
                                        onClick={() => setEditItem(item)}
                                        aria-label={en.list.edit}
                                    >
                                        ✏️
                                    </button>
                                    <button
                                        className="btn-icon"
                                        onClick={() => handleDelete(item.id)}
                                        aria-label={en.list.delete}
                                    >
                                        🗑️
                                    </button>
                                </div>
                            </div>
                        ))}

                    {editItem && (
                        <div className="edit-box">
                            <h4>{en.list.editTitle}</h4>
                            <input
                                className="field"
                                autoFocus
                                value={editItem.item_name}
                                onChange={(e) => setEditItem({ ...editItem, item_name: e.target.value })}
                                onKeyDown={(e) => e.key === 'Enter' && handleUpdate()}
                            />
                            <div className="edit-actions">
                                <button className="btn btn-primary" onClick={handleUpdate}>
                                    {en.list.save}
                                </button>
                                <button className="btn btn-secondary" onClick={() => setEditItem(null)}>
                                    {en.list.cancel}
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
};

export default ShoppingListPage;
