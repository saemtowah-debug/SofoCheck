import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, apiRequest } from '../context/AuthContext';
import './History.css';

export default function History() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [records, setRecords] = useState([]);
    const [streak, setStreak] = useState(0);
    const [total, setTotal] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const data = await apiRequest('/attendance/history?limit=100');
            setRecords(data.records);
            setStreak(data.streak);
            setTotal(data.total);
        } catch (err) {
            console.error('Failed to fetch history:', err);
        } finally {
            setLoading(false);
        }
    };

    const formatDate = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });
    };

    const formatTime = (dateStr) => {
        const date = new Date(dateStr);
        return date.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    return (
        <div className="history-page">
            <header className="page-header">
                <button className="btn btn-ghost back-btn" onClick={() => navigate('/')}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="19" y1="12" x2="5" y2="12" />
                        <polyline points="12 19 5 12 12 5" />
                    </svg>
                    Back
                </button>
                <h1>Attendance History</h1>
            </header>

            <main className="history-main">
                <div className="stats-cards">
                    <div className="stat-card">
                        <span className="stat-value">{total}</span>
                        <span className="stat-label">Total Attendances</span>
                    </div>
                    <div className="stat-card golden">
                        <span className="stat-icon">🔥</span>
                        <span className="stat-value">{streak}</span>
                        <span className="stat-label">Week Streak</span>
                    </div>
                </div>

                {loading ? (
                    <div className="loading-state">
                        <div className="spinner"></div>
                        <p>Loading history...</p>
                    </div>
                ) : records.length === 0 ? (
                    <div className="empty-state">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <h3>No attendance records yet</h3>
                        <p>Mark your first attendance at Sunday service!</p>
                    </div>
                ) : (
                    <div className="history-list">
                        {records.map((record) => (
                            <div key={record.id} className="history-item">
                                <div className="history-check">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                </div>
                                <div className="history-details">
                                    <span className="history-session">{record.session_name || 'Service'}</span>
                                    <span className="history-date">{formatDate(record.checked_in_at)}</span>
                                </div>
                                <span className="history-time">{formatTime(record.checked_in_at)}</span>
                            </div>
                        ))}
                    </div>
                )}
            </main>
        </div>
    );
}
