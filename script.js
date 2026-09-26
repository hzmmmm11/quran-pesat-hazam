const API_BASE_URL = 'https://equran.id/api/v2';

const state = {
  suratList: [],
  suratTerpilih: null,
  currentQuestion: null,
  score: 0,
  mentorMode: 'tebak-ayat',
  answered: false,
};

const elements = {
  tabButtons: document.querySelectorAll('.tab'),
  panelMap: {
    'surat-panel': document.getElementById('surat-panel'),
    'mentor-panel': document.getElementById('mentor-panel'),
  },
  statusText: document.getElementById('statusText'),
  suratList: document.getElementById('suratList'),
  suratDetail: document.getElementById('suratDetail'),
  mentorStatus: document.getElementById('mentorStatus'),
  mentorSuratLabel: document.getElementById('mentorSuratLabel'),
  scoreValue: document.getElementById('scoreValue'),
  mentorQuestion: document.getElementById('mentorQuestion'),
  mentorOptions: document.getElementById('mentorOptions'),
  mentorFeedback: document.getElementById('mentorFeedback'),
  nextQuestionBtn: document.getElementById('nextQuestionBtn'),
  restartBtn: document.getElementById('restartBtn'),
  modeButtons: document.querySelectorAll('.mode-btn'),
};

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function setStatus(element, message, type = 'info') {
  element.textContent = message;
  element.className = 'status';

  if (type === 'error') {
    element.classList.add('error');
  }

  if (type === 'success') {
    element.classList.add('success');
  }
}

function shuffleArray(items) {
  const cloned = [...items];
  for (let index = cloned.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(Math.random() * (index + 1));
    [cloned[index], cloned[randomIndex]] = [cloned[randomIndex], cloned[index]];
  }
  return cloned;
}

function setActiveTab(targetId) {
  elements.tabButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.target === targetId);
  });

  Object.entries(elements.panelMap).forEach(([panelId, panel]) => {
    panel.classList.toggle('active', panelId === targetId);
  });
}

function renderMentorMessage(message, type = 'info') {
  setStatus(elements.mentorStatus, message, type);
  elements.mentorQuestion.innerHTML = '';
  elements.mentorOptions.innerHTML = '';
  elements.mentorFeedback.textContent = '';
  elements.mentorFeedback.className = 'feedback';
}

async function loadSuratList() {
  setStatus(elements.statusText, 'Memuat daftar surat...', 'info');

  try {
    const response = await fetch(`${API_BASE_URL}/surat`);

    if (!response.ok) {
      throw new Error(`Gagal mengambil daftar surat: ${response.status}`);
    }

    const result = await response.json();
    const list = Array.isArray(result?.data) ? result.data : [];

    state.suratList = list;

    if (!list.length) {
      elements.suratList.innerHTML = '<div class="empty-message">Tidak ada data surat yang tersedia.</div>';
      setStatus(elements.statusText, 'Data surat tidak tersedia.', 'error');
      return;
    }

    elements.suratList.innerHTML = '';
    list.forEach((surat) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'surat-item';
      button.dataset.nomor = surat.nomor;
      button.innerHTML = `
        <strong>${escapeHtml(surat.namaLatin)}</strong>
        <span>${escapeHtml(surat.arti)} • ${surat.jumlahAyat} ayat</span>
      `;

      button.addEventListener('click', async () => {
        elements.suratList.querySelectorAll('.surat-item').forEach((item) => item.classList.remove('active'));
        button.classList.add('active');
        await loadSuratDetail(Number(surat.nomor));
      });

      elements.suratList.appendChild(button);
    });

    setStatus(elements.statusText, 'Daftar surat berhasil dimuat.', 'success');
  } catch (error) {
    console.error(error);
    elements.suratList.innerHTML = '<div class="empty-message">Gagal memuat daftar surat. Periksa koneksi jaringan atau API.</div>';
    setStatus(elements.statusText, 'Jaringan atau API gagal. Coba lagi nanti.', 'error');
  }
}

