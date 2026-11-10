# Avant: conexão com o GAM

> Registro da decisão na época em que foi tomada (outubro de 2026). Onde divergir de `docs/contexto.md` ou do código, vale o código.

Oct 23, 2026 · @Pedro

## Resumo

Uma network entra no Avant por um de dois caminhos, e os dois terminam no mesmo lugar: network `connected` e seus sites e ad units importados.

- **MCM:** o cliente aceitou o contrato MCM da Groone. O Avant descobre a network sozinho, lendo os child publishers da network da Groone. Ninguém digita nada.
- **Conta de serviço:** o cliente fora do MCM adiciona a conta de serviço da Groone como administradora na própria network, informa o network code e clica em "Testar conexão".

**API:** recomendo a nova API REST do Ad Manager (`admanager.googleapis.com/v1`, cliente Python oficial). Ela já tem tudo o que o MVP lê: `networks`, `childPublishers`, `sites`, `adUnits`, `users` e `reports`. Ela ainda está marcada como **Beta**, então o código fala com o GAM só por um adaptador (`gam_client`), para dar para trocar pela API SOAP (`googleads`) se algo faltar.

No MVP o Avant **só lê** do GAM. O adaptador não expõe nenhum método de escrita, mesmo a conta de serviço sendo administradora.

&#91;embedded content: conexão de uma network · 2 caminhos\]

No MCM o Avant faz tudo sozinho e só pede ajuda à Groone quando não acha o dono; na conta de serviço o cliente faz três passos e o teste confirma.

## Caminho MCM

Uma tarefa do Celery roda **de hora em hora** e lista `networks/{código da Groone}/childPublishers`. Cada child publisher traz o network code do cliente (`childNetwork`), o e-mail, o tipo de delegação e vários status.

Regras para cada child publisher:

1. **Pronto para conectar** quando `accountStatus = APPROVED`. Convites pendentes ou recusados são ignorados.
2. **Já existe Network com esse código:** atualiza os status e segue.
3. **Network nova:** o Avant procura uma Company cujo dono tem o mesmo e-mail do child publisher.
   - Achou: cria a Network ligada a essa Company, com `connection_type = mcm`, e dispara a importação.
   - Não achou: a network vai para a fila "MCM sem dono" no painel interno, e a equipe Groone escolhe o cliente.
4. **Contrato encerrado** (`accountStatus` CLOSED\_\*, DEACTIVATED\_BY\_AD\_MANAGER ou INACTIVE): a Network vai para `disconnected` e as sincronizações param.

O tipo de delegação muda **onde** o Avant lê o inventário:

| Delegação | Onde ficam sites e ad units | Como o Avant lê |
| --- | --- | --- |
| MANAGE\_INVENTORY | na network da Groone, marcados com o código do cliente | `sites` da network Groone filtrados por `childNetworkCode`; ad units pela regra de organização da Groone (pergunta 2) |
| MANAGE\_ACCOUNT | na network do próprio cliente | direto na network do cliente, como no caminho da conta de serviço (a Groone usa os dois tipos; confirmar o acesso da conta de serviço no primeiro cliente Manage Account) |

## Caminho conta de serviço

Para quem não está no MCM. A tela de conectar network (já no protótipo) guia o cliente em três passos:

1. **Ligar o acesso à API** no GAM: Admin, Configurações globais, Configurações da rede, "Acesso à API". Sem isso o GAM não deixa adicionar a conta de serviço.
2. **Adicionar a conta de serviço da Groone** como usuário, em Configurações da rede, "Adicionar usuário de conta de serviço", com o papel **Administrador**. O Avant mostra o e-mail da conta com botão de copiar.
3. **Informar o network code** e clicar em "Testar conexão".

O que o "Testar conexão" verifica, nesta ordem, parando no primeiro erro:

| # | Verificação | Chamada | Se falhar, o Avant diz |
| --- | --- | --- | --- |
| 1 | O código tem só números e não está em outra Company | banco do Avant | "Esse network code já está ligado a outra empresa. Fale com a Groone." |
| 2 | A conta de serviço enxerga a network | `networks.get` | "Não encontramos acesso. Confira se o acesso à API está ligado e se a conta de serviço foi adicionada." |
| 3 | A conta de serviço é administradora | `users.list` filtrando pelo e-mail da conta, e o papel dela | "A conta foi adicionada, mas não é administradora. Troque o papel para Administrador." |
| 4 | A network não é de teste | campo de rede de teste no `networks.get` | "Essa é uma rede de teste do Ad Manager." |

Com os quatro ok, a Network nasce `connected`, com `connection_type = service_account`, e a importação começa. O teste fica gravado como um NetworkSyncRun do tipo `test`.

## Importação

A importação é uma cadeia de tarefas do Celery por network: teste, depois sites, depois ad units. Cada etapa grava um NetworkSyncRun com início, fim, contagens e erro.

| Tarefa | Quando roda | O que faz |
| --- | --- | --- |
| `gam.discover_mcm` | de hora em hora | lê os child publishers da Groone (Caminho MCM) |
| `gam.test_network` | ao conectar, e todo dia às 03:00 | repete o teste de acesso; falha muda o status |
| `gam.import_sites` | ao conectar, e a cada 6 horas | lista `sites` paginando, grava por `gam_site_id` |
| `gam.import_ad_units` | logo após os sites | lista `adUnits` paginando, monta a hierarquia e liga ao site |
| "Sincronizar agora" | botão na tela de networks | roda a cadeia inteira; no máximo 1 vez a cada 10 minutos |

