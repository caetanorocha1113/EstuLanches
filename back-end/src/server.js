import express from "express";
import cors from "cors";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import dotenv from "dotenv";

dotenv.config();
const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

const verificarToken = (req, res, next) => {
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ error: "Acesso negado. Token não fornecido." });

  try {
    const secret = process.env.JWT_SECRET || "chave_padrao_insegura";
    const verificado = jwt.verify(token, secret);
    req.usuario = verificado;
    next();
  } catch (err) {
    res.status(403).json({ error: "Token inválido ou expirado." });
  }
};

app.post("/usuarios", async (req, res) => {
  try {
    const { email, nome, matriculaCpf, senha, tipoPerfil } = req.body;

    const salt = await bcrypt.genSalt(10);
    const senhaHash = await bcrypt.hash(senha, salt);

    const usuario = await prisma.usuario.create({
      data: {
        email,
        nome,
        matriculaCpf,
        senhaHash,
        tipoPerfil
      },
      select: {
        id: true,
        nome: true,
        email: true,
        matriculaCpf: true,
        tipoPerfil: true,
        criadoEm: true
      }
    });

    res.status(201).json(usuario);
  } catch (error) {
    res.status(400).json({ error: "Erro ao criar usuário. Verifique se o email/CPF já existe." });
  }
});

app.post("/login", async (req, res) => {
  try {
    const { email, senha } = req.body;
    
    const usuario = await prisma.usuario.findUnique({
      where: { email: email }
    });

    if (!usuario) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);

    if (!senhaValida) {
      return res.status(401).json({ error: "Credenciais inválidas" });
    }

    const secret = process.env.JWT_SECRET || "chave_padrao_insegura";
    const token = jwt.sign(
      { id: usuario.id, email: usuario.email, tipoPerfil: usuario.tipoPerfil },
      secret,
      { expiresIn: "1h" }
    );

    res.json({ token, tipoPerfil: usuario.tipoPerfil });
  } catch (error) {
    res.status(500).json({ error: "Erro interno no servidor" });
  }
});

app.get("/usuarios", verificarToken, async (req, res) => {
  try {
    const usuarios = await prisma.usuario.findMany({
      select: { id: true, nome: true, email: true, tipoPerfil: true }
    });
    res.json(usuarios);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar usuários" });
  }
});

app.get("/usuarios/:id", verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const usuario = await prisma.usuario.findUnique({
      where: { id: parseInt(id) },
      select: { id: true, nome: true, email: true, matriculaCpf: true, tipoPerfil: true }
    });

    if (!usuario) return res.status(404).json({ error: "Usuário não encontrado" });

    res.json(usuario);
  } catch (error) {
    res.status(500).json({ error: "Erro ao buscar usuário" });
  }
});

app.put("/usuarios/:id", verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { email, nome, matriculaCpf, tipoPerfil } = req.body;

    const usuario = await prisma.usuario.update({
      where: { id: parseInt(id) },
      data: { email, nome, matriculaCpf, tipoPerfil },
      select: { id: true, nome: true, email: true, tipoPerfil: true }
    });

    res.json(usuario);
  } catch (error) {
    res.status(400).json({ error: "Erro ao atualizar usuário" });
  }
});

app.delete("/usuarios/:id", verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    await prisma.usuario.delete({
      where: { id: parseInt(id) }
    });
    res.status(204).send();
  } catch (error) {
    res.status(400).json({ error: "Erro ao deletar usuário" });
  }
});

app.listen(3000, () => {
  console.log("Servidor rodando na porta 3000");
});