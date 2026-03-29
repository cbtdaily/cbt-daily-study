// GANTI DENGAN WEB APP URL MILIKMU (Hasil dari New Deployment)
const API_URL = "https://script.google.com/macros/s/AKfycbxW1HqrkQifaNjXT0V5pGtNu6Ncu2ehdtAZGij4w1vPL-fAIzbp7dwRzpHmg8FEuL8J/exec"; 

let namaSiswa = "", kodeAktif = "", myDeviceId = "";
let jawabanSiswa = {}, raguSiswa = {}, semuaSoal = [], urutanSubtestSiswa = [];
let ujianAktif = false, currentSubtestIndex = 0, timerInterval, sisaDetik = 0;
let soalAktifIndex = 0; 
let soalSubtestSaatIni = []; 

let jedaInterval, detikJeda = 60; 
let jumlahPelanggaran = 0;
const maxPelanggaran = 5; 

window.onload = function() {
  myDeviceId = localStorage.getItem("cbt_device_id") || "DEV-" + Math.random().toString(36).substr(2, 9);
  localStorage.setItem("cbt_device_id", myDeviceId);
};

async function panggilAPI(data) {
  try {
    const response = await fetch(API_URL, {
      method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(data)
    });
    return await response.json();
  } catch (error) { console.error(error); alert("Gagal menghubungi server."); return null; }
}

function acakArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function bukaLogin() {
  document.getElementById("landing-screen").style.display = "none";
  document.getElementById("login-screen").style.display = "block";
  document.getElementById("kodeSiswa").focus();
}

async function prosesLogin() {
  const inputKode = document.getElementById("kodeSiswa").value.trim().toUpperCase();
  if(!inputKode) { alert("Masukkan kode."); return; }

  const btn = document.getElementById("btn-login");
  btn.innerText = "Verifikasi..."; btn.disabled = true;

  const respon = await panggilAPI({ action: "verifikasi", kode: inputKode, deviceId: myDeviceId });
  if(respon && respon.sukses) {
    namaSiswa = respon.nama; kodeAktif = respon.kode;
    const savedState = localStorage.getItem("cbt_state_" + kodeAktif);
    if(respon.resume && savedState && confirm("Lanjutkan ujian yang terputus?")) {
      pulihkanState(JSON.parse(savedState)); return;
    }
    
    btn.innerText = "Mengunduh Soal...";
    const soalRespon = await panggilAPI({ action: "getSoal" });
    if(soalRespon && soalRespon.sukses) mulaiUjianBaru(soalRespon.data);
  } else {
    alert(respon ? respon.pesan : "Gagal login"); btn.innerText = "Verifikasi & Mulai"; btn.disabled = false;
  }
}

function mulaiUjianBaru(dataSoal) {
  semuaSoal = dataSoal;
  const configBaku = [
    { id: "KPU", nama: "Penalaran Umum", waktu: 30 }, { id: "PPU", nama: "Pemahaman Umum", waktu: 15 },
    { id: "KMBM", nama: "Bacaan & Menulis", waktu: 25 }, { id: "PK", nama: "Pengetahuan Kuantitatif", waktu: 20 },
    { id: "LBI", nama: "Literasi B.Indo", waktu: 45 }, { id: "LBING", nama: "Literasi B.Inggris", waktu: 30 },
    { id: "PM", nama: "Penalaran Matematika", waktu: 30 }
  ];
  urutanSubtestSiswa = acakArray([...configBaku]); 
  document.getElementById("login-screen").style.display = "none";
  mulaiSubtest(0);
}

function simpanProgresLokal() {
  localStorage.setItem("cbt_state_" + kodeAktif, JSON.stringify({
    jawaban: jawabanSiswa, ragu: raguSiswa, soalDunduh: semuaSoal,
    urutanSubtes: urutanSubtestSiswa, subtesKe: currentSubtestIndex, sisaWaktu: sisaDetik
  }));
}

function pulihkanState(state) {
  jawabanSiswa = state.jawaban || {}; raguSiswa = state.ragu || {};
  semuaSoal = state.soalDunduh; urutanSubtestSiswa = state.urutanSubtes;
  document.getElementById("login-screen").style.display = "none";
  mulaiSubtest(state.subtesKe, state.sisaWaktu);
}

