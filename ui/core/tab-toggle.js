const verifyAmadoBoardIsSelected = () => {
  // verifica se a AmadoBoard está selecionada e esconde as abas não usadas
  const valueDeviceSelector = document.getElementById("device_selector").value;
  const tabSound = document.getElementById("tab_sound");
  const contentSound = document.getElementById("containerSound");

  const tabShared = document.getElementById("tab_programs");

  if (valueDeviceSelector === "AmadoBoard") {
    tabSound.style.display = "block";
    contentSound.style.display = "block";
    tabShared.style.display = "none";
  } else {
    tabSound.style.display = "none";
    contentSound.style.display = "none";
    tabShared.style.display = "block";
  }
};

verifyAmadoBoardIsSelected();
document
  .getElementById("device_selector")
  .addEventListener("change", verifyAmadoBoardIsSelected);