async function loadSuratDetail(nomor) {
  setStatus(elements.statusText, 'Memuat detail surat...', 'info');

  try {
    const response = await fetch(`${API_BASE_URL}/surat/${nomor}`);

    if (!response.ok) {
      throw new Error(`Gagal mengambil surat ${nomor}: ${response.status}`);
    }

    const result = await response.json();
    const surat = result?.data;

    if (!surat || !Array.isArray(surat.ayat)) {
      throw new Error('Format data surat tidak sesuai dengan API.');
    }

    state.suratTerpilih = surat;
    elements.mentorSuratLabel.textContent = `Surat aktif: ${surat.namaLatin} (${surat.jumlahAyat} ayat)`;
    renderSuratDetail(surat);
    prepareMentorState();
    setStatus(elements.statusText, `Surat ${surat.namaLatin} berhasil dimuat.`, 'success');
  } catch (error) {
    console.error(error);
    state.suratTerpilih = null;
    renderSuratDetail(null);
    renderMentorMessage('Gagal memuat surat yang dipilih. Periksa jaringan atau API.', 'error');
    setStatus(elements.statusText, 'Jaringan atau API gagal saat memuat surat.', 'error');
  }
}

function renderSuratDetail(surat) {
  if (!surat) {
    elements.suratDetail.innerHTML = '<div class="empty-message">Pilih surat untuk menampilkan ayat.</div>';
    return;
  }

  const ayatList = surat.ayat
    .map(
      (ayat) => `
        <article class="ayat-item">
          <div class="ayat-number">Ayat ${ayat.nomorAyat}</div>
          <div class="ayat-arab" dir="rtl">${escapeHtml(ayat.teksArab)}</div>
          <div class="ayat-indonesian">${escapeHtml(ayat.teksIndonesia || 'Terjemahan belum tersedia.')}</div>
        </article>
      `
    )
    .join('');

  elements.suratDetail.innerHTML = `
    <div class="surat-header">
      <h3>${escapeHtml(surat.namaLatin)} (${escapeHtml(surat.nama)})</h3>
      <div class="surat-meta">
        <span>Nomor: ${surat.nomor}</span>
        <span>Jumlah Ayat: ${surat.jumlahAyat}</span>
        <span>Tempat Turun: ${escapeHtml(surat.tempatTurun || '-')}</span>
      </div>
    </div>
    <div class="ayat-list">${ayatList}</div>
  `;
}

function prepareMentorState() {
  if (!state.suratTerpilih) {
    renderMentorMessage('Pilih surat di menu Al-Qur’an terlebih dahulu.', 'error');
    return;
  }

  if (state.suratTerpilih.ayat.length < 4) {
    renderMentorMessage('Surat ini memiliki kurang dari empat ayat. Pilih surat lain agar soal tidak ambigu.', 'error');
    return;
  }

  elements.scoreValue.textContent = String(state.score);
  generateQuestion();
}

function setMentorMode(mode) {
  state.mentorMode = mode;
  elements.modeButtons.forEach((button) => {
    button.classList.toggle('active', button.dataset.mode === mode);
  });

  if (!state.suratTerpilih) {
    renderMentorMessage('Pilih surat di menu Al-Qur’an terlebih dahulu.', 'error');
    return;
  }

  generateQuestion();
}

function generateQuestion() {
  if (!state.suratTerpilih || !Array.isArray(state.suratTerpilih.ayat)) {
    renderMentorMessage('Pilih surat yang valid untuk mulai latihan.', 'error');
    return;
  }

  const ayat = state.suratTerpilih.ayat;

  if (ayat.length < 4) {
    renderMentorMessage('Jumlah ayat kurang dari empat. Pilih surat lain agar pilihan tidak ambigu.', 'error');
    return;
  }

  state.answered = false;
  elements.mentorFeedback.textContent = '';
  elements.mentorFeedback.className = 'feedback';

  if (state.mentorMode === 'tebak-ayat') {
    buildTebakAyatQuestion(ayat);
    return;
  }

  buildSambungAyatQuestion(ayat);
}

function buildTebakAyatQuestion(ayat) {
  const correctAyat = ayat[Math.floor(Math.random() * ayat.length)];
  const wrongNumbers = ayat
    .map((item) => item.nomorAyat)
    .filter((nomor) => nomor !== correctAyat.nomorAyat);

  const fallbackOptions = shuffleArray(wrongNumbers).slice(0, 2);

  if (fallbackOptions.length < 2) {
    renderMentorMessage('Jumlah ayat kurang dari empat. Pilih surat lain agar pilihan tidak ambigu.', 'error');
    return;
  }

  const options = shuffleArray([correctAyat.nomorAyat, ...fallbackOptions]);

  state.currentQuestion = {
    type: 'tebak-ayat',
    correctValue: correctAyat.nomorAyat,
    prompt: correctAyat.teksArab,
    options,
  };

  elements.mentorQuestion.innerHTML = `
    <p class="question-label">Tebak nomor ayat yang tepat:</p>
    <div class="ayat-arab" dir="rtl">${escapeHtml(correctAyat.teksArab)}</div>
  `;

  elements.mentorOptions.innerHTML = '';
  state.currentQuestion.options.forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'answer-option';
    button.dataset.value = String(option);
    button.textContent = `Ayat ${option}`;
    button.addEventListener('click', () => handleAnswer(option));
    elements.mentorOptions.appendChild(button);
  });
}

