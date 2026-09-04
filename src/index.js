import express from "express";
import { router as matchesRouter } from "./route/matches.js";

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello World");
});

app.use("/matches", matchesRouter);

app.listen(8080, () => {
  console.log("Server is running on http://localhost:8080");
});