Regras da gravação:

- **Upsert** pelo id do GAM: o que existe é atualizado, o que é novo é criado.
- O que sumiu do GAM fica `archived`, nunca é apagado, para não quebrar métricas e atribuições de sites.
- Site novo chega sem atribuição: só o dono e papéis com acesso a todos os sites o veem.
- **Uma tarefa por network de cada vez:** um lock no Redis impede duas importações da mesma network ao mesmo tempo.
- As tarefas do GAM ficam numa fila própria do RabbitMQ (`gam`), com poucos workers, para não disputar com e-mails e outras tarefas.
- Company suspensa ou network `disconnected`: as tarefas agendadas pulam essa network.

**Ligar ad unit ao site:** o GAM não diz a qual site um ad unit pertence, então o Avant segue o padrão que a Groone já usa. O ad unit pai tem o nome do site do cliente, e os ad units filhos são os blocos dele. Na importação, cada ad unit de primeiro nível é comparado com o domínio dos sites da network, sem `www.` e sem diferença de maiúsculas. Quando bate, ele e todos os filhos recebem o `site_id`. Quando não bate, o ad unit fica sem site e aparece numa lista "ad units sem site", onde o dono liga à mão. A ligação manual não é sobrescrita pelas importações seguintes.

## Erros e estados

A Network tem quatro estados: `pending` (testando), `connected`, `error` (perdeu acesso, mas pode voltar) e `disconnected` (contrato encerrado ou desligada pelo cliente). Erros temporários não mudam o estado; só **3 falhas seguidas** do mesmo erro permanente levam a `error`.

| Erro | Como o Avant reconhece | Tipo | O que mostra e qual a correção |
| --- | --- | --- | --- |
| Acesso à API desligado ou conta removida | 403 / PERMISSION\_DENIED no `networks.get` | permanente | ponto vermelho na network e link para o passo a passo de novo |
| Conta deixou de ser administradora | papel diferente de Administrador no teste diário | permanente | "Troque o papel da conta de serviço para Administrador" |
| Network code não existe | 404 / NOT\_FOUND | permanente | "Confira o network code" |
| MCM encerrado | `accountStatus` CLOSED\_\*, DEACTIVATED ou INACTIVE | permanente | vai para `disconnected`; aviso ao dono e à equipe Groone |
| Cota da API | QUOTA / 429 | temporário | nada para o cliente; a tarefa tenta de novo com espera crescente (1, 2, 4, 8 min) |
| GAM fora do ar ou lento | 5xx, timeout | temporário | nada para o cliente; mesma nova tentativa |

Quando uma network vai para `error` ou `disconnected`, o dono da Company recebe um e-mail (Resend) e o item "Networks do GAM" ganha o ponto vermelho, como no protótipo. Quando o teste volta a passar, o estado volta para `connected` sozinho. Todas as mudanças de estado entram no AuditLog.

## Segurança e limites

A chave da conta de serviço dá acesso de administrador a todas as networks dos clientes, então é o segredo mais sensível do Avant.

- A chave JSON fica só nas VMs, fora do repositório, como os outros segredos. Só os workers da fila `gam` a carregam; a API web não.
- Escopo OAuth único: `https://www.googleapis.com/auth/admanager`.
- Trocar a chave a cada 90 dias no Google Cloud, sem mudar o e-mail da conta (os clientes não precisam refazer nada).
- O adaptador `gam_client` só tem métodos de leitura no MVP. Escrever no GAM (price rules, por exemplo) fica para depois e passa por revisão.
- Toda chamada ao GAM vai para o log JSON com `network_code`, método, duração e resultado, e para métricas no Prometheus (chamadas, erros e cota por network).
- Cota: o Google limita requisições por network e devolve erro de cota quando passa. O Avant não fixa um número; ele pagina com páginas grandes, roda uma tarefa por network por vez e espera quando recebe o erro.

## Decisões de Pedro (23/10/2026)

| Pergunta | Decisão |
| --- | --- |
| Tipo de MCM da Groone | Os dois: Manage Inventory e Manage Account |
| Ad units de cada cliente | O ad unit pai tem o nome do site, e os filhos são os blocos |
| Ligar network MCM à Company | Automático quando o e-mail do child publisher é o do dono |
| Reaproveitar o Genius | Sim: o Genius usa a API SOAP, e o Avant usa a mesma conta de serviço e o mesmo projeto do Google Cloud |
| Frequências | Mantidas como propostas (MCM de hora em hora, inventário a cada 6 horas, teste diário) |

**Métricas:** Pedro já tem a sincronização de métricas pronta, em Python, em outro repositório. Quando ela entrar no Avant, depois do MVP, vai usar o mesmo `gam_client` e as mesmas Networks, Sites e AdUnits deste documento.

**API:** como o Genius já tem código SOAP funcionando, o adaptador `gam_client` pode começar com a SOAP, reaproveitando esse código, e passar para a REST depois. O desenho deste documento vale para as duas.

## Fontes

- [Ad Manager API (Beta), referência REST](https://developers.google.com/ad-manager/api/beta/reference/rest)
- [Recurso networks.childPublishers](https://developers.google.com/ad-manager/api/beta/reference/rest/v1/networks.childPublishers)
- [Recurso networks.sites](https://developers.google.com/ad-manager/api/beta/reference/rest/v1/networks.sites)
- [Adicionar usuário de conta de serviço para acesso à API](https://support.google.com/admanager/answer/6078734)
