# Verificação local — 24/10/2026

- Ambiente: Windows, Node.js 24.14.0, npm 11.9.0. Para produção, atualizar o runtime para o patch mais recente de Node 24 LTS.
- `npm test`: 7 testes com várias asserções de endpoints, erros, produtos, quantidades, carrinho, persistência e WhatsApp; conexões HTTP locais exigiram liberação do sandbox.
- `npm run lint` e `npm run format:check`: aprovados.
- Auditoria durante instalação: zero vulnerabilidades reportadas pelo npm.
- Página servida por `npm start` e aberta no navegador local.
- Larguras verificadas: 320, 375, 390, 768, 1024, 1440, 1920 px; documento dentro do viewport, sem rolagem horizontal.
- Inspeção visual do hero em desktop (1440 px) e mobile (390 px).
- Menu mobile, Escape, diálogo vazio e foco modal verificados.
- Demonstração isolada na porta 3001: categorias, detalhes, ingredientes, inclusão de 2 unidades (R$ 50,00), atualização para 3 (R$ 75,00), restauração após reload, remoção e bloqueio de envio demonstrativo verificados.
- Produto indisponível com botão desativado.
- Console: sem erros/avisos no fluxo verificado.
- Links internos e recursos do HTML verificados automaticamente.
- URL de WhatsApp e codificação verificadas por teste; nenhuma mensagem comercial enviada.
- Capturas: `desktop.jpg` e `mobile.jpg` nesta pasta.

Limites: sem Lighthouse ou teste completo de leitor de tela; não se declara certificação WCAG nem pontuação de desempenho. Ativos e dados oficiais precisam ser inseridos e verificados antes da publicação. Sem deploy, domínio, favicon ou imagem Open Graph oficiais definidos.

## Skills

Ambiente Codex desktop. Consultado o catálogo oficial `openai/skills` pelo helper `skill-installer/scripts/list-skills.py`. Não foram encontradas `designer-pro`, `frontend-design` ou `ui-ux-pro` no catálogo curado. As opções Figma dependem de um fluxo de Figma, ausente do briefing. Não foram instaladas skills externas; aplicadas as diretrizes da skill Sites já disponível e sua referência de design editorial. Não foram executados scripts remotos desconhecidos.