function mulaiSubtest(index, overrideWaktu = null) {
  if(index >= urutanSubtestSiswa.length) { kirimJawabanAkhir(); return; }
  
  currentSubtestIndex = index; const config = urutanSubtestSiswa[index]; ujianAktif = true;
  document.getElementById("jeda-screen").style.display = "none";
  document.getElementById("ujian-screen").style.display = "block";
  document.getElementById("nama-display").innerText = namaSiswa + " | " + kodeAktif;
  document.getElementById("judul-subtest").innerText = config.nama;

  document.getElementById("btn-next-subtest").style.display = (index < urutanSubtestSiswa.length - 1) ? "block" : "none";
  document.getElementById("btn-kirim-akhir").style.display = (index === urutanSubtestSiswa.length - 1) ? "block" : "none";

  // FILTER YANG DIPERBAIKI (Tahan banting terhadap spasi salah)
  let soalSub = semuaSoal.filter(s => s.subtest.trim().toUpperCase() === config.id.trim().toUpperCase());
  
  if (soalSub.length === 0) {
    document.getElementById("tempat-soal").innerHTML = `<div class="teks-soal" style="color:red; font-weight:bold;">Error: Soal untuk subtes ${config.nama} tidak ditemukan. Periksa nama sheet di Spreadsheet.</div>`;
  }

  soalSubtestSaatIni = overrideWaktu !== null ? soalSub : acakArray(soalSub);
  
  buatPetaNavigasi();
  bukaSoal(0); 

  sisaDetik = overrideWaktu !== null ? overrideWaktu : config.waktu * 60; 
  jalankanTimer();
}

function buatPetaNavigasi() {
  let htmlNav = "";
  soalSubtestSaatIni.forEach((soal, index) => {
    htmlNav += `<div id="nav-${index}" class="nav-box" onclick="bukaSoal(${index})">${index + 1}</div>`;
  });
  document.getElementById("navigasi-grid").innerHTML = htmlNav;
  updateSemuaWarnaNav();
}

function bukaSoal(index) {
  if(index < 0 || index >= soalSubtestSaatIni.length) return;
  soalAktifIndex = index;
  
  const soal = soalSubtestSaatIni[index];
  const id = soal.id;
  const ans = jawabanSiswa[id] || ""; 
  const isRagu = raguSiswa[id] ? true : false;
  
  let kontenSoal = "";
  if(soal.teksSoal) {
    if(soal.teksSoal.startsWith('http')) kontenSoal = `<img src="${soal.teksSoal}">`;
    else kontenSoal = `<div class="teks-soal">${soal.teksSoal.replace(/\n/g, '<br>')}</div>`;
  }
  const renderOpsi = (optText) => optText.startsWith('http') ? `<img src="${optText}" style="max-height:80px;">` : optText.replace(/\n/g, '<br>');

  let htmlSoal = `
    <div class="soal-card">
      <div class="soal-header"><span class="soal-nomor">Soal Nomor ${index + 1}</span></div>
      ${kontenSoal}
      <div class="opsi-container">
        ${['A','B','C','D','E'].map(opt => `
          <label class="opsi-label">
            <input type="radio" name="opsi" value="${opt}" ${ans===opt?'checked':''} onchange="simpanJawaban('${id}', '${opt}')"> 
            <span style="font-weight:700; color:#4a5568; margin-right:8px;">${opt}.</span> 
            <span style="flex-grow: 1;">${renderOpsi(soal['opsi'+opt])}</span>
          </label>
        `).join('')}
      </div>
    </div>`;
    
  document.getElementById("tempat-soal").innerHTML = htmlSoal;
  document.getElementById("cb-ragu").checked = isRagu;
  
  document.getElementById("btn-prev").disabled = (index === 0);
  document.getElementById("btn-next").disabled = (index === soalSubtestSaatIni.length - 1);
  
  updateSemuaWarnaNav();
  window.scrollTo(0, 0); 
  if (window.MathJax) { MathJax.typesetPromise([document.getElementById("tempat-soal")]).catch(err => console.log(err.message)); }
}

function gantiSoal(arah) { bukaSoal(soalAktifIndex + arah); }

function simpanJawaban(idSoal, jawaban) { 
  jawabanSiswa[idSoal] = jawaban; 
  if(raguSiswa[idSoal]) { raguSiswa[idSoal] = false; document.getElementById("cb-ragu").checked = false; }
  updateSemuaWarnaNav(); simpanProgresLokal(); 
}

function toggleRagu() { 
  const idSoal = soalSubtestSaatIni[soalAktifIndex].id;
  raguSiswa[idSoal] = document.getElementById("cb-ragu").checked; 
  updateSemuaWarnaNav(); simpanProgresLokal(); 
}

function updateSemuaWarnaNav() {
  soalSubtestSaatIni.forEach((soal, index) => {
    let box = document.getElementById("nav-" + index);
    if (!box) return;
    box.className = "nav-box";
    if (index === soalAktifIndex) box.classList.add("aktif");
    if (raguSiswa[soal.id]) box.classList.add("ragu"); 
    else if (jawabanSiswa[soal.id]) box.classList.add("dijawab");
  });
}

