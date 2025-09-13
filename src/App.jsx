import { useState, useEffect, useRef } from 'react';


import './App.css';


function App() {
  // Estado para ubicación
  const [location, setLocation] = useState({ lat: null, lon: null });
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [form, setForm] = useState({ email: '', password: '', name: '', photo: null });
  const [isLogin, setIsLogin] = useState(true);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [error, setError] = useState('');
  const [messages, setMessages] = useState([]);
  const [newMsg, setNewMsg] = useState('');
  const [favorites, setFavorites] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [filter, setFilter] = useState({ minAge: 50, maxAge: 120, maxDistance: 50, gender: 'all' });

  // Obtener ubicación real al cargar
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        pos => setLocation({ lat: pos.coords.latitude, lon: pos.coords.longitude }),
        err => setLocation({ lat: null, lon: null })
      );
    }
  }, []);
  // Lógica para mantener presionado los botones + y -
  const holdInterval = useRef(null);
  const holdDelay = useRef(200);
  const holdStep = useRef(1);
  const holdField = useRef('minAge');

  function holdButton(field, step) {
    holdField.current = field;
    holdStep.current = step;
    if (holdInterval.current) return;
    const run = () => {
      setFilter(f => {
        let value = f[field] + step;
        if (field === 'minAge') value = Math.max(50, Math.min(value, f.maxAge));
        if (field === 'maxAge') value = Math.min(120, Math.max(value, f.minAge));
        return { ...f, [field]: value };
      });
      holdDelay.current = Math.max(50, holdDelay.current * 0.85);
      holdInterval.current = setTimeout(run, holdDelay.current);
    };
    run();
  }

  function releaseButton() {
    clearTimeout(holdInterval.current);
    holdInterval.current = null;
    holdDelay.current = 200;
  }
  // Sugerencias desde backend

  // Calcular distancia entre dos puntos
  function calcDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return null;
    const R = 6371; // km
    const dLat = (lat2-lat1)*Math.PI/180;
    const dLon = (lon2-lon1)*Math.PI/180;
    const a = Math.sin(dLat/2)*Math.sin(dLat/2) + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)*Math.sin(dLon/2);
    const c = 2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
    return Math.round(R*c);
  }
  // Cargar usuarios del backend
  useEffect(() => {
    if (isAuthenticated) {
  fetch(`${import.meta.env.VITE_BACKEND_URL}/api/users`)
        .then(r => r.json())
        .then(data => setSuggestions(data.filter(u => u.email !== form.email)));
    }
  }, [isAuthenticated, form.email]);
  // Filtrar sugerencias por edad, género y distancia real
  const filteredSuggestions = Array.isArray(suggestions) ? suggestions.filter(s => {
    const ageOk = typeof s.age === 'number' && s.age >= filter.minAge && s.age <= filter.maxAge;
    const genderOk = filter.gender === 'all' || (filter.gender === 'male' && s.gender === 'male') || (filter.gender === 'female' && s.gender === 'female');
    let distOk = true;
    let distance = null;
    if (location.lat && location.lon && s.lat && s.lon) {
      distance = calcDistance(location.lat, location.lon, s.lat, s.lon);
      distOk = distance <= filter.maxDistance;
    }
    s.distance = distance;
    return ageOk && distOk && genderOk;
  }) : [];
  const notifAudioRef = useRef(null);

  // Reproducir sonido al recibir mensaje de otro usuario
  useEffect(() => {
    if (!notifAudioRef.current) return;
    if (messages.length < 2) return;
    const lastMsg = messages[messages.length - 1];
    if (lastMsg.from !== 'yo') {
      notifAudioRef.current.currentTime = 0;
      notifAudioRef.current.play();
    }
  }, [messages]);



  const handleChange = (e) => {
    const { name, value, files } = e.target;
    if (name === 'photo' && files && files[0]) {
      setForm({ ...form, photo: files[0] });
      const reader = new FileReader();
      reader.onloadend = () => setPhotoPreview(reader.result);
      reader.readAsDataURL(files[0]);
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.password || (!isLogin && !form.name)) {
      setError('Por favor, completa todos los campos.');
      return;
    }
    if (!isLogin && !form.photo) {
      setError('Por favor, sube una foto de perfil.');
      return;
    }
    setError('');
    // Lógica de backend
    try {
      if (isLogin) {
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email, password: form.password })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Error de login');
        setIsAuthenticated(true);
        setForm(f => ({ ...f, name: data.user.name, age: data.user.age, photo: data.user.photo }));
      } else {
        // Convertir foto a base64 si es archivo
        let photoData = form.photo;
        if (form.photo && typeof form.photo !== 'string') {
          photoData = await new Promise(resolve => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.readAsDataURL(form.photo);
          });
        }
  const res = await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/register`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: form.email,
            password: form.password,
            name: form.name,
            age: form.age,
            photo: photoData,
            lat: location.lat,
            lon: location.lon,
            gender: form.gender
          })
        });
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Error de registro');
        setIsAuthenticated(true);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  // Usuario destino seleccionado para chatear
  const [chatUser, setChatUser] = useState(null);

  // Cargar mensajes del backend cuando se selecciona usuario
  useEffect(() => {
    if (chatUser && form.email) {
  fetch(`${import.meta.env.VITE_BACKEND_URL}/api/messages?from=${encodeURIComponent(form.email)}&to=${encodeURIComponent(chatUser.email)}`)
        .then(r => r.json())
        .then(setMessages);
    }
  }, [chatUser, form.email]);

  const handleSendMsg = async (e) => {
    e.preventDefault();
    if (newMsg.trim() === '' || !chatUser) return;
  await fetch(`${import.meta.env.VITE_BACKEND_URL}/api/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: form.email, to: chatUser.email, text: newMsg })
    });
    setMessages([...messages, { from: form.email, to: chatUser.email, text: newMsg, date: new Date() }]);
    setNewMsg('');
  };

  return (
    <>
      <div style={{position:'fixed', top:10, left:10, zIndex:1000}}>
        <button
          className="main-btn"
          style={{fontSize:'0.95rem', padding:'0.4rem 0.8rem'}}
          onClick={() => {
            if (notifAudioRef.current) {
              notifAudioRef.current.pause();
              notifAudioRef.current.currentTime = 0;
              notifAudioRef.current.volume = 1.0;
              notifAudioRef.current.play();
            }
          }}
        >
          Probar sonido de mensaje
        </button>
      </div>
  <audio ref={notifAudioRef} src="/notif.mp3" preload="auto" volume="1.0" />
  {!isAuthenticated ? (
        <div className="auth-container">
          <h1>SilverMatch</h1>
          <h2>{isLogin ? 'Iniciar sesión' : 'Registrarse'}</h2>
          <form className="auth-form" onSubmit={handleSubmit}>
            {!isLogin && (
              <>
                <label>
                  Nombre completo
                  <input
                    type="text"
                    name="name"
                    value={form.name}
                    onChange={handleChange}
                    autoComplete="name"
                    required
                  />
                </label>
                <label>
                  Foto de perfil
                  <input
                    type="file"
                    name="photo"
                    accept="image/*"
                    onChange={handleChange}
                    required
                  />
                </label>
                <label>
                  Género
                  <select name="gender" value={form.gender || ''} onChange={handleChange} required>
                    <option value="">Selecciona</option>
                    <option value="female">Mujer</option>
                    <option value="male">Hombre</option>
                  </select>
                </label>
                {photoPreview && (
                  <div style={{ margin: '0.5rem 0' }}>
                    <img
                      src={photoPreview}
                      alt="Previsualización"
                      style={{ width: '120px', height: '120px', objectFit: 'cover', borderRadius: '50%', border: '2px solid #4b4b8f' }}
                    />
                  </div>
                )}
              </>
            )}
            <label>
              Correo electrónico
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                required
              />
            </label>
            <label>
              Contraseña
              <input
                type="password"
                name="password"
                value={form.password}
                onChange={handleChange}
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                required
              />
            </label>
            {error && <div className="error-msg">{error}</div>}
            <button type="submit" className="main-btn">
              {isLogin ? 'Entrar' : 'Registrarse'}
            </button>
          </form>
          <button className="switch-btn" onClick={() => setIsLogin(!isLogin)}>
            {isLogin ? '¿No tienes cuenta? Regístrate' : '¿Ya tienes cuenta? Inicia sesión'}
          </button>
        </div>
      ) : (
        <>
          <div className="profile-container">
            <h1>Mi Perfil</h1>
            <div className="profile-card">
              <div style={{display:'flex', flexDirection:'column', alignItems:'center'}}>
                <img
                  src={photoPreview || (form.photo && typeof form.photo !== 'string' ? URL.createObjectURL(form.photo) : form.photo) || 'https://randomuser.me/api/portraits/lego/1.jpg'}
                  alt="Foto de perfil"
                  className="profile-photo"
                  style={{marginBottom:'0.5rem'}}
                />
                <label htmlFor="profile-photo-input" className="main-btn" style={{marginTop:'0.2rem', width:'fit-content', cursor:'pointer'}}>
                  Cambiar imagen
                  <input
                    id="profile-photo-input"
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={e => {
                      if (e.target.files && e.target.files[0]) {
                        const file = e.target.files[0];
                        setForm({ ...form, photo: file });
                        const reader = new FileReader();
                        reader.onloadend = () => setPhotoPreview(reader.result);
                        reader.readAsDataURL(file);
                      }
                    }}
                  />
                </label>
              </div>
              <div className="profile-info">
                <strong>{form.name || 'Usuario'}</strong>
                <div style={{margin:'0.2rem 0'}}>
                  Género: {form.gender === 'male' ? 'Hombre' : form.gender === 'female' ? 'Mujer' : 'No especificado'}
                </div>
                <div style={{margin:'0.2rem 0'}}>
                  Edad: 
                  <input
                    type="number"
                    min="50"
                    max="120"
                    value={form.age || ''}
                    onChange={e => setForm({ ...form, age: e.target.value })}
                    style={{ width: '60px', fontSize: '1.1rem', borderRadius: '6px', border: '1px solid #bdbdbd', marginLeft: '0.5rem' }}
                  />
                </div>
                <textarea
                  className="profile-desc"
                  placeholder="Escribe una breve descripción sobre ti..."
                  value={form.desc || ''}
                  onChange={e => setForm({ ...form, desc: e.target.value })}
                  rows={2}
                  style={{width:'100%', fontSize:'1.1rem', borderRadius:'8px', border:'1px solid #bdbdbd', marginTop:'0.5rem'}}
                />
              </div>
            </div>
          </div>
          <div className="chat-container">
            <h1>SilverMatch</h1>
            <h2>Chat</h2>
            <div style={{display:'flex',gap:'1rem'}}>
              <div style={{minWidth:'180px'}}>
                <strong>Usuarios</strong>
                <ul style={{listStyle:'none',padding:0}}>
                  {suggestions.map(u => (
                    <li key={u.email}>
                      <button style={{width:'100%',textAlign:'left',background:chatUser&&chatUser.email===u.email?'#e0e0ff':'#fff'}} onClick={()=>setChatUser(u)}>
                        <img src={u.photo} alt={u.name} style={{width:32,height:32,borderRadius:'50%',marginRight:8}} />
                        {u.name}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
              <div style={{flex:1}}>
                <div className="chat-box">
                  {chatUser ? (
                    messages.map((msg, idx) => (
                      <div key={idx} className={msg.from === form.email ? 'msg msg-own' : 'msg'}>
                        <span>{msg.from === form.email ? 'Tú' : chatUser.name}:</span> {msg.text}
                      </div>
                    ))
                  ) : (
                    <div>Selecciona un usuario para chatear</div>
                  )}
                </div>
                {chatUser && (
                  <form className="chat-form" onSubmit={handleSendMsg}>
                    <input
                      type="text"
                      value={newMsg}
                      onChange={e => setNewMsg(e.target.value)}
                      placeholder="Escribe tu mensaje..."
                      style={{ fontSize: '1.1rem', padding: '0.7rem', borderRadius: '8px', border: '1px solid #bdbdbd', width: '70%' }}
                      autoFocus
                    />
                    <button type="submit" className="main-btn" style={{ marginLeft: '0.5rem', padding: '0.7rem 1.2rem' }}>Enviar</button>
                  </form>
                )}
              </div>
            </div>
          </div>
          <div className="suggestions-container">
            <h2>Sugerencias de citas compatibles y personas cerca tuyo</h2>
            <div style={{display:'flex',gap:'1rem',flexWrap:'wrap',justifyContent:'center',marginBottom:'0.7rem'}}>
              <button
                type="button"
                className="main-btn"
                style={{fontSize:'1.2rem',padding:'0.2rem 0.8rem'}}
                onMouseDown={() => holdButton('minAge', -1)}
                onMouseUp={releaseButton}
                onMouseLeave={releaseButton}
                onTouchStart={() => holdButton('minAge', -1)}
                onTouchEnd={releaseButton}
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") holdButton('minAge', -1);
                }}
                onKeyUp={e => {
                  if (e.key === "Enter" || e.key === " ") releaseButton();
                }}
              >-</button>
              <span style={{fontSize:'1.1rem',margin:'0 0.5rem'}}>Edad mínima: {filter.minAge}</span>
              <button
                type="button"
                className="main-btn"
                style={{fontSize:'1.2rem',padding:'0.2rem 0.8rem'}}
                onMouseDown={() => holdButton('minAge', 1)}
                onMouseUp={releaseButton}
                onMouseLeave={releaseButton}
                onTouchStart={() => holdButton('minAge', 1)}
                onTouchEnd={releaseButton}
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") holdButton('minAge', 1);
                }}
                onKeyUp={e => {
                  if (e.key === "Enter" || e.key === " ") releaseButton();
                }}
              >+</button>
              <span style={{width:'2rem'}}></span>
              <button
                type="button"
                className="main-btn"
                style={{fontSize:'1.2rem',padding:'0.2rem 0.8rem'}}
                onMouseDown={() => holdButton('maxAge', -1)}
                onMouseUp={releaseButton}
                onMouseLeave={releaseButton}
                onTouchStart={() => holdButton('maxAge', -1)}
                onTouchEnd={releaseButton}
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") holdButton('maxAge', -1);
                }}
                onKeyUp={e => {
                  if (e.key === "Enter" || e.key === " ") releaseButton();
                }}
              >-</button>
              <span style={{fontSize:'1.1rem',margin:'0 0.5rem'}}>Edad máxima: {filter.maxAge}</span>
              <button
                type="button"
                className="main-btn"
                style={{fontSize:'1.2rem',padding:'0.2rem 0.8rem'}}
                onMouseDown={() => holdButton('maxAge', 1)}
                onMouseUp={releaseButton}
                onMouseLeave={releaseButton}
                onTouchStart={() => holdButton('maxAge', 1)}
                onTouchEnd={releaseButton}
                tabIndex={0}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") holdButton('maxAge', 1);
                }}
                onKeyUp={e => {
                  if (e.key === "Enter" || e.key === " ") releaseButton();
                }}
              >+</button>
            </div>
            <form style={{display:'flex',gap:'1rem',flexWrap:'wrap',justifyContent:'center',marginBottom:'1.2rem',background:'#fff',padding:'1rem',borderRadius:'10px'}}>
              <label style={{fontSize:'1rem'}}>
                Edad:
                <input type="number" min="50" max="120" value={filter.minAge} style={{width:'50px',marginLeft:'0.3rem'}} onChange={e=>setFilter(f=>({...f,minAge:Number(e.target.value)}))} />
                -
                <input type="number" min="50" max="120" value={filter.maxAge} style={{width:'50px',marginLeft:'0.3rem'}} onChange={e=>setFilter(f=>({...f,maxAge:Number(e.target.value)}))} />
              </label>
              <label style={{fontSize:'1rem'}}>
                Distancia (km):
                <input type="number" min="1" max="100" value={filter.maxDistance} style={{width:'60px',marginLeft:'0.3rem'}} onChange={e=>setFilter(f=>({...f,maxDistance:Number(e.target.value)}))} />
              </label>
              <label style={{fontSize:'1rem'}}>
                Género:
                <select value={filter.gender} style={{marginLeft:'0.3rem'}} onChange={e=>setFilter(f=>({...f,gender:e.target.value}))}>
                  <option value="all">Todos</option>
                  <option value="female">Mujeres</option>
                  <option value="male">Hombres</option>
                </select>
              </label>
            </form>
            <div className="suggestions-list">
              {filteredSuggestions.map(s => (
                <div className="suggestion-card" key={s.id}>
                  <img src={s.photo} alt={s.name} className="suggestion-photo" />
                  <div>
                    <strong>{s.name}, {s.age}</strong>
                    <p>{s.distance} km de distancia</p>
                    <button className="main-btn" style={{padding:'0.4rem 1rem', fontSize:'1rem', marginRight:'0.5rem'}}>Ver perfil</button>
                    <button
                      className="like-btn"
                      style={{padding:'0.4rem 1rem', fontSize:'1rem', background: favorites.some(f => f.id === s.id) ? '#e74c3c' : '#4b4b8f', color:'#fff'}}
                      onClick={() => {
                        if (!favorites.some(f => f.id === s.id)) {
                          setFavorites([...favorites, s]);
                          setMessages(prev => ([
                            ...prev,
                            { from: s.name, text: `¡${form.name || 'Un usuario'} te ha dado me gusta!` }
                          ]));
                        }
                      }}
                      disabled={favorites.some(f => f.id === s.id)}
                    >
                      {favorites.some(f => f.id === s.id) ? '♥ Favorito' : '♡ Me gusta'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {favorites.length > 0 && (
            <div className="favorites-container">
              <h2>Mis favoritos</h2>
              <div className="suggestions-list">
                {favorites.map(f => (
                  <div className="suggestion-card" key={f.id}>
                    <img src={f.photo} alt={f.name} className="suggestion-photo" />
                    <div>
                      <strong>{f.name}, {f.age}</strong>
                      <p>{f.distance} km de distancia</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </>
  );
}

export default App;
