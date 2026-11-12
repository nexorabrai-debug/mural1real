# Mural do 1 Real

Site estático, mobile-first, em pt-BR. 100×100 = 10.000 blocos a R$1. Sem passo de build: abra `index.html` por um servidor HTTP (não use `file://`, senão o `sold.json` não carrega).

## Arquivos

- `index.html` — página única
- `css/style.css` — visual
- `js/config.js` — `PIX_KEY`, `KIWIFY_URL`, e-mail do FormSubmit, tamanho da grade, área do Trono
- `js/app.js` — mural, seleção, checkout, ranking, ticker
- `data/sold.json` — blocos já publicados (editar na mão depois de confirmar o Pix)
- `assets/og.png` — imagem de compartilhamento (1200×630)
- `assets/favicon.svg`, `assets/favicon-32.png`, `assets/apple-touch-icon.png`
- `screenshots/` — provas de celular e desktop

## Pedidos: como chegam no Renato

No checkout a pessoa escolhe os blocos, preenche nome/frase/cor/link/e-mail e vai pra etapa **Pague via Pix**. Ao tocar em **Enviar pedido**:

1. O pedido (blocos, nome, frase, cor, e-mail, total e um código tipo `MURAL-20261111-ABC123`) é enviado por POST para `https://formsubmit.co/ajax/nexora.br.ai@gmail.com`.
2. O mesmo texto é copiado pra área de transferência, e o código aparece na tela. Se o FormSubmit falhar, a pessoa pode mandar o código (e o comprovante) manualmente pra `nexora.br.ai@gmail.com`.

**Primeiro uso do FormSubmit:** a caixa `nexora.br.ai@gmail.com` recebe um e-mail de confirmação. Sem clicar nesse link, os pedidos seguintes não chegam. Isso é feito uma vez só.

Nada entra no mural sozinho. Depois que o Pix (ou a Kiwify) for confirmado, acrescente a compra em `data/sold.json` e publique de novo.

## Ainda é placeholder

Em `js/config.js`:

- `PIX_KEY`: `"COLE_SUA_CHAVE_PIX_AQUI"`
- `KIWIFY_URL`: `"https://pay.kiwify.com.br/COLE_SEU_LINK_AQUI"`

Troque antes de divulgar. Não coloque chave Pix em repositório público se puder evitar.

## Como atualizar o mural

Os 8 lotes iniciais têm `"example": true` e `id` no formato `EXEMPLO-1` … `EXEMPLO-8`. Apague todos antes de ir ao ar de verdade.

Formato de uma venda real:

```json
{
  "id": "MURAL-20261111-ABC123",
  "example": false,
  "blocks": [[10, 12], [11, 12]],
  "name": "Apelido",
  "phrase": "frase curta",
  "color": "#E24B4B",
  "link": "",
  "email": "pessoa@email.com"
}
```

Não sobreponha blocos já vendidos nem a área do Trono (45,45 a 54,54).

## Meta de compartilhamento

Os `og:image` estão relativos (`assets/og.png`). Depois do domínio existir, troque nos meta tags de `index.html` para a URL absoluta, por exemplo `https://SEU-DOMINIO/assets/og.png`. Sem isso, WhatsApp/X/TikTok podem não mostrar a imagem.

## Hospedagem gratuita (sem criar conta agora, sem gastar)

Recomendação pra este caso (publicar daqui, pelo Linux, com cadastro só de e-mail): **Surge.sh**.

É o fluxo mais simples: CLI, e-mail + senha no próprio terminal, sem GitHub e sem cartão. Plano Free: projetos ilimitados, HTTPS, domínio `*.surge.sh` e domínio próprio de graça. Conta nova serve o site por 90 minutos; depois precisa verificar o e-mail (`surge verify`), senão o endereço para até a confirmação.

Se o mural viralizar, o plano B é **Cloudflare Pages**: banda de arquivo estático sem medição no plano free, melhor pra pico de visita. A conta é de e-mail na Cloudflare; o setup é um pouco maior.

Não use o plano Hobby da Vercel como primeira opção: ele é descrito como uso pessoal não comercial, e este site cobra R$1.

### Surge.sh — passos exatos

Conta: um e-mail e uma senha (criadas no primeiro `surge publish`). Sem cartão, sem GitHub.

```bash
npm install --global surge
cd /workspace/pixel1real
surge publish
```

Na primeira vez o CLI pede e-mail e senha (isso cria a conta). Depois pede a pasta (Enter) e o domínio. Aceite o sugerido ou escolha algo como `mural1real.surge.sh`.

```bash
surge verify
```

Abra o link enviado ao e-mail. Republicar:

```bash
cd /workspace/pixel1real
surge publish
```

### Alternativas (o que cada uma exige)

| Serviço | Conta | CLI | Observação |
|---|---|---|---|
| **Surge.sh** (recomendado pra lançar) | E-mail + senha no terminal | `surge publish` | Verificar e-mail em até 90 min |
| **Cloudflare Pages** (melhor se viralizar) | Conta Cloudflare (e-mail) | `npx wrangler pages deploy /workspace/pixel1real --project-name mural-do-1-real` | Login do wrangler abre o navegador. Banda estática unmetered no free. |
| **Netlify** | Conta Netlify (e-mail, GitHub ou Google) | `npm i -g netlify-cli` e `netlify login` (abre o navegador), depois `netlify deploy --dir=/workspace/pixel1real --prod` | Sem login, o Netlify Drop deixa o site com senha. Plano free tem cota de créditos; quando acaba, o site pausa. |
| **Vercel** | Conta Vercel (e-mail; `vercel signup` abre o navegador) | `npx vercel --cwd /workspace/pixel1real` | Hobby é uso pessoal não comercial. Evitar aqui. |
| **GitHub Pages** | Conta GitHub + repositório (público no plano grátis) | `git` + Actions, ou upload no site | Documentação do GitHub desaconselha uso como loja / e-commerce. |

Nenhuma dessas opções foi cadastrada daqui. Nada foi publicado e nada foi gasto.

## Teste local

```bash
cd /workspace/pixel1real
python3 -m http.server 8765
```

Abra `http://127.0.0.1:8765`.
