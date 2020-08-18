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

hbs.registerHelper("json", function (context) {
  return JSON.stringify(context);
});

app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(cookieParser());
app.set("views", path.join(__dirname, "src/views"));
app.set("view engine", "hbs");
app.use("/assets", express.static("assets"));

app.get("/", (req, res) => {
  db.query("SELECT * FROM dokumen", (err, result) => {
    res.render("index", { documents: result });
  });
});

app.get("/dashboard", (req, res) => {
  const currentUser = req.cookies.user;
  if (typeof currentUser == "undefined") return res.redirect("/login");
  // prettier-ignore
  db.query(`SELECT nama FROM kategori`, (err, result) => {
    res.render("dashboard", { kategori: result });
  });
});

app.get("/validate", (req, res) => {
  const { user } = req.cookies;
  if (typeof user == "undefined") return res.redirect("/login");

  // prettier-ignore
  db.query(`SELECT id_dokumen, nama, tanggal_masuk FROM dokumen WHERE accept=0 AND decline=0`, (err, result) => {
      if (err) console.error(err);
      db.query(`SELECT id_dokumen, nama, tanggal_masuk, kategori FROM dokumen WHERE accept=0 AND decline=0`,
        (err, secondResult) => {
          if (err) console.error(err);
          res.render("validate", { documents: secondResult });
      });
  });
});

app.post("/add-category", upload.none(), (req, res) => {
  const { categoryName } = req.body;
  const { level } = req.cookies;
  if (!(level > 0)) {
    return res.redirect(`/category?show=true&message=${encodeURIComponent("Tidak Memiliki Hak Akses!")}&color=danger`);
  }
  // prettier-ignore
  db.query(`INSERT INTO kategori(nama) VALUES('${categoryName}')`, (err, result) => {
    if (err) console.error(err);
    res.redirect(`/category?show=true&message=${encodeURIComponent("Berhasil Menambahkan Kategori!")}&color=success`);
  });
});

app.get("/category", (req, res) => {
  const { user } = req.cookies;
  if (typeof user == "undefined") return res.redirect("/login");
  // prettier-ignore
  db.query(`SELECT id, nama FROM kategori`, (err, result) => {
      if (err) console.error(err);
      res.render("category", { kategori: result });
  });
});

app.get("/logout", (req, res) => {
  res.clearCookie("user");
  res.clearCookie("level");
  res.redirect("/login");
});

app.post("/validate-doc", (req, res) => {
  const { status, document_id, userLevel } = req.body;
  if (!(userLevel > 0)) return res.json({ status: 0 });
  // prettier-ignore
  if (status == "accept") {
    db.query(`UPDATE dokumen SET accept=1 WHERE id_dokumen=${document_id}`, (_) => {
      res.json({ status: 1 });
    });
  } else {
    db.query(`UPDATE dokumen SET decline=1 WHERE id_dokumen=${document_id}`, (_) => {
      res.json({ status: 1 });
    });
  }
});

app.post("/del-category", (req, res) => {
  const { id, userLevel } = req.body;
  if (!(userLevel > 0)) return res.json({ status: 0 });
  // prettier-ignore
  db.query(`DELETE FROM kategori WHERE id=${id}`, (err, result) => {
    res.json({ status: 1 });
  });
});

app.post("/upload-doc", upload.single("dokumen"), (req, res) => {
  const dokumen = req.file;
  const { kategori } = req.body;
  const fileName = dokumen.originalname;
  // prettier-ignore
  const fileType = dokumen.mimetype.slice(dokumen.mimetype.lastIndexOf("/") + 1);
  const fileBlob = dokumen.buffer.toString("base64");
  const tanggalMasuk = new Date();
  // prettier-ignore
  db.query(`INSERT INTO dokumen(nama, kategori, tanggal_masuk, file_blob, file_type) VALUES('${fileName}', '${kategori}','${tanggalMasuk}','${fileBlob}','${fileType}')`, (err, result) => {
      if (err)
        return console.error(err);
        // res.redirect(`/dashboard?show=true&message=${encodeURIComponent("Terjadi kesalahan!")}&color=danger`);
      res.redirect(`/dashboard?show=true&message=${encodeURIComponent("Sukses meng-upload dokumen!")}&color=success`);
    }
  );
});

app.get("/login", (req, res) => {
  const { user } = req.cookies;
  if (typeof user != "undefined") return res.redirect("/dashboard");
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
  const { user } = req.cookies;
  if (typeof user == "undefined") return res.redirect("/login");
  const { username, password } = req.body;
  db.query(
    `INSERT INTO user(username, password, level) VALUES('${username}', '${password}', 1)`,
    (result) => {
      res.send(`success! ${result}`);
    }
  );
});

app.listen(port, host, console.log("listening on 3000"));
