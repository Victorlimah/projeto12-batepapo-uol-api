import joi from "joi";
import cors from "cors";
import dotenv from "dotenv";
import { MongoClient } from "mongodb";
import express, { json } from "express";

const app = express();
app.use(json());
app.use(cors());
dotenv.config();

// {name: 'João', lastStatus: 12313123}
// O conteúdo do lastStatus será explicado nos próximos requisitos

// {from: 'João', to: 'Todos', text: 'oi galera', type: 'message', time: '20:04:37'}

app.post("/participants", (req, res) => {
  const { name } = req.body;

  const validation = participantSchema.validate(req.body, { abortEarly: true });

  if (validation.error) {
    console.log(validation.error.details);
    res.sendStatus(409);
    return;
  }
  res.send("deu certo");
});

app.get("/participants", (req, res) => {});

app.post("/messages", (req, res) => {});

app.get("/messages", (req, res) => {});

app.post("/status", (req, res) => {});

app.listen(5000, () => console.log("Servidor rodando na porta 5000"));

// Validações JOI
const participantSchema = joi.object({
  name: joi.string().required(),
});
