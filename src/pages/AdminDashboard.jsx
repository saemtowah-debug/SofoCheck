import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, apiRequest } from '../context/AuthContext';
import './Admin.css';

export default function AdminDashboard() {
    const { user, logout, isAdmin } = useAuth();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState('dashboard');
    const [stats, setStats] = useState(null);
    const [members, setMembers] = useState([]);
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [liveCount, setLiveCount] = useState(0);
    const [recentCheckins, setRecentCheckins] = useState([]);
    const wsRef = useRef(null);

    useEffect(() => {
        if (!isAdmin) {
            navigate('/admin/login');
            return;
        }

        fetchDashboard();
        connectWebSocket();

        return () => {
            if (wsRef.current) {
                wsRef.current.close();
            }
        };
    }, [isAdmin]);

    const connectWebSocket = () => {
        try {
            wsRef.current = new WebSocket('ws://localhost:3000/api/attendance/live');

            wsRef.current.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'count') {
                    setLiveCount(data.count);
                } else if (data.type === 'checkin') {
                    setLiveCount(data.count);
                    setRecentCheckins(prev => [data.member, ...prev.slice(0, 9)]);
                }
            };

            wsRef.current.onerror = () => {
                console.log('WebSocket error - will retry');
            };
        } catch (err) {
            console.error('Failed to connect WebSocket:', err);
        }
    };

    const fetchDashboard = async () => {
        try {
            const data = await apiRequest('/admin/dashboard');
            setStats(data.stats);
            setRecentCheckins(data.recent_checkins.map(c => ({ name: c.full_name, time: c.checked_in_at })));
            setLiveCount(data.stats.today_attendance);
        } catch (err) {
            console.error('Failed to fetch dashboard:', err);
        } finally {
            setLoading(false);
        }
    };

    const fetchMembers = async (search = '') => {
        try {
            const data = await apiRequest(`/admin/members?search=${search}&limit=100`);
            setMembers(data.members);
        } catch (err) {
            console.error('Failed to fetch members:', err);
        }
    };

    const fetchSessions = async () => {
        try {
            const data = await apiRequest('/sessions');
            setSessions(data.sessions);
        } catch (err) {
            console.error('Failed to fetch sessions:', err);
        }
    };

    const handleTabChange = (tab) => {
        setActiveTab(tab);
        if (tab === 'members' && members.length === 0) {
            fetchMembers();
        } else if (tab === 'sessions' && sessions.length === 0) {
            fetchSessions();
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/admin/login');
    };

    const formatTime = (dateStr) => {
        return new Date(dateStr).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit'
        });
    };

    if (loading) {
        return (
            <div className="admin-loading">
                <div className="spinner"></div>
                <p>Loading dashboard...</p>
            </div>
        );
    }

    return (
        <div className="admin-page">
            <aside className="admin-sidebar">
                <div className="sidebar-header">
                    <span className="logo-icon">✝</span>
                    <span className="brand-name">SofoCheck</span>
                </div>

                <nav className="sidebar-nav">
                    <button
                        className={`nav-item ${activeTab === 'dashboard' ? 'active' : ''}`}
                        onClick={() => handleTabChange('dashboard')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="3" width="7" height="7" />
                            <rect x="14" y="3" width="7" height="7" />
                            <rect x="14" y="14" width="7" height="7" />
                            <rect x="3" y="14" width="7" height="7" />
                        </svg>
                        Dashboard
                    </button>

                    <button
                        className={`nav-item ${activeTab === 'members' ? 'active' : ''}`}
                        onClick={() => handleTabChange('members')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                            <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        Members
                    </button>

                    <button
                        className={`nav-item ${activeTab === 'sessions' ? 'active' : ''}`}
                        onClick={() => handleTabChange('sessions')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                            <line x1="16" y1="2" x2="16" y2="6" />
                            <line x1="8" y1="2" x2="8" y2="6" />
                            <line x1="3" y1="10" x2="21" y2="10" />
                        </svg>
                        Sessions
                    </button>

                    <button
                        className={`nav-item ${activeTab === 'reports' ? 'active' : ''}`}
                        onClick={() => handleTabChange('reports')}
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="20" x2="18" y2="10" />
                            <line x1="12" y1="20" x2="12" y2="4" />
                            <line x1="6" y1="20" x2="6" y2="14" />
                        </svg>
                        Reports
                    </button>
                </nav>

                <div className="sidebar-footer">
                    <span className="admin-name">{user?.full_name}</span>
                    <button className="btn btn-ghost" onClick={handleLogout}>Logout</button>
                </div>
            </aside>

            <main className="admin-main">
                {activeTab === 'dashboard' && (
                    <DashboardView
                        stats={stats}
                        liveCount={liveCount}
                        recentCheckins={recentCheckins}
                        formatTime={formatTime}
                    />
                )}

                {activeTab === 'members' && (
                    <MembersView
                        members={members}
                        onSearch={fetchMembers}
                    />
                )}

                {activeTab === 'sessions' && (
                    <SessionsView
                        sessions={sessions}
                        onRefresh={fetchSessions}
                    />
                )}

                {activeTab === 'reports' && (
                    <ReportsView />
                )}
            </main>
        </div>
    );
}

function DashboardView({ stats, liveCount, recentCheckins, formatTime }) {
    return (
        <div className="dashboard-view">
            <header className="view-header">
                <h1>Dashboard</h1>
                <span className="live-indicator">
                    <span className="live-dot"></span>
                    Live
                </span>
            </header>

            <div className="stats-grid">
                <div className="stat-card large live">
                    <span className="stat-label">Checked In Today</span>
                    <span className="stat-value">{liveCount}</span>
                    <span className="stat-sublabel">Live count</span>
                </div>

                <div className="stat-card">
                    <span className="stat-label">Total Members</span>
                    <span className="stat-value">{stats?.total_members || 0}</span>
                </div>

                <div className="stat-card">
                    <span className="stat-label">This Week</span>
                    <span className="stat-value">{stats?.week_attendance || 0}</span>
                </div>
            </div>

            <div className="dashboard-section">
                <h2>Recent Check-ins</h2>
                <div className="checkins-list">
                    {recentCheckins.length === 0 ? (
                        <p className="empty-message">No check-ins today yet</p>
                    ) : (
                        recentCheckins.map((checkin, i) => (
                            <div key={i} className="checkin-item">
                                <span className="checkin-icon">✓</span>
                                <span className="checkin-name">{checkin.name}</span>
                                <span className="checkin-time">{formatTime(checkin.time)}</span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

function MembersView({ members, onSearch }) {
    const [search, setSearch] = useState('');

    const handleSearch = (e) => {
        e.preventDefault();
        onSearch(search);
    };

    return (
        <div className="members-view">
            <header className="view-header">
                <h1>Members</h1>
                <span className="member-count">{members.length} members</span>
            </header>

            <form className="search-form" onSubmit={handleSearch}>
                <input
                    type="text"
                    placeholder="Search by name or phone..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
                <button type="submit" className="btn btn-primary">Search</button>
            </form>

            <div className="members-table">
                <table>
                    <thead>
                        <tr>
                            <th>Name</th>
                            <th>Phone</th>
                            <th>Birthday</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        {members.map(member => (
                            <tr key={member.id}>
                                <td>{member.full_name}</td>
                                <td>{member.phone_number}</td>
                                <td>{member.birthday ? new Date(member.birthday).toLocaleDateString() : '-'}</td>
                                <td>
                                    <span className={`status-badge ${member.is_active ? 'active' : 'inactive'}`}>
                                        {member.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

function SessionsView({ sessions, onRefresh }) {
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        name: '',
        day_of_week: 'Sunday',
        start_time: '07:00',
        end_time: '14:00'
    });
    const [error, setError] = useState('');

    const validateTimes = () => {
        const [startH, startM] = formData.start_time.split(':').map(Number);
        const [endH, endM] = formData.end_time.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        if (endMinutes <= startMinutes) {
            return 'End time must be after start time';
        }
        return null;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const timeError = validateTimes();
        if (timeError) {
            setError(timeError);
            return;
        }

        try {
            await apiRequest('/sessions', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            setShowForm(false);
            setFormData({ name: '', day_of_week: 'Sunday', start_time: '07:00', end_time: '14:00' });
            onRefresh();
        } catch (err) {
            setError(err.message);
        }
    };

    const toggleSession = async (id, isActive) => {
        try {
            await apiRequest(`/sessions/${id}`, {
                method: 'PATCH',
                body: JSON.stringify({ is_active: !isActive })
            });
            onRefresh();
        } catch (err) {
            alert(err.message);
        }
    };

    return (
        <div className="sessions-view">
            <header className="view-header">
                <h1>Attendance Sessions</h1>
                <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
                    {showForm ? 'Cancel' : '+ Add Session'}
                </button>
            </header>

            {showForm && (
                <form className="session-form card" onSubmit={handleSubmit}>
                    {error && <div className="auth-error" style={{ marginBottom: 'var(--space-md)' }}>{error}</div>}
                    <div className="form-row">
                        <div className="form-group">
                            <label>Session Name</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                placeholder="e.g., Sunday Worship"
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>Day of Week</label>
                            <select
                                value={formData.day_of_week}
                                onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value })}
                            >
                                {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => (
                                    <option key={day} value={day}>{day}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label>Start Time</label>
                            <input
                                type="time"
                                value={formData.start_time}
                                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label>End Time</label>
                            <input
                                type="time"
                                value={formData.end_time}
                                onChange={(e) => setFormData({ ...formData, end_time: e.target.value })}
                                required
                            />
                        </div>
                    </div>
                    <button type="submit" className="btn btn-primary">Create Session</button>
                </form>
            )}

            <div className="sessions-list">
                {sessions.map(session => (
                    <div key={session.id} className={`session-card ${session.is_active ? 'active' : 'inactive'}`}>
                        <div className="session-info">
                            <h3>{session.name}</h3>
                            <p>{session.day_of_week} • {session.start_time} - {session.end_time}</p>
                        </div>
                        <button
                            className={`btn ${session.is_active ? 'btn-outline' : 'btn-primary'}`}
                            onClick={() => toggleSession(session.id, session.is_active)}
                        >
                            {session.is_active ? 'Deactivate' : 'Activate'}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}

function ReportsView() {
    const [report, setReport] = useState(null);
    const [reportType, setReportType] = useState('weekly');
    const [loading, setLoading] = useState(false);

    const fetchReport = async () => {
        setLoading(true);
        try {
            const data = await apiRequest(`/reports/${reportType}`);
            setReport(data);
        } catch (err) {
            console.error('Failed to fetch report:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleExport = async (type) => {
        try {
            const data = await apiRequest('/reports/export', {
                method: 'POST',
                body: JSON.stringify({ type, format: 'csv' })
            });

            // Download CSV
            const blob = new Blob([data], { type: 'text/csv' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${type}_export.csv`;
            a.click();
        } catch (err) {
            console.error('Export failed:', err);
        }
    };

    return (
        <div className="reports-view">
            <header className="view-header">
                <h1>Reports</h1>
            </header>

            <div className="report-controls">
                <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
                    <option value="weekly">Weekly Report</option>
                    <option value="monthly">Monthly Report</option>
                    <option value="patterns">Attendance Patterns</option>
                </select>
                <button className="btn btn-primary" onClick={fetchReport}>
                    {loading ? 'Loading...' : 'Generate Report'}
                </button>
            </div>

            {report && (
                <div className="report-content card">
                    <h2>{report.period?.month || `${report.period?.start} to ${report.period?.end}`}</h2>

                    <div className="report-stats">
                        <div className="report-stat">
                            <span className="label">Total Attendance</span>
                            <span className="value">{report.metrics?.total_attendance}</span>
                        </div>
                        <div className="report-stat">
                            <span className="label">Unique Members</span>
                            <span className="value">{report.metrics?.unique_members}</span>
                        </div>
                        {report.metrics?.change_from_previous_week !== undefined && (
                            <div className="report-stat">
                                <span className="label">Change</span>
                                <span className={`value ${report.metrics.change_from_previous_week >= 0 ? 'positive' : 'negative'}`}>
                                    {report.metrics.change_from_previous_week >= 0 ? '+' : ''}{report.metrics.change_from_previous_week}%
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="export-section">
                <h3>Export Data</h3>
                <div className="export-buttons">
                    <button className="btn btn-outline" onClick={() => handleExport('members')}>
                        Export Members
                    </button>
                    <button className="btn btn-outline" onClick={() => handleExport('attendance')}>
                        Export Attendance
                    </button>
                </div>
            </div>
        </div>
    );
}
