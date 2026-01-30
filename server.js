const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

// server.js
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

// crear rooms
const rooms = {};

// servir html para server
app.get("/", (req, res) => {
  res.sendFile(__dirname + "/estacionamiento.html");
});

io.on("connection", (socket) => {
  console.log(`Usuario conectado: ${socket.id}`);

  socket.on("join-room", ({ roomCode, playerName }) => {
    const room = roomCode.trim().toLowerCase();
    socket.join(room);

    console.log(`Jugador ${playerName} intentando unirse a sala: ${room}`);

    if (!rooms[room]) {
      rooms[room] = {
        players: [],
        activePlayerIndex: 0,
        totals: { E: 0, Ca: 0, Co: 0, S: 0 },
        bitacoraLog: [],
      };
    }

    const pIdx = rooms[room].players.findIndex((p) => p.name === playerName);

    if (pIdx === -1) {
    // crear jugador
      const colors = [
        "#60a5fa",
        "#34d399",
        "#fbbf24",
        "#a78bfa",
        "#fb7185",
        "#22c55e",
      ];
      const avatars = ["🚗", "🚙", "🚕", "🚌", "🚓", "🚘"];
      const pCount = rooms[room].players.length;

      rooms[room].players.push({
        id: socket.id,
        name: playerName,
        pos: 0,
        color: colors[pCount % colors.length],
        avatar: avatars[pCount % avatars.length],
        ev: { E: 0, Ca: 0, Co: 0, S: 0 },
      });
      console.log(`Jugador ${playerName} CREADO en sala ${room}`);
    } else {
      // Solo actualizamos el socket por si refrescó la página
      rooms[room].players[pIdx].id = socket.id;
      console.log(`Jugador ${playerName} RECONECTADO en sala ${room}`);
    }

    // enviamos el estado actualizado a todos en la sala
    io.to(room).emit("update-state", rooms[room]);
  });

  socket.on("move-player", ({ roomCode, diceValue }) => {
    const room = rooms[roomCode.trim().toLowerCase()];
    if (!room) return;

    const player = room.players[room.activePlayerIndex];
    player.pos = Math.min(29, player.pos + diceValue);

    // Emitir el estado completo para que todos vean el monito moverse
    io.to(roomCode.trim().toLowerCase()).emit("update-state", room);

    // emitir un evento específico para la animación del dado
    io.to(roomCode.trim().toLowerCase()).emit("player-moved", {
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

    // Actualizar estadísticas 
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
