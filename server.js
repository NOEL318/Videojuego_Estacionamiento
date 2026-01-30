const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // En producción, usa la URL de tu Vercel
    methods: ["GET", "POST"],
  },
});

// Estado global de las salas (en memoria para este ejemplo)
const rooms = {};

io.on("connection", (socket) => {
  console.log(`Usuario conectado: ${socket.id}`);

  socket.on("join-room", ({ roomCode, playerName }) => {
    socket.join(roomCode);

    if (!rooms[roomCode]) {
      rooms[roomCode] = {
        players: [],
        activePlayerIndex: 0,
        totals: { E: 0, Ca: 0, Co: 0, S: 0 },
        bitacoraLog: [],
      };
    }

    // Evitar duplicados
    const exists = rooms[roomCode].players.find((p) => p.name === playerName);
    if (!exists) {
      const colors = [
        "#60a5fa",
        "#34d399",
        "#fbbf24",
        "#a78bfa",
        "#fb7185",
        "#22c55e",
      ];
      const avatars = ["🚗", "🚙", "🚕", "🚌", "🚓", "🚘"];
      const pIdx = rooms[roomCode].players.length;

      rooms[roomCode].players.push({
        id: socket.id,
        name: playerName,
        pos: 0,
        color: colors[pIdx % colors.length],
        avatar: avatars[pIdx % avatars.length],
        ev: { E: 0, Ca: 0, Co: 0, S: 0 },
      });
    }

    io.to(roomCode).emit("update-state", rooms[roomCode]);
  });

  socket.on("move-player", ({ roomCode, diceValue }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const player = room.players[room.activePlayerIndex];
    player.pos = Math.min(29, player.pos + diceValue); // 29 es la meta

    io.to(roomCode).emit("player-moved", {
      activePlayerIndex: room.activePlayerIndex,
      newPos: player.pos,
      diceValue,
    });
  });

  socket.on("submit-evidence", ({ roomCode, evidenceData }) => {
    const room = rooms[roomCode];
    if (!room) return;

    const player = room.players[room.activePlayerIndex];
    const { type, answer, tileName, prompt } = evidenceData;

    // Registrar en bitácora
    room.bitacoraLog.push({
      id: room.bitacoraLog.length + 1,
      timestamp: new Date().toLocaleString(),
      player: player.name,
      tileName,
      type,
      prompt,
      answer,
    });

    // Actualizar estadísticas si es evidencia válida
    if (["E", "Ca", "Co", "S"].includes(type)) {
      player.ev[type]++;
      room.totals[type]++;
    }

    // Cambiar turno
    room.activePlayerIndex = (room.activePlayerIndex + 1) % room.players.length;

    io.to(roomCode).emit("update-state", room);
  });

  socket.on("disconnect", () => {
    console.log("Usuario desconectado");
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`);
});
