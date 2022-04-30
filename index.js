import joi from "joi";
import cors from "cors";
import dayjs from "dayjs";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import express, { json } from "express";

const app = express();
dotenv.config();
app.use(json());
app.use(cors());

let db = null;
// Passar pro dotenv depois
const mongoClient = new MongoClient("mongodb://localhost:27017");

app.post("/participants", async (req, res) => {
  const { name } = req.body;

  // usando joi para verificar se não é uma string vazia
  participantSchema.validate();
  const validation = participantSchema.validate(req.body, { abortEarly: true });
  if (validation.error) return res.sendStatus(422);

  try {
    await mongoClient.connect();
    const db = mongoClient.db("bate-papo-uol");
    const participants = db.collection("participants");

    // checa se já existe participante com este nome
    const participant = await participants.findOne({ name });
    if (participant) return res.sendStatus(409);

    await participants.insertOne({ name, lastStatus: Date.now() });

    // criando mensagem de que *nome* entrou na sala

    const time = dayjs(Date.now()).format("HH:mm:ss");
    const messages = db.collection("messages");
    await messages.insertOne({
      from: name,
      to: "Todos",
      text: "entra na sala...",
      type: "status",
      time,
    });

    res.sendStatus(201);
  } catch (e) {
    console.log(e);
    res.sendStatus(500);
  } finally {
    mongoClient.close();
  }
});

app.get("/participants", async (req, res) => {
  try {
    await mongoClient.connect();
    const db = mongoClient.db("bate-papo-uol");
    const participants = await db.collection("participants").find().toArray();
    res.send(participants);
  } catch (e) {
    console.log(e);
    res.sendStatus(400);
  } finally {
    mongoClient.close();
  }
});

app.post("/messages", async (req, res) => {
  const { to, text, type } = req.body;
  const { user: from } = req.headers;

  // usa o Joi para valdiar os dados recebidos pelo body
  const validation = messageSchema.validate(req.body, { abortEarly: true });
  if (validation.error) return res.sendStatus(422);

  try {
    await mongoClient.connect();
    const db = mongoClient.db("bate-papo-uol");
    const messages = db.collection("messages");
    const participants = db.collection("participants");

    // checa se participante existe na lista
    const participant = await participants.findOne({ name: from });
    if (!participant) return res.sendStatus(404);

    const time = dayjs(Date.now()).format("HH:mm:ss");
    await messages.insertOne({
      from,
      to,
      text,
      type,
      time,
    });

    res.sendStatus(201);
  } catch (e) {
    console.log(e);
    res.sendStatus(500);
  } finally {
    mongoClient.close();
  }
});

app.get("/messages", async (req, res) => {
  const { limit } = req.query;
  const { user: from } = req.headers;

  try {
    await mongoClient.connect();
    const db = mongoClient.db("bate-papo-uol");
    const messages = dbBatePapo.collection("messages");
    const participants = dbBatePapo.collection("participants");

    const arrayMessages = await messages.find({}).toArray();

    // filtrando as mensagens que o usuário pode ver:
    arrayMessages = arrayMessages.filter((message) => {
      return message.from === "Todos" || from === (message.from || message.to);
    });

    // testando se devem ser enviado todas ou se há limite:
    if (limit) return res.send(arrayMessages.splice(0, limit));

    res.send(arrayMessages);
  } catch (e) {
    console.log(e);
    res.sendStatus(500);
  } finally {
    mongoClient.close();
  }
});

app.post("/status", async (req, res) => {
  const { user: name } = req.headers;

  try {
    await mongoClient.connect();
    const db = mongoClient.db("bate-papo-uol");
    const participants = db.collection("participants");

    const participant = await participants.findOne({ name });
    if (!participant) return res.sendStatus(404);

    await participants.updateOne(
      { name },
      { $set: { lastStatus: Date.now() } }
    );
    res.sendStatus(200);
  } catch (e) {
    console.log(e);
    res.sendStatus(500);
  } finally {
    mongoClient.close();
  }
});

app.listen(5000, () => console.log("Servidor rodando na porta 5000"));

// Removendo usuários inativos através de um intervalo de tempo
const timeToVerify = 15000; // 15000 ms = 15s

setInterval(async () => {
  try {
    await mongoClient.connect();
    const db = mongoClient.db("bate-papo-uol");
    const participants = db.collection("participants");
    const messages = db.collection("messages");

    const timeToDisconnect = Date.now() - 10000; // 10000 ms = 10s
    db.participants.remove({ lastStatus: { $lt: timeToDisconnect } });
  } catch (e) {
    console.log(e);
    res.sendStatus(500);
  } finally {
    mongoClient.close();
  }
}, timeToVerify);

// Validações JOI
const participantSchema = joi.object({
  name: joi.string().required(),
});

const messageSchema = joi.object({
  to: joi.string().required(),
  text: joi.string().required(),
  type: joi.string().valid(...["message", "private_message"]),
});
