# Aprovação semanal · MVB Planejados

O cliente revisa as publicações na grade ou no feed. A aprovação e os pedidos de ajuste abrem uma mensagem pronta no WhatsApp. O cliente toca em **Enviar** para concluir.

## Rodada nova

1. Crie uma pasta ignorada pelo Git, como `.rounds/2026-11-23/`. Copie [o exemplo](exemplos/rodada.json) para `rodada.json` e coloque logo, imagens e capas na subpasta `midia/`.
2. Dê um novo `id` à rodada. Informe a identificação da semana, o número de WhatsApp, as datas e as legendas. Preencha `number` com o número que aparece no painel e `position` com a posição na grade e no feed. Use sequências únicas. Escreva parágrafos com `\n\n`.
3. Para cada Reel do Drive, compartilhe **o arquivo** com **Qualquer pessoa com o link → Leitor**. Use o link do arquivo no campo `media[0].drive` e confirme que ele toca numa janela anônima. O aplicativo converte o link para `/preview` e mostra **Abrir no Drive** como alternativa. Se uma página de login aparecer, revise a permissão do arquivo. Se o Drive informar processamento pendente, espere concluir antes de publicar.
4. Para um MP4 direto, coloque um MP4 com H.264/AAC em `midia/` e use `media[0].file`. Há suporte a intervalos de bytes. Cada arquivo empacotado no Worker pode ter até 25 MiB. Para um vídeo maior, use o Drive.
5. Rode `npm run rodada:publicar -- .rounds/2026-11-23` para validar a configuração e preparar o pacote. Teste com `npm run dev` antes de publicar. Use `status: "demo"` para dados de teste e `status: "review"` para uma rodada com datas e legendas definitivas.
6. Com a sessão da Cloudflare autorizada na conta correta, rode `npm run rodada:publicar -- .rounds/2026-11-23 --deploy`. Abra o mesmo link do cliente e confira as mídias e as mensagens. Só depois disso retire o compartilhamento de vídeos anteriores no Drive se precisar revogar aqueles links.

O código fica no GitHub. O Worker interno `mvb-aprovacao-arquivos` recebe a configuração e os arquivos da rodada como assets e fica sem URL pública. O Worker `mvb-aprovacao` entrega esses arquivos via uma **service binding**, valida o link e libera somente as referências do arquivo de configuração ativo. A troca do pacote interno não altera o link do painel. O R2 exigia ativação na conta, então a configuração e as imagens usam o armazenamento de assets do Worker interno. Os vídeos compartilhados pelo Drive continuam acessíveis a quem já tiver o link específico do arquivo.

## Desenvolvimento e implantação

Use Node 22 ou mais recente e `npm ci`. Execute `npm run check` para rodar os testes do Worker. Para teste local use um token aleatório de 64 caracteres hexadecimais como `PANEL_TOKEN` em `.dev.vars`. Acesse `http://localhost:8787/#TOKEN` depois de preparar o pacote da rodada.

Para provisionar a produção na conta correta:

1. Faça o primeiro deploy do Worker interno usando o comando da rodada com `--deploy`.
2. Execute `npm run deploy` para o Worker web. Grave `PANEL_TOKEN` como secret do Worker pelo Cloudflare Dashboard ou com `npx wrangler secret put PANEL_TOKEN`. Pode ser gerado com `openssl rand -hex 32`. O endereço para o cliente é `https://HOST/#TOKEN`. Guarde o token fora do Git. Ele identifica o link e é trocado por um cookie HttpOnly. Para revogar o acesso, altere o secret e distribua o novo link.
3. Em **Workers & Pages → mvb-aprovacao → Settings → Builds → Connect**, autorize o GitHub App da Cloudflare para `gabygolom-dev/MVB` e selecione a branch `main`, a raiz `/` e o comando `npm run deploy`. Use `npm run check` como comando de build e desative os builds de preview se não precisar deles. O Worker interno é publicado pelo comando da rodada, independentemente da atualização do código pelo Git.
4. Em **Settings → Domains & Routes → Add → Custom Domain**, escolha um hostname de uma zona ativa na mesma conta Cloudflare. O painel também funciona no endereço `workers.dev`. Use sempre o mesmo hostname nos links entregues ao cliente.
