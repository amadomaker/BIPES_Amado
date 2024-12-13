function openSoundModal() {
  buildActiveNotes();

  if (
    activeNotes.length === 0 ||
    activeNotes.every((note) => note.note === null)
  ) {
    alert("Nenhuma melodia para salvar!");
    return;
  }
  document.getElementById("saveSoundModal").style.display = "block";
}

function closeSoundModal() {
  document.getElementById("saveSoundModal").style.display = "none";
}

function openExportSoundModal() {
  buildActiveNotes();

  if (
    activeNotes.length === 0 ||
    activeNotes.every((note) => note.note === null)
  ) {
    alert("Nenhuma melodia para exportar!");
    return;
  }

  document.getElementById("exportSoundModal").style.display = "block";
}

function closeExportSoundModal() {
  document.getElementById("exportSoundModal").style.display = "none";
}

function openImportSoundModal() {
  document.getElementById("importSoundModal").style.display = "block";
}

function closeImportSoundModal() {
  document.getElementById("importSoundModal").style.display = "none";
}

// array de notas musicais com seus nomes e frequências
const notes = [
  { name: "C4", frequency: 261.63 },
  { name: "D4", frequency: 293.66 },
  { name: "E4", frequency: 329.63 },
  { name: "F4", frequency: 349.23 },
  { name: "G4", frequency: 392.0 },
  { name: "A4", frequency: 440.0 },
  { name: "B4", frequency: 493.88 },
  { name: "C5", frequency: 523.25 },
];

const pianoContainer = document.getElementById("piano-container");
let audioContext = null; // contexto de áudio para reproduzir sons
let activeNotes = []; // array para armazenar as notas ativas
const pianoCols = 32; // número de colunas no grid do piano

// cria a interface do piano com 32 colunas para cada nota
notes.forEach((note, rowIndex) => {
  for (let colIndex = 0; colIndex < pianoCols; colIndex++) {
    const noteDiv = document.createElement("div");
    noteDiv.classList.add("note", note.name);
    noteDiv.innerHTML = note.name;
    noteDiv.dataset.note = note.name;
    noteDiv.dataset.frequency = note.frequency;
    noteDiv.dataset.row = rowIndex;
    noteDiv.dataset.col = colIndex;

    // alterna a ativação da nota ao clicar
    noteDiv.addEventListener("click", () => {
      const column = colIndex;

      // desmarcar as notas da mesma coluna
      document
        .querySelectorAll(`.note[data-col="${column}"].active`)
        .forEach((activeNote) => {
          if (activeNote !== noteDiv) {
            activeNote.classList.remove("active");
          }
        });

      noteDiv.classList.toggle("active");

      if (noteDiv.classList.contains("active")) {
        const bpm = document.getElementById("bpm").value;
        const beatDuration = 60000 / bpm;

        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        playTone(note.frequency, beatDuration);

        audioContext = null;
      }
    });

    pianoContainer.appendChild(noteDiv);
  }
});

// função para construir o array de notas ativas
function buildActiveNotes() {
  activeNotes = [];
  let currentNote = null;

  // percorre cada coluna para verificar notas ativas
  for (let col = 0; col < pianoCols; col++) {
    let hasActiveNote = false;

    // verifica cada linha para encontrar notas ativas
    for (let row = 0; row < notes.length; row++) {
      const noteDiv = document.querySelector(
        `.note[data-row="${row}"][data-col="${col}"]`
      );

      if (noteDiv.classList.contains("active")) {
        hasActiveNote = true;

        if (currentNote) {
          activeNotes.push(currentNote);
        }

        currentNote = {
          note: noteDiv.dataset.note,
          frequency: parseFloat(noteDiv.dataset.frequency),
          duration: 1,
          startCol: col,
        };

        break;
      }
    }

    // Se não há nota ativa na coluna adicionar silêncio
    if (!hasActiveNote) {
      if (currentNote) {
        activeNotes.push(currentNote);
        currentNote = null;
      }

      if (
        activeNotes.length > 0 &&
        activeNotes[activeNotes.length - 1].note === null
      ) {
        activeNotes[activeNotes.length - 1].duration += 1;
      } else {
        activeNotes.push({
          note: null,
          frequency: null,
          duration: 1,
          startCol: col,
          isSilence: true,
        });
      }
    }
  }

  if (currentNote) {
    activeNotes.push(currentNote);
  }

  activeNotes.pop();
}

