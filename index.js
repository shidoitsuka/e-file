const express = require("express");
const path = require("path");
const fs = require("fs");
const bodyParser = require("body-parser");
const hbs = require("hbs");
const upload = require("multer")();
const cookieParser = require("cookie-parser");
const mysql = require("mysql");
const app = express();
// prettier-ignore
const { host, port, dbHost, dbUsername, dbPassword, dbName } = require("./config.js");
const { tmpdir } = require("os");
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
app.use("/data", express.static("data"));

app.get("/", (req, res) => {
  db.query("SELECT * FROM dokumen WHERE accept=1", (err, result) => {
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
  const { user, level } = req.cookies;
  if (typeof user == "undefined") return res.redirect("/login");
  let tmpData = [];
  let status;
  // prettier-ignore
  db.query(`SELECT * FROM dokumen`, (err, result) => {
    result.map(data => {
      if (data.accept == 1) data.status = "Disetujui";
      else if (data.decline == 1) data.status = "Ditolak";
      else data.status = "Pending";
      tmpData.push(data);
    });
    res.render("validate", { documents: tmpData, show: level > 0 });
  });
});

app.post("/add-category", upload.none(), (req, res) => {
  const { categoryName } = req.body;
  // prettier-ignore
  db.query(`INSERT INTO kategori(nama) VALUES('${categoryName}')`, (err, result) => {
    // if (err.sqlMessage.toLowerCase().includes("duplicate")) return res.redirect(`/category?show=true&message=${encodeURIComponent("Kategori sudah ada!")}&color=danger`);
    res.redirect(`/category?show=true&message=${encodeURIComponent("Berhasil Menambahkan Kategori!")}&color=success`);
  });
});

app.get("/category", (req, res) => {
  const { user, level } = req.cookies;
  if (typeof user == "undefined") return res.redirect("/login");
  // prettier-ignore
  db.query(`SELECT id, nama FROM kategori`, (err, result) => {
      if (err) console.error(err);
      res.render("category", { kategori: result, show: level > 0 });
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
    db.query(`UPDATE dokumen SET accept=1, decline=0 WHERE id=${document_id}`, (_) => {
      res.redirect(`/validate?show=true&message=${encodeURIComponent("Berhasil Menyetujui Dokumen!")}&color=success`);
    });
  } else {
    db.query(`UPDATE dokumen SET accept=0, decline=1 WHERE id=${document_id}`, (_) => {
      res.redirect(`/validate?show=true&message=${encodeURIComponent("Berhasil Menolak Dokumen!")}&color=success`);
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
  const fileBlob = dokumen.buffer;
  const tanggalMasuk = new Date();
  const dir = `./data/${kategori}/${fileName}`;
  if (!fs.existsSync(`./data/${kategori}`)) fs.mkdirSync(`./data/${kategori}`);
  fs.writeFileSync(`./data/${kategori}/${fileName}`, fileBlob);
  // prettier-ignore
  db.query(`INSERT INTO dokumen(nama, kategori, tanggal_masuk, dir, file_type) VALUES('${fileName}', '${kategori}','${tanggalMasuk}','${dir}','${fileType}')`, (err, result) => {
      if (err)
        return console.error(err);
        // res.redirect(`/dashboard?show=true&message=${encodeURIComponent("Terjadi kesalahan!")}&color=danger`);
      res.redirect(`/dashboard?show=true&message=${encodeURIComponent("Sukses meng-upload dokumen!")}&color=success`);
    }
  );
});

app.post("/download-doc", (req, res) => {
  const { id } = req.body;
  console.log(id);
  db.query(`SELECT dir FROM dokumen WHERE id=${id}`, (err, result) => {
    res.json({ result });
  });
});

app.get("/login", (req, res) => {
  const { user } = req.cookies;
  if (typeof user != "undefined") return res.redirect("/dashboard");
  res.render("login");
});

app.post("/login", upload.none(), (req, res) => {
  const { username, password } = req.body;
  // prettier-ignore
  db.query(`SELECT username, password, level FROM user WHERE username='${username}' AND password='${password}'`, (err, result) => { 
      if (!result.length) return res.redirect(`/login?show=true&message=${encodeURIComponent("Username/password salah atau tidak terdaftar!")}&color=danger`);
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
