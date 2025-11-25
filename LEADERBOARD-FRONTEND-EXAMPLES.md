# 🎨 Leaderboard - Ejemplos de Frontend

Este documento contiene ejemplos completos y listos para usar en tu frontend.

---

## 🚀 Ejemplo Completo en React

### Componente Principal del Leaderboard

```jsx
import React, { useState, useEffect } from 'react';
import './Leaderboard.css';

const Leaderboard = () => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [myPosition, setMyPosition] = useState(null);
  const [stats, setStats] = useState(null);
  const [page, setPage] = useState(0);
  const ITEMS_PER_PAGE = 50;

  useEffect(() => {
    fetchLeaderboard();
    fetchMyPosition();
    fetchStats();
    
    // Auto-refresh cada 5 minutos
    const interval = setInterval(fetchLeaderboard, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [page]);

  const fetchLeaderboard = async () => {
    try {
      setLoading(true);
      const response = await fetch(
        `/api/leaderboard?limit=${ITEMS_PER_PAGE}&offset=${page * ITEMS_PER_PAGE}`
      );
      const data = await response.json();
      
      if (data.success) {
        setLeaderboard(data.data);
      } else {
        setError('Error al cargar el leaderboard');
      }
    } catch (err) {
      setError('Error de conexión');
      console.error('Error fetching leaderboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchMyPosition = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('/api/leaderboard/me', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      const data = await response.json();
      
      if (data.success && data.data) {
        setMyPosition(data.data);
      }
    } catch (err) {
      console.error('Error fetching my position:', err);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/leaderboard/stats');
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
    }
  };

  const renderChangeIndicator = (user) => {
    const { change_indicator, position_change } = user;

    switch (change_indicator) {
      case 'up':
        return (
          <div className="change-indicator up">
            <span className="arrow">↑</span>
            <span className="number">{position_change}</span>
          </div>
        );
      
      case 'down':
        return (
          <div className="change-indicator down">
            <span className="arrow">↓</span>
            <span className="number">{position_change}</span>
          </div>
        );
      
      case 'new':
        return (
          <div className="change-indicator new">
            <span className="star">⭐</span>
            <span className="text">NUEVO</span>
          </div>
        );
      
      default:
        return (
          <div className="change-indicator neutral">
            <span>—</span>
          </div>
        );
    }
  };

  const renderPositionBadge = (position) => {
    let className = 'position-badge';
    let emoji = '';

    if (position === 1) {
      className += ' gold';
      emoji = '🥇';
    } else if (position === 2) {
      className += ' silver';
      emoji = '🥈';
    } else if (position === 3) {
      className += ' bronze';
      emoji = '🥉';
    }

    return (
      <div className={className}>
        {emoji && <span className="medal">{emoji}</span>}
        <span className="number">#{position}</span>
      </div>
    );
  };

  const renderUserAvatar = (user) => {
    const avatarUrl = user.kick_data?.profile_pic;
    
    if (avatarUrl) {
      return (
        <img 
          src={avatarUrl} 
          alt={user.nickname}
          className="user-avatar"
          onError={(e) => {
            e.target.src = '/default-avatar.png'; // Fallback
          }}
        />
      );
    }

    // Avatar por defecto con inicial
    return (
      <div className="user-avatar-placeholder">
        {user.nickname.charAt(0).toUpperCase()}
      </div>
    );
  };

  if (loading && leaderboard.length === 0) {
    return (
      <div className="leaderboard-container">
        <div className="loading">
          <div className="spinner"></div>
          <p>Cargando leaderboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="leaderboard-container">
        <div className="error">
          <p>❌ {error}</p>
          <button onClick={fetchLeaderboard}>Reintentar</button>
        </div>
      </div>
    );
  }

  return (
    <div className="leaderboard-container">
      {/* Header con estadísticas */}
      <div className="leaderboard-header">
        <h1>🏆 Tabla de Clasificación</h1>
        {stats && (
          <div className="stats-bar">
            <div className="stat">
              <span className="label">Total Usuarios</span>
              <span className="value">{stats.total_users.toLocaleString()}</span>
            </div>
            <div className="stat">
              <span className="label">Total Puntos</span>
              <span className="value">{stats.total_points.toLocaleString()}</span>
            </div>
            <div className="stat">
              <span className="label">Promedio</span>
              <span className="value">{stats.average_points.toLocaleString()}</span>
            </div>
          </div>
        )}
      </div>

      {/* Mi Posición (destacado) */}
      {myPosition && (
        <div className="my-position-card">
          <div className="card-header">
            <h3>Tu Posición Actual</h3>
            {renderChangeIndicator(myPosition)}
          </div>
          <div className="card-body">
            <div className="position-display">
              {renderPositionBadge(myPosition.position)}
            </div>
            <div className="user-info">
              {renderUserAvatar(myPosition)}
              <div className="details">
                <h4>{myPosition.nickname}</h4>
                <p className="points">{myPosition.puntos.toLocaleString()} puntos</p>
              </div>
            </div>
            {myPosition.previous_position && (
              <div className="comparison">
                <span>Posición anterior: #{myPosition.previous_position}</span>
                <span>Puntos anteriores: {myPosition.previous_points?.toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tabla del Leaderboard */}
      <div className="leaderboard-table-container">
        <table className="leaderboard-table">
          <thead>
            <tr>
              <th>Posición</th>
              <th>Usuario</th>
              <th>Puntos</th>
              <th>Cambio</th>
            </tr>
          </thead>
          <tbody>
            {leaderboard.map((user) => (
              <tr 
                key={user.usuario_id}
                className={`
                  ${user.usuario_id === myPosition?.usuario_id ? 'highlighted' : ''}
                  ${user.position <= 3 ? 'top-three' : ''}
                `}
              >
                <td className="position-cell">
                  {renderPositionBadge(user.position)}
                </td>
                
                <td className="user-cell">
                  <div className="user-info">
                    {renderUserAvatar(user)}
                    <div className="user-details">
                      <span className="nickname">
                        {user.nickname}
                        {user.is_vip && (
                          <span className="vip-badge" title="Usuario VIP">
                            👑 VIP
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </td>
                
                <td className="points-cell">
                  <span className="points-value">
                    {user.puntos.toLocaleString()}
                  </span>
                  <span className="points-label">pts</span>
                </td>
                
                <td className="change-cell">
                  {renderChangeIndicator(user)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Paginación */}
      <div className="pagination">
        <button 
          onClick={() => setPage(p => Math.max(0, p - 1))}
          disabled={page === 0}
          className="btn-pagination"
        >
          ← Anterior
        </button>
        <span className="page-info">
          Mostrando {page * ITEMS_PER_PAGE + 1} - {page * ITEMS_PER_PAGE + leaderboard.length}
        </span>
        <button 
          onClick={() => setPage(p => p + 1)}
          disabled={leaderboard.length < ITEMS_PER_PAGE}
          className="btn-pagination"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
};

export default Leaderboard;
```

