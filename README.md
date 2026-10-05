# GOD Sistemas de Proteções

Sistema web para gerenciamento comercial e administrativo, desenvolvido para centralizar informações de clientes, documentação, colaboradores, preferências do sistema e rotinas administrativas em uma única interface.

> **Status:** em desenvolvimento 🚧

## 📌 Sobre o projeto

O **Sistema-GOD** foi estruturado como uma aplicação de gestão interna, com foco em organização, produtividade e facilidade de uso.

A aplicação reúne diferentes áreas do negócio em uma navegação única, permitindo cadastrar e consultar clientes, acompanhar documentação, administrar colaboradores e acessar módulos financeiros e de configuração.

## ✨ Principais funcionalidades

### 🏢 Comercial

- Cadastro e edição de clientes.
- Consulta e pesquisa de clientes.
- Filtros por status.
- Validação de cadastro, incluindo verificação de CNPJ duplicado.
- Cálculos automáticos relacionados a prazos e duração do trabalho.
- Atualização da listagem após alterações.

### 📄 Documentação

- Área dedicada aos documentos dos clientes.
- Organização de documentos por cadastro.
- Controle dos documentos principais:
  - Proposta;
  - Contrato;
  - Ficha Cadastral.
- Upload de arquivos.
- Download e remoção de documentos.
- Indicação visual do estado da documentação.

### 👥 Departamento Pessoal

- Cadastro de colaboradores.
- Edição de colaboradores.
- Organização das informações pessoais e profissionais.
- Informações adicionais.
- Cadastro de foto do colaborador.
- Atualização dos cards e listagens após alterações.

### 💰 Financeiro

Estrutura preparada para os módulos de:

- Despesas;
- Receitas.

Os módulos financeiros podem ser evoluídos conforme as necessidades do sistema.

### ⚙️ Configurações

- Preferência de tema:
  - Sistema;
  - Claro;
  - Escuro.
- Seleção de idioma:
  - Português (Brasil);
  - Inglês (Estados Unidos);
  - Espanhol.
- Configuração de fuso horário.
- Aplicação das preferências do usuário.

## 🧭 Estrutura de navegação

```text
Sistema-GOD
│
├── Comercial
│   ├── Rede de Clientes
│   │   ├── Pesquisar / Filtrar
│   │   ├── Cadastrar cliente
│   │   ├── Editar cliente
│   │   └── Consultar informações
│   │
│   └── Documentação
│       ├── Proposta
│       ├── Contrato
│       └── Ficha Cadastral
│
├── Administrativo
│   ├── Departamento Pessoal
│   │   ├── Cadastrar colaborador
│   │   ├── Editar colaborador
│   │   └── Gerenciar informações
│   │
│   └── Financeiro
│       ├── Despesas
│       └── Receitas
│
└── Configurações
    ├── Tema
    ├── Idioma
    └── Fuso horário
```

## 🔄 Fluxo principal

```text
Abertura do sistema
        ↓
Inicialização
        ↓
Carregamento das preferências e dados
        ↓
Área principal
        ↓
┌───────────────┬──────────────────┬─────────────────┐
│   Comercial   │  Administrativo  │  Configurações  │
└───────┬───────┴────────┬─────────┴────────┬────────┘
        ↓                  ↓                  ↓
 Clientes            Departamento        Preferências
        ↓               Pessoal              ↓
Documentação         Financeiro          Aplicação
        ↓
Atualização dos dados
```

## 💾 Armazenamento

A aplicação utiliza mecanismos de armazenamento no navegador para manter os dados localmente, conforme a estrutura atual do projeto:

- **localStorage** para dados como clientes, colaboradores e preferências;
- **IndexedDB** para dados que exigem armazenamento de arquivos, como documentos e fotos.

> Os dados armazenados localmente dependem do navegador e do ambiente em que a aplicação é executada.

## 🎨 Interface

A interface foi organizada com foco em uma experiência administrativa simples e responsiva, incluindo:

