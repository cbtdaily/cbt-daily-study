// URL API KAMU SUDAH TERSAMBUNG DI SINI:
const API_URL = "https://script.google.com/macros/s/AKfycbxW1HqrkQifaNjXT0V5pGtNu6Ncu2ehdtAZGij4w1vPL-fAIzbp7dwRzpHmg8FEuL8J/exec"; 

let namaSiswa = "", kodeAktif = "", myDeviceId = "";
let jawabanSiswa = {}, raguSiswa = {}, semuaSoal = [], urutanSubtestSiswa = [];
let ujianAktif = false, currentSubtestIndex = 0, timerInterval, sisaDetik = 0;

let jumlahPelanggaran = 0;
const maxPelanggaran = 5; 

window.onload = function() {
  myDeviceId = localStorage.getItem("cbt_device_id") || "DEV-" + Math.random().toString(36).substr(2, 9);
  localStorage.setItem("cbt_device_id", myDeviceId);
};

// Fungsi Komunikasi ke Google API
async function panggilAPI(data) {
  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(data)
    });
    return await response.json();
  } catch (error) {
    console.error("Error API:", error);
    alert("Gagal menghubungi server. Periksa koneksi internet.");
    return null;
  }
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
  if(!inputKode) { alert("Masukkan kode pendaftaran."); return; }

  const btn = document.getElementById("btn-login");
  btn.innerText = "Verifikasi..."; btn.disabled = true;

  const respon = await panggilAPI({ action: "verifikasi", kode: inputKode, deviceId: myDeviceId });
  
  if(respon && respon.sukses) {
    namaSiswa = respon.nama; kodeAktif = respon.kode;
    const savedState = localStorage.getItem("cbt_state_" + kodeAktif);
    
    if(respon.resume && savedState && confirm("Ditemukan sesi ujian yang belum selesai. Lanjutkan?")) {
      pulihkanState(JSON.parse(savedState)); return;
    }
    
    btn.innerText = "Mengunduh Soal...";
    const soalRespon = await panggilAPI({ action: "getSoal" });
    if(soalRespon && soalRespon.sukses) {
      mulaiUjianBaru(soalRespon.data);
    }
  } else if(respon) {
    alert(respon.pesan);
    btn.innerText = "Verifikasi & Mulai"; btn.disabled = false;
  } else {
    btn.innerText = "Verifikasi & Mulai"; btn.disabled = false;
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
  pindahKeLayarUjian(); mulaiSubtest(0);
}

function pindahKeLayarUjian() {
  document.getElementById("login-screen").style.display = "none";
  document.getElementById("ujian-screen").style.display = "block";
  document.getElementById("nama-display").innerText = namaSiswa + " | " + kodeAktif;
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
  pindahKeLayarUjian(); mulaiSubtest(state.subtesKe, state.sisaWaktu);
}

function mulaiSubtest(index, overrideWaktu = null) {
  if(index >= urutanSubtestSiswa.length) { kirimJawabanAkhir(); return; }

  currentSubtestIndex = index; const config = urutanSubtestSiswa[index]; ujianAktif = true;

  document.getElementById("judul-subtest").innerText = config.nama;
  document.getElementById("btn-next-subtest").style.display = (index < urutanSubtestSiswa.length - 1) ? "block" : "none";
  document.getElementById("btn-kirim-akhir").style.display = (index === urutanSubtestSiswa.length - 1) ? "block" : "none";

  let soalSubtest = semuaSoal.filter(s => s.subtest.toUpperCase() === config.id.toUpperCase());
  if(!overrideWaktu) soalSubtest = acakArray(soalSubtest); 
  
  renderSoalDanNavigasi(soalSubtest);
  sisaDetik = overrideWaktu !== null ? overrideWaktu : config.waktu * 60; 
  jalankanTimer();
}