function verifyMelodyExists(name) {
  // verifica se uma melodia existe pelo nome
  const melodies = retrieveMelodies();

  const melodiesExists = melodies.filter((melody) => melody.name === name)[0];

  if (melodiesExists) {
    return true;
  }

  return false;
}

function retrieveMelodies() {
  // retorna as melodias do localstorage
  const melodiesString = localStorage.getItem("bipes@melodies");

  if (melodiesString) {
    return JSON.parse(melodiesString);
  }

  return [];
}

function clearSoundInput() {
  document.getElementById("soundName").value = "";
}

// salva a melodia no localStorage
function saveMelody(e) {
  e.preventDefault();
  const melodyName = document.getElementById("soundName").value;

  if (!melodyName) {
    alert("Dê um nome para a nova melodia");
    return;
  }

  if (verifyMelodyExists(melodyName)) {
    alert(`Melodia com nome ${melodyName} já criada!`);
    return;
  }

  buildActiveNotes();

  if (activeNotes.length > 0) {
    const bpm = document.getElementById("bpm").value;
    const newMelody = { name: melodyName, notes: activeNotes, bpm };

    addMelodyToLocalStorage(newMelody);

    closeSoundModal();
    clearSoundInput();
    alert("Melodia salva com sucesso!");
  } else {
    alert("Nenhuma melodia para salvar");
  }
}

function addMelodyToLocalStorage(newMelody) {
  const prevMelodies = localStorage.getItem("bipes@melodies");
  let updatedMelodies = prevMelodies ? JSON.parse(prevMelodies) : [];

  updatedMelodies.push(newMelody);

  localStorage.setItem("bipes@melodies", JSON.stringify(updatedMelodies));
}

let timeoutHandles = []; // Armazena timeouts para poder limpá-los ao pausar ou reiniciar

function playMelody() {
  // Limpa qualquer execução anterior
  stopPlayback();

  // Reinicia o contexto de áudio
  audioContext = new (window.AudioContext || window.webkitAudioContext)();

  const bpm = document.getElementById("bpm").value;
  const beatDuration = 60000 / bpm;

  buildActiveNotes();

  // Identifica a última coluna com uma nota ativa
  let lastActiveCol = -1;
  activeNotes.forEach((note) => {
    if (note.note && note.startCol + note.duration > lastActiveCol) {
      lastActiveCol = note.startCol + note.duration - 1;
    }
  });

  // Se não houver notas ativas, interrompe a execução
  if (lastActiveCol < 0) {
    alert("Nenhuma nota ativa para tocar!");
    return;
  }

  // desabilita o piano
  pianoContainer.classList.add("piano-disabled");

  let currentTime = 0;
  const playbackBar = document.getElementById("playback-bar");
  playbackBar.style.display = "block";
  playbackBar.style.transform = `translateX(0)`;

  const columnWidth = pianoContainer.offsetWidth / pianoCols;

  // Animação da barra e reprodução de notas
  for (let col = 0; col <= lastActiveCol; col++) {
    const barTimeout = setTimeout(() => {
      playbackBar.style.transform = `translateX(${col * columnWidth}px)`;

      // Reproduz as notas na coluna atual uma após a outra
      const notesInColumn = activeNotes.filter(
        (note) => note.startCol === col && note.note
      );
      notesInColumn.forEach((note, index) => {
        const noteTimeout = setTimeout(() => {
          playTone(note.frequency, note.duration * beatDuration);
        }, index * beatDuration); // Toca cada nota em sequência, uma após a outra
        timeoutHandles.push(noteTimeout);
      });
    }, currentTime);

    timeoutHandles.push(barTimeout);
    currentTime += beatDuration;
  }

  // Esconde a barra quando a melodia termina
  const hideTimeout = setTimeout(() => {
    playbackBar.style.display = "none";
    pianoContainer.classList.remove("piano-disabled");
  }, currentTime);
  timeoutHandles.push(hideTimeout);
}

