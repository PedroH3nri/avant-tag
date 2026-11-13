# Teste do rebid em página real (avant-tag#18)

Confere, com o GPT de verdade, se o `refresh()` do MESMO slot vazio faz um novo pedido ao GAM
em cada formato da Cascata (âncora, fixo, conteúdo, intersticial e reward), com `groone_try`
de 1 a 4 e a 4ª sem `groone_prices`.

```bash
cd scripts/teste-rebid
npm install && npx playwright install chromium
npm run teste > resultado.json
```

A pasta tem o próprio `package.json` (fora do pnpm da tag), e o `resultado.json` fica fora do git.
O formato `content-lazy` liga o carregamento sob demanda e só rola até o bloco depois de 4 s, para
conferir que o teto conta do 1º pedido.

O ad unit padrão não existe na rede de exemplo do Google (`/6355419`) e sempre volta vazio. Para
testar no site de um cliente, abra `index.html?formato=...&caminho=/rede/ad_unit` numa página do
domínio dele. Passou quando cada formato mostra 4 `slotRequested`, 4 `slotRenderEnded` e 4
pedidos ao GAM com `groone_try=1..4` no targeting do slot (`prev_scp`), a 4ª sem `groone_prices`.
