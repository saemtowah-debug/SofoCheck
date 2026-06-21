import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, apiRequest } from '../context/AuthContext';
import './Home.css';

export default function Home() {
    const { user, logout } = useAuth();
    const navigate = useNavigate();
    const [availability, setAvailability] = useState(null);
    const [location, setLocation] = useState(null);
    const [locationError, setLocationError] = useState('');
    const [loading, setLoading] = useState(false);
    const [checking, setChecking] = useState(true);
    const [success, setSuccess] = useState(null);
    const [streak, setStreak] = useState(0);
    const [birthday, setBirthday] = useState(null);
    const [milestones, setMilestones] = useState(null);
    const [birthdaysThisWeek, setBirthdaysThisWeek] = useState([]);

    useEffect(() => {
        checkAvailability();
        getLocation();
        fetchStreak();
        fetchBirthdayCheck();
        fetchMilestones();
        fetchBirthdaysThisWeek();
    }, []);

    const fetchStreak = async () => {
        try {
            const data = await apiRequest('/attendance/history?limit=1');
            setStreak(data.streak || 0);
        } catch (err) {
            console.error('Failed to fetch streak:', err);
        }
    };

    const fetchBirthdayCheck = async () => {
        try {
            const data = await apiRequest('/members/birthday-check');
            setBirthday(data);
        } catch (err) {
            console.error('Failed to check birthday:', err);
        }
    };

    const fetchMilestones = async () => {
        try {
            const data = await apiRequest('/members/stats');
            setMilestones(data);
        } catch (err) {
            console.error('Failed to fetch milestones:', err);
        }
    };

    const fetchBirthdaysThisWeek = async () => {
        try {
            const data = await apiRequest('/members/birthdays-this-week');
            setBirthdaysThisWeek(data.birthdays || []);
        } catch (err) {
            console.error('Failed to fetch birthdays:', err);
        }
    };

    const checkAvailability = async () => {
        try {
            const data = await apiRequest('/attendance/availability');
            setAvailability(data);
        } catch (err) {
            console.error('Failed to check availability:', err);
        } finally {
            setChecking(false);
        }
    };

    const getLocation = () => {
        if (!navigator.geolocation) {
            setLocationError('Geolocation is not supported by your browser');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLocation({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude,
                    accuracy: position.coords.accuracy
                });
                setLocationError('');
            },
            (error) => {
                switch (error.code) {
                    case error.PERMISSION_DENIED:
                        setLocationError('Please enable location access to mark attendance');
                        break;
                    case error.POSITION_UNAVAILABLE:
                        setLocationError('Location information is unavailable');
                        break;
                    case error.TIMEOUT:
                        setLocationError('Location request timed out');
                        break;
                    default:
                        setLocationError('An error occurred getting your location');
                }
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    };

    const handleCheckIn = async () => {
        setLoading(true);
        setLocationError('');

        // Use actual location or fallback coordinates for testing
        const coords = location || { latitude: 0, longitude: 0, accuracy: 0 };

        try {
            const data = await apiRequest('/attendance/check-in', {
                method: 'POST',
                body: JSON.stringify(coords)
            });
            setSuccess(data);
            setAvailability({ ...availability, available: false, reason: 'already_checked_in' });
        } catch (err) {
            setLocationError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good morning';
        if (hour < 17) return 'Good afternoon';
        return 'Good evening';
    };

    const getFirstName = () => {
        if (!user?.full_name) return '';
        const parts = user.full_name.split(' ');
        // Return first name with appropriate title
        return parts[0];
    };

    if (success) {
        return (
            <div className="home-page success-page">
                <div className="success-container animate-slideUp">
                    <div className="success-checkmark">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                    </div>

                    <h1>Attendance Recorded!</h1>
                    <p className="success-time">
                        {new Date(success.checked_in_at).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit'
                        })}
                    </p>

                    <div className="scripture-quote">
                        <p>"Enter His gates with thanksgiving and His courts with praise..."</p>
                        <cite>— Psalm 100:4</cite>
                    </div>

                    <button className="btn btn-primary" onClick={() => setSuccess(null)}>
                        Continue
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="home-page">
            <header className="home-header">
                <div className="header-content">
                    <div className="brand">
                        <span className="logo-icon">✝</span>
                        <span className="brand-name">SofoCheck</span>
                    </div>
                    <div className="header-actions">
                        <button className="btn btn-ghost" onClick={() => navigate('/history')}>
                            History
                        </button>
                        <button className="btn btn-ghost" onClick={() => navigate('/profile')}>
                            Profile
                        </button>
                        <button className="btn btn-ghost" onClick={handleLogout}>
                            Logout
                        </button>
                    </div>
                </div>
            </header>

            <main className="home-main">
                {/* Birthday Banner */}
                {birthday?.hasBirthday && (
                    <div className="birthday-banner animate-slideUp">
                        <span className="birthday-icon">🎂</span>
                        <div className="birthday-text">
                            {birthday.isToday ? (
                                <>
                                    <strong>Happy Birthday, {getFirstName()}!</strong>
                                    <p>May God bless you abundantly on your special day! 🎉</p>
                                </>
                            ) : birthday.daysUntil > 0 ? (
                                <>
                                    <strong>Birthday Coming Up!</strong>
                                    <p>Your birthday is in {birthday.daysUntil} day{birthday.daysUntil > 1 ? 's' : ''}! 🎈</p>
                                </>
                            ) : (
                                <>
                                    <strong>Happy Belated Birthday!</strong>
                                    <p>Hope you had a wonderful celebration! 🎊</p>
                                </>
                            )}
                        </div>
                    </div>
                )}

                <div className="welcome-section">
                    <h1>{getGreeting()}, {getFirstName()} 👋</h1>
                    <div className="welcome-badges">
                        {streak > 0 && (
                            <div className="streak-badge">
                                <span className="streak-fire">🔥</span>
                                <span>{streak} week streak</span>
                            </div>
                        )}
                        {milestones?.milestones?.latest && (
                            <div className="milestone-badge">
                                <span>{milestones.milestones.latest.icon}</span>
                                <span>{milestones.milestones.latest.name}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Milestone Progress */}
                {milestones?.milestones?.next && (
                    <div className="milestone-progress-card">
                        <div className="milestone-header">
                            <span>Next: {milestones.milestones.next.icon} {milestones.milestones.next.name}</span>
                            <span className="milestone-count">{milestones.total_attendance}/{milestones.milestones.next.count}</span>
                        </div>
                        <div className="progress-bar">
                            <div
                                className="progress-fill"
                                style={{ width: `${milestones.milestones.progress}%` }}
                            ></div>
                        </div>
                    </div>
                )}

                <div className="attendance-card">
                    {checking ? (
                        <div className="loading-state">
                            <div className="spinner"></div>
                            <p>Checking service availability...</p>
                        </div>
                    ) : availability?.available ? (
                        <>
                            <h2>{availability.session?.name || 'Service Today'}</h2>
                            <p className="session-time">
                                {availability.session?.start_time} - {availability.session?.end_time}
                            </p>

                            {locationError ? (
                                <div className="location-error">
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                                        <circle cx="12" cy="10" r="3" />
                                    </svg>
                                    <p>{locationError}</p>
                                    <button className="btn btn-outline" onClick={getLocation}>
                                        Enable Location
                                    </button>
                                </div>
                            ) : (
                                <>
                                    <button
                                        className="btn btn-golden attendance-button animate-pulse"
                                        onClick={handleCheckIn}
                                        disabled={loading}
                                    >
                                        {loading ? 'Marking...' : '✓ Mark Attendance'}
                                    </button>

                                    <p className="location-status">
                                        {location ? '📍 Location enabled' : '📍 Getting location...'}
                                    </p>
                                </>
                            )}
                        </>
                    ) : (
                        <div className="not-available">
                            {availability?.reason === 'already_checked_in' ? (
                                <>
                                    <div className="already-checked">
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                            <polyline points="22 4 12 14.01 9 11.01" />
                                        </svg>
                                        <h3>Already Checked In!</h3>
                                    </div>
                                    <p>You've already marked your attendance today. Welcome back!</p>
                                </>
                            ) : availability?.reason === 'outside_time' ? (
                                <>
                                    <h3>{availability.session?.name || 'Service'}</h3>
                                    <p>{availability.message}</p>
                                </>
                            ) : (
                                <>
                                    <h3>No Service Today</h3>
                                    <p>{availability?.message || 'Check back on service days.'}</p>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Birthdays This Week */}
                {birthdaysThisWeek.length > 0 && (
                    <div className="birthdays-section">
                        <h3>🎂 Birthdays This Week</h3>
                        <div className="birthdays-list">
                            {birthdaysThisWeek.slice(0, 5).map((b, i) => (
                                <div key={i} className={`birthday-item ${b.isToday ? 'today' : ''}`}>
                                    <span className="birthday-name">{b.name}</span>
                                    <span className="birthday-date">
                                        {b.isToday ? '🎉 Today!' : b.daysUntil === 1 ? 'Tomorrow' : `${b.date}`}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <div className="quick-links">
                    <button className="quick-link-card" onClick={() => navigate('/history')}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <circle cx="12" cy="12" r="10" />
                            <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span>Attendance History</span>
                    </button>
                    <button className="quick-link-card" onClick={() => navigate('/profile')}>
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                            <circle cx="12" cy="7" r="4" />
                        </svg>
                        <span>Profile Settings</span>
                    </button>
                </div>
            </main>
        </div>
    );
}