---

## 🎨 CSS Completo (Leaderboard.css)

```css
.leaderboard-container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

/* Header */
.leaderboard-header {
  text-align: center;
  margin-bottom: 30px;
}

.leaderboard-header h1 {
  font-size: 2.5rem;
  margin-bottom: 20px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.stats-bar {
  display: flex;
  justify-content: center;
  gap: 40px;
  padding: 20px;
  background: #f8f9fa;
  border-radius: 12px;
}

.stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.stat .label {
  font-size: 0.875rem;
  color: #6c757d;
  margin-bottom: 5px;
}

.stat .value {
  font-size: 1.5rem;
  font-weight: bold;
  color: #212529;
}

/* Mi Posición Card */
.my-position-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 30px;
  border-radius: 16px;
  margin-bottom: 30px;
  box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
}

.my-position-card .card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.my-position-card h3 {
  margin: 0;
  font-size: 1.5rem;
}

.my-position-card .card-body {
  display: flex;
  align-items: center;
  gap: 30px;
}

.position-display {
  font-size: 3rem;
  font-weight: bold;
}

.my-position-card .user-info {
  display: flex;
  align-items: center;
  gap: 15px;
  flex: 1;
}

.my-position-card .details h4 {
  margin: 0 0 5px 0;
  font-size: 1.5rem;
}

.my-position-card .points {
  margin: 0;
  font-size: 1.25rem;
  opacity: 0.9;
}

.my-position-card .comparison {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 0.875rem;
  opacity: 0.8;
}

/* Tabla */
.leaderboard-table-container {
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.leaderboard-table {
  width: 100%;
  border-collapse: collapse;
}

.leaderboard-table thead {
  background: #f8f9fa;
}

.leaderboard-table th {
  padding: 16px;
  text-align: left;
  font-weight: 600;
  color: #495057;
  text-transform: uppercase;
  font-size: 0.75rem;
  letter-spacing: 0.5px;
}

.leaderboard-table tbody tr {
  border-bottom: 1px solid #e9ecef;
  transition: all 0.2s ease;
}

.leaderboard-table tbody tr:hover {
  background: #f8f9fa;
}

.leaderboard-table tbody tr.highlighted {
  background: rgba(102, 126, 234, 0.1);
  border-left: 4px solid #667eea;
}

.leaderboard-table tbody tr.top-three {
  background: rgba(255, 215, 0, 0.05);
}

.leaderboard-table td {
  padding: 16px;
}

/* Position Badge */
.position-badge {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-weight: bold;
  font-size: 1.125rem;
}

.position-badge.gold {
  color: #FFD700;
}

.position-badge.gold .medal {
  font-size: 1.5rem;
}

.position-badge.silver {
  color: #C0C0C0;
}

.position-badge.silver .medal {
  font-size: 1.5rem;
}

.position-badge.bronze {
  color: #CD7F32;
}

.position-badge.bronze .medal {
  font-size: 1.5rem;
}

/* User Info */
.user-cell .user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.user-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  object-fit: cover;
  border: 2px solid #e9ecef;
}

.user-avatar-placeholder {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: bold;
  font-size: 1.25rem;
}

.user-details {
  display: flex;
  flex-direction: column;
}

.nickname {
  font-weight: 600;
  color: #212529;
  font-size: 1rem;
}

.vip-badge {
  display: inline-block;
  background: linear-gradient(135deg, #FFD700, #FFA500);
  color: #000;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 0.75rem;
  font-weight: bold;
  margin-left: 8px;
}

/* Points */
.points-cell {
  font-weight: 600;
}

.points-value {
  font-size: 1.125rem;
  color: #212529;
}

.points-label {
  font-size: 0.875rem;
  color: #6c757d;
  margin-left: 4px;
}

/* Change Indicators */
.change-indicator {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 12px;
  border-radius: 20px;
  font-weight: bold;
  font-size: 0.875rem;
}

.change-indicator.up {
  background: rgba(34, 197, 94, 0.1);
  color: #16a34a;
}

.change-indicator.up .arrow {
  font-size: 1.25rem;
}

.change-indicator.down {
  background: rgba(239, 68, 68, 0.1);
  color: #dc2626;
}

.change-indicator.down .arrow {
  font-size: 1.25rem;
}

.change-indicator.new {
  background: rgba(234, 179, 8, 0.1);
  color: #ca8a04;
}

.change-indicator.new .star {
  font-size: 1.125rem;
}

.change-indicator.neutral {
  color: #9ca3af;
}

/* Paginación */
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 20px;
  margin-top: 30px;
  padding: 20px;
}

.btn-pagination {
  padding: 10px 20px;
  border: 2px solid #667eea;
  background: white;
  color: #667eea;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-pagination:hover:not(:disabled) {
  background: #667eea;
  color: white;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.3);
}

.btn-pagination:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.page-info {
  font-weight: 500;
  color: #6c757d;
}

/* Loading */
.loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px;
}

.spinner {
  width: 50px;
  height: 50px;
  border: 4px solid #f3f4f6;
  border-top: 4px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* Error */
.error {
  text-align: center;
  padding: 40px;
  color: #dc2626;
}

.error button {
  margin-top: 20px;
  padding: 10px 24px;
  background: #dc2626;
  color: white;
  border: none;
  border-radius: 8px;
  font-weight: 600;
  cursor: pointer;
}

.error button:hover {
  background: #b91c1c;
}

/* Responsive */
@media (max-width: 768px) {
  .leaderboard-container {
    padding: 10px;
  }

  .leaderboard-header h1 {
    font-size: 1.75rem;
  }

  .stats-bar {
    flex-direction: column;
    gap: 15px;
  }

  .my-position-card .card-body {
    flex-direction: column;
    text-align: center;
  }

  .leaderboard-table th,
  .leaderboard-table td {
    padding: 10px 8px;
    font-size: 0.875rem;
  }

  .user-avatar,
  .user-avatar-placeholder {
    width: 36px;
    height: 36px;
  }

  .position-badge .medal {
    font-size: 1.25rem !important;
  }
}
```

