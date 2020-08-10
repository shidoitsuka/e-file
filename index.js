const express = require("express");
const path = require("path");
const bodyParser = require("body-parser");
const hbs = require("hbs");
const upload = require("multer")();
const cookieParser = require("cookie-parser");
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

hbs.registerHelper('json', function(context) {
  return JSON.stringify(context);
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.set("views", path.join(__dirname, "src/views"));
app.set("view engine", "hbs");
app.use("/assets", express.static("assets"));

app.get("/dashboard", (req, res) => {
  const currentUser = req.cookies.user;
  if (typeof currentUser == "undefined") return res.redirect("/login");

  db.query(
    "SELECT id_dokumen, nama, tanggal_masuk FROM dokumen WHERE accept=0 AND decline=0",
    (err, result) => {
      res.render("dashboard", { documents: result });
    }
  );
});

app.get("/logout", (req, res) => {
  res.clearCookie("user");
  res.clearCookie("level");
  res.redirect("/login");
});

app.post("/validate-doc", (req, res) => {
  const { status, document_id, userLevel } = req.body;
  if (!(userLevel > 0)) return res.json({ status: 0 });
  if (status == "accept") {
    db.query(
      `UPDATE dokumen SET accept=1 WHERE id_dokumen=${document_id}`,
      (_) => {
        res.json({ status: 1 });
      }
    );
  } else {
    db.query(
      `UPDATE dokumen SET decline=1 WHERE id_dokumen=${document_id}`,
      (_) => {
        res.json({ status: 1 });
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
      if (err)
        return res.redirect(
          `/dashboard?show=true&message=${encodeURIComponent(
            "Terjadi kesalahan!"
          )}&color=danger`
        );
      res.redirect(
        `/dashboard?show=true&message=${encodeURIComponent(
          "Sukses meng-upload dokumen!"
        )}&color=success`
      );
    }
  );
});

app.get("/login", (req, res) => {
  const currentUser = req.cookies.user;
  if (typeof currentUser != "undefined") return res.redirect("/dashboard");
  res.render("login");
});

app.post("/login", upload.none(), (req, res) => {
  const { username, password } = req.body;
  db.query(
    `SELECT username, password, level FROM user WHERE username='${username}' AND password='${password}'`,
    (err, result) => {
      if (!result.length)
        return res.send("Username atau Password tidak tepat!");
      // one hour session
      res.cookie("user", username, { maxAge: 3600000 });
      res.cookie("level", result[0].level, { maxAge: 3600000 });
      res.redirect("/dashboard");
    }
  );
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", upload.none(), (req, res) => {
  const currentUser = req.cookies.user;
  if (typeof currentUser == "undefined") return res.redirect("/login");
  const { username, password } = req.body;
  db.query(
    `INSERT INTO user(username, password, level) VALUES('${username}', '${password}', 1)`,
    (result) => {
      res.send(`success! ${result}`);
    }
  );
});

app.listen(port, host, console.log("listening on 3000"));