function jalankanTimer() {
  clearInterval(timerInterval); updateTampilanWaktu();
  timerInterval = setInterval(() => {
    sisaDetik--; updateTampilanWaktu();
    if(sisaDetik > 0 && sisaDetik % 5 === 0) simpanProgresLokal();
    if(sisaDetik <= 0) { clearInterval(timerInterval); alert(`Waktu subtes habis.`); lanjutSubtest(); }
  }, 1000);
}

function updateTampilanWaktu() {
  let m = Math.floor(sisaDetik / 60); let d = sisaDetik % 60;
  document.getElementById("waktu-teks").innerText = `${m < 10 ? '0'+m : m}:${d < 10 ? '0'+d : d}`;
}

function renderSoalDanNavigasi(soalList) {
  let htmlSoal = "", htmlNav = "";
  
  if(soalList.length === 0) {
    htmlSoal = "<div style='text-align:center; padding: 40px; color:#718096;'>Soal belum tersedia di database.</div>";
  } else {
    soalList.forEach((soal, index) => {
      const id = soal.id; let navClass = "nav-box";
      if (raguSiswa[id]) navClass += " ragu"; else if (jawabanSiswa[id]) navClass += " dijawab";

      htmlNav += `<div id="nav-${id}" class="${navClass}" onclick="document.getElementById('soal-${id}').scrollIntoView({behavior: 'smooth', block: 'center'})">${index + 1}</div>`;

      const ans = jawabanSiswa[id] || ""; const isRagu = raguSiswa[id] ? "checked" : "";
      
      let kontenSoal = "";
      if(soal.teksSoal) {
        if(soal.teksSoal.startsWith('http')) kontenSoal = `<img src="${soal.teksSoal}">`;
        else kontenSoal = `<div class="teks-soal">${soal.teksSoal.replace(/\n/g, '<br>')}</div>`;
      }
      
      const renderOpsi = (optText) => optText.startsWith('http') ? `<img src="${optText}" style="max-height:80px;">` : optText.replace(/\n/g, '<br>');

      htmlSoal += `
        <div id="soal-${id}" class="soal-card">
          <div class="soal-header">
            <span class="soal-nomor">Soal ${index + 1}</span>
            <label class="label-ragu">
              <input type="checkbox" onchange="toggleRagu('${id}', this.checked)" ${isRagu} style="accent-color:#b7791f; cursor:pointer;"> 
              Tandai Ragu
            </label>
          </div>
          ${kontenSoal}
          <div class="opsi-container">
            ${['A','B','C','D','E'].map(opt => `
              <label class="opsi-label">
                <input type="radio" name="${id}" value="${opt}" ${ans===opt?'checked':''} onchange="simpanJawaban('${id}', '${opt}')"> 
                <span style="font-weight:700; color:#4a5568; margin-right:8px;">${opt}.</span> 
                <span style="flex-grow: 1;">${renderOpsi(soal['opsi'+opt])}</span>
              </label>
            `).join('')}
          </div>
        </div>`;
    });
  }
  
  document.getElementById("navigasi-grid").innerHTML = htmlNav;
  document.getElementById("tempat-soal").innerHTML = htmlSoal;
  window.scrollTo(0, 0); 
  
  if (window.MathJax) { MathJax.typesetPromise([document.getElementById("tempat-soal")]).catch(err => console.log(err.message)); }
}

function simpanJawaban(idSoal, jawaban) { jawabanSiswa[idSoal] = jawaban; updateNavBox(idSoal); simpanProgresLokal(); }
function toggleRagu(idSoal, isChecked) { raguSiswa[idSoal] = isChecked; updateNavBox(idSoal); simpanProgresLokal(); }

function updateNavBox(idSoal) {
  let box = document.getElementById("nav-" + idSoal); if (!box) return;
  box.className = "nav-box"; 
  if (raguSiswa[idSoal]) box.classList.add("ragu"); else if (jawabanSiswa[idSoal]) box.classList.add("dijawab");
}

function lanjutSubtest() { clearInterval(timerInterval); mulaiSubtest(currentSubtestIndex + 1); }

