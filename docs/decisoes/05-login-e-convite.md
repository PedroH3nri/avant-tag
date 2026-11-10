# Avant: fluxos de login e convite

> Registro da decisão na época em que foi tomada (outubro de 2026). Onde divergir de `docs/contexto.md` ou do código, vale o código.

Oct 23, 2026 · @Pedro

## Resumo

Ninguém cria conta sozinho no Avant: toda pessoa entra por um convite, seja da Groone (para o dono) ou do dono (para a equipe). Depois do primeiro acesso, ela entra com senha ou com Google, e 2FA é obrigatório para a equipe Groone e opcional para clientes.

Regras que valem para todos os fluxos:

- **Sessão em cookie**, não em token no navegador: cookie `httpOnly`, `Secure`, `SameSite=Lax`, só em `avant.groone.com`. O banco guarda só o hash (model Session). Proteção contra CSRF com token em cabeçalho nas requisições que alteram dados.
- **Duração:** a sessão expira após 7 dias sem uso e no máximo em 30 dias. Para quem tem papel interno: 12 horas.
- **Senha:** mínimo de 10 caracteres, sem regra de símbolos, recusada se estiver numa lista de senhas vazadas. Guardada com Argon2.
- **Limite de tentativas:** 5 erros de login por e-mail em 15 minutos bloqueiam aquele e-mail por 15 minutos; o mesmo vale por IP com limite de 20. Contadores no Redis.
- **Mensagens neutras:** o login nunca diz se o e-mail existe ("E-mail ou senha incorretos"). A recuperação de senha sempre responde "Se o e-mail estiver cadastrado, enviamos um link".
- **E-mails** saem pelo Resend, do domínio avant.groone.com, no idioma da pessoa (PT, EN ou ES), e todos os links têm token de uso único, com só o hash no banco.
- Todo login, falha, troca de senha, ligação com Google e mudança de 2FA entra no AuditLog.

## Convite e primeiro acesso

Existem dois convites, com o mesmo mecanismo (model Invitation, válido por 1 dia):

- **Convite de dono:** a Groone cadastra o cliente no painel interno (e-mail do dono, limite de vagas e plano). Ainda não existe Company: o próprio cliente a cria com o nome ao aceitar.
- **Convite de equipe:** o dono, ou quem tem `team.invite`, convida por e-mail e papel, se houver vaga.

O que acontece quando a pessoa clica no link:

1. O Avant confere o token. Expirado, cancelado ou já usado: tela "Este convite não vale mais. Peça um novo a quem convidou".
2. **E-mail sem conta no Avant:** a pessoa vê o e-mail travado, digita nome e senha e aceita. O login com Google só pode ser ligado depois, em Configurações. O Avant cria User, UserCredential e Membership de uma vez, e marca o e-mail como verificado.
3. **E-mail que já tem conta** (a pessoa já está em outra Empresa): o Avant pede para ela entrar, se não estiver logada, e mostra "Você foi convidado para a Empresa X como Papel. Aceitar?". Só cria a Membership.
4. **Logada com outro e-mail:** o Avant avisa "Este convite é para fulano@... Saia e entre com esse e-mail". Convite nunca é aceito por outro e-mail.
5. Se for convite de dono, a pessoa cai na tela "Criar Empresa" do protótipo: dá o nome e escolhe a cor. O Avant cria a Company com o limite de vagas e o plano que a Groone definiu, e a pessoa vira `owner_user_id`.
6. A pessoa entra no painel já com a Empresa nova como ativa. Quem convidou recebe um e-mail "Fulano aceitou o convite".

&#91;embedded content: aceite de convite · 3 decisões\]

Só o convite de dono passa pela tela de criar a Empresa; o de equipe cai direto no painel.

Enquanto o convite está pendente, o convidador pode reenviar (gera token novo e mais 1 dia) ou cancelar. Expirado, só criando outro.

## Login e escolha da Empresa

### Com senha

1. E-mail e senha. Errado: "E-mail ou senha incorretos" e conta a tentativa.
2. User `disabled`: a mesma mensagem neutra, e o AuditLog registra o motivo real.
3. Se a pessoa tem 2FA ligado (ou tem papel interno), vai para a tela do código antes de criar a sessão (ver 2FA).
4. Cria a Session e escolhe a Empresa ativa (abaixo).

### Com Google

OAuth do Google com código de autorização e PKCE, tratado no backend (`/auth/google/callback`). O Avant usa só o `sub`, o e-mail e o `email_verified` do Google.

| Situação | O que o Avant faz |
| --- | --- |
| Já existe credencial Google com esse `sub` | entra |
| Não tem credencial Google, mas existe User ativo com o mesmo e-mail verificado | recusa: "Entre com sua senha e ligue o login com Google em Configurações, Conta" |
| Nenhum User com esse e-mail | "Você ainda não tem acesso ao Avant. Peça um convite à sua empresa." Não cria conta |
| Google diz que o e-mail não é verificado | recusa |

O 2FA do Avant também vale no login com Google: quem tem 2FA ligado digita o código do mesmo jeito.

### Escolha da Empresa ativa

- Uma Empresa só: entra direto.
- Várias: entra na última usada (User ganha o campo `last_company_id`) e troca pelo seletor da navbar.
- Nenhuma Membership ativa: tela "Você não faz parte de nenhuma Empresa no momento", com botão de sair.
- Empresa ativa suspensa pela Groone: tela "O acesso a esta Empresa está suspenso. Fale com a Groone", e o seletor continua mostrando as outras.