Referências: [catálogo oficial de skills](https://github.com/openai/skills/tree/main/skills/.curated), [Anton e licença](https://github.com/google/fonts/tree/main/ofl/anton), [versões Node.js](https://github.com/nodejs/Release), [API Express](https://expressjs.com/en/5x/api.html).

## Atualização — logo oficial e carrinho

Logo enviada pelo proprietário copiada sem alterações (SHA-256 conferido), aplicada no cabeçalho, hero, rodapé e favicon. Painel lateral do carrinho, adição direta no cardápio, controles de mais/menos, preço unitário e barra fixa com quantidade/subtotal implementados. Teste no navegador mobile confirmou adição de uma unidade e aumento para duas com subtotal de R$ 50,00. As verificações automatizadas seguem passando (7 testes), ESLint e Prettier aprovados. Página pública conferida em 320, 390, 768, 1024 e 1440 px, sem overflow horizontal e com imagens carregadas; console sem erros/avisos. Capturas: logo-desktop.jpg e carrinho-mobile.jpg. Ainda faltam produtos/preços e fotografia gastronômica oficiais; o catálogo público permanece vazio.

## Atualização — administração autenticada e CRUD

Implementados painel em /admin/, criação local do primeiro administrador via npm run admin:create, senha scrypt com salt aleatório, sessões opacas de 8 horas, cookie HttpOnly/SameSite/ Secure em produção, token CSRF, verificação de origem, expiração, logout e limite de login. CRUD de produtos com validação, persistência atômica, fila de gravação e versão para conflitos. Upload autenticado de imagens até 3 MB; catálogo público e validação de pedido consomem os mesmos dados persistentes.

11 testes automatizados aprovados, ESLint e Prettier aprovados. Casos incluem sessão inválida, CSRF, origem externa, expiração, logout, cookies Secure, rotas privadas, preço/quantidade inválidos, disponibilidade, conflitos, upload e recursos públicos. Testes usam diretórios temporários, sem alterar o catálogo real.

No navegador, com conta e dados temporários: login, criação de produto, preço editado de R$ 29,90 para R$ 34,90, presença no cardápio, adição ao carrinho pelo preço atualizado, limpeza, confirmação de exclusão e logout verificados. Dashboard sem overflow nas larguras 320, 390, 768 e 1440 px. Captura principal: admin-dashboard.jpg (base de teste). A URL e a codificação do WhatsApp são cobertas pelos testes; nenhuma mensagem comercial foi enviada.

O primeiro administrador real deve ser criado pelo proprietário no terminal, sem credenciais padrão. Sessões e limite de login ficam na memória e expiram no reinício; produtos e credenciais ficam no disco privado. Implantação requer uma instância/processo, disco persistente, backup e HTTPS. Não houve publicação nem auditoria Lighthouse.

## Atualização — apresentação do cardápio

Cardápio redesenhado com introdução editorial, passos do pedido, navegação por categoria e contagem, busca sem distinção de acentos por nome/descrição/ingrediente e filtro de disponibilidade. Primeiro produto disponível em destaque ganha composição maior, sem duplicação na grade. Cards oferecem foto, categoria, nome, preço e ações independentes para detalhes e carrinho. Itens indisponíveis mantêm detalhes acessíveis e compra desativada. Falta de foto usa a logo oficial com aviso; não foram criadas fotografias ou produtos comerciais fictícios.

Verificados no navegador em modo demonstrativo: busca por ingrediente, busca sem resultados e limpeza, categoria Bebidas, filtro Só disponíveis, abertura de detalhes e adição ao carrinho (subtotal atualizado para R$ 75,00 com 3 unidades demonstrativas). As larguras 320, 375, 390, 768, 1024, 1440 e 1920 px não apresentaram overflow horizontal. Console sem erros/avisos. O catálogo real vazio foi verificado separadamente. Os 11 testes, lint e formatação passaram. Capturas cardapio-desktop.jpg e cardapio-mobile.jpg contêm dados demonstrativos, sem envio de pedidos reais.

## Atualização — páginas de pedido e contas de clientes

Criadas páginas separadas: início, /cardapio/, /login/, /conta/ e /admin/login/. A página inicial usa apenas uma chamada para o cardápio dedicado; navegação, busca, seleção de produtos, carrinho e WhatsApp ficam na página de pedidos. O login administrativo foi separado do cadastro/login de clientes. Contas de clientes têm persistência privada, senha com scrypt, cookie próprio, expiração, logout com CSRF e nenhuma permissão para administrar produtos.

13 testes automatizados aprovados, cobrindo também cadastro, e-mail normalizado, senha inválida, duplicação, login, logout, expiração e isolamento entre cliente e administrador. Páginas, recursos estáticos, links internos e redirecionamentos foram verificados por HTTP. Lint aprovado. As bases utilizadas nos testes são temporárias e isoladas.

A tentativa de abrir a nova prévia no navegador foi recusada pela permissão do navegador. Não houve tentativa de contorno, e a inspeção visual desta atualização não foi concluída. As capturas anteriores não representam todas as novas páginas. A integração de WhatsApp é verificada pela construção da URL e validação de itens; nenhuma mensagem comercial foi enviada. Não há verificação ou recuperação de e-mail nesta versão.

## Atualização — carrossel de hambúrgueres e combos

Hero alterado de logo estática para carrossel ligado ao catálogo. Seleção de produtos, prioridade de destaques, exclusão de indisponíveis/bebidas, imagens ilustrativas de fallback, limite de oito slides e URLs para detalhes cobertos por dois novos testes. Total: 15 testes aprovados, ESLint aprovado. Imagens ilustrativas geradas com a ferramenta nativa Imagegen e exportadas para JPEG 960×960, aproximadamente 150/177 KB, sem alterar a logo oficial. Botões, pausa, foco, teclado, toque, visibilidade e movimento reduzido implementados em JavaScript nativo. Não houve nova inspeção visual no navegador; a permissão de prévia foi recusada na etapa anterior. Os ativos foram inspecionados diretamente. Nenhuma mensagem foi enviada ao WhatsApp.

## Atualização — operação da loja, pedidos e contas (24/10/2026)

Implementadas as sugestões 1–7; controle de estoque (sugestão 8) ficou fora do escopo. Pedidos persistem com numeração, chave de idempotência e fluxo administrativo de situação. Checkout calcula adicionais, entrega/retirada, taxa por bairro, pagamento e troco no servidor, e gera a mensagem do WhatsApp após registrar o pedido como aguardando confirmação. Abrir o link não confirma compra nem envia mensagem automaticamente.

Produtos aceitam grupos de escolhas com mínimo/máximo, adicionais pagos e remoção de ingredientes. Configuração administrativa inclui categorias, marca/logo, contato, horários com fuso e virada de dia, pausa manual, regiões de entrega, taxas e estimativa. Clientes têm histórico próprio, repetição com catálogo atual e endereços salvos. Recuperação de senha e confirmação de e-mail usam tokens com expiração, uso único e revogação das sessões após trocar senha. SMTP está preparado, porém continua sem provedor configurado, conforme solicitado; a interface informa a indisponibilidade.

SQLite substituiu os JSON como armazenamento principal. Migração única com cópia dos legados, sessões persistentes e comando de backup consistente implementados. Conferência somente de leitura da base real: integridade `ok`, seis produtos originais preservados integralmente e credenciais administrativas preservadas (comparação booleana, sem exibir hash ou senha). Executado `npm run db:backup` com sucesso, gerando snapshot em `var/backups/`. JSON legados não foram removidos.

Verificação final: **24 testes aprovados**, ESLint e `format:check` aprovados. Casos novos cobrem migração idempotente, backups, variações, obrigatoriedade de opções, preços recalculados, taxa, bairro incompatível, troco insuficiente, duplicação de envio, versões/status, fechamento da loja, isolamento entre clientes, histórico/repetição, endereços, tokens expirados ou usados, respostas neutras e ausência de SMTP. Testes usam diretórios temporários e remetente simulado; nenhum e-mail ou mensagem real foi enviado. O Node instalado emite aviso experimental para `node:sqlite`, documentado no README.

A inspeção visual desta atualização permanece pendente: o acesso ao navegador foi recusado anteriormente, e não houve tentativa de contorno por outro navegador, origem ou automação. Os testes de recursos/HTML por HTTP e as verificações estáticas passaram; isso não substitui conferir interação e apresentação em navegador. Não houve publicação, processamento de pagamento ou medição Lighthouse. As seções anteriores deste documento registram estados históricos; o README descreve a versão atual.

## Atualização — acabamento do cardápio e carrinho (26/10/2026)

Cards receberam bordas e sombras mais cuidadas, zoom discreto nas fotos em dispositivos com mouse, preços maiores e botões de montagem para produtos com opções. Busca com destaque de foco, categorias arredondadas e indicador de atendimento refinados. Carrinho agora apresenta miniaturas com fallback para a logo, resumo de cada variação e total destacado. Abrir/fechar os diálogos tem transição curta; contador, preço por linha e confirmação de inclusão oferecem retorno visual. O envio do formulário ignora novas submissões durante o fechamento para evitar adição duplicada nesse intervalo.

Revelações por IntersectionObserver não dependem de conteúdo inicialmente oculto. Ao filtrar, observações e animações dos cards anteriores são liberadas. Os efeitos JavaScript são cancelados se a preferência por movimento reduzido for ativada, incluindo a conclusão segura do fechamento de um diálogo. Sem suporte a animação/observação, as ações continuam imediatas. As regras visuais são restritas à página de pedidos. Adicionado `.gitattributes` para manter finais LF e evitar falha de formatação após checkout no Windows.

Verificação: 26 testes aprovados, incluindo dois novos casos para cancelamento por movimento reduzido, callbacks de encerramento, ausência de IntersectionObserver e descarte dos elementos removidos por filtros. ESLint e formatação verificados. Os testes HTTP verificam que o novo CSS está disponível; nenhum pedido real ou mensagem foi enviado. Inspeção visual e interação real em navegador permanecem pendentes devido à recusa anterior de acesso ao navegador; não houve tentativa de contorno. Esta atualização não afirma validação visual, Lighthouse ou desempenho medido em celular.

## Atualização — botão de funcionamento e horários no painel (26/10/2026)

Adicionado bloco destacado no topo do administrador com estado atual, modo de controle e botão Abrir/Fechar loja agora. O botão ativa controle manual e preserva os horários existentes. Formulário acessível permite adicionar/remover intervalos por dia com abertura e fechamento e ativar o modo automático; informa o fuso, dias fechados e intervalos após meia-noite. Recarregamento dos horários é explícito. A consulta periódica de estado não substitui edições em andamento.

GET/PATCH autenticados em `/api/admin/settings/operation` usam as mesmas validações, CSRF, bloqueio demonstrativo e versões da configuração existente. Atualização parcial aceita apenas modo, abertura manual e intervalos; não sobrescreve marca, contato, taxas ou formas de pagamento. Fechamento bloqueia novas cotações/pedidos na API e não remove pedidos recebidos. As configurações reais da loja não foram alteradas durante a implementação.

Validação: 27 testes aprovados, lint e formatação aprovados. O novo caso HTTP cobre autenticação, CSRF, fechamento imediato, reabertura, ativação da agenda, fechamento no instante exato, agenda inválida, preservação dos intervalos, isolamento de outros campos e rejeição de versão antiga. Inspeção visual em navegador permanece pendente pela restrição de acesso registrada nas etapas anteriores; não houve tentativa de contorno ou envio real de pedidos.

## Atualização — pré-lançamento sem produtos e ViaCEP (27/10/2026)

Removidos seis produtos identificados como testes da base local, após snapshot consistente privado em `var/backups/antes-lancamento-sem-produtos-*.sqlite`. Catálogo agora vazio; administrador preservado, sem exclusão de clientes ou pedidos. O catálogo inicial versionado já era vazio. Os JSON legados e snapshots não foram enviados ao Git.

ViaCEP integrado ao checkout e cadastro/edição de endereços: preenchimento de rua, bairro e cidade pelo CEP, preservação de edição manual, cancelamento de respostas antigas, estados de busca/erro e preenchimento manual quando necessário. Número e complemento não são preenchidos pelo serviço. Bairro pode selecionar uma região cadastrada com nome correspondente; a região não sobrescreve mais o bairro. A API não define a área atendida nem as taxas.

Endpoint GET `/api/address/:postalCode` fixa a origem HTTPS do ViaCEP, valida formato e resposta, usa timeout de cinco segundos, cache limitado e limite por IP e por consultas simultâneas. Testes usam respostas simuladas. Uma consulta real ao CEP público de exemplo `01001-000` retornou rua, bairro e cidade com sucesso; nenhuma informação pessoal foi enviada ao provedor.

Preparados `DATA_DIRECTORY` e `UPLOAD_DIRECTORY` para armazenar banco, backups e imagens em volume persistente na futura hospedagem. Teste em processos separados confirmou retenção dos dados e do arquivo de upload e geração de backup íntegro no volume configurado. Nenhuma hospedagem foi criada, nenhum domínio foi comprado e SMTP continua desabilitado.

Verificação: 32 testes aprovados, lint e formatação aprovados. Novos casos cobrem CEP inválido/inexistente/genérico, falha de rede, resposta incompatível, cache/expiração, compartilhamento de consultas, limite HTTP, edição manual, respostas antigas e persistência entre processos. O roteiro em `docs/lancamento.md` separa o que foi automatizado das conferências ainda pendentes no navegador e na hospedagem real. Acesso ao navegador permanece restrito; nenhum contorno, e-mail real ou pedido comercial enviado.

## Atualização — preparação do frete por quilômetro (27/10/2026)

Implementada alternativa de frete proporcional a R$ 2,00/km de rota de carro, somente ida, com arredondamento em centavos. ViaCEP confirmou a origem informada: Rua Conceição do Almeida, 88, Parque Paulistano, São Paulo/SP, CEP 08081-370. Endereço e modo por distância salvos na base local após backup privado `antes-frete-por-km-*.sqlite`; novos produtos cadastrados durante o trabalho foram preservados.

Google Routes preparado via chave privada no ambiente, timeout e limite de consultas simultâneas. Nenhuma conta/chave configurada, contratação ou consulta paga foi feita. A entrega continua indisponível para o cliente até configurar o serviço. O checkout tem cálculo explícito de frete, distância com atribuição Google Maps e total antes de continuar. Configuração administrativa permite escolher distância ou bairros. A cota de pedidos limita cálculos por IP, e erros de rota nunca viram frete gratuito.

Pedido e cotação usam cálculos no servidor. A consulta externa acontece antes da transação; após ela, catálogo/configuração/preço são revalidados. Idempotência preservada em repetições, inclusive com provedor indisponível após registro. Histórico mantém a tarifa comercial, sem persistir conteúdo da resposta do Google. Ativação em produção ainda depende da chave, validação real das rotas e dos requisitos públicos de termos/privacidade do provedor, documentados no README.

37 testes aprovados, incluindo proporcionalidade, arredondamento, validação de distância, origem controlada pelo servidor, falha/ausência de provedor, reabertura de pedidos idempotentes e alteração da loja enquanto aguarda a rota sem bloquear o SQLite. Revisão visual continua pendente, sem contorno da restrição de navegador.

## Atualização — central administrativa de pedidos (27/10/2026)

Substituída a lista simples por central de pedidos: fila de andamento, contadores por etapa, filtros de novos/preparo/entrega-retirada/concluídos/cancelados/todos, busca por número ou cliente sem acentos, cartões de detalhes e paginação. O acesso direto `/admin/?aba=pedidos` abre a área correspondente. Não foram criados pedidos reais para preencher a interface.

GET autenticado `/api/admin/orders/dashboard` faz filtragem e paginação no SQLite, com consultas parametrizadas e busca que trata caracteres de LIKE como texto. Retorna 20 registros por página, total filtrado e contadores de todos os pedidos. Pedidos ativos são ordenados pelos mais antigos; histórico, pelos mais recentes. Isso evita que os 100 pedidos mais recentes do endpoint legado ocultem uma pendência antiga. O endpoint legado foi preservado.

Ações diretas respeitam as transições existentes, diferenciam entrega de retirada e exigem versão atual; cancelamento tem confirmação explícita. A central mostra nome, data/tempo desde criação, itens/opções, endereço, pagamento/troco, observações, subtotal, entrega e total. Leituras antigas de buscas são ignoradas; falha ao atualizar mantém os dados anteriores e exibe erro. A atualização periódica respeita foco/interação e aba oculta. Nenhuma mensagem foi enviada ao cliente nem status de pedido real foi alterado durante a implementação.

40 testes aprovados, lint e formatação aprovados. Novo teste com 125 pedidos concluídos sintéticos confirma paginação, contadores globais, busca sem acentos, tratamento literal de curingas e preservação de pedido ativo mais antigo. Também verifica autenticação, filtros inválidos e atualização da fila após transição. Testes das ações confirmam compatibilidade com entrega/retirada e estados terminais. Inspeção visual e interação real em navegador permanecem pendentes devido à restrição registrada; nenhum contorno foi tentado.