async function kirimJawabanAkhir() {
  clearInterval(timerInterval); ujianAktif = false;
  document.getElementById("ujian-screen").style.display = "none";
  document.getElementById("hasil-screen").style.display = "block";
  document.getElementById("hasil-konten").innerHTML = `<h2 style="color:#1a202c;">Menyimpan Evaluasi...</h2><p style="color:#718096;">Harap tunggu sejenak, data sedang dikirim ke database.</p>`;
  
  const hasil = await panggilAPI({ action: "submit", nama: namaSiswa, kode: kodeAktif, jawaban: jawabanSiswa });
  
  if(hasil) {
    localStorage.removeItem("cbt_state_" + kodeAktif); 
    document.getElementById("hasil-konten").innerHTML = `
      <h1 style="color:#1a202c; margin-bottom:8px;">Ujian Selesai</h1>
      <p style="color:#718096; margin-top:0;">Evaluasi telah direkam oleh sistem.</p>
      
      <div class="result-card">
        <div class="result-row">
          <span>Total Jawaban Benar</span>
          <span class="result-val" style="color:#2f855a;">${hasil.benar} Soal</span>
        </div>
        <div class="result-row">
          <span>Total Salah / Kosong</span>
          <span class="result-val" style="color:#c53030;">${hasil.salah} Soal</span>
        </div>
      </div>
      <p style="color:#4a5568; font-size:14px; line-height:1.6; margin-top:24px;">Skor akhir menggunakan standarisasi IRT akan diumumkan secara kolektif oleh Panitia Akademik Daily Study.</p>
      `;
  } else {
    document.getElementById("hasil-konten").innerHTML = `<h2 style="color:#c53030;">Gagal Menyimpan</h2><p>Tolong periksa koneksi dan refresh halaman.</p>`;
  }
}

// --- ANTI CHEAT SENSOR ---
function peringatkan(jenis) {
  if(!ujianAktif) return; jumlahPelanggaran++;
  panggilAPI({ action: "curang", nama: namaSiswa + " (" + kodeAktif + ")", jenis: jenis });
  
  const alertBox = document.getElementById("alert-curang");
  const alertText = document.getElementById("alert-text");
  alertBox.style.display = "flex"; 
  alertText.innerText = `Peringatan ${jumlahPelanggaran}/${maxPelanggaran}: Deteksi ${jenis}.`;
  setTimeout(() => { alertBox.style.display = "none"; }, 6000);
  
  if(jumlahPelanggaran >= maxPelanggaran) { 
    alert("AKSES DIBLOKIR. Terlalu banyak pelanggaran sistem."); kirimJawabanAkhir(); 
  }
}

document.addEventListener("visibilitychange", function() { if (document.hidden && ujianAktif) peringatkan("Layar Mati / Pindah Tab"); });
window.addEventListener("blur", function() { if (ujianAktif) peringatkan("Layar Kehilangan Fokus / Split Screen"); });
document.addEventListener('keyup', e => { if(e.key === 'PrintScreen') peringatkan("Pengambilan Tangkapan Layar"); });
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('dragstart', e => e.preventDefault());
document.addEventListener('keydown', e => {
  if(e.key === 'F12' || (e.ctrlKey && e.shiftKey && (e.key==='I' || e.key==='J' || e.key==='i' || e.key==='j')) || (e.ctrlKey && (e.key==='U' || e.key==='P' || e.key==='C' || e.key==='S' || e.key==='u' || e.key==='p' || e.key==='c' || e.key==='s'))) {
    e.preventDefault(); 
    if(e.key === 'F12' || e.key.toUpperCase() === 'I' || e.key.toUpperCase() === 'J') peringatkan("Percobaan Bypass Sistem");
  }
  if(e.metaKey && e.shiftKey && (e.key === '3' || e.key === '4')) peringatkan("Pengambilan Tangkapan Layar");
});