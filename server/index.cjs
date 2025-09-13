// Backend básico para autenticación y chat (Node.js + Express)
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

// Usuarios y mensajes en memoria (para demo)
let users = [];
let messages = [];

// Registro
app.post('/api/register', (req, res) => {
  const { email, password, name, age, photo, lat, lon, gender } = req.body;
  if (users.find(u => u.email === email)) {
    return res.status(400).json({ error: 'El usuario ya existe' });
  }
  const user = { id: Date.now(), email, password, name, age, photo, lat, lon, gender };
  users.push(user);
  res.json({ success: true, user: { ...user, password: undefined } });
});

// Login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  const user = users.find(u => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ error: 'Credenciales inválidas' });
  res.json({ success: true, user: { ...user, password: undefined } });
});

// Obtener usuarios (para sugerencias)
app.get('/api/users', (req, res) => {
  res.json(users.map(u => ({ ...u, password: undefined })));
});

// Enviar mensaje
app.post('/api/message', (req, res) => {
  const { from, to, text } = req.body;
  messages.push({ from, to, text, date: new Date() });
  res.json({ success: true });
});

// Obtener mensajes entre dos usuarios
app.get('/api/messages', (req, res) => {
  const { from, to } = req.query;
  const chat = messages.filter(m => (m.from === from && m.to === to) || (m.from === to && m.to === from));
  res.json(chat);
});

app.listen(PORT, () => {
  console.log(`Servidor backend escuchando en http://localhost:${PORT}`);
});
