document.addEventListener("DOMContentLoaded", () => {
  
  const deviceSelector = document.getElementById("device_selector");

  const savedValue = localStorage.getItem("bipes@selectedDevice");
  if (savedValue) {
    deviceSelector.value = savedValue;
  }

  const verifyAmadoBoardIsSelected = () => {
    const valueDeviceSelector = deviceSelector.value;

    // Salva o valor no localStorage
    localStorage.setItem("bipes@selectedDevice", valueDeviceSelector);

    const tabSound = document.getElementById("tab_sound");
    const contentSound = document.getElementById("containerSound");

    const tabShared = document.getElementById("tab_programs");
    const tabDataboard = document.getElementById("tab_databoard");

    if (valueDeviceSelector === "AmadoBoard") {
      tabSound.style.display = "block";
      contentSound.style.display = "block";

      tabShared.style.display = "none";
      tabDataboard.style.display = "none";
    } else {
      tabSound.style.display = "none";
      contentSound.style.display = "none";

      tabShared.style.display = "block";
      tabDataboard.style.display = "block";
    }
  };

  verifyAmadoBoardIsSelected();

  deviceSelector.addEventListener("change", verifyAmadoBoardIsSelected);
});