Trocar de Empresa no seletor só muda `active_company_id` na Session. Toda requisição à API usa essa Empresa para checar permissões e para o RLS.

## 2FA

Código de 6 dígitos de um app autenticador (Google Authenticator, 1Password e similares), padrão TOTP. Sem SMS, que é mais caro e menos seguro.

**Ativar** (em Configurações, Conta):

1. A pessoa confirma a senha (ou refaz o login Google).
2. O Avant mostra o QR code e a chave em texto.
3. A pessoa digita um código do app para provar que configurou.
4. O Avant mostra **10 códigos de recuperação**, de uso único, uma vez só, com botão de baixar. Guarda só o hash deles.

**Entrar com 2FA:** depois da senha ou do Google, tela do código. Aceita o código do app (com tolerância de 30 segundos para relógio atrasado) ou um código de recuperação. Errar 5 vezes encerra a tentativa e volta ao login. A sessão grava `mfa_verified_at`.

**Equipe Groone:** quem tem papel na Company Groone é obrigado a configurar o 2FA no primeiro acesso, antes de ver qualquer tela, e não pode desligar. O painel interno exige `mfa_verified_at` na sessão atual.

**Clientes:** opcional. Cada pessoa pode desligar o próprio 2FA confirmando senha e código.

**Perdeu o celular e os códigos:** a pessoa pede ajuda à Groone. Um Admin Groone zera o 2FA pelo painel interno, após confirmar a identidade por fora do Avant. Fica no AuditLog e a pessoa recebe e-mail avisando.

## Senha e sessões

**Esqueci a senha:**

1. A pessoa informa o e-mail. Resposta sempre igual: "Se o e-mail estiver cadastrado, enviamos um link".
2. Se existe User ativo, o Avant cria um PasswordReset (vale 1 hora, uso único) e envia o link. No máximo 3 pedidos por e-mail por hora.
3. Pelo link, a pessoa define a senha nova. Se tem 2FA, digita o código antes.
4. O Avant troca o hash, invalida os outros links pendentes, **encerra todas as sessões** e envia e-mail "Sua senha foi alterada".

**Ligar o login com Google** (Configurações, Conta): logado, a pessoa clica em "Ligar Google" e entra na conta Google. O e-mail do Google precisa ser o mesmo do Avant. A partir daí o login com Google funciona, e um e-mail avisa a ligação.

**Trocar a senha** (logado, em Configurações, Conta): senha atual e senha nova. Encerra as outras sessões, mantém a atual.

**Sessões ativas** (Configurações, Conta): lista com aparelho, navegador, IP aproximado e último uso. A pessoa encerra qualquer uma, ou todas menos a atual.

**Desligar o login Google:** a qualquer momento, porque toda conta tem senha.

**Encerramento automático das sessões:** User desativado, membro removido da única Empresa e troca de senha. Membro removido de uma Empresa, mas que está em outras, só perde aquela no seletor.

## Endpoints de autenticação

Todos em `/api/v1/auth`. Os que não exigem sessão têm limite de tentativas.

| Método e rota | Para quê | Sessão |
| --- | --- | --- |
| `GET /invitations/{token}` | dados do convite (Empresa, papel, e-mail, se a conta já existe) | não |
| `POST /invitations/{token}/accept` | aceita: cria conta ou só a Membership | conforme o caso |
| `POST /login` | e-mail e senha; responde `mfa_required` quando falta o código | não |
| `GET /google/start` e `GET /google/callback` | login com Google | não |
| `POST /mfa/verify` | código do app ou de recuperação | parcial |
| `POST /mfa/setup` e `POST /mfa/confirm` | ativar 2FA | sim |
| `DELETE /mfa` | desligar 2FA (clientes) | sim |
| `POST /password/forgot` e `POST /password/reset` | recuperar senha | não |
| `POST /password/change` | trocar senha | sim |
| `GET /me` | User, Empresas, Empresa ativa e permissões | sim |
| `POST /me/active-company` | trocar Empresa ativa | sim |
| `GET /sessions` e `DELETE /sessions/{id}` | sessões ativas | sim |
| `POST /logout` | sair | sim |

"Parcial" é uma pré-sessão de 5 minutos que só serve para digitar o código do 2FA.

As mensagens de erro ficam no dicionário PT/EN/ES do frontend. A API devolve só um código (`invalid_credentials`, `invitation_expired`, `invitation_email_mismatch`, `mfa_invalid`, `too_many_attempts`, `company_suspended`, `no_access`).

## Decisões de Pedro (23/10/2026)

| Pergunta | Decisão |
| --- | --- |
| Ligar o Google no primeiro login | Não; a pessoa liga antes em Configurações |
| Duração da sessão | 7 dias sem uso, 30 no máximo, 12 horas para a equipe Groone |
| Groone entrar na Empresa do cliente | Não. O painel interno mostra os registros de cada cliente para o suporte |
| Quem dá nome à Empresa | O cliente, ao aceitar o convite de dono |
| Domínio dos e-mails | avant.groone.com |

**Suporte pelo painel interno:** a equipe Groone nunca entra como membro numa Empresa de cliente. No painel interno, cada cliente tem uma página só de leitura com membros e convites, networks e suas sincronizações, e o AuditLog. Dali a Groone também faz o que só ela pode: trocar o dono, mudar o limite de vagas, suspender e zerar o 2FA de alguém.
