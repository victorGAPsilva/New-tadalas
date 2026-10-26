# TADALAS BURGUER

Site da hamburgueria com cardápio, carrinho, pedidos via WhatsApp, contas de clientes e administração. Node.js, Express, SQLite e módulos JavaScript nativos, sem etapa de build.

## Executar

Requer Node.js 24 e npm. Nesta versão do Node, `node:sqlite` pode emitir um aviso de API experimental; o banco usa o módulo nativo, sem servidor externo.

```sh
npm install
npm run dev
```

Abra http://127.0.0.1:3000. `npm start` executa sem observador. Copie `.env.example` para `.env` para configurar o ambiente. Se a porta estiver ocupada, altere `PORT` e ajuste `PUBLIC_URL` para a mesma origem.

Páginas: `/`, `/cardapio/`, `/login/`, `/conta/`, `/admin/login/`, `/admin/`, `/recuperar/` e `/verificar-email/`. Clientes podem pedir sem cadastro; somente pedidos feitos com a sessão de cliente ativa entram no histórico daquela conta.

```sh
npm test
npm run lint
npm run format:check
```

## Administração

O acesso administrativo existente é preservado. Não há senha padrão nem cadastro público de administradores. Para criar o primeiro acesso ou redefini-lo localmente:

```sh
npm run admin:create
npm run admin:reset
```

Os comandos pedem usuário e senha oculta de 12–128 caracteres. A redefinição revoga as sessões administrativas anteriores. Não remova os arquivos legados para redefinir uma conta: o SQLite é a fonte atual.

O painel tem quatro áreas:

- **Produtos:** criação, edição, exclusão com confirmação, busca, categoria, fotos, ingredientes, disponibilidade e destaque. Grupos de opções permitem adicionais pagos, escolhas obrigatórias de combo e limites mínimo/máximo. O cliente também pode retirar ingredientes. Não há controle de estoque ou baixa de unidades.
- **Pedidos:** listagem e mudança de situação: aguardando confirmação → aceito → em preparo → saiu para entrega ou pronto para retirada → concluído. Cancelamento é permitido antes de concluir. O fluxo respeita o tipo de atendimento e rejeita alterações com versão antiga.
- **Configurações:** marca, logo, WhatsApp, Instagram, endereço, prazo estimado, meios de pagamento, entrega/retirada, bairros/taxas, horário semanal e abertura/pausa manual. O painel informa se o envio de e-mail foi configurado.
- **Categorias:** criação, renomeação e exclusão de categorias vazias.

Valores monetários são armazenados em centavos inteiros. Atualizações de produtos, configurações e status usam versão para evitar sobrescritas concorrentes. Fotos PNG/JPEG/WebP de até 3 MB têm assinatura validada e nome aleatório; SVG não é aceito. Fotos antigas permanecem em disco, portanto só faça limpeza após backup e conferência das referências.

A configuração inicial mantém atendimento manual aberto e retirada habilitada para preservar o comportamento anterior. Entrega começa desabilitada, sem taxas ou horários comerciais inventados. Antes de usar comercialmente, confirme endereço, número de WhatsApp, preços, horários, prazo e formas de pagamento no painel. `WHATSAPP_NUMBER`, se definido no ambiente, tem prioridade sobre o número salvo no painel.

## Pedido e WhatsApp

Em `/cardapio/`, o cliente busca produtos, escolhe opções e ingredientes, ajusta quantidades e abre o carrinho. Variações diferentes do mesmo produto ficam em linhas separadas. O carrinho guarda IDs, escolhas e quantidades por 24 horas; preços e disponibilidade vêm novamente do catálogo. Observações e endereço digitado no checkout não ficam no carrinho local.

No checkout, o cliente informa nome, entrega ou retirada, pagamento e troco quando necessário. A entrega exige endereço e um bairro cadastrado nas regiões atendidas. O nome do bairro informado deve corresponder ao da região escolhida; essa regra não faz geolocalização nem verifica a existência física do endereço. O servidor calcula adicionais, taxa e total e bloqueia novos pedidos quando a loja está fechada ou pausada. Horários usam o fuso da loja e aceitam intervalos que atravessam a meia-noite.

