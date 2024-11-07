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
  document.getElementById("saveSoundModal").style.display = "block";
}

function closeSoundModal() {
  document.getElementById("saveSoundModal").style.display = "none";
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
    noteDiv.dataset.note = note.name;
    noteDiv.dataset.frequency = note.frequency;
    noteDiv.dataset.row = rowIndex;
    noteDiv.dataset.col = colIndex;

    // alterna a ativação da nota ao clicar
    noteDiv.addEventListener("click", () => {
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
            frequency: noteDiv.dataset.frequency,
            duration: 1,
          };
          duration = 1;
        }
        hasActiveNote = true;
      }
    }

    // adiciona a última nota ao array
    if (currentNote) {
      currentNote.duration = duration;
      activeNotes.push(currentNote);
      currentNote = null;
      duration = 0;
    }
  }
}

function verifyMelodyExists(name){
    // verifica se uma melodia existe pelo nome
    const melodies = retrieveMelodies();

    const melodiesExists = melodies.filter(melody => melody.name === name)[0];

    if(melodiesExists){
      return true;
    }

    return false;
}

function retrieveMelodies(){
  // retorna as melodias do localstorage
  const melodiesString = localStorage.getItem('bipes@melodies');
  
  if(melodiesString){
    return JSON.parse(melodiesString);
  }

  return [];
}

function clearSoundInput(){
  document.getElementById('soundName').value = ''
}

// salva a melodia no localStorage
function saveMelody() {
  const melodyName = document.getElementById("soundName").value;

  if (!melodyName) {
    alert("Dê um nome para a nova melodia");
    return;
  }

  if(verifyMelodyExists(melodyName)){
    alert(`Melodia com nome ${melodyName} já criada!`);
    return;
  }

  buildActiveNotes();

  if (activeNotes.length > 0) {
    const prevMelodies = localStorage.getItem("bipes@melodies");
    let updatedMelodies = prevMelodies ? JSON.parse(prevMelodies) : [];

    // cria um novo objeto de melodia e adiciona ao array
    const newMelody = { name: melodyName, notes: activeNotes };
    updatedMelodies.push(newMelody);

    localStorage.setItem("bipes@melodies", JSON.stringify(updatedMelodies));
    closeSoundModal();
    clearSoundInput();
    alert("Melodia salva com sucesso!");
  } else {
    alert("Nenhuma melodia para salvar");
  }
}

// toca a melodia ativa com base no BPM
function playMelody() {
  if (audioContext) {
    audioContext.close();
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
        playTone(note.frequency, note.duration * beatDuration);
      }
    }, currentTime);
    currentTime += note.duration * beatDuration;
  });
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
