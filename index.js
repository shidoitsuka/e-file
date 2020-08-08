const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const upload = require("multer")();
const mysql = require("mysql");
const app = express();
// prettier-ignore
const { host, port, dbHost, dbUsername, dbPassword, dbName } = require("./config.js");
const db = mysql.createConnection({
  host: dbHost,
  user: dbUsername,
  password: dbPassword,
  database: dbName,
});
db.connect((err) => {
  if (err) return console.error(`Failed to connect MySQL : ${err.stack}`);
  console.log("Successfully connected to MySQL!");
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.set("views", path.join(__dirname, "src/views"));
app.set("view engine", "hbs");
app.use("/assets", express.static("assets"));

app.get("/dashboard", (req, res) => {
  db.query(
    "SELECT id_dokumen, nama FROM dokumen WHERE accept=0 AND decline=0",
    (err, result) => {
      console.log(result);
      res.render("dashboard", { documents: result });
    }
  );
});

app.post("/validate-doc", (req, res) => {
  const { status, document_id } = req.body;
  if (status == "accept") {
    db.query(
      `UPDATE dokumen SET accept=1 WHERE id_dokumen=${document_id}`,
      (_) => {
        res.send("success");
      }
    );
  } else {
    db.query(
      `UPDATE dokumen SET decline=1 WHERE id_dokumen=${document_id}`,
      (_) => {
        res.send("success");
      }
    );
  }
});

app.post("/upload-doc", upload.single("dokumen"), (req, res) => {
  const dokumen = req.file;
  const { kategori } = req.body;
  const fileName = dokumen.originalname;
  const fileSize = dokumen.size / 1024;
  // prettier-ignore
  const fileType = dokumen.mimetype.slice(dokumen.mimetype.lastIndexOf("/") + 1);
  const fileBlob = dokumen.buffer.toString("base64");
  const tanggalMasuk = new Date();
  db.query(
    `INSERT INTO dokumen(nama, kategori, tanggal_masuk, file_blob, file_type) VALUES('${fileName}', '${kategori}','${tanggalMasuk}','${fileBlob}','${fileType}')`,
    (err, result) => {
      if (err) return console.error();
    }
  );
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", upload.none(), (req, res) => {
  const { username, password } = req.body;
  db.query(
    `SELECT username, password FROM user WHERE username='${username}' AND password='${password}'`,
    (err, result) => {
      if (!result.length)
        return res.send("Username atau Password tidak tepat!");
      res.send(result);
    }
  );
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", upload.none(), (req, res) => {
  const { username, password } = req.body;
  db.query(
    `INSERT INTO user(username, password, level) VALUES('${username}', '${password}', 1)`,
    (result) => {
      res.send(`success! ${result}`);
    }
  );
});

app.listen(port, host, console.log("listening on 3000"));