function buildSambungAyatQuestion(ayat) {
  const lastIndex = ayat.length - 1;
  const startIndex = Math.floor(Math.random() * lastIndex);
  const currentAyat = ayat[startIndex];
  const nextAyat = ayat[startIndex + 1];

  if (!nextAyat) {
    renderMentorMessage('Tidak ada ayat berikutnya yang bisa dipilih di surat ini. Pilih surat lain.', 'error');
    return;
  }

  const wrongTexts = ayat
    .filter((item) => item.nomorAyat !== nextAyat.nomorAyat && item.nomorAyat !== currentAyat.nomorAyat)
    .map((item) => item.teksArab);

  const distinctWrongTexts = shuffleArray(wrongTexts).slice(0, 2);

  if (distinctWrongTexts.length < 2) {
    renderMentorMessage('Jumlah ayat kurang dari empat. Pilih surat lain agar pilihan tidak ambigu.', 'error');
    return;
  }

  const options = shuffleArray([nextAyat.teksArab, ...distinctWrongTexts]);

  state.currentQuestion = {
    type: 'sambung-ayat',
    correctValue: nextAyat.teksArab,
    prompt: currentAyat.teksArab,
    options,
  };

  elements.mentorQuestion.innerHTML = `
    <p class="question-label">Sambung ayat berikutnya:</p>
    <div class="ayat-arab" dir="rtl">${escapeHtml(currentAyat.teksArab)}</div>
  `;

  elements.mentorOptions.innerHTML = '';
  state.currentQuestion.options.forEach((option) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'answer-option';
    button.dataset.value = option;
    button.innerHTML = `<span dir="rtl">${escapeHtml(option)}</span>`;
    button.addEventListener('click', () => handleAnswer(option));
    elements.mentorOptions.appendChild(button);
  });
}

function handleAnswer(selectedValue) {
  if (!state.currentQuestion || state.answered) {
    return;
  }

  state.answered = true;
  const buttons = elements.mentorOptions.querySelectorAll('.answer-option');
  const correctValue = state.currentQuestion.correctValue;
  const isCorrect = String(selectedValue) === String(correctValue);

  buttons.forEach((button) => {
    const buttonValue = String(button.dataset.value ?? '');

    if (buttonValue === String(correctValue)) {
      button.classList.add('correct');
    }

    if (buttonValue === String(selectedValue) && !isCorrect) {
      button.classList.add('wrong');
    }

    button.disabled = true;
  });

  if (isCorrect) {
    state.score += 10;
    elements.scoreValue.textContent = String(state.score);
    elements.mentorFeedback.textContent = 'Benar! +10 poin.';
    elements.mentorFeedback.className = 'feedback correct';
    return;
  }

  const correctText = state.currentQuestion.type === 'tebak-ayat'
    ? `Ayat ${correctValue}`
    : 'Jawaban yang benar berada di pilihan yang tepat.';

  elements.mentorFeedback.textContent = `Salah. ${correctText}`;
  elements.mentorFeedback.className = 'feedback wrong';
}

function resetScoreAndQuestion() {
  state.score = 0;
  elements.scoreValue.textContent = '0';
  elements.mentorFeedback.textContent = '';
  elements.mentorFeedback.className = 'feedback';
  generateQuestion();
}

document.querySelectorAll('.tab').forEach((button) => {
  button.addEventListener('click', () => setActiveTab(button.dataset.target));
});

document.querySelectorAll('.mode-btn').forEach((button) => {
  button.addEventListener('click', () => setMentorMode(button.dataset.mode));
});

elements.nextQuestionBtn.addEventListener('click', () => {
  if (!state.suratTerpilih) {
    renderMentorMessage('Pilih surat terlebih dahulu agar soal bisa dibuat.', 'error');
    return;
  }
  generateQuestion();
});

elements.restartBtn.addEventListener('click', resetScoreAndQuestion);

setActiveTab('surat-panel');
setStatus(elements.mentorStatus, 'Pilih surat di menu Al-Qur’an terlebih dahulu.', 'info');
loadSuratList();
