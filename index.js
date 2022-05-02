import joi from "joi";
import cors from "cors";
import dayjs from "dayjs";
import dotenv from "dotenv";
import express, { json } from "express";
import { stripHtml } from "string-strip-html";
import { MongoClient, ObjectId } from "mongodb";

const app = express();
dotenv.config();
app.use(json());
app.use(cors());

let db = null;
const mongoClient = new MongoClient(process.env.MONGO_URL);

app.post("/participants", async (req, res) => {
  let { name } = req.body;

  // usando joi para verificar se não é uma string vazia
  participantSchema.validate();
  const validation = participantSchema.validate(req.body, { abortEarly: true });
  if (validation.error) return res.sendStatus(422);

  name = stripHtml(name).result.trim();

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
  }
});

app.get("/participants", async (req, res) => {
  try {
    await mongoClient.connect();
    const db = mongoClient.db("bate-papo-uol");
    const participants = await db.collection("participants").find({}).toArray();

    res.send(participants);
  } catch (e) {
    console.log("deu ruim no get /participants");
    console.log(e);

    res.sendStatus(400);
  }
});

app.post("/messages", async (req, res) => {
  let { to, text, type } = req.body;
  const { user: from } = req.headers;

  // usa o Joi para valdiar os dados recebidos pelo body
  const validation = messageSchema.validate(req.body, { abortEarly: true });
  if (validation.error) return res.sendStatus(422);

  to = stripHtml(to).result.trim();
  text = stripHtml(text).result.trim();

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
    console.log("deu ruim no post /messages");
    console.log(e);
    res.sendStatus(500);
  }
});

app.get("/messages", async (req, res) => {
  let { limit } = req.query;
  const { user: from } = req.headers;

  limit = parseInt(limit);

  function messagesAvailables(message, nameParticipant) {
    const { from, to, type } = message;

    const involved =
      from === nameParticipant || to === nameParticipant || to === "Todos";
    const isPublic = type === "message";

    return involved && isPublic;
  }

  try {
    await mongoClient.connect();
    const messages = mongoClient.db("bate-papo-uol").collection("messages");

    let arrayMessages = await messages.find({}).toArray();

    // filtrando as mensagens que o usuário pode ver:
    arrayMessages = arrayMessages.filter((message) =>
      messagesAvailables(message, from)
    );

    // testando se devem ser enviado todas ou se há limite:
    if (limit && limit !== NaN) return res.send(arrayMessages.slice(-limit));

    res.send(arrayMessages);
  } catch (e) {
    console.log("deu ruim no get /messages");
    console.log(e);
    res.sendStatus(500);
  }
});

app.post("/status", async (req, res) => {
  const { user: name } = req.headers;

  try {
    await mongoClient.connect();
    const db = mongoClient.db("bate-papo-uol");
    const participants = db.collection("participants");

    const participant = await participants.findOne({ name: name });
    if (!participant) return res.sendStatus(404);

    await participants.updateOne(
      { name },
      { $set: { lastStatus: Date.now() } }
    );

    res.sendStatus(200);
  } catch (e) {
    console.log("deu ruim no post /status");
    console.log(e);
    res.sendStatus(500);
  }
});

app.delete("/messages/:id", async (req, res) => {
  const { id } = req.params;
  const { user: from } = req.headers;

  try {
    await mongoClient.connect();
    const messages = mongoClient.db("bate-papo-uol").collection("messages");

    const message = await messages.findOne({ _id: new ObjectId(id) });
    if (!message) return res.sendStatus(404);

    if (message.from !== from) return res.sendStatus(401);

    await messages.deleteOne({ _id: message._id });
    res.sendStatus(200);
  } catch (e) {
    console.log(e);
    res.sendStatus(500);
  }
});

app.put("/messages/:id", async (req, res) => {
  const { id } = req.params;
  const { user: from } = req.headers;
  let { to, text, type } = req.body;

  const validation = messageSchema.validate(req.body, { abortEarly: true });
  if (validation.error) return res.sendStatus(422);

  to = stripHtml(to).result.trim();
  text = stripHtml(text).result.trim();

  try {
    await mongoClient.connect();
    const db = mongoClient.db("bate-papo-uol");
    const participants = db.collection("participants");
    const messages = db.collection("messages");

    const participant = await participants.findOne({ name: from });
    if (!participant) return res.sendStatus(422);

    const message = await messages.findOne({ _id: new ObjectId(id) });
    if (!message) return res.sendStatus(404);

    if (message.from !== from) return res.sendStatus(401);

    await messages.updateOne(
      { _id: message._id },
      { $set: { to, text, type } }
    );
  } catch (e) {
    console.log("deu ruim no put /messages");
    console.log(e);
    res.sendStatus(500);
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
    const inactivesUsers = await participants
      .find({ lastStatus: { $lt: timeToDisconnect } })
      .toArray();

    //await participants.deleteMany({ lastStatus: { $lt: timeToDisconnect } });

    inactivesUsers.forEach(async ({ name }) => {
      const time = dayjs(Date.now()).format("HH:mm:ss");
      await messages.insertOne({
        from: name,
        to: "Todos",
        text: "sai da sala...",
        type: "status",
        time,
      });
      await participants.deleteOne({ name });
    });
  } catch (e) {
    console.log(e);
    res.sendStatus(500);
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
