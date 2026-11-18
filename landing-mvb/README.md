# Landing page MVB

Abra `dist/index.html` no navegador para ver a prévia local. O player TrackPlay utiliza conexão com a internet. Mantenha a pasta `dist/` inteira para que o HTML encontre as fontes, imagens, estilos e interações.

- A VSL usa o player TrackPlay em formato vertical (9:16), em `#vsl`, na primeira dobra.
- O formulário valida primeiro nome, WhatsApp e cidade, depois as três perguntas do projeto. Ao concluir, apresenta um botão para o WhatsApp +55 13 98803-0103 com as respostas na mensagem pronta. O visitante envia a mensagem pelo WhatsApp. A integração preparada em `google-sheets/Code.example.gs` grava as respostas na planilha antes de liberar o WhatsApp, com confirmação de recebimento, controle de duplicação e nova tentativa em caso de falha.
- A terceira dobra tem um carrossel com setas de navegação. As fotos e as fontes estão em `dist/assets/`.

A landing page está publicada em https://mvb-landing.pages.dev/ pelo projeto Cloudflare Pages `mvb-landing`, com raiz `landing-mvb`, saída `dist` e branch `codex/landing-mvb`.

## Integração Google Sheets

As colunas A:H da Página1 são data e hora (São Paulo), nome, WhatsApp, cidade, ambientes, prazo, orçamento e ID de envio (coluna oculta para deduplicação). O script somente recebe envios; não oferece consulta de leads.

A implantação é um App da Web do Google Apps Script, executando como proprietário e acessível a Qualquer pessoa (autorizado pelo usuário). O endereço `/exec` está em `LEADS_ENDPOINT` no arquivo `dist/app.js`. Não há credenciais no navegador.

O formulário envia por POST em um iframe e aguarda uma confirmação identificada por UUID. Só após a gravação confirmada, exibe o botão do WhatsApp. Em caso de falha, mantém os campos e permite tentar novamente com o mesmo ID. O script valida os campos, neutraliza fórmulas, usa um lock para envios simultâneos e evita duplicar o mesmo ID. Ao revisar e reenviar respostas idênticas já confirmadas, não grava outra linha.

O identificador da planilha deve ser configurado diretamente no projeto Google Apps Script. A cópia local configurada `google-sheets/Code.gs` fica fora do Git. Para atualizar o serviço, configure o identificador em `google-sheets/Code.example.gs`, copie o conteúdo para o editor, salve e publique uma nova versão em Gerenciar implantações, preservando a mesma implantação e URL. O código do Google Apps Script não é implantado automaticamente pelo Cloudflare.

Validação: envio real pelo formulário, confirmação da linha na planilha, botão do WhatsApp com as seis respostas e reenvio idêntico sem linha extra. A linha com nome TESTE DE INTEGRAÇÃO MVB é um registro sintético da verificação.

Ao mover a hospedagem, a mesma URL do Google Apps Script pode continuar sendo usada; ela é independente da conta Cloudflare. A planilha e a implantação do Google precisam permanecer disponíveis. A revisão de acesso à planilha é separada do acesso público ao serviço de recebimento.
