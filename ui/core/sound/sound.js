const verifyAmadoBoardIsSelected = () => {
  // verifica se a AmadoBoard está selecionada e exibe o conteúdo de Som
  const valueDeviceSelector = document.getElementById("device_selector").value;
  const tabSound = document.getElementById("tab_sound");
  const contentSound = document.getElementById("containerSound");

  if (valueDeviceSelector === "AmadoBoard") {
    tabSound.style.display = "block";
    contentSound.style.display = "block";
  } else {
    tabSound.style.display = "none";
    contentSound.style.display = "none";
  }
};

verifyAmadoBoardIsSelected();
document
  .getElementById("device_selector")
  .addEventListener("change", verifyAmadoBoardIsSelected);

function openSoundModal() {
  buildActiveNotes();

  if (activeNotes.length === 0) {
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

  if (activeNotes.length === 0) {
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
    noteDiv.innerHTML = note.name
    noteDiv.dataset.note = note.name;
    noteDiv.dataset.frequency = note.frequency;
    noteDiv.dataset.row = rowIndex;
    noteDiv.dataset.col = colIndex;

    // alterna a ativação da nota ao clicar
    noteDiv.addEventListener("click", () => {
      if (!noteDiv.classList.contains("active")) {
        const bpm = document.getElementById("bpm").value;

        const beatDuration = 60000 / bpm;
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        playTone(note.frequency, beatDuration);

        audioContext = null;
      }
      noteDiv.classList.toggle("active");
    });

    pianoContainer.appendChild(noteDiv);
  }
});

// função para construir o array de notas ativas
function buildActiveNotes() {
    activeNotes = [];
    let currentNote = null;
    let duration = 0;
   
    // percorre cada coluna para verificar notas ativas
    for (let col = 0; col < pianoCols; col++) {
      let hasActiveNote = false;
    
      // verifica cada linha para encontrar notas ativas
      for (let row = 0; row < notes.length; row++) {
        const noteDiv = document.querySelector(
          `.note[data-row="${row}"][data-col="${col}"]`
        );
  
        if (noteDiv.classList.contains("active")) {
            // se for a mesma nota que a anterior, incrementa a duração
          if (currentNote && currentNote.note === noteDiv.dataset.note) {
            duration++;
          } else {
            // adiciona a nota atual ao array e inicia uma nova
            if (currentNote) {
              currentNote.duration = duration;
              activeNotes.push(currentNote);
            }
            currentNote = {
              note: noteDiv.dataset.note,
              frequency: parseFloat(noteDiv.dataset.frequency),
              duration: 1,
              startCol: col,
            };
            duration = 1;
          }
          hasActiveNote = true;
        }
      }
  
      // adiciona a última nota ao array ou uma nota de silêncio se nenhuma estiver ativa na coluna
      if (currentNote && hasActiveNote) {
        currentNote.duration = duration;
        activeNotes.push(currentNote);
        currentNote = null;
        duration = 0;
      } else if (!hasActiveNote) {
        activeNotes.push({
          note: null,
          frequency: null,
          duration: 1,
          startCol: col,
        });
      }
    }
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
function saveMelody() {
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
    const newMelody = { name: melodyName, notes: activeNotes };

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

// toca a melodia ativa com base no BPM
function playMelody() {
    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }
    audioContext = new (window.AudioContext || window.webkitAudioContext)();
  
    const bpm = document.getElementById("bpm").value;
    const beatDuration = 60000 / bpm;
  
    buildActiveNotes();
  
    let currentTime = 0;
    
    // agenda cada nota para tocar no momento certo
    activeNotes.forEach((note) => {
      setTimeout(() => {
        if (audioContext) {
          if (note.note) {
            playTone(note.frequency, note.duration * beatDuration);
          }
          // se note.note for null, nada é tocado
        }
      }, currentTime);
      currentTime += note.duration * beatDuration;
    });
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

// pausa a melodia
function pauseMelody() {
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
}

// toca uma nota com uma frequência e duração específicas
function playTone(frequency, duration) {
  if (!audioContext) return;

  const oscillator = audioContext.createOscillator();
  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, audioContext.currentTime);
  oscillator.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration / 1000);
}

// import e export

function exportMelody() {
  const inputExport = document.getElementById("soundNameExport");

  const melodyName = inputExport.value;

  if (!melodyName) {
    alert("Dê um nome para a nova melodia");
    return;
  }

  buildActiveNotes();

  if (activeNotes.length > 0) {
    const melodyData = {
      name: melodyName,
      notes: activeNotes,
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
    alert("Melodia '" + melodyName + "' exportada como sucesso!");
  }
}

function clearPiano() {
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
  const input = document.getElementById("soundNameImport");

  const melodyName = input.value;

  if (!melodyName) {
    alert("Dê um nome para a nova melodia");
    return;
  }

  const newMelody = await getParsedJsonFile();

  if (verifyMelodyExists(melodyName)) {
    const melodies = retrieveMelodies();

    const filteredMelodies = melodies.filter(
      (melody) => melody.name !== melodyName
    );

    localStorage.setItem("bipes@melodies", JSON.stringify(filteredMelodies));
  }

  addMelodyToLocalStorage({
    name: melodyName,
    notes: newMelody.notes,
  });

  // Exibe a melodia importada no piano
  displayImportedMelody(newMelody.notes);

  closeImportSoundModal();
  input.value = "";
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
          console.log(jsonContent);
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

document.getElementById("fileSound").addEventListener("change", async () => {
  const newMelody = await getParsedJsonFile();

  if (newMelody.name) {
    const inputSoundName = document.getElementById("soundNameImport");

    inputSoundName.value = newMelody.name;
  }
});