- Menu lateral de navegação;
- Barra superior;
- Tabelas e cards;
- Formulários;
- Modais;
- Mensagens de confirmação e notificações;
- Estados vazios;
- Badges de status;
- Suporte a tema claro e escuro;
- Layout responsivo para diferentes tamanhos de tela;
- Suporte a redução de animações para usuários que preferem menos movimento.

### 📱 Responsividade

O layout possui adaptações para telas menores, reorganizando navegação, tabelas, formulários, modais e demais componentes para melhorar a utilização em dispositivos móveis.

## 🗂️ Módulos previstos

Além dos módulos já estruturados, a navegação do sistema contempla espaço para futuras áreas, como:

- Logística;
- Produção;
- Instalação.

Essas áreas podem ser implementadas gradualmente conforme a evolução do projeto.

## 🛠️ Tecnologias

A implementação atual utiliza tecnologias web para construção da interface e persistência local dos dados.

Principais recursos identificados na estrutura do projeto:

- HTML;
- CSS;
- JavaScript;
- localStorage;
- IndexedDB;
- APIs do navegador.

## 🚀 Execução

Como o projeto é uma aplicação web, a forma de execução pode variar conforme a estrutura dos arquivos e o ambiente utilizado.

Para desenvolvimento local, abra o projeto em um servidor local ou utilize a configuração de desenvolvimento definida nos arquivos do repositório.

> Caso sejam adicionadas dependências ou um processo de build ao projeto, esta seção deverá ser atualizada com os comandos correspondentes.

## 📋 Fluxograma do sistema

O projeto possui uma documentação de fluxo funcional que representa a navegação, os processos de cadastro, documentação, Departamento Pessoal, Financeiro, Configurações, armazenamento e regras gerais da interface.

### Fluxo resumido

```text
INÍCIO
  ↓
CARREGAR SISTEMA
  ↓
CARREGAR PREFERÊNCIAS
  ↓
SELECIONAR ÁREA
  ↓
┌─────────────────────────────────────────┐
│                                         │
│  COMERCIAL → CLIENTES → DOCUMENTAÇÃO    │
│                                         │
│  ADMINISTRATIVO → DP / FINANCEIRO       │
│                                         │
│  CONFIGURAÇÕES → TEMA / IDIOMA / FUSO  │
│                                         │
└─────────────────────────────────────────┘
  ↓
SALVAR / ATUALIZAR DADOS
  ↓
FIM / CONTINUAR NAVEGAÇÃO
```

## 🔐 Observações sobre dados

Este projeto utiliza armazenamento local no navegador na estrutura atual. Por isso, dados importantes devem ser tratados com atenção, especialmente em ambientes de produção.

Antes de utilizar o sistema em um ambiente real, recomenda-se definir uma estratégia de:

- autenticação e autorização;
- backup;
- sincronização entre dispositivos;
- banco de dados centralizado, caso necessário;
- controle de acesso aos dados;
- proteção de informações sensíveis.

## 🗺️ Roadmap

- [x] Estrutura de navegação principal
- [x] Área Comercial
- [x] Cadastro e edição de clientes
- [x] Área de documentação
- [x] Departamento Pessoal
- [x] Configurações e preferências
- [x] Tema claro/escuro/sistema
- [x] Layout responsivo
- [ ] Evolução do módulo Financeiro
- [ ] Módulo de Logística
- [ ] Módulo de Produção
- [ ] Módulo de Instalação
- [ ] Autenticação de usuários
- [ ] Controle de permissões
- [ ] Persistência em banco de dados centralizado
- [ ] Backup e sincronização

## 🤝 Contribuição

Sugestões, correções e melhorias são bem-vindas.

Para contribuir:

1. Faça um fork do projeto.
2. Crie uma branch para sua alteração.
3. Faça as modificações.
4. Teste a funcionalidade.
5. Abra um Pull Request descrevendo o que foi alterado.

## 📄 Licença

A licença do projeto ainda não foi definida neste repositório. Consulte o responsável pelo projeto antes de reutilizar ou distribuir o código.

## 👨‍💻 Autor

**OtavioDev23**

Projeto: **Sistema-GOD**

---

⭐ Se este projeto for útil para você, considere deixar uma estrela no repositório e acompanhar sua evolução.