function jalankanTimer() {
  clearInterval(timerInterval); updateTampilanWaktu();
  timerInterval = setInterval(() => {
    sisaDetik--; updateTampilanWaktu();
    if(sisaDetik > 0 && sisaDetik % 5 === 0) simpanProgresLokal();
    if(sisaDetik <= 0) { clearInterval(timerInterval); alert(`Waktu subtes habis!`); masukJeda(); }
  }, 1000);
}

function updateTampilanWaktu() {
  let m = Math.floor(sisaDetik / 60); let d = sisaDetik % 60;
  document.getElementById("waktu-teks").innerText = `${m < 10 ? '0'+m : m}:${d < 10 ? '0'+d : d}`;
}

function mintaLanjutSubtest() {
  if(confirm("Apakah Anda yakin ingin menyelesaikan subtes ini sekarang? Sisa waktu Anda akan hangus.")) {
    clearInterval(timerInterval); masukJeda();
  }
}

function mintaAkhiriUjian() {
  if(confirm("Apakah Anda yakin ingin mengakhiri seluruh tryout?")) { kirimJawabanAkhir(); }
}

function masukJeda() {
  ujianAktif = false; clearInterval(timerInterval);
  if(currentSubtestIndex + 1 >= urutanSubtestSiswa.length) { kirimJawabanAkhir(); return; }
  
  document.getElementById("ujian-screen").style.display = "none";
  document.getElementById("jeda-screen").style.display = "block";
  document.getElementById("nama-next-subtest").innerText = urutanSubtestSiswa[currentSubtestIndex + 1].nama;
  
  detikJeda = 60; document.getElementById("timer-jeda").innerText = "01:00";
  jedaInterval = setInterval(() => {
    detikJeda--;
    let m = Math.floor(detikJeda / 60); let d = detikJeda % 60;
    document.getElementById("timer-jeda").innerText = `${m < 10 ? '0'+m : m}:${d < 10 ? '0'+d : d}`;
    if(detikJeda <= 0) { skipJeda(); }
  }, 1000);
}

function skipJeda() {
  clearInterval(jedaInterval);
  mulaiSubtest(currentSubtestIndex + 1);
}

async function kirimJawabanAkhir() {
  ujianAktif = false; clearInterval(timerInterval); clearInterval(jedaInterval);
  document.getElementById("ujian-screen").style.display = "none";
  document.getElementById("jeda-screen").style.display = "none";
  document.getElementById("hasil-screen").style.display = "block";
  document.getElementById("hasil-konten").innerHTML = `<h2 style="color:#1a202c;">Menyimpan Evaluasi...</h2><p>Harap tunggu, data sedang dikirim...</p>`;
  
  const hasil = await panggilAPI({ action: "submit", nama: namaSiswa, kode: kodeAktif, jawaban: jawabanSiswa });
  if(hasil) {
    localStorage.removeItem("cbt_state_" + kodeAktif); 
    document.getElementById("hasil-konten").innerHTML = `
      <h1 style="color:#1a202c; margin-bottom:8px;">Ujian Selesai</h1>
      <p style="color:#718096; margin-top:0;">Evaluasi telah direkam oleh sistem.</p>
      <div class="result-card">
        <div class="result-row"><span>Jawaban Benar</span><span class="result-val" style="color:#2f855a;">${hasil.benar}</span></div>
        <div class="result-row"><span>Salah / Kosong</span><span class="result-val" style="color:#c53030;">${hasil.salah}</span></div>
      </div>
      <p style="color:#4a5568; font-size:14px; margin-top:24px;">Skor IRT akan diumumkan kemudian.</p>`;
  } else { document.getElementById("hasil-konten").innerHTML = `<h2 style="color:#c53030;">Gagal Menyimpan</h2>`; }
}

function peringatkan(jenis) {
  if(!ujianAktif) return; jumlahPelanggaran++;
  panggilAPI({ action: "curang", nama: namaSiswa + " (" + kodeAktif + ")", jenis: jenis });
  const alertBox = document.getElementById("alert-curang");
  alertBox.style.display = "flex"; document.getElementById("alert-text").innerText = `Peringatan ${jumlahPelanggaran}/${maxPelanggaran}: ${jenis}.`;
  setTimeout(() => { alertBox.style.display = "none"; }, 6000);
  if(jumlahPelanggaran >= maxPelanggaran) { alert("AKSES DIBLOKIR."); kirimJawabanAkhir(); }
}
document.addEventListener("visibilitychange", function() { if (document.hidden && ujianAktif) peringatkan("Layar Mati/Pindah Tab"); });
window.addEventListener("blur", function() { if (ujianAktif) peringatkan("Split Screen"); });