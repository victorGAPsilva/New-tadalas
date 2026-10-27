# Preparação do lançamento

Decisões confirmadas em 27/10/2026: lançar com cardápio vazio; usar ViaCEP para auxiliar o preenchimento do endereço; domínio e hospedagem ainda não escolhidos; SMTP permanece preparado, mas desabilitado até configurar um provedor.

## Catálogo inicial

O catálogo inicial versionado em `src/data/products.json` já é vazio. Os seis produtos de teste da base local foram removidos após um backup consistente em `var/backups/antes-lancamento-sem-produtos-*.sqlite`. O administrador, clientes e pedidos não foram removidos. Os JSON legados são históricos e não devem ser copiados para uma instalação nova para montar o catálogo.

No lançamento, o site mostra cardápio em preparação e mantém o contato pelo WhatsApp. Não há produto comprável. O carrossel sem produtos usa as imagens ilustrativas identificadas, sem preço ou oferta. Novos produtos podem ser cadastrados depois pelo administrador.

## Endereço e ViaCEP

Checkout e endereços da conta permitem digitar um CEP de oito dígitos, com ou sem hífen. A busca automática ocorre após uma pausa na digitação; o botão Buscar CEP permite consultar novamente. Rua, bairro e cidade são preenchidos, mas continuam editáveis. Número e complemento são informados pelo cliente. CEP genérico pode não trazer rua/bairro; o usuário completa esses campos. Falha no serviço ou CEP não encontrado não impede preencher manualmente.

A consulta passa pelo backend na mesma origem, que chama apenas o endereço fixo HTTPS do ViaCEP, com timeout de cinco segundos, cache limitado, compartilhamento de consultas simultâneas e limite por IP. Não há chave de API. Apenas o CEP é enviado ao ViaCEP, sem nome, número da residência ou dados de conta. Respostas atrasadas não substituem um endereço que o usuário mudou ou selecionou de seus endereços salvos.

O ViaCEP não define taxa ou área de entrega, não confirma a existência do imóvel nem localiza a hamburgueria. As regiões/taxas continuam no painel. O bairro retornado seleciona automaticamente uma região apenas se houver uma correspondência única com o nome cadastrado (desconsiderando acentos e caixa). Trocar a região não altera o bairro. Cidade e área efetivamente atendidas precisam ser conferidas pela operação; o modelo atual de regiões usa nomes de bairros, sem geolocalização.

