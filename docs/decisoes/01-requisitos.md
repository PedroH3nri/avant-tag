# Requisitos do novo SaaS AdTech Groone

> Registro da decisão na época em que foi tomada (outubro de 2026). Onde divergir de `docs/contexto.md` ou do código, vale o código.

Oct 22, 2026 · @Pedro

## Visão geral e público-alvo

O SaaS é a evolução do Genius como produto para clientes: um painel onde donos de sites gerenciam a equipe e a operação de monetização num só lugar.

- **Cliente:** pessoas e empresas que têm sites e monetizam com AdSense.
- **Usuários dentro de cada cliente:** o dono ou gestor e os funcionários dele, cada um com permissões próprias.

## Problemas a resolver

O produto resolve duas frentes ao mesmo tempo: quem faz o quê na empresa do cliente, e como a operação de anúncios está indo.

- **Gestão da empresa:** cadastrar funcionários, definir papéis e controlar o que cada um pode ver e fazer (por site, por conta GAM, por funcionalidade).
- **Gestão da operação:** acompanhar sites, receita, regras de preço e qualidade de tráfego, com as ferramentas que hoje estão no Genius.

## Escopo herdado do Genius

O novo SaaS terá todas as funcionalidades que o Genius tem hoje, porém melhoradas. Pontos de partida conhecidos:

- Motor de price rules e floor price por key-value no Google Ad Manager.
- G-Tag: tag de anúncios com detecção de cloaker (a confirmar se entra no SaaS).
- Falta levantar a lista completa de funcionalidades do Genius e o que "melhorado" significa em cada uma.

## Integrações e onboarding no Google Ad Manager

Cada cliente conecta as próprias networks do GAM sozinho, por um de dois caminhos, e o SaaS detecta a conexão automaticamente.

| Caminho | O que o cliente faz | Para quem |
| --- | --- | --- |
| Conta de serviço | Adiciona o e-mail da conta de serviço do SaaS como usuário na network GAM dele | Cliente que já tem GAM próprio |
| Contrato MCM | Aceita o convite MCM no Ad Manager | Cliente que monetiza pela rede da Groone |

O sistema é multi-tenant: cada cliente é uma organização isolada, com seus sites, networks e funcionários.

Como funciona hoje (Pedro, 22/10/2026): a Groone tem **uma única conta de serviço**, com chave criada no GCP.

- **Cliente com contrato MCM aceito:** a conta de serviço da Groone conecta automaticamente no GAM do cliente, sem nenhum passo dele.
- **Cliente sem contrato:** o Avant mostra um passo a passo de como adicionar a conta de serviço da Groone como usuário no GAM. Sugestão: o cliente informa o código da network e clica em "Testar conexão", e o Avant confirma o acesso.

A chave da conta de serviço fica guardada como segredo do servidor, nunca no código nem no banco.

- **Nível de acesso:** a conta de serviço é sempre adicionada como **administrador** no GAM do cliente.
- **Sites:** depois da conexão, o Avant importa automaticamente os sites e ad units cadastrados no GAM do cliente.

## Modelo de cobrança

Proposta inicial, ainda em discussão: grátis para clientes da rede Groone e pago para clientes de fora da rede.

- **Na rede (MCM com a Groone):** uso gratuito, já que a Groone ganha na monetização.
- **Fora da rede:** plano pago. Falta definir se é mensalidade fixa, por volume (sites, pageviews, impressões) ou percentual da receita.

## MVP

O foco inicial é total em conta e equipe e na conexão com o GAM (decidido por Pedro em 22/10/2026). Price rules ficam fora por enquanto.

1. **Conta e equipe (foco agora):** cadastro da organização, login, convite de funcionários, papéis e permissões.
2. **Conexão com o GAM (foco agora):** conta de serviço ou MCM, com detecção automática das networks e dos sites.
3. **Sincronia de métricas (depois):** receita, impressões, eCPM e fill rate por site.
4. **Dashboards customizáveis (depois):** dashboards, cards e cores do sistema.

Fora do MVP por enquanto: motor de price rules, cobrança dos clientes fora da rede, G-Tag e as demais funcionalidades do Genius.

## Opções de nome

Decisão provisória: o produto se chama Avant (Groone Avant), de avant-garde, estar à frente (escolhido por Pedro em 22/10/2026). Descartados: Nexo, Nexus, OneHub e nomes que misturam dois conceitos, como PubGro. Marca e domínio ainda não verificados. A tabela abaixo é a primeira rodada de opções, cuja recomendação foi: **Groone Hub** ou **Nexo**. Nenhum nome foi checado ainda quanto a domínio e marca registrada; isso vem depois da escolha.

