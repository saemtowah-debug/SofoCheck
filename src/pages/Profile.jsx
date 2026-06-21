import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, apiRequest } from '../context/AuthContext';
import './History.css';

export default function Profile() {
    const { user, logout, fetchUser } = useAuth();
    const navigate = useNavigate();
    const [editing, setEditing] = useState(false);
    const [formData, setFormData] = useState({
        full_name: '',
        email: '',
        birthday: ''
    });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        if (user) {
            setFormData({
                full_name: user.full_name || '',
                email: user.email || '',
                birthday: user.birthday || ''
            });
        }
    }, [user]);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        try {
            await apiRequest('/members/profile', {
                method: 'PATCH',
                body: JSON.stringify(formData)
            });
            setMessage('Profile updated successfully!');
            setEditing(false);
            fetchUser();
        } catch (err) {
            setMessage(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return 'Not set';
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
    };

    return (
        <div className="profile-page">
            <header className="page-header">
                <button className="btn btn-ghost back-btn" onClick={() => navigate('/')}>
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="19" y1="12" x2="5" y2="12" />
                        <polyline points="12 19 5 12 12 5" />
                    </svg>
                    Back
                </button>
                <h1>Profile Settings</h1>
            </header>

            <main className="profile-main">
                {message && (
                    <div className={`toast ${message.includes('success') ? 'toast-success' : 'toast-error'}`} style={{ position: 'static', marginBottom: 'var(--space-lg)' }}>
                        {message}
                    </div>
                )}

                <div className="profile-section">
                    <h2>Personal Information</h2>

                    {editing ? (
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label htmlFor="full_name">Full Name</label>
                                <input
                                    type="text"
                                    id="full_name"
                                    name="full_name"
                                    value={formData.full_name}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="email">Email</label>
                                <input
                                    type="email"
                                    id="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="form-group">
                                <label htmlFor="birthday">Birthday</label>
                                <input
                                    type="date"
                                    id="birthday"
                                    name="birthday"
                                    value={formData.birthday}
                                    onChange={handleChange}
                                    required
                                />
                            </div>

                            <div className="flex gap-md" style={{ marginTop: 'var(--space-lg)' }}>
                                <button type="submit" className="btn btn-primary" disabled={loading}>
                                    {loading ? 'Saving...' : 'Save Changes'}
                                </button>
                                <button type="button" className="btn btn-outline" onClick={() => setEditing(false)}>
                                    Cancel
                                </button>
                            </div>
                        </form>
                    ) : (
                        <>
                            <div className="profile-info">
                                <div className="profile-field">
                                    <label>Full Name</label>
                                    <span>{user?.full_name || 'Not set'}</span>
                                </div>
                                <div className="profile-field">
                                    <label>Phone Number</label>
                                    <span>{user?.phone_number}</span>
                                </div>
                                <div className="profile-field">
                                    <label>Email</label>
                                    <span>{user?.email || 'Not set'}</span>
                                </div>
                                <div className="profile-field">
                                    <label>Birthday</label>
                                    <span>{formatDate(user?.birthday)}</span>
                                </div>
                            </div>
                            <button
                                className="btn btn-outline"
                                style={{ marginTop: 'var(--space-lg)', width: '100%' }}
                                onClick={() => setEditing(true)}
                            >
                                Edit Profile
                            </button>
                        </>
                    )}
                </div>

                <div className="profile-section">
                    <h2>Account</h2>
                    <div className="profile-actions">
                        <button className="btn btn-outline" onClick={() => navigate('/change-password')}>
                            Change Password
                        </button>
                        <button className="btn btn-outline logout-btn" onClick={handleLogout}>
                            Log Out
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
}