// Pausar e reiniciar a reprodução
function pauseMelody() {
  stopPlayback();
}

// Limpa a reprodução em andamento
function stopPlayback() {
  pianoContainer.classList.remove("piano-disabled");
  timeoutHandles.forEach(clearTimeout);
  timeoutHandles = [];

  // Fecha o contexto de áudio e reseta a barra de reprodução
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }

  const playbackBar = document.getElementById("playback-bar");
  playbackBar.style.display = "none";
  playbackBar.style.transform = `translateX(0)`;
}

// toca uma nota com uma frequência e duração específicas
function playTone(frequency, duration) {
  if (!audioContext || !frequency) return;

  const oscillator = audioContext.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  oscillator.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration / 1000);
}

// import e export

function exportMelody(e) {
  e.preventDefault();
  buildActiveNotes();

  if (
    activeNotes.length === 0 ||
    activeNotes.every((note) => note.note === null)
  ) {
    alert("Nenhuma melodia para exportar!");
    return;
  }

  const inputExport = document.getElementById("soundNameExportInput");
  const melodyName = inputExport.value;

  if (!melodyName) {
    alert("Dê um nome para melodia");
    return;
  }

  const bpm = document.getElementById("bpm").value;

  const melodyData = {
    name: melodyName,
    notes: activeNotes,
    bpm: bpm || 120
  };

  const jsonStr = JSON.stringify(melodyData, null, 2);
  const blob = new Blob([jsonStr], { type: "application/json" });
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = melodyName;
  a.click();

  URL.revokeObjectURL(url);

  inputExport.value = "";
  closeExportSoundModal();
  alert("Melodia '" + melodyName + "' exportada com sucesso!");
}

function clearPiano() {
  stopPlayback();
  pianoContainer.classList.remove("piano-disabled");
  // limpa as notas ativas
  document.querySelectorAll(".note.active").forEach((noteDiv) => {
    noteDiv.classList.remove("active");
  });
}

// Função para exibir a melodia importada no piano
function displayImportedMelody(notes) {
  clearPiano();

  // Percorre cada nota da melodia importada
  notes.forEach((note) => {
    // Para cada nota, ativa as colunas correspondentes à duração a partir da coluna correta
    const startCol = parseInt(note.startCol, 10);

    for (let colOffset = 0; colOffset < note.duration; colOffset++) {
      const noteDiv = document.querySelector(
        `.note[data-note="${note.note}"][data-col="${startCol + colOffset}"]`
      );
      if (noteDiv) {
        noteDiv.classList.add("active");
      }
    }
  });

}

async function importMelody() {
  const newMelody = await getParsedJsonFile();

  const melodyName = newMelody.name;

  if (verifyMelodyExists(melodyName)) {
    const melodies = retrieveMelodies();

    const filteredMelodies = melodies.filter(
      (melody) => melody.name !== melodyName
    );

    localStorage.setItem("bipes@melodies", JSON.stringify(filteredMelodies));
  }

  const bpm = newMelody.bpm || 120

  addMelodyToLocalStorage({
    name: melodyName,
    notes: newMelody.notes,
    bpm
  });

  // atualiza o bpm
  document.getElementById("bpm").value = bpm;

  // Exibe a melodia importada no piano
  displayImportedMelody(newMelody.notes);

  closeImportSoundModal();
  alert("Melodia importada com sucesso!");
  document.getElementById("fileSound").value = "";
}

function getParsedJsonFile() {
  return new Promise((resolve, reject) => {
    const fileInput = document.getElementById("fileSound");
    const file = fileInput.files[0];

    // verifica se um arquivo foi selecionado e se é um JSON
    if (file && file.type === "application/json") {
      const reader = new FileReader();

      reader.onload = function (e) {
        try {
          const jsonContent = JSON.parse(e.target.result);
          resolve(jsonContent);
        } catch (error) {
          alert("Erro ao importar arquivo");
          reject(error);
        }
      };

      reader.readAsText(file);
    } else {
      alert("Selecione um arquivo JSON válido");
      reject(new Error("Arquivo inválido"));
    }
  });
}