Fonte: [documentação oficial ViaCEP](https://viacep.com.br/).

## Hospedagem e armazenamento

Sim: banco e imagens podem ficar na hospedagem, em disco persistente. O projeto usa uma instância Node.js 24 e SQLite. Uma opção avaliada é um Web Service pago do Render com disco persistente. Essa opção é uma recomendação, ainda sem serviço criado ou contratação. O serviço gratuito do Render não preserva SQLite/uploads em reinícios e não aceita discos persistentes, portanto não serve para os dados desta versão.

Depois de escolher a hospedagem:

1. Conectar o repositório `victorGAPsilva/New-tadalas`, escolhendo a branch revisada para publicar.
2. Usar Node.js 24, instalar com `npm ci` e iniciar com `npm start`.
3. Montar um volume persistente e configurar ambos os diretórios abaixo dentro desse volume.
4. Configurar HTTPS e a origem real em `PUBLIC_URL`. Um endereço provisório HTTPS da hospedagem pode ser usado para a prévia sem domínio próprio.
5. Definir `TRUST_PROXY_HOPS` somente após confirmar os proxies da hospedagem; o valor precisa refletir os saltos confiáveis reais para autenticação e limites por IP.

```dotenv
NODE_ENV=production
HOST=0.0.0.0
DEMO_MODE=false
PUBLIC_URL=https://endereco-real-do-servico
DATA_DIRECTORY=/var/data/tadalas/database
UPLOAD_DIRECTORY=/var/data/tadalas/uploads
```

O exemplo assume um volume montado em `/var/data`; adapte ao provedor. A porta é a fornecida pela hospedagem. Não armazene o SQLite no diretório efêmero do código. `DATA_DIRECTORY` também é usado pelos comandos de criação de administrador e backup; `UPLOAD_DIRECTORY` mantém o endereço público das fotos em `/assets/uploads/`, mesmo que os arquivos físicos estejam fora da pasta `public`.

Uma instalação nova começa sem administrador e sem produtos. Execute `npm run admin:create` no terminal privado do serviço para criar o acesso. Se optar por transferir dados locais, use um backup SQLite consistente e os uploads correspondentes por um canal privado, após revisar quais contas/pedidos devem ir para produção. Nunca envie banco, backup, `.env` ou credenciais para o repositório público.

Agende `npm run db:backup` no ambiente que tem o volume montado e mantenha uma cópia protegida fora da hospedagem, além dos uploads. O backup manual disponível não é um agendamento automático. Teste a restauração antes da operação comercial.

Fontes: [discos persistentes do Render](https://render.com/docs/disks), [limites do plano gratuito](https://render.com/docs/free).

## E-mails: configuração sugerida com Resend

O projeto já suporta SMTP. Sem domínio próprio, a etapa de remetente definitivo fica pendente; a prévia e o cardápio podem funcionar com o envio de e-mails desabilitado.

1. Registrar um domínio de sua escolha.
2. Criar uma conta no Resend e adicionar esse domínio ou um subdomínio para envio.
3. Adicionar no DNS do domínio os registros indicados pelo provedor e aguardar a verificação.
4. Criar uma chave de envio e cadastrá-la nas variáveis privadas do servidor como `SMTP_PASS`.
5. Definir as demais variáveis abaixo, usando o domínio efetivamente verificado e a origem real do site, e reiniciar o serviço.
6. Testar confirmação de e-mail e recuperação numa conta sua, incluindo recebimento, expiração e troca da senha. Configuração presente não garante entrega; essa conferência é necessária.

```dotenv
SMTP_HOST=smtp.resend.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=resend
SMTP_PASS=CHAVE_DE_ENVIO_DO_PROVEDOR
SMTP_FROM=Tadalas Burguer <atendimento@SEU_DOMINIO_VERIFICADO>
PUBLIC_URL=https://ORIGEM_REAL_DO_SITE
```

Este bloco é somente um modelo, não foi aplicado e não contém credenciais. A integração usa STARTTLS na porta 587. A hospedagem escolhida precisa permitir essa saída de rede; o Render gratuito bloqueia as portas SMTP usuais. Não foi criado remetente nem enviada mensagem real.

Fontes: [SMTP Resend](https://resend.com/docs/send-with-smtp), [verificação de domínio](https://resend.com/docs/dashboard/domains/introduction).

## Roteiro de aceite

| Etapa          | Conferência                                                                                                     | Situação                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| Código         | Testes, lint e formatação                                                                                       | Automatizado; ver resultados em `verification.md`                          |
| Catálogo vazio | Início e cardápio sem preços/produtos de teste; contato e estado vazio funcionam                                | Backend coberto; revisão visual pendente                                   |
| Responsividade | Celular 320/390 px, tablet 768 px e computador 1440 px; sem corte horizontal                                    | Pendente em navegador                                                      |
| Acessibilidade | Navegação por teclado, foco dos diálogos, Escape, leitura dos campos e movimento reduzido                       | Parte automatizada; interação real pendente                                |
| ViaCEP         | Válido, inválido, inexistente, serviço indisponível, endereço incompleto, endereço alterado durante a busca     | Casos automatizados; consulta real de exemplo aprovada; interface pendente |
| Autenticação   | Criar administrador no servidor; entrar/sair de cliente e admin por HTTPS; isolamento de contas                 | Backend automatizado; servidor real pendente                               |
| Funcionamento  | Abrir/fechar manualmente, ativar agenda, horário após meia-noite e bloquear novos pedidos ao fechar             | Backend automatizado; interface/servidor pendentes                         |
| Pedido         | Em ambiente de teste isolado: produto temporário, adicionais, retirada/entrega, taxa, troco e mensagem WhatsApp | Backend automatizado; teste no celular até abrir a mensagem pendente       |
| Persistência   | Reiniciar/reimplantar e conferir banco, fotos e administrador                                                   | Reinício entre processos e backup testados; provedor real pendente         |
| E-mail         | Receber confirmação/reset, verificar remetente e links HTTPS                                                    | Pendente de domínio e SMTP                                                 |
| Backup         | Recuperar snapshot em ambiente isolado                                                                          | Integridade de snapshot automatizada; restauração operacional pendente     |

Os testes de pedido devem usar uma base separada com produtos temporários; não publicar esses produtos no catálogo de lançamento. O teste de WhatsApp deve conferir a conversa e o texto sem enviar um pedido comercial por engano. Antes de aceitar pedidos reais, confirme endereço da loja, área de atendimento, taxas, horários, formas de pagamento e contato. A revisão visual permanece pendente pela recusa de acesso ao navegador registrada nesta sessão; nenhum método alternativo foi usado para contornar a restrição.
