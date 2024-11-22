var Code = {};

// Idioma padrão
Code.LANG = "pt-br";

Code.LANGUAGE_NAME = {
  en: "EN",
  "pt-br": "PT",
  es: "ES",
};

Code.FLAGS = {
  en: "media/usa.svg",
  "pt-br": "media/brazil.svg",
  es: "media/spanish.svg",
};

// Função para carregar um script dinamicamente
function loadScript(src, callback) {
  var script = document.createElement("script");
  script.src = src;
  script.onload = callback || function () {};
  document.head.appendChild(script);
}

// Função para trocar o idioma e recarregar os blocos
Code.changeLanguage = function () {
  var languageMenu = document.getElementById("languageMenu");
  var newLang = languageMenu.options[languageMenu.selectedIndex].value;

  // Atualiza a bandeira
  var flagElement = document.getElementById("languageFlag");
  if (flagElement) {
    flagElement.src = Code.FLAGS[newLang] || "media/brazil.svg";
    flagElement.alt = Code.LANGUAGE_NAME[newLang] || "Language";
  }

  // Atualiza o idioma na URL
  var search = window.location.search;
  if (search.length <= 1) {
    search = "?lang=" + newLang;
  } else if (search.match(/[?&]lang=[^&]*/)) {
    search = search.replace(/([?&]lang=)[^&]*/, "$1" + newLang);
  } else {
    search = search.replace(/\?/, "?lang=" + newLang + "&");
  }

  // Recarrega a página com o novo idioma
  window.location =
    window.location.protocol +
    "//" +
    window.location.host +
    window.location.pathname +
    search;
};

// Função para inicializar as traduções
Code.initLanguage = function () {
  // Obtém o idioma da URL ou usa o padrão
  var urlParams = new URLSearchParams(window.location.search);
  Code.LANG = urlParams.get("lang") || Code.LANG;

  // Atualiza a bandeira com base no idioma
  var flagElement = document.getElementById("languageFlag");
  if (flagElement) {
    flagElement.src = Code.FLAGS[Code.LANG] || "path/to/flags/default.png";
    flagElement.alt = Code.LANGUAGE_NAME[Code.LANG] || "Language";
  }

  // Carrega dinamicamente o arquivo de tradução
  loadScript("landing/lang/msg/" + Code.LANG + ".js", function () {
    // Define a direção do texto
    document.dir = "ltr";
    document.head.parentElement.setAttribute("lang", Code.LANG);

    // Preenche o menu de idiomas
    var languages = [];
    for (var lang in Code.LANGUAGE_NAME) {
      languages.push([Code.LANGUAGE_NAME[lang], lang]);
    }
    languages.sort(function (a, b) {
      return a[0].localeCompare(b[0]);
    });

    var languageMenu = document.getElementById("languageMenu");
    languageMenu.options.length = 0;
    languages.forEach(function (tuple) {
      var option = new Option(tuple[0], tuple[1]);
      if (tuple[1] === Code.LANG) {
        option.selected = true;
      }
      languageMenu.options.add(option);
    });

    languageMenu.addEventListener("change", Code.changeLanguage, true);

    document.getElementById("community").textContent = MSG["community"];
    document.getElementById("projects").textContent = MSG["projects"];
    document.getElementById("communityFooter").textContent = MSG["communityFooter"];
    document.getElementById("projectsFooter").textContent = MSG["projectsFooter"];
    document.getElementById("communitySidebar").textContent = MSG["communitySidebar"];
    document.getElementById("projectsSidebar").textContent = MSG["projectsSidebar"];
    document.getElementById("startCode").textContent = MSG["startCode"];
    document.getElementById("landingTitle").innerHTML = MSG["landingTitle"];
    document.getElementById("landingSubtitle").textContent =
      MSG["landingSubtitle"];
    document.getElementById("startNow").textContent = MSG["startNow"];
    document.getElementById("cardTitle1").textContent = MSG["cardTitle1"];
    document.getElementById("cardDescription1").textContent =
      MSG["cardDescription1"];
    document.getElementById("cardTitle2").textContent = MSG["cardTitle2"];
    document.getElementById("cardDescription2").textContent =
      MSG["cardDescription2"];
    document.getElementById("cardTitle3").textContent = MSG["cardTitle3"];
    document.getElementById("cardDescription3").textContent =
      MSG["cardDescription3"];
    document.getElementById("footerMessage").textContent = MSG["footerMessage"];
  });
};

// Inicializar as traduções ao carregar a página
document.addEventListener("DOMContentLoaded", function () {
  Code.initLanguage();
});