Ao continuar, o servidor revalida o catálogo e o total, registra um pedido numerado e retorna o link do WhatsApp com itens, escolhas, endereço, taxa, total e pagamento. A chave de idempotência evita duplicar o mesmo envio em uma repetição de requisição. Mudança de preço exige revisão antes de concluir.

O registro começa **aguardando confirmação**. O cliente ainda precisa enviar a mensagem no WhatsApp e a equipe aceitar o pedido; abrir o WhatsApp não confirma venda. O site não envia mensagens automaticamente, não lê conversas e não processa pagamentos. O painel registra a situação operacional informada pela equipe.

## Contas de clientes

Cadastro/login usam nome, e-mail e senha de 12–128 caracteres, com scrypt e salt individual. A conta mostra pedidos próprios, situações, endereços salvos e confirmação de e-mail. Repetir pedido consulta preços e disponibilidade atuais e avisa sobre itens ou opções que não podem mais ser incluídos. Cada cliente só acessa seu próprio histórico e endereços. Pedidos de visitantes não são vinculados retroativamente por nome ou e-mail.

A recuperação de senha usa links de 30 minutos; confirmação de e-mail usa links de 24 horas. Tokens são aleatórios, armazenados por hash e consumidos uma única vez. Uma nova solicitação substitui o token anterior da mesma finalidade. A troca de senha invalida as sessões antigas. Respostas de recuperação não revelam se o e-mail existe. A verificação é acionada por botão explícito na página.

## Configurar SMTP

A integração está pronta, mas o envio fica desabilitado até configurar um provedor. Não há credenciais ou serviço de e-mail fornecidos. Configure no `.env` e reinicie:

```dotenv
PUBLIC_URL=https://seu-dominio.com
SMTP_HOST=smtp.seu-provedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=usuario-do-provedor
SMTP_PASS=senha-do-provedor
SMTP_FROM=Tadalas Burguer <atendimento@seu-dominio.com>
```

Use os valores oficiais do provedor. Para TLS direto na porta 465, use `SMTP_SECURE=true`; na porta 587 a conexão exige STARTTLS. `PUBLIC_URL` deve ser a origem real, sem caminho; HTTP só é aceito em loopback no desenvolvimento. Segredos ficam no ambiente, nunca na configuração pública ou no Git.

O processo verifica a fila persistente a cada 10 segundos e tenta enviar até cinco vezes, com intervalos crescentes. Configuração presente não garante entrega: confirme credenciais, remetente autorizado e recebimento com o provedor antes de anunciar o recurso. Se o envio falhar após as tentativas, corrija o serviço e solicite um novo link. Sem SMTP, as telas informam a indisponibilidade e não simulam envio bem-sucedido. Os testes usam um remetente falso, sem enviar e-mails reais.

## Dados, migração e backup

O banco privado é `var/tadalas.sqlite`: produtos, categorias, configurações, clientes, administrador, pedidos, sessões e fila de e-mail. Na primeira abertura, importa os JSON legados de `var/` e cria uma cópia em `var/backups/legacy-*`. O processo é marcado no banco e não se repete. Produtos e credenciais existentes são preservados; os JSON originais ficam intactos, mas deixam de ser a fonte das alterações. Os arquivos de `src/data/` são somente base inicial quando não há dados legados.

```sh
npm run db:backup
```

O comando usa a API de backup SQLite para gerar uma cópia consistente em `var/backups/`, inclusive com o servidor funcionando. Guarde também `public/assets/uploads/`. Backups contêm dados pessoais e hashes de credenciais: restrinja acesso e retenção. Para restaurar, pare o servidor, preserve a base atual, restaure o snapshot como `var/tadalas.sqlite` e seus uploads correspondentes; arquivos WAL/SHM da base antiga não devem acompanhar o snapshot restaurado.

Use disco persistente e uma instância do servidor. SQLite fornece transações e WAL, mas os limites por IP ainda ficam em memória. Não use disco efêmero ou múltiplas réplicas sem adaptar persistência, uploads, limites e processamento de e-mails. `var/`, uploads e `.env` são ignorados pelo Git.

## Segurança e implantação