| Nome | Ideia por trás | Ponto de atenção |
| --- | --- | --- |
| Groone Hub | Central única de equipe e operação, ligada à marca Groone | Nome genérico, depende da força da marca Groone |
| Nexo | Conecta cliente, equipe e networks GAM; curto e fácil em português | Palavra comum, difícil achar domínio exato |
| Genius Cloud | Deixa claro que é o Genius evoluído, agora como SaaS | Prende o produto ao nome antigo |
| Yieldo | Vem de "yield" (rendimento de anúncios); soa internacional | Termo técnico, menos claro para dono de site pequeno |
| Órbita | Os sites do cliente orbitando a rede Groone; ideia de ecossistema | Não fala de anúncios nem de gestão |
| Groone Pulse | Acompanhar o "pulso" da operação em tempo real | Foca em monitoramento, menos em gestão de equipe |
| Monetiza | Diz exatamente o que o cliente quer: monetizar | Muito brasileiro, limita expansão fora do país |

## Conta e equipe

O Avant tem dois níveis: um painel interno da Groone com todos os clientes da rede, como o painel interno do Genius, e o painel de cada cliente (definido por Pedro em 22/10/2026).

1. **Painel interno (Groone):** lista todos os clientes da rede. Nele existe o papel **Cliente**, que recebe todas as permissões necessárias para usar o próprio painel. Também é onde se configura o limite de funcionários de cada cliente.
2. **Painel do cliente:** o cliente cria uma **Empresa** e define os papéis dentro dela.
3. **Convites:** o cliente convida pessoas para a Empresa informando o e-mail e o papel de cada uma.
4. **Limite:** a quantidade de funcionários vinculados respeita o limite configurado no painel interno.

Regras definidas por Pedro em 22/10/2026:

- Cada cliente cria **uma única Empresa**, então o limite de funcionários vale para essa Empresa.
- A Groone oferece **papéis pré-definidos** iguais para todos os clientes, cada um com suas permissões (ex.: gestor de tráfego, financeiro, marketing).
- Uma pessoa pode participar de **várias Empresas**, e escolhe em qual está trabalhando depois do login.
- A equipe interna da Groone também tem **papéis definidos** no painel interno.
- **Convite e login:** a pessoa recebe o e-mail, clica no link e define a senha. Depois disso pode entrar também com o Google, desde que seja o mesmo e-mail.

Proposta de permissões dos papéis pré-definidos (sugestão do Claude, a revisar):

| Permissão | Cliente (dono) | Gestor de tráfego | Financeiro | Marketing |
| --- | --- | --- | --- | --- |
| Gerenciar Empresa e convidar ou remover pessoas | Sim | Não | Não | Não |
| Conectar e gerenciar networks do GAM | Sim | Sim | Não | Não |
| Ver sites e networks | Sim | Sim | Sim | Sim |
| Ver métricas de tráfego (impressões, fill rate, eCPM) | Sim | Sim | Não | Sim |
| Ver receita | Sim | Sim | Sim | Não |
| Criar e editar dashboards | Sim | Sim | Sim | Sim |

Além dos papéis pré-definidos, o cliente pode **criar papéis próprios**, escolhendo permissões da mesma lista acima. Os papéis da equipe interna seguem o modelo do Genius (Admin, Comercial, Marketing etc.) e serão detalhados depois, porque o foco agora é o Avant para clientes.

## Tecnologias

O backend será em Python, separado em serviços, para sair do bootstrap pesado e do monólito do Genius (decidido por Pedro em 22/10/2026).

| Camada | Escolha | Status |
| --- | --- | --- |
| REST API | FastAPI (uvicorn) | Decidido |
| Filas | Celery, com RabbitMQ como broker e Redis | Decidido |
| Processamento e sincronias | Microserviços com banco de dados compartilhado | Decidido |
| Integrações Google | `googleads` (Ad Manager) e `google-api-python-client` (AdSense) | Sugerido |
| Organização do código | Um repositório, pacote comum de models SQLAlchemy e migrations Alembic | Sugerido |
| Banco de dados | PostgreSQL para tudo, inclusive as métricas do Ad Manager. Dashboards, cards e cores em JSONB; métricas num schema metrics com TimescaleDB. Se precisar, migra-se as métricas para MongoDB depois do MVP | Decidido |
| Frontend | Vue 3 como SPA (Vite, Vue Router, Pinia) consumindo a API FastAPI; PrimeVue sugerido para componentes | Decidido |
| Hospedagem | VM 16 vCPU / 32 GB (já roda Genius, Data e MongoDB, CPU média \~20%) com Docker Compose e limites de CPU e memória por container; VM própria quando houver clientes pagantes. VM 4 vCPU / 8 GB com Jenkins, Grafana e Prometheus. Backup diário do banco fora das VMs | Decidido |

O motor de price rules será reescrito de PHP para Python e deve ser validado contra os resultados do Genius nos mesmos cenários antes de substituí-lo.

## Perguntas em aberto

- [ ] Quais funcionalidades entram no MVP?
- [ ] O G-Tag (detecção de cloaker) faz parte do SaaS?
- [ ] Clientes só de AdSense, sem GAM, serão atendidos? Como conectam?
- [ ] Quais papéis de funcionário existem (ex.: dono, gestor, analista, financeiro)?
- [ ] Formato do plano pago para clientes fora da rede
- [ ] O que significa "melhorado" em cada funcionalidade do Genius
