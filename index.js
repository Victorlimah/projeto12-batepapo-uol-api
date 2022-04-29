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
  const validation = participantSchema.validate(req.body, { abortEarly: true });
  if (validation.error) return res.sendStatus(422);

  try {
    await mongoClient.connect();
    const dbParticipants = mongoClient.db("bate-papo-uol");
    const collection = dbParticipants.collection("participants");

    // checa se já existe participante com este nome
    const participant = await collection.findOne({ name });
    if (participant) return res.sendStatus(409);

    await collection.insertOne({ name, lastStatus: Date.now() });

    // criando mensagem de que *nome* entrou na sala

    const time = dayjs(Date.now()).format("HH:mm:ss");
    const messages = dbParticipants.collection("messages");
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
    const dbParticipants = mongoClient.db("bate-papo-uol");
    const participants = await dbParticipants
      .collection("participants")
      .find()
      .toArray();
    res.send(participants);
  } catch (e) {
    console.log(e);
    res.sendStatus(400);
  } finally {
    mongoClient.close();
  }
});

app.post("/messages", (req, res) => {});

app.get("/messages", (req, res) => {});

app.post("/status", (req, res) => {});

app.listen(5000, () => console.log("Servidor rodando na porta 5000"));

// Validações JOI
const participantSchema = joi.object({
  name: joi.string().required(),
});
