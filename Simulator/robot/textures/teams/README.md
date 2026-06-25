# Escudos dos times (modo Futebol)

Coloque aqui os PNGs dos escudos. O nome do arquivo precisa bater com o `escudo`
definido em `TEAMS` no `Simulator/robot/index.html`.

Times atuais e arquivos esperados:

| Time        | Arquivo            |
|-------------|--------------------|
| Palmeiras   | `palmeiras.png`    |
| Flamengo    | `flamengo.png`     |
| Corinthians | `corinthians.png`  |
| São Paulo   | `sao-paulo.png`    |
| Cruzeiro    | `cruzeiro.png`     |

Dicas:
- Use **PNG com fundo transparente** (a textura vai na face de cima de uma
  plaquinha sobre o robô). Imagem **quadrada** fica melhor.
- Os `.png` atuais foram gerados a partir de `.jpg` com fundo xadrez removido por
  flood-fill (script com PIL). Se um escudo novo vier em JPG com fundo, dá pra
  repetir o processo.
- Sugestão de tamanho: 256×256 ou 512×512.

Para adicionar um time novo: crie uma entrada em `TEAMS` (no `index.html`) com a
cor e o caminho do escudo, e solte o PNG aqui com o nome correspondente.