---

## 📱 Versión Simplificada (Mobile-First)

```jsx
const SimpleLeaderboard = () => {
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetch('/api/leaderboard/top10')
      .then(res => res.json())
      .then(data => setUsers(data.data));
  }, []);

  return (
    <div className="simple-leaderboard">
      <h2>🏆 Top 10</h2>
      {users.map((user, index) => (
        <div key={user.usuario_id} className="user-row">
          <span className="position">#{user.position}</span>
          <span className="nickname">{user.nickname}</span>
          <span className="points">{user.puntos}</span>
          {user.change_indicator === 'up' && <span className="up">↑</span>}
          {user.change_indicator === 'down' && <span className="down">↓</span>}
        </div>
      ))}
    </div>
  );
};
```

---

## 🔄 Con Auto-Refresh

```jsx
const LiveLeaderboard = () => {
  const [data, setData] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      const res = await fetch('/api/leaderboard?limit=20');
      const json = await res.json();
      setData(json.data);
      setLastUpdate(new Date());
    };

    fetchData();
    const interval = setInterval(fetchData, 2 * 60 * 1000); // Cada 2 minutos

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <div className="update-time">
        Última actualización: {lastUpdate?.toLocaleTimeString()}
      </div>
      {/* Resto del leaderboard */}
    </div>
  );
};
```