Sessões opacas duram 8 horas, ficam no SQLite e sobrevivem ao reinício até expirar. Cookies separados para cliente/admin são HttpOnly e SameSite=Strict, com Secure e prefixo `__Host-` em produção. Não há token de autenticação em localStorage. Escritas autenticadas exigem CSRF e origem compatível. Login, cadastro, recuperação e pedidos têm limites de requisição. Senhas usam scrypt; reserve memória para verificações concorrentes.

Configure HTTPS, `NODE_ENV=production`, `HOST` e `PORT`. Defina `TRUST_PROXY_HOPS` somente atrás de um proxy confiável, com o número exato de saltos. Cookies de produção exigem HTTPS. Helmet aplica CSP com recursos locais. A configuração pública nunca deve conter segredos. Não houve publicação automática.

## API principal

Respostas usam `{ "data": ... }` ou `{ "error": { "message": "..." } }`. JSON tem limite de 128 KB.

| Método     | Caminho                                                                                       | Uso                                           |
| ---------- | --------------------------------------------------------------------------------------------- | --------------------------------------------- |
| GET        | `/api/health`                                                                                 | Saúde                                         |
| GET        | `/api/products`, `/api/categories`, `/api/config/public`                                      | Catálogo e configuração pública               |
| POST       | `/api/orders/quote`                                                                           | Validação e cálculo sem persistir             |
| POST       | `/api/orders`                                                                                 | Registro idempotente e URL do WhatsApp        |
| POST       | `/api/orders/validate`                                                                        | Validação simples mantida por compatibilidade |
| POST       | `/api/customer/register`, `/api/customer/login`                                               | Conta de cliente                              |
| GET        | `/api/customer/session`, `/api/customer/orders`, `/api/customer/addresses`                    | Dados da própria conta                        |
| POST       | `/api/customer/forgot-password`, `/api/customer/reset-password`, `/api/customer/verify-email` | Recuperação e confirmação                     |
| GET/POST   | `/api/admin/products`, `/api/admin/categories`                                                | Catálogo administrativo                       |
| PUT/DELETE | `/api/admin/products/:id`, `/api/admin/categories/:id`                                        | Alterações do catálogo                        |
| GET/PUT    | `/api/admin/settings`                                                                         | Configuração da loja                          |
| GET        | `/api/admin/orders`                                                                           | Pedidos administrativos                       |
| PATCH      | `/api/admin/orders/:id/status`                                                                | Evolução do pedido                            |

As rotas administrativas exigem sessão; login/status são públicos. Detalhes dos contratos e verificações estão nos testes HTTP em `tests/`.

## Visual e demonstração

A página inicial mantém o carrossel automático de hambúrgueres/combos, ligado aos produtos disponíveis, com pausa, setas e indicadores. A troca ocorre a cada quatro segundos, respeita movimento reduzido, foco de teclado e visibilidade. As imagens ilustrativas de fallback são identificadas; detalhes em `docs/carousel-assets.md`. A logo oficial permanece nos elementos de marca.

O cardápio tem busca sem acentos, filtros, categorias e destaque. Os produtos de teste já cadastrados foram preservados; revise-os antes de atendimento real.

A página de pedidos também tem cards com profundidade e foco visível, entrada discreta dos produtos na rolagem, confirmação visual ao adicionar e carrinho com miniaturas e total destacado. Os diálogos abrem e fecham com transições curtas. Efeitos respeitam movimento reduzido, inclusive quando essa preferência muda durante o uso; conteúdo e ações permanecem disponíveis sem suporte às animações. O acabamento fica em `public/css/order-polish.css` e os efeitos em `public/js/motion.js`.

`DEMO_MODE=true` é permitido somente em host local e fora de produção. Usa catálogo demonstrativo, carrinho separado e bloqueia criação de pedidos e alterações administrativas. Retorne a `false` para operação normal.

## Verificação

Testes nativos Node cobrem autenticação, CSRF, catálogo, opções, preços, entrega, idempotência, situações, histórico, isolamento, migração, recuperação e expiração de tokens. Consulte `docs/verification.md` para resultados e limites de cada atualização. A inspeção visual das novas telas ainda precisa ser feita: o acesso ao navegador foi recusado nesta sessão, sem tentativas de contorno. Não houve envio real de e-mail ou mensagem no WhatsApp, nem medição Lighthouse.
