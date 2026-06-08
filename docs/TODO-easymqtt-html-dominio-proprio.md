# TODO: corrigir `easymqtt/easymqtt.html` (link de dashboard no domínio próprio)

**Status:** pendente — adiado para depois
**Data do registro:** 2026-06-03
**Branch atual quando identificado:** `269-feat-visao-landmarks-como-variavel`

## Objetivo

Ter um link de compartilhamento do dashboard EasyMQTT **no nosso próprio domínio**, no padrão:

```
https://staging.dblocks.com.br/easymqtt/easymqtt.html?session=<SESSION_ID>
https://dblocks.com.br/easymqtt/easymqtt.html?session=<SESSION_ID>   (produção)
```

A página `easymqtt/easymqtt.html` já existe e é um "embrulho" (wrapper) que embute o dashboard
do `bipes-api` num `<iframe>` — mesma técnica usada na aba MQTT do app (`ui/index.html`).

## O problema

O wrapper ficou pela metade. Em `easymqtt/easymqtt.html` (linha ~40) o iframe aponta para
desenvolvimento local:

```js
iframe.src = `http://localhost:3000/?session=${session}`;
```

Como `localhost:3000` é resolvido na máquina de **quem abre o link**, o dashboard não carrega
para ninguém além de um ambiente de dev local. Por isso
`https://staging.dblocks.com.br/easymqtt/easymqtt.html?session=...` não mostra dados.

> Obs.: a outra página, `easymqtt/index.html`, é a versão **antiga em PHP** (`getsession.php` etc.)
> e está quebrada neste deploy — o `Dockerfile` da raiz instala só `apache2 openssl`, sem PHP,
> então os `.php` voltam como fonte crua e dão `parsererror: Unexpected token '<'`. Não usar.

## A correção proposta

Trocar o `localhost:3000` pela URL do `bipes-api` com detecção de ambiente, igual ao que
`ui/index.html` (`abrirEasyMQTT`, ~linha 382-394) já faz:

```js
function abrirEasyMQTT() {
  const params = new URLSearchParams(window.location.search);
  const session = params.get("session");
  const iframe = document.getElementById('easymqtt_iframe');

  const host = window.location.hostname;
  const apiUrl = host.includes('staging') || host.includes('localhost') || host.includes('127.0.0.1')
    ? 'https://bipes-api-staging-tgtka7akja-uc.a.run.app'
    : 'https://bipes-api-tgtka7akja-uc.a.run.app';

  iframe.src = session ? `${apiUrl}/?session=${session}` : `${apiUrl}/`;
}
```

Depois disso, o link no domínio próprio funciona em staging e produção automaticamente.

## Por que NÃO foi resolvido agora

A branch ativa (`269-feat-visao-landmarks-como-variavel`) é da feature de **Visão/landmarks**.
Aplicar essa correção de EasyMQTT aqui misturaria assuntos não relacionados no mesmo PR,
dificultando a revisão e o merge. O correto é fazer numa branch dedicada a partir da `master`
(ex.: `fix/easymqtt-html-aponta-bipes-api`).

## Como prosseguir (quando voltar)

1. `git checkout master && git pull`
2. `git checkout -b fix/easymqtt-html-aponta-bipes-api`
3. Aplicar a correção acima em `easymqtt/easymqtt.html`.
4. Testar: `https://staging.dblocks.com.br/easymqtt/easymqtt.html?session=luzSala` deve mostrar os dados.
5. PR para a `staging` → validar → produção.

## Alternativa / workaround válido hoje

Enquanto isso, o link de compartilhamento que **já funciona** é o do `bipes-api` direto:

```
https://bipes-api-staging-tgtka7akja-uc.a.run.app/?session=<SESSION_ID>
```