---

## 📊 Componente de Historial de Usuario

```jsx
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

const UserHistory = ({ userId }) => {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    fetch(`/api/leaderboard/user/${userId}/history?days=30`)
      .then(res => res.json())
      .then(data => setHistory(data.history));
  }, [userId]);

  const chartData = history.map(h => ({
    date: new Date(h.snapshot_date).toLocaleDateString(),
    position: h.position,
    points: h.puntos
  }));

  return (
    <div className="user-history">
      <h3>Evolución de Posición (últimos 30 días)</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData}>
          <XAxis dataKey="date" />
          <YAxis reversed domain={[1, 'auto']} /> {/* Reversed porque 1 es mejor */}
          <Tooltip />
          <Line 
            type="monotone" 
            dataKey="position" 
            stroke="#667eea" 
            strokeWidth={2}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};
```

---

## 🎯 Widget Compacto para Sidebar

```jsx
const LeaderboardWidget = () => {
  const [top3, setTop3] = useState([]);

  useEffect(() => {
    fetch('/api/leaderboard?limit=3')
      .then(res => res.json())
      .then(data => setTop3(data.data));
  }, []);

  return (
    <div className="leaderboard-widget">
      <h4>🏆 Top 3</h4>
      {top3.map(user => (
        <div key={user.usuario_id} className="mini-user">
          <span className="medal">
            {user.position === 1 ? '🥇' : 
             user.position === 2 ? '🥈' : '🥉'}
          </span>
          <span>{user.nickname}</span>
          <span>{user.puntos}</span>
        </div>
      ))}
      <a href="/leaderboard" className="view-all">
        Ver tabla completa →
      </a>
    </div>
  );
};
```

---

## 🎨 Con Tailwind CSS

```jsx
const TailwindLeaderboard = () => {
  const [users, setUsers] = useState([]);

  const renderIndicator = (user) => {
    if (user.change_indicator === 'up') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
          ↑ {user.position_change}
        </span>
      );
    }
    if (user.change_indicator === 'down') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
          ↓ {user.position_change}
        </span>
      );
    }
    if (user.change_indicator === 'new') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-800">
          ⭐ NUEVO
        </span>
      );
    }
    return <span className="text-gray-400">—</span>;
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <h1 className="text-4xl font-bold text-center mb-8 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
        🏆 Leaderboard
      </h1>
      
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Posición
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Usuario
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Puntos
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                Cambio
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {users.map(user => (
              <tr key={user.usuario_id} className="hover:bg-gray-50 transition">
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`font-bold text-lg ${
                    user.position === 1 ? 'text-yellow-500' :
                    user.position === 2 ? 'text-gray-400' :
                    user.position === 3 ? 'text-orange-600' :
                    'text-gray-700'
                  }`}>
                    #{user.position}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <img 
                      src={user.kick_data?.profile_pic || '/default.png'} 
                      className="w-10 h-10 rounded-full mr-3"
                      alt={user.nickname}
                    />
                    <span className="font-medium">{user.nickname}</span>
                    {user.is_vip && (
                      <span className="ml-2 text-yellow-500">👑</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-gray-900 font-semibold">
                  {user.puntos.toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {renderIndicator(user)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
```

---

## 📱 Ejemplo Vanilla JavaScript (Sin Framework)

```html
<!DOCTYPE html>
<html>
<head>
  <title>Leaderboard</title>
  <style>
    .leaderboard { max-width: 800px; margin: 20px auto; }
    .user-row {
      display: flex;
      justify-content: space-between;
      padding: 15px;
      border-bottom: 1px solid #ddd;
      align-items: center;
    }
    .user-row:hover { background: #f5f5f5; }
    .position { font-weight: bold; font-size: 1.2em; min-width: 50px; }
    .nickname { flex: 1; font-weight: 500; }
    .points { color: #666; margin-right: 15px; }
    .change.up { color: #22c55e; font-weight: bold; }
    .change.down { color: #ef4444; font-weight: bold; }
    .vip { color: gold; margin-left: 5px; }
  </style>
</head>
<body>
  <div class="leaderboard">
    <h1>🏆 Leaderboard</h1>
    <div id="leaderboard-list"></div>
  </div>

  <script>
    async function loadLeaderboard() {
      try {
        const response = await fetch('/api/leaderboard?limit=50');
        const data = await response.json();
        
        const container = document.getElementById('leaderboard-list');
        container.innerHTML = '';
        
        data.data.forEach(user => {
          const row = document.createElement('div');
          row.className = 'user-row';
          
          let changeIndicator = '';
          if (user.change_indicator === 'up') {
            changeIndicator = `<span class="change up">↑${user.position_change}</span>`;
          } else if (user.change_indicator === 'down') {
            changeIndicator = `<span class="change down">↓${user.position_change}</span>`;
          } else if (user.change_indicator === 'new') {
            changeIndicator = `<span class="change new">⭐ NUEVO</span>`;
          }
          
          const vipBadge = user.is_vip ? '<span class="vip">👑</span>' : '';
          
          row.innerHTML = `
            <span class="position">#${user.position}</span>
            <span class="nickname">${user.nickname}${vipBadge}</span>
            <span class="points">${user.puntos.toLocaleString()} pts</span>
            ${changeIndicator}
          `;
          
          container.appendChild(row);
        });
      } catch (error) {
        console.error('Error loading leaderboard:', error);
      }
    }
    
    // Cargar al inicio
    loadLeaderboard();
    
    // Actualizar cada 5 minutos
    setInterval(loadLeaderboard, 5 * 60 * 1000);
  </script>
</body>
</html>
```

---

## 🎯 Tips de UX/UI

### 1. Animaciones de Entrada
```css
@keyframes fadeInUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.user-row {
  animation: fadeInUp 0.3s ease-out;
  animation-fill-mode: both;
}

.user-row:nth-child(1) { animation-delay: 0.05s; }
.user-row:nth-child(2) { animation-delay: 0.1s; }
.user-row:nth-child(3) { animation-delay: 0.15s; }
```

### 2. Destacar Cambios Recientes
```jsx
{user.position_change > 5 && (
  <span className="big-change-badge">
    🔥 ¡Gran salto!
  </span>
)}
```

### 3. Comparación con Siguiente Usuario
```jsx
{index > 0 && (
  <div className="gap-info">
    {users[index - 1].puntos - user.puntos} pts de diferencia
  </div>
)}
```

---

**¡Todos estos ejemplos están listos para copiar y usar! 🚀**